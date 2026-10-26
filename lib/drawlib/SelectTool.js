//
//  SelectTool - selects, moves and reshapes items on any of their copies
//
//    click an item (any copy)   select it, with the frame of that copy; a
//                               selected item clicked on another copy moves
//                               its handles there
//    Shift+click                add to or remove from the selection
//    drag                       move the selection
//    the transform box          a dashed box round the selection with eight
//                               handles: drag one to scale about the opposite
//                               one (Shift: about the centre, Ctrl: the same
//                               both ways); a click on the selection turns
//                               them round: a corner then rotates about the
//                               centre (Shift: about the opposite corner,
//                               Ctrl: 15 degree steps) and a side skews
//    Ctrl+C, Ctrl+V, Ctrl+D     copy, paste (where new items go), duplicate
//    PageUp, PageDown           raise, lower (Ctrl: to the top, the bottom;
//                               Home, End too)
//    drag a vertex handle       move the vertex (snapped to the vertices of
//                               all copies, mirrors and cone points); a
//                               corner of an image scales the image
//    double click a segment     add a vertex there (on a path, Paths.js, a
//                               node on the curve, which keeps its shape)
//    a node of a path           the picked node shows its handles: drag one
//                               (a smooth node keeps the other in line,
//                               Alt+drag breaks it into a corner); Shift+drag
//                               the node pulls new handles out; double click
//                               the node makes it smooth or a corner
//    a tile (Tiles.js)          its edges take their paired edges along; its
//                               corners and mirror sides (round handles) and
//                               the tile itself stay
//    double click a closed item edit inside it: new items go into it, its
//                               items are picked (Escape, or a double click
//                               on nothing, leaves)
//    Alt+click a vertex         remove it
//    Delete, Backspace          remove the picked vertex, else the selection
//    arrows (Shift: x10)        nudge the selection by a pixel
//    Ctrl+A                     select all, Escape: nothing
//    Ctrl+Z, Ctrl+Y             undo, redo
//
//  A drag maps the pointer through the frame of each item's copy, so the item
//  moves under the pointer on that copy whatever the map of the group is.
//

import {
    flattenDetailed,
    withNodes,
    movedNodes,
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
} from './modules.js';

const ICON = new URL('./res/btn_select.svg', import.meta.url).pathname;
const HANDLE_PX = 7;        // reach of a vertex handle
const SEGMENT_PX = 6;       // reach of a segment for adding a vertex
const DRAG_PX = 2;          // a press moving less is a click
const BOX_MARGIN_PX = 12;   // the transform box stands this far outside the selection
const ANGLE_STEP = Math.PI/12;  // Ctrl: 15 degree steps of a rotation
const MIN_SCALE = 1e-3;

