//
//  The Orientation tool: the view's tool (docs/symrenderer_refactor_plan.md
//  phase 3a). Its events go on to the navigator, which makes the navigation
//  mode's motions of the plain gestures in it (navigates), and the document
//  frame's handles and the pole O take presses. Its bar: home, back, the
//  partial resets, the navigation modes and the sphere view, the pole O, the
//  document's frame and the view's numbers (docs/navigation_tool_plan.md
//  section 1). It works through the host the renderer gives its tools and
//  the skin's icons; options.canShowTransforms and options.showTransforms
//  add the button of the transformations' window, where the UI has one.
//

// the navigation modes of the bar, their icons named in the skin
const NAV_MODES = [
    { value: 'euclidean',  icon: 'navEuclidean',
      title: 'Euclidean navigation: the canvas pans, zooms (and turns)' },
    { value: 'spherical',  icon: 'navSpherical',
      title: 'spherical navigation: drags turn the sphere whose equator is the unit circle' },
    { value: 'hyperbolic', icon: 'navHyperbolic',
      title: 'hyperbolic navigation: drags move the hyperbolic plane of the unit disk' },
    { value: 'inversive',  icon: 'navInversive',
      title: 'inversive navigation: Moebius moves about the pole O (drag: O stays, the point follows; ' +
             'wheel: towards the pointer, Shift: turns about the pointer and O)' },
];

const HELP = 'drag moves the view, the wheel zooms (in every tool the wheel zooms and Space+drag moves the view)';

// the bar's fields follow the view at most this often while it moves
const REFRESH_MS = 100;

