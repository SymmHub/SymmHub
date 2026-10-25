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
//  binary sidecar its bytes go into a chunk (DrawingLayer).
//

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
    const src = await blobToDataURL(blob);
    const bmp = await createImageBitmap(blob);
    const width = bmp.width, height = bmp.height;
    bmp.close();
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

export { blobToDataURL, dataURLToBytes, bytesToDataURL, imageItemFromBlob, placeQuad, hasImage };
