//
//  PenTool - draws paths of Bezier curves (Paths.js) node by node, in world
//  coordinates
//
//  A SymRenderer pattern tool (pattern.createUITool), as PolylineTool.
//    click            a corner node (snapped to the vertices of all copies,
//                     to mirrors and cone points)
//    drag             a smooth node: the drag pulls its handles out, the
//                     curve follows
//    click the first node   close the path (filled with 'fill closed')
//    double click     finish the path (Enter too); the path drawn is
//                     selected: To polyline and To path in the bar act on
//                     it (Ctrl+Shift+C: To path). An open path from one
//                     corner of a selected tile to the next becomes that
//                     edge, its handles too (a tile of points is made a
//                     curved tile first, Tiles.js)
//    Backspace        remove the last node
//    Escape           drop the path, else the selection (Delete removes it)
//    Ctrl+Z, Ctrl+Y   undo, redo
//  Wheel and other unused events fall through to the navigator. A path of
//  corner nodes only is a polyline. With 'geodesic lines' on, in a group of the
//  hyperbolic plane or the sphere, the path is a geodesic path (Paths.js): its
//  sides without handles the straight lines of the geometry, its curves the
//  cubics of the geometry, the handles of a node pulled out along one geodesic
//  through it; it is drawn so while it is made.
//

import {
    flattenNodes,
    withNodes,
    nodeHandlesPulled,
    snapProperty,
    geodesicProperty,
    convertProperties,
    DrawingCommands,
} from './modules.js';

const ICON = new URL('./res/btn_pen.svg', import.meta.url).pathname;
// what the tool does, in its tooltip and the property bar's hint
const HELP = 'click adds a corner node (snapped to the copies), drag pulls its handles out (a smooth node), click the first node closes, double click or Enter ends (corner to corner of a selected tile: its edge), Backspace removes the last node, Escape drops; the path drawn is selected: To polyline and To path in the bar convert it (Ctrl+Shift+C: To path)';
const DRAG_PX = 4;              // a press moving further pulls the node's handles out
const CLOSE_PX = 8;             // reach of the first node for closing
const SAME_PX = 1;              // a click this close to the last node adds none
const ICON_DONE = '<svg viewBox="0 0 24 24"><path d="M4 12.5 L9.5 18 L20 6.5" fill="none" stroke="#1e7e34" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24"><path d="M5 17 L9 5 L19 8 L16 19 Z" fill="none" stroke="#303030" stroke-width="1.8" stroke-linejoin="round"/><circle cx="5" cy="17" r="2.2" fill="#fff" stroke="#303030" stroke-width="1.4"/></svg>';
const ICON_UNDO_PT = '<svg viewBox="0 0 24 24"><path d="M9 14 L4 9 L9 4" fill="none" stroke="#303030" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9 H14 A6 6 0 1 1 14 20 H11" fill="none" stroke="#303030" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_CANCEL = '<svg viewBox="0 0 24 24"><path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="#b91c1c" stroke-width="2.1" stroke-linecap="round"/></svg>';

