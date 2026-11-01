//
//  NodeTool - edits the details of the selected items on any of their
//  copies: the nodes of paths and polylines, the vertices of tiles, the
//  numbers of shapes. The select tool (SelectTool.js) moves, transforms and
//  groups whole items; the two share the editor's selection.
//
//    click an item (any copy)   select it, with the frame of that copy, and
//                               show its nodes; Shift+click adds or removes
//    drag a node                move it (snapped to the vertices of all
//                               copies, mirrors and cone points)
//    a node of a path           the picked node shows its handles: drag one
//                               (a smooth node keeps the other in line,
//                               Alt+drag breaks it into a corner); Shift+drag
//                               the node pulls new handles out; double click
//                               the node makes it smooth or a corner
//    double click a segment     add a node there (on a path, Paths.js, a
//                               node on the curve, which keeps its shape)
//    Alt+click a node, Delete   remove it
//    arrows (Shift: x10)        nudge the picked node by a pixel
//    the Closed toggle          closes a path or polyline (a straight
//                               segment from its last node to its first) or
//                               opens it after the picked node (else its
//                               closing segment goes); the picked node's
//                               outline, else every selected one
//    a shape (Shapes.js)        keeps its kind: it has no nodes, its handles
//                               (diamonds, ShapeHandles.js) and the property
//                               bar's numbers edit it - a rect's rounding on
//                               its top edge and its size at a corner, an
//                               ellipse's radii, a polygon's or star's tip
//                               (turns and scales it), a star's inner corner
//                               (its aspect and twist; Ctrl+drag: the aspect
//                               alone), a spiral's end
//    a tile (Tiles.js)          its edges take their paired edges along; its
//                               corners and mirror sides (round handles) and
//                               the tile itself stay
//    double click a group       edit inside it (Escape, or a double click on
//                               nothing, leaves)
//    Escape                     the picked node dropped, then the selection
//    right click                the node's commands and the conversions of
//                               the outlines
//    Ctrl+Z, Ctrl+Y             undo, redo
//
//  A drag maps the pointer through the frame of the item's copy, so the node
//  moves under the pointer on that copy whatever the map of the group is.
//

import {
    flattenDetailed,
    withNodes,
    nodeMoved,
    handleMoved,
    nodeHandlesPulled,
    nodeSmoothToggled,
    splitSegment,
    removeNode,
    tileVertexFixed,
    tilePairedVertex,
    tileMovedVertex,
    tileInsertedVertex,
    tileRemovedVertex,
    ShapeHandles,
    snapProperty,
    selectedShapeProperties,
    DrawingCommands,
} from './modules.js';

const ICON = new URL('./res/btn_node.svg', import.meta.url).pathname;
// what the tool does, in its tooltip and the property bar's hint
const HELP = 'click a shape (any copy) to edit it, Shift adds; drag a node (snapped), Shift+drag pulls out its handles, drag a handle (Alt: a corner); double click a node: smooth or corner, a segment: a new node; Alt+click or Delete removes a node, arrows nudge it; Closed closes the outline or opens it after the picked node; a shape keeps its kind: drag its diamonds (the inner corner of a star: Ctrl keeps its twist) or set its numbers';
const HANDLE_PX = 7;        // reach of a node or a handle
const SEGMENT_PX = 6;       // reach of a segment for adding a node
const DRAG_PX = 2;          // a press moving less is a click

const STROKE = 'fill="none" stroke="#303030" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const NODE = 'fill="#fff" stroke="#303030" stroke-width="1.5"';
const svg = (body) => `<svg viewBox="0 0 24 24">${body}</svg>`;
// the icons of the node's buttons: the same line weight as the commands'
const ICONS = {
    addNode:    svg(`<path d="M3 18 H21" ${STROKE}/><rect x="9" y="15" width="6" height="6" ${NODE}/><path d="M12 3 V11 M8 7 H16" ${STROKE}/>`),
    removeNode: svg(`<path d="M3 18 H21" ${STROKE}/><rect x="9" y="15" width="6" height="6" ${NODE}/><path d="M8 7 H16" ${STROKE}/>`),
    smooth:     svg(`<path d="M3 19 C6 7 18 7 21 19" ${STROKE}/><path d="M4 10 H20" fill="none" stroke="#303030" stroke-width="1.2"/>` +
                    `<circle cx="12" cy="10" r="2.6" ${NODE}/>`),
    closed:     svg(`<path d="M5 18 L8 5 L19 7 L17 19 Z" ${STROKE}/>` +
                    ['5,18', '8,5', '19,7', '17,19'].map(p => { const [x, y] = p.split(','); return `<rect x="${x - 2}" y="${y - 2}" width="4" height="4" ${NODE}/>`; }).join('')),
};

