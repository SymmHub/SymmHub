import {
    ParamCustom,
    worldToPatternMap,
    patternToWorldMap,
    itemFoldElement,
    applyTransform,
    composeTransforms,
    dirichletSourceWord,
    localScale,
    foldPoint,
    foldSides,
    boxCopies,
    itemCopies,
    crownCopies,
    spriteCopies,
    imageItemFromBlob,
    imageMask,
    contentThumbnail,
    getImagesVersion,
    placeQuad,
    coverQuad,
    itemCopy,
    quadUV,
    maskHit,
    showWarningBanner,
    parseSvg,
    outlineText,
    itemsOfSvg,
    frameItem,
    framedImage,
    fillBox,
    fillMap,
    imageCovering,
    withNodes,
    itemBridges,
    mappedItem,
    normalShape,
    cornersSmoothed,
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
    imageListNames,
    imageListEntry,
    // the geometry of the group and its motions (GroupGeometry.js, GeometryMotions.js)
    groupGeometry,
    maximalDisk,
    transformedGeometry,
    moveTo,
    anchoredMoveTo,
    translationTo,
    mobiusCompose,
    rotationAbout,
    similarityAbout,
    reflectionAbout,
    canonicalChart,
    mobiusInverse,
    mobiusPointMap,
    clampToModel,
} from './modules.js';

//
//  DrawingEditor - what the drawing tools share
//
//  - the selection: items picked on some copy, each with the frame c of that
//    copy (Orbits.js: c maps the neighbourhood of the pointer, in pattern
//    coordinates, onto the item's own place), so handles and drags work on the
//    copy the user sees, for every map of the group; a click picks the copy
//    that is seen there, in front, as the colour layers draw the copies, and
//    goes through the transparent pixels of an image (hitTest);
//  - the closed items and groups being edited inside, one within the other;
//  - the undo stack of the item edits;
//  - the snap index (vertices of all copies, mirrors, cone points);
//  - the style of new items (the style settings, which the property bar
//    shows, ToolProperties.js), which also restyles the selection; the
//    numbers of the shape tools and of a selected shape;
//  - the maps between world, pattern and canvas coordinates, and drawing on
//    the 2D overlay through a copy's frame.
//
//  par: document, getContext() -> {group (pattern coordinates), ptc,
//       sprites, visLayers (the last frame's visualization layers),
//       getSprites() (the sprites the colour layers show)},
//       view ({toWorld, toCanvas, isLinear, pixelSize}), repaint,
//       propertiesChanged() (the style or shape settings show other values,
//       or the undo stack changed), activateTool(name) (takes up a tool of
//       the pattern), chooseImage() (lets the user pick the file that
//       replaces the selected image: replaceSelectedImage), chooseFill(kind)
//       ('image' or 'svg': lets the user pick the file that fills the
//       selected shapes: fillWithImage, fillWithSvg)
//

const PICK_PX = 6;          // pick tolerance, canvas pixels
const IMAGE_PICK_PX = 2;    // the same around the solid pixels of an image, for thin lines
const SNAP_PX = 10;         // snap radius, canvas pixels
const EDGE_END_PX = 10;     // reach of a tile's corner for a stroke that reshapes an edge
const FIT_PX = 1.5;         // how far a fitted curve may leave the points, canvas pixels
const IMPORT_SHARE = 0.5;   // an import's box, of the pattern box
const LOCAL_GEOMETRIES_KEPT = 32;  // geometries of a Kleinian group at the last points asked for
const PLANE = { kind: 'euclidean' };   // the geometry of the moves while the geometry setting is off
const FIT_VIEW_SHARE = 1/3;   // fitSelection('view'): the box's larger side as a share of the view's smaller side
const FIT_CELL_SHARE = 0.5;   // fitSelection('cell'): the box's diagonal as a share of the local disk's diameter
const FIT_STROKE_RATIO = 20;  // fitSelection: a stroke this many times off the tool's width takes the tool's width

// the style settings about the stroke, and about the fill
const STROKE_KEYS = ['stroke', 'strokeOpacity', 'width', 'cap', 'join'];
const FILL_KEYS = ['filled', 'fill', 'fillOpacity', 'fillRule'];

function hexToRgb(hex){
    const h = (hex || '#000000').replace('#', '');
    return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)/255);
}

function rgbToHex(rgb){
    return '#' + rgb.slice(0, 3).map(v => Math.round(255*Math.max(0, Math.min(1, v))).toString(16).padStart(2, '0')).join('');
}

// said when a fill's file is chosen with no closed shape selected
const NOTHING_TO_FILL = 'Select a closed shape to fill first';

/** can the item hold a fill: a closed shape */
function isFillable(item){
    return !!item && item.closed && item.type !== 'image' && item.type !== 'group';
}

/** does a style paint anything: a fill, or a stroke of some width */
function paints(style){
    return !!(style.fill || (style.stroke && style.strokeWidth > 0));
}

