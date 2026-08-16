/**
 * paper-tear.js - Dual-Contour Realistic Torn Paper Rendering Engine
 */

// Generate a reusable 128x128 noise tile for paper grain (CORS-safe & fast)
let cachedGrainPattern = null;
function getGrainPattern(ctx) {
    if (!cachedGrainPattern) {
        const grainCanvas = document.createElement('canvas');
        grainCanvas.width = 128;
        grainCanvas.height = 128;
        const gCtx = grainCanvas.getContext('2d');
        const gData = gCtx.createImageData(128, 128);
        const d = gData.data;
        for (let i = 0; i < d.length; i += 4) {
            const val = Math.floor(Math.random() * 255);
            d[i] = val;
            d[i + 1] = val;
            d[i + 2] = val;
            d[i + 3] = 16; // Subtle grain opacity
        }
        gCtx.putImageData(gData, 0, 0);
        cachedGrainPattern = ctx.createPattern(grainCanvas, 'repeat');
    }
    return cachedGrainPattern;
}

function generateRealisticTornPaperContours(basePoints, roughness, baseBorder, variationPercent) {
    const noiseOuter = createNoiseGenerator(Math.floor(Math.random() * 50000) + 1);
    const noiseInner = createNoiseGenerator(Math.floor(Math.random() * 50000) + 10000);
    const noiseWidth = createNoiseGenerator(Math.floor(Math.random() * 50000) + 20000);

    const resampled = resamplePolygon(basePoints, 4.5);
    const N = resampled.length;
    if (N < 3) return null;

    // Check polygon winding direction (Shoelace in screen coords where Y is down)
    const signedArea = getPolygonSignedArea(resampled);
    const isClockwise = signedArea > 0;

    const outerContour = [];
    const innerContour = [];
    const fiberFringes = []; // Micro paper fibers

    for (let i = 0; i < N; i++) {
        const prev = resampled[(i - 1 + N) % N];
        const curr = resampled[i];
        const next = resampled[(i + 1) % N];

        // Tangent vector
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;

        // Guaranteed OUTWARD normal vector in screen space
        let nx, ny;
        if (isClockwise) {
            nx = dy / len;
            ny = -dx / len;
        } else {
            nx = -dy / len;
            ny = dx / len;
        }

        // Parameter t along the loop
        const t = i / N;
        const loopCoord = t * 14.0;

        // 1. Organic outer tear displacement (smooth wavy tear without sharp corners)
        const outerDisp = noiseOuter.fbm(loopCoord, 4, 2.2, 0.45) * (roughness * 1.5);
        
        // Outer paper backing position (expanded outwards from drawn lasso)
        const outerX = curr.x + nx * (baseBorder * 0.7 + outerDisp);
        const outerY = curr.y + ny * (baseBorder * 0.7 + outerDisp);
        outerContour.push({ x: outerX, y: outerY });

        // 2. Variable White Border Width: "Chỗ rộng chỗ hẹp" (dynamically varies from thin 3px to wide peeling)
        const varWeight = variationPercent / 100;
        // Wide wave for macro peeling behavior
        const widthMod = (noiseWidth.fbm(loopCoord * 0.55, 3, 2.0, 0.5) + 0.5); // 0.0 to 1.0
        const currentBorder = Math.max(3.5, baseBorder * (0.25 + widthMod * varWeight * 1.5));

        // 3. Inner tear displacement (independent tear contour for printed paper layer)
        const innerDispNoise = noiseInner.fbm(loopCoord * 1.3 + 5.2, 3, 2.1, 0.4) * (roughness * 0.4);
        const innerDistFromOuter = currentBorder + innerDispNoise;

        // Inner printed image position (receded INWARD from outer paper edge)
        const innerX = outerX - nx * Math.max(3.0, innerDistFromOuter);
        const innerY = outerY - ny * Math.max(3.0, innerDistFromOuter);
        innerContour.push({ x: innerX, y: innerY });

        // 4. Fiber hairs on outer edge
        if (Math.random() < 0.75) {
            const fiberLen = 2.5 + Math.random() * (roughness * 0.4 + 4.5);
            const angleOffset = (Math.random() - 0.5) * 0.9;
            const cosA = Math.cos(angleOffset);
            const sinA = Math.sin(angleOffset);
            const fnx = nx * cosA - ny * sinA;
            const fny = nx * sinA + ny * cosA;

            fiberFringes.push({
                x1: outerX,
                y1: outerY,
                x2: outerX + fnx * fiberLen,
                y2: outerY + fny * fiberLen,
                opacity: 0.45 + Math.random() * 0.5,
                width: 0.8 + Math.random() * 1.0
            });
        }
    }

    return {
        outerContour,
        innerContour,
        fiberFringes
    };
}

