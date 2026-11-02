//
//  ShapeTool - draws shapes of one kind: a drag from corner to corner of
//  their box, a polygon's or star's from its centre to a tip
//
//  A SymRenderer pattern tool (pattern.createUITool), as PolylineTool; there
//  is one per kind (par.kind): rect (round: the corners' rounding, 0..1 of
//  the shorter side), ellipse, polygon (n corners, radius, curved: its
//  corners joined by cubics, smoothO: those corners smooth), star (count n,
//  radius, aspect ratio: the inner corners' radius, twist: their turn,
//  curved, smoothO and smoothI: its outer and inner corners smooth), spiral
//  (n turns). The numbers are the tool's own (editor.getShapeToolConfig(kind)),
//  shown in its property bar. The shape keeps its numbers and its kind for
//  good (Shapes.js). The shape drawn is selected, and a shape of the kind
//  selected alone is edited here as in the node tool: its diamonds
//  (ShapeHandles.js) and the bar's numbers, which are then its own (set for
//  it and for the next shapes).
//    drag             the box of the shape (Shift: a square), snapped at
//                     both corners to the vertices of all copies; a polygon
//                     or star: from its centre to its first tip (Shift:
//                     turned by steps of 15 degrees), which sets the tool's
//                     radius
//    drag a diamond   the selected shape's numbers (a curved polygon's or
//                     star's round handles: the cubics of all its corners
//                     of that kind; a smooth corner keeps them in line,
//                     Alt+drag makes it sharp)
//    double click a corner's diamond   a curved polygon's or star's corners
//                     of that kind smooth or sharp
//    click            a shape of the kind (any copy) selected; elsewhere a
//                     polygon or star of the tool's radius, its first tip up
//                     (the other kinds: the selection dropped)
//    Delete           the selection removed
//    Escape           drop the drag, else the selection
//    Ctrl+Z, Ctrl+Y   undo, redo
//

import {
    withNodes,
    shapeFromBox,
    shapeFromCentre,
    shapeGeometry,
    ShapeHandles,
    snapProperty,
    shapeToolProperties,
} from './modules.js';

// the palette's button of each kind: its name, key, icon and help
const KINDS = {
    rect:    { label: 'Rectangle', key: 'R', help: 'drag the box of a rectangle (round: its corners), Shift keeps it square; click one to edit it, drag its diamonds; Escape drops' },
    ellipse: { label: 'Ellipse',   key: 'E', help: 'drag the box of an ellipse, Shift keeps it a circle; click one to edit it, drag its diamonds; Escape drops' },
    polygon: { label: 'Polygon',   key: '',  fromCentre: true,
               help: 'drag from the centre of a polygon to its tip (Shift turns by 15°), a click places one of the radius; click a polygon to edit it, drag its diamond and, when curved, its round handles (Alt: a sharp corner; double click the diamond: smooth or sharp); Escape drops' },
    star:    { label: 'Star',      key: '*', fromCentre: true,
               help: 'drag from the centre of a star to its tip (Shift turns by 15°), a click places one of the radius; click a star to edit it, drag its diamonds (the inner one: Ctrl keeps the twist) and, when curved, its round handles (Alt: sharp corners; double click a diamond: its corners smooth or sharp); Escape drops' },
    spiral:  { label: 'Spiral',    key: 'I', help: 'drag the box of a spiral, Shift keeps it round; click one to edit it, drag its diamonds; Escape drops' },
};
const iconOf = (kind) => new URL(`./res/btn_${kind}.svg`, import.meta.url).pathname;
const DRAG_PX = 3;              // a smaller box is a click, no shape
const TURN_STEP = Math.PI/12;   // Shift turns a polygon or star by steps of 15 degrees

