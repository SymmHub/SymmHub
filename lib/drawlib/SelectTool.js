//
//  SelectTool - selects, moves and reshapes items on any of their copies
//
//    click an item (any copy)   select it, with the frame of that copy; a
//                               selected item clicked on another copy moves
//                               its handles there
//    Shift+click                add to or remove from the selection
//    drag                       move the selection
//    drag a vertex handle       move the vertex (snapped to the vertices of
//                               all copies, mirrors and cone points); a
//                               corner of an image scales the image
//    double click a segment     add a vertex there
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

const ICON = new URL('./res/btn_select.svg', import.meta.url).pathname;
const HANDLE_PX = 7;        // reach of a vertex handle
const SEGMENT_PX = 6;       // reach of a segment for adding a vertex
const DRAG_PX = 2;          // a press moving less is a click

function SelectTool(par) {

    const mEditor = par.editor;
    const mView = mEditor.view;
    const mDoc = mEditor.document;
    const mRepaint = mEditor.repaint;

    let mDrag = null;
    let mSnapTarget = null;

    /** canvas points of the vertices of a selected item, on its copy */
    function vertexCanvasPoints(sel){
        const item = mDoc.getItem(sel.id);
        if (!item) return [];
        const pts = [];
        for (let i = 0; i + 1 < item.points.length; i += 2) {
            pts.push(mView.toCanvas(mEditor.mapWorld(sel.frameInv, [item.points[i], item.points[i + 1]])));
        }
        return pts;
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

    /** the segment of a selected item under the canvas point: {sel, index} or null */
    function segmentUnder(canvas){
        let best = null, bestD = SEGMENT_PX;
        for (const sel of mEditor.getSelection()) {
            const item = mDoc.getItem(sel.id);
            const c = vertexCanvasPoints(sel);
            const n = c.length, segs = item.closed ? n : n - 1;
            for (let i = 0; i < segs; i++) {
                const a = c[i], b = c[(i + 1) % n];
                const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx*dx + dy*dy;
                const t = len2 > 0 ? Math.max(0, Math.min(1, ((canvas[0] - a[0])*dx + (canvas[1] - a[1])*dy)/len2)) : 0;
                const d = Math.hypot(a[0] + t*dx - canvas[0], a[1] + t*dy - canvas[1]);
                if (d <= bestD) { bestD = d; best = { sel, index: i }; }
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
        const out = withPoints(item, item.points.map((v, i) => v + (i % 2 ? dy : dx)));
        if (item.children) out.children = item.children.map(c => movedItem(c, dx, dy));
        return out;
    }

    function removeVertex(id, vertex){
        const item = mDoc.getItem(id);
        if (!item || item.type === 'image' || item.points.length/2 <= 2) return;
        const before = itemsMap([id]);
        const pts = item.points.slice();
        pts.splice(2*vertex, 2);
        const after = new Map([[id, withPoints(item, pts)]]);
        mEditor.applyReplace(after);
        mEditor.pushReplace('remove vertex', before, after);
        mEditor.setSelectedVertex(null);
    }

    function insertVertex(sel, index, w){
        const item = mDoc.getItem(sel.id);
        if (item.type === 'image') return;
        const x = mEditor.mapWorld(sel.frame, w);
        const before = itemsMap([sel.id]);
        const pts = item.points.slice();
        pts.splice(2*(index + 1), 0, x[0], x[1]);
        const after = new Map([[sel.id, withPoints(item, pts)]]);
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
            const v = vertexUnder(canvas);
            if (v) {
                if (e.altKey) { removeVertex(v.sel.id, v.vertex); break; }
                mEditor.setSelectedVertex({ id: v.sel.id, vertex: v.vertex });
                mDrag = { kind: 'vertex', sel: v.sel, vertex: v.vertex, before: itemsMap([v.sel.id]), canvas, moved: false };
                break;
            }
            const hit = mEditor.hitTest(e.wpnt);
            if (hit) {
                const entry = { id: hit.item.id, frame: hit.frame, frameInv: hit.frameInv };
                if (e.shiftKey) {
                    const sel = mEditor.getSelection();
                    mEditor.setSelection(mEditor.isSelected(entry.id) ? sel.filter(s => s.id !== entry.id) : [...sel, entry]);
                } else if (!mEditor.isSelected(entry.id)) {
                    mEditor.setSelection([entry]);
                } else {
                    // a selected item clicked on this or another copy: it is
                    // edited on that copy, the rest of the selection stays
                    mEditor.setSelection(mEditor.getSelection().map(s => s.id === entry.id ? entry : s));
                }
                mDrag = { kind: 'move', w0: e.wpnt, before: itemsMap(mEditor.getSelection().map(s => s.id)), canvas, moved: false };
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
                const target = mEditor.snap(e.wpnt, { itemId: mDrag.sel.id, vertex: mDrag.vertex });
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
                mDrag.after = new Map([[mDrag.sel.id, withPoints(item, pts)]]);
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
                mEditor.pushReplace(mDrag.kind === 'vertex' ? 'move vertex' : 'move', mDrag.before, mDrag.after);
            }
            mDrag = null;
            mSnapTarget = null;
            mRepaint();
            break;
        case 'dblclick': {
            const s = segmentUnder(canvas);
            if (s && !vertexUnder(canvas)) {
                e.preventDefault();
                e.isConsumed = true;
                insertVertex(s.sel, s.index, e.wpnt);
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
    function renderUI(ctx){
        mEditor.drawContainer(ctx);
        const pickedVertex = mEditor.getSelectedVertex();
        for (const sel of mEditor.getSelection()) {
            const item = mDoc.getItem(sel.id);
            if (!item) continue;
            mEditor.drawOutline(ctx, mEditor.itemCanvasPath(item, sel.frameInv));
            vertexCanvasPoints(sel).forEach((c, vertex) => mEditor.drawHandle(ctx, c,
                !!pickedVertex && pickedVertex.id === sel.id && pickedVertex.vertex === vertex));
        }
        mEditor.drawSnap(ctx, mSnapTarget);
    }

    return {
        name:      'select',
        title:     'select: click any copy, Shift adds, drag moves, drag a vertex, double click adds a vertex, Alt+click or Delete removes, arrows nudge',
        icon:      ICON,
        cursor:    'default',
        handleEvent,
        handleKey,
        renderUI,
        setActive: (active) => { if (!active) { mDrag = null; mSnapTarget = null; } },
    };

} // function SelectTool()

export { SelectTool };
