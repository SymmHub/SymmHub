//
//  image items: a raster image placed on a quad of the drawing
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

/** does the item, or one inside it, show an image */
function hasImage(item){
    if (item.type === 'image') return true;
    return !!(item.children && item.children.some(hasImage));
}

export { blobToDataURL, dataURLToBytes, bytesToDataURL, decodeImage, imageItemFromBlob, placeQuad, hasImage };
