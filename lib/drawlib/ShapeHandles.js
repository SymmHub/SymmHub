//
//  ShapeHandles - the handles (diamonds) of the shape selected alone
//  (Shapes.js), on the copy it was picked on, which edit its numbers: a
//  rect's rounding on its top edge and its size at a corner, an ellipse's
//  two radii, a polygon's or star's tip (its first corner: turns and scales
//  it), a star's first inner corner (its aspect and twist; Ctrl+drag: the
//  aspect alone), a spiral's end (turns and scales it). The node tool drags
//  them on every kind, a shape tool on shapes of its own kind.
//
//    const handles = ShapeHandles(editor, kind)   kind: null for every kind
//    handles.press(e)      a press on a handle starts its drag: true, else false
//    handles.move(e)       while dragging, the shape follows: true
//    handles.release()     the drag done, one undo step: true when dragging
//    handles.cancel()      the drag dropped, the shape as it was
//    handles.draw(ctx)     the diamonds, on the 2D overlay
//

import {
    shapePoint,
    shapeLocal,
} from './modules.js';

const HANDLE_PX = 7;        // reach of a handle
const DRAG_PX = 2;          // a press moving less is a click
const EPS = 1e-9;

/** the handles of the shape s, on the copy frameInv maps its own coordinates onto: [{kind, world}] */
function shapeHandles(editor, s, frameInv){
    const at = (x, y) => editor.mapWorld(frameInv, shapePoint(s, x, y));
    const onFrame = (t, f = 1) => at(f*s.rx*Math.cos(t), f*s.ry*Math.sin(t));
    switch (s.kind) {
    case 'rect':    return [{ kind: 'round', world: at(s.rx - s.round*Math.min(s.rx, s.ry), s.ry) }, { kind: 'size', world: at(s.rx, -s.ry) }];
    case 'ellipse': return [{ kind: 'rx', world: at(s.rx, 0) }, { kind: 'ry', world: at(0, s.ry) }];
    case 'polygon': return [{ kind: 'tip', world: onFrame(s.phase) }];
    case 'star':    return [{ kind: 'tip', world: onFrame(s.phase) },
                            { kind: 'inner', world: onFrame(s.phase + 2*Math.PI*(0.5 + (s.twist || 0))/s.n, s.ratio) }];
    case 'spiral':  return [{ kind: 'end', world: onFrame(s.phase + s.dir*2*Math.PI*s.n) }];
    default:        return [];
    }
}

/**
 * the shape's numbers with the handle of a kind brought to x (the item's
 * own coordinates); the kind stays. A star's inner corner: its aspect, and
 * its twist (unless keepTwist) the nearest to that of prev, the shape as
 * the drag left it, so that turns about the centre add up
 */
function shapeWithHandleAt(s, kind, x, prev = s, keepTwist = false){
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
    case 'tip':   return f < 1e-6 ? s : { ...s, rx: s.rx*f, ry: s.ry*f, phase: Math.atan2(ly/s.ry, lx/s.rx) };
    case 'end':   return f < 1e-6 ? s : { ...s, rx: s.rx*f, ry: s.ry*f, phase: Math.atan2(ly/s.ry, lx/s.rx) - s.dir*2*Math.PI*s.n };
    default:      return s;
    }
}

function ShapeHandles(editor, kind = null) {

    let mDrag = null;       // {sel, handle, before (the item), after, canvas, moved}

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

    /** the kind of the handle under the canvas point, or null */
    function under(canvas){
        let best = null, bestD = HANDLE_PX;
        for (const h of handles()) {
            const c = editor.view.toCanvas(h.world);
            const d = Math.hypot(c[0] - canvas[0], c[1] - canvas[1]);
            if (d <= bestD) { bestD = d; best = h.kind; }
        }
        return best;
    }

    function press(e){
        const canvas = [e.canvasX, e.canvasY];
        const handle = under(canvas);
        if (!handle) return false;
        const t = target();
        mDrag = { sel: t.sel, handle, before: t.item, after: null, canvas, moved: false };
        return true;
    }

    function move(e){
        if (!mDrag || !(e.buttons & 1)) return false;
        if (!mDrag.moved && Math.hypot(e.canvasX - mDrag.canvas[0], e.canvasY - mDrag.canvas[1]) < DRAG_PX) return true;
        mDrag.moved = true;
        const item = mDrag.before;
        const x = editor.mapWorld(mDrag.sel.frame, e.wpnt);
        const prev = mDrag.after ? mDrag.after.shape : item.shape;
        mDrag.after = { ...item, shape: shapeWithHandleAt(item.shape, mDrag.handle, x, prev, e.ctrlKey) };
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

    function draw(ctx){
        for (const h of handles()) editor.drawShapeHandle(ctx, editor.view.toCanvas(h.world));
    }

    return {
        press,
        move,
        release,
        cancel,
        draw,
        isDragging: () => !!mDrag,
    };

} // function ShapeHandles()

export { ShapeHandles, shapeHandles, shapeWithHandleAt };
