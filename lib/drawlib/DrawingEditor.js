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
    foldHome,
    foldSides,
    boxCopies,
    itemCopies,
    crownCopies,
    spriteCopies,
    imageItemFromBlob,
    imageMask,
    heightValues,
    sampleHeight,
    heightPicture,
    pictureHeightScaleOf,
    contentThumbnail,
    imageBitmap,
    addImageListener,
    placeholderPicture,
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
    clipboardContent,
    pastedItems,
    clipboardPlace,
    pasteChoice,
    pointsBox,
    svgHeldBack,
    writeClipboardText,
    readClipboardItems,
    installClipboardHandlers,
    copyByCommand,
    writeClipboardItems,
    svgPngBlob,
    frameItem,
    framedImage,
    fillBox,
    fillMap,
    imageCovering,
    holderBox,
    pictureOrientation,
    orientedBy,
    placedPicture,
    holderFit,
    withNodes,
    itemBridges,
    mappedItem,
    normalShape,
    cornersSmoothed,
    wholeEllipse,
    pathFromPolyline,
    polylineFromPath,
    flattenNodes,
    euclideanItem,
    withoutGeodesic,
    geodesicShape,
    euclideanShape,
    worldGeometry,
    geodesicRayPoint,
    fitCurve,
    tileFromDomain,
    tileEdgeStarts,
    tileReplacedEdge,
    wordMap,
    curvedTile,
    polylineTile,
    releasedTile,
    hitsPolyline,
    UndoStack,
    SnapIndex,
    imageListNames,
    imageListEntry,
    transformBoxGeometry as sharedTransformBoxGeometry,
    // the geometry of the group and its motions (GroupGeometry.js, GeometryMotions.js)
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
//    the 2D overlay through a copy's frame;
//  - the clipboard (Clipboard.js, docs/clipboard_plan.md): the selection as
//    seen copied to the system clipboard, pasted at the pointer or in place;
//  - the geometry of the group: the moves of the select tool are its motions,
//    and the sides of geodesic paths (Paths.js) its straight lines, which the
//    document draws (its outliner, DrawingGeometry.js); here the setting that
//    makes new polylines such paths, the conversions of the selection, and
//    the line being drawn as it will be.
//
//  par: document, getContext() -> {group (pattern coordinates), ptc,
//       sprites, visLayers (the last frame's visualization layers),
//       getSprites() (the sprites the colour layers show)},
//       view ({toWorld, toCanvas, isLinear, pixelSize, scaleAt,
//       cssPixelScale (CSS pixels to a canvas pixel)}), repaint,
//       propertiesChanged() (the style or shape settings show other values,
//       or the undo stack changed), activateTool(name) (takes up a tool of
//       the pattern), choosePicture(title, onFile) (the image dialog, each
//       file chosen to onFile: the Image tool's picture), chooseImage() (lets the user pick the file that
//       replaces the selected image: replaceSelectedImage), chooseFill(kind)
//       ('image' or 'svg': lets the user pick the file that fills the
//       selected shapes: fillWithImage, fillWithSvg), chooseImport(kind)
//       ('image' or 'svg': lets the user pick the file importImageBlob or
//       importSvgText adds), editPicture(holderId) (the image editor window on
//       that holder's picture: setPictureHeight per stroke)
//

const PICK_PX = 6;          // pick tolerance, canvas pixels
const THUMB_PX = 256;       // the picture thumbnails of the property bar, drawn at 128 px
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
const STROKE_KEYS = ['stroked', 'stroke', 'strokeOpacity', 'width', 'cap', 'join'];
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

/** a word of generators with every letter next to its inverse (the other case: a
 *  and A, B and b) taken out, again until none is left: the same group element */
