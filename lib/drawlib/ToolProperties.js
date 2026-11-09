//
//  ToolProperties - the settings the drawing tools show in the property bar
//  of SymRenderer's tool palette (uilib PropertyBar controls), over the
//  editor's settings, and those of the style panel (PatternDrawing's, one
//  for all the tools): the style of new items (also the selection's, through
//  editor.setStyleValue), the numbers each shape tool draws with, and the
//  numbers of a selected shape, which keeps its kind (editor.setShapeValue,
//  the node tool's, and a shape tool's for a shape of its kind), and with a
//  polygon's or star's numbers its Curves toggle and the switches making its
//  corners smooth or sharp when curved; with every kind's numbers the
//  buttons turning the selected shapes of the kind into plain polylines or
//  paths (editor.releaseShapes).
//

const ICON_SNAP = new URL('./res/prop_snap.svg', import.meta.url).pathname;
const ICON_FIT  = new URL('./res/prop_fit.svg', import.meta.url).pathname;

// a square half filled: fill closed shapes
const ICON_FILL =
    '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="none" stroke="#202020" stroke-width="2"/>' +
    '<path d="M5 19 L19 5 V19 Z" fill="#3366e6"/></svg>';
// a four-pointed star of cubics: a star's corners joined by curves
const STAR_CURVES = 'M12 2.5 C13 9.5 14.5 11 21.5 12 C14.5 13 13 14.5 12 21.5 C11 14.5 9.5 13 2.5 12 C9.5 11 11 9.5 12 2.5 Z';
const ICON_STAR_CURVES =
    `<svg viewBox="0 0 24 24"><path d="${STAR_CURVES}" fill="none" stroke="#303030" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
// a triangle of bulging cubics: a polygon's corners joined by curves
const POLYGON_CURVES = 'M12 3 C17.44 6.52 20.28 11.52 20.5 18 C14.83 21 9.17 21 3.5 18 C3.72 11.52 6.56 6.52 12 3 Z';
const ICON_POLYGON_CURVES =
    `<svg viewBox="0 0 24 24"><path d="${POLYGON_CURVES}" fill="none" stroke="#303030" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
const nodeSquares = (pts) => pts.map(([x, y]) => `<rect x="${x - 1.6}" y="${y - 1.6}" width="3.2" height="3.2" fill="#fff" stroke="#303030" stroke-width="1"/>`).join('');
// a zigzag through square nodes: the shapes as polylines
const ZIGZAG = [[3, 18], [8, 7], [14, 15], [20, 5]];
const ICON_TO_POLYLINE =
    `<svg viewBox="0 0 24 24"><path d="M${ZIGZAG.map(p => p.join(' ')).join(' L')}" fill="none" stroke="#303030" stroke-width="1.4" stroke-linejoin="round"/>` +
    nodeSquares(ZIGZAG) + '</svg>';
// a wave through square nodes, the middle one with its handles: the shapes as paths
const ICON_TO_PATH =
    '<svg viewBox="0 0 24 24"><path d="M3 16 C6 6 10 6 12 12 C14 18 18 18 21 8" fill="none" stroke="#303030" stroke-width="1.4"/>' +
    '<path d="M10 6 L14 18" fill="none" stroke="#303030" stroke-width="0.9"/>' +
    '<circle cx="10" cy="6" r="1.4" fill="#303030"/><circle cx="14" cy="18" r="1.4" fill="#303030"/>' +
    nodeSquares([[3, 16], [12, 12], [21, 8]]) + '</svg>';
// a hill and a valley, each with its tangent through a round node: smooth
// outer corners (as the node tool's smooth node) and smooth inner ones
const SMOOTH_NODE = 'fill="#fff" stroke="#303030" stroke-width="1.5"';
const ICON_SMOOTH_OUTER =
    '<svg viewBox="0 0 24 24"><path d="M3 19 C6 7 18 7 21 19" fill="none" stroke="#303030" stroke-width="1.8" stroke-linecap="round"/>' +
    `<path d="M4 10 H20" fill="none" stroke="#303030" stroke-width="1.2"/><circle cx="12" cy="10" r="2.6" ${SMOOTH_NODE}/></svg>`;
