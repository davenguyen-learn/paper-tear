/**
 * noise.js - Procedural Noise & Geometric Interpolation
 */

// Smooth Perlin-like 1D gradient noise with multiple octaves (fBm)
function createNoiseGenerator(seed = 1337) {
    const permutation = [];
    for (let i = 0; i < 256; i++) permutation[i] = i;
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    for (let i = 255; i > 0; i--) {
        s = (s * 16807) % 2147483647;
        const j = s % (i + 1);
        [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
    const p = [...permutation, ...permutation];

    function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(t, a, b) { return a + t * (b - a); }
    function grad(hash, x) {
        const h = hash & 15;
        const gradVal = 1.0 + (h & 7);
        return (h & 8) !== 0 ? -gradVal * x : gradVal * x;
    }

    function noise1D(x) {
        const X = Math.floor(x) & 255;
        x -= Math.floor(x);
        const fx = fade(x);
        return lerp(fx, grad(p[X], x), grad(p[X + 1], x - 1)) * 0.25;
    }

    function fbm(x, octaves = 4, lacunarity = 2.2, gain = 0.48) {
        let sum = 0;
        let amp = 1.0;
        let freq = 1.0;
        let maxAmp = 0;
        for (let i = 0; i < octaves; i++) {
            sum += noise1D(x * freq) * amp;
            maxAmp += amp;
            freq *= lacunarity;
            amp *= gain;
        }
        return sum / maxAmp;
    }

    return { noise1D, fbm };
}

// Calculate signed polygon area to determine winding order (Clockwise vs Counter-Clockwise)
function getPolygonSignedArea(pts) {
    let area = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    return area / 2;
}

// Resample polygon points evenly along the perimeter
function resamplePolygon(pts, stepSize = 4.5) {
    if (pts.length < 3) return [];
    
    // Ensure closed loop
    const isClosed = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 5;
    const points = [...pts];
    if (!isClosed) points.push({ ...points[0] });

    // Calculate segment lengths
    const segLengths = [];
    let totalLength = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const dist = Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y);
        segLengths.push(dist);
        totalLength += dist;
    }

    if (totalLength < 10) return points;

    const resampled = [];
    const numSteps = Math.max(14, Math.floor(totalLength / stepSize));
    const actualStep = totalLength / numSteps;

    let currentSeg = 0;
    let currentSegDist = 0;

    for (let i = 0; i < numSteps; i++) {
        const targetDist = i * actualStep;

        while (currentSeg < segLengths.length - 1 && currentSegDist + segLengths[currentSeg] < targetDist) {
            currentSegDist += segLengths[currentSeg];
            currentSeg++;
        }

        const segLen = segLengths[currentSeg];
        const t = segLen > 0 ? (targetDist - currentSegDist) / segLen : 0;
        const p1 = points[currentSeg];
        const p2 = points[currentSeg + 1];

        resampled.push({
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t
        });
    }

    return resampled;
}

// Smooth contour with organic Catmull-Rom spline curves (No sharp triangular teeth)
function renderSmoothPath(cContext, pts) {
    if (pts.length < 3) return;
    cContext.beginPath();
    cContext.moveTo(pts[0].x, pts[0].y);

    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const p3 = pts[(i + 2) % n];

        // Catmull-Rom to Cubic Bezier conversion
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        cContext.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    cContext.closePath();
}
