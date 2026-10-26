//
//  ShapeTool - draws shapes: a drag from corner to corner of their box
//
//  A SymRenderer pattern tool (pattern.createUITool), as PolylineTool. The
//  kind and its numbers come from the editor's shape settings (the 'shape'
//  row): rect (round: the corners' rounding, 0..1 of the shorter side),
//  ellipse, polygon (n corners), star (n points, ratio: the inner radius),
//  spiral (n turns). A shape is a path or a polyline item like any other
//  once drawn.
//    drag             the box of the shape (Shift: a square), snapped at
//                     both corners to the vertices of all copies
//    Escape           drop the drag
//    Ctrl+Z, Ctrl+Y   undo, redo
//

import {
    withNodes,
} from './modules.js';

const ICON = new URL('./res/btn_shape.svg', import.meta.url).pathname;
const DRAG_PX = 3;              // a smaller box is a click, no shape
const KAPPA = 4*(Math.SQRT2 - 1)/3;
const SPIRAL_STEPS = 24;        // points per turn

const SHAPE_KINDS = ['rect', 'ellipse', 'polygon', 'star', 'spiral'];

/** the shape of a kind in the box: {closed, nodes} or {closed, points} */
function shapeInBox(cfg, x0, y0, x1, y1){
    const cx = 0.5*(x0 + x1), cy = 0.5*(y0 + y1);
    const a = 0.5*Math.abs(x1 - x0), b = 0.5*Math.abs(y1 - y0);
    const n = Math.max(1, Math.round(cfg.n || 5));
    switch (cfg.kind) {
    case 'ellipse': {
        const nodes = [];
        for (let k = 0; k < 4; k++) {
            const t = Math.PI*k/2, c = Math.cos(t), s = Math.sin(t);
            const p = [cx + a*c, cy + b*s], d = [-a*s*KAPPA, b*c*KAPPA];
            nodes.push({ p, h1: [p[0] - d[0], p[1] - d[1]], h2: [p[0] + d[0], p[1] + d[1]], smooth: true });
        }
        return { closed: true, nodes };
    }
    case 'polygon': {
        const m = Math.max(3, n), points = [];
        for (let k = 0; k < m; k++) { const t = Math.PI/2 + 2*Math.PI*k/m; points.push(cx + a*Math.cos(t), cy + b*Math.sin(t)); }
        return { closed: true, points };
    }
    case 'star': {
        const m = Math.max(2, n), r = Math.max(0.01, Math.min(1, cfg.ratio ?? 0.5)), points = [];
        for (let k = 0; k < 2*m; k++) {
            const t = Math.PI/2 + Math.PI*k/m, f = (k % 2) ? r : 1;
            points.push(cx + f*a*Math.cos(t), cy + f*b*Math.sin(t));
        }
        return { closed: true, points };
    }
    case 'spiral': {
        const turns = Math.max(1, n), count = Math.round(turns*SPIRAL_STEPS), points = [];
        for (let k = 0; k <= count; k++) {
            const t = 2*Math.PI*turns*k/count, f = k/count;
            points.push(cx + f*a*Math.cos(t), cy + f*b*Math.sin(t));
        }
        return { closed: false, points };
    }
    default: {
        // a rect, its corners rounded by arcs
        const r = Math.max(0, Math.min(1, cfg.round || 0))*Math.min(a, b);
        if (r <= 0) return { closed: true, points: [cx + a, cy + b, cx - a, cy + b, cx - a, cy - b, cx + a, cy - b] };
        const nodes = [];
        const centres = [[cx + a - r, cy + b - r], [cx - a + r, cy + b - r], [cx - a + r, cy - b + r], [cx + a - r, cy - b + r]];
        centres.forEach((o, k) => {
            const t0 = Math.PI*k/2, t1 = t0 + Math.PI/2;
            const pa = [o[0] + r*Math.cos(t0), o[1] + r*Math.sin(t0)], pb = [o[0] + r*Math.cos(t1), o[1] + r*Math.sin(t1)];
            nodes.push({ p: pa, h1: null, h2: [pa[0] - KAPPA*r*Math.sin(t0), pa[1] + KAPPA*r*Math.cos(t0)] });
            nodes.push({ p: pb, h1: [pb[0] + KAPPA*r*Math.sin(t1), pb[1] - KAPPA*r*Math.cos(t1)], h2: null });
        });
        return { closed: true, nodes };
    }
    }
}