function renderTornPaperResult(image, points, options) {
    const {
        roughness,
        baseBorder,
        variation,
        fiberIntensity,
        shadowBlur,
        tintMode
    } = options;

    const tearData = generateRealisticTornPaperContours(points, roughness, baseBorder, variation);
    if (!tearData) return null;

    const { outerContour, innerContour, fiberFringes } = tearData;

    // Create Offscreen Canvas with ample padding
    const padding = Math.max(60, shadowBlur * 2.5 + baseBorder * 3.0);
    const offCanvas = document.createElement('canvas');
    offCanvas.width = image.width + padding * 2;
    offCanvas.height = image.height + padding * 2;
    const offCtx = offCanvas.getContext('2d');

    offCtx.save();
    offCtx.translate(padding, padding);

    // 1. LAYER 1: Realistic Multi-tier Drop Shadow
    if (shadowBlur > 0) {
        offCtx.save();
        offCtx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        offCtx.shadowBlur = shadowBlur;
        offCtx.shadowOffsetX = shadowBlur * 0.25;
        offCtx.shadowOffsetY = shadowBlur * 0.45;

        renderSmoothPath(offCtx, outerContour);
        offCtx.fillStyle = '#000000';
        offCtx.fill();
        offCtx.restore();

        // Contact ambient shadow (close & crisp)
        offCtx.save();
        offCtx.shadowColor = 'rgba(0, 0, 0, 0.38)';
        offCtx.shadowBlur = shadowBlur * 0.3;
        offCtx.shadowOffsetX = 1;
        offCtx.shadowOffsetY = 2;

        renderSmoothPath(offCtx, outerContour);
        offCtx.fillStyle = '#000000';
        offCtx.fill();
        offCtx.restore();
    }

    // 2. LAYER 2: Paper Base & Pulp (Viền giấy trắng tự nhiên / White Torn Pulp Backing)
    offCtx.save();
    renderSmoothPath(offCtx, outerContour);

    let paperColor = '#faf8f3';
    let paperEdgeTone = '#e4ded2';
    if (tintMode === 'vintage') {
        paperColor = '#f3eedc';
        paperEdgeTone = '#ded3b8';
    } else if (tintMode === 'pure') {
        paperColor = '#ffffff';
        paperEdgeTone = '#eaeaea';
    } else if (tintMode === 'cardboard') {
        paperColor = '#dfd3be';
        paperEdgeTone = '#c7b79e';
    }

    offCtx.fillStyle = paperColor;
    offCtx.fill();

    // Subtle tactile bevel on outer paper rim
    offCtx.strokeStyle = paperEdgeTone;
    offCtx.lineWidth = 1.5;
    offCtx.stroke();
    offCtx.restore();

    // 3. LAYER 3: Paper Fibers & Cellulosic Micro-Hairs (Lông tơ xơ giấy rách ở viền ngoài)
    if (fiberIntensity > 0) {
        offCtx.save();
        fiberFringes.forEach(f => {
            if (Math.random() > fiberIntensity) return;
            offCtx.beginPath();
            offCtx.moveTo(f.x1, f.y1);
            offCtx.lineTo(f.x2, f.y2);
            offCtx.strokeStyle = `rgba(255, 252, 245, ${f.opacity * fiberIntensity})`;
            offCtx.lineWidth = f.width;
            offCtx.lineCap = 'round';
            offCtx.stroke();
        });
        offCtx.restore();
    }

    // 4. LAYER 4: Printed Layer Depth & Drop Shadow onto White Pulp
    // The printed image layer casts a soft drop shadow onto the white backing underneath
    offCtx.save();
    renderSmoothPath(offCtx, outerContour);
    offCtx.clip();

    offCtx.save();
    offCtx.shadowColor = 'rgba(20, 15, 10, 0.45)';
    offCtx.shadowBlur = 6;
    offCtx.shadowOffsetX = 1.5;
    offCtx.shadowOffsetY = 2.0;

    renderSmoothPath(offCtx, innerContour);
    offCtx.fillStyle = '#000000';
    offCtx.fill();
    offCtx.restore();

    // 5. LAYER 5: Clipped Original Image
    offCtx.save();
    renderSmoothPath(offCtx, innerContour);
    offCtx.clip();

    offCtx.drawImage(image, 0, 0);

    // Subtle inner highlight on printed tear boundary
    offCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    offCtx.lineWidth = 1.2;
    offCtx.stroke();

    offCtx.restore(); // end clip inner
    offCtx.restore(); // end outer clip

    // 6. LAYER 6: Seamless Paper Grain Pattern (CORS Safe)
    offCtx.save();
    renderSmoothPath(offCtx, outerContour);
    offCtx.clip();
    const pattern = getGrainPattern(offCtx);
    if (pattern) {
        offCtx.fillStyle = pattern;
        offCtx.fillRect(-padding, -padding, offCanvas.width, offCanvas.height);
    }
    offCtx.restore();

    offCtx.restore(); // end translation

    return offCanvas;
}
