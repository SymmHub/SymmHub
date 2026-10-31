//
//  ToolProperties - the settings the drawing tools show in the property bar
//  of SymRenderer's tool palette (uilib PropertyBar controls), over the
//  editor's settings: the style of new items (also the selection's, through
//  editor.setStyleValue), the numbers each shape tool draws with, and the
//  kind and numbers of a selected shape (editor.setShapeValue).
//

const ICON_SNAP = new URL('./res/prop_snap.svg', import.meta.url).pathname;
const ICON_FIT  = new URL('./res/prop_fit.svg', import.meta.url).pathname;

// a square half filled: fill closed shapes
const ICON_FILL =
    '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="none" stroke="#202020" stroke-width="2"/>' +
    '<path d="M5 19 L19 5 V19 Z" fill="#3366e6"/></svg>';
// three dots: more settings
const ICON_MORE =
    '<svg viewBox="0 0 24 24" fill="#303030"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';

const SHAPE_KINDS = ['rect', 'ellipse', 'polygon', 'star', 'spiral'];
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

/** the style of new items and of the selection: stroke, width, fill; more in a popover */
function styleProperties(editor){
    const cfg = editor.getStyleConfig();
    const set = (key) => (v) => editor.setStyleValue(key, v);
    return [
        { kind: 'color', label: 'stroke', title: 'stroke colour', get: () => cfg.stroke, set: set('stroke') },
        { kind: 'number', label: 'width', title: 'stroke width, in the units of the drawing',
          min: 0, max: 1, step: 0.001, get: () => cfg.width, set: set('width') },
        { kind: 'toggle', label: 'fill', icon: ICON_FILL, title: 'fill closed shapes',
          get: () => cfg.filled, set: set('filled') },
        { kind: 'color', title: 'fill colour', get: () => cfg.fill, set: set('fill'), enabled: () => cfg.filled },
        { kind: 'popover', icon: ICON_MORE, title: 'opacities, cap and join, colour class', controls: [
            { kind: 'number', label: 'stroke opacity', min: 0, max: 1, step: 0.01, get: () => cfg.strokeOpacity, set: set('strokeOpacity') },
            { kind: 'number', label: 'fill opacity', min: 0, max: 1, step: 0.01, get: () => cfg.fillOpacity, set: set('fillOpacity') },
            { kind: 'choice', label: 'cap', title: 'ends of open strokes', options: CAPS, get: () => cfg.cap, set: set('cap') },
            { kind: 'choice', label: 'join', title: 'corners of strokes', options: JOINS, get: () => cfg.join, set: set('join') },
            { kind: 'number', label: 'colour class', title: 'the colour class whose tiles alone show the shape (-1: every tile)',
              min: -1, max: 23, step: 1, get: () => cfg.colorClass, set: set('colorClass') },
        ] },
    ];
}

/** the tool's own controls (a list, or a list of groups), then the style as a group of its own */
function withStyle(editor, controls){
    const groups = controls.some(c => c && c.kind === 'group') ? controls : [{ kind: 'group', controls }];
    return [...groups, { kind: 'group', title: 'style', controls: styleProperties(editor) }];
}

/** the numbers of a kind of shape over cfg (a shape tool's, or the selected shape's) */
function shapeNumbers(cfg, set, isKind){
    return [
        { kind: 'number', label: 'round', title: 'rounding of the corners (of the shorter side)',
          min: 0, max: 1, step: 0.01, get: () => cfg.round, set: set('round'), visible: () => isKind('rect') },
        { kind: 'number', label: 'corners', title: 'corners of the polygon',
          min: 3, max: 64, step: 1, get: () => cfg.n, set: set('n'), visible: () => isKind('polygon') },
        { kind: 'number', label: 'points', title: 'points of the star',
          min: 2, max: 64, step: 1, get: () => cfg.n, set: set('n'), visible: () => isKind('star') },
        { kind: 'number', label: 'inner', title: 'inner radius of the star',
          min: 0.05, max: 1, step: 0.01, get: () => cfg.ratio, set: set('ratio'), visible: () => isKind('star') },
        { kind: 'number', label: 'turns', title: 'turns of the spiral',
          min: 1, max: 64, step: 1, get: () => cfg.n, set: set('n'), visible: () => isKind('spiral') },
    ];
}

/** the numbers a shape tool draws with */
function shapeToolProperties(editor, kind){
    const cfg = editor.getShapeToolConfig(kind);
    return shapeNumbers(cfg, (key) => (v) => editor.setShapeToolValue(kind, key, v), (k) => k === kind);
}

/** the kind and numbers of the shape selected alone, a group shown while there is one */
function selectedShapeProperties(editor){
    const cfg = editor.getShapeConfig();
    const set = (key) => (v) => editor.setShapeValue(key, v);
    const one = () => !!editor.getSelectedShape();
    return { kind: 'group', title: 'the selected shape', visible: one, controls: [
        { kind: 'choice', title: 'kind of the selected shape', options: SHAPE_KINDS, get: () => cfg.kind, set: set('kind') },
        ...shapeNumbers(cfg, set, (k) => cfg.kind === k),
    ] };
}

export {
    snapProperty,
    fitCurvesProperty,
    styleProperties,
    withStyle,
    shapeToolProperties,
    selectedShapeProperties,
};