function ShapeTool(par) {

    const mEditor = par.editor;
    const mView = mEditor.view;
    const mRepaint = mEditor.repaint;

    let mPress = null;      // {canvas, w0} while the button is down
    let mPreview = null;    // the shape being dragged, an item
    let mSnapTarget = null;

    /** the point the pointer stands for: snapped */
    function constrain(w){
        mSnapTarget = null;
        const target = mEditor.snap(w);
        if (target) {
            mSnapTarget = target;
            return target.wpnt;
        }
        return w;
    }

    /** the shape from the press to w as an item (null for a box too small) */
    function shapeItem(w, square){
        const [x0, y0] = mPress.w0;
        let x1 = w[0], y1 = w[1];
        if (square) {
            const s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
            x1 = x0 + Math.sign(x1 - x0 || 1)*s;
            y1 = y0 + Math.sign(y1 - y0 || 1)*s;
        }
        const c0 = mView.toCanvas([x0, y0]), c1 = mView.toCanvas([x1, y1]);
        if (Math.abs(c1[0] - c0[0]) < DRAG_PX || Math.abs(c1[1] - c0[1]) < DRAG_PX) return null;
        const shape = shapeInBox(mEditor.getShapeConfig(), x0, y0, x1, y1);
        const base = { closed: shape.closed, style: mEditor.getStyle() };
        return shape.nodes ? withNodes({ ...base, type: 'path' }, shape.nodes) : { ...base, type: 'polyline', points: shape.points };
    }

    function cancel(){
        mPress = null;
        mPreview = null;
        mSnapTarget = null;
        mRepaint();
    }

    function handleEvent(e){
        if (!e.wpnt) return;
        switch (e.type) {
        case 'pointerdown':
            if (e.button !== 0) break;
            e.preventDefault();
            e.isConsumed = true;
            mPress = { canvas: [e.canvasX, e.canvasY], w0: constrain(e.wpnt) };
            mPreview = null;
            mRepaint();
            break;
        case 'pointermove':
            if (mPress && (e.buttons & 1)) {
                e.isConsumed = true;
                mPreview = shapeItem(constrain(e.wpnt), e.shiftKey);
                mRepaint();
            } else {
                constrain(e.wpnt);
                mRepaint();
            }
            break;
        case 'pointerup': {
            if (!mPress || e.button !== 0) break;
            e.isConsumed = true;
            const item = shapeItem(constrain(e.wpnt), e.shiftKey);
            if (item) mEditor.addItem(item);
            cancel();
            break;
        }
        case 'pointerleave':
            mSnapTarget = null;
            mRepaint();
            break;
        default:
            break;
        }
    }

    function handleKey(e){
        if (e.type !== 'keydown') return;
        if (e.key === 'Escape' && mPress) { cancel(); e.isConsumed = true; return; }
        if (mEditor.handleCommonKey(e)) e.isConsumed = true;
    }

    /** the shape being dragged, on the 2D overlay */
    function renderUI(ctx){
        mEditor.drawContainer(ctx);
        if (mPreview) mEditor.drawOutline(ctx, mEditor.itemCanvasPath(mPreview, null));
        mEditor.drawSnap(ctx, mSnapTarget);
    }

    return {
        name:      'shape',
        title:     'shape: drag the box of a rect, ellipse, polygon, star or spiral (the shape settings), Shift keeps it square, Escape drops',
        icon:      ICON,
        cursor:    'crosshair',
        handleEvent,
        handleKey,
        renderUI,
        setActive: (active) => { if (!active) cancel(); },
    };

} // function ShapeTool()

export { ShapeTool, SHAPE_KINDS, shapeInBox };
