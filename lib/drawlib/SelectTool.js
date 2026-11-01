//
//  SelectTool - selects, moves, transforms and groups whole items on any of
//  their copies; the node tool (NodeTool.js) edits their nodes and a
//  shape's numbers, on the same selection
//
//    click an item (any copy)   select it, with the frame of that copy; a
//                               selected item clicked on another copy moves
//                               its box there
//    Shift+click                add to or remove from the selection
//    drag                       move the selection
//    the transform box          a dashed box round the selection with eight
//                               handles: drag one to scale about the pivot,
//                               a corner both ways, a side one way (Ctrl:
//                               the same both ways); a click on the
//                               selection turns them round: a corner then
//                               rotates about the pivot (Ctrl: 15 degree
//                               steps) and a side shears; Shift: about the
//                               handle opposite instead of the pivot
//    the pivot (a circled cross) the box's centre until dragged, and fixed
//                               there once a handle is used: it snaps to the
//                               box's handles, the vertices of all copies,
//                               mirrors and cone points; a single item keeps
//                               its pivot (saved with it, moved with it);
//                               Alt+click puts it back at the centre
//    Ctrl+C, Ctrl+V, Ctrl+D     copy, paste (where new items go), duplicate
//    Ctrl+G, Ctrl+Shift+G       group the selection, take groups apart; a
//                               group is picked as a whole, a double click
//                               edits inside it
//    PageUp, PageDown           raise, lower (Ctrl: to the top, the bottom;
//                               Home, End too; Shift: to the layer above or
//                               below, hidden or locked too)
//    a tile (Tiles.js)          stays where the domain puts it
//    double click a closed item edit inside it: new items go into it, its
//                               items are picked (Escape, or a double click
//                               on nothing, leaves)
//    Delete, Backspace          remove the selection
//    arrows (Shift: x10)        nudge the selection by a pixel
//    Ctrl+A                     select all, Escape: nothing
//    right click                the menu of the commands on the selection
//                               (DrawingCommands.js); the item under the
//                               pointer is selected first
//    Ctrl+Z, Ctrl+Y             undo, redo
//
//  A drag maps the pointer through the frame of each item's copy, so the item
//  moves under the pointer on that copy whatever the map of the group is.
//

import {
    withNodes,
    movedNodes,
    mappedAxes,
    itemCentre,
    drawTransformFrame,
    drawTransformPivot,
    drawTransformCorners,
    drawTransformSquares,
    snapProperty,
    DrawingCommands,
} from './modules.js';

