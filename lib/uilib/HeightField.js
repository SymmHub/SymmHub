/**
 * HeightField.js
 *
 * A channel of one number per pixel, 0 to 1 (a height map over a picture),
 * and the brushes that paint it. Pure arithmetic on a Float32Array, so the
 * painting is the same in a window (ImageChannelEditor) and in a test.
 *
 *   const f = createHeightField(w, h);           // all 0
 *   brushStroke(f, [x0, y0], [x1, y1], { mode: 'raise', radius: 12, strength: 0.1, softness: 0.5 });
 *   gradientFill(f, [x0, y0], [x1, y1], 0, 1);   // a ramp along the drag
 *   const rgba = heightFieldToRGBA(f);           // grey pixels, for a PNG
 *
 * Pixel coordinates: x right, y down, the centre of pixel (i, j) at
 * (i + 0.5, j + 0.5). A mask (Float32Array of the field's size, 0 to 1)
 * scales every change: a picture's alpha keeps the paint where the picture is.
 * Every painting function returns the box it changed, [x0, y0, x1, y1] in
 * whole pixels (x1, y1 past the end), or null.
 */

/** a field of w by h, its values data (copied) or 0 */
function createHeightField(width, height, data = null){
    const f = { width, height, data: new Float32Array(width*height) };
    if (data) f.data.set(data.subarray ? data.subarray(0, f.data.length) : data.slice(0, f.data.length));
    return f;
}

/** a copy of the field */
function copyHeightField(f){
    return createHeightField(f.width, f.height, f.data);
}

/** the field of the red channel of RGBA bytes (a grey PNG's pixels), w by h */
function heightFieldFromRGBA(rgba, width, height){
    const f = createHeightField(width, height);
    for (let i = 0; i < f.data.length; i++) f.data[i] = rgba[4*i]/255;
    return f;
}

/** grey opaque RGBA bytes of the field (Uint8ClampedArray), for an ImageData */
function heightFieldToRGBA(f){
    const out = new Uint8ClampedArray(4*f.data.length);
    for (let i = 0; i < f.data.length; i++) {
        const b = Math.round(255*f.data[i]);
        out[4*i] = out[4*i + 1] = out[4*i + 2] = b;
        out[4*i + 3] = 255;
    }
    return out;
}

/** is every value 0 */
function isFlatField(f){
    for (let i = 0; i < f.data.length; i++) if (f.data[i] !== 0) return false;
    return true;
}

/** the weight of a brush at distance d: 1 within the hard core, smooth to 0 at the radius */
function brushWeight(d, radius, softness){
    if (d >= radius) return 0;
    const core = radius*(1 - Math.min(Math.max(softness, 0), 1));
    if (d <= core) return 1;
    const t = (d - core)/(radius - core);
    return 1 - t*t*(3 - 2*t);
}

const clamp01 = (v) => (v < 0 ? 0 : (v > 1 ? 1 : v));

/** the box of a disk of radius r at (x, y), within the field; null when outside */
function diskBox(f, x, y, r){
    const x0 = Math.max(0, Math.floor(x - r)), y0 = Math.max(0, Math.floor(y - r));
    const x1 = Math.min(f.width, Math.ceil(x + r)), y1 = Math.min(f.height, Math.ceil(y + r));
    return (x0 < x1 && y0 < y1) ? [x0, y0, x1, y1] : null;
}

