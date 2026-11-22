//
//  SymRendererSkin: the look of SymRenderer's UI, by name
//  (docs/symrenderer_refactor_plan.md, phase 1):
//  - icons:   the inline SVGs of the tool bars (Orientation, Symmetry, Pattern box);
//  - images:  the image files of the toolbox and of the own tools, in ./res;
//  - cursors: the canvas cursors of the own tools, as CSS cursor values;
//  - labels:  the toolbox's titles, run and stop.
//
//  An app changes entries by name, in its UI builder's options:
//      SymRenderer({ ..., ui: ClassicUI, uiOptions: { skin: { images: { settings: myUrl }, labels: { run: 'Go' } } } })
//  and a page in its address: #{"skin":{...}}. The builder lays them over DEFAULT_SKIN
//  (mergeSkin), the page's last. Only the UI builders read the skin, never the core.
//

// an image file of the skin, by its name in ./res
function res(name) {
    return new URL('res/' + name, import.meta.url).pathname;
}

// a house: the view as it was at the start
const ICON_RESET_VIEW =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">' +
    '<path d="M3 11 L12 3 L21 11"/><path d="M5.5 9 V21 H18.5 V9"/><path d="M10 21 V15 H14 V21"/></svg>';
// set document view: the frame's corners with a check
const ICON_SET_DOC_VIEW =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">' +
    '<path d="M3 8 V4 H7 M17 4 H21 V8 M21 16 V20 H17 M7 20 H3 V16"/><path d="M8 12.5 L11 15.5 L16.5 9"/></svg>';
// the document's frame on the canvas: a frame, the outside shaded, a corner handle
const ICON_DOC_FRAME =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-linejoin="miter">' +
    '<path d="M2 3 H22 V21 H2 Z M6 7 V17 H18 V7 Z" fill="#303030" fill-opacity="0.28" fill-rule="evenodd" stroke="none"/>' +
    '<rect x="6" y="7" width="12" height="10" stroke-width="1.6"/>' +
    '<rect x="15.5" y="14.5" width="5" height="5" fill="#ffffff" stroke="#1f6fd0" stroke-width="1.4"/></svg>';
// back: the view before home or a reset, an arrow turning back
const ICON_PREV_VIEW =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">' +
    '<path d="M9 5 L4 10 L9 15"/><path d="M4 10 H14 A6 6 0 0 1 14 22 H10"/></svg>';

// the navigation modes: a square grid, a sphere's great circles in the plane
// (the circle and two circles through opposite points of it), the hyperbolic
// disk with two geodesics
const ICON_NAV_EUCLIDEAN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-width="1.4">' +
    '<path d="M4 4 H20 V20 H4 Z M9.3 4 V20 M14.7 4 V20 M4 9.3 H20 M4 14.7 H20"/></svg>';
const ICON_NAV_SPHERICAL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030">' +
    '<circle cx="12" cy="12" r="5.5" stroke-width="1.6"/>' +
    '<g transform="rotate(30 12 12)" stroke-width="1.2"><circle cx="12" cy="16.3" r="7"/><circle cx="12" cy="7.7" r="7"/></g></svg>';
const ICON_NAV_HYPERBOLIC =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030">' +
    '<circle cx="12" cy="12" r="9" stroke-width="1.5"/>' +
    '<path d="M3.3 9.6 A 6 6 0 0 0 9.6 3.3 M20.7 9.6 A 6 6 0 0 1 14.4 3.3 M5.6 18.4 A 10 10 0 0 1 18.4 18.4" stroke-width="1.3"/></svg>';
// the inversive mode: two circles crossing at the pole, a dot there
const ICON_NAV_INVERSIVE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030">' +
    '<circle cx="9" cy="12" r="6.5" stroke-width="1.4"/><circle cx="15" cy="12" r="6.5" stroke-width="1.4"/>' +
    '<circle cx="12" cy="5.8" r="1.6" fill="#d0208a" stroke="none"/></svg>';
// the pole O: a ring with a cross
const ICON_POLE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#d0208a" stroke-width="1.6">' +
    '<circle cx="12" cy="12" r="5"/><path d="M4 12 H20 M12 4 V20"/></svg>';