const ICON_SMOOTH_INNER =
    '<svg viewBox="0 0 24 24"><path d="M3 5 C6 17 18 17 21 5" fill="none" stroke="#303030" stroke-width="1.8" stroke-linecap="round"/>' +
    `<path d="M4 14 H20" fill="none" stroke="#303030" stroke-width="1.2"/><circle cx="12" cy="14" r="2.6" ${SMOOTH_NODE}/></svg>`;
// a pentagram, its middle empty: the even-odd fill rule
const ICON_EVENODD =
    '<svg viewBox="0 0 24 24"><path d="M12 3 L17.58 20.19 L2.97 9.56 L21.03 9.56 L6.42 20.19 Z" fill="#3366e6" fill-rule="evenodd" ' +
    'stroke="#202020" stroke-width="1.3" stroke-linejoin="round"/></svg>';

// the name of a shape's kind before its numbers
const KIND_LABELS = { rect: 'Rectangle', ellipse: 'Ellipse', polygon: 'Polygon', star: 'Star', spiral: 'Spiral' };
const CAPS = ['round', 'butt', 'square'];
const JOINS = ['round', 'miter', 'bevel'];

/** snapping to the vertices of the copies, mirrors and cone points */
function snapProperty(editor){
    return { kind: 'toggle', icon: ICON_SNAP, title: 'snap to the vertices of the copies, mirrors and cone points',
             get: () => editor.getStyleConfig().snap, set: (v) => editor.setStyleValue('snap', v) };
}

// a disk with two geodesics of the hyperbolic plane: the moves in the geometry of the group
const ICON_GEOMETRY =
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="#303030" stroke-width="1.5"/>' +
    '<path d="M5.3 5.3 A 9 9 0 0 0 5.3 18.7 M18.7 5.3 A 9 9 0 0 1 18.7 18.7" fill="none" stroke="#303030" stroke-width="1.3"/>' +
    '<path d="M3 12 H21" fill="none" stroke="#303030" stroke-width="1.3"/></svg>';

/**
 * the moves, turns and scalings of the select tool as motions of the group's
 * geometry (the hyperbolic plane, the sphere, the local disks of a Kleinian
 * group), so that a shape keeps its size in the pattern; off: in the plane,
 * as a Euclidean drawing, so that a shape keeps its size on screen
 */
function geometryProperty(editor){
    return { kind: 'toggle', icon: ICON_GEOMETRY,
             title: 'move, turn and scale in the geometry of the group (the hyperbolic plane, the sphere, the local disks of a Kleinian group): ' +
                    'a shape keeps its size in the pattern; off: in the plane, a shape keeps its size on screen',
             get: () => editor.getStyleConfig().geometry, set: (v) => editor.setStyleValue('geometry', v) };
}

// an incremental move: a dashed path with a small square turned at its end
const ICON_INCREMENTAL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 19 C 4 11, 9 6, 17 7" stroke-dasharray="2.4 1.8"/>' +
    '<path d="M14.2 4.6 L17 7 L14.6 9.8"/>' +
    '<rect x="14.6" y="12.6" width="6" height="6" transform="rotate(25 17.6 15.6)"/></svg>';

/**
 * the select tool's moves as small geodesic steps along the pointer's path
 * (parallel transport: a loop turns the shape by the area it encloses); off: the
 * direct move from the grab point to the pointer, the same whatever the path
 */
function incrementalProperty(editor){
    return { kind: 'toggle', icon: ICON_INCREMENTAL,
             title: 'incremental motion: a dragged shape is carried along the pointer\'s path by small geodesic steps (parallel transport), ' +
                    'so a loop turns it by the area it encloses; off: the direct move from the grab point to the pointer, the same whatever the path',
             get: () => editor.getStyleConfig().incremental, set: (v) => editor.setStyleValue('incremental', v) };
}

// a shape kept in its cell: a small square inside a circle
const ICON_CELL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-width="1.5" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="9.5"/><rect x="8.5" y="8.5" width="7" height="7"/></svg>';

/**
 * a dragged shape stays inside its cell: in a Kleinian group a move that would
 * take its box out of the local disk of the group is not made (a shape across
 * the limit set has copies everywhere and blows up); off: the move goes
 * wherever the pointer goes
 */
function keepInCellProperty(editor){
    return { kind: 'toggle', icon: ICON_CELL,
             title: 'a dragged shape stays inside its cell: in a Kleinian group a move that would take it across the limit set ' +
                    '(out of the local disk of the group) is not made; off: the move goes wherever the pointer goes, and the shape ' +
                    'blows up across the limit set',
             get: () => editor.getStyleConfig().keepInCell, set: (v) => editor.setStyleValue('keepInCell', v) };
}