function DrawingEditor(par) {

    const mDoc = par.document;
    const mGetContext = par.getContext;
    const mView = par.view;
    const mRepaint = par.repaint || (() => {});
    const mPropertiesChanged = par.propertiesChanged || (() => {});

    // what can be undone shows in the toolbox (propertiesChanged)
    const mUndo = UndoStack({ onChange: () => { mRepaint(); mPropertiesChanged(); } });
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
    // the geometry of the group in world coordinates (geometry()), kept with them,
    // and the geometries of a Kleinian group at the last few points (localGeometry)
    let mGeometry = null;
    const mLocalGeometries = new Map();
    // the items being edited inside, the outermost first, each held by the
    // one before it: [{id, frame, frameInv (the copy it was entered on)}]
    let mContainers = [];
    // item id -> {key, copies}: the tiles meeting the item's box, as a sprite
    const mItemCopies = new Map();
    let mCopies = null;
    // the tiles Color Images draws: its crown's {count, copies}, and per
    // sprite id {key, copies} (picking what is seen)
    let mCrownCopies = null;
    const mSpriteCopies = new Map();

    /** the innermost item being edited inside: {id, frame, frameInv}, or null */
    const container = () => mContainers[mContainers.length - 1] || null;

    // ── style ────────────────────────────────────────────────────────────────

    const mStyleCfg = {
        stroke:        '#cc1a1a',
        strokeOpacity: 1,
        width:         0.02,
        filled:        false,
        fill:          '#3366e6',
        fillOpacity:   1,
        // where the outline crosses itself: 'nonzero' or 'evenodd' (ItemRenderer.js)
        fillRule:      'nonzero',
        cap:           'round',
        join:          'round',
        snap:          true,
        // freehand strokes fitted with curves
        fitCurves:     false,
        // the select tool's moves, turns and scalings as motions of the group's
        // geometry (geometry()); off: in the plane, as a Euclidean drawing
        geometry:      true,
        // the select tool's move as small geodesic steps along the pointer's path
        // (parallel transport: a loop turns the shape by the area it encloses);
        // off: the direct move from the grab point to the pointer, the same
        // whatever the path
        incremental:   false,
        // a dragged shape stays inside its cell: in a Kleinian group a move that
        // would take its box out of the local disk of the group is not made (a
        // shape across the limit set has copies everywhere and blows up)
        keepInCell:    true,
    };

    function styleFromConfig(){
        const c = mStyleCfg;
        return {
            stroke:      { rgba: [...hexToRgb(c.stroke), c.strokeOpacity] },
            strokeWidth: c.width,
            lineCap:     c.cap,
            lineJoin:    c.join,
            fill:        c.filled ? { rgba: [...hexToRgb(c.fill), c.fillOpacity] } : null,
            opacity:     1,
            ...(c.fillRule === 'evenodd' ? { fillRule: 'evenodd' } : {}),
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
        c.fillRule = style.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
        mPropertiesChanged();
    }

    /** what a shape holding content keeps when a style setting changes: the
     *  paint the setting is not about (a stroke put on an image brings no fill) */
    function keptPaint(item, key){
        if (!item.children) return {};
        const { fill, stroke, strokeWidth } = item.style;
        return { ...(FILL_KEYS.includes(key) ? {} : { fill }), ...(STROKE_KEYS.includes(key) ? {} : { stroke, strokeWidth }) };
    }

    /** a style setting changed (the property bar, ToolProperties.js): the
     *  selection takes it, one undo step per setting dragged */
    function setStyleValue(key, value){
        mStyleCfg[key] = value;
        mPropertiesChanged();
        if (key === 'snap' || key === 'fitCurves' || key === 'geometry' || key === 'incremental' || key === 'keepInCell' || !mSelection.length) return;
        const style = styleFromConfig();
        const ids = mSelection.map(s => s.id);
        const before = new Map(ids.map(id => [id, mDoc.getItem(id)]).filter(e => e[1]));
        const after = new Map();
        before.forEach((item, id) => {
            const merged = { ...item.style, ...style, opacity: item.style.opacity, ...keptPaint(item, key) };
            if (!style.fillRule) delete merged.fillRule;
            after.set(id, { ...item, style: merged });
        });
        applyReplace(after);
        pushReplace('style', before, after, 'style:' + key);
    }

    // the style settings are saved as one flat object of their values, as
    // when the panel had rows for them; the property bar shows and edits
    // them, the panel nothing
    const mStyleParams = ParamCustom({
        getValue: () => ({ ...mStyleCfg }),
        setValue: (v) => {
            if (!v) return;
            Object.keys(mStyleCfg).forEach(key => { if (v[key] !== undefined) mStyleCfg[key] = v[key]; });
            mPropertiesChanged();
        },
    });

    // ── shapes ───────────────────────────────────────────────────────────────

    // the numbers each shape tool (ShapeTool.js, one per kind) draws with; a
    // polygon's or star's radius is that of one placed by a click, and a
    // drag sets it
    const mShapeTools = {
        rect:    { round: 0 },
        ellipse: {},
        polygon: { n: 6, radius: 0.1, curved: false, smoothO: true },
        star:    { n: 5, radius: 0.1, ratio: 0.5, twist: 0, curved: false, smoothO: true, smoothI: true },
        spiral:  { n: 3 },
    };

    /** the shape selected alone (Shapes.js), whose numbers the node tool's property bar shows and edits, or null */
    function selectedShape(){
        if (mSelection.length !== 1) return null;
        const item = mDoc.getItem(mSelection[0].id);
        return item && item.shape ? item : null;
    }

    /**
     * a number of the selected shape changed (w, h: its width and height,
     * across its frame; radius: a polygon's or star's, its frame scaled;
     * round, n, ratio, twist, curved; smoothO, smoothI: a curved polygon's
     * or star's corners, outer and inner, smooth, their handles put in line,
     * or sharp): the shape takes it and keeps its kind; one undo step per
     * number dragged, and per switch
     */
    function setShapeValue(key, value){
        const item = selectedShape();
        if (!item) return;
        const s = item.shape;
        const f = value/Math.sqrt(s.rx*s.ry);
        let shape;
        if (key === 'smoothO' || key === 'smoothI') {
            shape = cornersSmoothed(s, key === 'smoothO' ? 'o' : 'i', value);
        } else {
            const changed = key === 'w' ? { rx: 0.5*value } : key === 'h' ? { ry: 0.5*value } :
                            key === 'radius' ? { rx: f*s.rx, ry: f*s.ry } : { [key]: value };
            shape = normalShape({ ...s, ...changed, kind: s.kind });
        }
        const before = new Map([[item.id, item]]);
        const after = new Map([[item.id, { ...item, shape }]]);
        applyReplace(after);
        pushReplace('shape', before, after, typeof value === 'boolean' ? null : 'shape:' + key);
        mSelectedVertex = null;
        mRepaint();
    }

    /** a number a shape tool draws with */
    function setShapeToolValue(kind, key, value){
        mShapeTools[kind][key] = value;
        mPropertiesChanged();
    }

    /** the selected shapes of a kind (of every kind without one) */
    function selectedShapes(kind = null){
        return mSelection.map(s => mDoc.getItem(s.id)).filter(it => it && it.shape && (!kind || it.shape.kind === kind));
    }

    /** the item as a plain outline: a shape's numbers dropped, its outline kept */
    function plainItem(item){
        if (!item.shape) return item;
        const out = { ...item };
        delete out.shape;
        return out;
    }

    /**
     * the selected shapes of a kind (of every kind without one) as plain
     * outlines, their numbers dropped: toPath true paths (a straight
     * outline's corners nodes that then take handles), false polylines
     * through their outlines, null as they are drawn (a straight one a
     * polyline whose corners the node tool then moves one by one, a curved
     * one a path, its smooth corners smooth nodes); one undo step
     */
    function releaseShapes(kind = null, toPath = null){
        const items = selectedShapes(kind);
        if (!items.length) return;
        const outline = (plain) => (toPath === null ? plain
            : toPath ? (plain.nodes ? plain : pathFromPolyline(plain)) : (plain.nodes ? polylineFromPath(plain) : plain));
        const before = new Map(items.map(it => [it.id, it]));
        const after = new Map(items.map(it => [it.id, outline(plainItem(it))]));
        applyReplace(after);
        pushReplace(toPath === null ? 'release' : (toPath ? 'to path' : 'to polyline'), before, after);
        mSelectedVertex = null;
        mRepaint();
    }

    // ── coordinates ──────────────────────────────────────────────────────────

    function context(){
        const ctx = mGetContext();
        const key = [mDoc.getVersion(), ctx.ptc.centerX, ctx.ptc.centerY, ctx.ptc.scale, ctx.ptc.angle].join(' ');
        if (key !== mCacheKey || ctx.group !== mCacheGroup) {
            mCacheKey = key;
            if (ctx.group !== mCacheGroup) { mCopies = null; mItemCopies.clear(); mCrownCopies = null; mSpriteCopies.clear(); mCacheGroup = ctx.group; }
            mFoldCache = new Map();
            mGeometry = null;
            mLocalGeometries.clear();
        }
        return ctx;
    }

    function maps(){
        const ctx = context();
        return { toPattern: worldToPatternMap(ctx.ptc), fromPattern: patternToWorldMap(ctx.ptc), ctx };
    }

    // ── the geometry of the group ────────────────────────────────────────────
    //
    //  The group acts by isometries of a geometry: the Euclidean plane, the
    //  hyperbolic plane (the disk of a circle) or the sphere (the stereographic
    //  plane about an equator), read off the sides of its domain
    //  (GroupGeometry.js) and carried to world coordinates. The moves, turns and
    //  scalings of the select tool are motions of that geometry (GeometryMotions.js:
    //  a move is sigma_B^-1 sigma_A with the canonical charts of the two points,
    //  so a drag round a loop changes nothing and a shape keeps its size in the
    //  metric), computed in the seen world and applied to each item through the
    //  frame of its copy, as every map is. A Kleinian group has no absolute but a
    //  geometry at every point: the maximal disk of its domain of discontinuity
    //  there (GroupGeometry.maximalDisk, the Kulkarni-Pinkall metric), so its
    //  charts are taken point by point (localGeometry); a group with neither (no
    //  limit set found) moves in the plane.
    //

    /** the geometry of the group in world coordinates: {kind: 'euclidean' | 'hyperbolic' | 'spherical', ...} (GeometryMotions.js); `fallback: 'kleinian'` on a group of no absolute, whose geometry localGeometry gives point by point; the plane while the geometry setting is off */
    function geometry(){
        if (!mStyleCfg.geometry) return PLANE;
        const m = maps();
        if (!mGeometry) {
            const g = m.ctx.group ? groupGeometry(m.ctx.group) : { kind: 'euclidean' };
            mGeometry = (g.kind === 'euclidean' || g.kind === 'hyperbolic' || g.kind === 'spherical')
                ? transformedGeometry(g, m.fromPattern)
                : { kind: 'euclidean', fallback: g.kind };
        }
        return mGeometry;
    }

    /**
     * the geometry at a point of the seen world: the group's absolute, or for a
     * Kleinian group the maximal disk of its domain of discontinuity at the point
     * (a disk or a half plane, in world coordinates), the plane when it has none;
     * the last few points are kept (a drag asks for its start on every move)
     */
    function localGeometry(w){
        const g = geometry();
        if (g.fallback !== 'kleinian') return g;
        const key = w[0] + ' ' + w[1];
        const kept = mLocalGeometries.get(key);
        if (kept) {
            // the latest asked for stays longest (a drag asks for its anchor on every move)
            mLocalGeometries.delete(key);
            mLocalGeometries.set(key, kept);
            return kept;
        }
        const m = maps();
        const p = m.toPattern.map(w[0], w[1]);
        const disk = maximalDisk(m.ctx.group, p);
        const out = disk ? transformedGeometry(disk, m.fromPattern) : g;
        if (mLocalGeometries.size >= LOCAL_GEOMETRIES_KEPT) mLocalGeometries.delete(mLocalGeometries.keys().next().value);
        mLocalGeometries.set(key, out);
        return out;
    }

    /** the move of a pose from w0 to w1 as a point map of the seen world: the chart of w0 inverted into the chart of w1, each in the geometry at its point */
    function moveMap(w0, w1){
        return mobiusPointMap(moveTo(localGeometry(w0), w0, w1, localGeometry(w1)));
    }

    /**
     * the move of a pose whose state sits at the anchor C (the selection's pivot)
     * when the shape is grabbed at w0 and the pointer is at w1: the anchor goes
     * to the place whose chart puts w1 where C's chart puts w0, so the grabbed
     * point follows the pointer and the anchor is carried exactly; moves grabbed
     * anywhere compose by their anchors alone and a loop of them is the identity
     * (GeometryMotions.anchoredMoveTo). guess: the anchor's place found for the
     * last pointer position. {map (a point map of the seen world), anchor}
     */
    function anchoredMoveMap(C, w0, w1, guess = null){
        const r = anchoredMoveTo(localGeometry(C), C, w0, w1, localGeometry, guess);
        return { map: mobiusPointMap(r.m), anchor: r.anchor };
    }

    /**
     * the incremental move (the `incremental` setting): the small translation
     * along the geodesic from the pointer's last position prev to w1, in the
     * geometry at prev, after the steps so far (the Möbius matrix m0, none at
     * the drag's start). A path of such steps is the parallel transport along
     * it: the grabbed point follows the pointer and the shape keeps its size,
     * as with the direct move, but the frame is carried along the path, so a
     * loop turns the shape by the area it encloses (the holonomy; the direct
     * move depends on the end points alone and a loop of it is the identity).
     * A step that leaves the local model (a Kleinian group's disk) is the direct
     * move. {map (a point map of the seen world), m}
     */
    function incrementalMoveMap(prev, w1, m0 = null){
        const step = translationTo(localGeometry(prev), prev, w1) || moveTo(localGeometry(prev), prev, w1, localGeometry(w1));
        const m = normalizedMobius(m0 ? mobiusCompose(step, m0) : step);
        return { map: mobiusPointMap(m), m };
    }

    /** the matrix with entries of order one (a long drag composes thousands of steps) */
    function normalizedMobius(m){
        const s = Math.max(...m.flat().map(z => Math.hypot(z[0], z[1])));
        return s > 0 ? m.map(row => row.map(z => [z[0]/s, z[1]/s])) : m;
    }

    /** the rotation about the point by the angle (radians, counterclockwise), a point map of the seen world */
    function rotationMap(centre, angle){
        return mobiusPointMap(rotationAbout(localGeometry(centre), centre, angle));
    }

    /** the turn and scaling about the pivot by the complex factor [re, im] (z -> factor z in the pivot's chart), a point map */
    function similarityMap(pivot, factor){
        return mobiusPointMap(similarityAbout(localGeometry(pivot), pivot, factor));
    }

    /** the reflection in the geodesic through the point in the direction dir, a point map */
    function flipMap(centre, dir){
        return reflectionAbout(localGeometry(centre), centre, dir);
    }

    /** the canonical chart of a point of the seen world: {toChart(w) -> [x, y] of the standard model, the point at the origin; fromChart(z) -> w} */
    function chartAt(w){
        const s = canonicalChart(localGeometry(w), w);
        return { toChart: mobiusPointMap(s), fromChart: mobiusPointMap(mobiusInverse(s)) };
    }

    /**
     * the pointer w1 kept in the model of the drag's start w0 (off the rim of a
     * hyperbolic disk); in a Kleinian group the move is defined wherever the
     * pointer goes (across the limit set the shape shrinks to a point and grows
     * again), so w1 itself
     */
    function clampToGeometry(w0, w1){
        const g = geometry();
        return g.fallback === 'kleinian' ? w1 : clampToModel(g, w0, w1);
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
     * the item copy under the world point w that is seen, in front:
     * {item, parent, frame c, frameInv} or null; frame maps the pointer's
     * neighbourhood onto the item's own place. The colour layers tell which
     * copies they draw and in what order (describeCopies): the copy picked is
     * the front one of the topmost enabled layer that shows one there (a
     * copy that is not drawn, under another or of a masked colour is never
     * picked; the items of locked layers let the click through). Without
     * such a layer: the first copy found of the topmost item hit
     */
    function hitTest(w, tolPx = PICK_PX){
        const m = maps();
        const views = shownViews(m.ctx);
        return views.length ? hitSeen(w, tolPx, m, views) : hitTopmost(w, tolPx, m);
    }

    /** the enabled layers that tell which copies they draw (Color Images), topmost first */
    function shownViews(ctx){
        const views = [];
        for (const vl of ctx.visLayers || []) {
            if (!vl || !vl.enabled || !vl.describeCopies) continue;
            const view = vl.describeCopies();
            if (view.opacity > 0) views.push(view);
        }
        return views.reverse();
    }

    /** the stroke's half width of an item, pattern units */
    function halfWidthOf(item, m){
        return 0.5*(item.style.stroke ? item.style.strokeWidth*m.toPattern.scale : 0);
    }

    /** is the picture of an image item at x, within tol: on a solid pixel, or while it decodes on its quad */
    function hitsImage(item, x, pts, tol){
        const at = quadUV(x, pts);
        if (!at) return false;
        const ru = tol*at.du, rv = tol*at.dv;
        const mask = item.src ? imageMask(item.src) : null;
        if (mask) return maskHit(mask, at.u, at.v, ru, rv);
        return Math.abs(at.u - 0.5) <= 0.5 + ru && Math.abs(at.v - 0.5) <= 0.5 + rv;
    }

    /**
     * does the click at x hit what the item paints (x and pts, the item's
     * points, in pattern coordinates): an image on its pixels, within
     * imageTol; a shape on its fill or within tol of its stroke's width. A
     * closed item with children is also hit where a child is, inside its
     * outline, and an outline that paints nothing around them is not hit
     */
    function hitsItem(item, x, pts, tol, imageTol, m){
        if (item.visible === false) return false;
        const anyHit = list => list.some(c => hitsItem(c, x, patternPoints(c, m.toPattern), tol, imageTol, m));
        if (item.type === 'image') return hitsImage(item, x, pts, imageTol);
        if (item.type === 'group') return anyHit(item.children || []);
        const style = item.style;
        const holds = !!(item.closed && item.children && item.children.length);
        if ((paints(style) || !holds) && hitsPolyline(x, pts, item.closed, !!style.fill, tol + halfWidthOf(item, m), style.fillRule, itemBridges(item))) return true;
        return holds && hitsPolyline(x, pts, true, true, 0, style.fillRule) && anyHit(item.children);
    }

    /** hitTest without the layers' word: the first copy found of the topmost item hit */
    function hitTopmost(w, tolPx, m){
        const group = m.ctx.group;
        const s = m.toPattern.map(w[0], w[1]);
        const f = foldPoint(group, s);
        const tolS = tolPx*patternPerPixel();
        const imageTolS = Math.min(tolPx, IMAGE_PICK_PX)*patternPerPixel();
        // the item under the point, seen through the copies of the top item of
        // those holding it (from the top down) and cut off at their outlines
        function test(item, holders){
            const holder = holders[0] || item;
            const hpts = patternPoints(holder, m.toPattern);
            const pts = holders.length ? patternPoints(item, m.toPattern) : hpts;
            const clips = holders.filter(it => it.type !== 'group').map(it => ({ pts: patternPoints(it, m.toPattern), rule: it.style.fillRule }));
            const { hInv } = foldElementOf(holder);
            for (const copy of copiesOf(holder, hpts, halfWidthOf(holder, m))) {
                const q = applyTransform(copy.fromFD, f.pnt);
                const x = applyTransform(hInv, q);
                const frame = composeTransforms(f.transform, copy.fromFD, hInv);
                const scale = localScale(frame, s);
                if (clips.some(c => !hitsPolyline(x, c.pts, true, true, 0, c.rule))) continue;
                if (hitsItem(item, x, pts, tolS*scale, imageTolS*scale, m)) {
                    return { item, parent: holders[holders.length - 1] || null, frame, frameInv: frame ? frame.getInverse() : null };
                }
            }
            return null;
        }
        // a group is hit through its children, and taken as a whole
        function testGroup(group, holders){
            for (const child of (group.children || []).slice().reverse()) {
                const hit = test(child, [...holders, group]);
                if (hit) return { item: group, parent: holders[holders.length - 1] || null, frame: hit.frame, frameInv: hit.frameInv };
            }
            return null;
        }
        const testAny = (item, holders) => (item.type === 'group' ? testGroup(item, holders) : test(item, holders));
        // the children of the items being edited inside come first, the innermost's first
        for (const entered of mContainers.slice().reverse()) {
            const holders = mDoc.itemChain(entered.id);
            const inside = holders[holders.length - 1];
            for (const child of ((inside && inside.children) || []).slice().reverse()) {
                const hit = testAny(child, holders);
                if (hit) return hit;
            }
        }
        for (const item of mDoc.getEditableItems().slice().reverse()) {
            const hit = testAny(item, []);
            if (hit) return hit;
        }
        return null;
    }

    /**
     * the pieces of the drawing as the layers draw them, bottom first, and
     * what a hit on each picks: {item (its outline), holder (drawn as one:
     * a sprite, folded by its own element), clips (the items around it that
     * cut it off), pick, parent (of the pick), layerId, names (the names a
     * colour layer's images list shows its holder by: the layer's id, the
     * groups' holding it and its own, ImageList.js), editable}. A group is
     * drawn as its members and picked as a whole; a container is drawn with
     * its children inside. inside: the id of an item being edited inside,
     * whose children alone are taken, picked themselves through the copies
     * of what draws them (a group among them as a whole). Hidden items are
     * not drawn
     */
    function drawnPieces(inside = null){
        const pieces = [];
        // names: those of the holder, or of the groups above it while it is to come
        const add = (item, holder, clips, pick, parent, layerId, editable, names) => {
            if (item.visible === false) return;
            if (item.type === 'group' && item.children) {
                const members = holder === item;
                for (const child of item.children) add(child, members ? child : holder, clips, pick, parent, layerId, editable, members ? [...names, item.id] : names);
            } else {
                pieces.push({ item, holder, clips, pick, parent, layerId, editable, names: holder === item ? [...names, item.id] : names });
            }
        };
        if (inside) {
            const at = mDoc.findItem(inside);
            const holders = mDoc.itemChain(inside);
            const parent = holders[holders.length - 1];
            if (!at || !at.layer.isVisible() || !parent || !parent.children || holders.some(h => h.visible === false)) return pieces;
            const clips = holders.filter(it => it.type !== 'group');
            // the children are drawn by the outermost item cutting them off, else each by itself
            const above = clips[0] ? holders.slice(0, holders.indexOf(clips[0]) + 1) : holders;
            const names = [at.layer.getId(), ...above.map(h => h.id)];
            for (const child of parent.children) add(child, clips[0] || child, clips, child, parent, at.layer.getId(), !at.layer.isLocked(), names);
            return pieces;
        }
        for (const layer of mDoc.getLayers()) {
            if (!layer.isVisible()) continue;
            for (const item of layer.getItems()) add(item, item, [], item, null, layer.getId(), !layer.isLocked(), [layer.getId()]);
        }
        return pieces;
    }

    /** a sprite's box (world coordinates) in pattern coordinates */
    function patternBox(box, m){
        const c = m.toPattern.map(box.cx, box.cy);
        return { cx: c[0], cy: c[1], half: box.half*m.toPattern.scale };
    }

    /**
     * the item copy seen under the world point w: in the first view (the
     * topmost layer) that shows a copy of an editable piece there, the one
     * in front; null when none does
     */
    function hitSeen(w, tolPx, m, views){
        const group = m.ctx.group;
        const s = m.toPattern.map(w[0], w[1]);
        const f = foldPoint(group, s);
        // the sides the fold crossed give the copies' colours; unread: every colour shown
        const sides = foldSides(group, f.word);
        const tolS = tolPx*patternPerPixel();
        const imageTolS = Math.min(tolPx, IMAGE_PICK_PX)*patternPerPixel();
        const wordOf = copy => copy.fromFD ? copy.fromFD.getWord() : '';

        // does the piece's copy (through the tile, folded by hInv) cover the point: {q, frame} or null
        function hits(piece, copy, hInv){
            const q = applyTransform(copy.fromFD, f.pnt);
            const x = applyTransform(hInv, q);
            const frame = composeTransforms(f.transform, copy.fromFD, hInv);
            const item = piece.item;
            if (!piece.pts) piece.pts = patternPoints(item, m.toPattern);
            // a child is cut off at the outlines of the items holding it
            if (!piece.clipPts) piece.clipPts = piece.clips.map(c => patternPoints(c, m.toPattern));
            if (piece.clips.some((c, i) => !hitsPolyline(x, piece.clipPts[i], true, true, 0, c.style.fillRule))) return null;
            const scale = localScale(frame, s);
            if (!hitsItem(item, x, piece.pts, tolS*scale, imageTolS*scale, m)) return null;
            return { q, frame };
        }
        // the larger order is in front: the depth, then the layer's drawing order
        const ahead = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
        const depth = (view, p) => view.tilt ? view.tilt[0]*p[0] + view.tilt[1]*p[1] : 0;

        // the sprite path: each sprite through the tiles nearest its box, in sprite order
        function frontSprite(view, pieces){
            const data = m.ctx.getSprites ? m.ctx.getSprites() : null;
            if (!data) return null;
            const names = imageListNames(view.entries);
            const listed = (view.entries.length ? data.sprites.filter(sp => (sp.names || [sp.layerId]).some(n => names.includes(n))) : data.sprites).slice(-view.maxSprites);
            const index = new Map(listed.map((sp, i) => [sp.id, i]));
            const angle = -(m.ctx.ptc.angle || 0);
            let best = null;
            for (const piece of pieces) {
                const i = index.get(piece.holder.id);
                if (i === undefined || !piece.editable) continue;
                const sp = listed[i];
                const box = patternBox(sp.box, m);
                const key = [box.cx, box.cy, box.half, angle, view.spriteTiles, view.spriteGridRadius].join(' ');
                let cached = mSpriteCopies.get(sp.id);
                if (!cached || cached.key !== key) {
                    cached = { key, copies: spriteCopies(group, box, angle, view.spriteTiles, view.spriteGridRadius) };
                    mSpriteCopies.set(sp.id, cached);
                }
                // without the crown a sprite is seen through the domain alone
                const copies = view.useCrown ? cached.copies : cached.copies.filter(c => !c.toFD || c.toFD.getWord() === '');
                copies.forEach((copy, k) => {
                    const hit = hits(piece, copy, null);
                    if (!hit) return;
                    if (sides && view.spriteCopyColor(sides, wordOf(copy), sp) < 0) return;
                    // the shader's depth is the world point's
                    const order = [depth(view, m.fromPattern.map(hit.q[0], hit.q[1])), i, k];
                    if (!best || !ahead(best.order, order)) best = { piece, frame: hit.frame, order };
                });
            }
            return best;
        }

        // the buffer path: the main buffer or the components the entries
        // name, through the domain or the crown's tiles (the farthest first),
        // each tile showing the drawing's items in order
        function frontBuffer(view, pieces){
            const named = view.entries.length ? imageListNames(view.entries) : null;
            let copies = [{ fromFD: null, toFD: null }];
            if (view.useCrown) {
                if (!mCrownCopies || mCrownCopies.count !== view.crownCount) {
                    mCrownCopies = { count: view.crownCount, copies: crownCopies(group, view.crownCount).reverse() };
                }
                copies = mCrownCopies.copies;
            }
            let best = null;
            copies.forEach((copy, k) => {
                // the layers the tile shows (its image's entry, the array's
                // layer index clamped); null: every layer
                let shown = null;
                if (sides) {
                    const img = view.bufferCopyImage(sides, wordOf(copy));
                    if (img < 0) return;
                    shown = imageListEntry(view.entries, img);
                }
                pieces.forEach((piece, u) => {
                    if (!piece.editable || (named && !piece.names.some(n => named.includes(n)))) return;
                    if (shown && !piece.names.some(n => shown.includes(n))) return;
                    const hit = hits(piece, copy, foldElementOf(piece.holder).hInv);
                    // the buffer holds the pattern box alone
                    if (!hit || Math.abs(hit.q[0]) > 1 || Math.abs(hit.q[1]) > 1) return;
                    const order = [depth(view, hit.q), k, u];
                    if (!best || !ahead(best.order, order)) best = { piece, frame: hit.frame, order };
                });
            });
            return best;
        }

        // the children of the items being edited inside come first, the innermost's first
        for (const inside of [...mContainers.map(c => c.id).reverse(), null]) {
            const pieces = drawnPieces(inside);
            for (const view of views) {
                const best = view.sprites ? frontSprite(view, pieces) : frontBuffer(view, pieces);
                if (best) {
                    const { piece, frame } = best;
                    return { item: piece.pick, parent: piece.parent, frame, frameInv: frame ? frame.getInverse() : null };
                }
            }
        }
        return null;
    }

    // ── the container: a closed item edited inside ───────────────────────────

    /**
     * edit inside the item: new items go into it, its children are picked,
     * and those it stands among stay in reach; those being edited inside
     * that do not hold it are left. frame, frameInv: the copy it was entered
     * on (frame maps that copy onto the item's own place), so that what is
     * drawn on the copy lands inside the item
     */
    function enterContainer(id, frame, frameInv){
        const item = mDoc.getItem(id);
        if (!item || item.type === 'image' || !(item.closed || item.type === 'group')) return;
        const around = new Set(mDoc.itemChain(id).slice(0, -1).map(it => it.id));
        mContainers = [...mContainers.filter(c => around.has(c.id)), { id, frame, frameInv }];
        mSelection = [];
        mSelectedVertex = null;
        mRepaint();
    }

    /** a step out of the innermost item being edited inside */
    function leaveContainer(){
        if (!mContainers.length) return;
        mContainers = mContainers.slice(0, -1);
        mSelection = [];
        mSelectedVertex = null;
        mRepaint();
    }

    /** the outline of the innermost item being edited inside, on the copy it was entered on */
    function drawContainer(ctx){
        while (mContainers.length && !mDoc.getItem(container().id)) mContainers = mContainers.slice(0, -1);
        const c = container();
        if (!c) return;
        const path = itemCanvasPath(mDoc.getItem(c.id), c.frameInv);
        ctx.save();
        ctx.beginPath();
        tracePath(ctx, path);
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
        // an image, a group or a frame painting nothing has no stroke and fill
        // to show: the next shape drawn would take its nothing
        const first = mSelection.length ? mDoc.getItem(mSelection[0].id) : null;
        if (first && first.type !== 'image' && first.type !== 'group' && paints(first.style)) configFromStyle(first.style);
        else mPropertiesChanged();
        mRepaint();
    }

    function isSelected(id){
        return mSelection.some(s => s.id === id);
    }

    function clearSelection(){
        if (!mSelection.length && !mSelectedVertex) return;
        mSelection = [];
        mSelectedVertex = null;
        mPropertiesChanged();
        mRepaint();
    }

    /**
     * selects the item with the id on its own place, as the layers window
     * does: the items holding it are entered, so that it is what a click
     * there picks. add: it joins the selection, or leaves it, when the
     * selection is of its level. An item that is not seen (hidden, held by a
     * hidden item, on a hidden or a locked layer) is not selected; returns
     * whether it was
     */
    function selectItem(id, add = false){
        const at = mDoc.findItem(id);
        if (!at || at.layer.isLocked() || !mDoc.isItemShown(id)) return false;
        const holders = mDoc.itemChain(id).slice(0, -1);
        const level = holders.length === mContainers.length && holders.every((h, i) => h.id === mContainers[i].id);
        const sel = { id, frame: null, frameInv: null };
        if (!level) {
            mContainers = holders.map(h => ({ id: h.id, frame: null, frameInv: null }));
            setSelection([sel]);
        } else if (add) {
            setSelection(isSelected(id) ? mSelection.filter(s => s.id !== id) : [...mSelection, sel]);
        } else {
            setSelection([sel]);
        }
        return true;
    }

    // the selected items and the items edited inside that are no longer seen are left
    function leaveUnseen(){
        const gone = mContainers.findIndex(c => !mDoc.isItemShown(c.id));
        if (gone >= 0) mContainers = mContainers.slice(0, gone);
        const seen = mSelection.filter(s => mDoc.isItemShown(s.id));
        if (seen.length !== mSelection.length) {
            mSelection = seen;
            mSelectedVertex = null;
            mPropertiesChanged();
        }
    }

    /**
     * the item with the id shown or hidden (with all it holds), one undo
     * step; hidden, it is no longer selected nor edited inside. Returns
     * whether it changed
     */
    function setItemVisible(id, visible){
        if (!mDoc.setItemVisible(id, visible)) return false;
        const step = (v) => { mDoc.setItemVisible(id, v); leaveUnseen(); };
        leaveUnseen();
        mUndo.push({ label: visible ? 'show' : 'hide', undo: () => step(!visible), redo: () => step(visible) });
        return true;
    }

    /**
     * the item with the id named to, a name the owner checked (a free one,
     * DrawingDocument.renameItem), one undo step; the selection and the
     * items edited inside follow. onRenamed(from, to) is told after the
     * rename, its undo and its redo. Returns whether it was renamed
     */
    function renameItem(id, to, onRenamed = null){
        if (!mDoc.renameItem(id, to)) return false;
        const follow = (from, into) => {
            mSelection = mSelection.map(s => (s.id === from ? { ...s, id: into } : s));
            mContainers = mContainers.map(c => (c.id === from ? { ...c, id: into } : c));
            if (mSelectedVertex && mSelectedVertex.id === from) mSelectedVertex = { ...mSelectedVertex, id: into };
            if (onRenamed) onRenamed(from, into);
        };
        follow(id, to);
        mUndo.push({ label: 'rename',
            undo: () => { if (mDoc.renameItem(to, id)) follow(to, id); },
            redo: () => { if (mDoc.renameItem(id, to)) follow(id, to); } });
        return true;
    }

    /** the vertex picked for editing (the node tool): {id, vertex} or null */
    function setSelectedVertex(v){
        const was = mSelectedVertex;
        mSelectedVertex = v;
        if ((was && was.id) !== (v && v.id) || (was && was.vertex) !== (v && v.vertex)) mPropertiesChanged();
        mRepaint();
    }

    // ── undoable edits ───────────────────────────────────────────────────────

    function applyReplace(map){
        map.forEach((item, id) => { if (item) mDoc.updateItem(id, item); });
    }

    /** record a replacement of items done already (before, after: Map id -> item) */
    function pushReplace(label, before, after, mergeKey = null){
        const b = new Map([...before].map(([id, it]) => [id, itemCopy(it)]));
        const a = new Map([...after].map(([id, it]) => [id, itemCopy(it)]));
        mUndo.push({ label, mergeKey, undo: () => applyReplace(b), redo: () => applyReplace(a) });
    }

    /** the item as drawn on the container's copy, moved onto the container's own place */
    function intoContainer(item){
        const frame = container() && container().frame;
        if (!frame) return item;
        const m = maps();
        // the stroke width as it is on the copy: scaled with the map there
        let sx = 0, sy = 0, n = item.points.length/2;
        for (let i = 0; i + 1 < item.points.length; i += 2) { sx += item.points[i]; sy += item.points[i + 1]; }
        const scale = n ? localScale(frame, m.toPattern.map(sx/n, sy/n)) : 1;
        const style = { ...item.style, strokeWidth: (item.style.strokeWidth || 0)*scale };
        // its points, nodes or a shape's numbers
        return { ...mappedItem(item, w => mapWorld(frame, w, m)), style };
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

    /**
     * the selected polylines as paths of curves fitted to their vertices (a
     * shape's polyline too, its numbers then dropped); one undo step
     */
    function fitSelection(){
        const before = new Map(), after = new Map();
        for (const sel of mSelection) {
            const item = mDoc.getItem(sel.id);
            if (!item || item.type !== 'polyline' || item.tile || item.points.length < 6) continue;
            const plain = plainItem(item);
            const fitted = fittedItem(plain);
            if (fitted === plain) continue;
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

    /**
     * the box [x0, y0, x1, y1] round a selected item's outline on the copy
     * it was picked on: world coordinates, or along the axes [ux, uy, vx,
     * vy] when given (the coordinates x u + y v of the outline's points);
     * null for a tile
     */
    function seenBox(sel, m = maps(), axes = null){
        const item = mDoc.getItem(sel.id);
        if (!item || item.tile) return null;
        const det = axes ? axes[0]*axes[3] - axes[1]*axes[2] : 1;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i + 1 < item.points.length; i += 2) {
            const w = mapWorld(sel.frameInv, [item.points[i], item.points[i + 1]], m);
            const x = axes ? (axes[3]*w[0] - axes[2]*w[1])/det : w[0];
            const y = axes ? (axes[0]*w[1] - axes[1]*w[0])/det : w[1];
            x0 = Math.min(x0, x); x1 = Math.max(x1, x);
            y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        return x0 <= x1 ? [x0, y0, x1, y1] : null;
    }

    /**
     * the selection as seen: the box [x0, y0, x1, y1] round the outlines of
     * the items on the copies they were picked on, in world coordinates or
     * along the given axes (as seenBox); null without one (tiles stay out
     * of it)
     */
    function selectionBox(axes = null){
        const m = maps();
        let box = null;
        for (const sel of mSelection) {
            const b = seenBox(sel, m, axes);
            if (!b) continue;
            box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b;
        }
        return box;
    }

    /**
     * each selected item moved in the seen world by its own step (steps: Map
     * id -> [dx, dy]): the move of its pose from the centre of its box to the
     * centre moved by the step (moveMap); one undo step
     */
    function shiftSelection(steps, label){
        const m = maps();
        const before = new Map(), after = new Map();
        for (const sel of mSelection) {
            const d = steps.get(sel.id), item = mDoc.getItem(sel.id);
            if (!d || !item || (!d[0] && !d[1])) continue;
            const b = seenBox(sel, m);
            if (!b) continue;
            const c = [0.5*(b[0] + b[2]), 0.5*(b[1] + b[3])];
            before.set(sel.id, item);
            after.set(sel.id, mappedOnCopy(item, sel, moveMap(c, [c[0] + d[0], c[1] + d[1]]), true, m));
        }
        if (!after.size) return;
        applyReplace(after);
        pushReplace(label, before, after);
        mSelectedVertex = null;
        mRepaint();
    }

    /** the selected items lined up on the selection's box: 'left', 'hcentre', 'right', 'top', 'vcentre' or 'bottom' */
    function alignSelection(mode){
        const m = maps();
        const boxes = mSelection.map(sel => ({ sel, box: seenBox(sel, m) })).filter(e => e.box);
        if (boxes.length < 2) return;
        const all = [Math.min(...boxes.map(e => e.box[0])), Math.min(...boxes.map(e => e.box[1])), Math.max(...boxes.map(e => e.box[2])), Math.max(...boxes.map(e => e.box[3]))];
        const steps = new Map();
        for (const { sel, box } of boxes) {
            let dx = 0, dy = 0;
            switch (mode) {
            case 'left':    dx = all[0] - box[0]; break;
            case 'hcentre': dx = 0.5*(all[0] + all[2]) - 0.5*(box[0] + box[2]); break;
            case 'right':   dx = all[2] - box[2]; break;
            case 'bottom':  dy = all[1] - box[1]; break;
            case 'vcentre': dy = 0.5*(all[1] + all[3]) - 0.5*(box[1] + box[3]); break;
            case 'top':     dy = all[3] - box[3]; break;
            default: break;
            }
            steps.set(sel.id, [dx, dy]);
        }
        shiftSelection(steps, 'align');
    }

    /** the selected items spread along the axis ('x' or 'y') with equal gaps between them, the outer two staying */
    function distributeSelection(axis){
        const m = maps();
        const a = axis === 'x' ? 0 : 1;
        const boxes = mSelection.map(sel => ({ sel, box: seenBox(sel, m) })).filter(e => e.box)
                                .sort((p, q) => (p.box[a] + p.box[a + 2]) - (q.box[a] + q.box[a + 2]));
        if (boxes.length < 3) return;
        const lo = boxes[0].box[a], hi = boxes[boxes.length - 1].box[a + 2];
        const sizes = boxes.reduce((s, e) => s + (e.box[a + 2] - e.box[a]), 0);
        const gap = (hi - lo - sizes)/(boxes.length - 1);
        const steps = new Map();
        let at = lo;
        for (const { sel, box } of boxes) {
            const d = at - box[a];
            steps.set(sel.id, axis === 'x' ? [d, 0] : [0, d]);
            at += (box[a + 2] - box[a]) + gap;
        }
        shiftSelection(steps, 'distribute');
    }

    /**
     * the items of before (Map id -> item, the selection as it was) with a
     * map of the seen world applied through each one's frame, so that it
     * acts on the copy the user sees: Map id -> item (tiles left out)
     */
    /**
     * the item as it is seen on its copy (sel) carried by a map of the seen
     * world: the map conjugated by the copy's frame; with scaleStrokes the
     * stroke widths follow the map's local scale at the item (carriedItem),
     * as they do under the isometries of a curved geometry
     */
    function mappedOnCopy(item, sel, map, scaleStrokes = false, m = maps()){
        const f = p => mapWorld(sel.frame, map(mapWorld(sel.frameInv, p, m)), m);
        return scaleStrokes ? carriedItem(item, f) : mappedItem(item, f);
    }

    function transformedSelection(before, map, scaleStrokes = false){
        const m = maps();
        const after = new Map();
        for (const sel of mSelection) {
            const item = before.get(sel.id);
            if (!item || item.tile) continue;
            after.set(sel.id, mappedOnCopy(item, sel, map, scaleStrokes, m));
        }
        return after;
    }

    /**
     * the box [x0, y0, x1, y1] round the points of the items themselves (their
     * own copies, world coordinates); null without points
     */
    function itemsBox(items){
        let box = null;
        for (const item of items) {
            const p = item && item.points;
            if (!p) continue;
            for (let i = 0; i + 1 < p.length; i += 2) {
                box = box ? [Math.min(box[0], p[i]), Math.min(box[1], p[i + 1]), Math.max(box[2], p[i]), Math.max(box[3], p[i + 1])]
                          : [p[i], p[i + 1], p[i], p[i + 1]];
            }
        }
        return box;
    }

    /**
     * do the items (a Map or an array) fit their cell: in a Kleinian group the
     * local geometry at the centre of their box, the maximal disk (or half
     * plane) of the domain of discontinuity there, must hold the box, since a
     * shape across the limit set has copies everywhere and a move across it
     * blows the shape up; true in every other geometry. The select tool's drags
     * are guarded by it (the keepInCell setting)
     */
    function fitsCell(items){
        if (geometry().fallback !== 'kleinian') return true;
        const box = itemsBox(items instanceof Map ? items.values() : items);
        if (!box) return true;
        const c = [0.5*(box[0] + box[2]), 0.5*(box[1] + box[3])];
        const g = localGeometry(c);
        if (g.kind === 'euclidean') return true;
        const corners = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]];
        // a corner the clamp would move is outside the model of the centre
        return corners.every(q => { const k = clampToModel(g, c, q); return k[0] === q[0] && k[1] === q[1]; });
    }

    /**
     * the world rectangle the view shows, [x0, y0, x1, y1]: the view's own
     * (visible), else from its canvas size and the world at the canvas corners
     * (its centre and the pixel size when the view is not linear); [-1, 1]^2
     * without a size (the tests' view)
     */
    function visibleRect(){
        if (mView.visible) return mView.visible();
        if (!mView.canvasSize) return [-1, -1, 1, 1];
        const [w, h] = mView.canvasSize();
        if (!mView.isLinear || mView.isLinear()) {
            const a = mView.toWorld([0, 0]).pnt, b = mView.toWorld([w, h]).pnt;
            return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
        }
        const c = mView.toWorld([w/2, h/2]).pnt, px = mView.pixelSize();
        return [c[0] - w*px/2, c[1] - h*px/2, c[0] + w*px/2, c[1] + h*px/2];
    }

    /**
     * the selection scaled and moved as a plain similarity, whatever the
     * geometry setting, to a size that is seen and handled again (a shape blown
     * up by a drag across a Kleinian group's limit set, or lost far away):
     *   'view'  its box a third of the visible canvas, at the view's centre;
     *   'cell'  its box's diagonal half the local disk of the group at its
     *           centre (a Kleinian group's maximal disk there, the whole disk
     *           of a hyperbolic group), at the disk's centre; in a half plane
     *           the centre stays and the diagonal is its distance to the line;
     *           the view where there is no disk.
     * The strokes scale along, one blown up or shrunk beyond recognition (twenty
     * times off the tool's width) takes the tool's width; one undo step
     */
    function fitSelection(target = 'view'){
        const box = selectionBox();
        if (!box) return;
        const c = [0.5*(box[0] + box[2]), 0.5*(box[1] + box[3])];
        const w = Math.max(box[2] - box[0], 1e-12), h = Math.max(box[3] - box[1], 1e-12);
        const g = target === 'cell' ? localGeometry(c) : null;
        let t, s;
        if (g && g.kind === 'hyperbolic' && g.c && g.r) {
            t = g.c;
            s = FIT_CELL_SHARE*2*g.r/Math.hypot(w, h);
        } else if (g && g.kind === 'halfplane' && g.p && g.e) {
            // a half plane (the limit set reaches infinity): the centre stays, the box's
            // diagonal a share of twice the centre's distance to the line
            const d = Math.abs((c[1] - g.p[1])*g.e[0] - (c[0] - g.p[0])*g.e[1]);
            t = c;
            s = FIT_CELL_SHARE*2*d/Math.hypot(w, h);
        } else {
            const vis = visibleRect();
            t = [0.5*(vis[0] + vis[2]), 0.5*(vis[1] + vis[3])];
            s = FIT_VIEW_SHARE*Math.min(vis[2] - vis[0], vis[3] - vis[1])/Math.max(w, h);
        }
        const ids = mSelection.map(sel => sel.id);
        const before = new Map(ids.map(id => [id, mDoc.getItem(id)]).filter(e => e[1]));
        const after = transformedSelection(before, q => [t[0] + s*(q[0] - c[0]), t[1] + s*(q[1] - c[1])], true);
        if (!after.size) return;
        // a stroke blown up or shrunk with the shape beyond recognition takes the tool's width
        after.forEach((item, id) => {
            const sw = item.style && item.style.strokeWidth;
            if (typeof sw === 'number' && (sw > FIT_STROKE_RATIO*mStyleCfg.width || sw*FIT_STROKE_RATIO < mStyleCfg.width)) {
                after.set(id, { ...item, style: { ...item.style, strokeWidth: mStyleCfg.width } });
            }
        });
        applyReplace(after);
        pushReplace('fit', before, after);
        mSelectedVertex = null;
        mRepaint();
    }

    /** the selection transformed by a map of the seen world; one undo step */
    function transformSelection(map, label, scaleStrokes = false){
        const ids = mSelection.map(s => s.id);
        const before = new Map(ids.map(id => [id, mDoc.getItem(id)]).filter(e => e[1]));
        const after = transformedSelection(before, map, scaleStrokes);
        if (!after.size) return;
        applyReplace(after);
        pushReplace(label, before, after);
        mSelectedVertex = null;
        mRepaint();
    }

    /**
     * the selection mirrored about the centre of its box, in the geometry:
     * axis 'x' swaps left and right (the reflection in the geodesic up
     * through the centre), 'y' top and bottom
     */
    function flipSelection(axis){
        const b = selectionBox();
        if (!b) return;
        const c = [0.5*(b[0] + b[2]), 0.5*(b[1] + b[3])];
        transformSelection(flipMap(c, axis === 'x' ? [0, 1] : [1, 0]), 'flip', true);
    }

    /** the selection turned about the centre of its box by the angle (radians, counterclockwise), in the geometry */
    function rotateSelection(angle){
        const b = selectionBox();
        if (!b) return;
        transformSelection(rotationMap([0.5*(b[0] + b[2]), 0.5*(b[1] + b[3])], angle), 'rotate', true);
    }

    // ── the clipboard and the order ──────────────────────────────────────────

    let mClipboard = [];    // copies of items, world coordinates

    function selectedItems(){
        return mSelection.map(s => mDoc.getItem(s.id)).filter(Boolean);
    }

    /** copies of the selected items kept for pasting; how many */
    function copySelection(){
        mClipboard = selectedItems().map(itemCopy);
        return mClipboard.length;
    }

    /** the kept items added where new items go (new ids, a tile as a plain shape), and selected */
    function pasteClipboard(){
        if (!mClipboard.length) return;
        const items = mClipboard.map(it => { const c = itemCopy(it); delete c.id; delete c.tile; return c; });
        const added = addItems(items, 'paste');
        setSelection(added.map(it => ({ id: it.id, frame: null, frameInv: null })));
    }

    function duplicateSelection(){
        if (copySelection()) pasteClipboard();
    }

    /**
     * an item carried by a map of the world (a symmetry taking one copy to
     * another, a motion of the geometry): its points, and its stroke widths
     * scaled as the map scales at its first point (1 for the isometries of
     * the plane). The map carries that point exactly, where it moves the
     * centre of the box only nearly, so a move there and back restores the
     * widths. The item itself when the map leaves it where it is
     */
    function carriedItem(item, map){
        const p = item.points;
        if (!p || p.length < 2) return item;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i + 1 < p.length; i += 2) {
            x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
        }
        const c = [p[0], p[1]];
        const eps = 1e-4*Math.max(x1 - x0, y1 - y0, 1e-6);
        const a = map(c), b = map([c[0] + eps, c[1]]), b0 = map([c[0] - eps, c[1]]), d = map([x1, y1]);
        if (Math.hypot(a[0] - c[0], a[1] - c[1]) < 1e-12 && Math.hypot(d[0] - x1, d[1] - y1) < 1e-12) return item;
        const scale = Math.hypot(b[0] - b0[0], b[1] - b0[1])/(2*eps);
        const scaled = (it) => ({ ...it, style: { ...it.style, strokeWidth: (it.style.strokeWidth || 0)*scale },
                                  ...(it.children ? { children: it.children.map(scaled) } : {}) });
        const out = mappedItem(item, map);
        return Math.abs(scale - 1) < 1e-9 ? out : scaled(out);
    }

    /** the item and its members (a group's, all the way down) carried once
     *  more: the word of the symmetry back is applied first, then the words
     *  they had (their colours come from where they were before) */
    function withColorWord(item, word){
        if (!word) return item;
        if (item.type === 'group') return { ...item, children: (item.children || []).map(c => withColorWord(c, word)) };
        return { ...item, colorWord: word + (item.colorWord || '') };
    }

    /**
     * the item as it is seen on the copy it was picked on (sel), carried to
     * the own place of what was picked on the copy of onto (the symmetry
     * between the two copies), so that the two stand as they stand next to
     * each other there
     */
    function carriedOnto(item, sel, onto){
        const m = maps();
        const carried = carriedItem(item, p => mapWorld(onto.frame, mapWorld(sel.frameInv, p, m), m));
        if (carried === item) return carried;
        // the symmetry back to where it was seen, for the colour layers to
        // colour it as it was there (in the document's generators: the word
        // holds with the Dirichlet domain on or off)
        const h = composeTransforms(sel.frameInv, onto.frame);
        return h ? withColorWord(carried, dirichletSourceWord(m.ctx.group, h.getInverse().getWord() || '')) : carried;
    }

    /**
     * the selected items of one list (the first's) as one group, in the
     * place of the topmost of them, made of what is seen: each member is
     * carried from the copy it was picked on to the first member's own
     * place (the symmetry between the two copies), so the group is the
     * shapes as they stand next to each other there; the pattern keeps the
     * same shapes. A tile stays where the domain puts it. One undo step; the
     * group selected on the first member's copy
     */
    function groupSelection(){
        const infos = mSelection.map(s => ({ sel: s, id: s.id, at: mDoc.findItem(s.id) })).filter(e => e.at);
        if (!infos.length) return;
        const first = infos[0];
        const members = infos.filter(e => e.at.layer === first.at.layer && e.at.parentId === first.at.parentId).sort((a, b) => a.at.index - b.at.index);
        const layerId = first.at.layer.getId(), parentId = first.at.parentId;
        const top = members[members.length - 1].at.index;
        // taken out from the top down, so the lower indices stay right
        const removed = members.slice().reverse().map(e => mDoc.removeItem(e.id)).filter(Boolean).reverse();
        const at = top - (removed.length - 1);
        const selOf = new Map(members.map(e => [e.id, e.sel]));
        const children = removed.map(r => {
            const sel = selOf.get(r.item.id);
            return !sel || r.item.tile ? r.item : carriedOnto(r.item, sel, first.sel);
        });
        const group = mDoc.insertItem({ type: 'group', children }, layerId, at, parentId);
        const saved = itemCopy(group);
        mUndo.push({ label: 'group',
            undo: () => { mDoc.removeItem(saved.id); removed.forEach(r => mDoc.insertItem(r.item, r.layerId, r.index, r.parentId)); },
            redo: () => { removed.slice().reverse().forEach(r => mDoc.removeItem(r.item.id)); mDoc.insertItem(saved, layerId, at, parentId); } });
        setSelection([{ id: group.id, frame: first.sel.frame, frameInv: first.sel.frameInv }]);
    }

    /** the selected groups taken apart, their members in their places; one undo step; the members selected */
    function ungroupSelection(){
        const groups = mSelection.map(s => mDoc.getItem(s.id)).filter(it => it && it.type === 'group');
        if (!groups.length) return;
        const steps = [];
        const selection = [];
        for (const g of groups) {
            const r = mDoc.removeItem(g.id);
            if (!r) continue;
            const children = r.item.children || [];
            children.forEach((child, k) => mDoc.insertItem(child, r.layerId, r.index + k, r.parentId));
            steps.push({ group: itemCopy(r.item), layerId: r.layerId, index: r.index, parentId: r.parentId, childIds: children.map(c => c.id) });
            selection.push(...children.map(c => ({ id: c.id, frame: null, frameInv: null })));
        }
        mUndo.push({ label: 'ungroup',
            undo: () => steps.slice().reverse().forEach(s => { s.childIds.slice().reverse().forEach(id => mDoc.removeItem(id)); mDoc.insertItem(s.group, s.layerId, s.index, s.parentId); }),
            redo: () => steps.forEach(s => { const r = mDoc.removeItem(s.group.id); if (r) (r.item.children || []).forEach((c, k) => mDoc.insertItem(c, r.layerId, r.index + k, r.parentId)); }) });
        setSelection(selection);
    }

    /** the ids of a list in their new order: the selected ones a step up or
     *  down (past the next one not selected; selected neighbours move as a
     *  block), or all on top or at the bottom, keeping their order */
    function reorderedIds(ids, selected, where){
        const isSel = (id) => selected.has(id);
        if (where === 'top') return [...ids.filter(id => !isSel(id)), ...ids.filter(isSel)];
        if (where === 'bottom') return [...ids.filter(isSel), ...ids.filter(id => !isSel(id))];
        const out = ids.slice();
        if (where === 'up') {
            for (let i = out.length - 2; i >= 0; i--) if (isSel(out[i]) && !isSel(out[i + 1])) [out[i], out[i + 1]] = [out[i + 1], out[i]];
        } else {
            for (let i = 1; i < out.length; i++) if (isSel(out[i]) && !isSel(out[i - 1])) [out[i], out[i - 1]] = [out[i - 1], out[i]];
        }
        return out;
    }

    /** the selected items moved in the lists they are in (a layer's items, a
     *  group's children): 'up', 'down', 'top' or 'bottom'; one undo step */
    function reorderSelection(where){
        const lists = new Map();
        for (const sel of mSelection) {
            const at = mDoc.findItem(sel.id);
            if (!at) continue;
            const key = at.layer.getId() + '/' + (at.parentId || '');
            if (!lists.has(key)) {
                const siblings = at.parentId ? ((mDoc.getItem(at.parentId) || {}).children || []) : at.layer.getItems();
                lists.set(key, { layerId: at.layer.getId(), parentId: at.parentId, ids: siblings.map(it => it.id), selected: new Set() });
            }
            lists.get(key).selected.add(sel.id);
        }
        // per list, the items whose place changes: {id, from, to}
        const changes = [];
        for (const list of lists.values()) {
            const moved = [];
            reorderedIds(list.ids, list.selected, where).forEach((id, to) => {
                const from = list.ids.indexOf(id);
                if (from !== to) moved.push({ id, from, to });
            });
            if (moved.length) changes.push({ layerId: list.layerId, parentId: list.parentId, moved });
        }
        if (!changes.length) return;
        // the moved items taken out, then put back from the bottom up at their
        // places ('to'), or at the places they came from ('from') for the undo
        const apply = (place) => changes.forEach(c => {
            const taken = c.moved.map(m => ({ ...m, item: (mDoc.removeItem(m.id) || {}).item })).filter(m => m.item);
            taken.sort((a, b) => a[place] - b[place]).forEach(m => mDoc.insertItem(m.item, c.layerId, m[place], c.parentId));
        });
        apply('to');
        mUndo.push({ label: 'order', undo: () => apply('from'), redo: () => apply('to') });
        mRepaint();
    }

    /** the layer next to a layer, above (dir +1) or below (-1) it, hidden or
     *  locked too; null at the end of the list */
    function neighbourLayer(layer, dir){
        const layers = mDoc.getLayers();
        return layers[layers.indexOf(layer) + dir] || null;
    }

    /** the selected items that can go to the layer above (dir +1) or below (-1)
     *  theirs: [{id, fromLayer, fromIndex, toLayer}]; items inside a group stay */
    function layerMoves(dir){
        const moves = [];
        for (const sel of mSelection) {
            const at = mDoc.findItem(sel.id);
            if (!at || at.parentId) continue;
            const target = neighbourLayer(at.layer, dir);
            if (target) moves.push({ id: sel.id, fromLayer: at.layer.getId(), fromIndex: at.index, toLayer: target.getId() });
        }
        return moves;
    }

    /**
     *  the selected items moved to the layer above (dir +1), at the bottom of
     *  its items, or below (dir -1), on top of them: the smallest step in the
     *  drawing order that changes the layer; their order kept. A hidden layer
     *  hides them, a locked one locks them: those leave the selection, the
     *  others stay selected. One undo step
     */
    function moveSelectionToLayer(dir){
        const moves = layerMoves(dir);
        if (!moves.length) return;
        const layerIndex = (id) => mDoc.getLayers().findIndex(l => l.getId() === id);
        moves.sort((a, b) => layerIndex(a.fromLayer) - layerIndex(b.fromLayer) || a.fromIndex - b.fromIndex);
        const take = () => moves.map(m => ({ ...m, item: (mDoc.removeItem(m.id) || {}).item })).filter(m => m.item);
        const forward = () => {
            const placed = new Map();
            for (const m of take()) {
                const k = placed.get(m.toLayer) || 0;
                mDoc.insertItem(m.item, m.toLayer, dir > 0 ? k : null);
                placed.set(m.toLayer, k + 1);
            }
        };
        // back where they were: put in from the bottom up
        const back = () => take().sort((a, b) => a.fromIndex - b.fromIndex).forEach(m => mDoc.insertItem(m.item, m.fromLayer, m.fromIndex));
        forward();
        mUndo.push({ label: dir > 0 ? 'to the layer above' : 'to the layer below', undo: back, redo: forward });
        // what can no longer be seen or picked is no longer selected
        const gone = new Set(moves.filter(m => { const l = mDoc.getLayers().find(x => x.getId() === m.toLayer); return !l || !l.isVisible() || l.isLocked(); })
                                  .map(m => m.id));
        if (gone.size) setSelection(mSelection.filter(s => !gone.has(s.id)));
        mRepaint();
    }

    /**
     * the selected outlines as paths (toPath: polylines get nodes) or as
     * polylines through their outlines; a shape becomes a plain outline, its
     * numbers dropped, what it holds staying inside; images and tiles stay;
     * one undo step
     */
    function convertSelection(toPath){
        const before = new Map(), after = new Map();
        for (const sel of mSelection) {
            const item = mDoc.getItem(sel.id);
            if (!item || item.type === 'image' || item.type === 'group' || item.tile) continue;
            const plain = plainItem(item);
            const out = toPath ? (plain.nodes ? plain : pathFromPolyline(plain))
                               : (plain.nodes ? polylineFromPath(plain) : plain);
            if (out !== item) { before.set(item.id, item); after.set(item.id, out); }
        }
        if (!after.size) return;
        applyReplace(after);
        pushReplace(toPath ? 'to path' : 'to polyline', before, after);
        mSelectedVertex = null;
        mRepaint();
    }

    /**
     * where new content is placed: {box (square, world: cx, cy, half), margin}.
     * The item being edited inside, filled up to the margin; else half the
     * pattern box: smaller than the box, its copies in a depth sort do not
     * all lie in front of it
     */
    function importBox(){
        const inside = container() ? mDoc.getItem(container().id) : null;
        if (inside) {
            const p = inside.points;
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (let i = 0; i + 1 < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
            return { box: { cx: 0.5*(x0 + x1), cy: 0.5*(y0 + y1), half: 0.5*Math.max(x1 - x0, y1 - y0) }, margin: 0.1 };
        }
        const ptc = context().ptc;
        return { box: { cx: ptc.centerX, cy: ptc.centerY, half: IMPORT_SHARE*ptc.scale }, margin: 0 };
    }

    /** is the drawing layer on screen: true when no visualization layer can tell */
    function layerDrawn(id){
        const views = (context().visLayers || []).filter(vl => vl && vl.componentIds);
        if (!views.length) return true;
        return views.some(vl => {
            if (!vl.enabled) return false;
            const ids = vl.componentIds();
            return !!ids && (!ids.length || ids.includes(id));
        });
    }

    /**
     * the layer an import goes on, so that it is seen: the active one if it
     * is, else the topmost that is; {id, note}, the note for what the user
     * did not expect
     */
    function importLayer(label){
        const active = mDoc.getActiveLayer();
        const open = layer => layer.isVisible() && !layer.isLocked();
        const seen = layer => open(layer) && layerDrawn(layer.getId());
        if (seen(active)) return { id: active.getId(), note: '' };
        const why = !active.isVisible() ? 'is hidden' : active.isLocked() ? 'is locked' : 'is not shown by a Color Images or Image layer';
        const other = mDoc.getLayers().filter(seen).pop();
        if (other) return { id: other.getId(), note: `${label} went on layer "${other.getId()}": the active layer "${active.getId()}" ${why}` };
        return { id: active.getId(), note: `${label} went on layer "${active.getId()}" but will not show: the layer ${why}, and no other layer shows` };
    }

    /**
     * adds items already at their place (into the container being edited,
     * else on top of the given layer, or of the active one) as one undoable step
     */
    function addItems(items, label, layerId = null){
        const parentId = container() ? container().id : null;
        const added = items.map(item => {
            const it = mDoc.insertItem(item, layerId, null, parentId);
            const at = mDoc.findItem(it.id);
            return { saved: itemCopy(it), layerId: at.layer.getId(), index: at.index };
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
        mContainers = [];
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

    /**
     * imported items added as one step, in sight: the Select tool on and the
     * items selected, what the user should know on one banner
     */
    function addImported(items, label, name, note){
        const c = container();
        const layer = c ? { id: null, note: '' } : importLayer(name);
        const added = addItems(items, label, layer.id);
        if (par.activateTool) par.activateTool('select');
        setSelection(added.map(it => ({ id: it.id, frame: c ? c.frame : null, frameInv: c ? c.frameInv : null })));
        const notes = [note, layer.note].filter(Boolean);
        if (notes.length) showWarningBanner(notes.join('\n'), 8000);
        return added;
    }

    /** an image blob as {item, width, height}; null when it could not be read, which a banner says */
    async function readImage(blob, label){
        try {
            return await imageItemFromBlob(blob);
        } catch (e) {
            console.error(`${label} could not be read as an image`, e);
            showWarningBanner(`${label} could not be read as an image: ${e.message}`);
            return null;
        }
    }

    /**
     * the shapes of an SVG text placed in a box, its text traced into them,
     * itemsOfSvg's result with left saying what it left out; null when it
     * could not be read, which a banner says
     */
    async function readSvg(text, label, box, margin){
        try {
            const source = parseSvg(text);
            await outlineText(source);
            const parsed = itemsOfSvg(source, box, margin);
            return { ...parsed, left: Object.entries(parsed.skipped).map(([what, count]) => `${count} ${what}`).join(', ') };
        } catch (e) {
            console.error(`${label} could not be read`, e);
            showWarningBanner(`${label} could not be read: ${e.message}`);
            return null;
        }
    }

    /**
     * an image (a blob: a file, the clipboard) placed in the import box, in
     * a frame (Frames.js); the frame, or null when it could not be read,
     * which a banner says. name: what the user calls it; note: to say along
     * with the import
     */
    async function importImageBlob(blob, name = blob.name, note = ''){
        const label = name ? `"${name}"` : 'The image';
        const made = await readImage(blob, label);
        if (!made) return null;
        const { box, margin } = importBox();
        made.item.points = placeQuad(made.width, made.height, box, margin);
        return addImported([framedImage(made.item)], 'image', label, note)[0];
    }

    /**
     * the shapes of an SVG text placed in the import box, in a frame over
     * its viewport (Frames.js), or, without any, a picture of it; the frame
     * in a list, none when it could not be read. What had to be left out
     * is said.
     */
    async function importSvgText(text, name){
        const label = name ? `"${name}"` : 'The SVG';
        const { box, margin } = importBox();
        const parsed = await readSvg(text, label, box, margin);
        if (!parsed) return [];
        const { items, left, viewport } = parsed;
        if (items.length) return addImported([frameItem(viewport, items)], 'svg', label, left ? `${label} not imported in full: ${left}` : '');
        const blob = new Blob([text], { type: 'image/svg+xml' });
        const picture = await importImageBlob(blob, name, `${label} has no shapes${left ? ` (${left})` : ''}, added as a picture`);
        return picture ? [picture] : [];
    }

    /** a paste of an image or an SVG text into the drawing; true when taken */
    function paste(data){
        if (!data) return false;
        const file = Array.from(data.files || []).find(f => f.type.startsWith('image/svg')) || Array.from(data.files || []).find(f => f.type.startsWith('image/'));
        if (file && file.type.startsWith('image/svg')) { file.text().then(text => importSvgText(text, file.name)); return true; }
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

    /**
     * the image a Replace acts on: the selected one, or the only one held by
     * the shape selected; null without one
     */
    function selectedImage(){
        if (mSelection.length !== 1) return null;
        const item = mDoc.getItem(mSelection[0].id);
        if (!item) return null;
        if (item.type === 'image') return item;
        const images = (item.children || []).filter(c => c.type === 'image');
        return images.length === 1 ? images[0] : null;
    }

    /**
     * the selected image replaced by another (a blob), in its place and
     * unstretched, covering what the old one covered; one undo step; the
     * image item, or null when there is none or the blob could not be read,
     * which a banner says
     */
    async function replaceSelectedImage(blob, name = blob.name){
        const label = name ? `"${name}"` : 'The image';
        const target = selectedImage();
        if (!target) {
            showWarningBanner('Select an image to replace first');
            return null;
        }
        const made = await readImage(blob, label);
        if (!made) return null;
        const image = mDoc.getItem(target.id);
        if (!image) return null;
        const after = new Map([[image.id, { ...image, src: made.item.src, points: coverQuad(image.points, made.width, made.height) }]]);
        applyReplace(after);
        pushReplace('replace image', new Map([[image.id, image]]), after);
        mRepaint();
        return after.get(image.id);
    }

    /** the item a release puts on the layer: what its holder gave it, its opacity and colours, kept in it */
    function releasedFrom(item, holder){
        const { opacity = 1 } = holder.style;
        const out = { ...item, style: { ...item.style, opacity: (item.style.opacity ?? 1)*opacity } };
        return withColorWord(out, holder.colorWord || '');
    }

    /**
     * what the selected shapes hold put back in their place, in front of
     * them and no longer cut off, as Ungroup does; a shape that paints
     * nothing goes (an image comes out in a whole frame of its own, its crop
     * gone); one undo step; what came out selected
     */
    function releaseContent(){
        const forward = (step) => {
            const { children, ...shape } = step.saved;
            if (step.stays) mDoc.updateItem(shape.id, shape); else mDoc.removeItem(shape.id);
            const at = step.index + (step.stays ? 1 : 0);
            step.ids = step.content.map((c, k) => mDoc.insertItem(c, step.layerId, at + k, step.parentId).id);
        };
        const back = (step) => {
            step.ids.slice().reverse().forEach(id => mDoc.removeItem(id));
            if (step.stays) mDoc.updateItem(step.saved.id, step.saved);
            else mDoc.insertItem(step.saved, step.layerId, step.index, step.parentId);
        };
        const steps = [], selection = [];
        for (const sel of mSelection) {
            const item = mDoc.getItem(sel.id);
            if (!item || item.type === 'group' || !(item.children && item.children.length)) continue;
            const at = mDoc.findItem(item.id);
            const saved = itemCopy(item);
            const step = { saved, layerId: at.layer.getId(), index: at.index, parentId: at.parentId, stays: paints(item.style),
                           content: saved.children.map(c => releasedFrom(c, saved)), ids: [] };
            forward(step);
            steps.push(step);
            selection.push(...step.ids.map(id => ({ id, frame: sel.frame, frameInv: sel.frameInv })));
        }
        if (!steps.length) return;
        mUndo.push({ label: 'release', undo: () => steps.slice().reverse().forEach(back), redo: () => steps.forEach(forward) });
        setSelection(selection);
    }

    // ── fills ────────────────────────────────────────────────────────────────

    /** the selected shapes a fill can go into: the closed ones */
    function fillableItems(){
        return selectedItems().filter(isFillable);
    }

    /**
     * the selected closed shapes hold what content(fillBox of the shape)
     * gives instead of what they held, as a colour replaces a colour; one
     * undo step
     */
    function setFill(label, content){
        const before = new Map(fillableItems().map(it => [it.id, it]));
        const after = new Map([...before].map(([id, it]) => [id, { ...it, children: content(fillBox(it)) }]));
        applyReplace(after);
        // with the ids the document gave the content: the edits inside it undone after this one need them
        for (const id of after.keys()) after.set(id, mDoc.getItem(id));
        pushReplace(label, before, after);
        mPropertiesChanged();
        mRepaint();
    }

    /** the selected closed shapes filled with the image (a blob), covering each unstretched; a banner says why not */
    async function fillWithImage(blob, name = blob.name){
        if (!fillableItems().length) { showWarningBanner(NOTHING_TO_FILL); return false; }
        const made = await readImage(blob, name ? `"${name}"` : 'The image');
        if (!made) return false;
        setFill('image fill', box => [imageCovering(made.item, made.width, made.height, box)]);
        return true;
    }

    /**
     * the selected closed shapes filled with the shapes of an SVG text, in a
     * frame over its viewport (moved as one, a double click edits them),
     * covering each unstretched; without any, with a picture of it. What had
     * to be left out, or why nothing was done, a banner says
     */
    async function fillWithSvg(text, name){
        if (!fillableItems().length) { showWarningBanner(NOTHING_TO_FILL); return false; }
        const label = name ? `"${name}"` : 'The SVG';
        const parsed = await readSvg(text, label, { cx: 0, cy: 0, half: 1 }, 0);
        if (!parsed) return false;
        const { items, left, viewport } = parsed;
        if (!items.length) {
            const done = await fillWithImage(new Blob([text], { type: 'image/svg+xml' }), name);
            if (done) showWarningBanner(`${label} has no shapes${left ? ` (${left})` : ''}, a picture of it is the fill`, 8000);
            return done;
        }
        setFill('svg fill', box => [carriedItem(frameItem(viewport, items), fillMap(box, viewport.rx, viewport.ry))]);
        if (left) showWarningBanner(`${label} not imported in full: ${left}`, 8000);
        return true;
    }

    /** which of two places of findItem is drawn first: their layers, then what holds them */
    function drawnOrder(a, b){
        const layers = mDoc.getLayers();
        const apart = layers.indexOf(a.layer) - layers.indexOf(b.layer);
        if (apart) return apart;
        const k = a.path.findIndex((n, i) => n !== b.path[i]);
        return k < 0 || k >= b.path.length ? a.path.length - b.path.length : a.path[k] - b.path[k];
    }

    /**
     * what Selection as fill would do, {target, content} (each with its
     * sel), null when there is nothing to do: the topmost closed shape that
     * paints takes the others, the topmost closed shape when none does (an
     * image put over a star goes into the star). Tiles stay where the domain
     * puts them, and what holds the shape stays around it
     */
    function selectionFill(){
        const infos = mSelection.map(sel => ({ sel, item: mDoc.getItem(sel.id), at: mDoc.findItem(sel.id) })).filter(e => e.at)
                                .sort((a, b) => drawnOrder(a.at, b.at));
        const shapes = infos.filter(e => isFillable(e.item));
        const target = shapes.filter(e => paints(e.item.style)).pop() || shapes.pop();
        if (!target) return null;
        const around = new Set(mDoc.itemChain(target.item.id).map(it => it.id));
        const content = infos.filter(e => !e.item.tile && !around.has(e.item.id) && e.at.parentId !== target.item.id);
        return content.length ? { target, content } : null;
    }

    /**
     * the selection moved into its closed shape (selectionFill), on top of
     * what the shape holds, staying where it is seen and cut off by the
     * outline; one undo step; the shape selected
     */
    function selectionAsFill(){
        const plan = selectionFill();
        if (!plan) return;
        const { target, content } = plan;
        const id = target.item.id;
        // taken out from the top down, so the lower indices stay right
        const moved = content.slice().reverse().map(e => ({ ...mDoc.removeItem(e.item.id), sel: e.sel }));
        const before = mDoc.getItem(id);
        const carried = moved.slice().reverse().map(r => carriedOnto(r.item, r.sel, target.sel));
        const saved = itemCopy(mDoc.updateItem(id, { ...before, children: [...(before.children || []), ...carried] }));
        mUndo.push({ label: 'selection as fill',
            undo: () => { mDoc.updateItem(id, before); moved.slice().reverse().forEach(r => mDoc.insertItem(r.item, r.layerId, r.index, r.parentId)); },
            redo: () => { moved.forEach(r => mDoc.removeItem(r.item.id)); mDoc.updateItem(id, saved); } });
        setSelection([target.sel]);
    }

    /** what the selected shapes hold deleted; a shape that then paints nothing goes; one undo step */
    function removeFill(){
        const forward = (step) => {
            const { children, ...shape } = step.saved;
            if (step.stays) mDoc.updateItem(shape.id, shape); else mDoc.removeItem(shape.id);
        };
        const back = (step) => {
            if (step.stays) mDoc.updateItem(step.saved.id, step.saved);
            else mDoc.insertItem(step.saved, step.layerId, step.index, step.parentId);
        };
        const steps = fillableItems().filter(it => it.children).map(it => {
            const at = mDoc.findItem(it.id);
            const step = { saved: itemCopy(it), layerId: at.layer.getId(), index: at.index, parentId: at.parentId, stays: paints(it.style) };
            forward(step);
            return step;
        });
        if (!steps.length) return;
        mUndo.push({ label: 'remove fill', undo: () => steps.slice().reverse().forEach(back), redo: () => steps.forEach(forward) });
        setSelection(mSelection);
    }

    // the picture of the fill of the selection, made once per item and decoded images
    let mThumbnail = { item: null, images: -1, url: null };

    /** a picture of what the selected shape holds, for the fill's swatch; null when it holds nothing */
    function fillThumbnail(){
        const item = fillableItems().find(it => it.children);
        if (!item) return null;
        const images = getImagesVersion();
        if (mThumbnail.item !== item || mThumbnail.images !== images) mThumbnail = { item, images, url: contentThumbnail(item) };
        return mThumbnail.url;
    }

    /** the opacity of the selected items, whole, what they hold too; one undo step per value dragged */
    function setOpacity(value){
        const before = new Map(selectedItems().map(it => [it.id, it]));
        if (!before.size) return;
        const after = new Map([...before].map(([id, it]) => [id, { ...it, style: { ...it.style, opacity: value } }]));
        applyReplace(after);
        pushReplace('opacity', before, after, 'opacity');
        mRepaint();
    }

    /** adds an item on top of the active layer, or into the item being edited inside */
    function addItem(item){
        const parentId = container() ? container().id : null;
        const drawn = { ...item, style: item.style || styleFromConfig() };
        const it = mDoc.insertItem(parentId ? intoContainer(drawn) : drawn, null, null, parentId);
        const at = mDoc.findItem(it.id);
        const saved = itemCopy(it);
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
        // a null between the rings of a compound path: no line there
        const bridges = itemBridges(item);
        for (let i = 0; i < segs; i++) {
            if (bridges && bridges.has(i)) { out.push(toCanvas(pts[2*i], pts[2*i + 1]), null); continue; }
            const j = (i + 1) % n;
            for (let k = 0; k < sub; k++) {
                const t = k/sub;
                out.push(toCanvas(pts[2*i] + t*(pts[2*j] - pts[2*i]), pts[2*i + 1] + t*(pts[2*j + 1] - pts[2*i + 1])));
            }
        }
        if (!item.closed) out.push(toCanvas(pts[2*(n - 1)], pts[2*(n - 1) + 1]));
        else if (!bridges) out.push(out[0]);
        return out;
    }

    /** a canvas path as lines, starting again after a null */
    function tracePath(ctx, path){
        let down = false;
        for (const p of path) {
            if (p && down) ctx.lineTo(p[0], p[1]);
            else if (p) ctx.moveTo(p[0], p[1]);
            down = !!p;
        }
    }
    function strokePath(ctx, path, width, color){
        ctx.beginPath();
        tracePath(ctx, path);
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
    /** a handle of a shape's numbers: a diamond */
    function drawShapeHandle(ctx, c){
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(c[0], c[1] - 6); ctx.lineTo(c[0] + 6, c[1]); ctx.lineTo(c[0], c[1] + 6); ctx.lineTo(c[0] - 6, c[1]);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(200,60,20,0.95)';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

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
        setStyleValue,
        // the selected shape's numbers, and the shape tools'
        setShapeValue,
        getSelectedShape: selectedShape,
        getShapeToolConfig: (kind) => mShapeTools[kind],
        setShapeToolValue,
        getSelectedShapes: selectedShapes,
        releaseShapes,
        // coordinates
        maps,
        mapWorld,
        patternPerPixel,
        // the geometry of the group and its motions, as maps of the seen world
        geometry,
        localGeometry,
        moveMap,
        anchoredMoveMap,
        incrementalMoveMap,
        rotationMap,
        similarityMap,
        flipMap,
        chartAt,
        clampToGeometry,
        mappedOnCopy,
        // picking and snapping
        hitTest,
        snap,
        // selection
        getSelection:   () => mSelection,
        setSelection,
        isSelected,
        clearSelection,
        selectItem,
        getSelectedVertex: () => mSelectedVertex,
        setSelectedVertex,
        // the items being edited inside
        enterContainer,
        leaveContainer,
        getContainer:   container,
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
        fitSelection,
        fitsCell,
        flipSelection,
        rotateSelection,
        alignSelection,
        distributeSelection,
        copySelection,
        pasteClipboard,
        duplicateSelection,
        hasClipboard:   () => mClipboard.length > 0,
        reorderSelection,
        moveSelectionToLayer,
        canMoveSelectionToLayer: (dir) => layerMoves(dir).length > 0,
        groupSelection,
        ungroupSelection,
        releaseContent,
        setOpacity,
        getSelectedImage: selectedImage,
        replaceSelectedImage,
        chooseImage:    () => (par.chooseImage ? par.chooseImage() : null),
        getFillableItems: fillableItems,
        fillWithImage,
        fillWithSvg,
        chooseFill:     (kind) => (par.chooseFill ? par.chooseFill(kind) : null),
        canSelectionAsFill: () => !!selectionFill(),
        selectionAsFill,
        removeFill,
        fillThumbnail,
        getStyleConfig: () => mStyleCfg,
        pairingMap,
        importImageBlob,
        importSvgText,
        paste,
        removeItems,
        setItemVisible,
        renameItem,
        applyReplace,
        pushReplace,
        // an undo step of the owner's own: {label, undo(), redo()}
        pushUndo:       (entry) => mUndo.push(entry),
        // no steps to undo or redo (a document loaded: they were of the drawing before it)
        clearUndo:      () => mUndo.clear(),
        undo,
        redo,
        canUndo:        () => mUndo.canUndo(),
        canRedo:        () => mUndo.canRedo(),
        // overlay
        itemCanvasPath,
        drawOutline,
        drawHandle,
        drawControlHandle,
        drawShapeHandle,
        drawSnap,
        handleCommonKey,
        // the group or the pattern box changed: the frames of the selection are stale
        onGeometryChanged: () => { mSelection = []; mSelectedVertex = null; mContainers = []; mCopies = null; mCacheKey = ''; },
    };

} // function DrawingEditor()

export { DrawingEditor };