function OrientationTool(host, options = {}) {

    const skin = options.skin;
    const canShowTransforms = options.canShowTransforms || (() => false);
    const showTransforms = options.showTransforms || (() => {});
    let mActive = false;
    let mRefreshTimer = 0;

    // the view moved (the gestures, the panel, a script): the bar shows its numbers
    host.addEventListener('viewChanged', () => {
        if (!mActive || mRefreshTimer) return;
        mRefreshTimer = setTimeout(() => {
            mRefreshTimer = 0;
            if (!mActive) return;
            host.refreshToolBar();
            host.refreshToolHint();
        }, REFRESH_MS);
    });

    // the help line follows the navigation mode
    function getHint() {
        const nav = host.getNavigator();
        let hint = nav.gestureHint ? nav.gestureHint(true) : HELP;
        if (nav.getFrameShown && nav.getFrameShown()) {
            hint += '. The document\'s frame: drag its sides or centre to move it, its corners to resize it (Shift keeps its shape), ' +
                    'the round handle to turn it (Shift: 15° steps)';
        }
        return hint;
    }

    //
    //  the bar: a row with the home button, the
    //  partial resets (the canvas, the Moebius transform, zoom 1, upright)
    //  and the help button; a row with the navigation modes and the sphere
    //  view; in the inversive mode a row with the pole O; while it is shown
    //  a row with the document's frame; last a row with the canvas's centre,
    //  width w (2 / zoom, as the frame's) and angle. A navigator without
    //  modes (PlaneNavigator) gets the home button only
    //
    function getProperties() {
        const nav = host.getNavigator();
        const controls = [];
        const changed = () => { host.refreshToolHint(); host.scheduleRepaint(); };
        // after a jump of the view the back button may come on
        const jumped = () => { host.refreshToolBar(); changed(); };
        const viewActions = [];
        if (nav.goToDocumentView) {
            // the document view (docs/document_view_plan.md): home goes to it, the next
            // button makes the canvas's view the document's
            viewActions.push({ kind: 'button', icon: skin.icons.resetView,
                               title: 'home: the document view, the frame saved with the document, whole on the canvas (` goes back)',
                               action: () => { nav.goHome(); jumped(); } });
            viewActions.push({ kind: 'button', icon: skin.icons.prevView,
                               title: 'back (` key): the view before home or a reset; again, the view you came back from',
                               enabled: () => nav.hasPreviousView(),
                               action: () => { host.goToPreviousView(); } });
            viewActions.push({ kind: 'button', icon: skin.icons.setDocView,
                               title: 'set document view: the view on the canvas becomes the document\'s (saved with it, home goes to it)',
                               action: () => { nav.setDocumentViewFromCurrent(); host.scheduleRepaint(); } });
            if (nav.setFrameShown) {
                viewActions.push({ kind: 'toggle', icon: skin.icons.docFrame,
                    title: 'the document\'s frame on the canvas, the outside shaded (in every tool); in this tool drag its sides or ' +
                           'centre to move it, its corners to resize it (Shift keeps its shape), the round handle to turn it ' +
                           '(Shift: 15° steps)',
                    get: () => nav.getFrameShown(), set: (v) => { host.setFrameShown(v); changed(); } });
            }
        } else if (nav.onResetView) {
            viewActions.push({ kind: 'button', icon: skin.icons.resetView, title: 'home: the view as it was at the start',
                               action: () => { nav.onResetView(); jumped(); } });
        }
        // a jump of the view (zoom 1, upright) keeps the view before it for back
        const jump = (f) => { if (nav.jumpView) nav.jumpView(f); else f(); jumped(); };
        // the partial resets
        if (nav.onResetEuclideanTrans) {
            viewActions.push({ kind: 'button', icon: skin.icons.resetCanvas,
                title: 'reset the canvas: centre 0, zoom 1, upright; the Moebius transform stays',
                action: () => { nav.onResetEuclideanTrans(); jumped(); } });
        }
        if (nav.onResetInversiveTrans) {
            viewActions.push({ kind: 'button', icon: skin.icons.resetMoebius,
                title: 'reset the Moebius transform: the motions of the geometry undone; the canvas stays',
                action: () => { nav.onResetInversiveTrans(); jumped(); } });
        }
        if (nav.setZoom) {
            viewActions.push({ kind: 'button', icon: skin.icons.zoom1, title: 'zoom 1: the zoom of the start about the canvas centre (the view\'s w 2)',
                action: () => jump(() => nav.setZoom(1)) });
        }
        if (nav.setAngle) {
            viewActions.push({ kind: 'button', icon: skin.icons.upright, title: 'upright: the canvas turned back to angle 0 about its centre',
                action: () => jump(() => nav.setAngle(0)) });
        }
        if (viewActions.length) {
            controls.push({ kind: 'group', title: 'view actions', controls: viewActions });
        }
        controls.push({ kind: 'hint' });
        // the navigation modes and the sphere view on a row of their own
        const navControls = [];
        if (nav.setMode) {
            navControls.push({ kind: 'iconChoice', title: 'navigation mode: the geometry whose motions the drags make',
                options: NAV_MODES.map(m => ({ ...m, icon: skin.icons[m.icon] })),
                get: () => nav.getMode(), set: (v) => { nav.setMode(v); changed(); } });
        }
        if (nav.setSphereView) {
            navControls.push({ kind: 'toggle', icon: skin.icons.sphereView,
                title: 'sphere view: the plane shown on a sphere (stereographic projection); drags turn the sphere, Alt moves the canvas',
                get: () => nav.getSphereView(), set: (v) => { nav.setSphereView(v); changed(); } });
        }
        if (nav.setInfinitePan) {
            navControls.push({ kind: 'toggle', icon: skin.icons.infinitePan,
                title: 'infinite pan: the folding starts at the view (the view anchor), so pans and hyperbolic moves go on without end; off: the view as before',
                get: () => nav.getInfinitePan(), set: (v) => { nav.setInfinitePan(v); changed(); } });
        }
        if (canShowTransforms()) {
            navControls.push({ kind: 'button', icon: skin.icons.transforms,
                title: 'transformations: the conformal transformations the picture is seen through (band, exponent, ...), a list in a window of its own',
                action: () => showTransforms() });
        }
        if (navControls.length) {
            controls.push({ kind: 'break' });
            controls.push({ kind: 'group', title: 'navigation', controls: navControls });
        }
        if (nav.setPole) {
            // the pole of the inversive mode, on a row of its own: placed at the canvas centre or at infinity, its place
            const inv = () => nav.getMode() === 'inversive';
            const placed = () => inv() && !!nav.getPole();
            controls.push({ kind: 'break', visible: inv });
            controls.push({ kind: 'group', title: 'the pole O of the inversive moves', controls: [
                { kind: 'toggle', icon: skin.icons.pole, visible: inv,
                  title: 'the pole O: on, placed at the canvas centre (drag its mark to move it); off, at infinity ' +
                         '(the moves are those of the plane; with the sphere view the antipode of the pointer)',
                  get: () => !!nav.getPole(), set: (v) => { if (v) nav.placePoleAtCentre(); else nav.setPole(null); changed(); } },
                { kind: 'number', label: 'O x', title: 'the pole O, x', step: 0.001, digits: 3, visible: placed,
                  get: () => (nav.getPole() || [0, 0])[0], set: (v) => nav.setPole([v, (nav.getPole() || [0, 0])[1]]) },
                { kind: 'number', label: 'y', title: 'the pole O, y', step: 0.001, digits: 3, visible: placed,
                  get: () => (nav.getPole() || [0, 0])[1], set: (v) => nav.setPole([(nav.getPole() || [0, 0])[0], v]) },
            ] });
        }
        if (nav.setFrameShown) {
            // the document's frame while it is shown, on a row of its own: its centre, sides and turn
            const shown = () => nav.getFrameShown();
            const fv = (key) => nav.getFrameValues()[key];
            const setF = (key) => (v) => { nav.setFrameValue(key, v); host.scheduleRepaint(); };
            controls.push({ kind: 'break', visible: shown });
            controls.push({ kind: 'group', title: 'the document\'s frame: the rectangle the document view shows (each change one undo step)', controls: [
                { kind: 'label', text: 'frame', title: 'the document\'s frame: the rectangle the document view shows (each change one undo step)',
                  visible: shown },
                { kind: 'number', label: 'x', title: 'the frame\'s centre, x', step: 0.001, digits: 6, width: 10, visible: shown,
                  get: () => fv('x'), set: setF('x') },
                { kind: 'number', label: 'y', title: 'the frame\'s centre, y', step: 0.001, digits: 6, width: 10, visible: shown,
                  get: () => fv('y'), set: setF('y') },
                { kind: 'number', label: 'w', title: 'the frame\'s width, world units (2 / its zoom)', min: 1e-9, max: 1e9, step: 0.01, digits: 6, width: 10, visible: shown,
                  get: () => fv('width'), set: setF('width') },
                { kind: 'number', label: 'h', title: 'the frame\'s height, world units', min: 1e-9, max: 1e9, step: 0.01, digits: 6, width: 10, visible: shown,
                  get: () => fv('height'), set: setF('height') },
                { kind: 'number', label: 'angle', title: 'the frame\'s turn, degrees (the canvas\'s angle at the document view)',
                  min: -360, max: 360, step: 0.1, digits: 6, width: 11, visible: shown,
                  get: () => fv('angle'), set: setF('angle') },
            ] });
        }
        if (nav.setCenter && nav.setZoom) {
            // the canvas's centre, width (2 / zoom) and turn, the last row
            controls.push({ kind: 'break' });
            controls.push({ kind: 'group', title: 'the canvas: the world point at its centre, the width it shows and the turn', controls: [
                { kind: 'label', text: 'view', title: 'the view on the canvas: the world point at its centre, the width it shows and the turn' },
                { kind: 'number', label: 'x', title: 'the world point at the canvas centre, x', step: 0.001, digits: 6, width: 10,
                  get: () => nav.getCenter()[0], set: (v) => nav.setCenter(v, nav.getCenter()[1]) },
                { kind: 'number', label: 'y', title: 'the world point at the canvas centre, y', step: 0.001, digits: 6, width: 10,
                  get: () => nav.getCenter()[1], set: (v) => nav.setCenter(nav.getCenter()[0], v) },
                // the view's width, as the frame's: 2 / zoom (zoom 1, the unit circle fits the width: w 2)
                { kind: 'number', label: 'w', title: 'the width of the view, world units (2 / its zoom; 2: the unit circle fits the canvas\'s width)',
                  min: 2e-6, max: 2e6, step: 0.01, digits: 6, width: 10,
                  get: () => 2 / nav.getZoom(), set: (v) => nav.setZoom(2 / v) },
                nav.setAngle ? { kind: 'number', label: 'angle', title: 'turn of the canvas, degrees counterclockwise (Ctrl+Shift+wheel turns it about the pointer)',
                  min: -360, max: 360, step: 0.1, digits: 6, width: 11,
                  get: () => nav.getAngle(), set: (v) => nav.setAngle(v) } : null,
            ].filter(Boolean) });
        }
        return controls;
    }

    return {
        name:  'move',
        label: 'Orientation',
        key:   'H',
        icon:  skin.images.move,
        group: 'view',
        help:  HELP,
        cursor: skin.cursors.move,
        // the view's tool: the navigator's plain gestures and handles are on
        navigates: true,
        getProperties,
        getHint,
        setActive: (on) => { mActive = !!on; },
        // the navigator after it in the active tools takes the events
        handleEvent: () => {},
    };
}

export {
    OrientationTool,
};
