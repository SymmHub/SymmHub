//
//  ShapeHandles - the handles (diamonds) of the shape selected alone
//  (Shapes.js), on the copy it was picked on, which edit its numbers: a
//  rect's rounding on its top edge and its size at a corner, an ellipse's
//  two radii, a polygon's or star's tip (its first corner: turns and scales
//  it), a star's first inner corner (its aspect and twist; Ctrl+drag: the
//  aspect alone) and, on a curved polygon or star, the two handles of each
//  of these corners (round, on lines from their corners: all the corners'
//  cubics follow; the other handle of a smooth corner turns to stay in
//  line, Alt+drag makes the corners sharp, as a path's node), a spiral's
//  end (turns and scales it). A double click on a corner's diamond makes
//  the corners of its kind smooth or sharp. The node tool drags them on
//  every kind, a shape tool on shapes of its own kind.
//
//    const handles = ShapeHandles(editor, kind)   kind: null for every kind
//    handles.press(e)      a press on a handle starts its drag: true, else false
//    handles.move(e)       while dragging, the shape follows: true
//    handles.release()     the drag done, one undo step: true when dragging
//    handles.cancel()      the drag dropped, the shape as it was
//    handles.toggleCorner(e)  a double click on a corner's diamond: its
//                          corners smooth or sharp, true; else false
//    handles.draw(ctx)     the diamonds, on the 2D overlay
//

import {
    shapePoint,
    shapeLocal,
    cornerPoint,
} from './modules.js';

const HANDLE_PX = 7;        // reach of a handle
const DRAG_PX = 2;          // a press moving less is a click
const EPS = 1e-9;

/**
 * the handles of the shape s, on the copy frameInv maps its own coordinates
 * onto: [{kind, world}], a curved polygon's or star's cubic handles with
 * node, the world point of their corner
 */
function shapeHandles(editor, s, frameInv){
    const at = (x, y) => editor.mapWorld(frameInv, shapePoint(s, x, y));
    const onFrame = (t, f = 1) => at(f*s.rx*Math.cos(t), f*s.ry*Math.sin(t));
    switch (s.kind) {
    case 'rect':    return [{ kind: 'round', world: at(s.rx - s.round*Math.min(s.rx, s.ry), s.ry) }, { kind: 'size', world: at(s.rx, -s.ry) }];
    case 'ellipse': return [{ kind: 'rx', world: at(s.rx, 0) }, { kind: 'ry', world: at(0, s.ry) }];
    case 'polygon':
    case 'star': {
        const P = (inner, h) => { const q = cornerPoint(s, 0, inner, h); return at(s.rx*q[0], s.ry*q[1]); };
        const kinds = s.kind === 'star' ? [false, true] : [false];
        const out = [{ kind: 'tip', world: P(false) }];
        if (s.kind === 'star') out.push({ kind: 'inner', world: P(true) });
        if (s.curved) {
            for (const inner of kinds) {
                for (const h of [1, 2]) out.push({ kind: (inner ? 'i' : 'o') + h, world: P(inner, h), node: P(inner) });
            }
        }
        return out;
    }
    case 'spiral':  return [{ kind: 'end', world: onFrame(s.phase + s.dir*2*Math.PI*s.n) }];
    default:        return [];
    }
}

/**
 * the shape's numbers with the handle of a kind brought to x (the item's
 * own coordinates); the kind stays. A star's inner corner: its aspect, and
 * its twist (unless keepTwist) the nearest to that of prev, the shape as
 * the drag left it, so that turns about the centre add up. A corner's
 * cubic handle: on a smooth corner the other one turns to stay in line,
 * its length kept, unless breakCorner, which makes the corners sharp
 */
function shapeWithHandleAt(s, kind, x, prev = s, keepTwist = false, breakCorner = false){
    const [lx, ly] = shapeLocal(s, x);                     // in the shape's frame
    const f = Math.hypot(lx/s.rx, ly/s.ry);                // the frame radius of x
    switch (kind) {
    case 'round': return { ...s, round: Math.max(0, Math.min(1, (s.rx - lx)/Math.max(EPS, Math.min(s.rx, s.ry)))) };
    case 'size':  return { ...s, rx: Math.max(EPS, Math.abs(lx)), ry: Math.max(EPS, Math.abs(ly)) };
    case 'rx':    return { ...s, rx: Math.max(EPS, Math.abs(lx)) };
    case 'ry':    return { ...s, ry: Math.max(EPS, Math.abs(ly)) };
    case 'inner': {
        const ratio = Math.max(0, Math.min(2, f));
        if (keepTwist || f < 1e-6) return { ...s, ratio };
        const raw = s.n*(Math.atan2(ly/s.ry, lx/s.rx) - s.phase)/(2*Math.PI) - 0.5;
        const near = prev.twist || 0;
        return { ...s, ratio, twist: raw + s.n*Math.round((near - raw)/s.n) };
    }
    case 'o1': case 'o2': case 'i1': case 'i2': {
        // a curved polygon's or star's handle: from its corner, in the corner's direction
        const corner = kind[0], inner = corner === 'i';
        const [cx, cy] = cornerPoint(s, 0, inner);
        const t = s.phase + (inner ? 2*Math.PI*(0.5 + (s.twist || 0))/s.n : 0);
        const dx = lx/s.rx - cx, dy = ly/s.ry - cy, c = Math.cos(t), sn = Math.sin(t);
        const v = [dx*c + dy*sn, -dx*sn + dy*c];
        const handles = { ...s.handles, [kind]: v };
        const smooth = { ...s.smooth };
        if (breakCorner) {
            smooth[corner] = false;
        } else if (smooth[corner]) {
            const other = corner + (kind[1] === '1' ? '2' : '1');
            const len = Math.hypot(v[0], v[1]), o = s.handles[other], olen = Math.hypot(o[0], o[1]);
            if (len > EPS) handles[other] = [-v[0]/len*olen, -v[1]/len*olen];
        }
        return { ...s, handles, smooth };
    }
    case 'tip':   return f < 1e-6 ? s : { ...s, rx: s.rx*f, ry: s.ry*f, phase: Math.atan2(ly/s.ry, lx/s.rx) };
    case 'end':   return f < 1e-6 ? s : { ...s, rx: s.rx*f, ry: s.ry*f, phase: Math.atan2(ly/s.ry, lx/s.rx) - s.dir*2*Math.PI*s.n };
    default:      return s;
    }
}