// a disk with a side between two nodes bent as the disk's geodesic is: lines drawn as geodesics
const ICON_GEODESIC =
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="#303030" stroke-width="1.2"/>' +
    '<path d="M6 16.5 Q12 12 18 16.5" fill="none" stroke="#303030" stroke-width="1.6"/>' +
    '<rect x="4.4" y="14.9" width="3.2" height="3.2" fill="#fff" stroke="#303030" stroke-width="1"/>' +
    '<rect x="16.4" y="14.9" width="3.2" height="3.2" fill="#fff" stroke="#303030" stroke-width="1"/></svg>';

/**
 * the lines of the polyline and pen tools as geodesic paths (Paths.js):
 * their straight sides the straight lines of the group's geometry, arcs on
 * screen that the copies continue, their curves the cubics of the geometry,
 * and the shapes of the shape tools as shapes of that geometry (Shapes.js),
 * their sizes lengths of its metric; off: straight lines, curves and shapes
 * of the screen. Shown in a group whose geometry is the hyperbolic plane or
 * the sphere, and in a Kleinian group, whose lines are the arcs of its local
 * disks: in the plane the two are the same
 */
function geodesicProperty(editor){
    return { kind: 'toggle', icon: ICON_GEODESIC, visible: () => editor.hasGeodesics(),
             title: 'geodesic lines: straight sides are the straight lines of the group\'s geometry (the hyperbolic plane, the sphere), ' +
                    'arcs on screen, curves its curves, and shapes its shapes (a regular polygon of the geometry, sizes in its metric); ' +
                    'off: lines, curves and shapes of the screen. The node tool\'s menu turns a selected outline into one or the other',
             get: () => editor.getStyleConfig().geodesic, set: (v) => editor.setStyleValue('geodesic', v) };
}

/** freehand strokes fitted with curves */
function fitCurvesProperty(editor){
    return { kind: 'toggle', icon: ICON_FIT, title: 'freehand strokes fitted with curves',
             get: () => editor.getStyleConfig().fitCurves, set: (v) => editor.setStyleValue('fitCurves', v) };
}

/** the opacity of the selected items, whole: an image's, a shape's with what it holds */
function opacityProperty(editor){
    const first = () => { const sel = editor.getSelection()[0]; return sel ? editor.document.getItem(sel.id) : null; };
    return { kind: 'number', label: 'opacity', title: 'opacity of the selected shapes, whole: an image, a shape with its stroke, fill and what it holds',
             min: 0, max: 1, step: 0.01, get: () => { const it = first(); return it ? it.style.opacity ?? 1 : 1; }, set: (v) => editor.setOpacity(v) };
}

/**
 * the style of new items and of the selection, the style panel's controls
 * in three rows: the stroke (colour, width, opacity), the fill (on, colour,
 * opacity, rule, the menu of what a shape holds: commands, DrawingCommands),
 * the strokes' cap and join and the colour class
 */
function styleProperties(editor, commands){
    const cfg = editor.getStyleConfig();
    const set = (key) => (v) => editor.setStyleValue(key, v);
    const filled = () => cfg.filled;
    return [
        { kind: 'group', title: 'stroke', controls: [
            { kind: 'color', label: 'stroke', title: 'stroke colour', get: () => cfg.stroke, set: set('stroke') },
            { kind: 'number', label: 'width', title: 'stroke width, in the units of the drawing',
              min: 0, max: 1, step: 0.001, get: () => cfg.width, set: set('width') },
            { kind: 'number', label: 'opacity', title: 'stroke opacity', min: 0, max: 1, step: 0.01,
              get: () => cfg.strokeOpacity, set: set('strokeOpacity') },
        ] },
        { kind: 'break' },
        { kind: 'group', title: 'fill', controls: [
            { kind: 'toggle', label: 'fill', icon: ICON_FILL, title: 'fill closed shapes', get: filled, set: set('filled') },
            { kind: 'color', title: 'fill colour', get: () => cfg.fill, set: set('fill'), enabled: filled },
            { kind: 'number', label: 'opacity', title: 'fill opacity', min: 0, max: 1, step: 0.01, enabled: filled,
              get: () => cfg.fillOpacity, set: set('fillOpacity') },
            { kind: 'toggle', icon: ICON_EVENODD, enabled: filled,
              title: 'fill rule even-odd: where the outline crosses itself, a region crossed an even number of times on the way out ' +
                     'is empty; off: nonzero, a region the outline winds round (either way) is filled',
              get: () => cfg.fillRule === 'evenodd', set: (v) => editor.setStyleValue('fillRule', v ? 'evenodd' : 'nonzero') },
            { kind: 'menu', icon: commands.icon('menu'), title: 'an image, an SVG or the selection as the fill, over the solid fill',
              items: () => commands.menuItems(['fillImage', 'fillSvg', 'selectionAsFill', '-', 'editFill', 'release', 'removeFill']) },
        ] },
        { kind: 'break' },
        { kind: 'group', title: 'strokes', controls: [
            { kind: 'choice', label: 'cap', title: 'ends of open strokes', options: CAPS, get: () => cfg.cap, set: set('cap') },
            { kind: 'choice', label: 'join', title: 'corners of strokes', options: JOINS, get: () => cfg.join, set: set('join') },
        ] },
    ];
}

