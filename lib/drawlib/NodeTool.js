//
//  NodeTool - edits the details of the selected items on any of their
//  copies: the nodes of paths and polylines, the vertices of tiles, the
//  numbers of shapes. The select tool (SelectTool.js) moves, transforms and
//  groups whole items; the two share the editor's selection. With tilesOnly
//  (the Tile tool's canvas, TileTool.js) it picks and edits tiles alone,
//  other items letting a click through, without break, join and close, the
//  picture moved in its frame or an item entered.
//
//    click an item (any copy)   select it, with the frame of that copy, and
//                               show its nodes; Shift+click adds or removes
//    click a node               pick it (Shift+click adds it to the
//                               picked nodes or takes it from them; a click
//                               on a segment picks its two nodes; a drag
//                               from anywhere else, a rubber band, picks the
//                               nodes of the selected outlines inside it,
//                               Shift adds them; with no outline selected it
//                               selects the items with a copy inside it
//                               (Inkscape's; Shift adds); Ctrl+A picks every node of
//                               the selected outlines, or selects all with
//                               nothing selected; Tab and Shift+Tab step to
//                               the next and the previous node)
//    drag a node                move it with the other picked nodes, each on
//                               its copy (snapped to the vertices of all
//                               copies, mirrors and cone points by the
//                               dragged one; Ctrl: horizontally or
//                               vertically, unsnapped; Alt, held at any time:
//                               along the nearer of its handle lines, a
//                               retracted handle's along its segment,
//                               unsnapped, Inkscape's Ctrl+Alt); X and Y in
//                               the bar place the centre of the picked nodes
//    a node of a path           every picked node shows its handles, and its
//                               neighbours their handles on its two
//                               segments (Inkscape's): drag one (a smooth
//                               node keeps the other in line; Alt+drag
//                               breaks it into a corner, Ctrl snaps it to 15
//                               degrees, Shift turns the other handle with
//                               it); Ctrl+click a handle, or drop it on its
//                               node, retracts it; Shift+drag the node pulls
//                               out a retracted handle, the one on the side
//                               the drag goes to, and the node keeps its
//                               kind (a polyline becomes a path); double
//                               click the node makes it smooth or a corner.
//                               A node is a corner, smooth, symmetric or
//                               auto (Inkscape's types, Paths.js): the bar's
//                               choice, Shift+C, S, Y, A, or Ctrl+click on it
//                               cycles them; its mark tells which (a square,
//                               a disc, a diamond, a disc with a dot); an end
//                               of an open outline stays a corner.
//                               On a geodesic path (Paths.js) in line means
//                               on one geodesic through the node, the stalks
//                               of the handles are geodesics, and a moved
//                               node takes its handles along as they are
//                               seen from it
//    drag a segment             bend it through the pointer (Inkscape's
//                               weights: the nearer handle takes more); a
//                               straight one gets handles first; a polyline
//                               becomes a path, a tile of points a curved
//                               tile, its pairs following (a side on a
//                               mirror stays)
//    Shift+U, Shift+L           the picked node's segments curves (handles
//                               at their thirds, the outline as it was; a
//                               polyline becomes a path) or lines
//    double click a segment     add a node there (on a path, Paths.js, a
//                               node on the curve, which keeps its shape; on
//                               a side of a geodesic path on the geodesic);
//                               a click on a segment of a selected outline
//                               keeps the selection, whatever lies on top
//    Insert, Add node           a node in the middle of each segment between
//                               picked nodes (Inkscape's; one picked, or none
//                               between them: the segment after the last
//                               picked), all of them picked
//    Alt+click a node, Delete   remove it, at the release (Delete: the picked
//                               nodes); a path keeps its shape, each run of
//                               segments through removed nodes refitted by
//                               one curve (Inkscape's; Ctrl+Delete,
//                               Ctrl+Alt+click: the segments joined as they
//                               are)
//    Shift+B, Shift+J           break the outline at the picked nodes (a
//                               closed one opens there, an open one splits
//                               into outlines), join two picked ends (of one
//                               open outline: it closes; of two: they become
//                               one, the first picked keeping its style),
//                               merged at their midpoint; Join with segment
//                               in the bar: a straight segment between them
//    Alt+drag inside a frame    moves its picture inside it (on the copy
//                               pressed; the frame stays, Reset in the bar
//                               places the picture again), without entering
//                               the frame; the picture's outline shows while
//                               it moves (PictureDrag.js)
//    arrows (Shift: x10)        nudge the picked nodes by a pixel
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
//                               alone) and a curved polygon's or star's
//                               round handles (the cubics of all its corners
//                               of a kind; a smooth corner keeps them in
//                               line, Alt+drag makes it sharp; a double
//                               click on a corner's diamond: smooth or
//                               sharp), a spiral's end
//    a tile (Tiles.js)          its edges take their paired edges along; its
//                               corners and mirror sides (round handles) and
//                               the tile itself stay
//    double click a group       edit inside it (Escape, a click outside it,
//                               or Leave in the bar leaves)
//    Escape                     the picked nodes dropped, then the item
//                               edited inside left, else the selection
//    right click                the node's commands and the conversions of
//                               the outlines (a shape: a curved polygon's or
//                               star's corners smooth or sharp, and the
//                               conversions, which drop its numbers)
//    To polyline, To path       buttons in the bar for the selected outlines
//                               (Ctrl+Shift+C: To path); the bar's menu holds
//                               Fit curves, To geodesic, To Euclidean
//    Ctrl+Z, Ctrl+Y             undo, redo
//
//  A drag maps the pointer through the frame of the item's copy, so the node
//  moves under the pointer on that copy whatever the map of the group is.
//

import {
    flattenItem,
    splitItemSegment,
    withNodes,
    nodeMoved,
    handleMoved,
    nodeNeighbour,
    NODE_TYPES,
    nodeType,
    nodeTypeSet,
    nextNodeType,
    isEndNode,
    nodeSegments,
    segmentStraight,
    pulledHandle,
    handleRetracted,
    segmentsCurved,
    segmentsStraight,
    segmentBent,
    handleSnapped,
    handleLinkedMoved,
    alongHandleLines,
    joinPoint,
    pathFromPolyline,
    removeNode,
    nodeRings,
    nodesRemovedKeepingShape,
    brokenPaths,
    joinedNodes,
    closedJoin,
    tileVertexFixed,
    tilePairedVertex,
    tileMovedVertex,
    tileInsertedVertex,
    tileRemovedVertex,
    tileWithNodes,
    tileEdgeOfHandle,
    tileHandleFree,
    tileEdgeOfSegment,
    tileEdgeOfVertex,
    tileEdgeStarts,
    ShapeHandles,
    snapProperty,
    selectedShapeProperties,
    pictureProperties,
    depthProperty,
    handleDepthKey,
    DrawingCommands,
    itemCopy,
    itemBridges,
    PictureDrag,
    containerProperties,
    convertProperties,
} from './modules.js';

const ICON = new URL('./res/btn_node.svg', import.meta.url).pathname;
// what the tool does, in its tooltip and the property bar's hint
const HELP = 'click a shape (any copy) to edit it, Shift adds; click a node to pick it (Shift+click adds or drops it, a click on a segment picks its two nodes, a drag from elsewhere picks the nodes inside, or with no outline selected the items inside, Ctrl+A all of them, Tab steps); drag a node: the picked nodes move (snapped; Ctrl: across or up; Alt: along its handle lines), X and Y in the bar place them; Shift+drag on a node pulls out one of its handles; drag a handle (Alt: a corner, Ctrl: 15 degrees, Shift: both handles), Ctrl+click it or drop it on its node: retracted; drag a segment: bent (a polyline becomes a path, a tile of points a curved tile); Shift+U, Shift+L: the segments of the node curves or lines; node types: corner, smooth, symmetric, auto (Shift+C, S, Y, A; Ctrl+click a node cycles them; double click a node: smooth or corner); double click a segment: a new node, Insert: one on each segment between the picked nodes; double click a frame or group: edit inside it (Escape or a click outside leaves); Alt+click removes a node, Delete the picked ones (a path keeps its shape; Ctrl+Delete: as they are), arrows nudge them; Shift+B breaks the outline at the picked nodes, Shift+J joins two picked ends (Join with segment in the bar); Alt+drag inside a frame moves its picture (Reset places it again); Closed closes the outline or opens it after the picked node; To polyline and To path in the bar (Ctrl+Shift+C) convert the selected outlines; a shape keeps its kind: drag its diamonds (the inner corner of a star: Ctrl keeps its twist) and the round handles of a curved polygon or star (Alt: sharp corners; double click a diamond: its corners smooth or sharp), or set its numbers';
const HANDLE_PX = 7;        // reach of a node or a handle
const SEGMENT_PX = 6;       // reach of a segment for adding a node
const DRAG_PX = 2;          // a press moving less is a click
const RETRACT_PX = 2;       // a handle dropped this near its node is retracted onto it
const PULL_PX = 4;          // a Shift+drag on a node picks the handle to pull out this far from it
const SNAP_ANGLE = Math.PI/12;  // Ctrl on a handle: its direction in steps of 15 degrees

