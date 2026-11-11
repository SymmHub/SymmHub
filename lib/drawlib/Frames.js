import {
    normalShape,
    shapeGeometry,
    shapeMapped,
    shapePoint,
    shapeLocal,
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

/**
 * the axes [ux, uy, vx, vy] a frame shows its content along, for the
 * transform box of a frame that has none of its own: along its image's
 * bottom edge (the picture's own right), else along its rect; null for an
 * item that is not a frame. The second axis is the first turned a quarter
 * turn, so the box is a box whatever the picture's skew or handedness
 */
function frameAxes(item){
    if (!item || !item.shape || !item.children || !item.children.length) return null;
    const image = item.children.length === 1 && item.children[0].type === 'image' ? item.children[0] : null;
    let angle;
    if (image && image.points && image.points.length >= 8) {
        const p = image.points;
        angle = Math.atan2(p[3] - p[1], p[2] - p[0]);
    } else {
        angle = item.shape.angle || 0;
    }
    const c = Math.cos(angle), s = Math.sin(angle);
    return [c, s, -s, c];
}

//
//  the picture in its holder (2026-11-10, docs/symdraw_images_ui_plan.md 4.2):
//  where the picture of a frame or of a filled shape sits is given by a fit
//  mode and by its orientation in the holder's box, so that a flip, a quarter
//  turn, a reset and a replace all place it the same way:
//    cover    the box covered, unstretched, cut off by the outline (the default)
//    fit      the whole picture inside the box, unstretched
//    stretch  the picture on the box, stretched to it
//  The orientation is the picture's right and up along the box's axes, each
//  one of (±1, 0), (0, ±1): a flip or a quarter turn inside the box.
//

const FIT_MODES = ['cover', 'fit', 'stretch'];

/**
 * the box the picture of a holder is placed in, as a rect shape (cx, cy, rx,
 * ry, angle, skew): a rect's own numbers (a frame), else the box a fill covers
 * (fillBox)
 */
function holderBox(item){
    if (item.shape && item.shape.kind === 'rect') return normalShape(item.shape);
    const b = fillBox(item);
    return { kind: 'rect', cx: b.cx, cy: b.cy, rx: Math.max(b.ex, 1e-12), ry: Math.max(b.ey, 1e-12), angle: b.angle };
}

/** the axis-aligned unit vector of the box's frame nearest to the vector v */
function snappedAxis(v){
    return Math.abs(v[0]) >= Math.abs(v[1]) ? [Math.sign(v[0]) || 1, 0] : [0, Math.sign(v[1]) || 1];
}

/**
 * the orientation of an image's quad [BL, BR, TR, TL] in the box: its right
 * and up along the box's axes, {right: [x, y], up: [x, y]}, snapped to the
 * nearest of the eight (a picture turned a little in the box counts as straight)
 */
function pictureOrientation(box, quad){
    const p = (i) => shapeLocal(box, [quad[i], quad[i + 1]]);
    const bl = p(0), br = p(2), tl = p(6);
    const right = snappedAxis([br[0] - bl[0], br[1] - bl[1]]);
    // up square to right, on the side the picture's up is
    const u = [tl[0] - bl[0], tl[1] - bl[1]];
    const perp = [-right[1], right[0]];
    const up = (perp[0]*u[0] + perp[1]*u[1]) >= 0 ? perp : [-perp[0], -perp[1]];
    return { right, up };
}

/** the orientation after a flip of the picture in the box ('flipH': across the box's second axis, 'flipV': across its first) or a quarter turn ('turnLeft', 'turnRight') */
function orientedBy(orient, op){
    const m = op === 'flipH' ? (v => [-v[0], v[1]]) : op === 'flipV' ? (v => [v[0], -v[1]])
            : op === 'turnLeft' ? (v => [-v[1], v[0]]) : op === 'turnRight' ? (v => [v[1], -v[0]]) : (v => v);
    return { right: m(orient.right), up: m(orient.up) };
}

/**
 * the quad [BL, BR, TR, TL] of a picture of the pixel size placed in the box
 * by the mode, with the orientation (default: straight)
 */
function placedPicture(box, width, height, mode = 'cover', orient = { right: [1, 0], up: [0, 1] }){
    const hw = 0.5*Math.max(width, 1e-9), hh = 0.5*Math.max(height, 1e-9);
    // the picture's half extents along the box's axes
    const ex = Math.abs(orient.right[0])*hw + Math.abs(orient.up[0])*hh;
    const ey = Math.abs(orient.right[1])*hw + Math.abs(orient.up[1])*hh;
    let kx = box.rx/ex, ky = box.ry/ey;
    if (mode === 'cover') kx = ky = Math.max(kx, ky);
    else if (mode === 'fit') kx = ky = Math.min(kx, ky);
    const at = (sx, sy) => {
        const x = sx*hw*orient.right[0] + sy*hh*orient.up[0], y = sx*hw*orient.right[1] + sy*hh*orient.up[1];
        return shapePoint(box, kx*x, ky*y);
    };
    return [...at(-1, -1), ...at(1, -1), ...at(1, 1), ...at(-1, 1)];
}

/** the fit mode of a holder */
function holderFit(item){
    return FIT_MODES.includes(item && item.fit) ? item.fit : 'cover';
}

/**
 * the picture with a height channel shown by the item (an image item with a
 * height, the item itself or one inside it, not hidden): {image, holder} (the
 * item holding it, null for a bare image), the first one; null without one
 */
function heightPicture(item, holder = null){
    if (!item || item.visible === false) return null;
    if (item.type === 'image') return item.height ? { image: item, holder } : null;
    for (const child of item.children || []) {
        const found = heightPicture(child, item.type === 'group' ? holder : item);
        if (found) return found;
    }
    return null;
}

/**
 * how far a height of 1 moves the picture held by the holder in the depth
 * sort (world units): the image's heightScale, else half the longer side of
 * the holder's box (of the image's quad without a holder)
 */
function pictureHeightScaleOf(image, holder){
    if (image.heightScale > 0) return image.heightScale;
    if (holder) {
        const box = holderBox(holder);
        if (box) return Math.max(box.rx, box.ry);
    }
    const p = image.points || [];
    return 0.5*Math.max(Math.hypot(p[4] - p[6], p[5] - p[7]) || 0, Math.hypot(p[0] - p[6], p[1] - p[7]) || 0) || 1;
}

/**
 * the holder with the picture it holds (its one image child) moved by (dx, dy),
 * its own coordinates, the holder itself kept: the picture slides inside its
 * outline (the node tool's Alt-drag; Reset places it again by the fit). null
 * when it holds no one picture
 */
function pictureShifted(holder, dx, dy){
    const images = (holder && holder.type !== 'group' && holder.children) ? holder.children.filter(c => c.type === 'image') : [];
    if (images.length !== 1 || !images[0].points || images[0].points.length < 8) return null;
    const image = images[0];
    const points = image.points.map((v, i) => v + (i % 2 ? dy : dx));
    return { ...holder, children: holder.children.map(c => (c === image ? { ...image, points } : c)) };
}

export { frameItem, framedImage, withImagesFramed, fillBox, fillMap, imageCovering, frameAxes,
         FIT_MODES, holderBox, pictureOrientation, orientedBy, placedPicture, holderFit,
         heightPicture, pictureHeightScaleOf, pictureShifted };