/**
 * the numbers of a kind of shape: get(key)() and set(key)(value) a shape
 * tool's, or the selected shape's; a polygon's or star's then its Curves
 * toggle, when curved the switches of its corners, smooth or sharp; last
 * the buttons turning the selected shapes of the kind into polylines or
 * paths
 */
function shapeNumbers(editor, get, set, isKind){
    const star = () => isKind('star');
    const polygon = () => isKind('polygon');
    const cornered = () => star() || polygon();
    const curved = () => cornered() && !!get('curved')();
    const kind = () => Object.keys(KIND_LABELS).find(isKind) || null;
    const release = (toPath) => () => editor.releaseShapes(kind(), toPath);
    const any = () => !!kind() && editor.getSelectedShapes(kind()).length > 0;
    const curvesTitle = 'Curves: the corners joined by cubics, each corner with two handles (round, on lines from it) that ' +
                        'every corner of its kind follows; off: straight sides (the handles are kept)';
    const sharpTitle = 'off: sharp, its handles move apart (Alt+drag a handle makes the corners sharp; ' +
                       'a double click on the diamond of a corner switches)';
    return [
        { kind: 'number', label: 'round', title: 'rounding of the corners (of the shorter side)',
          min: 0, max: 1, step: 0.01, get: get('round'), set: set('round'), visible: () => isKind('rect') },
        { kind: 'number', label: 'corners', title: 'corners of the polygon',
          min: 3, max: 64, step: 1, get: get('n'), set: set('n'), visible: () => isKind('polygon') },
        { kind: 'number', label: 'count', title: 'outer corners of the star, and as many inner ones',
          min: 2, max: 64, step: 1, get: get('n'), set: set('n'), visible: star },
        { kind: 'number', label: 'radius', title: 'radius of the corners, of a star the outer ones (a stretched shape: the mean of its axes; a geodesic shape: in the metric of the group\'s geometry)',
          min: 0.001, step: 0.001, digits: 3, get: get('radius'), set: set('radius'), visible: cornered },
        { kind: 'number', label: 'aspect', title: 'radius of the inner corners, of the outer ones',
          min: 0, max: 2, step: 0.01, get: get('ratio'), set: set('ratio'), visible: star },
        { kind: 'number', label: 'twist', title: 'turn of the inner corners, in steps between outer ones: ' +
                                                 '0 halfway, 0.5 at the next outer corner, 1 halfway past it; below 0 clockwise',
          min: -10, max: 10, step: 0.01, get: get('twist'), set: set('twist'), visible: star },
        { kind: 'toggle', icon: ICON_POLYGON_CURVES, visible: polygon, get: curved, set: set('curved'), title: curvesTitle },
        { kind: 'toggle', icon: ICON_STAR_CURVES, visible: star, get: curved, set: set('curved'), title: curvesTitle },
        { kind: 'toggle', icon: ICON_SMOOTH_OUTER, visible: curved, get: () => !!get('smoothO')(), set: set('smoothO'),
          title: 'Smooth corners (of a star the outer ones): a drag of one handle turns the other to stay in line; ' + sharpTitle },
        { kind: 'toggle', icon: ICON_SMOOTH_INNER, visible: () => star() && curved(), get: () => !!get('smoothI')(), set: set('smoothI'),
          title: 'Smooth inner corners: a drag of one handle turns the other to stay in line; ' + sharpTitle },
        { kind: 'number', label: 'turns', title: 'turns of the spiral',
          min: 1, max: 64, step: 1, get: get('n'), set: set('n'), visible: () => isKind('spiral') },
        { kind: 'button', icon: ICON_TO_POLYLINE, visible: () => !!kind(), enabled: any, action: release(false),
          title: 'To polyline: the selected shapes of this kind as plain polylines through their outlines, ' +
                 'their corners then moved one by one (the node tool); their numbers are gone' },
        { kind: 'button', icon: ICON_TO_PATH, visible: () => !!kind(), enabled: any, action: release(true),
          title: 'To path: the selected shapes of this kind as plain Bezier paths, their nodes and handles then ' +
                 'moved one by one (the node tool); their numbers are gone' },
    ];
}

