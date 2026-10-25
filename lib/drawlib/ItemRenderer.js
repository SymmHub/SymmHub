//
//  drawing of one item with Canvas2D
//
//  The context's transform maps the item's coordinates to canvas pixels; the
//  item's points and stroke width are in those coordinates.
//

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

export { drawItem };