function ShapeTool(par) {

    const mEditor = par.editor;
    const mKind = KINDS[par.kind] ? par.kind : 'rect';
    const mView = mEditor.view;
    const mRepaint = mEditor.repaint;

    const info = KINDS[mKind];

    let mPress = null;      // {canvas, w0, w} while the button is down (w0 snapped)
    let mPreview = null;    // the shape being dragged, an item
    let mSnapTarget = null;
    // the diamonds of a shape of the kind selected alone
    const mHandles = ShapeHandles(mEditor, mKind);

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

    /** the item drawn of a shape, with its numbers */
    function itemOf(shape){
        const g = shapeGeometry(shape);
        const base = { closed: g.closed, style: mEditor.getStyle() };
        const item = g.nodes ? withNodes({ ...base, type: 'path' }, g.nodes) : { ...base, type: 'polyline', points: g.points };
        return { ...item, shape };
    }

    /** the polygon or star from its centre at the press to its first tip at w (null for a drag too short); Shift: turned by steps */
    function centredShape(w, stepped){
        const [x0, y0] = mPress.w0;
        const c0 = mView.toCanvas([x0, y0]), c1 = mView.toCanvas(w);
        if (Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) < DRAG_PX) return null;
        let angle = Math.atan2(w[1] - y0, w[0] - x0);
        if (stepped) angle = TURN_STEP*Math.round(angle/TURN_STEP);
        return shapeFromCentre(mKind, x0, y0, Math.hypot(w[0] - x0, w[1] - y0), angle, mEditor.getShapeToolConfig(mKind));
    }

    /** the shape from the press to w as an item with its numbers (null for a box too small) */
    function shapeItem(w, square){
        if (info.fromCentre) { const shape = centredShape(w, square); return shape ? itemOf(shape) : null; }
        const [x0, y0] = mPress.w0;
        let x1 = w[0], y1 = w[1];
        if (square) {
            const s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
            x1 = x0 + Math.sign(x1 - x0 || 1)*s;
            y1 = y0 + Math.sign(y1 - y0 || 1)*s;
        }
        const c0 = mView.toCanvas([x0, y0]), c1 = mView.toCanvas([x1, y1]);
        if (Math.abs(c1[0] - c0[0]) < DRAG_PX || Math.abs(c1[1] - c0[1]) < DRAG_PX) return null;
        return itemOf(shapeFromBox(mKind, x0, y0, x1, y1, mEditor.getShapeToolConfig(mKind)));
    }

    /** the shape of the kind under w selected on that copy: true, else false */
    function pick(w){
        const hit = mEditor.hitTest(w);
        if (!hit || !hit.item.shape || hit.item.shape.kind !== mKind) return false;
        mEditor.setSelection([{ id: hit.item.id, frame: hit.frame, frameInv: hit.frameInv }]);
        return true;
    }

    /** the release at w: the shape dragged added (a polygon's or star's radius the tool's), else a click's pick, polygon or star */
    function release(w, shift){
        const item = shapeItem(w, shift);
        if (item) {
            if (info.fromCentre) mEditor.setShapeToolValue(mKind, 'radius', Math.sqrt(item.shape.rx*item.shape.ry));
            add(item);
        } else if (pick(mPress.w)) {
            // a shape of the kind clicked: edited here
        } else if (info.fromCentre) {
            const cfg = mEditor.getShapeToolConfig(mKind);
            add(itemOf(shapeFromCentre(mKind, mPress.w0[0], mPress.w0[1], cfg.radius, Math.PI/2, cfg)));
        } else {
            mEditor.clearSelection();
        }
    }

    /** the item added, selected (on the copy of the container being edited, if any) */
    function add(item){
        const it = mEditor.addItem(item);
        const c = mEditor.getContainer();
        mEditor.setSelection([{ id: it.id, frame: c ? c.frame : null, frameInv: c ? c.frameInv : null }]);
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
            if (mHandles.press(e)) break;
            mPress = { canvas: [e.canvasX, e.canvasY], w0: constrain(e.wpnt), w: e.wpnt };
            mPreview = null;
            mRepaint();
            break;
        case 'pointermove':
            if (mHandles.move(e)) { e.isConsumed = true; break; }
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
            if (mHandles.release()) { e.isConsumed = true; break; }
            if (!mPress || e.button !== 0) break;
            e.isConsumed = true;
            release(constrain(e.wpnt), e.shiftKey);
            cancel();
            break;
        }
        case 'dblclick':
            // a curved polygon's or star's corner diamond: its corners smooth or sharp
            if (mHandles.toggleCorner(e)) { e.preventDefault(); e.isConsumed = true; }
            break;
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
        if (e.key === 'Escape') {
            if (mHandles.isDragging()) mHandles.cancel();
            else if (mPress) cancel();
            else if (mEditor.getSelection().length) mEditor.clearSelection();
            else return;
            e.isConsumed = true;
            return;
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && !mPress && !mHandles.isDragging() && mEditor.getSelection().length) {
            mEditor.removeItems(mEditor.getSelection().map(s => s.id));
            e.isConsumed = true;
            return;
        }
        if (mEditor.handleCommonKey(e)) e.isConsumed = true;
    }

    /** the shape being dragged, else the selection's outlines and diamonds, on the 2D overlay */
    function renderUI(ctx){
        mEditor.drawContainer(ctx);
        if (mPreview) mEditor.drawOutline(ctx, mEditor.itemCanvasPath(mPreview, null));
        else {
            for (const sel of mEditor.getSelection()) {
                const item = mEditor.document.getItem(sel.id);
                if (item) mEditor.drawOutline(ctx, mEditor.itemCanvasPath(item, sel.frameInv));
            }
            mHandles.draw(ctx);
        }
        mEditor.drawSnap(ctx, mSnapTarget);
    }

    return {
        name:      mKind,
        label:     info.label,
        key:       info.key,
        group:     'shapes',
        title:     `${mKind}: ${info.help}`,
        help:      info.help,
        icon:      iconOf(mKind),
        cursor:    'crosshair',
        handleEvent,
        handleKey,
        renderUI,
        getProperties: () => [...shapeToolProperties(mEditor, mKind), snapProperty(mEditor)],
        setActive: (active) => { if (!active) { cancel(); mHandles.cancel(); } },
    };

} // function ShapeTool()

export { ShapeTool };
