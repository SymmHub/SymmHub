import {
    ParamBool,
    ParamChoice,
    ParamColor,
    ParamFloat,
    ParamGroup,
    worldToPatternMap,
    patternToWorldMap,
    itemFoldElement,
    applyTransform,
    composeTransforms,
    localScale,
    foldPoint,
    boxCopies,
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
        snap:          true,
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
        mSettingStyle = true;
        mStyleParams.updateDisplay();
        mSettingStyle = false;
    }

    /** a style setting changed: restyle the selection (one undo step per setting dragged) */
    function onStyleChanged(key){
        if (mSettingStyle || !mSelection.length) return;
        const style = styleFromConfig();
        const ids = mSelection.map(s => s.id);
        const before = new Map(ids.map(id => [id, mDoc.getItem(id)]).filter(e => e[1]));
        const after = new Map();
        before.forEach((item, id) => after.set(id, { ...item, style: { ...item.style, ...style, opacity: item.style.opacity } }));
        applyReplace(after);
        pushReplace('style', before, after, 'style:' + key);
    }

    const styleParam = (P, key, extra = {}) => P({ obj: mStyleCfg, key, onChange: () => onStyleChanged(key), ...extra });
    const mStyleParams = ParamGroup({
        name: 'style',
        params: {
            stroke:        styleParam(ParamColor, 'stroke', { name: 'stroke' }),
            strokeOpacity: styleParam(ParamFloat, 'strokeOpacity', { name: 'stroke opacity', min: 0, max: 1, step: 0.01 }),
            width:         styleParam(ParamFloat, 'width', { name: 'width', min: 0, max: 1, step: 0.001 }),
            filled:        styleParam(ParamBool,  'filled', { name: 'fill closed' }),
            fill:          styleParam(ParamColor, 'fill', { name: 'fill' }),
            fillOpacity:   styleParam(ParamFloat, 'fillOpacity', { name: 'fill opacity', min: 0, max: 1, step: 0.01 }),
            cap:           styleParam(ParamChoice, 'cap', { name: 'cap', choice: CAPS }),
            join:          styleParam(ParamChoice, 'join', { name: 'join', choice: JOINS }),
            snap:          ParamBool({ obj: mStyleCfg, key: 'snap', name: 'snap to copies' }),
        },
    });

    // ── coordinates ──────────────────────────────────────────────────────────

    function context(){
        const ctx = mGetContext();
        const key = [mDoc.getVersion(), ctx.ptc.centerX, ctx.ptc.centerY, ctx.ptc.scale, ctx.ptc.angle].join(' ');
        if (key !== mCacheKey || ctx.group !== mCacheGroup) {
            mCacheKey = key;
            if (ctx.group !== mCacheGroup) { mCopies = null; mCacheGroup = ctx.group; }
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
            const h = itemFoldElement(item, ctx.group, ctx.ptc);
            mFoldCache.set(item.id, { h, hInv: h ? h.getInverse() : null });
        }
        return mFoldCache.get(item.id);
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
        const items = mDoc.getEditableItems().slice().reverse();
        for (const item of items) {
            const pts = patternPoints(item, m.toPattern);
            const halfWidth = 0.5*(item.style.stroke ? item.style.strokeWidth*m.toPattern.scale : 0);
            const { hInv } = foldElementOf(item);
            for (const copy of copies()) {
                const q = applyTransform(copy.fromFD, f.pnt);
                const x = applyTransform(hInv, q);
                const frame = composeTransforms(f.transform, copy.fromFD, hInv);
                const tol = tolS*localScale(frame, s) + halfWidth;
                if (hitsPolyline(x, pts, item.closed, !!item.style.fill, tol)) {
                    return { item, frame, frameInv: frame ? frame.getInverse() : null };
                }
            }
        }
        return null;
    }

    // ── snapping ─────────────────────────────────────────────────────────────

    /**
     * the snap target for the pointer at world w: {wpnt, kind, ...} or null
     * exclude: {itemId, vertex} of the point being dragged
     */
    function snap(w, exclude = null){
        if (!mStyleCfg.snap) return null;
        const m = maps();
        const radius = SNAP_PX*patternPerPixel();
        const key = [mCacheKey, radius.toPrecision(3), exclude ? exclude.itemId + ':' + exclude.vertex : ''].join('|');
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

    function addItem(item){
        const it = mDoc.addItem({ ...item, style: item.style || styleFromConfig() });
        const at = mDoc.findItem(it.id);
        const saved = JSON.parse(JSON.stringify(it));
        const layerId = at.layer.getId(), index = at.index;
        mUndo.push({ label: 'add', undo: () => mDoc.removeItem(saved.id),
                     redo: () => mDoc.insertItem(saved, layerId, index) });
        return it;
    }

    function removeItems(ids){
        const removed = ids.map(id => mDoc.removeItem(id)).filter(Boolean);
        if (!removed.length) return;
        mSelection = mSelection.filter(s => !ids.includes(s.id));
        mSelectedVertex = null;
        mUndo.push({
            label: 'delete',
            undo: () => removed.slice().reverse().forEach(r => mDoc.insertItem(r.item, r.layerId, r.index)),
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
        // edits
        addItem,
        removeItems,
        applyReplace,
        pushReplace,
        undo,
        redo,
        // overlay
        itemCanvasPath,
        drawOutline,
        drawHandle,
        drawSnap,
        handleCommonKey,
        // the group or the pattern box changed: the frames of the selection are stale
        onGeometryChanged: () => { mSelection = []; mSelectedVertex = null; mCopies = null; mCacheKey = ''; },
    };

} // function DrawingEditor()

export { DrawingEditor };
