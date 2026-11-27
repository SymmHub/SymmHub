//
//  PolylineTool - draws polylines into the drawing, in world coordinates
//
//  A SymRenderer pattern tool (pattern.createUITool): it receives the pointer
//  events with e.wpnt (the world point under the pointer) and the keys.
//    click            add a vertex (snapped to the vertices of all copies,
//                     to mirrors and cone points; Shift: 15 degree steps).
//                     With 'geodesic lines' on, in a group of the hyperbolic
//                     plane or the sphere, the line is a geodesic path
//                     (Paths.js): its sides the straight lines of the
//                     geometry, drawn so while it is made; with Shift a side
//                     leaves the last vertex in the stepped direction
//    click the first vertex   close the polyline (filled with 'fill closed')
//    drag             draw a freehand line (a path of curves fitted to it
//                     with 'fit curves' on); from one corner of a selected
//                     tile (Tiles.js) to the next, on any copy, it becomes
//                     that edge of the tile, the paired edge following
//    double click     finish the polyline (Enter too); the line drawn is
//                     selected: To polyline and To path in the bar act on
//                     it (Ctrl+Shift+C: To path)
//    Backspace        remove the last vertex
//    Escape           drop the polyline, else the selection (Delete removes it)
//    Ctrl+Z, Ctrl+Y   undo, redo
//  Wheel and other unused events fall through to the navigator.
//

import {
    snapProperty,
    fitCurvesProperty,
    geodesicProperty,
    pathFromPolyline,
    convertProperties,
    DrawingCommands,
} from './modules.js';

const ICON = new URL('./res/btn_polyline.svg', import.meta.url).pathname;
// what the tool does, in its tooltip and the property bar's hint
const HELP = 'click adds a vertex (snapped to the copies), drag draws freehand (corner to corner of a selected tile: its edge), double click or Enter ends, click the first vertex closes, Shift 15 degree steps, Escape drops; the line drawn is selected: To polyline and To path in the bar convert it (Ctrl+Shift+C: To path); with geodesic lines on the sides are the straight lines of the group\'s geometry';
const DRAG_PX = 4;              // a press moving further draws freehand
const SIMPLIFY_PX = 0.5;        // tolerance of the freehand line, canvas pixels
const CLOSE_PX = 8;             // reach of the first vertex for closing
const SAME_PX = 1;              // a click this close to the last vertex adds none
const ANGLE_STEP = Math.PI/12;  // Shift: 15 degrees
const ICON_DONE = '<svg viewBox="0 0 24 24"><path d="M4 12.5 L9.5 18 L20 6.5" fill="none" stroke="#1e7e34" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24"><path d="M5 17 L9 5 L19 8 L16 19 Z" fill="none" stroke="#303030" stroke-width="1.8" stroke-linejoin="round"/><circle cx="5" cy="17" r="2.2" fill="#fff" stroke="#303030" stroke-width="1.4"/></svg>';
const ICON_UNDO_PT = '<svg viewBox="0 0 24 24"><path d="M9 14 L4 9 L9 4" fill="none" stroke="#303030" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9 H14 A6 6 0 1 1 14 20 H11" fill="none" stroke="#303030" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_CANCEL = '<svg viewBox="0 0 24 24"><path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="#b91c1c" stroke-width="2.1" stroke-linecap="round"/></svg>';

/** Ramer-Douglas-Peucker on canvas points: the indices kept */
function simplify(pts, tol){
    const n = pts.length;
    if (n <= 2) return pts.map((p, i) => i);
    const keep = new Uint8Array(n);
    keep[0] = keep[n - 1] = 1;
    const stack = [[0, n - 1]];
    while (stack.length) {
        const [a, b] = stack.pop();
        const [ax, ay] = pts[a], [bx, by] = pts[b];
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
        let best = -1, bestD = tol;
        for (let i = a + 1; i < b; i++) {
            const d = len > 0 ? Math.abs((pts[i][0] - ax)*dy - (pts[i][1] - ay)*dx)/len
                              : Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
            if (d > bestD) { bestD = d; best = i; }
        }
        if (best >= 0) {
            keep[best] = 1;
            stack.push([a, best], [best, b]);
        }
    }
    const out = [];
    keep.forEach((k, i) => { if (k) out.push(i); });
    return out;
}