// the sphere view: a globe with its equator and a meridian
const ICON_SPHERE_VIEW =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030">' +
    '<circle cx="12" cy="12" r="9" stroke-width="1.5"/>' +
    '<ellipse cx="12" cy="12" rx="9" ry="3.2" stroke-width="1.2"/>' +
    '<ellipse cx="12" cy="12" rx="3.6" ry="9" stroke-width="1.2"/></svg>';
// the conformal transformations: a square mapped to a disk
const ICON_TRANSFORMS =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">' +
    '<rect x="2" y="8" width="7" height="8"/><circle cx="18" cy="12" r="4.2"/>' +
    '<path d="M10.5 12 H13.5 M12 10.3 L13.7 12 L12 13.7"/></svg>';
// infinite pan: the infinity sign
const ICON_INFINITE_PAN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-width="1.8" stroke-linejoin="round">' +
    '<path d="M12 12 C9.5 8.5 4 8.5 4 12 C4 15.5 9.5 15.5 12 12 C14.5 8.5 20 8.5 20 12 C20 15.5 14.5 15.5 12 12 Z"/></svg>';
// the partial resets of the orientation tool: a circular arrow about the
// canvas or the Moebius transform's circles; a magnifier with 1; an upward
// arrow on its base line
const ICON_RESET_ARROW = '<path d="M20 8 A9 9 0 1 0 21 13" stroke-width="1.6"/><path d="M20.5 3.5 V8.5 H15.5" stroke-width="1.6"/>';
const ICON_RESET_CANVAS =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-linejoin="round" stroke-linecap="round">' +
    ICON_RESET_ARROW + '<rect x="8" y="9" width="8" height="6" stroke-width="1.4"/></svg>';
const ICON_RESET_MOEBIUS =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-linejoin="round" stroke-linecap="round">' +
    ICON_RESET_ARROW + '<circle cx="10.2" cy="12" r="3" stroke-width="1.3"/><circle cx="13.8" cy="12" r="3" stroke-width="1.3"/></svg>';
const ICON_ZOOM_1 =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-linejoin="round" stroke-linecap="round">' +
    '<circle cx="10" cy="10" r="7" stroke-width="1.6"/><path d="M15 15 L21 21" stroke-width="2.2"/>' +
    '<path d="M8.6 8 L10.4 6.6 V13.4" stroke-width="1.6"/></svg>';
const ICON_UPRIGHT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">' +
    '<path d="M12 19 V4 M7 9 L12 4 L17 9 M5 20 H19"/></svg>';

// the geometry of the group: a disk with two geodesics and a diameter
const ICON_GEOMETRY =
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="#303030" stroke-width="1.5"/>' +
    '<path d="M5.3 5.3 A 9 9 0 0 0 5.3 18.7 M18.7 5.3 A 9 9 0 0 1 18.7 18.7" fill="none" stroke="#303030" stroke-width="1.3"/>' +
    '<path d="M3 12 H21" fill="none" stroke="#303030" stroke-width="1.3"/></svg>';
// the Symmetry tool's toggles: the group's handles (a domain with curved sides, a handle on
// one of them); the Dirichlet domain (a cell around the yellow base point)
const ICON_GROUP_HANDLES =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-width="1.5" stroke-linejoin="round">' +
    '<path d="M4.5 19.5 Q12 15.5 19.5 19.5 Q14 12.5 12 3.5 Q10 12.5 4.5 19.5 Z"/>' +
    '<rect x="13.1" y="9.9" width="3.8" height="3.8" fill="#303030" stroke="none"/></svg>';
const ICON_DIRICHLET =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-width="1.5" stroke-linejoin="round">' +
    '<path d="M12 3 Q17 6 20 8.5 Q19 13 20 16 Q15 18 12 21 Q9 18 4 16 Q5 12 4 8.5 Q7 6 12 3 Z"/>' +
    '<circle cx="12" cy="12" r="2.6" fill="#FFFF22" stroke="#000000" stroke-width="1.3"/></svg>';
// the group transform's frame: a turned box with discs at its corners and the pivot's mark at its centre
const ICON_TRANSFORM_HANDLES =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M7.05 3.43 L20.58 7.05 L16.95 20.58 L3.43 16.95 Z" stroke-width="1.3"/>' +
    '<path d="M12 7.6 V16.4 M7.6 12 H16.4" stroke-width="1.2"/>' +
    '<circle cx="12" cy="12" r="2.3" fill="#ffffff" stroke-width="1.4"/>' +
    '<circle cx="12" cy="12" r="0.9" fill="#303030" stroke="none"/>' +
    '<g fill="#303030" stroke="none"><circle cx="7.05" cy="3.43" r="2"/><circle cx="20.58" cy="7.05" r="2"/>' +
    '<circle cx="16.95" cy="20.58" r="2"/><circle cx="3.43" cy="16.95" r="2"/></g></svg>';
