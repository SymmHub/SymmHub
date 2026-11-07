//
//  image items: a raster image placed on a quad of the drawing; what a frame
//  holds (Frames.js)
//
//    { type: 'image', id, closed: true, src: 'data:image/png;base64,...',
//      points: [x0, y0, x1, y1, x2, y2, x3, y3],   world coordinates: the
//                                                 image's bottom-left, bottom-
//                                                 right, top-right, top-left
//      style: { stroke: null, fill: null, opacity } }
//
//  In the document the image is a data URL; in a saved document with a
//  binary sidecar its bytes go into a chunk (DrawingLayer). An SVG file can
//  be an image too, a picture of it as the browser draws it: src keeps the
//  SVG, and its bitmap is made at SVG_PICTURE_SIDE.
//

const SVG_TYPE = 'image/svg+xml';
// the longer side of an SVG picture's bitmap, in pixels: the largest sprite
const SVG_PICTURE_SIDE = 2048;
// the alpha (of 255) from which a pixel can be clicked
const SOLID_ALPHA = 16;

/** is the blob an SVG document: by its media type, or by a file's extension */
function isSvgBlob(blob){
    return blob.type.startsWith('image/svg') || /\.svg$/i.test(blob.name || '');
}

/**
 * the bitmap of an SVG document as the browser draws it, sharp at the
 * picture's size: createImageBitmap cannot decode an SVG blob, an image
 * element can, and a canvas draws it anew at its own scale
 */
async function svgBitmap(blob){
    const url = URL.createObjectURL(new Blob([blob], { type: SVG_TYPE }));
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        const w = img.naturalWidth || 300, h = img.naturalHeight || 150;
        const s = SVG_PICTURE_SIDE/Math.max(w, h);
        const canvas = new OffscreenCanvas(Math.max(1, Math.round(w*s)), Math.max(1, Math.round(h*s)));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // the read also fails on a canvas the SVG tainted (a foreignObject),
        // which could never reach a texture
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let drawn = false;
        for (let i = 3; i < data.length && !drawn; i += 4) drawn = data[i] > 0;
        if (!drawn) throw new Error('it draws nothing');
        return canvas.transferToImageBitmap();
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** the bitmap of an image blob, an SVG document among them */
function decodeImage(blob){
    return isSvgBlob(blob) ? svgBitmap(blob) : createImageBitmap(blob);
}

/** a blob read as a data URL */
function blobToDataURL(blob){
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

/** the bytes and the media type of a data URL */
function dataURLToBytes(src){
    const comma = src.indexOf(',');
    const head = src.slice(0, comma);
    const type = head.slice(5, head.indexOf(';') > 0 ? head.indexOf(';') : head.length) || 'application/octet-stream';
    const bin = atob(src.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, type };
}

/** a data URL of bytes of a media type */
function bytesToDataURL(bytes, type){
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return 'data:' + type + ';base64,' + btoa(s);
}

/**
 * an image item from a blob (a file, the clipboard), on the unit square;
 * returns {item, width, height} with the image's size in pixels
 */
async function imageItemFromBlob(blob){
    const bmp = await decodeImage(blob);
    const width = bmp.width, height = bmp.height;
    bmp.close();
    // the data URL says the type, which tells how it decodes later
    const src = await blobToDataURL(isSvgBlob(blob) ? new Blob([blob], { type: SVG_TYPE }) : blob);
    const item = {
        type: 'image', closed: true, src,
        points: [0, 0, 1, 0, 1, 1, 0, 1],
        style: { stroke: null, fill: null, strokeWidth: 0, opacity: 1 },
    };
    return { item, width, height };
}

/**
 * the quad of an image of the pixel size placed in a square box {cx, cy,
 * half} (world), the largest fit leaving the margin (a fraction of the box)
 */
function placeQuad(width, height, box, margin = 0.1){
    const s = 2*box.half*(1 - margin)/Math.max(width, height, 1);
    const w = width*s/2, h = height*s/2;
    return [box.cx - w, box.cy - h, box.cx + w, box.cy - h, box.cx + w, box.cy + h, box.cx - w, box.cy + h];
}

/**
 * the quad of an image of the pixel size that takes the place of the quad p
 * unstretched: the same centre and axes, the shorter way across kept and
 * the other one longer, so that it covers p
 */
function coverQuad(p, width, height){
    const ax = p[4] - p[6], ay = p[5] - p[7], bx = p[0] - p[6], by = p[1] - p[7];
    const cx = 0.5*(p[0] + p[4]), cy = 0.5*(p[1] + p[5]);
    const r = (width/Math.max(height, 1))*Math.hypot(bx, by)/Math.max(Math.hypot(ax, ay), 1e-12);
    const fa = 0.5*Math.max(1, r), fb = 0.5*Math.max(1, 1/r);
    const at = (s, t) => [cx + s*fa*ax + t*fb*bx, cy + s*fa*ay + t*fb*by];
    return [...at(-1, 1), ...at(1, 1), ...at(1, -1), ...at(-1, -1)];
}

/**
 * a deep copy of an item that shares its strings: what an undo step or the
 * clipboard keeps of an image holds on to the one data URL, of megabytes,
 * instead of a copy of it per edit
 */
function itemCopy(value){
    if (Array.isArray(value)) return value.map(itemCopy);
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const key of Object.keys(value)) out[key] = itemCopy(value[key]);
    return out;
}

/** does the item, or one inside it, show an image */
function hasImage(item){
    if (item.type === 'image') return true;
    return !!(item.children && item.children.some(hasImage));
}

/**
 * the point x in the image on the quad pts, the inverse of the map the
 * renderer draws it with: {u, v} across the image from its top-left corner
 * (0 to 1 on it), {du, dv} the most that one unit of distance changes them;
 * null for a quad of no area
 */
function quadUV(x, pts){
    const ax = pts[4] - pts[6], ay = pts[5] - pts[7];
    const bx = pts[0] - pts[6], by = pts[1] - pts[7];
    const det = ax*by - ay*bx;
    if (!det) return null;
    const dx = x[0] - pts[6], dy = x[1] - pts[7];
    return {
        u: (dx*by - dy*bx)/det,
        v: (ax*dy - ay*dx)/det,
        du: Math.hypot(bx, by)/Math.abs(det),
        dv: Math.hypot(ax, ay)/Math.abs(det),
    };
}

/**
 * is a pixel of the mask {alpha (a byte per pixel, rows from the image's
 * top), width, height} solid, at (u, v) or within ru, rv of it
 */
function maskHit(mask, u, v, ru = 0, rv = 0){
    if (u < -ru || u > 1 + ru || v < -rv || v > 1 + rv) return false;
    const { alpha, width, height } = mask;
    const col = t => Math.max(0, Math.min(width - 1, Math.floor(t*width)));
    const row = t => Math.max(0, Math.min(height - 1, Math.floor(t*height)));
    const x1 = col(u + ru), y1 = row(v + rv);
    for (let y = row(v - rv); y <= y1; y++) {
        for (let x = col(u - ru); x <= x1; x++) {
            if (alpha[y*width + x] >= SOLID_ALPHA) return true;
        }
    }
    return false;
}

export { blobToDataURL, dataURLToBytes, bytesToDataURL, decodeImage, imageItemFromBlob, placeQuad, coverQuad, itemCopy, hasImage, quadUV, maskHit };
