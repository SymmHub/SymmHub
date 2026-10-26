import {
    ParamCustom,
    ParamGroup,
    ParamRow,
    worldToPatternMap,
    patternToWorldMap,
    itemFoldElement,
    applyTransform,
    composeTransforms,
    localScale,
    foldPoint,
    boxCopies,
    itemCopies,
    imageItemFromBlob,
    placeQuad,
    svgToItems,
    withNodes,
    mappedNodes,
    pathFromPolyline,
    polylineFromPath,
    fitCurve,
    tileFromDomain,
    tileEdgeStarts,
    tileReplacedEdge,
    wordMap,
    hitsPolyline,
    UndoStack,
    SnapIndex,
} from './modules.js';

//
//  DrawingEditor - what the drawing tools share
//
//  - the selection: items picked on some copy, each with the frame c of that
//    copy (Orbits.js: c maps the neighbourhood of the pointer, in pattern
//    coordinates, onto the item's own place), so handles and drags work on the
//    copy the user sees, for every map of the group;
//  - the undo stack of the item edits;
//  - the snap index (vertices of all copies, mirrors, cone points);
//  - the style of new items (the 'style' settings), which also restyles the
//    selection;
//  - the maps between world, pattern and canvas coordinates, and drawing on
//    the 2D overlay through a copy's frame.
//
//  par: document, getContext() -> {group (pattern coordinates), ptc},
//       view ({toWorld, toCanvas, isLinear, pixelSize}), repaint
//

const PICK_PX = 6;          // pick tolerance, canvas pixels
const SNAP_PX = 10;         // snap radius, canvas pixels
const EDGE_END_PX = 10;     // reach of a tile's corner for a stroke that reshapes an edge
const FIT_PX = 1.5;         // how far a fitted curve may leave the points, canvas pixels
const CAPS = ['round', 'butt', 'square'];
const JOINS = ['round', 'miter', 'bevel'];

function hexToRgb(hex){
    const h = (hex || '#000000').replace('#', '');
    return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)/255);
}

function rgbToHex(rgb){
    return '#' + rgb.slice(0, 3).map(v => Math.round(255*Math.max(0, Math.min(1, v))).toString(16).padStart(2, '0')).join('');
}

