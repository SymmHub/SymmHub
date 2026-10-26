//
//  ShapeTool - draws shapes: a drag from corner to corner of their box
//
//  A SymRenderer pattern tool (pattern.createUITool), as PolylineTool. The
//  kind and its numbers come from the editor's shape settings (the 'shape'
//  row): rect (round: the corners' rounding, 0..1 of the shorter side),
//  ellipse, polygon (n corners), star (n points, ratio: the inner radius),
//  spiral (n turns). The shape keeps its numbers (Shapes.js): the shape row
//  edits them afterwards, until its outline is edited by hand.
//    drag             the box of the shape (Shift: a square), snapped at
//                     both corners to the vertices of all copies
//    Escape           drop the drag
//    Ctrl+Z, Ctrl+Y   undo, redo
//

import {
    withNodes,
    shapeFromBox,
    shapeGeometry,
} from './modules.js';

const ICON = new URL('./res/btn_shape.svg', import.meta.url).pathname;
const DRAG_PX = 3;              // a smaller box is a click, no shape

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

    /** the shape from the press to w as an item with its numbers (null for a box too small) */
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
        const cfg = mEditor.getShapeConfig();
        const shape = shapeFromBox(cfg.kind, x0, y0, x1, y1, cfg);
        const g = shapeGeometry(shape);
        const base = { closed: g.closed, style: mEditor.getStyle() };
        const item = g.nodes ? withNodes({ ...base, type: 'path' }, g.nodes) : { ...base, type: 'polyline', points: g.points };
        return { ...item, shape };
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
        title:     'shape: drag the box of a rect, ellipse, polygon, star or spiral (the shape settings, which edit a selected shape too), Shift keeps it square, Escape drops',
        icon:      ICON,
        cursor:    'crosshair',
        handleEvent,
        handleKey,
        renderUI,
        setActive: (active) => { if (!active) cancel(); },
    };

} // function ShapeTool()

export { ShapeTool };
