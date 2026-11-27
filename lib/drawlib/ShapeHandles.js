//
//  ShapeHandles - the handles (diamonds) of the shape selected alone
//  (Shapes.js), on the copy it was picked on, which edit its numbers: a
//  rect's rounding on its top edge and its size at a corner, an ellipse's
//  two radii (rx at the left end of its first axis, ry at the top; Ctrl+drag
//  or Ctrl+click: a circle of that radius), the start and end of its arc
//  (discs on the ellipse, at its first axis's right end while it is whole:
//  a drag sets the parameter under the pointer, Ctrl by steps of 15
//  degrees, Shift moves the other end with it; dragged inside the ellipse,
//  below 0.75 of the way out, the arc is open, outside, past 1.25, a
//  slice, between the type stays; Shift+click: the whole ellipse again)
//  and its centre (a cross: moves it), a polygon's or star's tip (its first corner: turns and scales
//  it), a star's first inner corner (its aspect and twist; Ctrl+drag: the
//  aspect alone) and, on a curved polygon or star, the two handles of each
//  of these corners (round, on lines from their corners: all the corners'
//  cubics follow; the other handle of a smooth corner turns to stay in
//  line, Alt+drag makes the corners sharp, as a path's node), a spiral's
//  end (turns and scales it). A double click on a corner's diamond makes
//  the corners of its kind smooth or sharp. The node tool drags them on
//  every kind, a shape tool on shapes of its own kind. A geodesic shape's
//  handles are those of its construction in the chart of its centre
//  (Shapes.js, editor.shapeSpaceOf), seen through the chart, and a drag
//  edits that construction.
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
    normalShape,
    shapePoint,
    shapeLocal,
    cornerPoint,
    shapeInChart,
    shapeFromChart,
    wholeEllipse,
    isArc,
} from './modules.js';

const HANDLE_PX = 7;        // reach of a handle
const DRAG_PX = 2;          // a press moving less is a click
const TIE_PX = 0.5;         // handles nearer to each other than this are one point: the last listed is taken
const EPS = 1e-9;
const ARC_STEP = Math.PI/12;            // Ctrl snaps an arc's end by 15 degrees
const ARC_INSIDE = 0.75, ARC_OUTSIDE = 1.25;    // an end dragged inside: an open arc; outside: a slice

/**
 * the handles of the shape s, on the copy frameInv maps its own coordinates
 * onto: [{kind, world, mark}] (mark: how it is drawn, 'diamond', an arc's
 * ends 'disc', an ellipse's centre 'cross'), a curved polygon's or star's
 * cubic handles with node, the world point of their corner; a geodesic shape's (space, the
 * editor's shapeSpaceOf) are those of its construction in the chart of its
 * centre, seen through the chart
 */
function shapeHandles(editor, shape, frameInv, space = null){
    const { local: s, chart } = (space && shapeInChart(shape, space)) || { local: shape, chart: null };
    const at = (x, y) => { const q = shapePoint(s, x, y); return editor.mapWorld(frameInv, chart ? chart.from(q) : q); };
    const onFrame = (t, f = 1) => at(f*s.rx*Math.cos(t), f*s.ry*Math.sin(t));
    switch (s.kind) {
    case 'rect':    return [{ kind: 'round', world: at(s.rx - s.round*Math.min(s.rx, s.ry), s.ry) }, { kind: 'size', world: at(s.rx, -s.ry) }];
    case 'ellipse': {
        // the nearest handle is taken, and of handles on one point the last: the centre
        // first, so that another handle there wins; the end over the start (a whole ellipse's are one point)
        const arc = isArc(s);
        return [{ kind: 'centre', world: at(0, 0), mark: 'cross' }, { kind: 'rx', world: at(-s.rx, 0) }, { kind: 'ry', world: at(0, s.ry) },
                { kind: 'start', world: onFrame(arc ? s.start : 0), mark: 'disc' }, { kind: 'end', world: onFrame(arc ? s.end : 0), mark: 'disc' }];
    }
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
 * own coordinates); the kind stays. ctrl: a star's inner corner keeps its
 * twist (else the nearest to that of prev, the shape as the drag left it,
 * so that turns about the centre add up), an ellipse's radius makes it a
 * circle of that radius, an arc's end steps by 15 degrees. A corner's
 * cubic handle: on a smooth corner the other one turns to stay in line,
 * its length kept, unless breakCorner, which makes the corners sharp. An
 * arc's end (start, end): the parameter at x, the other end moved by as
 * much with shift (from s, the shape the drag began with: the arc keeps
 * its span); the type by how far out x is (inside: an open arc, outside: a
 * slice). An ellipse's centre: at x, the rest kept. A geodesic shape
 * (space): its construction in the chart of its centre takes the handle to
 * the chart's point of x (its centre moves to x itself, its sizes kept in
 * the metric)
 */