function SelectTool(par) {

    const mEditor = par.editor;
    const mView = mEditor.view;
    const mDoc = mEditor.document;
    const mRepaint = mEditor.repaint;

    let mDrag = null;
    let mSnapTarget = null;
    let mDragCount = 0;         // a token per drag: the snap index is built once for it
    let mTransformMode = 'scale';   // what the transform box's handles do: 'scale' or 'rotate' (and skew)

    /**
     * the transform box of the selection as seen (world, BOX_MARGIN_PX
     * outside the outlines) with its eight handles: corners 0..3 from the
     * bottom left counterclockwise, then the sides bottom, right, top, left;
     * each handle with the point opposite it (its anchor); null without a
     * selection
     */
    function transformBox(){
        const b = mEditor.selectionBox();
        if (!b) return null;
        const m = BOX_MARGIN_PX*mView.pixelSize();
        const x0 = b[0] - m, y0 = b[1] - m, x1 = b[2] + m, y1 = b[3] + m;
        const cx = 0.5*(x0 + x1), cy = 0.5*(y0 + y1);
        const handles = [
            { i: 0, kind: 'corner', world: [x0, y0], anchor: [x1, y1] },
            { i: 1, kind: 'corner', world: [x1, y0], anchor: [x0, y1] },
            { i: 2, kind: 'corner', world: [x1, y1], anchor: [x0, y0] },
            { i: 3, kind: 'corner', world: [x0, y1], anchor: [x1, y0] },
            { i: 4, kind: 'side', axis: 'y', world: [cx, y0], anchor: [cx, y1] },
            { i: 5, kind: 'side', axis: 'x', world: [x1, cy], anchor: [x0, cy] },
            { i: 6, kind: 'side', axis: 'y', world: [cx, y1], anchor: [cx, y0] },
            { i: 7, kind: 'side', axis: 'x', world: [x0, cy], anchor: [x1, cy] },
        ];
        return { box: [x0, y0, x1, y1], centre: [cx, cy], handles };
    }

    /** the transform handle under the canvas point, with the box: {handle, box} or null */
    function transformHandleUnder(canvas){
        const tb = transformBox();
        if (!tb) return null;
        let best = null, bestD = HANDLE_PX;
        for (const h of tb.handles) {
            const c = mView.toCanvas(h.world);
            const d = Math.hypot(c[0] - canvas[0], c[1] - canvas[1]);
            if (d <= bestD) { bestD = d; best = h; }
        }
        return best ? { handle: best, box: tb } : null;
    }

    /**
     * the map of the seen world a drag of a transform handle to the pointer
     * at p stands for: in scale mode a scaling about the handle's anchor
     * (Shift: about the centre; Ctrl: the same both ways), in rotate mode
     * a corner turns about the centre (Shift: about the anchor; Ctrl: 15
     * degree steps) and a side skews along itself about the opposite side
     */
    function transformMap(drag, p, e){
        const h = drag.handle, box = drag.box;
        const pivot = e.shiftKey ? (drag.mode === 'rotate' ? h.anchor : box.centre) : (drag.mode === 'rotate' ? box.centre : h.anchor);
        if (drag.mode === 'rotate') {
            if (h.kind === 'corner') {
                let a = Math.atan2(p[1] - pivot[1], p[0] - pivot[0]) - Math.atan2(h.world[1] - pivot[1], h.world[0] - pivot[0]);
                if (e.ctrlKey) a = Math.round(a/ANGLE_STEP)*ANGLE_STEP;
                const c = Math.cos(a), s = Math.sin(a);
                return q => [pivot[0] + c*(q[0] - pivot[0]) - s*(q[1] - pivot[1]), pivot[1] + s*(q[0] - pivot[0]) + c*(q[1] - pivot[1])];
            }
            // a side: a shear along it, the opposite side fixed
            const a = h.anchor;
            if (h.axis === 'y') { const k = (p[0] - h.world[0])/(h.world[1] - a[1]); return q => [q[0] + k*(q[1] - a[1]), q[1]]; }
            const k = (p[1] - h.world[1])/(h.world[0] - a[0]);
            return q => [q[0], q[1] + k*(q[0] - a[0])];
        }
        const factor = (axis) => { const d = h.world[axis] - pivot[axis]; const s = Math.abs(d) > 1e-12 ? (p[axis] - pivot[axis])/d : 1; return Math.abs(s) < MIN_SCALE ? (s < 0 ? -MIN_SCALE : MIN_SCALE) : s; };
        let sx = (h.kind === 'corner' || h.axis === 'x') ? factor(0) : 1;
        let sy = (h.kind === 'corner' || h.axis === 'y') ? factor(1) : 1;
        if (e.ctrlKey) {
            // the same amount both ways: a corner's larger factor, a side's own; each axis keeps its sign
            const mag = Math.abs((h.kind === 'corner') ? (Math.abs(sx) >= Math.abs(sy) ? sx : sy) : (h.axis === 'x' ? sx : sy));
            sx = (h.kind === 'corner' || h.axis === 'x') ? Math.sign(sx)*mag : mag;
            sy = (h.kind === 'corner' || h.axis === 'y') ? Math.sign(sy)*mag : mag;
        }
        return q => [pivot[0] + sx*(q[0] - pivot[0]), pivot[1] + sy*(q[1] - pivot[1])];
    }

    /** the vertices with handles: a path's nodes, else the points */
    function itemVertices(item){
        return item.nodes ? item.nodes.flatMap(n => n.p) : item.points;
    }

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

    /**
     * a control handle of the picked node (of a path) under the canvas
     * point, when the node itself is not nearer: {sel, vertex, which} or null
     */
    function handleUnder(canvas){
        const pv = mEditor.getSelectedVertex();
        if (!pv) return null;
        const sel = mEditor.getSelection().find(s => s.id === pv.id);
        const item = sel && mDoc.getItem(sel.id);
        const node = item && item.nodes && item.nodes[pv.vertex];
        if (!node) return null;
        const at = q => mView.toCanvas(mEditor.mapWorld(sel.frameInv, q));
        const dist = q => { const c = at(q); return Math.hypot(c[0] - canvas[0], c[1] - canvas[1]); };
        let best = null, bestD = Math.min(HANDLE_PX, dist(node.p));
        for (const which of ['h1', 'h2']) {
            if (!node[which]) continue;
            const d = dist(node[which]);
            if (d < bestD) { bestD = d; best = { sel, vertex: pv.vertex, which }; }
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
     * the segment of a selected item under the canvas point: {sel, index, t}
     * or null; on a path the segment between two nodes, found along its
     * flattened outline, t where on it
     */
    function segmentUnder(canvas){
        let best = null, bestD = SEGMENT_PX;
        for (const sel of mEditor.getSelection()) {
            const item = mDoc.getItem(sel.id);
            if (!item) continue;
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

    function withPoints(item, points){
        return { ...item, points };
    }

    /** the item moved by (dx, dy), its children with it */
    function movedItem(item, dx, dy){
        // a tile stays on the domain, its interior moves
        if (item.tile) return item;
        const out = item.nodes ? withNodes(item, movedNodes(item.nodes, dx, dy))
                               : withPoints(item, item.points.map((v, i) => v + (i % 2 ? dy : dx)));
        if (item.children) out.children = item.children.map(c => movedItem(c, dx, dy));
        return out;
    }

    function removeVertex(id, vertex){
        const item = mDoc.getItem(id);
        if (!item || item.type === 'image' || itemVertices(item).length/2 <= 2) return;
        const before = itemsMap([id]);
        let changed;
        if (item.tile) {
            changed = tileRemovedVertex(item, vertex, mEditor.pairingMap);
            if (!changed) return;
        } else if (item.nodes) {
            changed = withNodes(item, removeNode(item.nodes, vertex));
        } else {
            const pts = item.points.slice();
            pts.splice(2*vertex, 2);
            changed = withPoints(item, pts);
        }
        const after = new Map([[id, changed]]);
        mEditor.applyReplace(after);
        mEditor.pushReplace('remove vertex', before, after);
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

    /** a vertex on segment index (after vertex index): at the world point w, on a path at the segment's parameter t */
    function insertVertex(sel, index, w, t = 0.5){
        const item = mDoc.getItem(sel.id);
        if (item.type === 'image') return;
        const x = mEditor.mapWorld(sel.frame, w);
        const before = itemsMap([sel.id]);
        let changed;
        if (item.tile) {
            changed = tileInsertedVertex(item, index, x, mEditor.pairingMap);
            if (!changed) return;
        } else if (item.nodes) {
            changed = withNodes(item, splitSegment(item.nodes, item.closed, index, t));
        } else {
            const pts = item.points.slice();
            pts.splice(2*(index + 1), 0, x[0], x[1]);
            changed = withPoints(item, pts);
        }
        const after = new Map([[sel.id, changed]]);
        mEditor.applyReplace(after);
        mEditor.pushReplace('add vertex', before, after);
        mEditor.setSelectedVertex({ id: sel.id, vertex: index + 1 });
    }

    /** move every selected item by the pointer's step from w0 to w1, mapped through its frame */
    function moveSelection(before, w0, w1){
        const after = new Map();
        for (const sel of mEditor.getSelection()) {
            const item = before.get(sel.id);
            if (!item) continue;
            const a = mEditor.mapWorld(sel.frame, w0), b = mEditor.mapWorld(sel.frame, w1);
            const dx = b[0] - a[0], dy = b[1] - a[1];
            after.set(sel.id, movedItem(item, dx, dy));
        }
        mEditor.applyReplace(after);
        return after;
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
            const v = vertexUnder(canvas);
            if (v) {
                if (e.altKey) { removeVertex(v.sel.id, v.vertex); break; }
                mEditor.setSelectedVertex({ id: v.sel.id, vertex: v.vertex });
                // a tile's corners and mirror sides stay where the group puts them
                const picked = mDoc.getItem(v.sel.id);
                if (picked && picked.tile && tileVertexFixed(picked.tile, v.vertex)) break;
                // Shift on a node of a path: new handles pulled out of it
                if (e.shiftKey && picked && picked.nodes) {
                    mDrag = { kind: 'pull', sel: v.sel, vertex: v.vertex, before: itemsMap([v.sel.id]), canvas, moved: false };
                    break;
                }
                // the dragged vertex, and on a tile the one following it, are no snap targets
                const vertices = [v.vertex];
                if (picked && picked.tile) { const pv = tilePairedVertex(picked.tile, v.vertex); if (pv !== null) vertices.push(pv); }
                mDrag = { kind: 'vertex', sel: v.sel, vertex: v.vertex, vertices, drag: ++mDragCount, before: itemsMap([v.sel.id]), canvas, moved: false };
                break;
            }
            // a handle of the transform box
            const th = transformHandleUnder(canvas);
            if (th) {
                mDrag = { kind: 'transform', handle: th.handle, box: th.box, mode: mTransformMode,
                          before: itemsMap(mEditor.getSelection().map(s => s.id)), canvas, moved: false };
                break;
            }
            const hit = mEditor.hitTest(e.wpnt);
            if (hit) {
                const entry = { id: hit.item.id, frame: hit.frame, frameInv: hit.frameInv };
                const wasSelected = mEditor.isSelected(entry.id);
                if (e.shiftKey) {
                    const sel = mEditor.getSelection();
                    mEditor.setSelection(wasSelected ? sel.filter(s => s.id !== entry.id) : [...sel, entry]);
                } else if (!wasSelected) {
                    mEditor.setSelection([entry]);
                } else {
                    // a selected item clicked on this or another copy: it is
                    // edited on that copy, the rest of the selection stays
                    mEditor.setSelection(mEditor.getSelection().map(s => s.id === entry.id ? entry : s));
                }
                mDrag = { kind: 'move', w0: e.wpnt, before: itemsMap(mEditor.getSelection().map(s => s.id)), canvas, moved: false,
                          wasSelected: wasSelected && !e.shiftKey };
            } else if (!e.shiftKey) {
                mEditor.clearSelection();
            }
            break;
        }
        case 'pointermove':
            if (!mDrag || !(e.buttons & 1)) break;
            e.isConsumed = true;
            if (!mDrag.moved && Math.hypot(canvas[0] - mDrag.canvas[0], canvas[1] - mDrag.canvas[1]) < DRAG_PX) break;
            mDrag.moved = true;
            if (mDrag.kind === 'vertex') {
                const target = mEditor.snap(e.wpnt, { itemId: mDrag.sel.id, vertex: mDrag.vertex, vertices: mDrag.vertices, drag: mDrag.drag });
                mSnapTarget = target;
                const w = target ? target.wpnt : e.wpnt;
                const x = mEditor.mapWorld(mDrag.sel.frame, w);
                const item = mDrag.before.get(mDrag.sel.id);
                const pts = item.points.slice();
                if (item.type === 'image') {
                    // a corner of an image scales it about the opposite corner
                    const o = 2*((mDrag.vertex + 2) % 4), k = 2*mDrag.vertex;
                    const d0 = Math.hypot(pts[k] - pts[o], pts[k + 1] - pts[o + 1]);
                    const s = d0 > 0 ? Math.hypot(x[0] - pts[o], x[1] - pts[o + 1])/d0 : 1;
                    for (let i = 0; i < 8; i += 2) { pts[i] = pts[o] + s*(item.points[i] - pts[o]); pts[i + 1] = pts[o + 1] + s*(item.points[i + 1] - pts[o + 1]); }
                } else {
                    pts[2*mDrag.vertex] = x[0];
                    pts[2*mDrag.vertex + 1] = x[1];
                }
                // a tile's edge takes its paired edge along; a path's node its handles
                const moved = item.tile ? tileMovedVertex(item, mDrag.vertex, x, mEditor.pairingMap)
                            : item.nodes ? withNodes(item, nodeMoved(item.nodes, mDrag.vertex, x))
                            : withPoints(item, pts);
                if (!moved) break;
                mDrag.after = new Map([[mDrag.sel.id, moved]]);
                mEditor.applyReplace(mDrag.after);
            } else if (mDrag.kind === 'transform') {
                mDrag.after = mEditor.transformedSelection(mDrag.before, transformMap(mDrag, e.wpnt, e));
                mEditor.applyReplace(mDrag.after);
            } else if (mDrag.kind === 'handle' || mDrag.kind === 'pull') {
                const item = mDrag.before.get(mDrag.sel.id);
                const x = mEditor.mapWorld(mDrag.sel.frame, e.wpnt);
                const nodes = mDrag.kind === 'pull' ? nodeHandlesPulled(item.nodes, mDrag.vertex, x)
                                                    : handleMoved(item.nodes, mDrag.vertex, mDrag.which, x, !mDrag.alt);
                mDrag.after = new Map([[mDrag.sel.id, withNodes(item, nodes)]]);
                mEditor.applyReplace(mDrag.after);
            } else {
                mDrag.after = moveSelection(mDrag.before, mDrag.w0, e.wpnt);
            }
            mRepaint();
            break;
        case 'pointerup':
            if (!mDrag) break;
            e.isConsumed = true;
            if (mDrag.moved && mDrag.after) {
                const label = { vertex: 'move vertex', handle: 'handle', pull: 'handles', move: 'move',
                                transform: mDrag.mode === 'rotate' ? (mDrag.handle.kind === 'corner' ? 'rotate' : 'skew') : 'scale' }[mDrag.kind] || 'move';
                mEditor.pushReplace(label, mDrag.before, mDrag.after);
            } else if (mDrag.kind === 'move' && mDrag.wasSelected) {
                // a click on the selection: the transform handles change their job
                mTransformMode = mTransformMode === 'scale' ? 'rotate' : 'scale';
            }
            mDrag = null;
            mSnapTarget = null;
            mRepaint();
            break;
        case 'dblclick': {
            // a node of a path: smooth or a corner
            const dv = vertexUnder(canvas);
            const dItem = dv && mDoc.getItem(dv.sel.id);
            if (dItem && dItem.nodes) {
                e.preventDefault();
                e.isConsumed = true;
                toggleSmooth(dv.sel.id, dv.vertex);
                break;
            }
            const s = segmentUnder(canvas);
            if (s && !vertexUnder(canvas)) {
                e.preventDefault();
                e.isConsumed = true;
                insertVertex(s.sel, s.index, e.wpnt, s.t);
                break;
            }
            // a closed item: edit inside it; nothing: leave the container
            const hit = mEditor.hitTest(e.wpnt);
            if (hit && !hit.parent && hit.item.closed && hit.item.type !== 'image') mEditor.enterContainer(hit.item.id, hit.frame, hit.frameInv);
            else if (!hit) mEditor.leaveContainer();
            e.preventDefault();
            e.isConsumed = true;
            break;
        }
        default:
            break;
        }
    }

    function nudge(dx, dy){
        const sel = mEditor.getSelection();
        if (!sel.length) return;
        const ids = sel.map(s => s.id);
        const before = itemsMap(ids);
        const after = new Map();
        for (const s of sel) {
            const item = before.get(s.id);
            const c0 = vertexCanvasPoints(s)[0];
            if (!item || !c0) continue;
            const w0 = mView.toWorld(c0).pnt, w1 = mView.toWorld([c0[0] + dx, c0[1] + dy]).pnt;
            const a = mEditor.mapWorld(s.frame, w0), b = mEditor.mapWorld(s.frame, w1);
            after.set(s.id, movedItem(item, b[0] - a[0], b[1] - a[1]));
        }
        mEditor.applyReplace(after);
        mEditor.pushReplace('nudge', before, after, 'nudge');
    }

    function handleKey(e){
        if (e.type !== 'keydown') return;
        if (mEditor.handleCommonKey(e)) { e.isConsumed = true; return; }
        const ctrl = e.ctrlKey || e.metaKey;
        const step = e.shiftKey ? 10 : 1;
        switch (e.key) {
        case 'Delete':
        case 'Backspace': {
            const v = mEditor.getSelectedVertex();
            if (v) removeVertex(v.id, v.vertex);
            else mEditor.removeItems(mEditor.getSelection().map(s => s.id));
            e.isConsumed = true;
            break;
        }
        case 'Escape':
            if (mEditor.getSelection().length) mEditor.clearSelection(); else mEditor.leaveContainer();
            e.isConsumed = true;
            break;
        case 'PageUp':   mEditor.reorderSelection(ctrl ? 'top' : 'up'); e.isConsumed = true; break;
        case 'PageDown': mEditor.reorderSelection(ctrl ? 'bottom' : 'down'); e.isConsumed = true; break;
        case 'Home':     mEditor.reorderSelection('top'); e.isConsumed = true; break;
        case 'End':      mEditor.reorderSelection('bottom'); e.isConsumed = true; break;
        case 'c': case 'C':
            if (ctrl && mEditor.getSelection().length) { mEditor.copySelection(); e.isConsumed = true; }
            break;
        case 'v': case 'V':
            if (ctrl && mEditor.hasClipboard()) { mEditor.pasteClipboard(); e.isConsumed = true; }
            break;
        case 'd': case 'D':
            if (ctrl && mEditor.getSelection().length) { mEditor.duplicateSelection(); e.isConsumed = true; }
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
    //  the selection on the copies it was picked on, its vertex handles and
    //  the snap target
    //
    /** the transform box and its handles: squares to scale, round ones to rotate and skew */
    function drawTransformBox(ctx){
        const tb = transformBox();
        if (!tb) return;
        const [x0, y0, x1, y1] = tb.box;
        const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(w => mView.toCanvas(w));
        ctx.save();
        ctx.beginPath();
        corners.forEach((c, i) => i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1]));
        ctx.closePath();
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(20,60,200,0.6)';
        ctx.stroke();
        ctx.restore();
        for (const h of tb.handles) mEditor.drawHandle(ctx, mView.toCanvas(h.world), false, mTransformMode === 'rotate');
        if (mTransformMode === 'rotate') {
            const c = mView.toCanvas(tb.centre);
            ctx.save();
            ctx.strokeStyle = 'rgba(20,60,200,0.9)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(c[0] - 5, c[1]); ctx.lineTo(c[0] + 5, c[1]);
            ctx.moveTo(c[0], c[1] - 5); ctx.lineTo(c[0], c[1] + 5);
            ctx.stroke();
            ctx.restore();
        }
    }

    function renderUI(ctx){
        mEditor.drawContainer(ctx);
        drawTransformBox(ctx);
        const pickedVertex = mEditor.getSelectedVertex();
        for (const sel of mEditor.getSelection()) {
            const item = mDoc.getItem(sel.id);
            if (!item) continue;
            mEditor.drawOutline(ctx, mEditor.itemCanvasPath(item, sel.frameInv));
            vertexCanvasPoints(sel).forEach((c, vertex) => mEditor.drawHandle(ctx, c,
                !!pickedVertex && pickedVertex.id === sel.id && pickedVertex.vertex === vertex,
                !!(item.tile && tileVertexFixed(item.tile, vertex)) || !!(item.nodes && item.nodes[vertex] && item.nodes[vertex].smooth)));
            // the control handles of the picked node
            const node = pickedVertex && pickedVertex.id === sel.id && item.nodes ? item.nodes[pickedVertex.vertex] : null;
            if (node) {
                const c = mView.toCanvas(mEditor.mapWorld(sel.frameInv, node.p));
                for (const h of [node.h1, node.h2]) if (h) mEditor.drawControlHandle(ctx, c, mView.toCanvas(mEditor.mapWorld(sel.frameInv, h)));
            }
        }
        mEditor.drawSnap(ctx, mSnapTarget);
    }

    return {
        name:      'select',
        title:     'select: click any copy, Shift adds, drag moves, the box handles scale (click the selection: rotate and skew), drag a vertex, double click adds a vertex, Alt+click or Delete removes, arrows nudge, Ctrl+C/V/D copy, paste, duplicate, PageUp/PageDown raise, lower',
        icon:      ICON,
        cursor:    'default',
        handleEvent,
        handleKey,
        renderUI,
        setActive: (active) => { if (!active) { mDrag = null; mSnapTarget = null; } },
    };

} // function SelectTool()

export { SelectTool };
