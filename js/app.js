/**
 * app.js - UI Controller & Event Handlers
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

// Load User Uploaded Image
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => initImage(img);
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// Load Sample Image (image.png from directory)
function loadSampleImage(e) {
    if (e) e.stopPropagation();
    const img = new Image();
    img.onload = () => initImage(img);
    img.onerror = () => {
        // Fallback to assets/sample.png if image.png fails
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
        instructionText.innerHTML = '<div class="dot"></div><span>Hãy tải ảnh lên hoặc chọn ảnh mẫu để bắt đầu</span>';
        return;
    }
    if (state.mode === 'freehand') {
        instructionText.innerHTML = '<div class="dot"></div><span>Giữ chuột trái và vẽ khoanh vùng tự do quanh phần muốn cắt</span>';
    } else {
        instructionText.innerHTML = '<div class="dot"></div><span>Click từng điểm để tạo vùng gấp khúc. Click gần điểm đầu để khép kín</span>';
    }
}

// Mode Switching
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
        alert('Vui lòng dùng chuột khoanh vùng muốn cắt trước!');
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

    const resultCanvas = renderTornPaperResult(state.image, fullPoints, options);
    if (!resultCanvas) return;

    const resultDataUrl = resultCanvas.toDataURL('image/png');
    document.getElementById('resultImg').src = resultDataUrl;
    document.getElementById('btnDownload').href = resultDataUrl;
    document.getElementById('resultModal').style.display = 'flex';
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