function ShapeHandles(editor, kind = null) {

    let mDrag = null;       // {sel, handle, before (the item), after, canvas, moved, alt}

    /** the shape selected alone (of the kind) and its selection entry: {sel, item}, or null */
    function target(){
        const item = editor.getSelectedShape();
        if (!item || (kind && item.shape.kind !== kind)) return null;
        return { sel: editor.getSelection()[0], item };
    }

    function handles(){
        const t = target();
        return t ? shapeHandles(editor, t.item.shape, t.sel.frameInv) : [];
    }

    /** the kind of the handle under the pointer of the event (pixels by the view's scale there), or null */
    function under(e){
        let best = null, bestD = HANDLE_PX;
        for (const h of handles()) {
            const d = editor.pxDistance(h.world, e.wpnt, [e.canvasX, e.canvasY]);
            if (d <= bestD) { bestD = d; best = h.kind; }
        }
        return best;
    }

    function press(e){
        const canvas = [e.canvasX, e.canvasY];
        const handle = under(e);
        if (!handle) return false;
        const t = target();
        mDrag = { sel: t.sel, handle, before: t.item, after: null, canvas, moved: false, alt: e.altKey };
        return true;
    }

    function move(e){
        if (!mDrag || !(e.buttons & 1)) return false;
        if (!mDrag.moved && Math.hypot(e.canvasX - mDrag.canvas[0], e.canvasY - mDrag.canvas[1]) < DRAG_PX) return true;
        mDrag.moved = true;
        const item = mDrag.before;
        const x = editor.mapWorld(mDrag.sel.frame, e.wpnt);
        const prev = mDrag.after ? mDrag.after.shape : item.shape;
        mDrag.after = { ...item, shape: shapeWithHandleAt(item.shape, mDrag.handle, x, prev, e.ctrlKey, mDrag.alt) };
        editor.applyReplace(new Map([[item.id, mDrag.after]]));
        editor.repaint();
        return true;
    }

    function release(){
        if (!mDrag) return false;
        const { before, after, moved } = mDrag;
        mDrag = null;
        if (moved && after) editor.pushReplace('shape', new Map([[before.id, before]]), new Map([[before.id, after]]));
        editor.repaint();
        return true;
    }

    function cancel(){
        if (mDrag && mDrag.after) editor.applyReplace(new Map([[mDrag.before.id, mDrag.before]]));
        mDrag = null;
        editor.repaint();
    }

    /**
     * a double click on the diamond of a curved polygon's or star's corner
     * (its tip, a star's inner corner): the corners of that kind smooth or
     * sharp, one undo step; true when there was one under the pointer
     */
    function toggleCorner(e){
        const handle = under(e);
        const t = target();
        if (!t || !t.item.shape.smooth || !t.item.shape.curved || (handle !== 'tip' && handle !== 'inner')) return false;
        const corner = handle === 'tip' ? 'o' : 'i';
        editor.setShapeValue(corner === 'o' ? 'smoothO' : 'smoothI', !t.item.shape.smooth[corner]);
        return true;
    }

    /** the same as geometry in world coordinates, for the GPU pass */
    function geometry(geo){
        const list = handles();
        for (const h of list) if (h.node) editor.controlHandleGeometry(geo, h.node, h.world);
        for (const h of list) if (!h.node) editor.shapeHandleGeometry(geo, h.world);
    }

    /** the cubic handles on lines from their corners, then the diamonds over them */
    function draw(ctx){
        const list = handles(), c = (w) => editor.view.toCanvas(w);
        for (const h of list) if (h.node) editor.drawControlHandle(ctx, c(h.node), c(h.world));
        for (const h of list) if (!h.node) editor.drawShapeHandle(ctx, c(h.world));
    }

    return {
        press,
        move,
        release,
        cancel,
        toggleCorner,
        draw,
        geometry,
        isDragging: () => !!mDrag,
    };

} // function ShapeHandles()

export { ShapeHandles, shapeHandles, shapeWithHandleAt };