// a menu of commands
const ICON_MENU =
    '<svg viewBox="0 0 24 24"><path d="M4 7 H20 M4 12 H20 M4 17 H20" fill="none" stroke="#303030" stroke-width="2" stroke-linecap="round"/></svg>';

export const DEFAULT_SKIN = {
    icons: {
        resetView: ICON_RESET_VIEW,
        setDocView: ICON_SET_DOC_VIEW,
        docFrame: ICON_DOC_FRAME,
        prevView: ICON_PREV_VIEW,
        navEuclidean: ICON_NAV_EUCLIDEAN,
        navSpherical: ICON_NAV_SPHERICAL,
        navHyperbolic: ICON_NAV_HYPERBOLIC,
        navInversive: ICON_NAV_INVERSIVE,
        pole: ICON_POLE,
        sphereView: ICON_SPHERE_VIEW,
        transforms: ICON_TRANSFORMS,
        infinitePan: ICON_INFINITE_PAN,
        resetCanvas: ICON_RESET_CANVAS,
        resetMoebius: ICON_RESET_MOEBIUS,
        zoom1: ICON_ZOOM_1,
        upright: ICON_UPRIGHT,
        geometry: ICON_GEOMETRY,
        groupHandles: ICON_GROUP_HANDLES,
        dirichlet: ICON_DIRICHLET,
        transformHandles: ICON_TRANSFORM_HANDLES,
        menu: ICON_MENU,
    },
    images: {
        settings: res('btn_settings.svg'),
        fileMenu: res('btn_file_menu.svg'),
        windows: res('btn_windows.svg'),
        run: res('btn_play.svg'),
        stop: res('btn_pause.svg'),
        restart: res('btn_restart.svg'),
        initialize: res('btn_initialize.svg'),
        recordStart: res('btn_record_start.svg'),
        recordStop: res('btn_record_stop.svg'),
        download: res('btn_download.svg'),
        fullScreen: res('btn_full_screen.svg'),
        move: res('btn_move2.svg'),
        symmetry: res('btn_symmetry.svg'),
        patternTransform: res('btn_pattern_transform.svg'),
        draw: res('btn_draw.svg'),
        pick: res('btn_pick.svg'),
        separator: res('btn_vbar.svg'),
    },
    cursors: {
        move:             `url(${res('cur_move3.svg')}) 15 15, move`,
        patternTransform: `url(${res('cur_pattern_transform.svg')}) 0 0, move`,
        pick:             `url(${res('cur_pick2.svg')}) 1 31, crosshair`,
        draw:             `url(${res('cur_draw2.svg')}) 1 31, pointer`,
    },
    labels: {
        settings:         'settings',
        fileMenu:         'files: samples, open, save',
        windows:          'windows: shown, hidden, brought to the top',
        run:              'Run',
        stop:             'Stop',
        restart:          'Restart',
        initialize:       'initialize',
        recording:        'recording',
        exportImage:      'export image',
        exportMenu:       'export: an image, the files of the pattern',
        fullScreen:       'full screen',
        move:             'move',
        symmetry:         'symmetry: the group\'s handles, the group transform\'s frame and the Dirichlet domain on the canvas (their toggles: symmetry > handles)',
        patternTransform: 'pattern transform',
        draw:             'draw',
        pick:             'pick',
    },
};

const GROUPS = ['icons', 'images', 'cursors', 'labels'];

// a skin: the entries of each override laid over those of `base` in turn, group by group
export function mergeSkin(base, ...overs) {
    const skin = {};
    for (const g of GROUPS) skin[g] = { ...(base && base[g]) };
    for (const over of overs) {
        if (!over) continue;
        for (const g of Object.keys(over)) {
            if (GROUPS.includes(g)) Object.assign(skin[g], over[g]);
            else console.warn(`SymRendererSkin: unknown group '${g}' (${GROUPS.join(', ')})`);
        }
    }
    return skin;
}