/** a number of a shape: a polygon's or star's radius the mean of its frame's axes; smoothO, smoothI: are its corners, outer and inner, smooth */
function shapeValue(s, key){
    if (key === 'radius') return Math.sqrt(s.rx*s.ry);
    if (key === 'smoothO' || key === 'smoothI') return !!(s.smooth && s.smooth[key === 'smoothO' ? 'o' : 'i']);
    return s[key] ?? 0;
}

/**
 * the numbers a shape tool draws with; while a shape of its kind is
 * selected alone, that shape's, set for it and for the next shapes
 */
function shapeToolProperties(editor, kind){
    const cfg = editor.getShapeToolConfig(kind);
    const selected = () => { const item = editor.getSelectedShape(); return item && item.shape.kind === kind ? item.shape : null; };
    const get = (key) => () => { const s = selected(); return s ? shapeValue(s, key) : cfg[key]; };
    const set = (key) => (v) => { editor.setShapeToolValue(kind, key, v); if (selected()) editor.setShapeValue(key, v); };
    return shapeNumbers(editor, get, set, (k) => k === kind);
}

/**
 * the numbers of the shape selected alone, groups shown while there is
 * one: the name of its kind (which stays), its width and height across its
 * frame (a polygon's or star's radius instead), then its kind's numbers;
 * its buttons in a group of their own, which wraps apart from the numbers
 */
function selectedShapeProperties(editor){
    const shape = () => { const item = editor.getSelectedShape(); return item ? item.shape : null; };
    const isKind = (k) => { const s = shape(); return !!s && s.kind === k; };
    const get = (key) => () => { const s = shape(); return s ? shapeValue(s, key) : 0; };
    const sized = () => { const s = shape(); return !!s && s.kind !== 'star' && s.kind !== 'polygon'; };
    const set = (key) => (v) => editor.setShapeValue(key, v);
    const size = { min: 0.001, step: 0.001, digits: 3 };
    const controls = shapeNumbers(editor, get, set, isKind);
    const isButton = (c) => c.kind === 'button' || c.kind === 'toggle';
    return [
        { kind: 'group', title: 'the selected shape', visible: () => !!shape(), controls: [
            ...Object.keys(KIND_LABELS).map(k => ({ kind: 'label', text: KIND_LABELS[k], title: 'the kind of the shape, which stays', visible: () => isKind(k) })),
            { kind: 'number', label: 'W', title: 'width: across its frame, along its first axis (a geodesic shape: in the metric of the group\'s geometry, as the world has it at the centre of the model)', ...size, visible: sized,
              get: () => { const s = shape(); return s ? 2*s.rx : 0; }, set: set('w') },
            { kind: 'number', label: 'H', title: 'height: across its frame, along its second axis (a geodesic shape: in the metric)', ...size, visible: sized,
              get: () => { const s = shape(); return s ? 2*s.ry : 0; }, set: set('h') },
            ...controls.filter(c => !isButton(c)),
        ] },
        { kind: 'group', title: 'the selected shape', visible: () => !!shape(), controls: controls.filter(isButton) },
    ];
}

export {
    snapProperty,
    fitCurvesProperty,
    geodesicProperty,
    geometryProperty,
    incrementalProperty,
    keepInCellProperty,
    opacityProperty,
    styleProperties,
    shapeToolProperties,
    selectedShapeProperties,
};
