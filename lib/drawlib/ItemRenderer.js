//
//  drawing of one item with Canvas2D
//
//  The context's transform maps the item's coordinates to canvas pixels; the
//  item's points and stroke width are in those coordinates. An image item
//  (ImageItems.js) is drawn on its quad from its bitmap, decoded on first
//  use; while it decodes nothing is drawn, and the listeners hear when it is
//  there (the pattern renders again).
//

// image source (a data URL) -> ImageBitmap, or null while it decodes
const mBitmaps = new Map();
let mImagesVersion = 0;
const mImageListeners = [];

/** the bitmap of an image source, or null while it decodes */
function imageBitmap(src){
    if (mBitmaps.has(src)) return mBitmaps.get(src);
    mBitmaps.set(src, null);
    fetch(src).then(r => r.blob()).then(b => createImageBitmap(b)).then(bmp => {
        mBitmaps.set(src, bmp);
        mImagesVersion++;
        mImageListeners.forEach(cb => cb());
    }).catch(e => console.error('image item: cannot decode the image', e));
    return null;
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
    const p = item.points;
    const path = new Path2D();
    if (p.length < 2) return path;
    path.moveTo(p[0], p[1]);
    for (let i = 2; i + 1 < p.length; i += 2) path.lineTo(p[i], p[i + 1]);
    if (item.closed) path.closePath();
    return path;
}

function drawItem(ctx, item){

    const style = item.style;
    if (item.type === 'image') {
        const bmp = item.src ? imageBitmap(item.src) : null;
        if (!bmp || item.points.length < 8) return;
        // the image's pixels onto the quad: its top-left at the quad's top-left
        // corner, its rows along the top edge, its columns down the left edge
        const p = item.points;
        const ax = (p[4] - p[6])/bmp.width,  ay = (p[5] - p[7])/bmp.width;
        const bx = (p[0] - p[6])/bmp.height, by = (p[1] - p[7])/bmp.height;
        ctx.save();
        ctx.globalAlpha = style.opacity ?? 1;
        ctx.transform(ax, ay, bx, by, p[6], p[7]);
        ctx.drawImage(bmp, 0, 0);
        ctx.restore();
        return;
    }
    const path = itemPath(item);
    ctx.save();
    ctx.globalAlpha = style.opacity ?? 1;
    if (item.closed && style.fill) {
        ctx.fillStyle = cssColor(style.fill);
        ctx.fill(path);
    }
    // the items inside a closed item, clipped by its outline, under its stroke
    if (item.closed && item.children && item.children.length) {
        ctx.save();
        ctx.clip(path);
        for (const child of item.children) drawItem(ctx, child);
        ctx.restore();
    }
    if (style.stroke && style.strokeWidth > 0) {
        ctx.strokeStyle = cssColor(style.stroke);
        ctx.lineWidth   = style.strokeWidth;
        ctx.lineCap     = style.lineCap || 'round';
        ctx.lineJoin    = style.lineJoin || 'round';
        ctx.stroke(path);
    }
    ctx.restore();

}

export { drawItem, imageBitmap, getImagesVersion, addImageListener };