function DrawingEditor(par) {

    const mDoc = par.document;
    const mGetContext = par.getContext;
    const mView = par.view;
    const mRepaint = par.repaint || (() => {});

    const mUndo = UndoStack({ onChange: () => mRepaint() });
    const mSnap = SnapIndex();
    let mSnapKey = '';

    // [{id, frame (ITransform or null), frameInv}]
    let mSelection = [];
    // {id, vertex} of a picked vertex of a selected item, or null
    let mSelectedVertex = null;

    // fold elements and copies, kept while document, group and pattern box stay
    let mCacheKey = '';
    let mCacheGroup = null;
    let mFoldCache = new Map();
    // the closed item being edited inside, {id, frameInv (the copy it was entered on)}, or null
    let mContainer = null;
    // item id -> {key, copies}: the tiles meeting the item's box, as a sprite
    const mItemCopies = new Map();
    let mCopies = null;

    // ── style ────────────────────────────────────────────────────────────────

    const mStyleCfg = {
        stroke:        '#cc1a1a',
        strokeOpacity: 1,
        width:         0.02,
        filled:        false,
        fill:          '#3366e6',
        fillOpacity:   1,
        cap:           'round',
        join:          'round',
        // the colour class whose tiles alone show the item (-1: every tile)
        colorClass:    -1,
        snap:          true,
        // freehand strokes fitted with curves
        fitCurves:     false,
    };
    let mSettingStyle = false;

    function styleFromConfig(){
        const c = mStyleCfg;
        return {
            stroke:      { rgba: [...hexToRgb(c.stroke), c.strokeOpacity] },
            strokeWidth: c.width,
            lineCap:     c.cap,
            lineJoin:    c.join,
            fill:        c.filled ? { rgba: [...hexToRgb(c.fill), c.fillOpacity] } : null,
            opacity:     1,
            ...(c.colorClass >= 0 ? { motifClass: c.colorClass } : {}),
        };
    }

    /** show the style of an item in the style settings (the items keep theirs) */
    function configFromStyle(style){
        const c = mStyleCfg;
        if (style.stroke) { c.stroke = rgbToHex(style.stroke.rgba); c.strokeOpacity = style.stroke.rgba[3] ?? 1; }
        c.width = style.strokeWidth;
        c.cap = style.lineCap || 'round';
        c.join = style.lineJoin || 'round';
        c.filled = !!style.fill;
        if (style.fill) { c.fill = rgbToHex(style.fill.rgba); c.fillOpacity = style.fill.rgba[3] ?? 1; }
        c.colorClass = style.motifClass ?? -1;
        mSettingStyle = true;
        mStyleParams.updateDisplay();
        mSettingStyle = false;
    }

    /** a style setting changed: restyle the selection (one undo step per setting dragged) */
    function onStyleChanged(key){
        if (key === 'snap' || key === 'fitCurves' || mSettingStyle || !mSelection.length) return;
        const style = styleFromConfig();
        const ids = mSelection.map(s => s.id);
        const before = new Map(ids.map(id => [id, mDoc.getItem(id)]).filter(e => e[1]));
        const after = new Map();
        before.forEach((item, id) => {
            const merged = { ...item.style, ...style, opacity: item.style.opacity };
            if (mStyleCfg.colorClass < 0) delete merged.motifClass;
            after.set(id, { ...item, style: merged });
        });
        applyReplace(after);
        pushReplace('style', before, after, 'style:' + key);
    }

    // the settings are saved one value each (as they were when every value
    // had a row of its own); the panel shows them in a few rows of related
    // values, which only show and edit them
    const mStyleRows = {};
    const styleValue = key => ParamCustom({
        getValue: () => mStyleCfg[key],
        setValue: (v) => { if (v !== undefined) mStyleCfg[key] = v; Object.values(mStyleRows).forEach(r => r.updateDisplay()); },
    });
    const styleRow = (name, tooltip, controls) => ParamRow({ name, tooltip, onChange: onStyleChanged,
                                                              controls: controls.map(c => ({ ...c, obj: mStyleCfg })) });
    mStyleRows.strokeRow = styleRow('stroke', 'stroke: colour, opacity, width', [
        { kind: 'color',  key: 'stroke',        tooltip: 'stroke colour' },
        { kind: 'number', key: 'strokeOpacity', min: 0, max: 1, step: 0.01, tooltip: 'stroke opacity' },
        { kind: 'number', key: 'width',         min: 0, max: 1, step: 0.001, tooltip: 'stroke width' },
    ]);
    mStyleRows.fillRow = styleRow('fill', 'closed shapes filled: colour, opacity', [
        { kind: 'bool',   key: 'filled',      tooltip: 'fill closed shapes' },
        { kind: 'color',  key: 'fill',        tooltip: 'fill colour' },
        { kind: 'number', key: 'fillOpacity', min: 0, max: 1, step: 0.01, tooltip: 'fill opacity' },
    ]);
    mStyleRows.lineRow = styleRow('line', 'cap and join of the stroke', [
        { kind: 'choice', key: 'cap',  choice: CAPS,  tooltip: 'cap' },
        { kind: 'choice', key: 'join', choice: JOINS, tooltip: 'join' },
    ]);
    mStyleRows.classRow = styleRow('class', 'the colour class whose tiles alone show the shape (-1: every tile); snap to the copies; freehand strokes fitted with curves', [
        { kind: 'number', key: 'colorClass', min: -1, max: 23, step: 1, tooltip: 'colour class (-1: every tile)' },
        { kind: 'bool',   key: 'snap',       tooltip: 'snap to the vertices of the copies, mirrors and cone points' },
        { kind: 'bool',   key: 'fitCurves',  tooltip: 'freehand strokes fitted with curves' },
    ]);
    const mStyleParams = ParamGroup({
        name: 'style',
        params: {
            ...Object.fromEntries(Object.keys(mStyleCfg).map(key => [key, styleValue(key)])),
            ...mStyleRows,
        },
    });

    // the shape tool's settings (ShapeTool.js): the kind and its numbers
    const mShapeCfg = { kind: 'rect', n: 5, ratio: 0.5, round: 0 };
    const mShapeParams = ParamRow({ name: 'shape', tooltip: 'the shape tool: kind; n corners, points or turns; the star\'s inner radius; the rect\'s rounding',
        controls: [
            { kind: 'choice', obj: mShapeCfg, key: 'kind',  choice: ['rect', 'ellipse', 'polygon', 'star', 'spiral'], tooltip: 'kind' },
            { kind: 'number', obj: mShapeCfg, key: 'n',     min: 1, max: 64, step: 1, tooltip: 'corners of a polygon, points of a star, turns of a spiral' },
            { kind: 'number', obj: mShapeCfg, key: 'ratio', min: 0.05, max: 1, step: 0.01, tooltip: 'inner radius of a star' },
            { kind: 'number', obj: mShapeCfg, key: 'round', min: 0, max: 1, step: 0.01, tooltip: 'rounding of a rect\'s corners (of the shorter side)' },
        ] });

    // ── coordinates ──────────────────────────────────────────────────────────

    function context(){
        const ctx = mGetContext();
        const key = [mDoc.getVersion(), ctx.ptc.centerX, ctx.ptc.centerY, ctx.ptc.scale, ctx.ptc.angle].join(' ');
        if (key !== mCacheKey || ctx.group !== mCacheGroup) {
            mCacheKey = key;
            if (ctx.group !== mCacheGroup) { mCopies = null; mItemCopies.clear(); mCacheGroup = ctx.group; }
            mFoldCache = new Map();
        }
        return ctx;
    }

    function maps(){
        const ctx = context();
        return { toPattern: worldToPatternMap(ctx.ptc), fromPattern: patternToWorldMap(ctx.ptc), ctx };
    }

    function copies(){
        const ctx = context();
        if (!mCopies) mCopies = boxCopies(ctx.group);
        return mCopies;
    }

    function foldElementOf(item){
        const ctx = context();
        if (!mFoldCache.has(item.id)) {
            // a sprite is never folded
            const h = ctx.sprites ? null : itemFoldElement(item, ctx.group, ctx.ptc);
            mFoldCache.set(item.id, { h, hInv: h ? h.getInverse() : null });
        }
        return mFoldCache.get(item.id);
    }

    /**
     * the copies of the domain an item can be seen through: as a sprite the
     * tiles meeting its box (pattern coordinates), else the tiles of the
     * pattern box
     */
    function copiesOf(item, pts, halfWidth){
        const ctx = context();
        if (!ctx.sprites) return copies();
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i + 1 < pts.length; i += 2) {
            x0 = Math.min(x0, pts[i]);     x1 = Math.max(x1, pts[i]);
            y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]);
        }
        const box = { cx: 0.5*(x0 + x1), cy: 0.5*(y0 + y1), half: 0.5*Math.max(x1 - x0, y1 - y0, 1e-6) + halfWidth };
        const key = [box.cx, box.cy, box.half].join(' ');
        const cached = mItemCopies.get(item.id);
        if (cached && cached.key === key) return cached.copies;
        const result = itemCopies(ctx.group, box);
        mItemCopies.set(item.id, { key, copies: result });
        return result;
    }

    /** pattern units per canvas pixel near the world point w */
    function patternPerPixel(){
        return mView.pixelSize()*worldToPatternMap(context().ptc).scale;
    }

    /** item points in pattern coordinates */
    function patternPoints(item, toPattern){
        const out = [];
        for (let i = 0; i + 1 < item.points.length; i += 2) out.push(...toPattern.map(item.points[i], item.points[i + 1]));
        return out;
    }

    /** a world point mapped by a frame (c or c^-1), through pattern coordinates */
    function mapWorld(frame, w, m = maps()){
        if (!frame) return [w[0], w[1]];
        const q = applyTransform(frame, m.toPattern.map(w[0], w[1]));
        return m.fromPattern.map(q[0], q[1]);
    }

    // ── picking ──────────────────────────────────────────────────────────────

    /**
     * the item copy under the world point w (top first):
     * {item, frame c, frameInv} or null; frame maps the pointer's
     * neighbourhood onto the item's own place
     */
    function hitTest(w, tolPx = PICK_PX){
        const m = maps();
        const group = m.ctx.group;
        const s = m.toPattern.map(w[0], w[1]);
        const f = foldPoint(group, s);
        const tolS = tolPx*patternPerPixel();
        const halfWidthOf = item => 0.5*(item.style.stroke ? item.style.strokeWidth*m.toPattern.scale : 0);
        // the item (or a child of it, seen through its parent's copies) under the point
        function test(item, parent){
            const holder = parent || item;
            const hpts = patternPoints(holder, m.toPattern);
            const pts = parent ? patternPoints(item, m.toPattern) : hpts;
            const halfWidth = halfWidthOf(item);
            const { hInv } = foldElementOf(holder);
            for (const copy of copiesOf(holder, hpts, halfWidthOf(holder))) {
                const q = applyTransform(copy.fromFD, f.pnt);
                const x = applyTransform(hInv, q);
                const frame = composeTransforms(f.transform, copy.fromFD, hInv);
                const tol = tolS*localScale(frame, s) + halfWidth;
                if (hitsPolyline(x, pts, item.closed, !!item.style.fill || item.type === 'image', tol)) {
                    return { item, parent, frame, frameInv: frame ? frame.getInverse() : null };
                }
            }
            return null;
        }
        // inside a container its children come first
        const container = mContainer ? mDoc.getItem(mContainer.id) : null;
        if (container && container.children) {
            for (const child of container.children.slice().reverse()) {
                const hit = test(child, container);
                if (hit) return hit;
            }
        }
        for (const item of mDoc.getEditableItems().slice().reverse()) {
            const hit = test(item, null);
            if (hit) return hit;
        }
        return null;
    }

    // ── the container: a closed item edited inside ───────────────────────────

    /**
     * edit inside the item: new items go into it, its children are picked.
     * frame, frameInv: the copy it was entered on (frame maps that copy onto
     * the item's own place), so that what is drawn on the copy lands inside
     * the item
     */
    function enterContainer(id, frame, frameInv){
        const item = mDoc.getItem(id);
        if (!item || !item.closed) return;
        mContainer = { id, frame, frameInv };
        mSelection = [];
        mSelectedVertex = null;
        mRepaint();
    }

    function leaveContainer(){
        if (!mContainer) return;
        mContainer = null;
        mSelection = [];
        mSelectedVertex = null;
        mRepaint();
    }

    /** the outline of the container being edited, on the copy it was entered on */
    function drawContainer(ctx){
        if (!mContainer) return;
        const item = mDoc.getItem(mContainer.id);
        if (!item) { mContainer = null; return; }
        const path = itemCanvasPath(item, mContainer.frameInv);
        ctx.save();
        ctx.beginPath();
        path.forEach((c, i) => i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1]));
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeStyle = 'rgba(0, 150, 255, 0.9)';
        ctx.stroke();
        ctx.restore();
    }

    // ── snapping ─────────────────────────────────────────────────────────────

    /**
     * the snap target for the pointer at world w: {wpnt, kind, ...} or null
     * exclude: {itemId, vertex} of the point being dragged
     */
    /**
     * the snap target for the world point w: {wpnt, kind, itemId, vertex} or
     * null. exclude: {itemId, vertex, vertices, drag} leaves out the vertex
     * (vertices) being dragged; the index is built once per drag (drag: a
     * token of the drag), not for every move of the dragged item
     */
    function snap(w, exclude = null){
        if (!mStyleCfg.snap) return null;
        const m = maps();
        const radius = SNAP_PX*patternPerPixel();
        const version = (exclude && exclude.drag) ? 'drag ' + exclude.drag : mCacheKey;
        const key = [version, radius.toPrecision(3), exclude ? exclude.itemId + ':' + (exclude.vertices || [exclude.vertex]).join(',') : ''].join('|');
        if (key !== mSnapKey) {
            mSnapKey = key;
            mSnap.build({ items: mDoc.getEditableItems(), group: m.ctx.group, ptc: m.ctx.ptc, radius, exclude });
        }
        const s = m.toPattern.map(w[0], w[1]);
        const hit = mSnap.query(s, radius);
        if (!hit) return null;
        return { ...hit, wpnt: m.fromPattern.map(hit.pnt[0], hit.pnt[1]) };
    }

    // ── selection ────────────────────────────────────────────────────────────

    function setSelection(list){
        mSelection = list.filter(s => mDoc.getItem(s.id));
        mSelectedVertex = null;
        if (mSelection.length) configFromStyle(mDoc.getItem(mSelection[0].id).style);
        mRepaint();
    }

    function isSelected(id){
        return mSelection.some(s => s.id === id);
    }

    function clearSelection(){
        if (!mSelection.length && !mSelectedVertex) return;
        mSelection = [];
        mSelectedVertex = null;
        mRepaint();
    }

    // ── undoable edits ───────────────────────────────────────────────────────

    function applyReplace(map){
        map.forEach((item, id) => { if (item) mDoc.updateItem(id, item); });
    }

    /** record a replacement of items done already (before, after: Map id -> item) */
    function pushReplace(label, before, after, mergeKey = null){
        const b = new Map([...before].map(([id, it]) => [id, JSON.parse(JSON.stringify(it))]));
        const a = new Map([...after].map(([id, it]) => [id, JSON.parse(JSON.stringify(it))]));
        mUndo.push({ label, mergeKey, undo: () => applyReplace(b), redo: () => applyReplace(a) });
    }

    /** the item as drawn on the container's copy, moved onto the container's own place */
    function intoContainer(item){
        const frame = mContainer && mContainer.frame;
        if (!frame) return item;
        const m = maps();
        const points = [];
        for (let i = 0; i + 1 < item.points.length; i += 2) points.push(...mapWorld(frame, [item.points[i], item.points[i + 1]], m));
        // the stroke width as it is on the copy: scaled with the map there
        let sx = 0, sy = 0, n = item.points.length/2;
        for (let i = 0; i + 1 < item.points.length; i += 2) { sx += item.points[i]; sy += item.points[i + 1]; }
        const scale = n ? localScale(frame, m.toPattern.map(sx/n, sy/n)) : 1;
        const style = { ...item.style, strokeWidth: (item.style.strokeWidth || 0)*scale };
        if (item.nodes) return withNodes({ ...item, style }, mappedNodes(item.nodes, w => mapWorld(frame, w, m)));
        return { ...item, points, style };
    }

    /** how far a fitted curve may leave the points: FIT_PX canvas pixels, in world units */
    function fitTolerance(){
        return FIT_PX*mView.pixelSize();
    }

    /** the item (a polyline) as a path of curves fitted to its points; the item itself when they are too few */
    function fittedItem(item, tolerance = fitTolerance()){
        const pts = [];
        for (let i = 0; i + 1 < item.points.length; i += 2) pts.push([item.points[i], item.points[i + 1]]);
        const nodes = fitCurve(pts, !!item.closed, tolerance);
        return nodes.length >= 2 ? withNodes(item, nodes) : item;
    }

    /** the selected polylines as paths of curves fitted to their vertices; one undo step */
    function fitSelection(){
        const before = new Map(), after = new Map();
        for (const sel of mSelection) {
            const item = mDoc.getItem(sel.id);
            if (!item || item.type !== 'polyline' || item.tile || item.points.length < 6) continue;
            const fitted = fittedItem(item);
            if (fitted === item) continue;
            before.set(item.id, item);
            after.set(item.id, fitted);
        }
        if (!after.size) return;
        applyReplace(after);
        pushReplace('fit curves', before, after);
        mSelectedVertex = null;
        mRepaint();
    }

    // ── transforms of the selection ─────────────────────────────────────────

    /** the item with every point mapped (world to world): its points or nodes, an image's quad, its children */
    function mappedItem(item, map){
        let out;
        if (item.nodes) {
            out = withNodes(item, mappedNodes(item.nodes, map));
        } else {
            const points = [];
            for (let i = 0; i + 1 < item.points.length; i += 2) points.push(...map([item.points[i], item.points[i + 1]]));
            out = { ...item, points };
        }
        if (item.children) out.children = item.children.map(c => mappedItem(c, map));
        return out;
    }

    /**
     * the selection as seen: the box [x0, y0, x1, y1] (world) round the
     * outlines of the items on the copies they were picked on; null without
     * one (tiles stay out of it)
     */
    function selectionBox(){
        const m = maps();
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const sel of mSelection) {
            const item = mDoc.getItem(sel.id);
            if (!item || item.tile) continue;
            for (let i = 0; i + 1 < item.points.length; i += 2) {
                const w = mapWorld(sel.frameInv, [item.points[i], item.points[i + 1]], m);
                x0 = Math.min(x0, w[0]); x1 = Math.max(x1, w[0]);
                y0 = Math.min(y0, w[1]); y1 = Math.max(y1, w[1]);
            }
        }
        return x0 <= x1 ? [x0, y0, x1, y1] : null;
    }

    /**
     * the items of before (Map id -> item, the selection as it was) with a
     * map of the seen world applied through each one's frame, so that it
     * acts on the copy the user sees: Map id -> item (tiles left out)
     */
    function transformedSelection(before, map){
        const m = maps();
        const after = new Map();
        for (const sel of mSelection) {
            const item = before.get(sel.id);
            if (!item || item.tile) continue;
            after.set(sel.id, mappedItem(item, p => mapWorld(sel.frame, map(mapWorld(sel.frameInv, p, m)), m)));
        }
        return after;
    }

    /** the selection transformed by a map of the seen world; one undo step */
    function transformSelection(map, label){
        const ids = mSelection.map(s => s.id);
        const before = new Map(ids.map(id => [id, mDoc.getItem(id)]).filter(e => e[1]));
        const after = transformedSelection(before, map);
        if (!after.size) return;
        applyReplace(after);
        pushReplace(label, before, after);
        mSelectedVertex = null;
        mRepaint();
    }

    /** the selection mirrored about the centre of its box: axis 'x' swaps left and right, 'y' top and bottom */
    function flipSelection(axis){
        const b = selectionBox();
        if (!b) return;
        const cx = 0.5*(b[0] + b[2]), cy = 0.5*(b[1] + b[3]);
        transformSelection(axis === 'x' ? p => [2*cx - p[0], p[1]] : p => [p[0], 2*cy - p[1]], 'flip');
    }

    /** the selection turned about the centre of its box by the angle (radians, counterclockwise) */
    function rotateSelection(angle){
        const b = selectionBox();
        if (!b) return;
        const cx = 0.5*(b[0] + b[2]), cy = 0.5*(b[1] + b[3]), c = Math.cos(angle), s = Math.sin(angle);
        transformSelection(p => [cx + c*(p[0] - cx) - s*(p[1] - cy), cy + s*(p[0] - cx) + c*(p[1] - cy)], 'rotate');
    }

    // ── the clipboard and the order ──────────────────────────────────────────

    let mClipboard = [];    // copies of items, world coordinates

    function selectedItems(){
        return mSelection.map(s => mDoc.getItem(s.id)).filter(Boolean);
    }

    /** copies of the selected items kept for pasting; how many */
    function copySelection(){
        mClipboard = selectedItems().map(it => JSON.parse(JSON.stringify(it)));
        return mClipboard.length;
    }

    /** the kept items added where new items go (new ids, a tile as a plain shape), and selected */
    function pasteClipboard(){
        if (!mClipboard.length) return;
        const items = mClipboard.map(it => { const c = JSON.parse(JSON.stringify(it)); delete c.id; delete c.tile; return c; });
        const added = addItems(items, 'paste');
        setSelection(added.map(it => ({ id: it.id, frame: null, frameInv: null })));
    }

    function duplicateSelection(){
        if (copySelection()) pasteClipboard();
    }

    /** the selected items moved in their lists: 'up', 'down', 'top' or 'bottom'; one undo step */
    function reorderSelection(where){
        const moves = [];
        for (const sel of mSelection) {
            const at = mDoc.findItem(sel.id);
            if (!at) continue;
            const siblings = at.parentId ? ((mDoc.getItem(at.parentId) || {}).children || []) : at.layer.getItems();
            const n = siblings.length, from = at.index;
            const to = where === 'top' ? n - 1 : where === 'bottom' ? 0 : where === 'up' ? Math.min(n - 1, from + 1) : Math.max(0, from - 1);
            if (to !== from) moves.push({ id: sel.id, layerId: at.layer.getId(), parentId: at.parentId, from, to });
        }
        if (!moves.length) return;
        // the ones going up are taken in order from the top, those going down from the bottom
        moves.sort((a, b) => (where === 'top' || where === 'up') ? a.from - b.from : b.from - a.from);
        const apply = list => list.forEach(mv => { const r = mDoc.removeItem(mv.id); if (r) mDoc.insertItem(r.item, mv.layerId, mv.to, mv.parentId); });
        const back = moves.slice().reverse().map(mv => ({ ...mv, to: mv.from }));
        apply(moves);
        mUndo.push({ label: 'order', undo: () => apply(back), redo: () => apply(moves) });
        mRepaint();
    }

    /**
     * the selected shapes as paths (toPath) or as polylines through their
     * outlines; images and tiles stay; one undo step
     */
    function convertSelection(toPath){
        const before = new Map(), after = new Map();
        for (const sel of mSelection) {
            const item = mDoc.getItem(sel.id);
            if (!item || item.type === 'image' || item.tile) continue;
            if (toPath && !item.nodes) { before.set(item.id, item); after.set(item.id, pathFromPolyline(item)); }
            if (!toPath && item.nodes) { before.set(item.id, item); after.set(item.id, polylineFromPath(item)); }
        }
        if (!after.size) return;
        applyReplace(after);
        pushReplace(toPath ? 'to path' : 'to polyline', before, after);
        mSelectedVertex = null;
        mRepaint();
    }

    /**
     * the square box {cx, cy, half} (world) new content is placed in: the
     * container being edited, else the pattern box
     */
    function placementBox(){
        const container = mContainer ? mDoc.getItem(mContainer.id) : null;
        if (container) {
            const p = container.points;
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (let i = 0; i + 1 < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
            return { cx: 0.5*(x0 + x1), cy: 0.5*(y0 + y1), half: 0.5*Math.max(x1 - x0, y1 - y0) };
        }
        const ptc = context().ptc;
        return { cx: ptc.centerX, cy: ptc.centerY, half: ptc.scale };
    }

    /**
     * adds items already at their place (into the container being edited,
     * else on top of the active layer) as one undoable step
     */
    function addItems(items, label){
        const parentId = mContainer ? mContainer.id : null;
        const added = items.map(item => {
            const it = mDoc.insertItem(item, null, null, parentId);
            const at = mDoc.findItem(it.id);
            return { saved: JSON.parse(JSON.stringify(it)), layerId: at.layer.getId(), index: at.index };
        });
        if (!added.length) return [];
        mUndo.push({ label,
            undo: () => added.slice().reverse().forEach(a => mDoc.removeItem(a.saved.id)),
            redo: () => added.forEach(a => mDoc.insertItem(a.saved, a.layerId, a.index, parentId)) });
        return added.map(a => a.saved);
    }

    /** the map (world to world) of a word of the group's generators, for a tile's paired edges */
    function pairingMap(word){
        const m = maps();
        const map = wordMap(m.ctx.group, word);
        if (!map) return w => [w[0], w[1]];
        return w => { const q = map(m.toPattern.map(w[0], w[1])); return m.fromPattern.map(q[0], q[1]); };
    }

    /** a tile of the group's fundamental domain on top of the active layer; null without one */
    function addTileFromDomain(){
        const m = maps();
        const style = styleFromConfig();
        if (!style.fill) style.fill = { rgba: [1, 1, 1, 1] };
        const item = tileFromDomain(m.ctx.group, m.fromPattern, style);
        if (!item) return null;
        mContainer = null;
        const added = addItems([item], 'tile')[0];
        setSelection([{ id: added.id, frame: null, frameInv: null }]);
        return added;
    }

    /**
     * a stroke (world points) drawn from one corner of a selected tile to the
     * next, on any copy, becomes that edge (its pair following): true when
     * one took it. Corners are reached within tolPx canvas pixels.
     */
    function replaceTileEdge(stroke, tolPx = EDGE_END_PX){
        if (stroke.length < 2) return false;
        const m = maps();
        const group = m.ctx.group;
        const s0 = m.toPattern.map(stroke[0][0], stroke[0][1]);
        const s1 = m.toPattern.map(stroke[stroke.length - 1][0], stroke[stroke.length - 1][1]);
        const f = foldPoint(group, s0);
        const tolS = tolPx*patternPerPixel();
        const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
        for (const sel of mSelection) {
            const item = mDoc.getItem(sel.id);
            if (!item || !item.tile) continue;
            const hpts = patternPoints(item, m.toPattern);
            const starts = tileEdgeStarts(item.tile);
            const n = item.tile.edges.length;
            const corner = k => [hpts[2*starts[(k + n) % n]], hpts[2*starts[(k + n) % n] + 1]];
            const { hInv } = foldElementOf(item);
            for (const copy of copiesOf(item, hpts, 0)) {
                // the copy the stroke starts on: its frame takes the stroke onto the item's own place
                const frame = composeTransforms(f.transform, copy.fromFD, hInv);
                const x0 = applyTransform(frame, s0);
                const tol = tolS*localScale(frame, s0);
                const k = item.tile.edges.findIndex((e, i) => dist(x0, corner(i)) <= tol);
                if (k < 0) continue;
                const x1 = applyTransform(frame, s1);
                let edge, reversed;
                if (dist(x1, corner(k + 1)) <= tol) { edge = k; reversed = false; }
                else if (dist(x1, corner(k - 1)) <= tol) { edge = (k - 1 + n) % n; reversed = true; }
                else continue;
                const pts = stroke.map(w => { const q = applyTransform(frame, m.toPattern.map(w[0], w[1])); return m.fromPattern.map(q[0], q[1]); });
                if (reversed) pts.reverse();
                const changed = tileReplacedEdge(item, edge, pts.slice(1, -1), pairingMap);
                if (!changed) return false;
                const before = new Map([[item.id, item]]);
                const after = new Map([[item.id, changed]]);
                applyReplace(after);
                pushReplace('edge', before, after);
                return true;
            }
        }
        return false;
    }

    /** an image (a blob: a file, the clipboard) placed in the placement box */
    async function importImageBlob(blob){
        const { item, width, height } = await imageItemFromBlob(blob);
        item.points = placeQuad(width, height, placementBox());
        return addItems([item], 'image')[0];
    }

    /** the shapes of an SVG text placed in the placement box */
    function importSvgText(text){
        return addItems(svgToItems(text, placementBox()), 'svg');
    }

    /** a paste of an image or an SVG text into the drawing; true when taken */
    function paste(data){
        if (!data) return false;
        const file = Array.from(data.files || []).find(f => f.type.startsWith('image/svg')) || Array.from(data.files || []).find(f => f.type.startsWith('image/'));
        if (file && file.type.startsWith('image/svg')) { file.text().then(importSvgText); return true; }
        if (file) { importImageBlob(file); return true; }
        const text = data.getData('text/plain');
        if (text && /<svg[\s>]/i.test(text)) { importSvgText(text); return true; }
        return false;
    }

    // a paste while the focus is not in a text field goes to the drawing
    window.addEventListener('paste', e => {
        const t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        if (paste(e.clipboardData)) e.preventDefault();
    });

    /** adds an item on top of the active layer, or into the container being edited */
    function addItem(item){
        const parentId = mContainer ? mContainer.id : null;
        const drawn = { ...item, style: item.style || styleFromConfig() };
        const it = mDoc.insertItem(parentId ? intoContainer(drawn) : drawn, null, null, parentId);
        const at = mDoc.findItem(it.id);
        const saved = JSON.parse(JSON.stringify(it));
        const layerId = at.layer.getId(), index = at.index;
        mUndo.push({ label: 'add', undo: () => mDoc.removeItem(saved.id),
                     redo: () => mDoc.insertItem(saved, layerId, index, parentId) });
        return it;
    }

    function removeItems(ids){
        const removed = ids.map(id => mDoc.removeItem(id)).filter(Boolean);
        if (!removed.length) return;
        mSelection = mSelection.filter(s => !ids.includes(s.id));
        mSelectedVertex = null;
        mUndo.push({
            label: 'delete',
            undo: () => removed.slice().reverse().forEach(r => mDoc.insertItem(r.item, r.layerId, r.index, r.parentId)),
            redo: () => removed.forEach(r => mDoc.removeItem(r.item.id)),
        });
    }

    function undo(){ clearSelection(); mUndo.undo(); }
    function redo(){ clearSelection(); mUndo.redo(); }

    // ── overlay ──────────────────────────────────────────────────────────────

    /** canvas points of an item's polyline on the copy of frameInv (segments subdivided) */
    function itemCanvasPath(item, frameInv){
        const m = maps();
        const pts = item.points;
        const n = pts.length/2;
        const segs = item.closed ? n : n - 1;
        const sub = (mView.isLinear() && !frameInv) ? 1 : (segs > 200 ? 2 : 8);
        const out = [];
        const toCanvas = (x, y) => mView.toCanvas(mapWorld(frameInv, [x, y], m));
        for (let i = 0; i < segs; i++) {
            const j = (i + 1) % n;
            for (let k = 0; k < sub; k++) {
                const t = k/sub;
                out.push(toCanvas(pts[2*i] + t*(pts[2*j] - pts[2*i]), pts[2*i + 1] + t*(pts[2*j + 1] - pts[2*i + 1])));
            }
        }
        if (!item.closed) out.push(toCanvas(pts[2*(n - 1)], pts[2*(n - 1) + 1]));
        else out.push(out[0]);
        return out;
    }

    function strokePath(ctx, path, width, color){
        ctx.beginPath();
        path.forEach(([x, y], i) => (i === 0) ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.stroke();
    }

    /** an outline with a light halo, for selections and lines being drawn */
    function drawOutline(ctx, path){
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        strokePath(ctx, path, 4, 'rgba(255,255,255,0.85)');
        ctx.setLineDash([6, 4]);
        strokePath(ctx, path, 1.5, 'rgba(20,60,200,0.95)');
        ctx.restore();
    }

    function drawHandle(ctx, c, selected = false, round = false){
        ctx.save();
        ctx.beginPath();
        const r = selected ? 5 : 4;
        if (round) ctx.arc(c[0], c[1], r, 0, 2*Math.PI);
        else ctx.rect(c[0] - r, c[1] - r, 2*r, 2*r);
        ctx.fillStyle = selected ? 'rgba(20,60,200,0.95)' : 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(20,60,200,0.95)';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    /** the snap target marker */
    /** a control handle of a node: a line from the node's canvas point to the handle's, a small circle there */
    function drawControlHandle(ctx, from, to){
        ctx.save();
        ctx.strokeStyle = 'rgba(20,60,200,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(from[0], from[1]);
        ctx.lineTo(to[0], to[1]);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(to[0], to[1], 3.5, 0, 2*Math.PI);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    function drawSnap(ctx, target){
        if (!target) return;
        const c = mView.toCanvas(target.wpnt);
        ctx.save();
        ctx.strokeStyle = target.kind === 'vertex' ? 'rgba(230,120,0,0.95)' : 'rgba(150,0,180,0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c[0], c[1], 7, 0, 2*Math.PI);
        ctx.stroke();
        ctx.restore();
    }

    // ── keys shared by the tools ─────────────────────────────────────────────

    /** undo and redo; returns true when the key was used */
    function handleCommonKey(e){
        if (e.type !== 'keydown') return false;
        const ctrl = e.ctrlKey || e.metaKey;
        if (!ctrl) return false;
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { undo(); return true; }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { redo(); return true; }
        return false;
    }

    return {
        document:       mDoc,
        view:           mView,
        repaint:        mRepaint,
        getStyleParams: () => mStyleParams,
        getStyle:       styleFromConfig,
        getShapeParams: () => mShapeParams,
        getShapeConfig: () => mShapeCfg,
        // coordinates
        maps,
        mapWorld,
        patternPerPixel,
        // picking and snapping
        hitTest,
        snap,
        // selection
        getSelection:   () => mSelection,
        setSelection,
        isSelected,
        clearSelection,
        getSelectedVertex: () => mSelectedVertex,
        setSelectedVertex: (v) => { mSelectedVertex = v; mRepaint(); },
        // the container being edited inside
        enterContainer,
        leaveContainer,
        getContainer: () => mContainer,
        drawContainer,
        // edits
        addItem,
        addItems,
        addTileFromDomain,
        replaceTileEdge,
        convertSelection,
        fitSelection,
        fittedItem,
        selectionBox,
        transformedSelection,
        transformSelection,
        flipSelection,
        rotateSelection,
        copySelection,
        pasteClipboard,
        duplicateSelection,
        hasClipboard:   () => mClipboard.length > 0,
        reorderSelection,
        getStyleConfig: () => mStyleCfg,
        pairingMap,
        importImageBlob,
        importSvgText,
        paste,
        removeItems,
        applyReplace,
        pushReplace,
        // an undo step of the owner's own: {label, undo(), redo()}
        pushUndo:       (entry) => mUndo.push(entry),
        undo,
        redo,
        // overlay
        itemCanvasPath,
        drawOutline,
        drawHandle,
        drawControlHandle,
        drawSnap,
        handleCommonKey,
        // the group or the pattern box changed: the frames of the selection are stale
        onGeometryChanged: () => { mSelection = []; mSelectedVertex = null; mContainer = null; mCopies = null; mCacheKey = ''; },
    };

} // function DrawingEditor()

export { DrawingEditor };