function shapeWithHandleAt(s, kind, x, prev = s, ctrl = false, breakCorner = false, space = null, shift = false){
    if (kind === 'centre') return normalShape({ ...s, cx: x[0], cy: x[1] });
    const inChart = space ? shapeInChart(s, space) : null;
    if (inChart) {
        const { local, chart } = inChart;
        const prevIn = prev === s ? inChart : shapeInChart(prev, space);
        return shapeFromChart(shapeWithHandleAt(local, kind, chart.to(x), prevIn ? prevIn.local : local, ctrl, breakCorner, null, shift), [s.cx, s.cy], inChart.space);
    }
    const [lx, ly] = shapeLocal(s, x);                     // in the shape's frame
    const f = Math.hypot(lx/s.rx, ly/s.ry);                // the frame radius of x
    switch (kind) {
    case 'round': return { ...s, round: Math.max(0, Math.min(1, (s.rx - lx)/Math.max(EPS, Math.min(s.rx, s.ry)))) };
    case 'size':  return { ...s, rx: Math.max(EPS, Math.abs(lx)), ry: Math.max(EPS, Math.abs(ly)) };
    case 'rx':    { const r = Math.max(EPS, Math.abs(lx)); return { ...s, rx: r, ...(ctrl ? { ry: r } : {}) }; }
    case 'ry':    { const r = Math.max(EPS, Math.abs(ly)); return { ...s, ry: r, ...(ctrl ? { rx: r } : {}) }; }
    case 'start':
    case 'end': {
        if (f < 1e-6) return s;
        let t = Math.atan2(ly/s.ry, lx/s.rx);
        if (ctrl) t = ARC_STEP*Math.round(t/ARC_STEP);
        const arc = isArc(s), start = arc ? s.start : 0, end = arc ? s.end : 0;
        const other = kind === 'start' ? 'end' : 'start';
        const moved = t - (kind === 'start' ? start : end);
        const type = f < ARC_INSIDE ? 'arc' : f > ARC_OUTSIDE ? 'slice' : (s.arc || 'slice');
        return normalShape({ ...s, [kind]: t, [other]: shift ? (other === 'start' ? start : end) + moved : (other === 'start' ? start : end), arc: type });
    }
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

    let mDrag = null;       // {sel, handle, before (the item), after, canvas, moved, alt, ctrl, shift (at the press)}

    /** the shape selected alone (of the kind) and its selection entry: {sel, item}, or null */
    function target(){
        const item = editor.getSelectedShape();
        if (!item || (kind && item.shape.kind !== kind)) return null;
        return { sel: editor.getSelection()[0], item };
    }

    function handles(){
        const t = target();
        return t ? shapeHandles(editor, t.item.shape, t.sel.frameInv, editor.shapeSpaceOf(t.item)) : [];
    }

    /**
     * the kind of the handle under the pointer of the event (pixels by the
     * view's scale there), or null: the nearest, and of handles about as
     * near (within TIE_PX, as an arc's end on the ry diamond) the last
     */
    function under(e){
        const tol = editor.hitTolerance(HANDLE_PX, e);
        let best = null, bestD = Infinity;
        for (const h of handles()) {
            const d = editor.pxDistance(h.world, e.wpnt, [e.canvasX, e.canvasY]);
            if (d <= tol && d <= bestD + TIE_PX) { bestD = Math.min(bestD, d); best = h.kind; }
        }
        return best;
    }

    function press(e){
        const canvas = [e.canvasX, e.canvasY];
        const handle = under(e);
        if (!handle) return false;
        const t = target();
        mDrag = { sel: t.sel, handle, before: t.item, after: null, canvas, moved: false, alt: e.altKey, ctrl: !!e.ctrlKey, shift: !!e.shiftKey };
        return true;
    }

    /**
     * a click on a handle (a press that did not move): Ctrl on an ellipse's
     * radius, a circle of that radius; Shift on an arc's end, the whole
     * ellipse; else null (nothing changes)
     */
    function clicked(item, handle, ctrl, shift){
        const s = item.shape;
        if (ctrl && handle === 'rx') return { ...item, shape: { ...s, ry: s.rx } };
        if (ctrl && handle === 'ry') return { ...item, shape: { ...s, rx: s.ry } };
        if (shift && (handle === 'start' || handle === 'end') && isArc(s)) return { ...item, shape: wholeEllipse(s) };
        return null;
    }

    function move(e){
        if (!mDrag || (e.pointerType !== 'touch' && !(e.buttons & 1))) return false;
        if (!mDrag.moved && Math.hypot(e.canvasX - mDrag.canvas[0], e.canvasY - mDrag.canvas[1]) < editor.dragTolerance(DRAG_PX, e)) return true;
        mDrag.moved = true;
        const item = mDrag.before;
        const x = editor.mapWorld(mDrag.sel.frame, e.wpnt);
        const prev = mDrag.after ? mDrag.after.shape : item.shape;
        mDrag.after = { ...item, shape: shapeWithHandleAt(item.shape, mDrag.handle, x, prev, e.ctrlKey, mDrag.alt, editor.shapeSpaceOf(item), e.shiftKey) };
        editor.applyReplace(new Map([[item.id, mDrag.after]]));
        editor.repaint();
        return true;
    }

    function release(){
        if (!mDrag) return false;
        const { before, moved, handle, ctrl, shift } = mDrag;
        const after = moved ? mDrag.after : clicked(before, handle, ctrl, shift);
        mDrag = null;
        if (after) {
            if (!moved) editor.applyReplace(new Map([[before.id, after]]));
            editor.pushReplace('shape', new Map([[before.id, before]]), new Map([[before.id, after]]));
        }
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
        for (const h of list) if (!h.node) editor.shapeHandleGeometry(geo, h.world, h.mark);
    }

    /** the cubic handles on lines from their corners, then the diamonds (discs, a cross) over them */
    function draw(ctx){
        const list = handles(), c = (w) => editor.view.toCanvas(w);
        for (const h of list) if (h.node) editor.drawControlHandle(ctx, c(h.node), c(h.world));
        for (const h of list) if (!h.node) editor.drawShapeHandle(ctx, c(h.world), h.mark);
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
