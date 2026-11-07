import {
    decodeImage,
    showWarningBanner,
    traceNodes,
} from './modules.js';

//
//  drawing of one item with Canvas2D
//
//  The context's transform maps the item's coordinates to canvas pixels; the
//  item's points and stroke width are in those coordinates. An image item
//  (ImageItems.js) is drawn on its quad from its bitmap, decoded on first
//  use; while it decodes nothing is drawn, and the listeners hear when it is
//  there (the pattern renders again).
//

// the longer side of a mask for picking, in pixels
const MASK_SIDE = 2048;

// image source (a data URL) -> ImageBitmap, or null while it decodes
const mBitmaps = new Map();
// image source -> its mask for picking
const mMasks = new Map();
let mImagesVersion = 0;
const mImageListeners = [];

/** the bitmap of an image source, or null while it decodes */
function imageBitmap(src){
    if (mBitmaps.has(src)) return mBitmaps.get(src);
    mBitmaps.set(src, null);
    fetch(src).then(r => r.blob()).then(decodeImage).then(bmp => {
        mBitmaps.set(src, bmp);
        mImagesVersion++;
        mImageListeners.forEach(cb => cb());
    }).catch(e => {
        console.error('image item: cannot decode the image', e);
        showWarningBanner(`An image of the drawing could not be decoded: ${e.message}`);
    });
    return null;
}

/**
 * the alpha of an image source for picking, at most MASK_SIDE on its longer
 * side, made on the first click: {alpha (a byte per pixel, rows from the
 * image's top), width, height}, or null while it decodes
 */
function imageMask(src){
    if (mMasks.has(src)) return mMasks.get(src);
    const bmp = imageBitmap(src);
    if (!bmp) return null;
    const s = Math.min(1, MASK_SIDE/Math.max(bmp.width, bmp.height));
    const width = Math.max(1, Math.round(s*bmp.width)), height = Math.max(1, Math.round(s*bmp.height));
    const ctx = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, width, height);
    const rgba = ctx.getImageData(0, 0, width, height).data;
    const alpha = new Uint8Array(width*height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[4*i + 3];
    const mask = { alpha, width, height };
    mMasks.set(src, mask);
    return mask;
}

/** counts the images decoded so far: content with images changes with it */
function getImagesVersion(){
    return mImagesVersion;
}

function addImageListener(cb){
    mImageListeners.push(cb);
}

function cssColor(paint){
    const [r, g, b, a] = paint.rgba;
    return `rgba(${Math.round(255*r)},${Math.round(255*g)},${Math.round(255*b)},${a})`;
}

function itemPath(item){
    const path = new Path2D();
    if (item.nodes && item.nodes.length) {
        // the curves of a path (Paths.js)
        traceNodes(item.nodes, item.closed, path);
        return path;
    }
    const p = item.points;
    if (p.length < 2) return path;
    path.moveTo(p[0], p[1]);
    for (let i = 2; i + 1 < p.length; i += 2) path.lineTo(p[i], p[i + 1]);
    if (item.closed) path.closePath();
    return path;
}

function drawItem(ctx, item){

    // a hidden item draws nothing, nor what it holds
    if (item.visible === false) return;
    const style = item.style;
    if (item.type === 'group') {
        // its children as they are
        ctx.save();
        ctx.globalAlpha *= style.opacity ?? 1;
        for (const child of item.children || []) drawItem(ctx, child);
        ctx.restore();
        return;
    }
    if (item.type === 'image') {
        const bmp = item.src ? imageBitmap(item.src) : null;
        if (!bmp || item.points.length < 8) return;
        // the image's pixels onto the quad: its top-left at the quad's top-left
        // corner, its rows along the top edge, its columns down the left edge
        const p = item.points;
        const ax = (p[4] - p[6])/bmp.width,  ay = (p[5] - p[7])/bmp.width;
        const bx = (p[0] - p[6])/bmp.height, by = (p[1] - p[7])/bmp.height;
        ctx.save();
        ctx.globalAlpha *= style.opacity ?? 1;
        ctx.transform(ax, ay, bx, by, p[6], p[7]);
        ctx.drawImage(bmp, 0, 0);
        ctx.restore();
        return;
    }
    const path = itemPath(item);
    // where the outline crosses itself: nonzero (the default) or even-odd
    const rule = style.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
    ctx.save();
    ctx.globalAlpha *= style.opacity ?? 1;
    if (item.closed && style.fill) {
        ctx.fillStyle = cssColor(style.fill);
        ctx.fill(path, rule);
    }
    // the items inside a closed item, clipped by its outline, under its stroke
    if (item.closed && item.children && item.children.length) {
        ctx.save();
        ctx.clip(path, rule);
        for (const child of item.children) drawItem(ctx, child);
        ctx.restore();
    }
    if (style.stroke && style.strokeWidth > 0) {
        ctx.strokeStyle = cssColor(style.stroke);
        ctx.lineWidth   = style.strokeWidth;
        ctx.lineCap     = style.lineCap || 'round';
        ctx.lineJoin    = style.lineJoin || 'round';
        // an SVG's stops a sharp corner at 4 widths, a canvas at 10
        ctx.miterLimit  = style.miterLimit ?? 10;
        ctx.stroke(path);
    }
    ctx.restore();

}

/**
 * a picture of what a closed item holds, over its solid fill: its outline's
 * box covering a square of the side in pixels, y up; a data URL. An image
 * still decoding is not in it yet (the image listeners hear when it is there)
 */
function contentThumbnail(item, side = 40){
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = side;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = item.style.fill ? cssColor(item.style.fill) : '#ffffff';
    ctx.fillRect(0, 0, side, side);
    const p = item.points;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < p.length; i += 2) {
        x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
    }
    const s = side/Math.max(Math.min(x1 - x0, y1 - y0), 1e-9);
    ctx.setTransform(s, 0, 0, -s, 0.5*(side - s*(x0 + x1)), 0.5*(side + s*(y0 + y1)));
    for (const child of item.children || []) drawItem(ctx, child);
    return canvas.toDataURL();
}

export { drawItem, imageBitmap, imageMask, contentThumbnail, getImagesVersion, addImageListener };