const STROKE = 'fill="none" stroke="#303030" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const NODE = 'fill="#fff" stroke="#303030" stroke-width="1.5"';
const svg = (body) => `<svg viewBox="0 0 24 24">${body}</svg>`;
const HANDLE_LINE = 'fill="none" stroke="#303030" stroke-width="1.2"';
const handleEnds = (x1, x2) => `<circle cx="${x1}" cy="10" r="1.4" fill="#303030"/><circle cx="${x2}" cy="10" r="1.4" fill="#303030"/>`;
// the node types (Paths.js): their names, keys (with Shift) and what they do
const TYPE_INFO = {
    corner:    { name: 'Corner', key: 'C', title: 'its handles apart' },
    smooth:    { name: 'Smooth', key: 'S', title: 'its handles in line (or double click it)' },
    symmetric: { name: 'Symmetric', key: 'Y', title: 'its handles in line and as long' },
    auto:      { name: 'Auto', key: 'A', title: 'its handles from its neighbours, made again as they move (dragging one makes it smooth)' },
};
const TYPE_OF_KEY = { c: 'corner', s: 'smooth', y: 'symmetric', a: 'auto' };
// the icons of the node's buttons: the same line weight as the commands'
const ICONS = {
    addNode:    svg(`<path d="M3 18 H21" ${STROKE}/><rect x="9" y="15" width="6" height="6" ${NODE}/><path d="M12 3 V11 M8 7 H16" ${STROKE}/>`),
    removeNode: svg(`<path d="M3 18 H21" ${STROKE}/><rect x="9" y="15" width="6" height="6" ${NODE}/><path d="M8 7 H16" ${STROKE}/>`),
    // the node types: a corner's square, smooth's disc (handles in line), symmetric's diamond (as long), auto's disc with a dot
    corner:     svg(`<path d="M3 20 L12 7 L21 20" ${STROKE}/><rect x="9.4" y="4.4" width="5.2" height="5.2" ${NODE}/>`),
    smooth:     svg(`<path d="M3 19 C6 7 18 7 21 19" ${STROKE}/><path d="M4 10 H16" ${HANDLE_LINE}/>${handleEnds(4, 16)}` +
                    `<circle cx="12" cy="10" r="2.6" ${NODE}/>`),
    symmetric:  svg(`<path d="M3 19 C6 7 18 7 21 19" ${STROKE}/><path d="M5 10 H19" ${HANDLE_LINE}/>${handleEnds(5, 19)}` +
                    `<path d="M12 6.4 L15.6 10 L12 13.6 L8.4 10 Z" ${NODE}/>`),
    auto:       svg(`<path d="M3 19 C6 7 18 7 21 19" ${STROKE}/><path d="M6 10 H18" ${HANDLE_LINE}/>${handleEnds(6, 18)}` +
                    `<circle cx="12" cy="10" r="2.6" ${NODE}/><circle cx="12" cy="10" r="0.9" fill="#303030"/>`),
    closed:     svg(`<path d="M5 18 L8 5 L19 7 L17 19 Z" ${STROKE}/>` +
                    ['5,18', '8,5', '19,7', '17,19'].map(p => { const [x, y] = p.split(','); return `<rect x="${x - 2}" y="${y - 2}" width="4" height="4" ${NODE}/>`; }).join('')),
    curves:     svg(`<path d="M4 19 C5 6 13 4 20 5" ${STROKE}/><path d="M4 19 L4.6 11 M20 5 L13 4.3" fill="none" stroke="#303030" stroke-width="1"/>` +
                    `<rect x="2" y="17" width="4" height="4" ${NODE}/><rect x="18" y="3" width="4" height="4" ${NODE}/>`),
    lines:      svg(`<path d="M4 19 L20 5" ${STROKE}/><rect x="2" y="17" width="4" height="4" ${NODE}/><rect x="18" y="3" width="4" height="4" ${NODE}/>`),
    // break: a node made two, apart; join: two ends come together into one node; join with segment: a line between two ends
    breakNode:  svg(`<path d="M2 18 C3 12 5 9 7.5 9 M16.5 9 C19 9 21 12 22 18" ${STROKE}/><path d="M10.5 13 L8.6 15.5 M13.5 13 L15.4 15.5" fill="none" stroke="#303030" stroke-width="1.2"/>` +
                    `<rect x="5.2" y="6.7" width="4.6" height="4.6" ${NODE}/><rect x="14.2" y="6.7" width="4.6" height="4.6" ${NODE}/>`),
    joinNodes:  svg(`<path d="M2 18 C3 12 6 9 12 9 C18 9 21 12 22 18" ${STROKE}/><path d="M7.5 15.5 L10 13 M16.5 15.5 L14 13" fill="none" stroke="#303030" stroke-width="1.2"/>` +
                    `<rect x="9.7" y="6.7" width="4.6" height="4.6" ${NODE}/>`),
    joinSegment: svg(`<path d="M2 18 C3 13 4 10 6 9 M18 9 C20 10 21 13 22 18" ${STROKE}/><path d="M6 9 H18" fill="none" stroke="#303030" stroke-width="2.4"/>` +
                    `<rect x="3.7" y="6.7" width="4.6" height="4.6" ${NODE}/><rect x="15.7" y="6.7" width="4.6" height="4.6" ${NODE}/>`),
};