/** the union of two boxes (either may be null) */
function unionBox(a, b){
    if (!a) return b;
    if (!b) return a;
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

/**
 * one dab of the brush at (x, y):
 *   mode      'raise' (+strength at the centre), 'lower' (-strength),
 *             'level' (towards opt.level by the strength's share),
 *             'smooth' (towards the mean of the 3 by 3 pixels around, by the strength's share)
 *   radius    px of the field
 *   strength  0 to 1
 *   softness  0 (a hard disk) to 1 (soft from the centre)
 *   mask      Float32Array or null
 */
function brushDab(f, x, y, opt){
    const r = Math.max(opt.radius, 0.5);
    const box = diskBox(f, x, y, r);
    if (!box) return null;
    const [x0, y0, x1, y1] = box;
    const s = Math.min(Math.max(opt.strength ?? 0.1, 0), 1);
    const soft = opt.softness ?? 0.5;
    const mask = opt.mask || null;
    const w = f.width, d = f.data;
    // smooth reads the values as they were before this dab
    const src = opt.mode === 'smooth' ? d.slice() : d;
    for (let j = y0; j < y1; j++) {
        for (let i = x0; i < x1; i++) {
            let k = brushWeight(Math.hypot(i + 0.5 - x, j + 0.5 - y), r, soft);
            if (k <= 0) continue;
            const n = j*w + i;
            if (mask) k *= mask[n];
            if (k <= 0) continue;
            const v = d[n];
            switch (opt.mode) {
            case 'lower': d[n] = clamp01(v - s*k); break;
            case 'level': d[n] = clamp01(v + (clamp01(opt.level ?? 0.5) - v)*s*k); break;
            case 'smooth': {
                let sum = 0, cnt = 0;
                for (let b = Math.max(0, j - 1); b <= Math.min(f.height - 1, j + 1); b++) {
                    for (let a = Math.max(0, i - 1); a <= Math.min(w - 1, i + 1); a++) { sum += src[b*w + a]; cnt++; }
                }
                d[n] = clamp01(v + (sum/cnt - v)*s*k);
                break;
            }
            default: d[n] = clamp01(v + s*k);
            }
        }
    }
    return box;
}

/** dabs from a to b, a quarter of the radius apart (a not included: the dab before ended there); the box changed */
function brushStroke(f, a, b, opt){
    const step = Math.max(opt.radius*0.25, 0.5);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len/step));
    let box = null;
    for (let k = 1; k <= n; k++) {
        const t = k/n;
        box = unionBox(box, brushDab(f, a[0] + (b[0] - a[0])*t, a[1] + (b[1] - a[1])*t, opt));
    }
    return box;
}

/**
 * a ramp from v0 at p0 to v1 at p1 (along p0 to p1, flat beyond its ends),
 * blended by the mask; the whole field changes
 */
function gradientFill(f, p0, p1, v0, v1, mask = null){
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const len2 = dx*dx + dy*dy;
    const w = f.width;
    for (let j = 0; j < f.height; j++) {
        for (let i = 0; i < w; i++) {
            const t = len2 > 0 ? clamp01(((i + 0.5 - p0[0])*dx + (j + 0.5 - p0[1])*dy)/len2) : 0;
            const n = j*w + i;
            const g = clamp01(v0 + (v1 - v0)*t);
            const k = mask ? mask[n] : 1;
            f.data[n] = f.data[n] + (g - f.data[n])*k;
        }
    }
    return [0, 0, f.width, f.height];
}

/** every value v as 1 - v, blended by the mask */
function invertField(f, mask = null){
    for (let n = 0; n < f.data.length; n++) {
        const k = mask ? mask[n] : 1;
        f.data[n] = f.data[n] + (1 - 2*f.data[n])*k;
    }
    return [0, 0, f.width, f.height];
}

/** every value set to v, blended by the mask */
function fillField(f, v, mask = null){
    for (let n = 0; n < f.data.length; n++) {
        const k = mask ? mask[n] : 1;
        f.data[n] = f.data[n] + (clamp01(v) - f.data[n])*k;
    }
    return [0, 0, f.width, f.height];
}

/** the size of a field for a picture of w by h: the picture's, at most maxSide on its longer side */
function fieldSizeFor(width, height, maxSide = 1024){
    const k = Math.min(1, maxSide/Math.max(width, height, 1));
    return [Math.max(1, Math.round(width*k)), Math.max(1, Math.round(height*k))];
}

export {
    createHeightField,
    copyHeightField,
    heightFieldFromRGBA,
    heightFieldToRGBA,
    isFlatField,
    brushWeight,
    brushDab,
    brushStroke,
    gradientFill,
    invertField,
    fillField,
    fieldSizeFor,
};