function PolylineTool(par) {

    const mEditor = par.editor;
    const mView = mEditor.view;
    const mRepaint = mEditor.repaint;

    let mPoints = [];       // [x, y] world points of the polyline drawn by clicks
    let mHover = null;      // world point under the pointer, snapped
    let mSnapTarget = null;
    let mPress = null;      // {canvas, wpnt} while the button is down
    let mFreehand = null;   // world points of a freehand line, with their canvas points
    // To polyline and To path in the bar
    const mCommands = DrawingCommands(mEditor);

    function isDrawing(){
        return mPoints.length > 0 || !!mFreehand;
    }

    /** the point the pointer stands for: snapped, or on a 15 degree ray with Shift */
    function constrain(w, canvas, shift, e = null){
        mSnapTarget = null;
        if (shift && mPoints.length) {
            const last = mPoints[mPoints.length - 1];
            const c0 = mView.toCanvas(last);
            const dx = canvas[0] - c0[0], dy = canvas[1] - c0[1];
            const a = Math.round(Math.atan2(dy, dx)/ANGLE_STEP)*ANGLE_STEP;
            const r = Math.hypot(dx, dy);
            const target = mView.toWorld([c0[0] + r*Math.cos(a), c0[1] + r*Math.sin(a)]).pnt;
            // a geodesic side leaves the last vertex in that direction, and ends as far from it as the pointer is
            return mEditor.drawsGeodesics() ? mEditor.geodesicRay(last, target, w) : target;
        }
        const target = mEditor.snap(w, null, canvas, e);
        if (target) {
            mSnapTarget = target;
            return target.wpnt;
        }
        return w;
    }

    /** is the world point within CLOSE_PX of the first vertex (pixels by the view's scale at the canvas point) */
    function nearFirst(w, canvas, e = null){
        if (mPoints.length < 3 || !w) return false;
        return mEditor.pxDistance(mPoints[0], w, canvas) <= mEditor.hitTolerance(CLOSE_PX, e);
    }

    /** a vertex at w, unless the last one is there already (pixels by the view's scale at the canvas point) */
    function addVertex(w, canvas){
        if (mPoints.length) {
            if (mEditor.pxDistance(mPoints[mPoints.length - 1], w, canvas) <= SAME_PX) return;
        }
        mPoints.push([w[0], w[1]]);
    }

    /** the item drawn added and selected (on the copy of the container being edited, if any): To polyline and To path in the bar act on it */
    function addSelected(item){
        const it = mEditor.addItem(item);
        const c = mEditor.getContainer();
        mEditor.setSelection([{ id: it.id, frame: c ? c.frame : null, frameInv: c ? c.frameInv : null }]);
    }

    function finish(closed = false){
        if (mPoints.length >= 2) {
            const line = { type: 'polyline', closed: closed && mPoints.length >= 3, points: mPoints.flat(), style: mEditor.getStyle() };
            // with geodesic lines: a path of nodes without handles, its sides the geodesics
            addSelected(mEditor.drawsGeodesics() ? { ...pathFromPolyline(line), geodesic: true } : line);
        }
        mPoints = [];
        mSnapTarget = null;
        mEditor.propertiesChanged();
        mRepaint();
    }

    function cancel(){
        mPoints = [];
        mFreehand = null;
        mPress = null;
        mSnapTarget = null;
        mEditor.propertiesChanged();
        mRepaint();
    }

    function undoPoint(){
        if (!mPoints.length) return;
        mPoints.pop();
        mEditor.propertiesChanged();
        mRepaint();
    }

    function finishFreehand(){
        const fh = mFreehand;
        mFreehand = null;
        if (!fh || fh.world.length < 2) return;
        const kept = simplify(fh.canvas, SIMPLIFY_PX);
        if (kept.length < 2) return;
        const world = kept.map(i => fh.world[i]);
        // the pixels of the tolerances: of the size where the stroke ended
        const at = fh.canvas[fh.canvas.length - 1];
        const stroke = { type: 'polyline', points: world.flat(), style: mEditor.getStyle() };
        // the stroke as curves, when wanted ('fit curves' of the style settings)
        const drawn = mEditor.getStyleConfig().fitCurves ? mEditor.fittedItem(stroke, mEditor.fitTolerance(at)) : stroke;
        // from one corner of a selected tile to the next: the stroke becomes that edge (fitted: a curved edge)
        if (!mEditor.getContainer() && mEditor.replaceTileEdge(world, at, undefined, drawn.nodes || null)) return;
        addSelected(drawn);
    }

    /** the pointer positions of a move, the coalesced ones included, as canvas points */
    function moveCanvasPoints(e){
        const list = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
        if (list.length === 1 && list[0] === e) return [[e.canvasX, e.canvasY]];
        const el = e.currentTarget || e.target;
        if (el && el.getBoundingClientRect && el.width > 0 && el.height > 0) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const sx = el.width / rect.width, sy = el.height / rect.height;
                return list.map(ce => Number.isFinite(ce.clientX) && Number.isFinite(ce.clientY)
                    ? [(ce.clientX - rect.left) * sx, (ce.clientY - rect.top) * sy]
                    : [e.canvasX, e.canvasY]);
            }
        }
        const sx = e.offsetX ? e.canvasX/e.offsetX : 1, sy = e.offsetY ? e.canvasY/e.offsetY : 1;
        return list.map(ce => [ce.offsetX*sx, ce.offsetY*sy]);
    }

    function handleEvent(e){
        if (!e.wpnt) return;
        const canvas = [e.canvasX, e.canvasY];
        switch (e.type) {
        case 'pointerdown':
            if (e.button !== 0) break;
            mPress = { canvas, wpnt: e.wpnt };
            e.preventDefault();
            e.isConsumed = true;
            break;
        case 'pointermove':
            if (mPress && (e.pointerType === 'touch' || (e.buttons & 1))) {
                e.isConsumed = true;
                if (!mFreehand && mPoints.length === 0
                    && Math.hypot(canvas[0] - mPress.canvas[0], canvas[1] - mPress.canvas[1]) > mEditor.dragTolerance(DRAG_PX, e)) {
                    const w0 = constrain(mPress.wpnt, mPress.canvas, false, e);
                    // the start on the canvas: the press under a projection of the view (toCanvas is the linear map)
                    mFreehand = { world: [w0], canvas: [mView.isLinear() ? mView.toCanvas(w0) : mPress.canvas] };
                }
                if (mFreehand) {
                    for (const c of moveCanvasPoints(e)) {
                        mFreehand.world.push(mView.toWorld(c).pnt);
                        mFreehand.canvas.push(c);
                    }
                    mRepaint();
                }
            } else if (e.pointerType !== 'touch') {
                mHover = constrain(e.wpnt, canvas, e.shiftKey, e);
                mRepaint();
            }
            break;
        case 'pointerup':
            if (!mPress || (e.pointerType !== 'touch' && e.button !== 0)) break;
            e.isConsumed = true;
            if (mFreehand) {
                finishFreehand();
            } else if (nearFirst(e.wpnt, canvas, e)) {
                finish(true);
            } else {
                addVertex(constrain(e.wpnt, canvas, e.shiftKey, e), canvas);
            }
            mPress = null;
            mEditor.propertiesChanged();
            mRepaint();
            break;
        case 'pointercancel':
            if (!mPress && !mFreehand) break;
            mPress = null;
            mFreehand = null;
            mSnapTarget = null;
            e.isConsumed = true;
            mEditor.propertiesChanged();
            mRepaint();
            break;
        case 'dblclick':
            if (mPoints.length) {
                e.preventDefault();
                e.isConsumed = true;
                finish(false);
            }
            break;
        case 'pointerleave':
            mHover = null;
            mSnapTarget = null;
            mRepaint();
            break;
        default:
            break;
        }
    }

    function handleKey(e){
        if (e.type !== 'keydown') return;
        if (!isDrawing()) {
            // the selection (the line drawn last) dropped or removed
            if (e.key === 'Escape' && mEditor.getSelection().length) { mEditor.clearSelection(); e.isConsumed = true; return; }
            if (e.key === 'Delete' && mEditor.getSelection().length) { mEditor.removeItems(mEditor.getSelection().map(s => s.id)); e.isConsumed = true; return; }
            if (mEditor.handleCommonKey(e)) e.isConsumed = true;
            return;
        }
        switch (e.key) {
        case 'Enter':     finish(false); e.isConsumed = true; break;
        case 'Escape':    cancel(); e.isConsumed = true; break;
        case 'Backspace': undoPoint(); e.isConsumed = true; break;
        default: break;
        }
    }

    /** a world polyline as canvas points, segments subdivided where the view bends them */
    function canvasPath(world){
        const sub = mView.isLinear() ? 1 : 8;
        const out = [];
        for (let i = 0; i < world.length; i++) {
            if (i > 0 && sub > 1) {
                const [ax, ay] = world[i - 1], [bx, by] = world[i];
                for (let k = 1; k < sub; k++) out.push(mView.toCanvas([ax + (bx - ax)*k/sub, ay + (by - ay)*k/sub]));
            }
            out.push(mView.toCanvas(world[i]));
        }
        return out;
    }

    /** the line being made through its vertices as it will be drawn: with geodesic lines its sides as arcs */
    function drawnLine(pts){
        return mEditor.drawsGeodesics() ? mEditor.geodesicPolyline(pts) : pts;
    }

    /** the same as geometry in world coordinates, for the GPU pass */
    function getOverlayGeometry(){
        const geo = mEditor.newGeometry();
        mEditor.containerGeometry(geo);
        if (mFreehand) {
            mEditor.outlineGeometry(geo, mFreehand.world);
        } else if (mPoints.length) {
            mEditor.outlineGeometry(geo, drawnLine(mHover ? [...mPoints, mHover] : mPoints));
            mPoints.forEach((p, i) => mEditor.handleGeometry(geo, p, i === 0 && mHover && nearFirst(mHover, null), true));
        } else {
            // the selection (the line drawn last): what To polyline and To path act on
            for (const sel of mEditor.getSelection()) {
                const item = mEditor.document.getItem(sel.id);
                if (item) mEditor.outlineGeometry(geo, mEditor.itemWorldPath(item, sel.frameInv));
            }
        }
        mEditor.snapGeometry(geo, mSnapTarget);
        return geo;
    }

    //
    //  the line being drawn and the snap target, on the 2D overlay
    //
    function renderUI(ctx){
        mEditor.drawContainer(ctx);
        if (mFreehand) {
            mEditor.drawOutline(ctx, mFreehand.canvas);
        } else if (mPoints.length) {
            const pts = mHover ? [...mPoints, mHover] : mPoints;
            mEditor.drawOutline(ctx, canvasPath(drawnLine(pts)));
            mPoints.forEach((p, i) => mEditor.drawHandle(ctx, mView.toCanvas(p), i === 0 && mHover && nearFirst(mHover, null), true));
        } else {
            for (const sel of mEditor.getSelection()) {
                const item = mEditor.document.getItem(sel.id);
                if (item) mEditor.drawOutline(ctx, mEditor.itemCanvasPath(item, sel.frameInv));
            }
        }
        mEditor.drawSnap(ctx, mSnapTarget);
    }

    return {
        name:      'polyline',
        label:     'Polyline',
        key:       'P',
        group:     'draw',
        title:     'polyline: ' + HELP,
        help:      HELP,
        icon:      ICON,
        cursor:    'crosshair',
        handleEvent,
        handleKey,
        renderUI,
        getOverlayGeometry,
        getProperties: () => [
            { kind: 'group', title: 'polyline', visible: () => mPoints.length > 0, controls: [
                { kind: 'button', icon: ICON_DONE, title: 'Finish open polyline (Enter / double-click)', enabled: () => mPoints.length >= 2, action: () => finish(false) },
                { kind: 'button', icon: ICON_CLOSE, title: 'Close polyline', enabled: () => mPoints.length >= 3, action: () => finish(true) },
                { kind: 'button', icon: ICON_UNDO_PT, title: 'Remove last vertex (Backspace)', enabled: () => mPoints.length > 0, action: undoPoint },
                { kind: 'button', icon: ICON_CANCEL, title: 'Cancel polyline (Escape)', enabled: () => mPoints.length > 0, action: cancel },
            ] },
            snapProperty(mEditor),
            fitCurvesProperty(mEditor),
            geodesicProperty(mEditor),
            convertProperties(mCommands),
        ],
        setActive: (active) => { if (!active) cancel(); },
    };

} // function PolylineTool()

export { PolylineTool };