const ICON = new URL('./res/btn_select.svg', import.meta.url).pathname;
// what the tool does, in its tooltip and the property bar's hint
const HELP = 'click any copy, Shift adds, drag moves; the box\'s corners turn and scale about the pivot (Ctrl: 15 degree steps), its sides stretch and shear (Ctrl: stretch only, Alt: shear only), Shift works about the opposite handle; the box turns with the shape, Alt+click on a handle puts it straight; the pivot drags and snaps, Alt+click resets it; Delete removes, arrows nudge, Ctrl+C/V/D copy, paste, duplicate, PageUp/PageDown raise, lower, Shift+PageUp/PageDown to the layer above, below; the node tool (N) edits nodes and a shape\'s numbers';
const BOX_HANDLE_PX = 10;   // reach of the transform box's handles and pivot (drawn 7 px wide)
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
    let mPivot = null;             // the pivot moved off the box's centre: {key (the selection it belongs to), world}
    let mAxes = null;              // the box's axes turned by a transform of several items: {key, axes [ux, uy, vx, vy]} (seen world)

    function selectionKey(){
        return mEditor.getSelection().map(s => s.id).join(',');
    }

    const WORLD_AXES = [1, 0, 0, 1];
    const isWorldAxes = (a) => Math.abs(a[0] - 1) < 1e-9 && Math.abs(a[1]) < 1e-9 && Math.abs(a[2]) < 1e-9 && Math.abs(a[3] - 1) < 1e-9;

    /**
     * the box's axes in the seen world, [ux, uy, vx, vy]: the ones the
     * transforms of this selection turned, else a single item's own
     * (kept with it, in its coordinates, carried onto the copy it was
     * picked on through that copy's frame), else the world's
     */
    function boxAxes(){
        if (mAxes && mAxes.key === selectionKey()) return mAxes.axes;
        const sel = mEditor.getSelection();
        if (sel.length === 1) {
            const item = mDoc.getItem(sel[0].id);
            if (item && item.axes) return mappedAxes(w => mEditor.mapWorld(sel[0].frameInv, w), item.pivot || itemCentre(item), item.axes);
        }
        return WORLD_AXES;
    }

    /**
     * the transform box of the selection as seen: the box round the
     * outlines along its axes, BOX_MARGIN_PX outside them, with its
     * corners 0..3 from the bottom left counterclockwise (in the axes'
     * sense) and its eight handles, corners then the sides bottom, right,
     * top, left, each with the point opposite it (its anchor), and the
     * pivot of the transforms (the centre unless it was moved); during a
     * handle's drag the box the drag started from, mapped along with the
     * selection; null without a selection
     */
    function transformBox(){
        if (mDrag && mDrag.kind === 'transform' && mDrag.map) return mappedBox(mDrag.box, mDrag.map);
        const axes = boxAxes();
        const b = mEditor.selectionBox(axes);
        if (!b) return null;
        const m = BOX_MARGIN_PX*mView.pixelSize();
        const x0 = b[0] - m, y0 = b[1] - m, x1 = b[2] + m, y1 = b[3] + m;
        const cx = 0.5*(x0 + x1), cy = 0.5*(y0 + y1);
        const W = (x, y) => [x*axes[0] + y*axes[2], x*axes[1] + y*axes[3]];
        const centre = W(cx, cy);
        // the pivot: the one being dragged, else a single item's own (kept
        // with it, in its coordinates), else the centre itself (the same array)
        let pivot = centre;
        const sel = mEditor.getSelection();
        if (mPivot && mPivot.key === selectionKey()) pivot = mPivot.world;
        else if (sel.length === 1) {
            const item = mDoc.getItem(sel[0].id);
            if (item && item.pivot) pivot = mEditor.mapWorld(sel[0].frameInv, item.pivot);
        }
        const corners = [W(x0, y0), W(x1, y0), W(x1, y1), W(x0, y1)];
        const handles = [
            { i: 0, kind: 'corner', world: corners[0], anchor: corners[2] },
            { i: 1, kind: 'corner', world: corners[1], anchor: corners[3] },
            { i: 2, kind: 'corner', world: corners[2], anchor: corners[0] },
            { i: 3, kind: 'corner', world: corners[3], anchor: corners[1] },
            { i: 4, kind: 'side', axis: 'y', world: W(cx, y0), anchor: W(cx, y1) },
            { i: 5, kind: 'side', axis: 'x', world: W(x1, cy), anchor: W(x0, cy) },
            { i: 6, kind: 'side', axis: 'y', world: W(cx, y1), anchor: W(cx, y0) },
            { i: 7, kind: 'side', axis: 'x', world: W(x0, cy), anchor: W(x1, cy) },
        ];
        return { box: [x0, y0, x1, y1], axes, corners, centre, pivot, handles };
    }

    /** the box carried along by a map of the seen world: its corners, handles, centre, pivot and axes */
    function mappedBox(box, map){
        return { ...box,
                 corners: box.corners.map(map),
                 handles: box.handles.map(h => ({ ...h, world: map(h.world), anchor: map(h.anchor) })),
                 centre:  map(box.centre),
                 pivot:   map(box.pivot),
                 axes:    mappedAxes(map, box.pivot, box.axes) };
    }

    /** the pivot being dragged written into a single selected item, in its own coordinates; one undo step */
    function commitPivot(){
        const sel = mEditor.getSelection();
        if (sel.length !== 1 || !mPivot) return;
        const item = mDoc.getItem(sel[0].id);
        if (!item || item.tile) return;
        const before = itemsMap([item.id]);
        const after = new Map([[item.id, { ...item, pivot: mEditor.mapWorld(sel[0].frame, mPivot.world) }]]);
        mEditor.applyReplace(after);
        mEditor.pushReplace('pivot', before, after);
        mPivot = null;
    }

    /**
     * after a handle's drag: the pivot and the axes the box has now (the
     * pivot stays unless Shift anchored the drag elsewhere, the axes turn
     * with the selection) kept with a single selected item in its own
     * coordinates (after: the drag's items, the item's entry replaced),
     * else with the selection
     */
    function storeBoxIn(after){
        const key = selectionKey(), map = mDrag.map, box = mDrag.box;
        const pivot = map(mPivot && mPivot.key === key ? mPivot.world : box.pivot);
        const axes = mappedAxes(map, box.pivot, box.axes);
        const sel = mEditor.getSelection();
        const item = sel.length === 1 ? after.get(sel[0].id) : null;
        if (!item || item.tile) {
            mPivot = { key, world: pivot };
            mAxes = { key, axes };
            return;
        }
        const own = mappedAxes(w => mEditor.mapWorld(sel[0].frame, w), map(box.centre), axes);
        after.set(sel[0].id, { ...item, pivot: mEditor.mapWorld(sel[0].frame, pivot), axes: isWorldAxes(own) ? undefined : own });
        mEditor.applyReplace(after);
        mPivot = null;
        mAxes = null;
    }

    /** the box straight again (the world's axes): a single item loses its own; one undo step */
    function resetAxes(){
        mAxes = null;
        const sel = mEditor.getSelection();
        if (sel.length !== 1) { mRepaint(); return; }
        const item = mDoc.getItem(sel[0].id);
        if (!item || !item.axes) { mRepaint(); return; }
        const before = itemsMap([item.id]);
        const after = new Map([[item.id, { ...item, axes: undefined }]]);
        mEditor.applyReplace(after);
        mEditor.pushReplace('box', before, after);
        mRepaint();
    }

    /** the pivot back at the centre: a single item loses its own; one undo step */
    function resetPivot(){
        mPivot = null;
        const sel = mEditor.getSelection();
        if (sel.length !== 1) { mRepaint(); return; }
        const item = mDoc.getItem(sel[0].id);
        if (!item || !item.pivot) { mRepaint(); return; }
        const before = itemsMap([item.id]);
        const after = new Map([[item.id, { ...item, pivot: undefined }]]);
        mEditor.applyReplace(after);
        mEditor.pushReplace('pivot', before, after);
        mRepaint();
    }

    /** is the pivot's marker under the canvas point */
    function pivotUnder(canvas, tb){
        const c = mView.toCanvas(tb.pivot);
        return Math.hypot(c[0] - canvas[0], c[1] - canvas[1]) <= BOX_HANDLE_PX;
    }

    /**
     * where a dragged pivot snaps: the box's handles and centre within
     * BOX_HANDLE_PX, else the vertices of all copies, mirrors and cone points
     * (the editor's snap); {wpnt, kind} or null
     */
    function pivotSnap(w, canvas, tb){
        let best = null, bestD = BOX_HANDLE_PX;
        for (const p of [...tb.handles.map(h => h.world), tb.centre]) {
            const c = mView.toCanvas(p);
            const d = Math.hypot(c[0] - canvas[0], c[1] - canvas[1]);
            if (d <= bestD) { bestD = d; best = { wpnt: p, kind: 'box' }; }
        }
        return best || mEditor.snap(w);
    }

    /** the transform handle under the canvas point, with the box: {handle, box} or null */
    function transformHandleUnder(canvas){
        const tb = transformBox();
        if (!tb) return null;
        let best = null, bestD = BOX_HANDLE_PX;
        for (const h of tb.handles) {
            const c = mView.toCanvas(h.world);
            const d = Math.hypot(c[0] - canvas[0], c[1] - canvas[1]);
            if (d <= bestD) { bestD = d; best = h; }
        }
        return best ? { handle: best, box: tb } : null;
    }

    /**
     * the map of the seen world a drag of a transform handle to the pointer
     * at p stands for, every one about the pivot, which stays put (Shift:
     * about the handle's anchor, the point opposite it), the handle
     * following the pointer as in the pattern transform tool: a corner
     * turns and scales alike both ways (Ctrl: the turn in 15 degree steps,
     * so a drag along the pivot's ray scales only); a side stretches across
     * itself and shears along itself, in the box's axes (Ctrl: the stretch
     * only, Alt: the shear only)
     */
    function transformMap(drag, p, e){
        const h = drag.handle;
        const pivot = e.shiftKey ? h.anchor : drag.box.pivot;
        const clamp = (s) => Math.abs(s) < MIN_SCALE ? (s < 0 ? -MIN_SCALE : MIN_SCALE) : s;
        if (h.kind === 'corner') {
            const r0 = Math.hypot(h.world[0] - pivot[0], h.world[1] - pivot[1]);
            const r1 = Math.hypot(p[0] - pivot[0], p[1] - pivot[1]);
            if (r0 < 1e-12 || r1 < 1e-12) return q => q;
            let a = Math.atan2(p[1] - pivot[1], p[0] - pivot[0]) - Math.atan2(h.world[1] - pivot[1], h.world[0] - pivot[0]);
            if (e.ctrlKey) a = Math.round(a/ANGLE_STEP)*ANGLE_STEP;
            const s = Math.max(r1/r0, MIN_SCALE), c = s*Math.cos(a), sn = s*Math.sin(a);
            return q => [pivot[0] + c*(q[0] - pivot[0]) - sn*(q[1] - pivot[1]), pivot[1] + sn*(q[0] - pivot[0]) + c*(q[1] - pivot[1])];
        }
        // a side, in the box's axes about the pivot: n is the coordinate
        // across it, t the one along it; the line through the pivot along
        // the side stays
        const [ux, uy, vx, vy] = drag.box.axes;
        const det = ux*vy - uy*vx;
        const local = (w) => { const dx = w[0] - pivot[0], dy = w[1] - pivot[1]; return [(vy*dx - vx*dy)/det, (ux*dy - uy*dx)/det]; };
        const n = h.axis === 'x' ? 0 : 1, t = 1 - n;
        const hl = local(h.world), pl = local(p);
        const d = hl[n];
        if (Math.abs(d) < 1e-12) return q => q;
        const s = e.altKey ? 1 : clamp(pl[n]/d);
        const k = e.ctrlKey ? 0 : (pl[t] - hl[t])/d;
        return q => {
            const l = local(q), r = [0, 0];
            r[n] = s*l[n];
            r[t] = l[t] + k*l[n];
            return [pivot[0] + r[0]*ux + r[1]*vx, pivot[1] + r[0]*uy + r[1]*vy];
        };
    }

    function itemsMap(ids){
        return new Map(ids.map(id => [id, JSON.parse(JSON.stringify(mDoc.getItem(id)))]).filter(e => e[1]));
    }

    /** the item moved by (dx, dy), its children with it */
    function movedItem(item, dx, dy){
        // a tile stays on the domain, its interior moves
        if (item.tile) return item;
        const out = item.nodes ? withNodes(item, movedNodes(item.nodes, dx, dy))
                               : { ...item, points: item.points.map((v, i) => v + (i % 2 ? dy : dx)) };
        if (item.shape) out.shape = { ...item.shape, cx: item.shape.cx + dx, cy: item.shape.cy + dy };
        if (item.pivot) out.pivot = [item.pivot[0] + dx, item.pivot[1] + dy];
        if (item.children) out.children = item.children.map(c => movedItem(c, dx, dy));
        return out;
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
            // the pivot: dragged, or put back at the centre with Alt
            const tb = transformBox();
            if (tb && pivotUnder(canvas, tb)) {
                if (e.altKey) { resetPivot(); break; }
                mDrag = { kind: 'pivot', box: tb, canvas, moved: false };
                break;
            }
            // a handle of the transform box (Alt: the box put straight); the pivot is fixed where it is from now on
            const th = transformHandleUnder(canvas);
            if (th) {
                if (e.altKey) { resetAxes(); break; }
                if (!(mPivot && mPivot.key === selectionKey())) mPivot = { key: selectionKey(), world: th.box.pivot };
                mDrag = { kind: 'transform', handle: th.handle, box: th.box,
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
            if (mDrag.kind === 'transform') {
                mDrag.map = transformMap(mDrag, e.wpnt, e);
                mDrag.after = mEditor.transformedSelection(mDrag.before, mDrag.map);
                mEditor.applyReplace(mDrag.after);
            } else if (mDrag.kind === 'pivot') {
                const target = pivotSnap(e.wpnt, canvas, mDrag.box);
                mSnapTarget = target;
                mPivot = { key: selectionKey(), world: target ? target.wpnt : [e.wpnt[0], e.wpnt[1]] };
            } else {
                mDrag.after = moveSelection(mDrag.before, mDrag.w0, e.wpnt);
            }
            mRepaint();
            break;
        case 'pointerup':
            if (!mDrag) break;
            e.isConsumed = true;
            // a dragged pivot is kept with a single item, as are the pivot and the axes of a transform's box
            if (mDrag.kind === 'pivot' && mDrag.moved) commitPivot();
            if (mDrag.kind === 'transform' && mDrag.moved && mDrag.after) storeBoxIn(mDrag.after);
            if (mDrag.moved && mDrag.after) {
                const label = mDrag.kind === 'transform' ? (mDrag.handle.kind === 'corner' ? 'rotate' : 'stretch') : 'move';
                mEditor.pushReplace(label, mDrag.before, mDrag.after);
            }
            // a moved pivot goes along with the selection
            if (mDrag.kind === 'move' && mDrag.moved && mPivot && mPivot.key === selectionKey()) {
                mPivot.world = [mPivot.world[0] + e.wpnt[0] - mDrag.w0[0], mPivot.world[1] + e.wpnt[1] - mDrag.w0[1]];
            }
            mDrag = null;
            mSnapTarget = null;
            mRepaint();
            break;
        case 'dblclick': {
            // a closed item or a group: edit inside it; nothing: leave the container
            const hit = mEditor.hitTest(e.wpnt);
            if (hit && (hit.item.type === 'group' || (!hit.parent && hit.item.closed && hit.item.type !== 'image'))) mEditor.enterContainer(hit.item.id, hit.frame, hit.frameInv);
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
            if (!item) continue;
            // a pixel at the item's centre, on its copy
            const c0 = mView.toCanvas(mEditor.mapWorld(s.frameInv, itemCentre(item)));
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
        case 'Backspace':
            mEditor.removeItems(mEditor.getSelection().map(s => s.id));
            e.isConsumed = true;
            break;
        case 'Escape':
            if (mEditor.getSelection().length) mEditor.clearSelection(); else mEditor.leaveContainer();
            e.isConsumed = true;
            break;
        case 'PageUp':
            if (e.shiftKey) mEditor.moveSelectionToLayer(+1);
            else mEditor.reorderSelection(ctrl ? 'top' : 'up');
            e.isConsumed = true;
            break;
        case 'PageDown':
            if (e.shiftKey) mEditor.moveSelectionToLayer(-1);
            else mEditor.reorderSelection(ctrl ? 'bottom' : 'down');
            e.isConsumed = true;
            break;
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
        case 'g': case 'G':
            if (ctrl && mEditor.getSelection().length) { if (e.shiftKey) mEditor.ungroupSelection(); else mEditor.groupSelection(); e.isConsumed = true; }
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
    //  the selection on the copies it was picked on, its transform box and
    //  the snap target of the pivot
    //
    /**
     * the transform box and its handles, drawn as the pattern transform
     * tool's: a solid frame (white under black, seen on any background),
     * black discs at the corners (turn and scale), black squares at the
     * sides (stretch and shear), the pivot a ringed dot with crosshairs
     */
    function drawTransformBox(ctx){
        const tb = transformBox();
        if (!tb) return;
        const corners = tb.corners.map(w => mView.toCanvas(w));
        const sides = tb.handles.filter(h => h.kind === 'side').map(h => mView.toCanvas(h.world));
        drawTransformFrame(ctx, corners);
        const c = mView.toCanvas(tb.pivot);
        drawTransformPivot(ctx, c[0], c[1]);
        drawTransformCorners(ctx, corners);
        drawTransformSquares(ctx, sides);
    }

    function renderUI(ctx){
        mEditor.drawContainer(ctx);
        drawTransformBox(ctx);
        for (const sel of mEditor.getSelection()) {
            const item = mDoc.getItem(sel.id);
            if (item) mEditor.drawOutline(ctx, mEditor.itemCanvasPath(item, sel.frameInv));
        }
        mEditor.drawSnap(ctx, mSnapTarget);
    }

    // the commands on the selection, as buttons and menus of the property bar
    const mCommands = DrawingCommands(mEditor);

    /** the menu of a right click: the shape under the pointer is selected
     *  first, unless it is already, then the commands on the selection */
    function getContextMenu(e){
        const hit = e.wpnt ? mEditor.hitTest(e.wpnt) : null;
        if (hit && !mEditor.isSelected(hit.item.id)) mEditor.setSelection([{ id: hit.item.id, frame: hit.frame, frameInv: hit.frameInv }]);
        return mCommands.menuItems(['group', 'ungroup', '-', 'flipH', 'flipV', 'rotateLeft', 'rotateRight',
                                    '-', 'raise', 'lower', 'toTop', 'toBottom', 'toLayerAbove', 'toLayerBelow',
                                    '-', 'duplicate', 'copy', 'paste', 'delete', '-', 'selectAll']);
    }

    /** the property bar, in groups that wrap into rows: snap and the menus;
     *  while items are selected grouping, flips and turns, the order (a
     *  shape's own numbers are the node tool's, the style the style panel's) */
    function getProperties(){
        const sel = { visible: mCommands.anySelected };
        const b = (id) => mCommands.button(id);
        return [
            { kind: 'group', controls: [
                snapProperty(mEditor),
                { kind: 'menu', icon: mCommands.icon('align'), title: 'align and spread, as seen on their copies', ...sel,
                  items: () => mCommands.menuItems(['alignLeft', 'alignCentre', 'alignRight', '-', 'alignTop', 'alignMiddle', 'alignBottom',
                                                    '-', 'spreadH', 'spreadV']) },
                { kind: 'menu', icon: mCommands.icon('menu'), title: 'duplicate, copy, paste, delete, select all',
                  items: () => mCommands.menuItems(['duplicate', 'copy', 'paste', '-', 'delete', 'selectAll']) },
            ] },
            { kind: 'group', title: 'group', ...sel, controls: [b('group'), b('ungroup')] },
            { kind: 'group', title: 'flip and turn', ...sel, controls: [b('flipH'), b('flipV'), b('rotateLeft'), b('rotateRight')] },
            { kind: 'group', title: 'order', ...sel, controls: [b('raise'), b('lower'), b('toTop'), b('toBottom'), b('toLayerAbove'), b('toLayerBelow')] },
        ];
    }

    return {
        name:      'select',
        label:     'Select',
        key:       'V',
        group:     'edit',
        title:     'select: ' + HELP,
        help:      HELP,
        icon:      ICON,
        cursor:    'default',
        handleEvent,
        handleKey,
        renderUI,
        getProperties,
        getContextMenu,
        // the node tool's picked node is not this tool's
        setActive: (active) => { if (active) mEditor.setSelectedVertex(null); else { mDrag = null; mSnapTarget = null; } },
        // the transform box's state, for tests
        getTransformBox: transformBox,
    };

} // function SelectTool()

export { SelectTool };
