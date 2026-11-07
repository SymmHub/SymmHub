import {
    normalShape,
    shapeGeometry,
    shapeMapped,
} from './modules.js';

//
//  frames: an image or an SVG as an object of the drawing
//
//  A frame is a closed rect shape (Shapes.js) that paints nothing of its own
//  and holds its content as children (DrawingDocument.js): it is one sprite
//  however much it holds, the content is clipped by its outline and moved
//  with it, and it has what a rectangle has: W, H and rounding, a stroke, the
//  transform box, To path and node editing. Editing the outline crops; a
//  double click edits the content inside it.
//
//  An image on a layer, or in a group, always stands in a frame; the image
//  item is what a frame holds. An older document's images are framed when
//  it is read, and a bare image put on a layer is framed by the document.
//
//  A fill is the same thing on any closed shape: the image, or an SVG in a
//  frame of its own, is what the shape holds, placed to cover the outline
//  unstretched (fillBox, fillMap). The solid fill stays under it.
//

const NO_PAINT = { stroke: null, fill: null, strokeWidth: 0, opacity: 1 };

/** a frame of the rect with the numbers shape, holding the items */
function frameItem(shape, children){
    const s = normalShape(shape);
    return { type: 'polyline', closed: true, points: shapeGeometry(s).points, shape: s, style: { ...NO_PAINT }, children };
}

/**
 * the rect over an image's quad [bottom-left, bottom-right, top-right,
 * top-left], from its top and left edges as the renderer takes them: a
 * sheared quad gives a rect with a skew
 */
function quadRect(p){
    const cx = 0.5*(p[0] + p[4]), cy = 0.5*(p[1] + p[5]);
    const ax = p[4] - p[6], ay = p[5] - p[7], bx = p[6] - p[0], by = p[7] - p[1];
    return shapeMapped({ kind: 'rect', cx: 0, cy: 0, rx: 0.5, ry: 0.5 }, q => [cx + q[0]*ax + q[1]*bx, cy + q[0]*ay + q[1]*by], true);
}

/**
 * a frame over the image's quad, in the image's place: its id, pivot, box
 * axes, opacity and colours are the frame's
 */
function framedImage(image){
    const { id, pivot, axes, colorWord, visible, style = {}, ...picture } = image;
    const { opacity = 1, ...own } = style;
    const frame = frameItem(quadRect(image.points), [{ ...picture, style: { ...own, opacity: 1 } }]);
    frame.style.opacity = opacity;
    if (id) frame.id = id;
    if (pivot) frame.pivot = pivot;
    if (axes) frame.axes = axes;
    if (colorWord) frame.colorWord = colorWord;
    if (visible === false) frame.visible = false;
    return frame;
}

/** the item with an image standing on its own framed, a group's too; the item itself when it has none */
function withImagesFramed(item){
    if (item.type === 'image') return item.points && item.points.length >= 8 ? framedImage(item) : item;
    if (item.type !== 'group' || !item.children) return item;
    const children = item.children.map(withImagesFramed);
    return children.some((c, i) => c !== item.children[i]) ? { ...item, children } : item;
}

/**
 * the box a fill covers: the outline's extent along the box the item shows,
 * {cx, cy, ex, ey (half sizes), angle}. A turned box turns the fill, by at
 * most an eighth of a turn: a box flipped or turned by quarters leaves it
 * upright, and a skew shears nothing
 */
function fillBox(item){
    const turn = item.axes ? Math.atan2(item.axes[1], item.axes[0]) : (item.shape ? item.shape.angle : 0);
    const angle = turn - Math.round(turn/(Math.PI/2))*(Math.PI/2);
    const c = Math.cos(angle), s = Math.sin(angle), p = item.points;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < p.length; i += 2) {
        const x = c*p[i] + s*p[i + 1], y = c*p[i + 1] - s*p[i];
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const mx = 0.5*(x0 + x1), my = 0.5*(y0 + y1);
    return { cx: c*mx - s*my, cy: s*mx + c*my, ex: 0.5*(x1 - x0), ey: 0.5*(y1 - y0), angle };
}

/** the map taking a box round the origin of half sizes rx, ry onto the fill's box, unstretched and covering it */
function fillMap(box, rx, ry){
    const k = Math.max(box.ex/rx, box.ey/ry);
    const c = k*Math.cos(box.angle), s = k*Math.sin(box.angle);
    return q => [box.cx + c*q[0] - s*q[1], box.cy + s*q[0] + c*q[1]];
}

/** an image item of the pixel size, unstretched, covering the fill's box */
function imageCovering(image, width, height, box){
    const rx = 0.5*width, ry = 0.5*height, map = fillMap(box, rx, ry);
    return { ...image, points: [[-rx, -ry], [rx, -ry], [rx, ry], [-rx, ry]].flatMap(map) };
}

export { frameItem, framedImage, withImagesFramed, fillBox, fillMap, imageCovering };