function NodeTool(par) {

    const mEditor = par.editor;
    const mView = mEditor.view;
    const mDoc = mEditor.document;
    const mRepaint = mEditor.repaint;

    let mDrag = null;
    let mSnapTarget = null;
    let mDragCount = 0;         // a token per drag: the snap index is built once for it

    /** the vertices with handles: a path's nodes, else the points; a group, an image and a shape kept by its numbers have none */
    function itemVertices(item){
        if (item.type === 'group' || item.type === 'image' || item.shape) return [];
        return item.nodes ? item.nodes.flatMap(n => n.p) : item.points;
    }

    /** has the item nodes to edit: a path, a polyline or a tile */
    const hasNodes = (item) => !!item && item.type !== 'group' && item.type !== 'image' && !item.shape;

    /** does the item close and open: a path or a polyline, not a tile (it follows the domain) nor a container */
    const closes = (item) => hasNodes(item) && !item.tile && !(item.children && item.children.length);

    // the diamonds of a shape selected alone, which edit its numbers
    const mShapeHandles = ShapeHandles(mEditor);

    function canvasPoints(sel, flat){
        const pts = [];
        for (let i = 0; i + 1 < flat.length; i += 2) {
            pts.push(mView.toCanvas(mEditor.mapWorld(sel.frameInv, [flat[i], flat[i + 1]])));
        }
        return pts;
    }

    /** canvas points of the vertices of a selected item, on its copy */
    function vertexCanvasPoints(sel){
        const item = mDoc.getItem(sel.id);
        return item ? canvasPoints(sel, itemVertices(item)) : [];
    }

    /** the picked vertex with its selection entry and item: {pv, sel, item} or null */
    function picked(){
        const pv = mEditor.getSelectedVertex();
        if (!pv) return null;
        const sel = mEditor.getSelection().find(s => s.id === pv.id);
        const item = sel && mDoc.getItem(sel.id);
        return item ? { pv, sel, item } : null;
    }

    /** the picked node of a path, or null */
    function pickedNode(){
        const p = picked();
        return p && p.item.nodes ? p.item.nodes[p.pv.vertex] || null : null;
    }

    /**
     * a control handle of the picked node (of a path) under the canvas
     * point, when the node itself is not nearer: {sel, vertex, which} or null
     */
    function handleUnder(canvas){
        const p = picked();
        const node = pickedNode();
        if (!node) return null;
        const at = q => mView.toCanvas(mEditor.mapWorld(p.sel.frameInv, q));
        const dist = q => { const c = at(q); return Math.hypot(c[0] - canvas[0], c[1] - canvas[1]); };
        let best = null, bestD = Math.min(HANDLE_PX, dist(node.p));
        for (const which of ['h1', 'h2']) {
            if (!node[which]) continue;
            const d = dist(node[which]);
            if (d < bestD) { bestD = d; best = { sel: p.sel, vertex: p.pv.vertex, which }; }
        }
        return best;
    }

    /** the vertex handle under the canvas point: {sel, vertex} or null */
    function vertexUnder(canvas){
        let best = null, bestD = HANDLE_PX;
        for (const sel of mEditor.getSelection()) {
            vertexCanvasPoints(sel).forEach((c, vertex) => {
                const d = Math.hypot(c[0] - canvas[0], c[1] - canvas[1]);
                if (d <= bestD) { bestD = d; best = { sel, vertex }; }
            });
        }
        return best;
    }

    /**
     * the segment of a selected item with nodes under the canvas point:
     * {sel, index, t} or null; on a path the segment between two nodes,
     * found along its flattened outline, t where on it
     */
    function segmentUnder(canvas){
        let best = null, bestD = SEGMENT_PX;
        for (const sel of mEditor.getSelection()) {
            const item = mDoc.getItem(sel.id);
            if (!hasNodes(item)) continue;
            const flat = item.nodes ? flattenDetailed(item.nodes, item.closed) : null;
            const c = canvasPoints(sel, flat ? flat.points : item.points);
            const n = c.length, segs = item.closed ? n : n - 1;
            for (let i = 0; i < segs; i++) {
                const a = c[i], b = c[(i + 1) % n];
                const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx*dx + dy*dy;
                const t = len2 > 0 ? Math.max(0, Math.min(1, ((canvas[0] - a[0])*dx + (canvas[1] - a[1])*dy)/len2)) : 0;
                const d = Math.hypot(a[0] + t*dx - canvas[0], a[1] + t*dy - canvas[1]);
                if (d > bestD) continue;
                bestD = d;
                const piece = flat ? flat.pieces[i] : null;
                best = piece ? { sel, index: piece.seg, t: piece.t0 + (piece.t1 - piece.t0)*t } : { sel, index: i, t };
            }
        }
        return best;
    }

    function itemsMap(ids){
        return new Map(ids.map(id => [id, JSON.parse(JSON.stringify(mDoc.getItem(id)))]).filter(e => e[1]));
    }

    /** the item with its vertex moved to x (its own coordinates): a tile's edge takes its paired edge along, a path's node its handles; null if it cannot */
    function vertexMoved(item, vertex, x){
        if (item.tile) return tileMovedVertex(item, vertex, x, mEditor.pairingMap);
        if (item.nodes) return withNodes(item, nodeMoved(item.nodes, vertex, x));
        const points = item.points.slice();
        points[2*vertex] = x[0];
        points[2*vertex + 1] = x[1];
        return { ...item, points };
    }

    function removeVertex(id, vertex){
        const item = mDoc.getItem(id);
        if (!hasNodes(item) || itemVertices(item).length/2 <= 2) return;
        const before = itemsMap([id]);
        let changed;
        if (item.tile) {
            changed = tileRemovedVertex(item, vertex, mEditor.pairingMap);
            if (!changed) return;
        } else if (item.nodes) {
            changed = withNodes(item, removeNode(item.nodes, vertex));
        } else {
            const points = item.points.slice();
            points.splice(2*vertex, 2);
            changed = { ...item, points };
        }
        const after = new Map([[id, changed]]);
        mEditor.applyReplace(after);
        mEditor.pushReplace('remove node', before, after);
        mEditor.setSelectedVertex(null);
    }

    /** a node of a path smooth or a corner */
    function toggleSmooth(id, vertex){
        const item = mDoc.getItem(id);
        if (!item || !item.nodes) return;
        const before = itemsMap([id]);
        const after = new Map([[id, withNodes(item, nodeSmoothToggled(item.nodes, vertex, item.closed))]]);
        mEditor.applyReplace(after);
        mEditor.pushReplace('node', before, after);
        mEditor.setSelectedVertex({ id, vertex });
    }

    /** a vertex on segment index (after vertex index): at x (the item's own coordinates), on a path at the segment's parameter t */
    function insertVertex(sel, index, x, t = 0.5){
        const item = mDoc.getItem(sel.id);
        if (!hasNodes(item)) return;
        const before = itemsMap([sel.id]);
        let changed;
        if (item.tile) {
            changed = tileInsertedVertex(item, index, x, mEditor.pairingMap);
            if (!changed) return;
        } else if (item.nodes) {
            changed = withNodes(item, splitSegment(item.nodes, item.closed, index, t));
        } else {
            const points = item.points.slice();
            points.splice(2*(index + 1), 0, x[0], x[1]);
            changed = { ...item, points };
        }
        const after = new Map([[sel.id, changed]]);
        mEditor.applyReplace(after);
        mEditor.pushReplace('add node', before, after);
        mEditor.setSelectedVertex({ id: sel.id, vertex: index + 1 });
    }

    /** can a node go after the picked one (before it, at the end of an open outline) */
    function canAddNode(){
        const p = picked();
        return !!p && hasNodes(p.item) && itemVertices(p.item).length >= 4;
    }

    /** a node in the middle of the segment after the picked node (before it, at the end of an open outline) */
    function addNode(){
        const p = picked();
        if (!canAddNode()) return;
        const pts = itemVertices(p.item), n = pts.length/2;
        const index = (p.item.closed || p.pv.vertex < n - 1) ? p.pv.vertex : p.pv.vertex - 1;
        const j = (index + 1) % n;
        insertVertex(p.sel, index, [0.5*(pts[2*index] + pts[2*j]), 0.5*(pts[2*index + 1] + pts[2*j + 1])], 0.5);
    }

    /** can the picked node go: two stay, a tile's fixed corners stay */
    function canRemoveNode(){
        const p = picked();
        return !!p && hasNodes(p.item) && itemVertices(p.item).length/2 > 2 && !(p.item.tile && tileVertexFixed(p.item.tile, p.pv.vertex));
    }

    function removePicked(){
        const p = picked();
        if (p) removeVertex(p.pv.id, p.pv.vertex);
    }

    function togglePicked(){
        const p = picked();
        if (p && p.item.nodes) toggleSmooth(p.pv.id, p.pv.vertex);
    }

    /** the outlines the Closed toggle acts on: the picked node's, else the selected ones */
    function closeTargets(){
        const p = picked();
        return (p ? [p.sel] : mEditor.getSelection()).map(s => mDoc.getItem(s.id)).filter(closes);
    }

    /** can the item close (a path of two nodes, a polyline of three points) or open */
    const canToggleClosed = (item) => item.closed || itemVertices(item).length/2 >= (item.nodes ? 2 : 3);

    /**
     * the item closed by a straight segment from its last node to its first,
     * or opened after its vertex `after` (the segment from it to the next
     * one goes, its handles too: the outline starts after that vertex and
     * ends at it); the nodes at the ends become corners
     */
    function closedItem(item, closed, after){
        const n = itemVertices(item).length/2;
        if (!item.nodes) {
            if (closed) return { ...item, closed };
            const k = 2*((after + 1) % n);
            return { ...item, closed, points: [...item.points.slice(k), ...item.points.slice(0, k)] };
        }
        const corner = (node, handle) => { const out = { ...node, [handle]: null }; delete out.smooth; return out; };
        const k = closed ? 0 : (after + 1) % n;
        const nodes = [...item.nodes.slice(k), ...item.nodes.slice(0, k)];
        nodes[0] = corner(nodes[0], 'h1');
        nodes[n - 1] = corner(nodes[n - 1], 'h2');
        return withNodes({ ...item, closed }, nodes);
    }

    /** the Closed toggle's outlines closed or opened (after the picked node, else their closing segment goes); one undo step */
    function setClosed(closed){
        const p = picked();
        const before = new Map(), after = new Map();
        for (const item of closeTargets()) {
            if (!!item.closed === closed || !canToggleClosed(item)) continue;
            const at = p && p.item.id === item.id ? p.pv.vertex : itemVertices(item).length/2 - 1;
            before.set(item.id, JSON.parse(JSON.stringify(item)));
            after.set(item.id, closedItem(item, closed, at));
        }
        if (!after.size) return;
        mEditor.applyReplace(after);
        mEditor.pushReplace(closed ? 'close' : 'open', before, after);
        // opened after the picked node: that node is the last one now
        if (p && !closed && after.has(p.item.id)) mEditor.setSelectedVertex({ id: p.item.id, vertex: itemVertices(p.item).length/2 - 1 });
        mRepaint();
    }

    /** are the Closed toggle's outlines all closed */
    function allClosed(){
        const t = closeTargets();
        return t.length > 0 && t.every(it => it.closed);
    }

    /** the item hit selected on that copy (Shift: added or taken out), or the selection dropped */
    function pick(e){
        const hit = mEditor.hitTest(e.wpnt);
        if (!hit) {
            if (!e.shiftKey) mEditor.clearSelection();
            return;
        }
        const entry = { id: hit.item.id, frame: hit.frame, frameInv: hit.frameInv };
        const sel = mEditor.getSelection();
        const wasSelected = mEditor.isSelected(entry.id);
        if (e.shiftKey) mEditor.setSelection(wasSelected ? sel.filter(s => s.id !== entry.id) : [...sel, entry]);
        // a selected item clicked on this or another copy: it is edited on that copy
        else if (wasSelected) mEditor.setSelection(sel.map(s => s.id === entry.id ? entry : s));
        else mEditor.setSelection([entry]);
    }

    function handleEvent(e){
        if (!e.wpnt) return;
        const canvas = [e.canvasX, e.canvasY];
        switch (e.type) {
        case 'pointerdown': {
            if (e.button !== 0) break;
            e.preventDefault();
            e.isConsumed = true;
            // a control handle of the picked node
            const h = handleUnder(canvas);
            if (h) {
                mDrag = { kind: 'handle', sel: h.sel, vertex: h.vertex, which: h.which, alt: e.altKey, before: itemsMap([h.sel.id]), canvas, moved: false };
                break;
            }
            // a handle of a shape's numbers
            if (mShapeHandles.press(e)) break;
            const v = vertexUnder(canvas);
            if (v) {
                if (e.altKey) { removeVertex(v.sel.id, v.vertex); break; }
                mEditor.setSelectedVertex({ id: v.sel.id, vertex: v.vertex });
                // a tile's corners and mirror sides stay where the group puts them
                const item = mDoc.getItem(v.sel.id);
                if (item.tile && tileVertexFixed(item.tile, v.vertex)) break;
                // Shift on a node of a path: new handles pulled out of it
                if (e.shiftKey && item.nodes) {
                    mDrag = { kind: 'pull', sel: v.sel, vertex: v.vertex, before: itemsMap([v.sel.id]), canvas, moved: false };
                    break;
                }
                // the dragged vertex, and on a tile the one following it, are no snap targets
                const vertices = [v.vertex];
                if (item.tile) { const pv = tilePairedVertex(item.tile, v.vertex); if (pv !== null) vertices.push(pv); }
                mDrag = { kind: 'vertex', sel: v.sel, vertex: v.vertex, vertices, drag: ++mDragCount, before: itemsMap([v.sel.id]), canvas, moved: false };
                break;
            }
            pick(e);
            break;
        }
        case 'pointermove':
            if (mShapeHandles.move(e)) { e.isConsumed = true; break; }
            if (!mDrag || !(e.buttons & 1)) break;
            e.isConsumed = true;
            if (!mDrag.moved && Math.hypot(canvas[0] - mDrag.canvas[0], canvas[1] - mDrag.canvas[1]) < DRAG_PX) break;
            mDrag.moved = true;
            if (mDrag.kind === 'vertex') {
                const target = mEditor.snap(e.wpnt, { itemId: mDrag.sel.id, vertex: mDrag.vertex, vertices: mDrag.vertices, drag: mDrag.drag });
                mSnapTarget = target;
                const x = mEditor.mapWorld(mDrag.sel.frame, target ? target.wpnt : e.wpnt);
                const moved = vertexMoved(mDrag.before.get(mDrag.sel.id), mDrag.vertex, x);
                if (!moved) break;
                mDrag.after = new Map([[mDrag.sel.id, moved]]);
                mEditor.applyReplace(mDrag.after);
            } else {
                const item = mDrag.before.get(mDrag.sel.id);
                const x = mEditor.mapWorld(mDrag.sel.frame, e.wpnt);
                const nodes = mDrag.kind === 'pull' ? nodeHandlesPulled(item.nodes, mDrag.vertex, x)
                                                    : handleMoved(item.nodes, mDrag.vertex, mDrag.which, x, !mDrag.alt);
                mDrag.after = new Map([[mDrag.sel.id, withNodes(item, nodes)]]);
                mEditor.applyReplace(mDrag.after);
            }
            mRepaint();
            break;
        case 'pointerup':
            if (mShapeHandles.release()) { e.isConsumed = true; break; }
            if (!mDrag) break;
            e.isConsumed = true;
            if (mDrag.moved && mDrag.after) {
                const label = { vertex: 'move node', handle: 'handle', pull: 'handles' }[mDrag.kind];
                mEditor.pushReplace(label, mDrag.before, mDrag.after);
            }
            mDrag = null;
            mSnapTarget = null;
            mRepaint();
            break;
        case 'dblclick': {
            e.preventDefault();
            e.isConsumed = true;
            // a node of a path: smooth or a corner
            const dv = vertexUnder(canvas);
            if (dv) {
                if (mDoc.getItem(dv.sel.id).nodes) toggleSmooth(dv.sel.id, dv.vertex);
                break;
            }
            const s = segmentUnder(canvas);
            if (s) { insertVertex(s.sel, s.index, mEditor.mapWorld(s.sel.frame, e.wpnt), s.t); break; }
            // a group: edit inside it; nothing: leave the group
            const hit = mEditor.hitTest(e.wpnt);
            if (hit && hit.item.type === 'group') mEditor.enterContainer(hit.item.id, hit.frame, hit.frameInv);
            else if (!hit) mEditor.leaveContainer();
            break;
        }
        default:
            break;
        }
    }

    /** the picked node moved by (dx, dy) canvas pixels on its copy; one undo step per run of nudges */
    function nudge(dx, dy){
        const p = picked();
        if (!p || !hasNodes(p.item) || (p.item.tile && tileVertexFixed(p.item.tile, p.pv.vertex))) return;
        const pts = itemVertices(p.item), v = p.pv.vertex;
        const c = mView.toCanvas(mEditor.mapWorld(p.sel.frameInv, [pts[2*v], pts[2*v + 1]]));
        const x = mEditor.mapWorld(p.sel.frame, mView.toWorld([c[0] + dx, c[1] + dy]).pnt);
        const before = itemsMap([p.item.id]);
        const moved = vertexMoved(before.get(p.item.id), v, x);
        if (!moved) return;
        const after = new Map([[p.item.id, moved]]);
        mEditor.applyReplace(after);
        mEditor.pushReplace('nudge node', before, after, 'nudge node');
        mRepaint();
    }

    function handleKey(e){
        if (e.type !== 'keydown') return;
        if (mEditor.handleCommonKey(e)) { e.isConsumed = true; return; }
        const ctrl = e.ctrlKey || e.metaKey;
        const step = e.shiftKey ? 10 : 1;
        switch (e.key) {
        case 'Delete':
        case 'Backspace':
            removePicked();
            e.isConsumed = true;
            break;
        case 'Escape':
            if (mEditor.getSelectedVertex()) mEditor.setSelectedVertex(null);
            else if (mEditor.getSelection().length) mEditor.clearSelection();
            else mEditor.leaveContainer();
            e.isConsumed = true;
            break;
        case 'ArrowLeft':  nudge(-step, 0); e.isConsumed = true; break;
        case 'ArrowRight': nudge(step, 0); e.isConsumed = true; break;
        case 'ArrowUp':    nudge(0, -step); e.isConsumed = true; break;
        case 'ArrowDown':  nudge(0, step); e.isConsumed = true; break;
        case 'a':
        case 'A':
            if (ctrl) {
                mEditor.setSelection(mDoc.getEditableItems().map(it => ({ id: it.id, frame: null, frameInv: null })));
                e.isConsumed = true;
            }
            break;
        default: break;
        }
    }

    //
    //  the selection's outlines on the copies it was picked on, their nodes,
    //  the picked node's handles, a shape's handles and the snap target
    //
    function renderUI(ctx){
        mEditor.drawContainer(ctx);
        const pv = mEditor.getSelectedVertex();
        for (const sel of mEditor.getSelection()) {
            const item = mDoc.getItem(sel.id);
            if (!item) continue;
            mEditor.drawOutline(ctx, mEditor.itemCanvasPath(item, sel.frameInv));
            vertexCanvasPoints(sel).forEach((c, vertex) => mEditor.drawHandle(ctx, c,
                !!pv && pv.id === sel.id && pv.vertex === vertex,
                !!(item.tile && tileVertexFixed(item.tile, vertex)) || !!(item.nodes && item.nodes[vertex] && item.nodes[vertex].smooth)));
            // the control handles of the picked node
            const node = pv && pv.id === sel.id && item.nodes ? item.nodes[pv.vertex] : null;
            if (node) {
                const c = mView.toCanvas(mEditor.mapWorld(sel.frameInv, node.p));
                for (const h of [node.h1, node.h2]) if (h) mEditor.drawControlHandle(ctx, c, mView.toCanvas(mEditor.mapWorld(sel.frameInv, h)));
            }
        }
        mShapeHandles.draw(ctx);
        mEditor.drawSnap(ctx, mSnapTarget);
    }

    // the conversions of the outlines, as a menu of the property bar
    const mCommands = DrawingCommands(mEditor);
    const CONVERSIONS = ['toPath', 'toPolyline', 'fitCurves'];

    /** the node's commands, as popup menu items */
    function nodeMenuItems(){
        const node = pickedNode();
        return [
            { label: 'Add node', title: 'in the middle of the segment after the picked node', disabled: !canAddNode(), action: addNode },
            { label: 'Remove node  Delete', disabled: !canRemoveNode(), action: removePicked },
            { label: node && node.smooth ? 'Make corner' : 'Make smooth', title: 'a smooth node keeps its handles in line',
              disabled: !node, action: togglePicked },
            allClosed()
                ? { label: 'Open', title: 'the segment after the picked node goes (else the closing one)', action: () => setClosed(false) }
                : { label: 'Close', title: 'a straight segment from the last node to the first',
                    disabled: !closeTargets().some(canToggleClosed), action: () => setClosed(true) },
        ];
    }

    /** the menu of a right click: the node under the pointer is picked
     *  first (the item under it selected), then the node's commands and the
     *  conversions of the outlines; none for shapes, which have no nodes */
    function getContextMenu(e){
        const v = Number.isFinite(e.canvasX) ? vertexUnder([e.canvasX, e.canvasY]) : null;
        if (v) mEditor.setSelectedVertex({ id: v.sel.id, vertex: v.vertex });
        else {
            const hit = e.wpnt ? mEditor.hitTest(e.wpnt) : null;
            if (hit && !mEditor.isSelected(hit.item.id)) mEditor.setSelection([{ id: hit.item.id, frame: hit.frame, frameInv: hit.frameInv }]);
        }
        if (!mEditor.getSelection().some(s => hasNodes(mDoc.getItem(s.id)))) return [];
        return [...nodeMenuItems(), { separator: true }, ...mCommands.menuItems(CONVERSIONS)];
    }

    /** the property bar, in groups that wrap into rows: snap and the
     *  conversions; while an outline with nodes is selected the picked
     *  node's commands; the numbers of a shape selected alone (the style is
     *  the style panel's) */
    function getProperties(){
        const nodes = { visible: () => mEditor.getSelection().some(s => hasNodes(mDoc.getItem(s.id))) };
        return [
            { kind: 'group', controls: [
                snapProperty(mEditor),
                { kind: 'menu', icon: mCommands.icon('menu'), title: 'to path, to polyline, fit curves', ...nodes,
                  items: () => mCommands.menuItems(CONVERSIONS) },
            ] },
            { kind: 'group', title: 'the picked node', ...nodes, controls: [
                { kind: 'button', icon: ICONS.addNode, title: 'Add node: in the middle of the segment after the picked node (or double click a segment)',
                  enabled: canAddNode, action: addNode },
                { kind: 'button', icon: ICONS.removeNode, title: 'Remove node (Delete, or Alt+click it)', enabled: canRemoveNode, action: removePicked },
                { kind: 'toggle', icon: ICONS.smooth, title: 'Smooth node: its handles in line, else a corner (or double click it)',
                  enabled: () => !!pickedNode(), get: () => !!(pickedNode() && pickedNode().smooth), set: togglePicked },
                { kind: 'toggle', icon: ICONS.closed, title: 'Closed: a straight segment from the last node to the first; off: opened after the picked node (else the closing segment goes)',
                  enabled: () => closeTargets().some(canToggleClosed), get: allClosed, set: setClosed },
            ] },
            selectedShapeProperties(mEditor),
        ];
    }

    return {
        name:      'node',
        label:     'Node',
        key:       'N',
        group:     'edit',
        title:     'node: ' + HELP,
        help:      HELP,
        icon:      ICON,
        cursor:    'default',
        handleEvent,
        handleKey,
        renderUI,
        getProperties,
        getContextMenu,
        setActive: (active) => { if (!active) { mDrag = null; mSnapTarget = null; mShapeHandles.cancel(); } },
    };

} // function NodeTool()

export { NodeTool };
