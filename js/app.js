/**
 * app.js - UI Controller, Drag & Drop, Clipboard, and Event Handlers
 */

// Application State
const state = {
    image: null,
    points: [],
    isDrawing: false,
    mode: 'freehand',
    imgWidth: 0,
    imgHeight: 0,
    scale: 1
};

// DOM Elements
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('fileInput');
const uploadDropzone = document.getElementById('uploadDropzone');
const workspace = document.getElementById('workspace');
const dragOverlay = document.getElementById('dragOverlay');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const toastContainer = document.getElementById('toastContainer');
const urlModal = document.getElementById('urlModal');
const inputImageUrl = document.getElementById('inputImageUrl');

const btnCut = document.getElementById('btnCut');
const btnReset = document.getElementById('btnReset');
const modeFreehand = document.getElementById('modeFreehand');
const modePolygon = document.getElementById('modePolygon');
const instructionText = document.getElementById('instructionText');

// Parameter Controls
const paramRoughness = document.getElementById('paramRoughness');
const paramBorder = document.getElementById('paramBorder');
const paramVariation = document.getElementById('paramVariation');
const paramFibers = document.getElementById('paramFibers');
const paperTint = document.getElementById('paperTint');
const paramShadow = document.getElementById('paramShadow');

// Value Labels
paramRoughness.oninput = (e) => document.getElementById('valRoughness').innerText = e.target.value;
paramBorder.oninput = (e) => document.getElementById('valBorder').innerText = e.target.value + 'px';
paramVariation.oninput = (e) => document.getElementById('valVariation').innerText = e.target.value + '%';
paramFibers.oninput = (e) => document.getElementById('valFibers').innerText = e.target.value + '%';
paramShadow.oninput = (e) => document.getElementById('valShadow').innerText = e.target.value + 'px';

// =========================================================================
// UI HELPERS (TOAST & LOADING)
// =========================================================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-fadeout');
        setTimeout(() => toast.remove(), 200);
    }, 3500);
}

function showLoading(text = 'Đang tải...') {
    if (loadingText) loadingText.innerText = text;
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

// =========================================================================
// IMAGE LOADING LOGIC (FILE, BLOB, URL, CORS-SAFE)
// =========================================================================

// Load User Uploaded Image from input file
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    loadImageFromFile(file);
});

function loadImageFromFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Tệp đã chọn không phải là hình ảnh!', 'error');
        return;
    }
    showLoading('Đang xử lý hình ảnh...');
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            hideLoading();
            initImage(img);
            showToast('Đã mở ảnh thành công!', 'success');
        };
        img.onerror = () => {
            hideLoading();
            showToast('Lỗi khi mở hình ảnh!', 'error');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// Load Image from URL with multi-fallback for CORS & canvas tainting
async function loadImageFromUrl(url) {
    if (!url) return;
    url = url.trim();

    showLoading('Đang tải ảnh từ nguồn web...');

    // If it's already a data URL or blob URL, load directly
    if (url.startsWith('data:image/') || url.startsWith('blob:')) {
        const img = new Image();
        img.onload = () => {
            hideLoading();
            initImage(img);
            showToast('Đã nạp ảnh thành công!', 'success');
        };
        img.onerror = () => {
            hideLoading();
            showToast('Không thể mở hình ảnh!', 'error');
        };
        img.src = url;
        return;
    }

    // List of CORS fetch strategies to guarantee clean canvas without tainting
    const strategies = [
        // 1. Direct fetch with CORS mode
        async (u) => {
            const res = await fetch(u, { mode: 'cors' });
            if (!res.ok) throw new Error('Direct fetch status ' + res.status);
            return await res.blob();
        },
        // 2. wsrv.nl image proxy (global high-performance CORS proxy)
        async (u) => {
            const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(u)}&output=png`;
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error('wsrv fetch status ' + res.status);
            return await res.blob();
        },
        // 3. corsproxy.io
        async (u) => {
            const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(u)}`;
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error('corsproxy fetch status ' + res.status);
            return await res.blob();
        },
        // 4. allorigins proxy
        async (u) => {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`;
            const res = await fetch(proxyUrl);
            if (!res.ok) throw new Error('allorigins fetch status ' + res.status);
            return await res.blob();
        }
    ];

    let blob = null;
    for (const fetchStrategy of strategies) {
        try {
            blob = await fetchStrategy(url);
            if (blob && blob.size > 0 && blob.type.includes('image')) {
                break;
            }
        } catch (err) {
            // continue trying next strategy
        }
    }

    if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            hideLoading();
            initImage(img);
            showToast('Đã kéo nạp ảnh từ web thành công!', 'success');
        };
        img.onerror = () => {
            hideLoading();
            showToast('Lỗi dựng hình ảnh từ dữ liệu tải về!', 'error');
        };
        img.src = objectUrl;
    } else {
        // Fallback: try loading with crossOrigin anonymous directly
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            hideLoading();
            initImage(img);
            showToast('Đã nạp ảnh thành công!', 'success');
        };
        img.onerror = () => {
            hideLoading();
            showToast('Không thể tải ảnh do chính sách bảo mật của trang gốc!', 'error');
        };
        img.src = url;
    }
}

// Load Sample Image (image.png from directory)
function loadSampleImage(e) {
    if (e) e.stopPropagation();
    const img = new Image();
    img.onload = () => initImage(img);
    img.onerror = () => {
        img.src = 'assets/sample.png';
    };
    img.src = 'image.png';
}

function initImage(img) {
    state.image = img;
    state.points = [];
    setupCanvas();
    btnCut.disabled = false;
    updateInstruction();
}

function setupCanvas() {
    if (!state.image) return;

    const maxW = window.innerWidth * 0.60;
    const maxH = window.innerHeight * 0.78;
    let w = state.image.width;
    let h = state.image.height;

    const ratio = Math.min(maxW / w, maxH / h, 1);
    state.imgWidth = w * ratio;
    state.imgHeight = h * ratio;
    state.scale = ratio;

    canvas.width = state.imgWidth;
    canvas.height = state.imgHeight;
    redraw();
}

function updateInstruction() {
    if (!state.image) {
        instructionText.innerHTML = '<div class="dot"></div><span>Hãy kéo thả ảnh từ web khác, tải ảnh lên hoặc chọn ảnh mẫu</span>';
        return;
    }
    if (state.mode === 'freehand') {
        instructionText.innerHTML = '<div class="dot"></div><span>Giữ chuột trái và vẽ khoanh vùng tự do quanh phần muốn cắt</span>';
    } else {
        instructionText.innerHTML = '<div class="dot"></div><span>Click từng điểm để tạo vùng gấp khúc. Click gần điểm đầu để khép kín</span>';
    }
}

// =========================================================================
// DRAG & DROP HANDLING (CROSS-TAB, CROSS-WINDOW, BROWSER, & LOCAL FILES)
// =========================================================================

// Parse dropped data transfer object
async function handleDropTransfer(dataTransfer) {
    if (!dataTransfer) return;

    // 1. Check for files (local file or browser file transfer)
    if (dataTransfer.files && dataTransfer.files.length > 0) {
        for (let i = 0; i < dataTransfer.files.length; i++) {
            const file = dataTransfer.files[i];
            if (file.type.startsWith('image/')) {
                loadImageFromFile(file);
                return;
            }
        }
    }

    // 2. Check for drag items with kind 'file'
    if (dataTransfer.items && dataTransfer.items.length > 0) {
        for (let i = 0; i < dataTransfer.items.length; i++) {
            const item = dataTransfer.items[i];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    loadImageFromFile(file);
                    return;
                }
            }
        }
    }

    // 3. Check for HTML snippet (dragged <img> tag or element from another webpage)
    const htmlData = dataTransfer.getData('text/html');
    if (htmlData) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlData, 'text/html');
            const img = doc.querySelector('img');
            if (img && img.src) {
                loadImageFromUrl(img.src);
                return;
            }
            // Check for source in picture tag
            const source = doc.querySelector('source');
            if (source && source.srcset) {
                const firstSrc = source.srcset.split(',')[0].trim().split(' ')[0];
                if (firstSrc) {
                    loadImageFromUrl(firstSrc);
                    return;
                }
            }
        } catch (e) {
            console.error('Error parsing dropped HTML', e);
        }
    }

    // 4. Check for URI list (standard browser URL drag)
    const uriList = dataTransfer.getData('text/uri-list');
    if (uriList) {
        const urls = uriList.split(/\r?\n/).map(u => u.trim()).filter(u => u && !u.startsWith('#'));
        if (urls.length > 0) {
            loadImageFromUrl(urls[0]);
            return;
        }
    }

    // 5. Check for plain text (URL or Data URI)
    const plainText = dataTransfer.getData('text/plain');
    if (plainText) {
        const trimmed = plainText.trim();
        if (
            trimmed.startsWith('data:image/') ||
            trimmed.startsWith('http://') ||
            trimmed.startsWith('https://') ||
            trimmed.startsWith('blob:')
        ) {
            loadImageFromUrl(trimmed);
            return;
        }
    }

    showToast('Không tìm thấy hình ảnh hợp lệ trong dữ liệu kéo thả!', 'error');
}

// Window Drag & Drop Listeners for full-screen overlay experience
let dragCounter = 0;

window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragOverlay) dragOverlay.classList.add('active');
    if (uploadDropzone) uploadDropzone.classList.add('drag-active');
});

window.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
});

window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
        dragCounter = 0;
        if (dragOverlay) dragOverlay.classList.remove('active');
        if (uploadDropzone) uploadDropzone.classList.remove('drag-active');
    }
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (dragOverlay) dragOverlay.classList.remove('active');
    if (uploadDropzone) uploadDropzone.classList.remove('drag-active');

    handleDropTransfer(e.dataTransfer);
});

// =========================================================================
// CLIPBOARD PASTE HANDLING (CTRL + V)
// =========================================================================
window.addEventListener('paste', async (e) => {
    // If active element is an input inside a modal, don't intercept unless wanted
    if (e.target && e.target.id === 'inputImageUrl') return;

    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    // 1. Check for image files in clipboard (e.g. screenshot or copied image file)
    if (clipboardData.files && clipboardData.files.length > 0) {
        for (let i = 0; i < clipboardData.files.length; i++) {
            const file = clipboardData.files[i];
            if (file.type.startsWith('image/')) {
                e.preventDefault();
                loadImageFromFile(file);
                showToast('📋 Đã dán ảnh từ Clipboard!', 'success');
                return;
            }
        }
    }

    // 2. Check for clipboard items
    if (clipboardData.items && clipboardData.items.length > 0) {
        for (let i = 0; i < clipboardData.items.length; i++) {
            const item = clipboardData.items[i];
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault();
                    loadImageFromFile(file);
                    showToast('📋 Đã dán ảnh từ Clipboard!', 'success');
                    return;
                }
            }
        }
    }

    // 3. Check for URL string in clipboard text
    const text = clipboardData.getData('text');
    if (text) {
        const trimmed = text.trim();
        if (
            trimmed.startsWith('data:image/') ||
            ((trimmed.startsWith('http://') || trimmed.startsWith('https://')) &&
                (trimmed.match(/\.(jpeg|jpg|gif|png|webp|svg|avif)($|\?)/i) || trimmed.includes('image') || trimmed.includes('img') || trimmed.includes('photo')))
        ) {
            e.preventDefault();
            loadImageFromUrl(trimmed);
            return;
        }
    }
});

// =========================================================================
// URL MODAL HANDLING
// =========================================================================
function openUrlModal(e) {
    if (e) e.stopPropagation();
    urlModal.style.display = 'flex';
    inputImageUrl.value = '';
    setTimeout(() => inputImageUrl.focus(), 50);
}

function closeUrlModal() {
    urlModal.style.display = 'none';
}

function submitUrlModal() {
    const url = inputImageUrl.value.trim();
    if (!url) {
        showToast('Vui lòng dán liên kết ảnh!', 'error');
        return;
    }
    closeUrlModal();
    loadImageFromUrl(url);
}

inputImageUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        submitUrlModal();
    } else if (e.key === 'Escape') {
        closeUrlModal();
    }
});

// =========================================================================
// MODE SWITCHING & DRAWING INTERACTIONS
// =========================================================================
modeFreehand.onclick = () => {
    state.mode = 'freehand';
    modeFreehand.classList.add('active');
    modePolygon.classList.remove('active');
    state.points = [];
    redraw();
    updateInstruction();
};

modePolygon.onclick = () => {
    state.mode = 'polygon';
    modePolygon.classList.add('active');
    modeFreehand.classList.remove('active');
    state.points = [];
    redraw();
    updateInstruction();
};

// Canvas Mouse Interactions
canvas.addEventListener('mousedown', (e) => {
    if (!state.image) return;
    const pos = getMousePos(e);

    if (state.mode === 'freehand') {
        state.isDrawing = true;
        state.points = [pos];
    } else {
        if (state.points.length > 2) {
            const first = state.points[0];
            const dist = Math.hypot(pos.x - first.x, pos.y - first.y);
            if (dist < 15) {
                redraw();
                return;
            }
        }
        state.points.push(pos);
    }
    redraw();
});

canvas.addEventListener('mousemove', (e) => {
    if (!state.image) return;
    const pos = getMousePos(e);

    if (state.mode === 'freehand' && state.isDrawing) {
        const last = state.points[state.points.length - 1];
        if (Math.hypot(pos.x - last.x, pos.y - last.y) > 3.5) {
            state.points.push(pos);
            redraw();
        }
    } else if (state.mode === 'polygon' && state.points.length > 0) {
        redraw(pos);
    }
});

window.addEventListener('mouseup', () => {
    if (state.mode === 'freehand' && state.isDrawing) {
        state.isDrawing = false;
        if (state.points.length > 3) {
            state.points.push({ ...state.points[0] });
        }
        redraw();
    }
});

canvas.addEventListener('dblclick', () => {
    if (state.mode === 'polygon' && state.points.length > 2) {
        state.points.push({ ...state.points[0] });
        redraw();
    }
});

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function redraw(previewPos = null) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (state.image) {
        ctx.drawImage(state.image, 0, 0, state.imgWidth, state.imgHeight);
    }

    if (state.points.length === 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(state.points[0].x, state.points[0].y);
    for (let i = 1; i < state.points.length; i++) {
        ctx.lineTo(state.points[i].x, state.points[i].y);
    }

    if (previewPos && state.mode === 'polygon') {
        ctx.lineTo(previewPos.x, previewPos.y);
    }

    ctx.strokeStyle = '#121212';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.stroke();

    ctx.strokeStyle = '#cdee2d';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    if (state.mode === 'polygon') {
        state.points.forEach((pt, idx) => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, idx === 0 ? 7 : 4.5, 0, Math.PI * 2);
            ctx.fillStyle = idx === 0 ? '#cdee2d' : '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#121212';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }
    ctx.restore();
}

btnReset.onclick = () => {
    state.points = [];
    redraw();
};

// Cut Button Action
btnCut.onclick = () => {
    if (!state.image || state.points.length < 3) {
        showToast('Vui lòng dùng chuột khoanh vùng muốn cắt trước!', 'error');
        return;
    }

    const scaleRatio = state.image.width / state.imgWidth;
    const fullPoints = state.points.map(p => ({
        x: p.x * scaleRatio,
        y: p.y * scaleRatio
    }));

    const options = {
        roughness: parseFloat(paramRoughness.value) * scaleRatio,
        baseBorder: parseFloat(paramBorder.value) * scaleRatio,
        variation: parseFloat(paramVariation.value),
        fiberIntensity: parseFloat(paramFibers.value) / 100,
        shadowBlur: parseFloat(paramShadow.value) * scaleRatio,
        tintMode: paperTint.value
    };

    try {
        const resultCanvas = renderTornPaperResult(state.image, fullPoints, options);
        if (!resultCanvas) return;

        const resultDataUrl = resultCanvas.toDataURL('image/png');
        document.getElementById('resultImg').src = resultDataUrl;
        document.getElementById('btnDownload').href = resultDataUrl;
        document.getElementById('resultModal').style.display = 'flex';
    } catch (err) {
        console.error('Error rendering result:', err);
        showToast('Lỗi khi render ảnh: ' + err.message, 'error');
    }
};

function closeModal() {
    document.getElementById('resultModal').style.display = 'none';
}

// Automatically load sample image on startup
window.addEventListener('DOMContentLoaded', () => {
    loadSampleImage();
});

// Resize listener
window.addEventListener('resize', () => {
    if (state.image) setupCanvas();
});