function freelyReduced(word){
    const out = [];
    for (const ch of word) {
        const last = out[out.length - 1];
        if (last && last !== ch && last.toLowerCase() === ch.toLowerCase() && /[a-z]/i.test(ch)) out.pop();
        else out.push(ch);
    }
    return out.join('');
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
    // the vertices of selected items picked for editing (the node tool): [{id, vertex}],
    // each once, the one picked last at the end (getSelectedVertex)
    let mPicked = [];

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
    // the tools keeping points of the seen world: told of its changes (toolWorldChanged)
    const mToolWorldListeners = [];
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
        // the stroke on or off (docs/clipboard_plan.md 3.8): off acts on
        // closed shapes; an open line keeps a stroke, else it is not seen
        stroked:       true,
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
        // the polyline tool's lines as geodesic paths (Paths.js): their sides
        // the straight lines of the group's geometry, in a group that has one
        // other than the plane (drawsGeodesics)
        geodesic:      true,
        // the Tile tool's new tiles curved (Tiles.js): paths whose sides take
        // handles, their pairs following (in a Kleinian group cubics fitted to
        // the images, since 2026-11-19); on by default since
        // 2026-11-18 (docs/tile_tool_ui_plan.md D3), a drawing saved with it
        // off keeps it off
        curvedTiles:   true,
    };

    /** the style of the settings; forceStroke: with the stroke even while it is off (an open line's) */
    function styleFromConfig(forceStroke = false){
        const c = mStyleCfg;
        return {
            stroke:      (c.stroked || forceStroke) ? { rgba: [...hexToRgb(c.stroke), c.strokeOpacity] } : null,
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
        c.stroked = !!style.stroke;
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
        if (key === 'snap' || key === 'fitCurves' || key === 'geometry' || key === 'incremental' || key === 'keepInCell' || key === 'geodesic' || key === 'curvedTiles' || !mSelection.length) return;
        const style = styleFromConfig();
        const ids = mSelection.map(s => s.id);
        const before = new Map(ids.map(id => [id, mDoc.getItem(id)]).filter(e => e[1]));
        const after = new Map();
        before.forEach((item, id) => {
            const merged = { ...item.style, ...style, opacity: item.style.opacity, ...keptPaint(item, key) };
            if (!style.fillRule) delete merged.fillRule;
            // an open line keeps a stroke with the stroke off: without one it is not seen
            if (!merged.stroke && !item.closed && item.type !== 'group' && item.type !== 'image') merged.stroke = item.style.stroke || styleFromConfig(true).stroke;
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
    // drag sets it; an ellipse is drawn from its centre (fromCentre, else
    // from corner to corner of its box) with the arc of start, end
    // (radians; equal: whole) and arc (Shapes.js)
    const mShapeTools = {
        rect:    { round: 0 },
        ellipse: { fromCentre: true, start: 0, end: 0, arc: 'slice' },
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
     * or sharp; an ellipse's start, end (radians), arc; whole: its arc
     * dropped; circle: rx = ry, their geometric mean): the shape takes it
     * and keeps its kind; one undo step per number dragged, and per switch
     */
    function setShapeValue(key, value){
        const item = selectedShape();
        if (!item) return;
        const s = item.shape;
        const f = value/Math.sqrt(s.rx*s.ry);
        let shape;
        if (key === 'smoothO' || key === 'smoothI') {
            shape = cornersSmoothed(s, key === 'smoothO' ? 'o' : 'i', value);
        } else if (key === 'whole' || key === 'circle') {
            if (s.kind !== 'ellipse') return;
            const r = Math.sqrt(s.rx*s.ry);
            shape = key === 'whole' ? wholeEllipse(s) : normalShape({ ...s, rx: r, ry: r });
        } else if (key === 'start' || key === 'end') {
            // one end typed: the other as it is (0 on a whole ellipse)
            shape = normalShape({ ...s, start: s.start ?? 0, end: s.end ?? 0, [key]: value });
        } else {
            const changed = key === 'w' ? { rx: 0.5*value } : key === 'h' ? { ry: 0.5*value } :
                            key === 'radius' ? { rx: f*s.rx, ry: f*s.ry } : { [key]: value };
            shape = normalShape({ ...s, ...changed, kind: s.kind });
        }
        const before = new Map([[item.id, item]]);
        const after = new Map([[item.id, { ...item, shape }]]);
        applyReplace(after);
        pushReplace('shape', before, after, typeof value === 'number' ? 'shape:' + key : null);
        mPicked = [];
        mRepaint();
    }

    /** a number a shape tool draws with; the ellipse's whole: its start and end 0; circle: nothing (a selected ellipse's command) */
    function setShapeToolValue(kind, key, value){
        if (key === 'whole') { mShapeTools[kind].start = 0; mShapeTools[kind].end = 0; }
        else if (key !== 'circle') mShapeTools[kind][key] = value;
        mPropertiesChanged();
    }

    /** the selected shapes of a kind (of every kind without one) */
    function selectedShapes(kind = null){
        return mSelection.map(s => mDoc.getItem(s.id)).filter(it => it && it.shape && (!kind || it.shape.kind === kind));
    }

    /**
     * the item as a plain outline: a shape's numbers dropped, its outline
     * kept; a geodesic shape of geodesic sides stays a geodesic path, one
     * drawn by fitted arcs (an ellipse, a rounded rect) the plain path of its
     * outline, which draws the same
     */
    function plainItem(item){
        if (!item.shape) return item;
        const out = { ...((item.geodesic && item.nodes && item.nodes.some(m => m.plain)) ? euclideanItem(item) : item) };
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
        mPicked = [];
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

    /**
     * the geometry of the group in world coordinates whatever the geometry
     * setting says (DrawingGeometry.js): {kind: 'euclidean' | 'hyperbolic' |
     * 'spherical', ...}; `fallback: 'kleinian'` on a group of no absolute. The
     * one the geodesic paths are drawn in
     */
    function drawingGeometry(){
        const m = maps();
        if (!mGeometry) mGeometry = worldGeometry(m.ctx.group, m.ctx.ptc);
        return mGeometry;
    }

    /** the geometry of the moves: the group's (drawingGeometry; on a group of no absolute localGeometry gives it point by point); the plane while the geometry setting is off */
    function geometry(){
        return mStyleCfg.geometry ? drawingGeometry() : PLANE;
    }

    /** has the geometry lines of its own to draw by: the hyperbolic plane, the sphere, or a Kleinian group's local disks */
    function hasGeodesics(){
        const g = drawingGeometry();
        return g.kind !== 'euclidean' || g.fallback === 'kleinian';
    }

    /** are new polylines geodesic paths: the geodesic setting, in a group whose geometry is not the plane's */
    function drawsGeodesics(){
        return !!mStyleCfg.geodesic && hasGeodesics();
    }

    /** the geometry the lines through the point A are drawn in: the group's, or a Kleinian group's disk at A (the outliner's), the plane without one */
    function pointGeometry(A){
        const g = drawingGeometry();
        if (g.fallback !== 'kleinian') return g;
        const outliner = mDoc.getOutliner();
        return (outliner && outliner.disk && outliner.disk(A)) || g;
    }

    /**
     * world points [[x, y], ...] of the polyline through the points as a
     * geodesic path is drawn (the document's outliner): its sides the straight
     * lines of the group's geometry; the points themselves without an outliner
     */
    function geodesicPolyline(points){
        if (points.length < 2) return points;
        return geodesicPath(points.map(p => ({ p, h1: null, h2: null })), false) || points;
    }

    /**
     * world points [[x, y], ...] of the path through the nodes as a geodesic
     * path is drawn (the document's outliner), its outline flattened: for a
     * path being made (the pen tool); null without an outliner
     */
    function geodesicPath(nodes, closed = false){
        const outliner = mDoc.getOutliner();
        if (!outliner || nodes.length < 2) return null;
        const flat = flattenNodes(outliner.outline(nodes, closed).nodes, closed);
        const out = [];
        for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]]);
        return out;
    }

    /**
     * the chart of a point for the edits of a node and its handles (Paths.js:
     * nodeMoved, handleMoved and the others take it): the group's geometry's
     * for a geodesic path, where the handles of a smooth node lie on one
     * geodesic through it; null for any other item, and in the plane
     */
    function nodeChart(item){
        const outliner = (item && item.geodesic) ? mDoc.getOutliner() : null;
        return (outliner && outliner.chart) || null;
    }

    /** the outliner of a geodesic item (the document's: its chart, its outlines), null for another */
    function nodeOutliner(item){
        return (item && item.geodesic && mDoc.getOutliner()) || null;
    }

    /** the same for a geodesic path being made (the pen tool): null while new lines are plain */
    function drawingChart(){
        const outliner = drawsGeodesics() ? mDoc.getOutliner() : null;
        return (outliner && outliner.chart) || null;
    }

    /** what splits a curved side of the item at a parameter (Paths.splitItemSegment takes it): the geometry's for a geodesic path, else null */
    function curveSplitter(item){
        const outliner = (item && item.geodesic) ? mDoc.getOutliner() : null;
        return (outliner && outliner.split) || null;
    }

    /**
     * where the geodesic shapes are built (DrawingGeometry.shapeSpace, the
     * document's outliner's): of the geometry in force; null in the plane. The
     * shape functions of Shapes.js, ShapeHandles.js and mappedItem take it
     */
    function shapeSpace(){
        const outliner = mDoc.getOutliner();
        return (outliner && outliner.space) || null;
    }

    /** the space of the item's shape: shapeSpace for a geodesic shape, null for a Euclidean one */
    function shapeSpaceOf(item){
        return (item && item.geodesic && item.shape) ? shapeSpace() : null;
    }

    /** the space of the shapes being drawn: shapeSpace while new lines are geodesic (drawsGeodesics), else null */
    function drawingShapeSpace(){
        return drawsGeodesics() ? shapeSpace() : null;
    }

    /**
     * the point of the geodesic from A that leaves it towards the point
     * `towards` and is as far from A, in the group's geometry, as w is: where
     * a side constrained to a direction ends (the polyline tool's Shift)
     */
    function geodesicRay(A, towards, w){
        return geodesicRayPoint(pointGeometry(A), A, [towards[0] - A[0], towards[1] - A[1]], w);
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

    /**
     * world units per canvas pixel at the canvas point: the view's local scale
     * there (under a projection of the view it differs from place to place);
     * without the point, or where the view has no scale, at the view's centre
     */
    function pixelSizeAt(canvas = null){
        const s = (canvas && mView.scaleAt && Number.isFinite(canvas[0]) && Number.isFinite(canvas[1])) ? mView.scaleAt(canvas) : NaN;
        return (Number.isFinite(s) && s > 0) ? s : mView.pixelSize();
    }

    /** pattern units per canvas pixel at the canvas point (pixelSizeAt) */
    function patternPerPixel(canvas = null){
        return pixelSizeAt(canvas)*worldToPatternMap(context().ptc).scale;
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
     * such a layer: the first copy found of the topmost item hit.
     * canvas: the pointer's canvas point, which gives the pixels of the
     * tolerance their size there (the view's local scale); without it the
     * size at the view's centre. accept(item): the items that may be picked
     * (the Tile tool's: tiles), the others letting the click through; null:
     * all
     */
    /** pick/handle hit radius in canvas pixels: widened to ~20 CSS px on touch pointers */
    function hitTolerance(basePx, e = null){
        if (e && e.pointerType === 'touch') {
            return Math.max(basePx, Math.round(20 / cssPixelScale()));
        }
        return basePx;
    }

    /** click-vs-drag move threshold in canvas pixels: widened to ~6 CSS px on touch to absorb finger jitter */
    function dragTolerance(basePx, e = null){
        if (e && e.pointerType === 'touch') {
            return Math.max(basePx, Math.round(6 / cssPixelScale()));
        }
        return basePx;
    }

    function hitTest(w, canvas = null, tolPx = PICK_PX, accept = null){
        const m = maps();
        const views = shownViews(m.ctx);
        const perPixel = patternPerPixel(canvas);
        return views.length ? hitSeen(w, tolPx, m, views, perPixel, accept) : hitTopmost(w, tolPx, m, perPixel, accept);
    }

    /** the enabled layers that tell which copies they draw (Color Images), topmost first */
    function shownViews(ctx){
        const views = [];
        for (const vl of ctx.visLayers || []) {
            if (!vl || !vl.enabled || !vl.describeCopies) continue;
            const view = vl.describeCopies();
            if (view && view.opacity > 0) views.push(view);
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

    /** hitTest without the layers' word: the first copy found of the topmost item hit (of those accept takes) */
    function hitTopmost(w, tolPx, m, perPixel, accept = null){
        const group = m.ctx.group;
        const s = m.toPattern.map(w[0], w[1]);
        const f = foldPoint(group, s);
        const tolS = tolPx*perPixel;
        const imageTolS = (tolPx > PICK_PX ? Math.min(tolPx, 10) : Math.min(tolPx, IMAGE_PICK_PX))*perPixel;
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
        const testAny = (item, holders) => ((accept && !accept(item)) ? null : item.type === 'group' ? testGroup(item, holders) : test(item, holders));
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
     * in front; null when none does. accept(item): the picks taken, the
     * pieces of the others left out (seen through)
     */
    function hitSeen(w, tolPx, m, views, perPixel, accept = null){
        const group = m.ctx.group;
        const s = m.toPattern.map(w[0], w[1]);
        const f = foldPoint(group, s);
        // the sides the fold crossed give the copies' colours; unread: every colour shown
        const sides = foldSides(group, f.word);
        const tolS = tolPx*perPixel;
        const imageTolS = (tolPx > PICK_PX ? Math.min(tolPx, 10) : Math.min(tolPx, IMAGE_PICK_PX))*perPixel;
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
        // the height of the sprite's picture at the world point p, times its scale (the shader's
        // height array); 0 without one, or while its heights decode
        const heightAt = (sp, holder, p) => {
            if (!(sp.heightScale > 0)) return 0;
            const hp = heightPicture(holder);
            const at = hp ? quadUV(p, hp.image.points) : null;
            return at ? sp.heightScale*sampleHeight(heightValues(hp.image.height), at.u, at.v) : 0;
        };

        // the sprite path: each sprite through the tiles nearest its box, in sprite order
        function frontSprite(view, pieces){
            const data = m.ctx.getSprites ? m.ctx.getSprites() : null;
            if (!data) return null;
            const names = imageListNames(view.entries);
            const listed = (view.entries.length ? data.sprites.filter(sp => (sp.names || [sp.layerId]).some(n => names.includes(n))) : data.sprites).slice(-view.maxSprites);
            const index = new Map(listed.map((sp, i) => [sp.id, i]));
            const angle = -(m.ctx.ptc.angle || 0);
            // as the shader (colorImageSprites): sorted by depth while depth sort is on or
            // a sprite has a depth or heights; else the sprites in order, of a sprite's
            // copies the one whose centre (its box's) is nearest the point in front
            const sorted = !!view.tilt || listed.some(sp => (sp.depth || 0) !== 0 || sp.heightScale > 0);
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
                    // the shader's depth is the world point's, plus the sprite's own, plus its picture's height there
                    const p = m.fromPattern.map(hit.q[0], hit.q[1]);
                    const order = sorted ? [depth(view, p) + (sp.depth || 0) + heightAt(sp, piece.holder, p), i, k]
                                         : [i, -((p[0] - sp.box.cx)**2 + (p[1] - sp.box.cy)**2)];
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

        // a layer with the symmetry off (view.unfolded): the items it names
        // (none: every one) where they are, the last drawn in front
        function frontUnfolded(view, pieces){
            const named = view.entries.length ? imageListNames(view.entries) : null;
            let best = null;
            pieces.forEach(piece => {
                if (!piece.editable || (named && !piece.names.some(n => named.includes(n)))) return;
                const item = piece.item;
                if (!piece.pts) piece.pts = patternPoints(item, m.toPattern);
                if (!piece.clipPts) piece.clipPts = piece.clips.map(c => patternPoints(c, m.toPattern));
                if (piece.clips.some((c, i) => !hitsPolyline(s, piece.clipPts[i], true, true, 0, c.style.fillRule))) return;
                if (hitsItem(item, s, piece.pts, tolS, imageTolS, m)) best = { piece, frame: null };
            });
            return best;
        }

        // the children of the items being edited inside come first, the innermost's first
        for (const inside of [...mContainers.map(c => c.id).reverse(), null]) {
            const pieces = drawnPieces(inside).filter(piece => !accept || accept(piece.pick));
            for (const view of views) {
                const best = view.unfolded ? frontUnfolded(view, pieces) : view.sprites ? frontSprite(view, pieces) : frontBuffer(view, pieces);
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
        mPicked = [];
        mRepaint();
    }

    /** a step out of the innermost item being edited inside */
    function leaveContainer(){
        if (!mContainers.length) return;
        mContainers = mContainers.slice(0, -1);
        mSelection = [];
        mPicked = [];
        mRepaint();
    }

    /** is the world point w inside the item being edited inside (c: {id, frame}): within a closed item's outline, a group's box, on that copy */
    function containerHolds(c, w){
        const item = mDoc.getItem(c.id);
        if (!item) return false;
        const x = mapWorld(c.frame, w);
        if (item.type !== 'group') return hitsPolyline(x, item.points, true, true, 0, item.style.fillRule, itemBridges(item));
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        const walk = (it) => {
            if (it.type === 'group') { (it.children || []).forEach(walk); return; }
            const p = it.points || [];
            for (let i = 0; i + 1 < p.length; i += 2) {
                x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
            }
        };
        walk(item);
        return x[0] >= x0 && x[0] <= x1 && x[1] >= y0 && x[1] <= y1;
    }

    /**
     * a press at the world point w outside the items being edited inside
     * leaves them (from the outermost the point is outside of), the selection
     * dropped: the press then picks what is there. True when it left one
     */
    function leaveContainersOutside(w){
        const k = mContainers.findIndex(c => !containerHolds(c, w));
        if (k < 0) return false;
        mContainers = mContainers.slice(0, k);
        mSelection = [];
        mPicked = [];
        mRepaint();
        return true;
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
     * token of the drag), not for every move of the dragged item.
     * canvas: the pointer's canvas point, which gives the pixels of the snap
     * radius their size there (the view's local scale); without it the size
     * at the view's centre. The index is built for the radius rounded up to
     * a power of two, so that a radius changing with the pointer (under a
     * projection of the view) rebuilds it once an octave, not at every move
     */
    function snap(w, exclude = null, canvas = null, e = null){
        if (!mStyleCfg.snap) return null;
        const m = maps();
        const radius = hitTolerance(SNAP_PX, e)*patternPerPixel(canvas);
        const built = Math.pow(2, Math.ceil(Math.log2(radius)));
        const version = (exclude && exclude.drag) ? 'drag ' + exclude.drag : mCacheKey;
        const key = [version, built, exclude ? exclude.itemId + ':' + (exclude.vertices || [exclude.vertex]).join(',') : ''].join('|');
        if (key !== mSnapKey) {
            mSnapKey = key;
            mSnap.build({ items: mDoc.getEditableItems(), group: m.ctx.group, ptc: m.ctx.ptc, radius: built, exclude });
        }
        const s = m.toPattern.map(w[0], w[1]);
        const hit = mSnap.query(s, radius);
        if (!hit) return null;
        return { ...hit, wpnt: m.fromPattern.map(hit.pnt[0], hit.pnt[1]) };
    }

    // the canvas pixels between the points a rubber band is folded at to find the tiles it covers, and most points along a side
    const BAND_TILE_PX = 16;
    const BAND_TILE_SAMPLES = 64;
    // a point in general position: its image tells group elements apart
    const TILE_KEY_POINT = [0.1234567, 0.0765432];

    /**
     * the items with a copy wholly inside the canvas rectangle from c0 to c1
     * (the node tool's rubber band with no outline selected, Inkscape's):
     * [{id, frame, frameInv}], one copy each, in the order of the layers.
     * The band is folded at points BAND_TILE_PX apart, which gives the tiles
     * it covers (smaller tiles may be missed); the copy of an item tried in a
     * tile is the one whose first point lies there: frameInv = T^-1 . F . h
     * (h the item's fold element, F folding its first point into the domain,
     * T^-1 taking the domain onto the tile). Inside an item being edited: its
     * children on the copy it was entered on. accept(item): the items taken
     * (null: all)
     */
    function itemsInBand(c0, c1, accept = null){
        const m = maps();
        const x0 = Math.min(c0[0], c1[0]), x1 = Math.max(c0[0], c1[0]);
        const y0 = Math.min(c0[1], c1[1]), y1 = Math.max(c0[1], c1[1]);
        const pointsOf = (item) => (item.type === 'group' ? (item.children || []).flatMap(pointsOf) : (item.points || []));
        // every point of the item on the copy frameInv inside the band
        const inside = (item, frameInv) => {
            const pts = pointsOf(item);
            if (pts.length < 2) return false;
            for (let i = 0; i + 1 < pts.length; i += 2) {
                const c = mView.toCanvas(mapWorld(frameInv, [pts[i], pts[i + 1]], m));
                if (!(c[0] >= x0 && c[0] <= x1 && c[1] >= y0 && c[1] <= y1)) return false;
            }
            return true;
        };
        const c = container();
        if (c) {
            const holder = mDoc.getItem(c.id);
            return ((holder && holder.children) || []).filter(it => it.visible !== false && (!accept || accept(it)) && inside(it, c.frameInv))
                .map(it => ({ id: it.id, frame: c.frame, frameInv: c.frameInv }));
        }
        const group = m.ctx.group;
        // the tiles under the band: T^-1 of each, told apart by the image of a point in general position
        const tiles = new Map();
        const nx = Math.min(BAND_TILE_SAMPLES, Math.ceil((x1 - x0)/BAND_TILE_PX)), ny = Math.min(BAND_TILE_SAMPLES, Math.ceil((y1 - y0)/BAND_TILE_PX));
        for (let i = 0; i <= nx; i++) {
            for (let j = 0; j <= ny; j++) {
                const w = mView.toWorld([x0 + (x1 - x0)*i/Math.max(nx, 1), y0 + (y1 - y0)*j/Math.max(ny, 1)]).pnt;
                if (!w || !Number.isFinite(w[0]) || !Number.isFinite(w[1])) continue;
                const t = foldPoint(group, m.toPattern.map(w[0], w[1])).transform;
                const key = t ? applyTransform(t, TILE_KEY_POINT).map(v => v.toFixed(9)).join(' ') : '';
                if (!tiles.has(key)) tiles.set(key, t ? t.getInverse() : null);
            }
        }
        const out = [];
        for (const item of mDoc.getEditableItems()) {
            const pts = pointsOf(item);
            if (pts.length < 2 || (accept && !accept(item))) continue;
            const { h } = foldElementOf(item);
            const F = foldPoint(group, applyTransform(h, m.toPattern.map(pts[0], pts[1]))).transform;
            for (const Tinv of tiles.values()) {
                const frameInv = composeTransforms(h, F, Tinv);
                if (!inside(item, frameInv)) continue;
                out.push({ id: item.id, frame: frameInv ? frameInv.getInverse() : null, frameInv });
                break;
            }
        }
        return out;
    }

    // ── selection ────────────────────────────────────────────────────────────

    function setSelection(list){
        mSelection = list.filter(s => mDoc.getItem(s.id));
        mPicked = [];
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
        if (!mSelection.length && !mPicked.length) return;
        mSelection = [];
        mPicked = [];
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
            mPicked = [];
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
            mPicked = mPicked.map(v => (v.id === from ? { ...v, id: into } : v));
            if (onRenamed) onRenamed(from, into);
        };
        follow(id, to);
        mUndo.push({ label: 'rename',
            undo: () => { if (mDoc.renameItem(to, id)) follow(to, id); },
            redo: () => { if (mDoc.renameItem(id, to)) follow(id, to); } });
        return true;
    }

    /**
     * the world the tools see changed (the navigator's tools' world: an anchor step, home
     * left or reached, a gesture's end): H, the change in pattern coordinates (a point p
     * of the old world is H(p) in the new one, the same point of the view). The
     * selection's copies and the entered frames are carried by it, so the same copies
     * stay selected; the tools carry what they keep in the seen world (onToolWorldChange:
     * map(w) of the seen world, called before the frames change)
     */
    function toolWorldChanged(H){
        if (!H) return;
        const m = maps();
        const map = w => {
            const q = applyTransform(H, m.toPattern.map(w[0], w[1]));
            return m.fromPattern.map(q[0], q[1]);
        };
        mToolWorldListeners.forEach(cb => cb(map));
        const Hinv = H.getInverse();
        const carry = s => ({ ...s, frame: composeTransforms(Hinv, s.frame), frameInv: composeTransforms(s.frameInv, H) });
        mSelection = mSelection.map(carry);
        mContainers = mContainers.map(carry);
        // the bar's numbers (the box's place and size) are the new world's
        if (mSelection.length) mPropertiesChanged();
        mRepaint();
    }

    /** the vertex picked for editing (the node tool): {id, vertex}, or null for none; the others dropped */
    function setSelectedVertex(v){
        setSelectedVertices(v ? [v] : []);
    }

    /**
     * the vertices picked for editing (the node tool): [{id, vertex}], the
     * one picked last at the end (a vertex listed twice keeps its last place)
     */
    function setSelectedVertices(list){
        const seen = new Set(), out = [];
        for (const v of (list || []).slice().reverse()) {
            const key = v && `${v.id}#${v.vertex}`;
            if (!v || seen.has(key)) continue;
            seen.add(key);
            out.push({ id: v.id, vertex: v.vertex });
        }
        out.reverse();
        const changed = out.length !== mPicked.length || out.some((v, k) => v.id !== mPicked[k].id || v.vertex !== mPicked[k].vertex);
        mPicked = out;
        if (changed) mPropertiesChanged();
        mRepaint();
    }

    /** is vertex `vertex` of the item picked */
    function isVertexPicked(id, vertex){
        return mPicked.some(v => v.id === id && v.vertex === vertex);
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
        return { ...mappedItem(item, w => mapWorld(frame, w, m), shapeSpace()), style };
    }

    /** how far a fitted curve may leave the points: FIT_PX canvas pixels, in world units (the pixels' size at the canvas point, pixelSizeAt) */
    function fitTolerance(canvas = null){
        return FIT_PX*pixelSizeAt(canvas);
    }

    /**
     * the item (a polyline) as a path of curves fitted to its points; the item
     * itself when they are too few. corners: its sharp turns stay sharp nodes
     * (CurveFit.js), else it is taken for a sampled curve, smooth throughout
     */
    function fittedItem(item, tolerance = fitTolerance(), corners = false){
        const pts = [];
        for (let i = 0; i + 1 < item.points.length; i += 2) pts.push([item.points[i], item.points[i + 1]]);
        const nodes = fitCurve(pts, !!item.closed, tolerance, corners);
        return nodes.length >= 2 ? withNodes(item, nodes) : item;
    }

    /**
     * the selected polylines as paths of curves fitted to their vertices (a
     * shape's polyline too, its numbers then dropped), their sharp corners
     * kept; one undo step
     */
    function fitCurvesSelection(){
        const before = new Map(), after = new Map();
        for (const sel of mSelection) {
            const item = mDoc.getItem(sel.id);
            if (!item || item.type !== 'polyline' || item.tile || item.points.length < 6) continue;
            const plain = plainItem(item);
            const fitted = fittedItem(plain, fitTolerance(), true);
            if (fitted === plain) continue;
            before.set(item.id, item);
            after.set(item.id, fitted);
        }
        if (!after.size) return;
        applyReplace(after);
        pushReplace('fit curves', before, after);
        mPicked = [];
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
        mPicked = [];
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
        return scaleStrokes ? carriedItem(item, f) : mappedItem(item, f, shapeSpace());
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
        mPicked = [];
        mRepaint();
    }

    /** is the map orientation reversing at the point p (pattern coordinates), by its
     *  derivative over a step h */
    function reversesAt(t, p, h){
        const a = applyTransform(t, p), x = applyTransform(t, [p[0] + h, p[1]]), y = applyTransform(t, [p[0], p[1] + h]);
        return (x[0] - a[0])*(y[1] - a[1]) - (x[1] - a[1])*(y[0] - a[0]) < 0;
    }

    /**
     * the symmetry that brings an item home (pattern coordinates): the fold k of the
     * centre c of its box into the fundamental domain (foldHome); when k turns the
     * item over, it is followed by the orientation-reversing side pairing that moves
     * the folded centre the least, so the item lands unmirrored in the domain or in
     * the cell next to it. {k, kind}: kind 'moved' (k a symmetry other than the
     * identity), 'home' (k null: it is home) or 'failed' (the fold did not reach the
     * domain: a group that is not discrete, or a point too far out)
     */
    function homeSymmetry(item, m){
        const group = m.ctx.group;
        if (!group || !item.points || item.points.length < 2) return { k: null, kind: 'home' };
        const pts = patternPoints(item, m.toPattern);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i + 1 < pts.length; i += 2) {
            x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]);
            y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]);
        }
        const c = [0.5*(x0 + x1), 0.5*(y0 + y1)];
        const f = foldHome(group, c);
        if (!f.inDomain) return { k: null, kind: 'failed' };
        let k = f.transform;
        if (!k || !k.getLength()) return { k: null, kind: 'home' };
        // the derivative's step: small against the item's size where it is and where it lands
        const size = Math.max(x1 - x0, y1 - y0, 1e-9);
        if (reversesAt(k, c, 1e-3*size)) {
            const q = f.pnt;
            const step = 1e-3*size*localScale(k, c);
            let best = null, bestD = Infinity;
            for (const r of group.getReverseITransforms() || []) {
                const t = r.getInverse();
                if (!reversesAt(t, q, step)) continue;
                const tq = applyTransform(t, q);
                const d = Math.hypot(tq[0] - q[0], tq[1] - q[1]);
                if (d < bestD) { bestD = d; best = t; }
            }
            if (best) {
                k = composeTransforms(k, best);
                k.doFactorization();
            }
        }
        return { k, kind: 'moved' };
    }

    /** can the selection be brought home (normalizeSelection): an item that can move, outside any group or shape being edited inside */
    function canNormalizeSelection(){
        return !mContainers.length && mSelection.some(sel => { const it = mDoc.getItem(sel.id); return it && !it.tile; });
    }

    /**
     * the selected items brought home, each on its own (a group as one piece):
     * moved by the symmetry that takes the centre of its box into the fundamental
     * domain (homeSymmetry; never mirrored), carried as Group carries a member
     * (carriedItem: the strokes scaled by the map) and coloured as it was
     * (withColorWord: the word of the way back before its own), so each of its
     * copies is where it was, in the colour it had, in every colour layer: the
     * picture stays. The same copies stay selected (their frames take the move),
     * so nothing moves on screen. Off while editing inside a group or a shape
     * (a member would leave it). One undo step.
     * returns {moved, home, failed}: how many items moved, were home already, or
     * could not be folded home (they stay)
     */
    function normalizeSelection(){
        const counts = { moved: 0, home: 0, failed: 0 };
        if (!canNormalizeSelection()) return counts;
        const m = maps();
        const group = m.ctx.group;
        const before = new Map(), after = new Map(), moves = new Map();
        for (const sel of mSelection) {
            const item = mDoc.getItem(sel.id);
            if (!item || item.tile) continue;
            const { k, kind } = homeSymmetry(item, m);
            counts[kind]++;
            if (kind !== 'moved') continue;
            const carried = carriedItem(item, w => mapWorld(k, w, m));
            const back = dirichletSourceWord(group, k.getInverse().getWord() || '');
            before.set(sel.id, item);
            after.set(sel.id, withColorWord(carried, back));
            moves.set(sel.id, k);
        }
        if (!after.size) return counts;
        applyReplace(after);
        pushReplace('normalize', before, after);
        // the copy seen stays selected: its own place moved by k
        mSelection = mSelection.map(sel => {
            const k = moves.get(sel.id);
            if (!k) return sel;
            return { ...sel, frame: composeTransforms(sel.frame, k), frameInv: composeTransforms(k.getInverse(), sel.frameInv) };
        });
        mPicked = [];
        mRepaint();
        return counts;
    }

    /** the selection transformed by a map of the seen world; one undo step
     *  (mergeKey: merged with the step before of the same key, a field's typing) */
    function transformSelection(map, label, scaleStrokes = false, mergeKey = null){
        const ids = mSelection.map(s => s.id);
        const before = new Map(ids.map(id => [id, mDoc.getItem(id)]).filter(e => e[1]));
        const after = transformedSelection(before, map, scaleStrokes);
        if (!after.size) return;
        applyReplace(after);
        pushReplace(label, before, after, mergeKey);
        mPicked = [];
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
    //
    //  A copy puts the selection as it is seen on the system clipboard, as the
    //  text of an SVG that holds the record of the items (Clipboard.js): Ctrl+C
    //  and Ctrl+X through the browser's copy and cut events, the menus through
    //  copyByCommand. Where the browser lets it, the async clipboard then holds
    //  the same text, the SVG as image/svg+xml and a PNG of it (richCopy), for
    //  programs that read no text. The last copy is also kept here, for a paste
    //  the browser does not let read the clipboard. A paste (Ctrl+V: the paste
    //  event; the menus and Ctrl+Alt+V: readClipboardItems) takes a record,
    //  else an SVG or a picture as an import (Clipboard.pasteChoice); at the
    //  pointer, or in place (docs/clipboard_plan.md section 3).
    //

    // the record of the page's last copy (Clipboard.js), or null
    let mClipboard = null;
    // the PNG of a copy: twice the selection's size on the screen (device pixels), at most this a side
    const CLIPBOARD_PNG_SIDE = 4096;
    // above this a copy's text (its pictures) is said to be large
    const CLIPBOARD_LARGE = 50e6;
    // the last pointer point over the canvas (the tools' world), null once it left: where a paste goes
    let mPointer = null;

    function selectedItems(){
        return mSelection.map(s => mDoc.getItem(s.id)).filter(Boolean);
    }

    /** where the page is and what it draws in, for the clipboard (Clipboard.clipboardPlace) */
    function clipboardHere(){
        const m = maps();
        const page = (typeof location !== 'undefined' && location.pathname) ? location.pathname.split('/').pop() : '';
        return clipboardPlace({ page, geometry: drawingGeometry(), group: m.ctx.group, ptc: m.ctx.ptc, groupTransform: m.ctx.groupTransform || null });
    }

    /** the order of an item in the drawing: its layer's index, then its path */
    function drawingOrder(id){
        const at = mDoc.findItem(id);
        return at ? [mDoc.getLayers().indexOf(at.layer), ...at.path] : [Infinity];
    }

    /**
     * what a copy of the selection puts on the clipboard: {record, text}
     * (Clipboard.clipboardContent), each item as it is seen on the copy it was
     * picked on, with the colour word of the symmetry back (as a group of
     * copies is made), in the drawing's order; null without a selection
     */
    function selectionClipboard(){
        const entries = mSelection.map(sel => ({ sel, item: mDoc.getItem(sel.id), order: drawingOrder(sel.id) })).filter(e => e.item);
        if (!entries.length) return null;
        entries.sort((a, b) => {
            for (let k = 0; k < Math.max(a.order.length, b.order.length); k++) {
                const d = (a.order[k] ?? -1) - (b.order[k] ?? -1);
                if (d) return d;
            }
            return 0;
        });
        const own = { frame: null, frameInv: null };
        const items = entries.map(e => (e.sel.frame || e.sel.frameInv ? carriedOnto(e.item, e.sel, own) : e.item));
        const box = pointsBox(items);
        const centre = box ? [0.5*(box[0] + box[2]), 0.5*(box[1] + box[3])] : null;
        return clipboardContent(items, clipboardHere(), { unitPx: screenUnitPx(centre) });
    }

    // the screen's device pixels to a CSS pixel
    const devicePixels = () => (typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1);

    /** the page's CSS pixels to a canvas pixel: the view's, else one over the device's pixels to a CSS pixel */
    function cssPixelScale(){
        const s = mView.cssPixelScale ? mView.cssPixelScale() : NaN;
        return (Number.isFinite(s) && s > 0) ? s : 1/devicePixels();
    }

    /**
     * the CSS pixels a world unit takes on the screen where the point w is
     * seen (the canvas's pixels there, pixelSizeAt, in CSS pixels); at the
     * view's centre without w or where it is not seen: the size a copy's
     * SVG is written at
     */
    function screenUnitPx(w = null){
        let canvas = null;
        try {
            const c = w && mView.toCanvas ? mView.toCanvas(w) : null;
            if (c && Number.isFinite(c[0]) && Number.isFinite(c[1])) canvas = c;
        } catch (e) {
            // a point the view does not show: its centre's scale
        }
        const size = pixelSizeAt(canvas);
        return cssPixelScale()/(size > 0 ? size : 1e-3);
    }

    /**
     * a copy's content written once more through the async clipboard, with
     * the SVG as image/svg+xml and a PNG of it beside the text (uilib
     * writeClipboardItems), for programs that read no text; without the PNG
     * where it could not be drawn. true when written; false where the browser
     * refused it, the text then left as it was
     */
    async function richCopy(content){
        const text = content.text;
        // the SVG's units are the screen's CSS pixels: the PNG has twice the device's
        const png = () => svgPngBlob(text, { unitPx: 2*devicePixels(), maxSide: CLIPBOARD_PNG_SIDE });
        if (await writeClipboardItems({ 'text/plain': text, 'image/svg+xml': text, 'image/png': png })) return true;
        return writeClipboardItems({ 'text/plain': text, 'image/svg+xml': text });
    }

    /** a copy made: kept for a refused read, a large one said */
    function noteCopy(content){
        mClipboard = content.record;
        if (content.text.length > CLIPBOARD_LARGE) {
            showWarningBanner(`The copy is ${Math.round(content.text.length/1e6)} MB of text, its pictures: some programs may not take it`, 8000);
        }
    }

    /**
     * the copy event: the selection onto its DataTransfer as text, then the
     * richer copy (richCopy) where the browser lets it; true when taken (a
     * selection to copy)
     */
    function onCopyEvent(dataTransfer){
        const content = selectionClipboard();
        if (!content) return false;
        noteCopy(content);
        dataTransfer.setData('text/plain', content.text);
        // after the event: its text goes on the clipboard when it ends, the richer copy over it
        setTimeout(() => { richCopy(content); }, 0);
        return true;
    }

    /** the cut event: copied, then removed in one undo step */
    function onCutEvent(dataTransfer){
        if (!onCopyEvent(dataTransfer)) return false;
        removeItems(mSelection.map(s => s.id), 'cut');
        mRepaint();
        return true;
    }

    /** the selection as seen onto the system clipboard (a menu's Copy); how many items */
    function copySelection(){
        const content = selectionClipboard();
        if (!content) return 0;
        noteCopy(content);
        // the copy event fills the clipboard while the click lasts; else the async clipboard, the text alone the slowest way
        if (!copyByCommand()) richCopy(content).then(done => { if (!done) writeClipboardText(content.text); });
        return content.record.items.length;
    }

    /** copied, then removed in one undo step (a menu's Cut); how many items */
    function cutSelection(){
        const ids = mSelection.map(s => s.id);
        const n = copySelection();
        if (n) { removeItems(ids, 'cut'); mRepaint(); }
        return n;
    }

    /** the centre of the canvas in the tools' world (the pattern box's centre where the view cannot tell) */
    function viewCentre(){
        if (mView && mView.canvasSize && mView.toWorld) {
            const [w, h] = mView.canvasSize();
            const r = mView.toWorld([0.5*w, 0.5*h]);
            if (r && r.pnt && Number.isFinite(r.pnt[0]) && Number.isFinite(r.pnt[1])) return [r.pnt[0], r.pnt[1]];
        }
        const ptc = context().ptc;
        return [ptc.centerX, ptc.centerY];
    }

    /**
     * where a paste at the pointer goes: the given point (a right click's: the
     * pointer has gone to the menu, and the canvas may get it back where the
     * menu closed), else the pointer over the canvas, else the canvas centre
     */
    function pastePoint(at = null){
        return at || mPointer || viewCentre();
    }

    /**
     * the map that takes a paste from w0 to w1: the move of the geometry
     * (moveMap), a plain shift where a point is not in the geometry's model
     */
    function pasteMove(w0, w1){
        const inside = (w) => {
            const g = localGeometry(w);
            return g.kind !== 'hyperbolic' || !g.c || !(g.r > 0) || Math.hypot(w[0] - g.c[0], w[1] - g.c[1]) < g.r*(1 - 1e-9);
        };
        if (inside(w0) && inside(w1)) {
            try {
                const map = moveMap(w0, w1);
                const t = map([w0[0], w0[1]]);
                if (Number.isFinite(t[0]) && Number.isFinite(t[1])) return map;
            } catch (e) {
                // a move the geometry cannot make: the plain shift
            }
        }
        return w => [w[0] + w1[0] - w0[0], w[1] + w1[1] - w0[1]];
    }

    /**
     * a record's items added (Clipboard.pastedItems: in the same group by the
     * group, with their colour words; in another by the world, the geodesic
     * shapes of another geometry as drawn; no tiles; ids kept where free), in
     * place or moved from the record's centre to the pointer (at: where to go
     * instead) by a move of the geometry, into the item being edited inside,
     * else onto the layer an import goes on; one undo step, selected. Returns
     * the items added
     */
    function pasteRecord(record, inPlace = false, at = null){
        const { items, centre, asDrawn } = pastedItems(record, clipboardHere());
        if (!items.length) return [];
        let placed = items;
        if (!inPlace && centre) {
            const map = pasteMove(centre, pastePoint(at));
            placed = items.map(it => carriedItem(it, map));
        }
        if (container()) placed = placed.map(intoContainer);
        const note = asDrawn ? `${asDrawn === 1 ? 'A geodesic path or shape' : asDrawn + ' geodesic paths and shapes'} came in as drawn: the clipboard's geometry is another (To geodesic makes them geodesic here)` : '';
        return addImported(placed, inPlace ? 'paste in place' : 'paste', 'The paste', note);
    }

    /**
     * what a paste brought, {text, svg (image/svg+xml text), html, files,
     * types}, added (Clipboard.pasteChoice): a record (pasteRecord), else an
     * SVG or a picture imported; true when taken. Nothing to take is said on
     * a banner naming what the clipboard holds. note: said instead, after
     * "Pasted as a picture." or "Nothing pasted."
     */
    function pasteContent({ text = '', svg = '', html = '', files = [], types = null }, inPlace = false, at = null, note = ''){
        const choice = pasteChoice({ text, svg, html, files, types });
        if (choice.kind === 'record') { pasteRecord(choice.record, inPlace, at); return true; }
        // an import: its box at the pointer, unless in place
        const where = inPlace ? null : pastePoint(at);
        if (choice.kind === 'svg') {
            importSvgText(choice.text, undefined, where);
            return true;
        }
        if (choice.kind === 'svgFile') { choice.file.text().then(t => importSvgText(t, choice.file.name, where)); return true; }
        if (choice.kind === 'picture') {
            const only = choice.only ? 'The clipboard held a picture, no shapes: pasted as an image (for shapes from Inkscape, save an SVG and import it)' : '';
            importImageBlob(choice.file, choice.file.name, note ? 'Pasted as a picture. ' + note : only, where);
            return true;
        }
        if (!note && choice.from === 'figma') note = 'The clipboard holds Figma\'s own copy, which only Figma reads: in Figma use Copy/Paste as > Copy as SVG, then paste here';
        showWarningBanner(note ? 'Nothing pasted. ' + note : `Nothing to paste: no shapes, SVG or picture on the clipboard (it holds ${choice.what})`, 8000);
        return false;
    }

    /**
     * a paste read from the system clipboard (the menus, Ctrl+Alt+V), which
     * the browser may ask the user to allow; refused, the page's own last copy
     * is pasted, which a banner says. at: where a paste at the pointer goes
     * instead (a right click's point)
     */
    async function pasteFromClipboard(inPlace = false, at = null){
        const got = await readClipboardContent();
        if (got === null) {
            if (mClipboard) {
                pasteRecord(mClipboard, inPlace, at);
                showWarningBanner('The browser did not let the page read the clipboard: pasted what this page copied last (Ctrl+V pastes from the clipboard)', 8000);
            } else {
                showWarningBanner('The browser did not let the page read the clipboard: press Ctrl+V to paste', 8000);
            }
            return;
        }
        pasteContent(got, inPlace, at);
    }

    /**
     * a Ctrl+V whose event names an SVG it does not give (Chrome hands a paste
     * event the system clipboard's text and HTML only: Inkscape's SVG is
     * listed, its text empty), read again through the async clipboard, which
     * gives it; refused, what the event gave (a picture, or nothing), with a
     * banner saying how to let the page read
     */
    async function pasteReadingSvg(eventGot){
        const got = await readClipboardContent();
        if (got) { pasteContent(got); return; }
        pasteContent(eventGot, false, null,
            'The browser gives the page the clipboard\'s SVG only when the page may read the clipboard: allow that in the site\'s settings (the icon left of the address), or use Import SVG');
    }

    /**
     * what the system clipboard holds, read through the async clipboard,
     * {text, svg, html, files, types} (pasteContent's); null when the browser
     * does not let the page read it
     */
    async function readClipboardContent(){
        const items = await readClipboardItems();
        if (items === null) return null;
        const got = { text: '', svg: '', html: '', files: [], types: items.flatMap(it => it.types) };
        for (const it of items) {
            for (const type of it.types) {
                try {
                    if (type === 'text/plain' && !got.text) got.text = await (await it.get(type)).text();
                    else if (type === 'image/svg+xml' && !got.svg) got.svg = await (await it.get(type)).text();
                    else if (type === 'text/html' && !got.html) got.html = await (await it.get(type)).text();
                    else if (type.startsWith('image/')) {
                        const blob = await it.get(type);
                        got.files.push(typeof File === 'function' ? new File([blob], 'clipboard.' + type.split('/')[1].split('+')[0], { type }) : blob);
                    }
                } catch (e) {
                    // a type that would not come: the others
                }
            }
        }
        return got;
    }

    /** the selected items copied in place (their own places), selected; not on the clipboard */
    function duplicateSelection(){
        const items = selectedItems().map(it => { const c = itemCopy(it); delete c.id; delete c.tile; return c; });
        if (!items.length) return;
        const added = addItems(items, 'duplicate');
        setSelection(added.map(it => ({ id: it.id, frame: null, frameInv: null })));
    }

    /** the pointer is over the canvas at w (the tools' world): where a paste goes; null: it left */
    function notePointer(w){
        mPointer = (w && Number.isFinite(w[0]) && Number.isFinite(w[1])) ? [w[0], w[1]] : null;
    }

    /** the pointer's world point while it is over the canvas (notePointer), else null: where a new tile is asked for */
    function pointer(){
        return mPointer ? [mPointer[0], mPointer[1]] : null;
    }

    if (typeof window !== 'undefined' && window.addEventListener) {
        // the pointer over anything but a canvas: a paste goes to the canvas centre
        window.addEventListener('pointermove', e => { if (!e.target || e.target.tagName !== 'CANVAS') mPointer = null; }, { passive: true });
        // a press there without a move before it (a touch on a button) too
        window.addEventListener('pointerdown', e => { if (!e.target || e.target.tagName !== 'CANVAS') mPointer = null; }, { passive: true, capture: true });
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
        const out = mappedItem(item, map, shapeSpace());
        return Math.abs(scale - 1) < 1e-9 ? out : scaled(out);
    }

    // a point in general position in the domain of each group, for shortColorWord
    const mHomeBase = new WeakMap();
    function homeBasePoint(group){
        if (!mHomeBase.has(group)) {
            const f = foldHome(group, [0.01234, 0.00567]);
            mHomeBase.set(group, f.inDomain ? f.pnt : null);
        }
        return mHomeBase.get(group);
    }

    /**
     * a colour word as short as the group allows: freely reduced; then, when the group
     * drawn is the one the word is written in (no Dirichlet domain), the element the
     * word makes is applied to a point in general position in the domain and the image
     * folded back home: where the fold brings it back onto the point itself, the fold's
     * word inverted is the same element (so the same colours in every colouring), and
     * it is taken when shorter. Two ways to the same place make one long word that free
     * reduction leaves (a far shape carried there and brought home: 328 letters for an
     * element of a few)
     */
    function shortColorWord(word){
        const w = freelyReduced(word);
        if (w.length < 2) return w;
        const group = maps().ctx.group;
        if (!group || group.dirichletWords || !group.getReverseITransforms) return w;
        const names = group.getGenNames(), rev = group.getReverseITransforms();
        let t = null;
        for (const ch of w) {
            // a side's name is its direct transform, the other case its reverse (Permutations.getGeneratorPerm)
            let s = names.indexOf(ch), step = null;
            if (s >= 0) {
                step = rev[s] ? rev[s].getInverse() : null;
            } else {
                s = names.indexOf(ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase());
                step = s >= 0 ? rev[s] : null;
            }
            if (!step) return w;
            t = t ? t.concat(step) : step.getCopy();
            if (t.getLength() > 64) t.doFactorization();
        }
        const b = homeBasePoint(group);
        if (!b) return w;
        const f = foldHome(group, applyTransform(t, b));
        if (!f.inDomain || Math.hypot(f.pnt[0] - b[0], f.pnt[1] - b[1]) > 1e-7*(1 + Math.hypot(b[0], b[1]))) return w;
        const short = f.transform ? freelyReduced(f.transform.getInverse().getWord() || '') : '';
        return short.length < w.length ? short : w;
    }

    /** the item and its members (a group's, all the way down) carried once
     *  more: the word of the symmetry back is applied first, then the words
     *  they had (their colours come from where they were before); the word
     *  made short (shortColorWord: the same element, the same colours), none
     *  when nothing is left */
    function withColorWord(item, word){
        if (!word) return item;
        if (item.type === 'group') return { ...item, children: (item.children || []).map(c => withColorWord(c, word)) };
        const reduced = shortColorWord(word + (item.colorWord || ''));
        const out = { ...item, colorWord: reduced };
        if (!reduced) delete out.colorWord;
        return out;
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
     * numbers dropped, what it holds staying inside; a tile (Tiles.js) keeps
     * its pairing: To path makes it a curved tile, To polyline a tile of the
     * points of its outline (releaseTiles drops the pairing);
     * images and groups stay; one undo step
     */
    function convertSelection(toPath){
        const before = new Map(), after = new Map();
        for (const sel of mSelection) {
            const item = mDoc.getItem(sel.id);
            if (!item || item.type === 'image' || item.type === 'group') continue;
            const curved = item.tile ? (toPath ? curvedTileOf(item) : polylineTile(item, pairingMap)) : null;
            const plain = plainItem(item.tile ? releasedTile(item) : item);
            const out = curved ? curved
                               : toPath ? (plain.nodes ? plain : pathFromPolyline(plain))
                               : (plain.nodes ? polylineFromPath(plain) : plain);
            if (out !== item) { before.set(item.id, item); after.set(item.id, out); }
        }
        if (!after.size) return;
        applyReplace(after);
        pushReplace(toPath ? 'to path' : 'to polyline', before, after);
        mPicked = [];
        mRepaint();
    }

    /** the selected tiles as plain outlines (Tiles.releasedTile): their edges no longer follow each other, they move as any outline; one undo step */
    function releaseTiles(){
        const before = new Map(), after = new Map();
        for (const sel of mSelection) {
            const item = mDoc.getItem(sel.id);
            if (!item || !item.tile) continue;
            before.set(item.id, item);
            after.set(item.id, releasedTile(item));
        }
        if (!after.size) return;
        applyReplace(after);
        pushReplace('release tile', before, after);
        mRepaint();
    }

    /**
     * the selected polylines and paths as geodesic paths (on: a polyline gets
     * nodes; the nodes and handles stay, the sides without handles become the
     * straight lines of the group's geometry, the curved ones its cubics) or
     * as the plain paths they are drawn as (off: the outline becomes the
     * nodes); the selected shapes as geodesic shapes (on: built in the
     * geometry, where they stand and of about their size) or as Euclidean
     * ones (off); images, groups and tiles stay; one undo step
     */
    function setGeodesic(on){
        const before = new Map(), after = new Map();
        const space = shapeSpace();
        for (const sel of mSelection) {
            const item = mDoc.getItem(sel.id);
            if (!item || item.type === 'image' || item.type === 'group' || item.tile) continue;
            let out = item;
            if (item.shape) {
                if (on && !item.geodesic) out = { ...item, geodesic: true, shape: space ? geodesicShape(item.shape, space) : item.shape };
                else if (!on && item.geodesic) out = { ...withoutGeodesic(item), shape: space ? euclideanShape(item.shape, space) : item.shape };
            }
            else if (on && !item.geodesic) out = { ...(item.nodes ? item : pathFromPolyline(item)), geodesic: true };
            else if (!on && item.geodesic) out = euclideanItem(item);
            if (out !== item) { before.set(item.id, item); after.set(item.id, out); }
        }
        if (!after.size) return;
        applyReplace(after);
        pushReplace(on ? 'to geodesic' : 'to euclidean', before, after);
        mPicked = [];
        mRepaint();
    }

    /**
     * where new content is placed: {box (square, world: cx, cy, half), margin}.
     * The item being edited inside, filled up to the margin; else half the
     * pattern box: smaller than the box, its copies in a depth sort do not
     * all lie in front of it; centred at `at` when given (a paste at the pointer)
     */
    function importBox(at = null){
        const inside = container() ? mDoc.getItem(container().id) : null;
        if (inside) {
            const p = inside.points;
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (let i = 0; i + 1 < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
            return { box: { cx: 0.5*(x0 + x1), cy: 0.5*(y0 + y1), half: 0.5*Math.max(x1 - x0, y1 - y0) }, margin: 0.1 };
        }
        const ptc = context().ptc;
        return { box: { cx: at ? at[0] : ptc.centerX, cy: at ? at[1] : ptc.centerY, half: IMPORT_SHARE*ptc.scale }, margin: 0 };
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

    /**
     * the map (world to world) of a word of the group's generators, for a
     * tile's paired edges. In a Kleinian group it is marked fitImage: a
     * Möbius map, which takes a cubic onto no cubic, so a curved tile's pair
     * is fitted to the image (Tiles.imageSegment) and drawn as the exact
     * image (the document's outline, Tiles.tileOutline); elsewhere it takes a path
     * onto the path of the images of its nodes and handles (an isometry of
     * the plane, or of the geometry a geodesic path is drawn in)
     */
    function pairingMap(word){
        const m = maps();
        const map = wordMap(m.ctx.group, word);
        if (!map) return w => [w[0], w[1]];
        const f = w => { const q = map(m.toPattern.map(w[0], w[1])); return m.fromPattern.map(q[0], q[1]); };
        const g = drawingGeometry();
        if (g.kind !== 'euclidean' || g.fallback === 'kleinian') f.fitImage = true;
        return f;
    }

    /**
     * a tile as a curved tile (Tiles.curvedTile): a geodesic path where the
     * group's geometry is not the plane's (the hyperbolic plane, the sphere),
     * a plain path in the plane and in a Kleinian group (its pairs fitted:
     * pairingMap); null for an item that is no tile. keepNodes: every point of
     * it a node (an edit by node index)
     */
    function curvedTileOf(item, keepNodes = false){
        if (!item || !item.tile) return null;
        if (item.nodes) return item;
        const geodesic = drawingGeometry().kind !== 'euclidean';
        return curvedTile(item, pairingMap, geodesic, geodesic ? nodeChart({ geodesic: true }) : null, keepNodes);
    }

    /**
     * a tile of the group's fundamental domain on top of the active layer
     * (curved with the curvedTiles setting: in a Kleinian group the domain's
     * arcs as cubics, Tiles.tileFromDomain with curves); null without one. at: a world
     * point (the pointer's): the tile is the one whose copies cover it, where
     * the sides of the domain bound more than one polygon (a bent group has
     * one in each component of the plane it tiles; Tiles.tileFromDomain);
     * without it the tile of the maker's domain
     */
    function addTileFromDomain(at = null){
        const m = maps();
        const style = styleFromConfig();
        if (!style.fill) style.fill = { rgba: [1, 1, 1, 1] };
        const arcs = !!mStyleCfg.curvedTiles && drawingGeometry().fallback === 'kleinian';
        const domainTile = tileFromDomain(m.ctx.group, m.fromPattern, style, at ? m.toPattern.map(at[0], at[1]) : null, arcs);
        if (!domainTile) return null;
        const item = (mStyleCfg.curvedTiles && curvedTileOf(domainTile)) || domainTile;
        mContainers = [];
        const added = addItems([item], 'tile')[0];
        setSelection([{ id: added.id, frame: null, frameInv: null }]);
        return added;
    }

    /**
     * a stroke (world points) drawn from one corner of a selected tile to the
     * next, on any copy, becomes that edge (its pair following): true when
     * one took it. Corners are reached within tolPx canvas pixels, of the
     * size at the canvas point (pixelSizeAt). nodes: the stroke as a path's
     * nodes (the pen's, or fitted curves), its points stroke's; on a curved
     * tile they become the edge's nodes, handles included (a tile of points
     * is made curved first when they have handles), on a tile of points
     * the stroke's points do
     */
    function replaceTileEdge(stroke, canvas = null, tolPx = EDGE_END_PX, nodes = null){
        if (stroke.length < 2) return false;
        const m = maps();
        const group = m.ctx.group;
        const s0 = m.toPattern.map(stroke[0][0], stroke[0][1]);
        const s1 = m.toPattern.map(stroke[stroke.length - 1][0], stroke[stroke.length - 1][1]);
        const f = foldPoint(group, s0);
        const tolS = tolPx*patternPerPixel(canvas);
        const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
        const curves = !!nodes && nodes.some(q => q.h1 || q.h2);
        for (const sel of mSelection) {
            const item = mDoc.getItem(sel.id);
            if (!item || !item.tile) continue;
            const hpts = patternPoints(item, m.toPattern);
            const starts = tileEdgeStarts(item.tile);
            const n = item.tile.edges.length;
            // the corners: of a curved tile its corner nodes
            const cornerPoints = item.nodes ? item.nodes.flatMap(q => m.toPattern.map(q.p[0], q.p[1])) : hpts;
            const corner = k => [cornerPoints[2*starts[(k + n) % n]], cornerPoints[2*starts[(k + n) % n] + 1]];
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
                const onItem = w => { const q = applyTransform(frame, m.toPattern.map(w[0], w[1])); return m.fromPattern.map(q[0], q[1]); };
                let changed;
                const target = (curves && !item.nodes) ? curvedTileOf(item) : item;
                if (target && target.nodes && nodes) {
                    // the nodes onto the item's place, handles included, from the edge's first corner to its last
                    let fresh = nodes.map(q => ({ ...q, p: onItem(q.p), h1: q.h1 ? onItem(q.h1) : null, h2: q.h2 ? onItem(q.h2) : null }));
                    if (reversed) fresh = fresh.reverse().map(q => ({ ...q, h1: q.h2, h2: q.h1 }));
                    const inner = fresh.slice(1, -1).map(q => { const { ringEnd, ...plain } = q; return plain; });
                    changed = tileReplacedEdge(target, edge, inner, pairingMap, { h2: fresh[0].h2, h1: fresh[fresh.length - 1].h1 });
                } else {
                    const pts = stroke.map(onItem);
                    if (reversed) pts.reverse();
                    changed = tileReplacedEdge(target || item, edge, pts.slice(1, -1), pairingMap);
                }
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
     * with the import; at: the import box's centre (a paste at the pointer)
     */
    async function importImageBlob(blob, name = blob.name, note = '', at = null){
        const label = name ? `"${name}"` : 'The image';
        const made = await readImage(blob, label);
        if (!made) return null;
        const { box, margin } = importBox(at);
        made.item.points = placeQuad(made.width, made.height, box, margin);
        return addImported([framedImage(made.item)], 'image', label, note)[0];
    }

    /**
     * the shapes of an SVG text placed in the import box, in a frame over
     * its viewport (Frames.js), or, without any, a picture of it; the frame
     * in a list, none when it could not be read. What had to be left out
     * is said. at: the import box's centre (a paste at the pointer)
     */
    async function importSvgText(text, name, at = null){
        const label = name ? `"${name}"` : 'The SVG';
        const { box, margin } = importBox(at);
        const parsed = await readSvg(text, label, box, margin);
        if (!parsed) return [];
        const { items, left, viewport } = parsed;
        if (items.length) return addImported([frameItem(viewport, items)], 'svg', label, left ? `${label} not imported in full: ${left}` : '');
        const blob = new Blob([text], { type: 'image/svg+xml' });
        const picture = await importImageBlob(blob, name, `${label} has no shapes${left ? ` (${left})` : ''}, added as a picture`, at);
        return picture ? [picture] : [];
    }

    /**
     * a paste (the event's DataTransfer) into the drawing, at the pointer:
     * shapes, an SVG or a picture; true when taken. An SVG the event names
     * but does not give, with no shapes beside it, is read through the async
     * clipboard (pasteReadingSvg)
     */
    function paste(data){
        if (!data) return false;
        const get = (type) => { try { return data.getData(type) || ''; } catch (e) { return ''; } };
        const got = { text: get('text/plain'), svg: get('image/svg+xml'), html: get('text/html'),
                      files: Array.from(data.files || []), types: Array.from(data.types || []) };
        if (svgHeldBack(got)) { pasteReadingSvg(got); return true; }
        return pasteContent(got);
    }

    // copy, cut and paste while the focus is not in a text field go to the drawing
    installClipboardHandlers({ copy: onCopyEvent, cut: onCutEvent, paste });

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

    // ── the picture in its holder (docs/symdraw_images_ui_plan.md 4.2) ──────

    /** the picture a holder shows: its one image child, or null */
    function heldImage(item){
        if (!item || item.type === 'group' || !item.children) return null;
        const images = item.children.filter(c => c.type === 'image');
        return images.length === 1 && images[0].points && images[0].points.length >= 8 ? images[0] : null;
    }

    /** the selected items that hold a picture: frames and shapes filled with an image */
    function pictureHolders(){
        // a picture selected inside its frame (the frame entered) stands for the frame
        const out = [];
        for (const it of selectedItems()) {
            const holder = heldImage(it) ? it : holderOfImage(it);
            if (holder && !out.some(h => h.id === holder.id)) out.push(holder);
        }
        return out;
    }

    /** the item holding the image item as its picture, null when it is none's */
    function holderOfImage(item){
        if (!item || item.type !== 'image') return null;
        const chain = mDoc.itemChain(item.id);
        const parent = chain[chain.length - 2];
        const held = parent ? heldImage(parent) : null;
        return held && held.id === item.id ? parent : null;
    }

    /**
     * the pixel size of an image item [width, height]: kept with it since
     * 2026-11-10, else its decoded bitmap's, else its quad's sides (an older
     * item before it decoded)
     */
    function pictureSize(image){
        if (image.size && image.size[0] > 0 && image.size[1] > 0) return image.size;
        const bmp = typeof document !== 'undefined' ? imageBitmap(image.src) : null;
        if (bmp) return [bmp.width, bmp.height];
        const p = image.points;
        return [Math.hypot(p[2] - p[0], p[3] - p[1]), Math.hypot(p[6] - p[0], p[7] - p[1])];
    }

    /** the holder with its picture (changes: src, size) placed in its box by the mode and the orientation */
    function placedIn(holder, mode, op = null, changes = {}){
        const image = heldImage(holder);
        const box = holderBox(holder);
        let orient = pictureOrientation(box, image.points);
        if (op) orient = orientedBy(orient, op);
        const next = { ...image, ...changes };
        const [w, h] = pictureSize(next);
        next.points = placedPicture(box, w, h, mode, orient);
        if (!next.size) next.size = [w, h];
        const out = { ...holder, children: holder.children.map(c => (c === image ? next : c)) };
        if (mode === 'cover') delete out.fit; else out.fit = mode;
        return out;
    }

    /**
     * the pictures of the selected holders placed again, one undo step: mode
     * ('cover', 'fit', 'stretch'; null: each holder's own) and op (null, or
     * 'flipH', 'flipV', 'turnLeft', 'turnRight': the picture flipped or
     * turned in its holder's box); a reset is placePicture() alone
     */
    function placePicture(mode = null, op = null){
        const holders = pictureHolders();
        if (!holders.length) return false;
        const before = new Map(holders.map(it => [it.id, it]));
        const after = new Map(holders.map(it => [it.id, placedIn(it, mode || holderFit(it), op)]));
        applyReplace(after);
        pushReplace(op ? 'picture ' + op : 'picture ' + (mode || 'reset'), before, after);
        mRepaint();
        return true;
    }

    /** the depth of the selected items (the colour layers' depth sort), the first's; null without a selection */
    function selectionDepth(){
        const item = mSelection.map(s => mDoc.getItem(s.id)).find(Boolean);
        return item ? (item.depth || 0) : null;
    }

    /** a step of depth for the nudges: a tenth of the pattern box's half size */
    function depthStep(){
        const scale = context().ptc && context().ptc.scale;
        return 0.1*(scale > 0 ? scale : 1);
    }

    /**
     * the selected items' depth set (value) or moved (by: added to each),
     * one undo step; mergeKey: merged with the step before of the same key
     * (a field's typing, its label dragged). Returns whether any changed
     */
    function setSelectionDepth(value, { by = null, mergeKey = null } = {}){
        const items = mSelection.map(s => mDoc.getItem(s.id)).filter(Boolean);
        const round = (v) => Math.round(v*1e9)/1e9;
        const changed = items.filter(it => round(by === null ? value : (it.depth || 0) + by) !== (it.depth || 0));
        if (!changed.length) return false;
        const before = new Map(changed.map(it => [it.id, it]));
        const after = new Map(changed.map(it => {
            const d = round(by === null ? value : (it.depth || 0) + by);
            const next = { ...it };
            if (d) next.depth = d; else delete next.depth;
            return [it.id, next];
        }));
        applyReplace(after);
        pushReplace('depth', before, after, mergeKey);
        mRepaint();
        mPropertiesChanged();
        return true;
    }

    /** the item holding a picture with this id (any layer), null when there is none now */
    function holderOf(id){
        const item = mDoc.getItem(id);
        return heldImage(item) ? item : null;
    }

    /** the height channel of the picture held by the holder (a grey PNG data URL), null without one */
    function pictureHeight(holderId){
        const holder = holderOf(holderId);
        return holder ? (heldImage(holder).height || null) : null;
    }

    /** how far a height of 1 moves the holder's picture in the depth sort: its own, else half the longer side of its box (world units) */
    function pictureHeightScale(holderId){
        const holder = holderOf(holderId);
        if (!holder) return null;
        return pictureHeightScaleOf(heldImage(holder), holder);
    }

    /** the holder's picture with changes (fields, a value undefined removes one), one undo step; mergeKey as pushReplace's */
    function changePicture(holderId, changes, label, mergeKey = null){
        const holder = holderOf(holderId);
        if (!holder) return false;
        const image = heldImage(holder);
        const next = { ...image };
        for (const [k, v] of Object.entries(changes)) { if (v === undefined || v === null) delete next[k]; else next[k] = v; }
        const after = { ...holder, children: holder.children.map(c => (c === image ? next : c)) };
        applyReplace(new Map([[holder.id, after]]));
        pushReplace(label, new Map([[holder.id, holder]]), new Map([[holder.id, after]]), mergeKey);
        mRepaint();
        return true;
    }

    /** the height channel of the holder's picture set (url: a grey PNG data URL, null: none), one undo step: a stroke of the image editor */
    function setPictureHeight(holderId, url){
        if (pictureHeight(holderId) === (url || null)) return false;
        return changePicture(holderId, { height: url || undefined }, 'picture height');
    }

    /** how far a height of 1 moves the holder's picture (world units), one undo step (typing merged) */
    function setPictureHeightScale(holderId, value){
        if (!(value > 0)) return false;
        return changePicture(holderId, { heightScale: value }, 'picture height scale', 'heightScale');
    }

    /** the image editor opened on the picture of the first selected holder (par.editPicture); false without one */
    function editPicture(){
        const holder = pictureHolders()[0];
        if (!holder || !par.editPicture) return false;
        par.editPicture(holder.id);
        return true;
    }

    /** the fit mode of the selected holders, the first's; null without one */
    function pictureFit(){
        const holder = pictureHolders()[0];
        return holder ? holderFit(holder) : null;
    }

    let mPictureThumb = { src: null, url: null };
    // a thumbnail asked for while its image decodes: the bar asks again once it has
    let mThumbPending = false;
    addImageListener(() => { if (mThumbPending) { mThumbPending = false; mPropertiesChanged(); } });
    /** a small picture of the selected holder's image, for the property bar; null while it decodes or without one */
    function pictureThumbnail(){
        const holder = pictureHolders()[0];
        return holder ? thumbnailOf(heldImage(holder).src) : null;
    }

    /** a picture of an image source, THUMB_PX square (twice the image dialog's thumbnails, for sharp
     *  pixels), for the property bar; null while it decodes */
    function thumbnailOf(src){
        if (!src || typeof document === 'undefined') return null;
        if (mPictureThumb.src === src && mPictureThumb.url) return mPictureThumb.url;
        const bmp = imageBitmap(src);
        if (!bmp) { mThumbPending = true; return null; }
        const W = THUMB_PX, H = THUMB_PX, canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const k = Math.min(W/bmp.width, H/bmp.height), w = bmp.width*k, h = bmp.height*k;
        canvas.getContext('2d').drawImage(bmp, 0.5*(W - w), 0.5*(H - h), w, h);
        mPictureThumb = { src, url: canvas.toDataURL() };
        return mPictureThumb.url;
    }

    // the Image tool's picture, the one the next frame gets (a placeholder
    // until one is chosen), and the fit it is placed by
    const mImageTool = { picture: placeholderPicture(), fit: 'cover' };

    /** a picture of a blob, {src, size}; null when it could not be read, which a banner says */
    async function pictureFromBlob(blob, name = blob.name){
        const made = await readImage(blob, name ? `"${name}"` : 'The image');
        return made ? { src: made.item.src, size: [made.width, made.height] } : null;
    }

    /** the Image tool's settings: fit ('cover', 'fit', 'stretch') */
    function setImageToolValue(key, value){
        if (key === 'fit') mImageTool.fit = value;
        mPropertiesChanged();
    }

    /** the picture the next frame gets: {src, size, placeholder} */
    function setImageToolPicture(picture){
        mImageTool.picture = { src: picture.src, size: picture.size.slice(), ...(picture.placeholder ? { placeholder: true } : {}) };
        mPropertiesChanged();
    }

    /**
     * a frame of the rect shape holding the picture ({src, size,
     * placeholder}; the Image tool's by default) placed by the fit (the
     * tool's by default), as an item not yet added
     */
    function framedPicture(shape, picture = mImageTool.picture, fit = mImageTool.fit){
        const frame = frameItem({ ...shape, kind: 'rect' }, []);
        const image = { type: 'image', closed: true, src: picture.src, size: picture.size.slice(),
                        ...(picture.placeholder ? { placeholder: true } : {}),
                        points: placedPicture(holderBox(frame), picture.size[0], picture.size[1], fit),
                        style: { stroke: null, fill: null, strokeWidth: 0, opacity: 1 } };
        return { ...frame, children: [image], ...(fit === 'cover' ? {} : { fit }) };
    }

    /**
     * the pictures of the selected holders replaced by the picture {src,
     * size}, each placed by its holder's fit as it was oriented there; one
     * undo step; false without a holder
     */
    function replacePictures(picture){
        const before = new Map(), after = new Map();
        for (const h of pictureHolders()) {
            const holder = mDoc.getItem(h.id);
            if (!holder || !heldImage(holder)) continue;
            before.set(holder.id, holder);
            const out = placedIn(holder, holderFit(holder), null, { src: picture.src, size: picture.size.slice() });
            out.children = out.children.map(c => { if (c.type !== 'image' || !c.placeholder) return c; const { placeholder, ...rest } = c; return rest; });
            after.set(holder.id, out);
        }
        if (!after.size) return false;
        applyReplace(after);
        pushReplace('replace image', before, after);
        mRepaint();
        return true;
    }

    /**
     * the selected pictures replaced by another (a blob): in a frame or a
     * filled shape placed by the holder's fit mode, as it was oriented there
     * (flipped, turned); a bare image selected inside a holder in its place,
     * unstretched, covering what the old one covered. One undo step; the
     * first image item, or null when there is none or the blob could not be
     * read, which a banner says
     */
    async function replaceSelectedImage(blob, name = blob.name){
        const label = name ? `"${name}"` : 'The image';
        // the frames selected; a bare image selected inside its frame is replaced where it is
        const holders = selectedItems().filter(it => heldImage(it));
        const target = holders.length ? null : selectedImage();
        if (!holders.length && !target) {
            showWarningBanner('Select an image to replace first');
            return null;
        }
        const made = await readImage(blob, label);
        if (!made) return null;
        const changes = { src: made.item.src, size: [made.width, made.height] };
        if (holders.length) {
            if (!replacePictures(changes)) return null;
            return heldImage(mDoc.getItem(holders[0].id));
        }
        const image = mDoc.getItem(target.id);
        if (!image) return null;
        const after = new Map([[image.id, { ...image, ...changes, points: coverQuad(image.points, made.width, made.height) }]]);
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
        let drawn = { ...item, style: item.style || styleFromConfig() };
        // an open line drawn with the stroke off still takes one: else it is not seen
        if (!drawn.closed && !drawn.style.stroke) drawn = { ...drawn, style: { ...drawn.style, stroke: styleFromConfig(true).stroke } };
        const it = mDoc.insertItem(parentId ? intoContainer(drawn) : drawn, null, null, parentId);
        const at = mDoc.findItem(it.id);
        const saved = itemCopy(it);
        const layerId = at.layer.getId(), index = at.index;
        mUndo.push({ label: 'add', undo: () => mDoc.removeItem(saved.id),
                     redo: () => mDoc.insertItem(saved, layerId, index, parentId) });
        return it;
    }

    function removeItems(ids, label = 'delete'){
        const removed = ids.map(id => mDoc.removeItem(id)).filter(Boolean);
        if (!removed.length) return;
        mSelection = mSelection.filter(s => !ids.includes(s.id));
        mPicked = [];
        mUndo.push({
            label,
            undo: () => removed.slice().reverse().forEach(r => mDoc.insertItem(r.item, r.layerId, r.index, r.parentId)),
            redo: () => removed.forEach(r => mDoc.removeItem(r.item.id)),
        });
    }

    /**
     * items replaced, added and removed in one undo step (the node tool's
     * break and join): replaced a Map id -> item, inserted [{item, after}]
     * each put just above the item with the id `after` (in its layer or the
     * item holding it; on top of the active layer without one), removed the
     * ids of items that go (dropped from the selection and the picked
     * nodes). Returns the inserted items as they were added (their ids)
     */
    function applyEdits(label, { replaced = new Map(), inserted = [], removed = [] } = {}){
        const before = new Map([...replaced.keys()].map(id => [id, mDoc.getItem(id)]).filter(e => e[1]).map(([id, it]) => [id, itemCopy(it)]));
        applyReplace(replaced);
        const added = [];
        for (const { item, after } of inserted) {
            const at = after ? mDoc.findItem(after) : null;
            const it = at ? mDoc.insertItem(item, at.layer.getId(), at.index + 1, at.parentId) : mDoc.insertItem(item);
            const where = mDoc.findItem(it.id);
            added.push({ saved: itemCopy(it), layerId: where.layer.getId(), index: where.index, parentId: where.parentId });
        }
        const gone = removed.map(id => mDoc.removeItem(id)).filter(Boolean);
        if (gone.length) {
            mSelection = mSelection.filter(sel => !removed.includes(sel.id));
            mPicked = mPicked.filter(v => !removed.includes(v.id));
        }
        const now = new Map([...before.keys()].map(id => [id, mDoc.getItem(id)]).filter(e => e[1]).map(([id, it]) => [id, itemCopy(it)]));
        mUndo.push({
            label,
            undo: () => {
                gone.slice().reverse().forEach(r => mDoc.insertItem(r.item, r.layerId, r.index, r.parentId));
                added.slice().reverse().forEach(a => mDoc.removeItem(a.saved.id));
                applyReplace(before);
            },
            redo: () => {
                applyReplace(now);
                added.forEach(a => mDoc.insertItem(a.saved, a.layerId, a.index, a.parentId));
                gone.forEach(r => mDoc.removeItem(r.item.id));
            },
        });
        return added.map(a => a.saved);
    }

    function undo(){ clearSelection(); mUndo.undo(); }
    function redo(){ clearSelection(); mUndo.redo(); }

    // ── overlay ──────────────────────────────────────────────────────────────
    //
    //  The tools show what they do over the picture in two ways: as geometry in
    //  world coordinates for the GPU pass (symhublib EditingOverlay.js), which
    //  takes every pixel through the view's chain of maps, so that the overlay
    //  lies on the picture under any projection; and, where there is no GPU pass
    //  (the tests, a page without one), on the 2D canvas with the view's linear
    //  map (the draw* functions below). The styles are the same in both.
    //

    /** pixels between two world points, by the view's scale at the canvas point (the local scale under a projection) */
    function pxDistance(a, b, canvas){
        return Math.hypot(a[0] - b[0], a[1] - b[1])/(pixelSizeAt(canvas) || 1);
    }

    /**
     * world points of an item's outline on the copy of frameInv, as itemCanvasPath
     * builds it: segments subdivided where the copy's frame bends them, a null
     * between the rings of a compound path
     */
    function itemWorldPath(item, frameInv){
        const m = maps();
        const pts = item.points;
        const n = pts.length/2;
        const segs = item.closed ? n : n - 1;
        const sub = frameInv ? (segs > 200 ? 2 : 8) : 1;
        const out = [];
        const toWorld = (x, y) => mapWorld(frameInv, [x, y], m);
        const bridges = itemBridges(item);
        for (let i = 0; i < segs; i++) {
            if (bridges && bridges.has(i)) { out.push(toWorld(pts[2*i], pts[2*i + 1]), null); continue; }
            const j = (i + 1) % n;
            for (let k = 0; k < sub; k++) {
                const t = k/sub;
                out.push(toWorld(pts[2*i] + t*(pts[2*j] - pts[2*i]), pts[2*i + 1] + t*(pts[2*j + 1] - pts[2*i + 1])));
            }
        }
        if (!item.closed) out.push(toWorld(pts[2*(n - 1)], pts[2*(n - 1) + 1]));
        else if (!bridges) out.push(out[0]);
        return out;
    }

    /** a path with nulls split into its runs */
    function splitPath(path){
        const out = [];
        let cur = [];
        for (const p of path) {
            if (p) cur.push(p);
            else { if (cur.length) out.push(cur); cur = []; }
        }
        if (cur.length) out.push(cur);
        return out;
    }

    // the styles of the overlay (as the 2D canvas draws them, see drawOutline and the others)
    const OUTLINE_STYLE   = { width: 1.5, color: [20/255, 60/255, 200/255, 0.95], dash: 6, gap: 4, halo: [1, 1, 1, 0.85], haloWidth: 4 };
    const CONTAINER_STYLE = { width: 2, color: [0, 150/255, 1, 0.9], dash: 8, gap: 4 };
    const BAND_STYLE = { width: 1, color: [20/255, 60/255, 200/255, 0.9], dash: 4, gap: 3, halo: [1, 1, 1, 0.8], haloWidth: 3 };
    const BAND_STEPS = 16;          // the points of a rubber band's side mapped to the world
    const HANDLE_COLOR = [20/255, 60/255, 200/255, 0.95];
    /** a vertex handle's mark: 'square', 'disc', 'diamond' or 'auto' (true: disc, false: square) */
    const handleMark = (mark) => (mark === true ? 'disc' : (typeof mark === 'string' && mark) ? mark : 'square');
    const WHITE = [1, 1, 1, 0.95];

    /** an empty geometry: {polylines, points} */
    const newGeometry = () => ({ polylines: [], points: [], splanes: [] });

    /** an outline (a world path with nulls) added as polylines */
    function outlineGeometry(geo, path, style = OUTLINE_STYLE){
        for (const points of splitPath(path)) if (points.length >= 2) geo.polylines.push({ points, ...style });
    }
    /**
     * a vertex handle, filled when selected, by its mark (D3 of
     * docs/node_editing_plan.md): 'square' a corner, 'disc' a smooth node or
     * a tile's fixed corner, 'diamond' a symmetric node, 'auto' a disc with a
     * dot (an auto node); true and false stand for disc and square
     */
    function handleGeometry(geo, w, selected = false, mark = false){
        const m = handleMark(mark), fill = selected ? HANDLE_COLOR : WHITE;
        if (m === 'diamond') {
            geo.points.push({ p: w, kind: 'diamond', size: selected ? 6.5 : 5.5, color: HANDLE_COLOR, fill, width: 1.5 });
            return;
        }
        geo.points.push({ p: w, kind: m === 'square' ? 'square' : 'disc', size: selected ? 5 : 4, color: HANDLE_COLOR, fill, width: 1.5 });
        if (m === 'auto') geo.points.push({ p: w, kind: 'disc', size: 1.5, color: selected ? WHITE : HANDLE_COLOR, fill: selected ? WHITE : HANDLE_COLOR, width: 0.5 });
    }
    /** a handle of a shape's numbers: a diamond, or (mark) a disc (an arc's end) or a cross (an ellipse's centre) */
    function shapeHandleGeometry(geo, w, mark = 'diamond'){
        const color = [200/255, 60/255, 20/255, 0.95];
        if (mark === 'cross') {
            geo.points.push({ p: w, kind: 'cross', size: 12, color: WHITE, width: 3 });
            geo.points.push({ p: w, kind: 'cross', size: 12, color, width: 1.5 });
            return;
        }
        geo.points.push({ p: w, kind: mark === 'disc' ? 'disc' : 'diamond', size: mark === 'disc' ? 4.5 : 6, color, fill: WHITE, width: 1.5 });
    }
    /**
     * the stalk of a control handle, from its node to it, as world points: of
     * a geodesic path the geodesic between the two (the curve leaves the node
     * along it), else the straight line
     */
    function handleStalk(from, to, geodesic = false){
        return (geodesic && hasGeodesics()) ? geodesicPolyline([from, to]) : [from, to];
    }
    /** a control handle of a node: the stalk from the node (handleStalk), a small disc */
    function controlHandleGeometry(geo, from, to, geodesic = false){
        geo.polylines.push({ points: handleStalk(from, to, geodesic), width: 1, color: [20/255, 60/255, 200/255, 0.8] });
        geo.points.push({ p: to, kind: 'disc', size: 3.5, color: HANDLE_COLOR, fill: WHITE, width: 1.5 });
    }
    /**
     * a rubber band from canvas point c0 to c1 (the node tool's): a dashed
     * rectangle on the canvas, its sides taken to the world at a few points
     * each, so that the view's chain draws it straight
     */
    function bandGeometry(geo, c0, c1){
        const corners = [[c0[0], c0[1]], [c1[0], c0[1]], [c1[0], c1[1]], [c0[0], c1[1]]];
        const points = [];
        for (let k = 0; k < 4; k++) {
            const a = corners[k], b = corners[(k + 1) % 4];
            for (let j = 0; j < BAND_STEPS; j++) {
                const t = j/BAND_STEPS, w = mView.toWorld([a[0] + t*(b[0] - a[0]), a[1] + t*(b[1] - a[1])]);
                if (w && w.pnt && Number.isFinite(w.pnt[0]) && Number.isFinite(w.pnt[1])) points.push(w.pnt);
            }
        }
        if (points.length >= 3) geo.polylines.push({ points, closed: true, ...BAND_STYLE });
    }
    /** the snap target: a ring, orange on a vertex, purple elsewhere */
    function snapGeometry(geo, target){
        if (!target) return;
        geo.points.push({ p: target.wpnt, kind: 'disc', size: 7, color: target.kind === 'vertex' ? [230/255, 120/255, 0, 0.95] : [150/255, 0, 180/255, 0.95], fill: null, width: 2 });
    }
    /** the container being edited inside: its outline, dashed */
    function containerGeometry(geo){
        while (mContainers.length && !mDoc.getItem(container().id)) mContainers = mContainers.slice(0, -1);
        const c = container();
        if (!c) return;
        outlineGeometry(geo, itemWorldPath(mDoc.getItem(c.id), c.frameInv), CONTAINER_STYLE);
    }
    /**
     * the transform box: the frame white under black, black discs at the
     * corners, black squares at the sides, the pivot a ringed dot with crosshairs
     * (the pattern transform tool's: symhublib's OverlayGeometry builder)
     */
    const transformBoxGeometry = sharedTransformBoxGeometry;

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

    /** a rubber band from canvas point c0 to c1: a dashed rectangle with a light halo */
    function drawBand(ctx, c0, c1){
        const x = Math.min(c0[0], c1[0]), y = Math.min(c0[1], c1[1]), w = Math.abs(c1[0] - c0[0]), h = Math.abs(c1[1] - c0[1]);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = 'rgba(20,60,200,0.9)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
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

    function drawHandle(ctx, c, selected = false, mark = false){
        const m = handleMark(mark);
        ctx.save();
        ctx.beginPath();
        const r = selected ? 5 : 4;
        if (m === 'diamond') {
            const d = selected ? 6.5 : 5.5;
            ctx.moveTo(c[0], c[1] - d); ctx.lineTo(c[0] + d, c[1]); ctx.lineTo(c[0], c[1] + d); ctx.lineTo(c[0] - d, c[1]); ctx.closePath();
        } else if (m === 'square') ctx.rect(c[0] - r, c[1] - r, 2*r, 2*r);
        else ctx.arc(c[0], c[1], r, 0, 2*Math.PI);
        const blue = 'rgba(20,60,200,0.95)', white = 'rgba(255,255,255,0.95)';
        ctx.fillStyle = selected ? blue : white;
        ctx.strokeStyle = blue;
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
        if (m === 'auto') {
            ctx.beginPath();
            ctx.arc(c[0], c[1], 1.5, 0, 2*Math.PI);
            ctx.fillStyle = selected ? white : blue;
            ctx.fill();
        }
        ctx.restore();
    }

    /** the snap target marker */
    /** a handle of a shape's numbers: a diamond, or (mark) a disc (an arc's end) or a cross (an ellipse's centre) */
    function drawShapeHandle(ctx, c, mark = 'diamond'){
        ctx.save();
        ctx.beginPath();
        if (mark === 'cross') {
            ctx.moveTo(c[0] - 6, c[1]); ctx.lineTo(c[0] + 6, c[1]); ctx.moveTo(c[0], c[1] - 6); ctx.lineTo(c[0], c[1] + 6);
            ctx.strokeStyle = 'rgba(255,255,255,0.95)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.strokeStyle = 'rgba(200,60,20,0.95)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
            return;
        }
        if (mark === 'disc') ctx.arc(c[0], c[1], 4.5, 0, 2*Math.PI);
        else { ctx.moveTo(c[0], c[1] - 6); ctx.lineTo(c[0] + 6, c[1]); ctx.lineTo(c[0], c[1] + 6); ctx.lineTo(c[0] - 6, c[1]); }
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(200,60,20,0.95)';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    /** a control handle of a node: a line from the node's canvas point to the handle's, a small circle there */
    function drawControlHandle(ctx, from, to, stalk = null){
        ctx.save();
        ctx.strokeStyle = 'rgba(20,60,200,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(from[0], from[1]);
        // the stalk's canvas points when given (a geodesic path's is an arc), else the straight line
        for (const p of (stalk && stalk.length > 2) ? stalk.slice(1) : [to]) ctx.lineTo(p[0], p[1]);
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

    /** undo and redo; Ctrl+Shift+C: the selected outlines to paths (Inkscape's Object to Path); Ctrl+Alt+V: paste in place; returns true when the key was used */
    function handleCommonKey(e){
        if (e.type !== 'keydown') return false;
        const ctrl = e.ctrlKey || e.metaKey;
        if (!ctrl) return false;
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { undo(); return true; }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { redo(); return true; }
        if (k === 'c' && e.shiftKey && !e.altKey) { convertSelection(true); return true; }
        // Inkscape's paste in place: no paste event comes with it, the clipboard is read
        if (k === 'v' && e.altKey && !e.shiftKey) { pasteFromClipboard(true); return true; }
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
        toolWorldChanged,
        onToolWorldChange: (cb) => { mToolWorldListeners.push(cb); },
        patternPerPixel,
        // the geometry of the group and its motions, as maps of the seen world
        geometry,
        drawingGeometry,
        hasGeodesics,
        drawsGeodesics,
        pointGeometry,
        geodesicPolyline,
        geodesicPath,
        geodesicRay,
        setGeodesic,
        nodeChart,
        nodeOutliner,
        drawingChart,
        curveSplitter,
        shapeSpace,
        shapeSpaceOf,
        drawingShapeSpace,
        handleStalk,
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
        hitTolerance,
        dragTolerance,
        pickTolerance: (e = null) => hitTolerance(PICK_PX, e),
        propertiesChanged: () => mPropertiesChanged(),
        itemsInBand,
        snap,
        // selection
        getSelection:   () => mSelection,
        setSelection,
        isSelected,
        clearSelection,
        selectItem,
        getSelectedVertex: () => (mPicked.length ? mPicked[mPicked.length - 1] : null),
        getSelectedVertices: () => mPicked.slice(),
        setSelectedVertex,
        setSelectedVertices,
        isVertexPicked,
        // the items being edited inside
        enterContainer,
        leaveContainer,
        leaveContainersOutside,
        getContainer:   container,
        drawContainer,
        // edits
        addItem,
        addItems,
        addTileFromDomain,
        replaceTileEdge,
        curvedTileOf,
        releaseTiles,
        convertSelection,
        fitCurvesSelection,
        fittedItem,
        fitTolerance,
        selectionBox,
        transformedSelection,
        transformSelection,
        fitSelection,
        fitsCell,
        normalizeSelection,
        canNormalizeSelection,
        flipSelection,
        rotateSelection,
        alignSelection,
        distributeSelection,
        copySelection,
        cutSelection,
        pasteFromClipboard,
        pasteRecord,
        pasteContent,
        selectionClipboard,
        duplicateSelection,
        notePointer,
        pointer,
        hasClipboard:   () => !!mClipboard,
        reorderSelection,
        moveSelectionToLayer,
        canMoveSelectionToLayer: (dir) => layerMoves(dir).length > 0,
        groupSelection,
        ungroupSelection,
        releaseContent,
        setOpacity,
        getSelectedImage: selectedImage,
        replaceSelectedImage,
        getPictureHolders: pictureHolders,
        placePicture,
        pictureFit,
        pictureThumbnail,
        thumbnailOf,
        pictureFromBlob,
        replacePictures,
        framedPicture,
        getImageToolConfig: () => mImageTool,
        // the image editor: the height channel of a holder's picture
        heldPicture:    (holderId) => heldImage(holderOf(holderId)),
        pictureHeight,
        pictureHeightScale,
        setPictureHeight,
        setPictureHeightScale,
        editPicture,
        canEditPicture: () => !!par.editPicture && pictureHolders().length > 0,
        // the depth of the selected items in the colour layers' depth sort
        selectionDepth,
        setSelectionDepth,
        depthStep,
        setImageToolValue,
        setImageToolPicture,
        chooseImage:    () => (par.chooseImage ? par.chooseImage() : null),
        // the image dialog for a picture: title, onFile(file) for each file chosen
        choosePicture:  (title, onFile) => (par.choosePicture ? par.choosePicture(title, onFile) : null),
        getFillableItems: fillableItems,
        fillWithImage,
        fillWithSvg,
        chooseFill:     (kind) => (par.chooseFill ? par.chooseFill(kind) : null),
        // the image dialog for a file added as it is: 'image' a picture in the shape being edited,
        // else in the pattern box (importImageBlob); 'svg' the shapes of an SVG file (importSvgText)
        chooseImport:   (kind) => (par.chooseImport ? par.chooseImport(kind) : null),
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
        applyEdits,
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
        // the overlay as geometry for the GPU pass
        pxDistance,
        itemWorldPath,
        newGeometry,
        outlineGeometry,
        handleGeometry,
        shapeHandleGeometry,
        controlHandleGeometry,
        snapGeometry,
        bandGeometry,
        containerGeometry,
        transformBoxGeometry,
        drawOutline,
        drawHandle,
        drawControlHandle,
        drawShapeHandle,
        drawSnap,
        drawBand,
        handleCommonKey,
        // the group or the pattern box changed: the frames of the selection are stale
        onGeometryChanged: () => { mSelection = []; mPicked = []; mContainers = []; mCopies = null; mCacheKey = ''; },
    };

} // function DrawingEditor()

export { DrawingEditor };