function NodeTool(par) {

    const mEditor = par.editor;
    const mView = mEditor.view;
    const mDoc = mEditor.document;
    const mRepaint = mEditor.repaint;
    // the Tile tool's node editing (TileTool.js): tiles alone are picked and
    // edited, other items let a click through; no break, join or close, no
    // picture moved inside a frame, no item entered
    const mTilesOnly = !!par.tilesOnly;
    /** the items the tool picks: all, or tiles alone */
    const mAccept = mTilesOnly ? (item) => !!(item && item.tile) : null;
    /** the selection the tool edits: the editor's, of tiles alone in the Tile tool */
    const selection = () => (mAccept ? mEditor.getSelection().filter(s => mAccept(mDoc.getItem(s.id))) : mEditor.getSelection());

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
    // Alt+drag inside a frame: its picture
    const mPictureDrag = PictureDrag(mEditor);

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

    /** world points of a flat list, on the copy of the selection entry */
    function worldPoints(sel, flat){
        const pts = [];
        for (let i = 0; i + 1 < flat.length; i += 2) pts.push(mEditor.mapWorld(sel.frameInv, [flat[i], flat[i + 1]]));
        return pts;
    }
    function vertexWorldPoints(sel){
        const item = mDoc.getItem(sel.id);
        return item ? worldPoints(sel, itemVertices(item)) : [];
    }
    /** pixels from the pointer of an event to a world point, by the view's scale at the pointer */
    const pxTo = (e, w) => mEditor.pxDistance(w, e.wpnt, [e.canvasX, e.canvasY]);

    /** the picked vertices of the selected items that are there: [{pv, sel, item}], the one picked last at the end */
    function pickedAll(){
        const sels = new Map(selection().map(sel => [sel.id, sel]));
        const out = [];
        for (const pv of mEditor.getSelectedVertices()) {
            const sel = sels.get(pv.id), item = sel && mDoc.getItem(pv.id);
            if (item && hasNodes(item) && pv.vertex >= 0 && pv.vertex < itemVertices(item).length/2) out.push({ pv, sel, item });
        }
        return out;
    }

    /** the vertex picked last with its selection entry and item: {pv, sel, item} or null */
    function picked(){
        const all = pickedAll();
        return all.length ? all[all.length - 1] : null;
    }

    /** the picked vertices by item: [{sel, item, vertices}], the items in the order of their first picked vertex */
    function pickedByItem(){
        const map = new Map();
        for (const p of pickedAll()) {
            if (!map.has(p.item.id)) map.set(p.item.id, { sel: p.sel, item: p.item, vertices: [] });
            map.get(p.item.id).vertices.push(p.pv.vertex);
        }
        return [...map.values()];
    }

    /** the world point of vertex v of the item on the copy of its selection entry */
    function vertexWorld(sel, item, v){
        const pts = itemVertices(item);
        return mEditor.mapWorld(sel.frameInv, [pts[2*v], pts[2*v + 1]]);
    }

    /** the centre of the box round the picked nodes on their copies (world), null without one */
    function pickedCentre(){
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of pickedAll()) {
            const w = vertexWorld(p.sel, p.item, p.pv.vertex);
            x0 = Math.min(x0, w[0]); x1 = Math.max(x1, w[0]);
            y0 = Math.min(y0, w[1]); y1 = Math.max(y1, w[1]);
        }
        return x0 <= x1 ? [0.5*(x0 + x1), 0.5*(y0 + y1)] : null;
    }

    /**
     * the control handles shown with node `vertex` of a path: its own and,
     * as in Inkscape, those of its neighbours on its two segments (the
     * previous node's h2, the next node's h1), so both handles of a segment
     * can be dragged; [{vertex, which}] of the handles that are out
     */
    function shownHandles(item, vertex){
        if (!item || !item.nodes || !item.nodes[vertex]) return [];
        const closed = !!item.closed, out = [];
        const add = (v, which) => { if (v >= 0 && item.nodes[v][which]) out.push({ vertex: v, which }); };
        add(vertex, 'h1');
        add(vertex, 'h2');
        add(nodeNeighbour(item.nodes, vertex, 'h1', closed), 'h2');
        add(nodeNeighbour(item.nodes, vertex, 'h2', closed), 'h1');
        return out;
    }

    /** the control handles shown: those of every picked node of a path and of its neighbours on its segments (shownHandles), each once: [{sel, item, vertex, which}] */
    function shownHandleList(){
        const out = [], seen = new Set();
        for (const p of pickedAll()) {
            if (!p.item.nodes) continue;
            for (const h of shownHandles(p.item, p.pv.vertex)) {
                const key = `${p.item.id}#${h.vertex}#${h.which}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push({ sel: p.sel, item: p.item, vertex: h.vertex, which: h.which });
            }
        }
        return out;
    }

    /**
     * a shown control handle (of a picked node of a path, or of its
     * neighbours on its segments) under the canvas point, when its node is
     * not nearer: {sel, vertex, which} or null
     */
    function handleUnder(e){
        let best = null, bestD = HANDLE_PX;
        for (const h of shownHandleList()) {
            const dist = q => pxTo(e, mEditor.mapWorld(h.sel.frameInv, q));
            const node = h.item.nodes[h.vertex];
            const d = dist(node[h.which]);
            if (d < bestD && d < dist(node.p)) { bestD = d; best = { sel: h.sel, vertex: h.vertex, which: h.which }; }
        }
        return best;
    }

    /** the vertex handle under the canvas point: {sel, vertex} or null */
    function vertexUnder(e){
        let best = null, bestD = HANDLE_PX;
        for (const sel of selection()) {
            vertexWorldPoints(sel).forEach((w, vertex) => {
                const d = pxTo(e, w);
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
    function segmentUnder(e){
        let best = null, bestD = SEGMENT_PX;
        const w = e.wpnt;
        for (const sel of selection()) {
            const item = mDoc.getItem(sel.id);
            if (!hasNodes(item)) continue;
            // a path's outline as it is drawn (a geodesic path's sides are arcs), its pieces by the path's segments
            const flat = item.nodes ? flattenItem(item) : null;
            const c = worldPoints(sel, flat ? flat.points : item.points);
            const n = c.length, segs = item.closed ? n : n - 1;
            for (let i = 0; i < segs; i++) {
                const a = c[i], b = c[(i + 1) % n];
                const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx*dx + dy*dy;
                const t = len2 > 0 ? Math.max(0, Math.min(1, ((w[0] - a[0])*dx + (w[1] - a[1])*dy)/len2)) : 0;
                const d = pxTo(e, [a[0] + t*dx, a[1] + t*dy]);
                const piece = flat ? flat.pieces[i] : null;
                // no node on a bridge between the rings of a compound path
                if (d > bestD || (piece && piece.seg < 0)) continue;
                bestD = d;
                best = piece ? { sel, index: piece.seg, t: piece.t0 + (piece.t1 - piece.t0)*t } : { sel, index: i, t };
            }
        }
        return best;
    }

    function itemsMap(ids){
        return new Map(ids.map(id => [id, itemCopy(mDoc.getItem(id))]).filter(e => e[1]));
    }

    /**
     * the item as a path for an edit of its handles and segments: a path as
     * it is, a polyline with its points as nodes, a tile as a curved tile
     * (every point a node, so the indices stay)
     */
    function pathBase(item){
        if (item.nodes) return item;
        return item.tile ? mEditor.curvedTileOf(item, true) : pathFromPolyline(item);
    }

    /**
     * the item with its nodes replaced by an edit of handles, segments or a
     * node's kind: on a tile the pairs of the edges changed follow them (the
     * edge prefer last), and null when the edit is not one a tile allows (a
     * corner made smooth, a handle on a locked edge)
     */
    function nodesApplied(item, nodes, prefer = -1){
        return item.tile ? tileWithNodes(item, nodes, mEditor.pairingMap, prefer) : withNodes(item, nodes);
    }

    /** which handles of node v may come out: all, on a tile those into an edge not locked */
    const handleAllowed = (item, v) => (which) => !item.tile || tileHandleFree(item.tile, v, which);

    /**
     * the item with its vertices moved, moves [{vertex, x}] (x in its own
     * coordinates): a tile's edge takes its paired edge along (its fixed
     * corners stay, and a vertex whose pair moved already follows it), a
     * path's node its handles; null when none moved
     */
    function verticesMoved(item, moves){
        if (item.tile) {
            let out = item;
            const done = new Set();
            for (const m of moves) {
                if (tileVertexFixed(item.tile, m.vertex) || done.has(m.vertex)) continue;
                const next = tileMovedVertex(out, m.vertex, m.x, mEditor.pairingMap, mEditor.nodeChart(out));
                if (!next) continue;
                out = next;
                done.add(m.vertex);
                const pv = tilePairedVertex(item.tile, m.vertex);
                if (pv !== null) done.add(pv);
            }
            return out === item ? null : out;
        }
        if (!moves.length) return null;
        if (item.nodes) {
            // a geodesic path: each node's handles come along as they are seen from it (the chart of the node)
            const chart = mEditor.nodeChart(item);
            let nodes = item.nodes;
            for (const m of moves) nodes = nodeMoved(nodes, m.vertex, m.x, chart);
            return withNodes(item, nodes);
        }
        const points = item.points.slice();
        for (const m of moves) {
            points[2*m.vertex] = m.x[0];
            points[2*m.vertex + 1] = m.x[1];
        }
        return { ...item, points };
    }

    /** the picked nodes as they start a move: [{sel, id, vertices, from}], from their world points on their copies */
    function movingPicked(){
        return pickedByItem().map(g => ({ sel: g.sel, id: g.item.id, vertices: g.vertices, from: g.vertices.map(v => vertexWorld(g.sel, g.item, v)) }));
    }

    /**
     * the items of the moving nodes (movingPicked) with each node at
     * move(its world point at the start), through the frame of its copy:
     * Map id -> item of those that moved, null when none did
     */
    function movedPicked(moving, before, move){
        const after = new Map();
        for (const m of moving) {
            const item = before.get(m.id);
            if (!item) continue;
            const changed = verticesMoved(item, m.vertices.map((v, k) => ({ vertex: v, x: mEditor.mapWorld(m.sel.frame, move(m.from[k])) })));
            if (changed) after.set(m.id, changed);
        }
        return after.size ? after : null;
    }

    /** the picked nodes moved by move(world point), one undo step (merged by mergeKey) */
    function movePicked(label, move, mergeKey = null){
        const moving = movingPicked();
        if (!moving.length) return;
        const before = itemsMap(moving.map(m => m.id));
        const after = movedPicked(moving, before, move);
        if (!after) return;
        mEditor.applyReplace(after);
        mEditor.pushReplace(label, new Map([...before].filter(([id]) => after.has(id))), after, mergeKey);
        mRepaint();
    }

    /** the picked nodes moved so that the centre of their box (pickedCentre) has value on the axis (0: x, 1: y) */
    function movePickedTo(axis, value){
        const c = pickedCentre();
        if (!c || !Number.isFinite(value) || value === c[axis]) return;
        const d = value - c[axis];
        movePicked('move nodes', (w) => (axis === 0 ? [w[0] + d, w[1]] : [w[0], w[1] + d]), 'node xy');
    }

    /** the item without its vertex (a tile without the follower too); null where it cannot go (two stay) */
    function vertexRemoved(item, vertex){
        if (!hasNodes(item) || itemVertices(item).length/2 <= 2) return null;
        if (item.tile) return tileRemovedVertex(item, vertex, mEditor.pairingMap);
        if (item.nodes) return withNodes(item, removeNode(item.nodes, vertex));
        const points = item.points.slice();
        points.splice(2*vertex, 2);
        return { ...item, points };
    }

    /**
     * the path without its nodes `vertices`, its shape kept (Paths.js
     * nodesRemovedKeepingShape: each run of segments through them refitted
     * by one curve, on a geodesic path to the curve the document's outliner
     * draws); null for a polyline or a tile, or where fewer than two would stay
     */
    function verticesRemovedKeepingShape(item, vertices){
        if (!item.nodes || item.tile) return null;
        const nodes = nodesRemovedKeepingShape(item, new Set(vertices), mEditor.nodeOutliner(item));
        return nodes ? withNodes(item, nodes) : null;
    }

    /**
     * the items without the vertices, groups [{item, vertices}], one undo
     * step: of each outline two stay, a tile's fixed corners stay. keepShape
     * (Delete, Alt+click): a path keeps its shape, each run of segments
     * through the removed nodes refitted (verticesRemovedKeepingShape);
     * else, and for a polyline or a tile, the segments are joined as they
     * are. Each is found again by its point after a removal (a tile's
     * removal takes its follower along, so the indices change)
     */
    function removeVertices(groups, keepShape = false){
        const before = new Map(), after = new Map();
        for (const g of groups) {
            const kept = keepShape ? verticesRemovedKeepingShape(g.item, g.vertices) : null;
            if (kept) { before.set(g.item.id, itemCopy(g.item)); after.set(g.item.id, kept); continue; }
            let item = g.item;
            const pts0 = itemVertices(item);
            const targets = [...new Set(g.vertices)].sort((a, b) => b - a).map(v => [pts0[2*v], pts0[2*v + 1]]);
            for (const q of targets) {
                const pts = itemVertices(item);
                let v = -1;
                for (let k = 0; k + 1 < pts.length; k += 2) if (pts[k] === q[0] && pts[k + 1] === q[1]) { v = k/2; break; }
                if (v < 0 || (item.tile && tileVertexFixed(item.tile, v))) continue;
                const next = vertexRemoved(item, v);
                if (next) item = next;
            }
            if (item !== g.item) { before.set(g.item.id, itemCopy(g.item)); after.set(g.item.id, item); }
        }
        if (!after.size) return;
        mEditor.applyReplace(after);
        const count = groups.reduce((n, g) => n + g.vertices.length, 0);
        mEditor.pushReplace(count > 1 ? 'remove nodes' : 'remove node', before, after);
        mEditor.setSelectedVertex(null);
    }

    function removeVertex(id, vertex, keepShape = true){
        const item = mDoc.getItem(id);
        if (item) removeVertices([{ item, vertices: [vertex] }], keepShape);
    }

    /** is vertex v an end of an open outline (it stays a corner) */
    function isEnd(item, v){
        if (item.nodes) return isEndNode(item.nodes, v, !!item.closed);
        return !item.closed && (v === 0 || v === itemVertices(item).length/2 - 1);
    }

    /** the type of node v of the item ('corner' for a polyline's point), null without one */
    function vertexType(item, v){
        if (!hasNodes(item) || !(v >= 0 && v < itemVertices(item).length/2)) return null;
        return item.nodes ? nodeType(item.nodes[v]) : 'corner';
    }

    /**
     * can node v of the item take a type: a vertex of a path or a polyline
     * (which becomes a path), on a tile not a fixed corner; an end of an open
     * outline only back to a corner
     */
    function canType(item, v){
        const type = vertexType(item, v);
        if (!type || (item.tile && tileVertexFixed(item.tile, v))) return false;
        return !isEnd(item, v) || type !== 'corner';
    }

    /**
     * nodes given types, groups [{item, vertices}], typeOf(item, vertex) the
     * type of each (Inkscape's rules, Paths.js nodeTypeSet; in the chart of
     * the node on a geodesic path): a polyline becomes a path, a polygon
     * tile a curved one, a tile's pairs follow; one undo step. A node that
     * has its type or cannot take it stays
     */
    function setTypes(groups, typeOf){
        const before = new Map(), after = new Map();
        for (const g of groups) {
            const base = pathBase(g.item);
            if (!base) continue;
            const chart = mEditor.nodeChart(base);
            let nodes = base.nodes;
            for (const v of g.vertices) {
                const type = typeOf(g.item, v);
                if (!type || !canType(g.item, v) || vertexType(g.item, v) === type || !nodes[v]) continue;
                nodes = nodeTypeSet(nodes, v, type, !!base.closed, chart);
            }
            if (nodes === base.nodes) continue;
            const changed = nodesApplied(base, nodes);
            if (!changed) continue;
            before.set(g.item.id, itemCopy(g.item));
            after.set(g.item.id, changed);
        }
        if (!after.size) return;
        mEditor.applyReplace(after);
        mEditor.pushReplace('node type', before, after);
        mRepaint();
    }

    /** node `vertex` of the item given a type (setTypes) */
    function setNodeType(id, vertex, type){
        const item = mDoc.getItem(id);
        if (item) setTypes([{ item, vertices: [vertex] }], () => type);
    }

    /** a node smooth when it is a corner, else a corner (the double click) */
    function toggleSmooth(id, vertex){
        const type = vertexType(mDoc.getItem(id), vertex);
        if (type) setNodeType(id, vertex, type === 'corner' ? 'smooth' : 'corner');
    }

    /** a node given the next type (Ctrl+click, Inkscape's cycle: corner, smooth, symmetric, auto); an end of an open outline stays a corner */
    function cycleType(id, vertex){
        const type = vertexType(mDoc.getItem(id), vertex);
        if (type) setNodeType(id, vertex, nextNodeType(type));
    }

    /**
     * the item with a vertex on segment index (after vertex index): at x (the
     * item's own coordinates), on a path at the segment's parameter t (a
     * tile's pair takes one too); null where none goes
     */
    function vertexInserted(item, index, x, t = 0.5){
        if (item.tile) return tileInsertedVertex(item, index, x, mEditor.pairingMap, t, mEditor.curveSplitter(item));
        if (item.nodes) return withNodes(item, splitItemSegment(item, index, t, mEditor.curveSplitter(item)));
        const points = item.points.slice();
        points.splice(2*(index + 1), 0, x[0], x[1]);
        return { ...item, points };
    }

    /**
     * the index of the vertex vertexInserted put after vertex index: index +
     * 1, on a tile counted from the start of its edge again (the pair of an
     * edge that comes before it took a vertex too)
     */
    function insertedVertexIndex(before, after, index){
        if (!before.tile || !after.tile) return index + 1;
        const at = tileEdgeOfVertex(before.tile, index);
        return at ? tileEdgeStarts(after.tile)[at.edge] + at.index + 1 : index + 1;
    }

    /** a vertex on segment index (after vertex index): at x (the item's own coordinates), on a path at the segment's parameter t */
    function insertVertex(sel, index, x, t = 0.5){
        const item = mDoc.getItem(sel.id);
        if (!hasNodes(item)) return;
        const before = itemsMap([sel.id]);
        const changed = vertexInserted(item, index, x, t);
        if (!changed) return;
        const after = new Map([[sel.id, changed]]);
        mEditor.applyReplace(after);
        mEditor.pushReplace('add node', before, after);
        mEditor.setSelectedVertex({ id: sel.id, vertex: insertedVertexIndex(item, changed, index) });
    }

    /** the vertex after vertex v of the item's outline (on a path of its ring), -1 at the end of an open one */
    function nextVertex(item, v){
        const n = itemVertices(item).length/2;
        if (item.nodes) return nodeNeighbour(item.nodes, v, 'h2', !!item.closed);
        return v + 1 < n ? v + 1 : (item.closed ? 0 : -1);
    }

    /**
     * the segments Add node acts on, by item [{item, segs}] (a segment named
     * by the vertex it starts from): with several nodes picked the segments
     * between picked nodes (Inkscape's Insert); with one, or none between
     * them, the segment after the last picked node (before it, at the end of
     * an open outline)
     */
    function addNodeSegments(){
        if (pickedAll().length > 1) {
            const out = [];
            for (const g of pickedByItem()) {
                if (!hasNodes(g.item)) continue;
                const picks = new Set(g.vertices);
                const segs = g.vertices.filter(v => picks.has(nextVertex(g.item, v)));
                if (segs.length) out.push({ item: g.item, segs, between: true });
            }
            if (out.length) return out;
        }
        const p = picked();
        if (!p || !hasNodes(p.item) || itemVertices(p.item).length < 4) return [];
        const after = nextVertex(p.item, p.pv.vertex);
        const segs = after >= 0 ? [p.pv.vertex] : (p.item.nodes ? [nodeNeighbour(p.item.nodes, p.pv.vertex, 'h1', false)] : [p.pv.vertex - 1]);
        return [{ item: p.item, segs, between: false }];
    }

    /** can a node go: on a segment between picked nodes, else after the picked one */
    function canAddNode(){
        return addNodeSegments().length > 0;
    }

    /**
     * a node in the middle of each segment addNodeSegments gives (on a path
     * at its parameter 1/2, on a geodesic outline on the geodesic), one undo
     * step; the picked nodes and the new ones picked (after the last picked
     * node: the new one alone, as before). Each segment is found
     * again by its two ends after an insertion (a tile's takes its pair
     * along, so the indices change), and one no longer there is left (the
     * pair of an edge that took a node)
     */
    function addNode(){
        const groups = addNodeSegments();
        if (!groups.length) return;
        const pointOf = (item, v) => { const pts = itemVertices(item); return [pts[2*v], pts[2*v + 1]]; };
        const find = (item, q) => {
            const pts = itemVertices(item);
            for (let k = 0; k + 1 < pts.length; k += 2) if (pts[k] === q[0] && pts[k + 1] === q[1]) return k/2;
            return -1;
        };
        const picks = mEditor.getSelectedVertices();
        const before = new Map(), after = new Map(), kept = [], added = [];
        for (const { item: start, segs } of groups) {
            let item = start;
            const chart = mEditor.nodeChart(item);
            const targets = segs.map(k => ({ a: pointOf(item, k), b: pointOf(item, nextVertex(item, k)) }));
            for (const s of targets) {
                const i = find(item, s.a), j = i >= 0 ? nextVertex(item, i) : -1;
                if (j < 0 || find(item, s.b) !== j) continue;
                const next = vertexInserted(item, i, joinPoint(s.a, s.b, chart), 0.5);
                if (next) { item = next; s.done = true; }
            }
            if (item === start) continue;
            before.set(start.id, itemCopy(start));
            after.set(start.id, item);
            // the picked nodes stay where they are; each new node follows its segment's first end
            for (const v of picks.filter(v => v.id === start.id)) {
                const at = find(item, pointOf(start, v.vertex));
                if (at >= 0) kept.push({ id: start.id, vertex: at });
            }
            for (const s of targets.filter(s => s.done)) {
                const at = find(item, s.a);
                if (at >= 0) added.push({ id: start.id, vertex: nextVertex(item, at) });
            }
        }
        if (!after.size) return;
        mEditor.applyReplace(after);
        mEditor.pushReplace(added.length > 1 ? 'add nodes' : 'add node', before, after);
        mEditor.setSelectedVertices(groups[0].between ? [...picks.filter(v => !after.has(v.id)), ...kept, ...added].filter(v => v.vertex >= 0) : added);
        mRepaint();
    }

    /** can a picked node go: two stay, a tile's fixed corners stay */
    function canRemoveNode(){
        return pickedAll().some(p => itemVertices(p.item).length/2 > 2 && !(p.item.tile && tileVertexFixed(p.item.tile, p.pv.vertex)));
    }

    /** the picked nodes removed, one undo step; keepShape: a path keeps its shape (Delete), else its segments joined as they are (Ctrl+Delete) */
    function removePicked(keepShape = true){
        removeVertices(pickedByItem(), keepShape);
    }

    //
    //  break and join (Inkscape's Shift+B, Shift+J): outlines of one ring
    //  that open and close (paths and polylines, not tiles, compound paths
    //  nor holders of items)
    //

    /** does the item break and join: an outline that closes, of one ring */
    const joins = (item) => closes(item) && !itemBridges(item) && (!item.nodes || nodeRings(item.nodes).length === 1);

    /** the item's nodes: a path's, a polyline's points as corners */
    const nodesOf = (item) => (item.nodes ? item.nodes : itemVertices(item).reduce((out, x, k, a) => (k % 2 ? out : [...out, { p: [x, a[k + 1]], h1: null, h2: null }]), []));

    /** the item with nodes (closed or open): a path's, a polyline's points */
    function withOutline(item, nodes, closed){
        if (item.nodes) return withNodes({ ...item, closed }, nodes);
        return { ...item, closed, points: nodes.flatMap(m => [m.p[0], m.p[1]]) };
    }

    /** a new item like the item (its style and kind), without its id and name */
    function sibling(item, nodes){
        const { id, name, ...rest } = itemCopy(item);
        return withOutline(rest, nodes, false);
    }

    /** the picked nodes the outlines break at, by item: [{sel, item, vertices}] of those that break (a closed one at any node, an open one not at its ends) */
    function breakGroups(){
        return pickedByItem().filter(g => joins(g.item)).map(g => {
            const n = itemVertices(g.item).length/2;
            return { ...g, vertices: g.vertices.filter(v => g.item.closed || (v > 0 && v < n - 1)) };
        }).filter(g => g.vertices.length);
    }

    const canBreak = () => breakGroups().length > 0;

    /**
     * the outlines broken at the picked nodes (Inkscape's Break): a closed
     * one opens at the first of them, the node made two ends, and splits at
     * the others; an open one splits into outlines, the first keeping the
     * item, the others new items above it (selected on the same copy). The
     * ends made are picked; one undo step
     */
    function breakPicked(){
        const groups = breakGroups();
        if (!groups.length) return;
        const replaced = new Map(), inserted = [], ends = [];
        for (const g of groups) {
            const parts = brokenPaths(nodesOf(g.item), !!g.item.closed, g.vertices);
            replaced.set(g.item.id, withOutline(g.item, parts[0].nodes, false));
            parts.forEach((part, k) => {
                const last = part.nodes.length - 1;
                const at = (vertex) => ({ part: k, sel: g.sel, id: g.item.id, vertex });
                if (part.startBreak) ends.push(at(0));
                if (part.endBreak) ends.push(at(last));
                if (k > 0) inserted.push({ item: sibling(g.item, part.nodes), after: g.item.id, group: g, part: k });
            });
        }
        // the new outlines above their item, the last part on top
        const order = inserted.slice().reverse();
        const added = mEditor.applyEdits('break', { replaced, inserted: order.map(x => ({ item: x.item, after: x.after })) });
        const idOf = new Map(order.map((x, k) => [`${x.group.item.id}#${x.part}`, added[k] && added[k].id]));
        const sels = new Map(selection().map(sel => [sel.id, sel]));
        for (const x of inserted) {
            const id = idOf.get(`${x.group.item.id}#${x.part}`);
            if (id) sels.set(id, { id, frame: x.group.sel.frame, frameInv: x.group.sel.frameInv });
        }
        mEditor.setSelection([...sels.values()]);
        mEditor.setSelectedVertices(ends.map(e => ({ id: e.part ? idOf.get(`${e.id}#${e.part}`) : e.id, vertex: e.vertex })).filter(v => v.id));
        mRepaint();
    }

    /**
     * the two picked nodes Join acts on: ends of open outlines that join,
     * {a, b, same} (a picked first), or null
     */
    function joinPair(){
        const all = pickedAll();
        if (all.length !== 2) return null;
        const [a, b] = all;
        const end = (q) => joins(q.item) && !q.item.closed && isEnd(q.item, q.pv.vertex);
        if (!end(a) || !end(b)) return null;
        const same = a.item.id === b.item.id;
        if (same && a.pv.vertex === b.pv.vertex) return null;
        return { a, b, same };
    }

    /** can the picked ends join: merged (an outline of three nodes or more closes) or by a segment */
    function canJoin(merge){
        const j = joinPair();
        if (!j) return false;
        if (!j.same) return true;
        const n = itemVertices(j.a.item).length/2;
        return n >= (merge ? 3 : (j.a.item.nodes ? 2 : 3));
    }

    /**
     * the two picked ends joined (Inkscape's Join, Shift+J; merge false:
     * Join with segment): of one outline it closes, the ends merged at their
     * midpoint into one node (a corner, each end's handle kept) or a
     * straight segment between them; of two outlines they become one, the
     * first picked keeping its id and style, the other's nodes brought onto
     * its copy and the other item gone (two polylines stay a polyline,
     * else a path). On a geodesic path the midpoint on the geodesic. The
     * merged node, or the two ends, picked; one undo step
     */
    function joinPicked(merge = true){
        if (!canJoin(merge)) return;
        const { a, b, same } = joinPair();
        const item = a.item, chart = mEditor.nodeChart(item);
        let changed, picks;
        if (same) {
            const nodes = closedJoin(nodesOf(item), merge, chart);
            if (!nodes) return;
            changed = withOutline(item, nodes, true);
            const n = nodes.length;
            picks = merge ? [0] : [n - 1, 0];
        } else {
            // the other's nodes on the copy of the first: through the world
            const toA = (x) => (x ? mEditor.mapWorld(a.sel.frame, mEditor.mapWorld(b.sel.frameInv, x)) : x);
            const bNodes = nodesOf(b.item).map(m => ({ ...m, p: toA(m.p), h1: toA(m.h1), h2: toA(m.h2) }));
            const endOf = (q) => (q.pv.vertex === 0 ? 'first' : 'last');
            const joined = joinedNodes(nodesOf(item), endOf(a), bNodes, endOf(b), merge, chart);
            const polylines = !item.nodes && !b.item.nodes;
            changed = polylines ? withOutline(item, joined.nodes, false) : withOutline(item.nodes ? item : pathFromPolyline(item), joined.nodes, false);
            picks = merge ? [joined.at] : [joined.at, joined.at + 1];
        }
        mEditor.applyEdits(merge ? 'join' : 'join with segment', { replaced: new Map([[item.id, changed]]), removed: same ? [] : [b.item.id] });
        mEditor.setSelectedVertices(picks.map(vertex => ({ id: item.id, vertex })));
        mRepaint();
    }

    /** the picked nodes given a type (those that can take it) */
    function typePicked(type){
        setTypes(pickedByItem(), () => type);
    }

    /** the type of the picked nodes when they share one, else null */
    function pickedType(){
        const types = new Set(pickedAll().map(p => vertexType(p.item, p.pv.vertex)));
        return types.size === 1 ? [...types][0] : null;
    }

    /** can a picked node take a type */
    function canTypePicked(){
        return pickedAll().some(p => canType(p.item, p.pv.vertex));
    }

    /**
     * the segments Make segments curves or lines act on (Inkscape's): with
     * one node picked its two segments, with several the segments between
     * picked nodes; [{item, base, segs}] by item, base the item as a path
     * (pathBase: a polyline's straight segments, a tile as a curved tile),
     * on a tile without the segments of locked edges; none where a tile
     * cannot be curved
     */
    function pickedSegments(){
        const one = pickedAll().length === 1, out = [];
        for (const g of pickedByItem()) {
            const base = pathBase(g.item);
            if (!base) continue;
            const closed = !!base.closed, picks = new Set(g.vertices);
            const segs = (one ? nodeSegments(base.nodes, g.vertices[0], closed)
                              : g.vertices.filter(v => picks.has(nodeNeighbour(base.nodes, v, 'h2', closed))))
                .filter(k => !base.tile || !base.tile.edges[tileEdgeOfSegment(base.tile, k)].locked);
            if (segs.length) out.push({ item: g.item, base, segs });
        }
        return out;
    }

    /** is a straight segment there to make a curve */
    function canCurve(){
        return pickedSegments().some(s => s.segs.some(k => segmentStraight(s.base.nodes, k, !!s.base.closed)));
    }

    /** is a curved segment of a path there to make a line */
    function canStraighten(){
        return pickedSegments().some(s => !!s.item.nodes && s.segs.some(k => !segmentStraight(s.base.nodes, k, !!s.base.closed)));
    }

    /**
     * the picked nodes' segments (pickedSegments) made curves (Inkscape's
     * Make segments curves: their handles at the thirds, the outline as it
     * was, the nodes keeping their kind; a polyline becomes a path) or
     * lines (Make segments lines: their handles retracted); one undo step
     */
    function setSegmentsCurved(curved){
        if (!(curved ? canCurve() : canStraighten())) return;
        const before = new Map(), after = new Map();
        for (const { item, base, segs } of pickedSegments()) {
            const closed = !!base.closed;
            const nodes = curved ? segmentsCurved(base.nodes, closed, segs, mEditor.nodeChart(base)) : segmentsStraight(base.nodes, closed, segs);
            // on a tile the edge of the last segment is followed last
            const changed = nodesApplied(base, nodes, base.tile ? tileEdgeOfSegment(base.tile, segs[segs.length - 1]) : -1);
            if (!changed) continue;
            before.set(item.id, itemCopy(item));
            after.set(item.id, changed);
        }
        if (!after.size) return;
        mEditor.applyReplace(after);
        mEditor.pushReplace(curved ? 'segments curves' : 'segments lines', before, after);
        mRepaint();
    }

    /** the outlines the Closed toggle acts on: the picked node's, else the selected ones */
    function closeTargets(){
        const p = picked();
        return (p ? [p.sel] : selection()).map(s => mDoc.getItem(s.id)).filter(closes);
    }

    /** can the item close (a path of two nodes, a polyline of three points) or open */
    const canToggleClosed = (item) => !itemBridges(item) && (item.closed || itemVertices(item).length/2 >= (item.nodes ? 2 : 3));

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
        const corner = (node, handle) => { const { smooth, symmetric, auto, ...out } = { ...node, [handle]: null }; return out; };
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
            before.set(item.id, itemCopy(item));
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
        const hit = mEditor.hitTest(e.wpnt, [e.canvasX, e.canvasY], undefined, mAccept);
        if (!hit) {
            if (!e.shiftKey) mEditor.clearSelection();
            return;
        }
        const entry = { id: hit.item.id, frame: hit.frame, frameInv: hit.frameInv };
        const sel = selection();
        const wasSelected = mEditor.isSelected(entry.id);
        if (e.shiftKey) mEditor.setSelection(wasSelected ? sel.filter(s => s.id !== entry.id) : [...sel, entry]);
        // a selected item clicked on this or another copy: it is edited on that copy
        else if (wasSelected) mEditor.setSelection(sel.map(s => s.id === entry.id ? entry : s));
        else mEditor.setSelection([entry]);
    }

    /** a click on a node (no drag): Ctrl its next type; Shift it added to the picked nodes or taken from them; else it alone picked */
    function clickedVertex(d){
        if (d.ctrl && d.kind === 'vertex') { cycleType(d.pv.id, d.pv.vertex); return; }
        if (d.shift) {
            const list = mEditor.getSelectedVertices();
            const isPicked = mEditor.isVertexPicked(d.pv.id, d.pv.vertex);
            mEditor.setSelectedVertices(isPicked ? list.filter(v => v.id !== d.pv.id || v.vertex !== d.pv.vertex) : [...list, d.pv]);
            return;
        }
        mEditor.setSelectedVertex(d.pv);
    }

    /** a click on a segment: its two nodes picked (Shift: added) */
    function clickedSegment(d){
        const item = mDoc.getItem(d.sel.id);
        if (!hasNodes(item)) return;
        const n = itemVertices(item).length/2;
        const end = item.nodes ? nodeNeighbour(item.nodes, d.index, 'h2', !!item.closed) : (d.index + 1 < n || item.closed ? (d.index + 1) % n : -1);
        const ends = [{ id: item.id, vertex: d.index }, ...(end >= 0 ? [{ id: item.id, vertex: end }] : [])];
        mEditor.setSelectedVertices(d.shift ? [...mEditor.getSelectedVertices(), ...ends] : ends);
    }

    /** the rubber band's nodes picked: of the selected outlines, those inside it on their copies (Shift: added) */
    function pickInBand(d){
        const x0 = Math.min(d.canvas[0], d.to[0]), x1 = Math.max(d.canvas[0], d.to[0]);
        const y0 = Math.min(d.canvas[1], d.to[1]), y1 = Math.max(d.canvas[1], d.to[1]);
        const inside = [];
        for (const sel of selection()) {
            if (!hasNodes(mDoc.getItem(sel.id))) continue;
            vertexCanvasPoints(sel).forEach((c, vertex) => {
                if (c[0] >= x0 && c[0] <= x1 && c[1] >= y0 && c[1] <= y1) inside.push({ id: sel.id, vertex });
            });
        }
        mEditor.setSelectedVertices(d.shift ? [...mEditor.getSelectedVertices(), ...inside] : inside);
    }

    /**
     * a rubber band let go: the nodes of the selected outlines inside it
     * picked; with no outline selected, the items with a copy wholly inside
     * it selected on that copy (Inkscape's; DrawingEditor itemsInBand), Shift
     * adding them
     */
    function bandReleased(d){
        if (selection().some(s => hasNodes(mDoc.getItem(s.id)))) { pickInBand(d); return; }
        const found = mEditor.itemsInBand(d.canvas, d.to, mAccept);
        if (!d.shift) {
            if (found.length) mEditor.setSelection(found);
            else mEditor.clearSelection();
            return;
        }
        const sel = selection();
        mEditor.setSelection([...sel, ...found.filter(f => !sel.some(s => s.id === f.id))]);
    }

    /**
     * the dragged node's world point with Alt: the pointer on the nearer of
     * the node's handle lines as the drag began (Paths.js alongHandleLines,
     * in the chart of the node on a geodesic outline), on its copy
     */
    function handleLineTarget(d, wpnt){
        const item = d.before.get(d.sel.id);
        const nodes = item.nodes || pathFromPolyline(item).nodes;
        const x = mEditor.mapWorld(d.sel.frame, wpnt);
        return mEditor.mapWorld(d.sel.frameInv, alongHandleLines(nodes, d.vertex, !!item.closed, x, mEditor.nodeChart(item)));
    }

    /** the next node (dir 1) or the previous one (-1) of the last picked one's outline picked alone (Tab, Shift+Tab); without one the first or last of the first selected outline. Whether one was picked */
    function stepPicked(dir){
        const p = picked();
        if (p) {
            const n = itemVertices(p.item).length/2;
            mEditor.setSelectedVertex({ id: p.item.id, vertex: (p.pv.vertex + dir + n) % n });
            return true;
        }
        const sel = selection().find(entry => hasNodes(mDoc.getItem(entry.id)));
        const n = sel ? itemVertices(mDoc.getItem(sel.id)).length/2 : 0;
        if (!n) return false;
        mEditor.setSelectedVertex({ id: sel.id, vertex: dir > 0 ? 0 : n - 1 });
        return true;
    }

    /** every node of the selected outlines picked (Ctrl+A); nothing selected: every item selected */
    function pickAll(){
        const sels = selection();
        if (!sels.length) {
            mEditor.setSelection(mDoc.getEditableItems().filter(it => !mAccept || mAccept(it)).map(it => ({ id: it.id, frame: null, frameInv: null })));
            return;
        }
        mEditor.setSelectedVertices(sels.flatMap(sel => {
            const item = mDoc.getItem(sel.id);
            const n = hasNodes(item) ? itemVertices(item).length/2 : 0;
            return Array.from({ length: n }, (_, vertex) => ({ id: sel.id, vertex }));
        }));
    }

    /**
     * a vertex drag starts: the pressed node joins the picked ones (a
     * Shift+press on one not picked), and every picked node is taken with
     * its world point on its copy; the dragged outline's moving vertices
     * (on a tile their followers too) are no snap targets
     */
    function startVertexDrag(d){
        if (!mEditor.isVertexPicked(d.pv.id, d.pv.vertex)) mEditor.setSelectedVertices([...mEditor.getSelectedVertices(), d.pv]);
        d.moving = movingPicked();
        d.before = itemsMap(d.moving.map(m => m.id));
        const item = d.before.get(d.sel.id);
        d.from = vertexWorld(d.sel, item, d.vertex);
        const own = d.moving.find(m => m.id === d.sel.id);
        const vertices = own ? own.vertices.slice() : [d.vertex];
        if (item.tile) for (const v of vertices.slice()) { const pv = tilePairedVertex(item.tile, v); if (pv !== null) vertices.push(pv); }
        d.vertices = vertices;
    }

    function handleEvent(e){
        if (!e.wpnt) return;
        const canvas = [e.canvasX, e.canvasY];
        switch (e.type) {
        case 'pointerdown': {
            if (e.button !== 0) break;
            e.preventDefault();
            e.isConsumed = true;
            // a control handle of the picked node or of its neighbours (Ctrl: a click retracts it)
            const h = handleUnder(e);
            if (h) {
                const before = itemsMap([h.sel.id]);
                mDrag = { kind: 'handle', sel: h.sel, vertex: h.vertex, which: h.which, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey,
                          base: before.get(h.sel.id), before, canvas, moved: false };
                break;
            }
            // a handle of a shape's numbers
            if (mShapeHandles.press(e)) break;
            const v = vertexUnder(e);
            // away from the nodes, outside the item edited inside: out of it, and the press picks what is there
            if (!v) mEditor.leaveContainersOutside(e.wpnt);
            // Alt inside a frame, away from a node: its picture moves in it (the frame selected on that copy)
            if (!v && !mTilesOnly && mPictureDrag.press(e)) break;
            if (v) {
                // Alt: a click removes the node at the release, a drag moves it along its handle lines
                const pv = { id: v.sel.id, vertex: v.vertex };
                // a node not picked is picked alone, a picked one keeps the others (a drag moves them all);
                // Shift: decided at the release (added or dropped), or by the drag
                if (!e.shiftKey) {
                    if (mEditor.isVertexPicked(pv.id, pv.vertex)) mEditor.setSelectedVertices([...mEditor.getSelectedVertices(), pv]);
                    else mEditor.setSelectedVertex(pv);
                }
                const item = mDoc.getItem(v.sel.id);
                // Shift on a node with a retracted handle (of a path, or of a polyline, which becomes one; of a
                // tile, a corner too, a handle into an edge that is not locked): that handle pulled out, on the
                // side the drag goes to
                const base = (e.shiftKey && !e.altKey) ? pathBase(itemCopy(item)) : null;
                if (base) {
                    const closed = !!base.closed, node = base.nodes[v.vertex];
                    const allowed = handleAllowed(base, v.vertex);
                    if (['h1', 'h2'].some(which => !node[which] && allowed(which) && nodeNeighbour(base.nodes, v.vertex, which, closed) >= 0)) {
                        mDrag = { kind: 'pull', sel: v.sel, vertex: v.vertex, pv, shift: true, base, allowed, before: itemsMap([v.sel.id]), canvas, moved: false };
                        break;
                    }
                }
                // a tile's corners and mirror sides stay where the group puts them: a click picks them, a drag does nothing
                const fixed = !!(item.tile && tileVertexFixed(item.tile, v.vertex));
                mDrag = { kind: 'vertex', sel: v.sel, vertex: v.vertex, pv, fixed, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey,
                          drag: ++mDragCount, canvas, moved: false };
                break;
            }
            // a segment of a selected outline keeps the selection (its double click adds a node there),
            // whatever item or copy lies on top of it; a click picks its two nodes (Shift: adds them),
            // a drag bends it (Inkscape's): a polyline becomes a path, a tile of points a curved tile
            // (pathBase), not on a tile's locked edge
            const s = segmentUnder(e);
            if (s) {
                const item = mDoc.getItem(s.sel.id);
                const locked = !!(item.tile && item.tile.edges[tileEdgeOfSegment(item.tile, s.index)].locked);
                const before = itemsMap([s.sel.id]);
                const base = (e.shiftKey || locked) ? null : pathBase(before.get(s.sel.id));
                mDrag = { kind: 'segment', bend: !!base, shift: e.shiftKey,
                          ctrl: e.ctrlKey || e.metaKey, alt: e.altKey, sel: s.sel, index: s.index, t: s.t, from: mEditor.mapWorld(s.sel.frame, e.wpnt),
                          base: base || before.get(s.sel.id), before, canvas, moved: false };
                break;
            }
            // anywhere else: a drag is a rubber band picking the nodes inside it, a click picks the item there
            mDrag = { kind: 'band', canvas, to: canvas, shift: e.shiftKey, moved: false,
                      press: { wpnt: e.wpnt, canvasX: e.canvasX, canvasY: e.canvasY, shiftKey: e.shiftKey } };
            break;
        }
        case 'pointermove':
            if (mShapeHandles.move(e) || mPictureDrag.move(e)) { e.isConsumed = true; break; }
            if (!mDrag || !(e.buttons & 1)) break;
            e.isConsumed = true;
            if (!mDrag.moved && Math.hypot(canvas[0] - mDrag.canvas[0], canvas[1] - mDrag.canvas[1]) < DRAG_PX) break;
            mDrag.moved = true;
            if (mDrag.kind === 'band') {
                mDrag.to = canvas;
            } else if (mDrag.kind === 'vertex') {
                if (mDrag.fixed) break;
                if (!mDrag.moving) startVertexDrag(mDrag);
                // the dragged node's world point: snapped, or with Ctrl across or up the canvas from where it was,
                // or with Alt (held now) along the nearer of its handle lines
                let target;
                if (e.altKey) {
                    target = handleLineTarget(mDrag, e.wpnt);
                    mSnapTarget = null;
                } else if (mDrag.ctrl) {
                    let dx = canvas[0] - mDrag.canvas[0], dy = canvas[1] - mDrag.canvas[1];
                    if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
                    else dx = 0;
                    const c0 = mView.toCanvas(mDrag.from);
                    target = mView.toWorld([c0[0] + dx, c0[1] + dy]).pnt;
                    mSnapTarget = null;
                } else {
                    mSnapTarget = mEditor.snap(e.wpnt, { itemId: mDrag.sel.id, vertex: mDrag.vertex, vertices: mDrag.vertices, drag: mDrag.drag }, canvas);
                    target = mSnapTarget ? mSnapTarget.wpnt : e.wpnt;
                }
                // every picked node moves by as much, through the frame of its copy
                const d = [target[0] - mDrag.from[0], target[1] - mDrag.from[1]];
                const after = movedPicked(mDrag.moving, mDrag.before, (w) => [w[0] + d[0], w[1] + d[1]]);
                if (!after) break;
                mDrag.after = after;
                mEditor.applyReplace(after);
            } else if (mDrag.kind === 'segment' && !mDrag.bend) {
                break;
            } else {
                const item = mDrag.base;
                const x = mEditor.mapWorld(mDrag.sel.frame, e.wpnt);
                // on a geodesic path in the chart of the node: its handles in line on a geodesic
                const chart = mEditor.nodeChart(item);
                const closed = !!item.closed;
                let nodes, prefer = -1;
                if (mDrag.kind === 'segment') {
                    if (item.tile) prefer = tileEdgeOfSegment(item.tile, mDrag.index);
                    // the segment bent through the pointer, the nearer handle moving more
                    nodes = segmentBent(item.nodes, closed, mDrag.index, mDrag.t, mDrag.from, x, chart);
                } else {
                    const node = item.nodes[mDrag.vertex];
                    const nodePx = pxTo(e, mEditor.mapWorld(mDrag.sel.frameInv, node.p));
                    // a pull: the handle on the side the drag goes to, once it is clear of the node
                    if (mDrag.kind === 'pull') {
                        if (nodePx <= PULL_PX) break;
                        mDrag.which = pulledHandle(item.nodes, mDrag.vertex, x, closed, chart, mDrag.allowed);
                        if (!mDrag.which) break;
                        mDrag.kind = 'handle';
                        mDrag.pulled = true;
                    }
                    if (item.tile) prefer = tileEdgeOfHandle(item.tile, mDrag.vertex, mDrag.which);
                    if (nodePx <= RETRACT_PX) {
                        // dropped on its node: retracted
                        nodes = handleRetracted(item.nodes, mDrag.vertex, mDrag.which);
                    } else {
                        // Ctrl: its direction snapped to 15 degrees; Shift (not on a pull): the other handle linked to it;
                        // Alt at the press: a smooth node made a corner
                        const at = (e.ctrlKey || e.metaKey) ? handleSnapped(node.p, x, SNAP_ANGLE, chart) : x;
                        nodes = e.shiftKey && !mDrag.pulled ? handleLinkedMoved(item.nodes, mDrag.vertex, mDrag.which, at, chart)
                                                            : handleMoved(item.nodes, mDrag.vertex, mDrag.which, at, !mDrag.alt, chart);
                    }
                }
                // a tile: the pairs follow; an edit a tile does not allow is not made
                const changed = nodesApplied(item, nodes, prefer);
                if (!changed) break;
                mDrag.after = new Map([[mDrag.sel.id, changed]]);
                mEditor.applyReplace(mDrag.after);
            }
            mRepaint();
            break;
        case 'pointerup':
            if (mShapeHandles.release() || mPictureDrag.release()) { e.isConsumed = true; break; }
            if (!mDrag) break;
            e.isConsumed = true;
            if (mDrag.kind === 'band') {
                if (mDrag.moved) bandReleased(mDrag);
                else pick(mDrag.press);
            } else if (mDrag.moved && mDrag.after) {
                const several = mDrag.kind === 'vertex' && mDrag.moving.reduce((n, m) => n + m.vertices.length, 0) > 1;
                const label = { vertex: several ? 'move nodes' : 'move node', handle: mDrag.pulled ? 'pull handle' : 'handle', segment: 'bend segment' }[mDrag.kind];
                mEditor.pushReplace(label, new Map([...mDrag.before].filter(([id]) => mDrag.after.has(id))), mDrag.after);
                // a node whose handle was pulled out is picked
                if (mDrag.pulled && mDrag.pv && !mEditor.isVertexPicked(mDrag.pv.id, mDrag.pv.vertex)) mEditor.setSelectedVertices([...mEditor.getSelectedVertices(), mDrag.pv]);
            } else if (!mDrag.moved && mDrag.kind === 'vertex' && mDrag.alt) {
                // Alt+click: the node removed, its path keeping its shape (Ctrl+Alt+click: the segments joined as they are)
                removeVertex(mDrag.pv.id, mDrag.pv.vertex, !mDrag.ctrl);
            } else if (!mDrag.moved && (mDrag.kind === 'vertex' || mDrag.kind === 'pull')) {
                clickedVertex(mDrag);
            } else if (!mDrag.moved && mDrag.kind === 'segment') {
                clickedSegment(mDrag);
            } else if (!mDrag.moved && mDrag.kind === 'handle' && mDrag.ctrl) {
                // Ctrl+click on a handle: retracted onto its node
                const item = mDrag.base;
                const changed = nodesApplied(item, handleRetracted(item.nodes, mDrag.vertex, mDrag.which),
                                             item.tile ? tileEdgeOfHandle(item.tile, mDrag.vertex, mDrag.which) : -1);
                if (changed) {
                    const after = new Map([[mDrag.sel.id, changed]]);
                    mEditor.applyReplace(after);
                    mEditor.pushReplace('retract handle', mDrag.before, after);
                }
            }
            mDrag = null;
            mSnapTarget = null;
            mRepaint();
            break;
        case 'dblclick': {
            e.preventDefault();
            e.isConsumed = true;
            // a curved polygon's or star's corner diamond: its corners smooth or sharp
            if (mShapeHandles.toggleCorner(e)) break;
            // a node of a path: smooth or a corner
            const dv = vertexUnder(e);
            if (dv) {
                toggleSmooth(dv.sel.id, dv.vertex);
                break;
            }
            const s = segmentUnder(e);
            if (s) { insertVertex(s.sel, s.index, mEditor.mapWorld(s.sel.frame, e.wpnt), s.t); break; }
            // a group or a shape holding items: edit inside it; nothing: a step out
            const hit = mEditor.hitTest(e.wpnt, canvas, undefined, mAccept);
            if (hit && !mTilesOnly && (hit.item.type === 'group' || hit.item.children)) mEditor.enterContainer(hit.item.id, hit.frame, hit.frameInv);
            else if (!hit) mEditor.leaveContainer();
            break;
        }
        default:
            break;
        }
    }

    /** the picked nodes moved by (dx, dy) canvas pixels, each on its copy; one undo step per run of nudges */
    function nudge(dx, dy){
        movePicked('nudge node', (w) => { const c = mView.toCanvas(w); return mView.toWorld([c[0] + dx, c[1] + dy]).pnt; }, 'nudge node');
    }

    function handleKey(e){
        if (e.type !== 'keydown') return;
        if (mEditor.handleCommonKey(e) || handleDepthKey(mEditor, e)) { e.isConsumed = true; return; }
        const ctrl = e.ctrlKey || e.metaKey;
        const step = e.shiftKey ? 10 : 1;
        switch (e.key) {
        // Delete: a path keeps its shape; Ctrl+Delete: the segments joined as they are
        case 'Delete':
        case 'Backspace':
            removePicked(!ctrl);
            e.isConsumed = true;
            break;
        // Insert (Inkscape's): a node on each segment between the picked nodes
        case 'Insert':
            if (!ctrl && !e.altKey && !e.shiftKey) {
                addNode();
                e.isConsumed = true;
            }
            break;
        // Shift+B, Shift+J (Inkscape's): break at the picked nodes, join two picked ends
        case 'b':
        case 'B':
        case 'j':
        case 'J':
            if (e.shiftKey && !ctrl && !e.altKey) {
                if (e.key.toLowerCase() === 'b') breakPicked(); else joinPicked(true);
                e.isConsumed = true;
            }
            break;
        case 'Escape':
            if (mEditor.getSelectedVertices().length) mEditor.setSelectedVertex(null);
            else if (mEditor.getContainer()) mEditor.leaveContainer();
            else mEditor.clearSelection();
            e.isConsumed = true;
            break;
        case 'ArrowLeft':  nudge(-step, 0); e.isConsumed = true; break;
        case 'ArrowRight': nudge(step, 0); e.isConsumed = true; break;
        case 'ArrowUp':    nudge(0, -step); e.isConsumed = true; break;
        case 'ArrowDown':  nudge(0, step); e.isConsumed = true; break;
        // Shift+U, Shift+L (Inkscape's): the picked node's segments curves or lines
        case 'u':
        case 'U':
        case 'l':
        case 'L':
            if (e.shiftKey && !ctrl && !e.altKey) {
                setSegmentsCurved(e.key.toLowerCase() === 'u');
                e.isConsumed = true;
            }
            break;
        // Shift+C, S, Y, A (Inkscape's): the picked node's type; taken before the palette's tool keys
        case 'c':
        case 'C':
        case 's':
        case 'S':
        case 'y':
        case 'Y':
            if (e.shiftKey && !ctrl && !e.altKey) {
                typePicked(TYPE_OF_KEY[e.key.toLowerCase()]);
                e.isConsumed = true;
            }
            break;
        // Tab, Shift+Tab: the next or previous node picked
        case 'Tab':
            if (!ctrl && !e.altKey && stepPicked(e.shiftKey ? -1 : 1)) e.isConsumed = true;
            break;
        case 'a':
        case 'A':
            if (ctrl) {
                pickAll();
                e.isConsumed = true;
            } else if (e.shiftKey && !e.altKey) {
                typePicked('auto');
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
    /** the mark of a vertex (D3): a tile's fixed corner a disc; a node by its type, a corner a square, smooth a disc, symmetric a diamond, auto a disc with a dot */
    function vertexMark(item, vertex){
        if (item.tile && tileVertexFixed(item.tile, vertex)) return 'disc';
        const n = item.nodes && item.nodes[vertex];
        return n ? { corner: 'square', smooth: 'disc', symmetric: 'diamond', auto: 'auto' }[nodeType(n)] : 'square';
    }

    /** the same as geometry in world coordinates, for the GPU pass */
    function getOverlayGeometry(){
        const geo = mEditor.newGeometry();
        mEditor.containerGeometry(geo);
        for (const sel of selection()) {
            const item = mDoc.getItem(sel.id);
            if (!item) continue;
            mEditor.outlineGeometry(geo, mEditor.itemWorldPath(item, sel.frameInv));
            vertexWorldPoints(sel).forEach((w, vertex) => mEditor.handleGeometry(geo, w, mEditor.isVertexPicked(sel.id, vertex), vertexMark(item, vertex)));
        }
        // the control handles of the picked nodes and of their neighbours on their segments
        for (const h of shownHandleList()) {
            const node = h.item.nodes[h.vertex];
            mEditor.controlHandleGeometry(geo, mEditor.mapWorld(h.sel.frameInv, node.p), mEditor.mapWorld(h.sel.frameInv, node[h.which]), !!h.item.geodesic);
        }
        if (mDrag && mDrag.kind === 'band' && mDrag.moved) mEditor.bandGeometry(geo, mDrag.canvas, mDrag.to);
        mPictureDrag.geometry(geo);
        mShapeHandles.geometry(geo);
        mEditor.snapGeometry(geo, mSnapTarget);
        return geo;
    }

    function renderUI(ctx){
        mEditor.drawContainer(ctx);
        for (const sel of selection()) {
            const item = mDoc.getItem(sel.id);
            if (!item) continue;
            mEditor.drawOutline(ctx, mEditor.itemCanvasPath(item, sel.frameInv));
            vertexCanvasPoints(sel).forEach((c, vertex) => mEditor.drawHandle(ctx, c, mEditor.isVertexPicked(sel.id, vertex), vertexMark(item, vertex)));
        }
        // the control handles of the picked nodes and of their neighbours on their segments
        for (const h of shownHandleList()) {
            const node = h.item.nodes[h.vertex];
            const w = mEditor.mapWorld(h.sel.frameInv, node.p), wh = mEditor.mapWorld(h.sel.frameInv, node[h.which]);
            mEditor.drawControlHandle(ctx, mView.toCanvas(w), mView.toCanvas(wh), mEditor.handleStalk(w, wh, !!h.item.geodesic).map(q => mView.toCanvas(q)));
        }
        if (mDrag && mDrag.kind === 'band' && mDrag.moved) mEditor.drawBand(ctx, mDrag.canvas, mDrag.to);
        mPictureDrag.draw(ctx);
        mShapeHandles.draw(ctx);
        mEditor.drawSnap(ctx, mSnapTarget);
    }

    // the conversions of the outlines: To polyline and To path buttons in the property bar, the rest its menu; all in the right click menu
    const mCommands = DrawingCommands(mEditor);
    const CONVERSIONS = ['toPath', 'toPolyline', 'fitCurves', '-', 'toGeodesic', 'toEuclidean', '-', 'releaseTile'];
    const MENU_CONVERSIONS = ['fitCurves', '-', 'toGeodesic', 'toEuclidean', '-', 'releaseTile'];
    // a tile's: To path keeps its pairing (a curved tile), To polyline too, Release tile drops it
    const TILE_CONVERSIONS = ['toPath', 'toPolyline', '-', 'releaseTile'];
    /** is an outline or a shape selected: the conversions apply */
    const converts = () => selection().some(s => { const it = mDoc.getItem(s.id); return hasNodes(it) || !!(it && it.shape); });

    /** the node's commands, as popup menu items (in the Tile tool without break, join and close, which tiles do not take) */
    function nodeMenuItems(){
        const type = pickedType(), can = canTypePicked();
        const outlineOnly = new Set(['break', 'join', 'joinSegment', 'close']);
        return [
            { label: 'Add nodes  Insert', title: 'in the middle of each segment between the picked nodes (one picked: the segment after it)', disabled: !canAddNode(), action: addNode },
            { label: 'Remove nodes  Delete', title: 'the picked nodes; a path keeps its shape, each run of segments through them refitted by one curve',
              disabled: !canRemoveNode(), action: () => removePicked(true) },
            { label: 'Remove nodes as they are  Ctrl+Delete', title: 'the picked nodes, their segments joined as they are',
              disabled: !canRemoveNode(), action: () => removePicked(false) },
            { op: 'break', label: 'Break  Shift+B', title: 'the outline broken at the picked nodes: a closed one opens there, an open one splits into outlines',
              disabled: !canBreak(), action: breakPicked },
            { op: 'join', label: 'Join  Shift+J', title: 'the two picked ends merged at their midpoint: one open outline closes, two become one',
              disabled: !canJoin(true), action: () => joinPicked(true) },
            { op: 'joinSegment', label: 'Join with segment', title: 'a straight segment between the two picked ends: one open outline closes, two become one',
              disabled: !canJoin(false), action: () => joinPicked(false) },
            ...NODE_TYPES.map(t => ({ label: `${TYPE_INFO[t].name}  Shift+${TYPE_INFO[t].key}`, checked: type === t,
                                      title: `the picked nodes ${t === 'corner' ? 'corners' : t}: ${TYPE_INFO[t].title} (Ctrl+click a node cycles the types; a tile's corners and the ends of an open outline stay corners)`,
                                      disabled: !can, action: () => typePicked(t) })),
            { label: 'Make segments curves  Shift+U', title: 'the picked node\'s straight segments get handles at their thirds (a polyline becomes a path)',
              disabled: !canCurve(), action: () => setSegmentsCurved(true) },
            { label: 'Make segments lines  Shift+L', title: 'the handles of the picked node\'s segments retracted',
              disabled: !canStraighten(), action: () => setSegmentsCurved(false) },
            allClosed()
                ? { op: 'close', label: 'Open', title: 'the segment after the picked node goes (else the closing one)', action: () => setClosed(false) }
                : { op: 'close', label: 'Close', title: 'a straight segment from the last node to the first',
                    disabled: !closeTargets().some(canToggleClosed), action: () => setClosed(true) },
        ].filter(item => !(mTilesOnly && outlineOnly.has(item.op))).map(({ op, ...item }) => item);
    }

    /** a curved polygon's or star's corners smooth or sharp, as popup menu items */
    function cornerMenuItems(){
        const item = mEditor.getSelectedShape();
        const s = item ? item.shape : null;
        if (!s || !s.curved || !s.smooth) return [];
        const names = { o: s.kind === 'star' ? 'outer corners' : 'corners', i: 'inner corners' };
        return Object.keys(s.smooth).map(c => ({
            label: `Make ${names[c]} ${s.smooth[c] ? 'sharp' : 'smooth'}`,
            title: 'a smooth corner keeps its handles in line (or double click its diamond)',
            action: () => mEditor.setShapeValue(c === 'o' ? 'smoothO' : 'smoothI', !s.smooth[c]),
        }));
    }

    /** the menu of a right click: the node under the pointer is picked
     *  first (a picked one keeps the others; the item under it selected), then the node's commands and the
     *  conversions of the outlines; shapes, which have no nodes, the
     *  switches of a curved polygon's or star's corners and the conversions */
    function getContextMenu(e){
        const v = (Number.isFinite(e.canvasX) && e.wpnt) ? vertexUnder(e) : null;
        // a picked node keeps the others (the commands act on them all), another is picked alone
        if (v && mEditor.isVertexPicked(v.sel.id, v.vertex)) mEditor.setSelectedVertices([...mEditor.getSelectedVertices(), { id: v.sel.id, vertex: v.vertex }]);
        else if (v) mEditor.setSelectedVertex({ id: v.sel.id, vertex: v.vertex });
        else {
            const hit = e.wpnt ? mEditor.hitTest(e.wpnt, [e.canvasX, e.canvasY], undefined, mAccept) : null;
            if (hit && !mEditor.isSelected(hit.item.id)) mEditor.setSelection([{ id: hit.item.id, frame: hit.frame, frameInv: hit.frameInv }]);
        }
        if (!selection().some(s => hasNodes(mDoc.getItem(s.id)))) {
            const corners = cornerMenuItems();
            const conversions = converts() ? mCommands.menuItems(CONVERSIONS) : [];
            return corners.length && conversions.length ? [...corners, { separator: true }, ...conversions] : [...corners, ...conversions];
        }
        return [...nodeMenuItems(), { separator: true }, ...mCommands.menuItems(mTilesOnly ? TILE_CONVERSIONS : CONVERSIONS)];
    }

    /** the property bar, in groups that wrap into rows: snap and, while an
     *  outline or a shape is selected, the menu of the conversions; while
     *  anything is selected To polyline and To path; while an outline
     *  with nodes is selected the picked node's commands; the numbers of a
     *  shape selected alone (the style is the style panel's) */
    function getProperties(){
        const nodes = { visible: () => selection().some(s => hasNodes(mDoc.getItem(s.id))) };
        // the Tile tool's bar (TileTool.js adds its own around it): snap, the conversions, the picked node's commands that tiles take
        if (mTilesOnly) return [
            { kind: 'group', controls: [snapProperty(mEditor)] },
            convertProperties(mCommands, { visible: () => selection().length > 0 }),
            { kind: 'group', title: 'the picked node', ...nodes, controls: pickedNodeControls() },
        ];
        return [
            containerProperties(mEditor),
            { kind: 'group', controls: [
                snapProperty(mEditor),
                { kind: 'menu', icon: mCommands.icon('menu'), title: 'fit curves, to geodesic, to Euclidean, release tile', visible: converts,
                  items: () => mCommands.menuItems(MENU_CONVERSIONS) },
            ] },
            convertProperties(mCommands, { visible: () => selection().length > 0 }),
            { kind: 'group', title: 'the picked node', ...nodes, controls: pickedNodeControls() },
            ...selectedShapeProperties(mEditor),
            depthProperty(mEditor),
            ...pictureProperties(mEditor, mCommands),
        ];
    }

    /** the picked node's commands in the bar; in the Tile tool without break, join and close */
    function pickedNodeControls(){
        return [
            { kind: 'button', icon: ICONS.addNode, title: 'Add nodes (Insert): in the middle of each segment between the picked nodes, one picked: the segment after it (or double click a segment)',
              enabled: canAddNode, action: addNode },
            { kind: 'button', icon: ICONS.removeNode, title: 'Remove the picked nodes (Delete; Alt+click removes a node, Alt+drag moves it along its handle lines): a path keeps its shape, each run of segments through them refitted by one curve (Ctrl+Delete: the segments joined as they are)',
              enabled: canRemoveNode, action: () => removePicked(true) },
            { outlineOnly: true, kind: 'button', icon: ICONS.breakNode, title: 'Break (Shift+B): the outline broken at the picked nodes, a closed one opens there, an open one splits into outlines',
              enabled: canBreak, action: breakPicked },
            { outlineOnly: true, kind: 'button', icon: ICONS.joinNodes, title: 'Join (Shift+J): the two picked ends merged at their midpoint, one open outline closes, two become one',
              enabled: () => canJoin(true), action: () => joinPicked(true) },
            { outlineOnly: true, kind: 'button', icon: ICONS.joinSegment, title: 'Join with segment: a straight segment between the two picked ends, one open outline closes, two become one',
              enabled: () => canJoin(false), action: () => joinPicked(false) },
            { kind: 'iconChoice', title: 'the type of the picked nodes (Ctrl+click a node cycles them)', enabled: canTypePicked, get: pickedType, set: typePicked,
              options: NODE_TYPES.map(t => ({ value: t, icon: ICONS[t], title: `${TYPE_INFO[t].name} (Shift+${TYPE_INFO[t].key}): ${TYPE_INFO[t].title}` })) },
            { kind: 'button', icon: ICONS.curves, title: 'Make segments curves (Shift+U): the straight segments of the picked node, or between the picked nodes, get handles at their thirds, the outline as it was (a polyline becomes a path)',
              enabled: canCurve, action: () => setSegmentsCurved(true) },
            { kind: 'button', icon: ICONS.lines, title: 'Make segments lines (Shift+L): the handles of the segments of the picked node, or between the picked nodes, retracted',
              enabled: canStraighten, action: () => setSegmentsCurved(false) },
            { outlineOnly: true, kind: 'toggle', icon: ICONS.closed, title: 'Closed: a straight segment from the last node to the first; off: opened after the picked node (else the closing segment goes)',
              enabled: () => closeTargets().some(canToggleClosed), get: allClosed, set: setClosed },
            { kind: 'number', label: 'X', title: 'X: the centre of the box round the picked nodes, on their copies (world units); typed, they all move',
              step: 0.001, digits: 4, width: 7, visible: () => pickedAll().length > 0, get: () => (pickedCentre() || [0, 0])[0], set: (v) => movePickedTo(0, v) },
            { kind: 'number', label: 'Y', title: 'Y: the centre of the box round the picked nodes, on their copies (world units); typed, they all move',
              step: 0.001, digits: 4, width: 7, visible: () => pickedAll().length > 0, get: () => (pickedCentre() || [0, 0])[1], set: (v) => movePickedTo(1, v) },
        ].filter(c => !(mTilesOnly && c.outlineOnly)).map(({ outlineOnly, ...c }) => c);
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
        getOverlayGeometry,
        getProperties,
        getContextMenu,
        setActive: (active) => { if (!active) { mDrag = null; mSnapTarget = null; mShapeHandles.cancel(); mPictureDrag.cancel(); } },
    };

} // function NodeTool()

export { NodeTool };