function PenTool(par) {

    const mEditor = par.editor;
    const mView = mEditor.view;
    const mRepaint = mEditor.repaint;

    let mNodes = [];        // the nodes drawn so far, world coordinates
    let mHover = null;      // world point under the pointer, snapped
    let mSnapTarget = null;
    let mPress = null;      // {canvas, index} while the button is down on the node just added
    // To polyline and To path in the bar
    const mCommands = DrawingCommands(mEditor);

    function isDrawing(){
        return mNodes.length > 0;
    }

    /** the point the pointer (at the canvas point) stands for: snapped */
    function constrain(w, canvas, e = null){
        mSnapTarget = null;
        const target = mEditor.snap(w, null, canvas, e);
        if (target) {
            mSnapTarget = target;
            return target.wpnt;
        }
        return w;
    }

    /** is the world point within CLOSE_PX of the first node (pixels by the view's scale at the canvas point) */
    function nearFirst(w, canvas, e = null){
        if (mNodes.length < 3 || !w) return false;
        return mEditor.pxDistance(mNodes[0].p, w, canvas) <= mEditor.hitTolerance(CLOSE_PX, e);
    }

    /** a corner node at w, unless the last node is there already; returns {index, added} */
    function addNode(w, canvas){
        if (mNodes.length) {
            if (mEditor.pxDistance(mNodes[mNodes.length - 1].p, w, canvas) <= SAME_PX) return { index: mNodes.length - 1, added: false };
        }
        mNodes.push({ p: [w[0], w[1]], h1: null, h2: null });
        return { index: mNodes.length - 1, added: true };
    }

    /** the item drawn added and selected (on the copy of the container being edited, if any): To polyline and To path in the bar act on it */
    function addSelected(item){
        const it = mEditor.addItem(item);
        const c = mEditor.getContainer();
        mEditor.setSelection([{ id: it.id, frame: c ? c.frame : null, frameInv: c ? c.frameInv : null }]);
    }

    function finish(closed = false){
        const nodes = mNodes;
        mNodes = [];
        mPress = null;
        mSnapTarget = null;
        // an open path from one corner of a selected tile to the next: that edge, its handles too
        if (!closed && nodes.length >= 2 && !mEditor.getContainer() && mEditor.replaceTileEdge(nodes.map(n => n.p), null, undefined, nodes)) {
            mEditor.propertiesChanged();
            mRepaint();
            return;
        }
        if (nodes.length >= 2 && !(closed && nodes.length < 3)) {
            const base = { closed, style: mEditor.getStyle() };
            // with geodesic lines: a geodesic path, with or without handles
            if (mEditor.drawsGeodesics()) addSelected(withNodes({ ...base, type: 'path', geodesic: true }, nodes));
            else if (nodes.some(n => n.h1 || n.h2)) addSelected(withNodes({ ...base, type: 'path' }, nodes));
            else addSelected({ ...base, type: 'polyline', points: nodes.flatMap(n => n.p) });
        }
        mEditor.propertiesChanged();
        mRepaint();
    }

    function cancel(){
        mNodes = [];
        mPress = null;
        mSnapTarget = null;
        mEditor.propertiesChanged();
        mRepaint();
    }

    function undoNode(){
        if (!mNodes.length) return;
        mNodes.pop();
        mEditor.propertiesChanged();
        mRepaint();
    }

    function handleEvent(e){
        if (!e.wpnt) return;
        const canvas = [e.canvasX, e.canvasY];
        switch (e.type) {
        case 'pointerdown': {
            if (e.button !== 0) break;
            e.preventDefault();
            e.isConsumed = true;
            if (nearFirst(e.wpnt, canvas, e)) { finish(true); break; }
            const added = addNode(constrain(e.wpnt, canvas, e), canvas);
            mPress = { canvas, index: added.index, added: added.added };
            mEditor.propertiesChanged();
            mRepaint();
            break;
        }
        case 'pointermove':
            if (mPress && (e.pointerType === 'touch' || (e.buttons & 1))) {
                e.isConsumed = true;
                if (Math.hypot(canvas[0] - mPress.canvas[0], canvas[1] - mPress.canvas[1]) > mEditor.dragTolerance(DRAG_PX, e)) {
                    // the handles of the node pressed, pulled out symmetrically (of a geodesic
                    // path in the chart of the node: along one geodesic through it)
                    mNodes[mPress.index] = nodeHandlesPulled([mNodes[mPress.index]], 0, e.wpnt, mEditor.drawingChart())[0];
                    mRepaint();
                }
            } else if (e.pointerType !== 'touch') {
                mHover = constrain(e.wpnt, canvas, e);
                mRepaint();
            }
            break;
        case 'pointerup':
            if (!mPress || (e.pointerType !== 'touch' && e.button !== 0)) break;
            e.isConsumed = true;
            mPress = null;
            mRepaint();
            break;
        case 'pointercancel':
            if (!mPress) break;
            if (mPress.added && mPress.index === mNodes.length - 1) mNodes.pop();
            mPress = null;
            mSnapTarget = null;
            e.isConsumed = true;
            mEditor.propertiesChanged();
            mRepaint();
            break;
        case 'dblclick':
            if (isDrawing()) {
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
        case 'Backspace': undoNode(); e.isConsumed = true; break;
        default: break;
        }
    }

    /** world points as canvas points, the steps between them subdivided where the view bends them */
    function canvasPath(flat){
        const sub = mView.isLinear() ? 1 : 4;
        const out = [];
        for (let i = 0; i + 1 < flat.length; i += 2) {
            if (i > 0 && sub > 1) {
                const ax = flat[i - 2], ay = flat[i - 1], bx = flat[i], by = flat[i + 1];
                for (let k = 1; k < sub; k++) out.push(mView.toCanvas([ax + (bx - ax)*k/sub, ay + (by - ay)*k/sub]));
            }
            out.push(mView.toCanvas([flat[i], flat[i + 1]]));
        }
        return out;
    }

    //
    //  the path being drawn, the next segment to the pointer, the nodes and
    //  the handles of the last node, on the 2D overlay
    //
    /** the path being made with the pointer's node, as world points: as it will be drawn (a geodesic path by the geometry) */
    function previewPoints(){
        const preview = (mHover && !mPress) ? [...mNodes, { p: mHover, h1: null, h2: null }] : mNodes;
        const drawn = mEditor.drawsGeodesics() ? mEditor.geodesicPath(preview, false) : null;
        if (drawn) return drawn;
        const flat = flattenNodes(preview, false);
        const pts = [];
        for (let i = 0; i + 1 < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
        return pts;
    }

    /** the same as geometry in world coordinates, for the GPU pass */
    function getOverlayGeometry(){
        const geo = mEditor.newGeometry();
        mEditor.containerGeometry(geo);
        if (mNodes.length) {
            mEditor.outlineGeometry(geo, previewPoints());
            mNodes.forEach((n, i) => mEditor.handleGeometry(geo, n.p, i === mNodes.length - 1, !!n.smooth));
            const last = mNodes[mNodes.length - 1];
            for (const h of [last.h1, last.h2]) if (h) mEditor.controlHandleGeometry(geo, last.p, h, mEditor.drawsGeodesics());
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

    function renderUI(ctx){
        mEditor.drawContainer(ctx);
        if (mNodes.length) {
            mEditor.drawOutline(ctx, canvasPath(previewPoints().flat()));
            mNodes.forEach((n, i) => mEditor.drawHandle(ctx, mView.toCanvas(n.p), i === mNodes.length - 1, !!n.smooth));
            const last = mNodes[mNodes.length - 1];
            const c = mView.toCanvas(last.p);
            for (const h of [last.h1, last.h2]) {
                if (h) mEditor.drawControlHandle(ctx, c, mView.toCanvas(h), mEditor.handleStalk(last.p, h, mEditor.drawsGeodesics()).map(q => mView.toCanvas(q)));
            }
        } else {
            for (const sel of mEditor.getSelection()) {
                const item = mEditor.document.getItem(sel.id);
                if (item) mEditor.drawOutline(ctx, mEditor.itemCanvasPath(item, sel.frameInv));
            }
        }
        mEditor.drawSnap(ctx, mSnapTarget);
    }

    return {
        name:      'pen',
        label:     'Pen',
        key:       'B',
        group:     'draw',
        title:     'pen: ' + HELP,
        help:      HELP,
        icon:      ICON,
        cursor:    'crosshair',
        handleEvent,
        handleKey,
        renderUI,
        getOverlayGeometry,
        getProperties: () => [
            { kind: 'group', title: 'path', visible: isDrawing, controls: [
                { kind: 'button', icon: ICON_DONE, title: 'Finish open path (Enter / double-click)', enabled: () => mNodes.length >= 2, action: () => finish(false) },
                { kind: 'button', icon: ICON_CLOSE, title: 'Close path', enabled: () => mNodes.length >= 3, action: () => finish(true) },
                { kind: 'button', icon: ICON_UNDO_PT, title: 'Remove last node (Backspace)', enabled: isDrawing, action: undoNode },
                { kind: 'button', icon: ICON_CANCEL, title: 'Cancel path (Escape)', enabled: isDrawing, action: cancel },
            ] },
            snapProperty(mEditor),
            geodesicProperty(mEditor),
            convertProperties(mCommands),
        ],
        setActive: (active) => { if (!active) cancel(); },
    };

} // function PenTool()

export { PenTool };
