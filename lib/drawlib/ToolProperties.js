//
//  ToolProperties - the settings the drawing tools show in the property bar
//  of SymRenderer's tool palette (uilib PropertyBar controls), over the
//  editor's settings, and those of the style panel (PatternDrawing's, one
//  for all the tools): the style of new items (also the selection's, through
//  editor.setStyleValue), the numbers each shape tool draws with, and the
//  numbers of a selected shape, which keeps its kind (editor.setShapeValue,
//  the node tool's, and a shape tool's for a shape of its kind), and with a
//  star's numbers the button turning the selected stars into polylines
//  (editor.releaseShapes).
//

const ICON_SNAP = new URL('./res/prop_snap.svg', import.meta.url).pathname;
const ICON_FIT  = new URL('./res/prop_fit.svg', import.meta.url).pathname;

// a square half filled: fill closed shapes
const ICON_FILL =
    '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="none" stroke="#202020" stroke-width="2"/>' +
    '<path d="M5 19 L19 5 V19 Z" fill="#3366e6"/></svg>';
// a star's outline with nodes at its corners: the stars as polylines
const ICON_STAR_TO_POLYLINE =
    '<svg viewBox="0 0 24 24"><path d="M12 3.5 L14.47 9.1 L20.56 9.72 L15.99 13.8 L17.29 19.78 L12 16.7 L6.71 19.78 L8.01 13.8 ' +
    'L3.44 9.72 L9.53 9.1 Z" fill="none" stroke="#303030" stroke-width="1.4" stroke-linejoin="round"/>' +
    [[12, 3.5], [20.56, 9.72], [17.29, 19.78], [6.71, 19.78], [3.44, 9.72]]
        .map(([x, y]) => `<rect x="${x - 1.6}" y="${y - 1.6}" width="3.2" height="3.2" fill="#fff" stroke="#303030" stroke-width="1"/>`).join('') +
    '</svg>';
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

/** freehand strokes fitted with curves */
function fitCurvesProperty(editor){
    return { kind: 'toggle', icon: ICON_FIT, title: 'freehand strokes fitted with curves',
             get: () => editor.getStyleConfig().fitCurves, set: (v) => editor.setStyleValue('fitCurves', v) };
}

/**
 * the style of new items and of the selection, the style panel's controls
 * in three rows: the stroke (colour, width, opacity), the fill (on, colour,
 * opacity, rule), the strokes' cap and join and the colour class
 */
function styleProperties(editor){
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
        ] },
        { kind: 'break' },
        { kind: 'group', title: 'strokes and colour class', controls: [
            { kind: 'choice', label: 'cap', title: 'ends of open strokes', options: CAPS, get: () => cfg.cap, set: set('cap') },
            { kind: 'choice', label: 'join', title: 'corners of strokes', options: JOINS, get: () => cfg.join, set: set('join') },
            { kind: 'number', label: 'class', title: 'colour class: the class whose tiles alone show the shape (-1: every tile)',
              min: -1, max: 23, step: 1, get: () => cfg.colorClass, set: set('colorClass') },
        ] },
    ];
}

/**
 * the numbers of a kind of shape: get(key)() and set(key)(value) a shape
 * tool's, or the selected shape's; a star's then the button turning the
 * selected stars into polylines
 */
function shapeNumbers(editor, get, set, isKind){
    const star = () => isKind('star');
    return [
        { kind: 'number', label: 'round', title: 'rounding of the corners (of the shorter side)',
          min: 0, max: 1, step: 0.01, get: get('round'), set: set('round'), visible: () => isKind('rect') },
        { kind: 'number', label: 'corners', title: 'corners of the polygon',
          min: 3, max: 64, step: 1, get: get('n'), set: set('n'), visible: () => isKind('polygon') },
        { kind: 'number', label: 'count', title: 'outer corners of the star, and as many inner ones',
          min: 2, max: 64, step: 1, get: get('n'), set: set('n'), visible: star },
        { kind: 'number', label: 'radius', title: 'radius of the outer corners (a stretched star: the mean of its axes)',
          min: 0.001, step: 0.001, digits: 3, get: get('radius'), set: set('radius'), visible: star },
        { kind: 'number', label: 'aspect', title: 'radius of the inner corners, of the outer ones',
          min: 0, max: 2, step: 0.01, get: get('ratio'), set: set('ratio'), visible: star },
        { kind: 'number', label: 'twist', title: 'turn of the inner corners, in steps between outer ones: ' +
                                                 '0 halfway, 0.5 at the next outer corner, 1 halfway past it; below 0 clockwise',
          min: -10, max: 10, step: 0.01, get: get('twist'), set: set('twist'), visible: star },
        { kind: 'button', icon: ICON_STAR_TO_POLYLINE, visible: star,
          title: 'To polyline: the selected stars as plain polylines, their corners then moved one by one (the node tool); their star numbers are gone',
          enabled: () => editor.getSelectedShapes('star').length > 0, action: () => editor.releaseShapes('star') },
        { kind: 'number', label: 'turns', title: 'turns of the spiral',
          min: 1, max: 64, step: 1, get: get('n'), set: set('n'), visible: () => isKind('spiral') },
    ];
}

/** a number of a shape: a star's radius the mean of its frame's axes */
function shapeValue(s, key){
    return key === 'radius' ? Math.sqrt(s.rx*s.ry) : (s[key] ?? 0);
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
 * the numbers of the shape selected alone, a group shown while there is
 * one: the name of its kind (which stays), its width and height across its
 * frame (a star's radius instead), then its kind's numbers
 */
function selectedShapeProperties(editor){
    const shape = () => { const item = editor.getSelectedShape(); return item ? item.shape : null; };
    const isKind = (k) => { const s = shape(); return !!s && s.kind === k; };
    const get = (key) => () => { const s = shape(); return s ? shapeValue(s, key) : 0; };
    const sized = () => { const s = shape(); return !!s && s.kind !== 'star'; };
    const set = (key) => (v) => editor.setShapeValue(key, v);
    const size = { min: 0.001, step: 0.001, digits: 3 };
    return { kind: 'group', title: 'the selected shape', visible: () => !!shape(), controls: [
        ...Object.keys(KIND_LABELS).map(k => ({ kind: 'label', text: KIND_LABELS[k], title: 'the kind of the shape, which stays', visible: () => isKind(k) })),
        { kind: 'number', label: 'W', title: 'width: across its frame, along its first axis', ...size, visible: sized,
          get: () => { const s = shape(); return s ? 2*s.rx : 0; }, set: set('w') },
        { kind: 'number', label: 'H', title: 'height: across its frame, along its second axis', ...size, visible: sized,
          get: () => { const s = shape(); return s ? 2*s.ry : 0; }, set: set('h') },
        ...shapeNumbers(editor, get, set, isKind),
    ] };
}

export {
    snapProperty,
    fitCurvesProperty,
    styleProperties,
    shapeToolProperties,
    selectedShapeProperties,
};
