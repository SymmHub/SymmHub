import {
    DatGUI,
    hexToPremult,
    resizeCanvas,
    getWebGLContext,

    CanvasTransform,
    TransformMotion2D,
    poseBend,
    poseBendUniform,
    poseInverseTransform,
    PlaneNavigator,

    DataPacking,
    TORADIANS,
    ITransform,

    getPixelRatio,

    drawGridAndRuler,

    DrawingToolRenderer,
    DrawingToolHandler,
    PatternTransformHandler,
    PatternTransformRenderer,
    EditingOverlay,
    makeViewAnchor,
    centredViewMap,
    viewDisk,
    bandViewFrame,
    viewChainToWorld,
    viewChainMirrors,
    viewChainBand,
    packViewChain,
    mergeGeometry,
    createDataPlot,

    readPixelsFromBuffer,
    CanvasSize,
    createVideoRecorder3,
    date2s,
    getTime,
    transformGroup,
    transformSplane,
    DirichletDomainTool,
    GroupTransformTool,
    GroupHandlesTool,
    createSymmetryUndo,
    groupTransformMaps,
    transformFromFrame,
    domainBox,
    groupGeometry,
    makeGroupTables,

    ParamChoice,
    ParamInt,
    ParamBool,
    ParamColor,
    ParamFunc,
    ParamFloat,
    ParamGroup,
    ParamObj,
    ParamUiRow,

    createParamUI,
    getParamValues,
    createInternalWindow,
    createToolPalette,
    createPropertyBar,
    showPopupMenu,
    windowMenuItems,
    createStatsWindow,
    FrameTiming,
    getSquareThumbnailCanvas,
    getImageSaver,
    SymRendererPrograms,
    VisualizationManager,
    createVisualizationLayersWindow,
    createSymmetryWindow,
    createTransformsWindow,
    createTransformHandles,

    getHashParams,
    reorderKeys,
    TestWriter,
    asyncTracker,
    exportImage,
    exportViewZoom,
    createDocumentManager,
    createDocumentStateStore,
    viewStamp,
    fitViewZoom,
    createSymRendererConfig,
    createSymRendererScripting,
}
from "./modules.js";



const MYNAME = 'SymRenderer';
const FILE_FORMAT_RELEASE = 1;
const DEBUG = false;

//const GuiBuilder = ParamGui;
const GuiBuilder = DatGUI;

const PARAM_PREFIX = 'par';

const TMB_WIDTH = 256;
const MS = 0.001; // millisecond
const TOOL_DRAW = 'draw';
const TOOL_MOVE = 'move';
const TOOL_PICK = 'pick';
const TOOL_PATTERN_TRANSFORM = 'patternTransform';
// the symmetry on the canvas: the group maker's handles (the orbifold's edges), the
// Dirichlet domain's base and sides, each set of handles by a toggle of the tool
// (docs/symmetry_tool_plan.md)
const TOOL_SYMMETRY = 'symmetry';
// the editing tools a pattern may provide (pattern.createUITool), e.g. the
// drawing tools of symdraw, are named TOOL_PATTERN_PREFIX + tool.name; with
// the tool palette they show tool.label, tool.key, tool.group, tool.help and
// the settings tool.getProperties() (PropertyBar controls)
const TOOL_PATTERN_PREFIX = 'pattern.';
const TOOL_NAMES = [TOOL_MOVE, TOOL_DRAW, TOOL_PICK, TOOL_PATTERN_TRANSFORM, TOOL_SYMMETRY];
// SymRenderer's own tools as the tool palette shows them (options.toolPalette)
const OWN_TOOLS = {
    [TOOL_MOVE]:              { label: 'Orientation', key: 'H', icon: 'btn_move2.svg',
                                help: 'drag moves the view, the wheel zooms (in every tool the wheel zooms and Space+drag moves the view)' },
    [TOOL_PATTERN_TRANSFORM]: { label: 'Pattern box', key: 'M', icon: 'btn_pattern_transform.svg',
                                help: 'drag moves the box of the pattern, drag near its corners turns and scales it' },
    [TOOL_SYMMETRY]:          { label: 'Symmetry', key: 'Y', icon: 'btn_symmetry.svg',
                                help: 'edits the symmetry on the canvas, each set of handles by its toggle: the group\'s handles ' +
                                      '(drag an edge of the orbifold\'s domain: its length, Shift: its twist); the group transform of ' +
                                      'a Euclidean group (a frame round the fundamental domain: drag its centre: moves the group, a corner: turns and ' +
                                      'scales it about the centre, Shift: turn only, Alt: scale only, Escape: back); the Dirichlet domain ' +
                                      '(drag the yellow disc: the base, D: the base to the pointer, a click on a point, an arc or a ' +
                                      'cell adds or removes its side); a drag elsewhere moves the view; Ctrl+Z, Ctrl+Y: undo, redo ' +
                                      'of the symmetry\'s edits' },
    [TOOL_DRAW]:              { label: 'Draw', icon: 'btn_draw.svg', help: 'paints into the pattern' },
    [TOOL_PICK]:              { label: 'Pick', icon: 'btn_pick.svg', help: 'a click picks the colour under the pointer' },
};
const DEFAULT_PALETTE_TOOLS = [TOOL_MOVE, TOOL_PATTERN_TRANSFORM, TOOL_SYMMETRY];
// the Symmetry tool's sets of handles, each on or off (saved per app in the browser)
// the Dirichlet domain's are off at first: on, they show the base in every document, and
// its settings' switch 'edit' turns them on (2026-11-18)
const SYMMETRY_HANDLES = { group: true, transform: true, dirichlet: false };
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
const NAV_MODE_OPTIONS = [
    { value: 'euclidean',  icon: ICON_NAV_EUCLIDEAN,
      title: 'Euclidean navigation: the canvas pans, zooms (and turns)' },
    { value: 'spherical',  icon: ICON_NAV_SPHERICAL,
      title: 'spherical navigation: drags turn the sphere whose equator is the unit circle' },
    { value: 'hyperbolic', icon: ICON_NAV_HYPERBOLIC,
      title: 'hyperbolic navigation: drags move the hyperbolic plane of the unit disk' },
    { value: 'inversive',  icon: ICON_NAV_INVERSIVE,
      title: 'inversive navigation: Moebius moves about the pole O (drag: O stays, the point follows; ' +
             'wheel: towards the pointer, Shift: turns about the pointer and O)' },
];

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

const LABEL_RUN = 'Run';
const LABEL_STOP = 'Stop';

function resPath(name){    
    const RESFOLDER = 'res/ui/'; // folder with buttons 
    return new URL(RESFOLDER + name, import.meta.url).pathname;
}


const IMG_RUN               = resPath('btn_play.svg');
const IMG_STOP              = resPath('btn_pause.svg');
const IMG_RECORDING_STOP    = resPath('btn_record_stop.svg');
const IMG_RECORDING_START   = resPath('btn_record_start.svg');
const CUR_PATTERN_TRANSFORM = `url(${resPath('cur_pattern_transform.svg')}) 0 0`;
const CUR_MOVE              = `url(${resPath('cur_move3.svg')}) 15 15`;
const CUR_PICK              = `url(${resPath('cur_pick2.svg')}) 1 31`;
const CUR_DRAW              = `url(${resPath('cur_draw2.svg')}) 1 31`;

const LABEL_STOP_RECORDING = "Stop Recording";
const LABEL_START_RECORDING = "Start Recording";

const DEFAULT_DOC_FOLDER_ID = 'symrenderer_doc_folder';

/**
container for single simulation
options.patternCreator - function which creates simulation
 */
function SymRenderer(options) {
    //window.localStorage.clear();
    Object.assign(options, getHashParams());
    if(DEBUG)console.log(`${MYNAME} options: `, options);
    // pointer to myself. 

    // Scripting controller — owns the event bus, ScriptAPI, and script objects.
    // Created immediately so scripts can subscribe before startApplication() fires.
    const mScripting = createSymRendererScripting({
        // Hooks populated lazily (everything below is defined later in the closure)
        // — passed as lambdas so they pick up the live values.
        getParams:        () => getParams(),
        scheduleRepaint:  () => scheduleRepaint(),
        renderFrame:      () => renderFrame(),
        getPattern:       () => mPattern,
        getVisualization: (name) => name ? mVisualization.getLayer(name) : mVisualization,
        getGroup:         () => getGroup(),
        // the view anchor and the uniforms of this frame, for tests (docs/infinite_navigation_plan.md)
        getViewAnchor:    () => ({ anchor: mViewAnchor, navigator: mNavigator, uniforms: { ...mViewAnchor.getUniforms(), ...mViewUniforms } }),
        loadPresetUrl:    (url) => mDocManager.loadPresetUrl(url, null, { script: true }),
        saveToFolder:     (folder, baseName) => mDocManager.writeDocumentToFolder(folder, baseName),
        loadFromFolder:   (folder, fileName) => mDocManager.readParamsFromFolder(folder, fileName),
        getCanvasSize:    () => getCanvasSize(),
        // options {view: 'document'}: the document's frame whole in the canvas
        renderToCanvas:   (w, h, options) => renderToCanvas(w, h, options),
        // the thumbnail a save writes: the document view (docs/document_view_plan.md)
        documentThumbnail: () => makeDocumentThumbnail(),
        setGroupOverride: (g) => setGroupOverride(g),
        getGroupOverride: () => getGroupOverride(),
        // Toolbar injection
        getToolbox:       () => mToolbox,
        resPath:          resPath,
        onToggleRun:      () => onToggleRun(),
        LABEL_RUN:        LABEL_RUN,
        // Animation restart
        getConfig:        () => mConfig,
        getUIParams:      () => mParams,
        // Script list
        scriptUrls:       options.scriptUrls || [],
    });

    const myself = {

        run:           run,
        fullscreen:    onFullScreen,
        toggleGUI:     toggleGUI,
        saveImage:     onSaveImage,
        getParams:     getParams,
        // method of groupMaker 
        getGroup:      getGroup,
        getScriptAPI:  getScriptAPI,
    };
        
    let mDocFolderId = (options.docFolderId)?options.docFolderId: DEFAULT_DOC_FOLDER_ID;
    let mPatternCreator = options.patternCreator;
    let mSamples = options.samples;
    let mPreset = options.preset;
    // (gui, params) => void: an app's own layout of the settings panel in place of
    // createParamUI(gui, params); the params (and so saving, presets, scripts) stay the same
    let mMenuBuilder = options.menuBuilder || null;
    // inline document params from the URL hash: #{"params":{...}}
    let mInlineParams = options.params;
    let mGroupMakerFactory = options.groupMakerFactory;
    let mGroupMaker = null;
    let useSimpleUI = ( options.useSimpleUI);
    let mDataUpgrader = options.dataUpgrader || null;
    // the tools in a palette window of their own, the active tool's settings in
    // a property bar: options.toolPalette = { tools: SymRenderer's own tools in
    // the palette (TOOL_NAMES; the pattern's tools follow), startTool }
    // (true: the defaults); the toolbox then keeps the commands
    let mPaletteOptions = (options.toolPalette && !useSimpleUI)
        ? (options.toolPalette === true ? {} : options.toolPalette) : null;
    // the visualization layers in a window of their own (list and settings),
    // not in the settings panel: options.visualizationWindow
    // (VisualizationLayersWindow.js), for a visualization that tells its
    // changes (VisualizationManager.addListener)
    const mVisWindowAsked = !!(options.visualizationWindow && !useSimpleUI);
    // the symmetry in a window of its own, the Symmetry tool's panel, not in
    // the settings panel: options.symmetryWindow (SymmetryWindow.js)
    const mSymWindowAsked = !!(options.symmetryWindow && !useSimpleUI);
    // the navigator's list of conformal transformations in a window of its own (the
    // list and the selected row's settings), not in the settings panel:
    // options.transformsWindow (TransformsWindow.js), for a navigator that has the list
    const mTransformsWindowAsked = !!(options.transformsWindow && !useSimpleUI);

    // Persistent renderer configuration (localStorage, editable via UI)
    const mRendererConfig = createSymRendererConfig({
        storageKey: mDocFolderId + '_config',
    });
    
    if(mGroupMakerFactory)
        mGroupMaker = mGroupMakerFactory.getDefaultObject();
    else 
        mGroupMaker = options.groupMaker;

    let mParamsOrder = null;
        
    if(!mGroupMaker){
        console.error('mGroupMaker is undefined');
        return {};
    }
    mGroupMaker.setOptions({onChanged:onGroupChanged});

    // the table of subgroups of the group drawn, for the colour layers, the overlay
    // items and scripts: it follows the presentation of whichever maker is in use
    const mGroupTables = makeGroupTables({
        getPresentation: getGroupPresentation,
        onChanged:       onPresentationChanged,
    });
        
    if (DEBUG)console.log(`${MYNAME} (simulation: ${mPatternCreator.getName()})`);

    // Document lifecycle is handled by SymDocumentManager.
    // mDocManager is declared here so readParamText (which stays in SymRenderer)
    // can call mDocManager.setDocumentData after parsing JSON.
    let mDocManager = null;

    // parameters of visualization
    let miscConfig = {

        //interpolation: INTERP_QUADRATIC,
        plotType: 0,
        dataSlice: 0.5,
        
        options: {
            showGrid:    false,//true,
            showRuler:   false,//true,
            showChecker: false,
            useMipmap:   false,
        },
        
    };

    let symConfig = {
        groupType:  (mGroupMakerFactory)?mGroupMakerFactory.getDefaultName():'', 
        transform: {
            translationX: 0,
            translationY: 0,
            rotation: 0, // rotation (degree)
            scale: 1,
        },
        // the symmetry is switched per visualization layer (useSymmetry), 2026-11-09
        options: {
            symIterations: 10,
        }

    };

    let displayConfig = {

        canvasSize: CanvasSize.getNames()[0],
        customWidth: 1000,
        customHeight: 1000,
        sizeMultiplier: 1,
        backgroundColor: '#FFFFFF00',

    };

    let recorderConfig = {
        animTime: 0,
        animSpeed: 1, 
        startFrame: 0,
        endFrame: 100,
        currentFrame: 0,
    };

    let mConfig = {
        
        simulationRunning: false,

        display: displayConfig,
        misc:    miscConfig,

        recording: recorderConfig,
        symmetry: symConfig,

        patternTransConfig: {
            centerX: -0.,
            centerY: -0.,
            scale: 0.5,
            angle: 0,
            pivotX:0,
            pivotY:0,
            // the bend of the pose of the pattern box (PatternPose.js): 0 a similarity
            bendX: 0,
            bendY: 0,
            // the pattern transform tool moves in the geometry of the group (when the pattern can bend)
            geometric: true,
        },
        tools: {
            toolName: (mPaletteOptions && mPaletteOptions.startTool) || TOOL_MOVE,
        },
    };




    // repaint flag
    let mNeedRepaint = false;
    let mTiming = null;             // FrameTiming, made when the timing window is first opened
    let mTimingWindow = null;       // the 'timing' StatsWindow
    let mTimingContinuous = false;  // render every animation frame while the timing window is open
    let mBenchTiming = null;        // FrameTiming of the last benchmark (means of frames rendered back to back)
    let mActiveTiming = null;       // the FrameTiming the sections of renderFrame() report to
    let mIsExporting = false;
    // an image export leaves out the editing overlay (handles, the pattern box,
    // the Dirichlet marks) unless the export dialog's 'Handles and marks' asks
    // for them, nor does a document's thumbnail (makeThumbnail); renderToCanvas
    // keeps it, the overlay tests read it
    let mHideEditing = false;
    
    const mCanvas = createCanvas({useInternalWindow: !useSimpleUI});
    
    
    let mDataPlot = null;
    
    // toolbox with buttons
    let mToolbox = null;
    // with options.toolPalette: the tools' palette and the active tool's settings
    let mToolPalette = null;
    let mPropertyBar = null;
    // the orientation tool's fields read again after a change of the view, at most every NAV_REFRESH_MS
    const NAV_REFRESH_MS = 100;
    let mNavRefreshTimer = 0;
    let mToolUI = null;             // the pattern's parts of the palette's UI: {refresh(), windows: [{label, title, window}]}
    let mVisLayersWindow = null;    // options.visualizationWindow: the layers and their settings
    let mSymWindow = null;          // options.symmetryWindow: the symmetry params
    let mTransformsWindow = null;   // options.transformsWindow: the conformal transformations
    let mTransformHandles = null;   // the selected transformation's handles on the canvas (TransformHandles.js)
    let mSymPanelParams = null;     // the symmetry param's params, the window's panel
    let mToolboxCommands = [];      // the pattern's toolbox buttons: [{cmd, btn}]

    // recorder of video 
    const mRecorder = createVideoRecorder3({});
    //
    // UI root 
    let mGUI = null;
    let mImageSaver = getImageSaver('image_export');
    let mTestWriter = TestWriter({
        renderFrame,
        makeThumbnail,
        readParamText,
        getParamsAsJSON,
        loadFromFolder:    (srcFolder, fileName) => mDocManager.readParamsFromFolder(srcFolder, fileName),
        saveToFolder:      (outFolder, baseName)  => mDocManager.writeDocumentToFolder(outFolder, baseName),
        waitForIdle:       (quietFrames) => asyncTracker.waitForIdle(quietFrames),
        displayConfig:     displayConfig,
        applyCanvasSize:   () => onCanvasSize(),
    });
    // we want to preserve previous drawing buffer
    let mGLCtx = getWebGLContext(mCanvas.glCanvas, {
        preserveDrawingBuffer: true
    });
    let mOverlayCtx = mCanvas.overlay.getContext('2d');

    //initBuffers();

    // maps world onto canvas pixels
    let mCanvasTransform = CanvasTransform({
        canvas: mCanvas.overlay
    });

    // maps simulation box into world
    const ptc = mConfig.patternTransConfig;
    let mPatternTransform = new TransformMotion2D({
        center: [ptc.centerX, ptc.centerY],
        scale: ptc.scale,
        angle: ptc.angle * TORADIANS,
        bend: poseBend(ptc),
    });

    mCanvasTransform.addEventListener('transformChanged', onTransformChanged);

    let mNavigator = (options.navigator) ? (options.navigator): (new PlaneNavigator(mCanvasTransform));
    if(DEBUG)console.log(`${MYNAME} navigator: `, mNavigator);
    mNavigator.init({canvas: mCanvas.overlay,
                     onChanged: onTransformChanged,
                     canvasTransform: mCanvasTransform,
                     groupMaker: myself,
                     useAnimatedPointer: true,
                     onDocumentViewSet: onDocumentViewSet,
                     });
    // with its own window (options.transformsWindow) the list of conformal
    // transformations has no UI in the settings panel: a param keeps one control,
    // the window's
    if (transformsWindowOn()) mNavigator.getParams().projection.createUI = () => {};

    // the document's frame on the canvas: its toggle kept per app in the browser
    // (docs/document_view_plan.md 3.7)
    const DOC_FRAME_KEY = mDocFolderId + '_document_frame';
    if (mNavigator.setFrameShown) {
        let shown = false;
        try { shown = window.localStorage.getItem(DOC_FRAME_KEY) === '1'; } catch (e) { /* no storage */ }
        // no change told: the renderer's listeners are not set up yet
        mNavigator.setFrameShown(shown, false);
    }

    let mDrawingToolRenderer = DrawingToolRenderer({
        gl: mGLCtx.gl
    }); // drawing tool renderer

    let mDrawingToolHandler; //  drawing evens handler
    let mPatternTransformHandler = null; // pattern transform events handler
    let mPatternTransformRenderer = null; // pattern transform renderer
    let activeTool = null; // currently active tool for UI rendering
    // the active tool's overlay drawn by the GPU through the view's chain, when the tool gives its geometry
    const mEditingOverlay = EditingOverlay();
    // the element of the group folding the view's centre into F: the shaders fold from
    // there, so the iterations never run out however far the view goes
    // (ViewAnchor.js, docs/infinite_navigation_plan.md)
    const mViewAnchor = makeViewAnchor();
    let mViewUniforms = { uAnchorView: false, uAnchorBand: false };   // its step 1b (updateViewAnchor)
    let mAnchorFrames = 0;                        // frames drawn on while the anchor is pending
    const MAX_ANCHOR_FRAMES = 3000;

    // optional interactive tool provided by the group maker
    // (e.g. Group_Orbifold: dragging fundamental domain edges on the image)
    let mGroupUITool = null;
    // When set, this group is used instead of the group maker's own.  Batch /
    // scripted rendering uses it to draw a subgroup (its fundamental domain,
    // tiling and pairing transforms) without disturbing the maker or the UI
    // (nor its handles, which are off then: groupHandlesShown).
    let mGroupOverride = null;
    // optional editing tools provided by the pattern, made in startApplication()
    let mPatternTools = [];

    function getToolNames() {
        return [...TOOL_NAMES, ...mPatternTools.map(t => TOOL_PATTERN_PREFIX + t.name)];
    }

    function getPatternTool(toolName) {
        if (!toolName || !toolName.startsWith(TOOL_PATTERN_PREFIX)) return null;
        return mPatternTools.find(t => TOOL_PATTERN_PREFIX + t.name === toolName) || null;
    }

    // the pointer's last place on the canvas, in canvas pixels (null before it came):
    // the seed of the view's map from the world to the canvas, which under the conformal
    // transformations has a place on every copy of the picture (mView.toCanvas, shownAt)
    let mPointerAt = null;

    //
    //  the map between canvas pixels and the world points they show, through
    //  the navigator (its Moebius transform and projections) when it can,
    //  else through the canvas transform alone
    //
    const mView = {
        toWorld: (cpnt) => mNavigator.screenToWorld
            ? mNavigator.screenToWorld(cpnt)
            : { pnt: mCanvasTransform.invTransform(cpnt, [0, 0]), exact: true },
        // the canvas pixel of a world point, always one. Under the conformal transformations
        // a world point shows on every copy of the picture: the place is the one on the
        // sheet of the seed, a canvas pixel (the pointer's last place without one, the
        // canvas centre before the pointer came), so a pixel's step from it (a nudge) and
        // the scale there are those of the copy the user works at
        toCanvas: (wpnt, seed) => mNavigator.worldToScreen
            ? mNavigator.worldToScreen(wpnt, seed || mPointerAt || undefined)
            : mCanvasTransform.transform(wpnt, [0, 0]),
        // the canvas pixel where the picture shows the world point, null when it shows it
        // nowhere (the back of the sphere, a point the transformations leave out): the place
        // of a label. The seed as for toCanvas
        shownAt: (wpnt, seed) => mNavigator.whereShown
            ? mNavigator.whereShown(wpnt, seed || mPointerAt || undefined)
            : mView.toCanvas(wpnt, seed),
        isLinear: () => mNavigator.isLinearView ? mNavigator.isLinearView() : true,
        // the canvas in pixels: [width, height]
        canvasSize: () => { const s = getCanvasSize(); return [s.width, s.height]; },
        // the page's CSS pixels to a canvas pixel (the canvas is drawn at its own size, then shown at its CSS size)
        cssPixelScale: () => {
            const c = mCanvas.glCanvas;
            return (c && c.width > 0 && c.clientWidth > 0) ? c.clientWidth/c.width : NaN;
        },
        // the world rectangle the canvas shows, [x0, y0, x1, y1] (the canvas transform's;
        // the drawing editor's fit to the view)
        // (on a turned canvas the box of the canvas's proportions all on it)
        visible: () => mCanvasTransform.getVisibleBox(),
        // world units per canvas pixel at the canvas pixel cpnt, through the view's chain of maps
        scaleAt: (cpnt) => mNavigator.screenScale ? mNavigator.screenScale(cpnt) : mView.pixelSize(),
        // world units per canvas pixel at the canvas centre (the canvas transform's scale)
        pixelSize: () => {
            const a = mCanvasTransform.invTransform([0, 0], [0, 0]);
            const b = mCanvasTransform.invTransform([1, 0], [0, 0]);
            return Math.hypot(b[0] - a[0], b[1] - a[1]);
        },
    };
    // stable proxy so mActiveTools stays valid when the group maker is replaced
    const mGroupUIToolProxy = {
        handleEvent: (e) => {
            if (mGroupUITool) mGroupUITool.handleEvent(e);
        },
        handleKey: (e) => {
            if (mGroupUITool && mGroupUITool.handleKey) mGroupUITool.handleKey(e);
        },
    };

    // the working view of each document the user opens, kept in the browser
    // (docs/document_view_plan.md 3.3); none on a page a script runs (scriptUrl:
    // tests, catalogue jobs), whose pictures must not depend on what was kept
    const mViewStore = options.scriptUrl ? null
        : createDocumentStateStore({ storageKey: mDocFolderId + '_working_views', cap: 100 });
    // the stamp (viewStamp) of the document view in the current document's file,
    // as loaded or last saved
    let mFileStamp = null;

    // the Symmetry tool's sets of handles that are on (SYMMETRY_HANDLES): kept per app in
    // the browser's storage, not in documents
    const SYMMETRY_HANDLES_KEY = mDocFolderId + '_symmetry_handles';
    const mSymHandles = loadSymmetryHandles();

    function loadSymmetryHandles() {
        const handles = { ...SYMMETRY_HANDLES };
        try {
            const saved = JSON.parse(window.localStorage.getItem(SYMMETRY_HANDLES_KEY) || '{}');
            for (const key of Object.keys(handles)) {
                if (typeof saved[key] === 'boolean') handles[key] = saved[key];
            }
        } catch (e) { /* no storage */ }
        return handles;
    }

    // a toggle of the Symmetry tool was changed (the bar, the symmetry folder without one,
    // the switch 'edit' of the Dirichlet domain)
    function onSymmetryHandlesChanged() {
        try { window.localStorage.setItem(SYMMETRY_HANDLES_KEY, JSON.stringify(mSymHandles)); } catch (e) { /* no storage */ }
        if (mConfig.tools.toolName === TOOL_SYMMETRY) {
            routeSymmetryTool();
            if (mPropertyBar) mPropertyBar.refresh();
        }
        scheduleRepaint();
    }

    // the Dirichlet domain on the canvas to edit, or not (its switch 'edit', the tool bar's
    // toggle; both through the tool's requestEdit): on takes up the Symmetry tool with the Dirichlet handles and opens the
    // domain's settings; off turns the handles off, the tool stays
    function setDirichletEditing(on) {
        mSymHandles.dirichlet = !!on;
        if (on && mConfig.tools.toolName !== TOOL_SYMMETRY) setTool(TOOL_SYMMETRY);
        onSymmetryHandlesChanged();
        if (on) mDirichlet.getParams().open();
    }

    // the Symmetry tool's events go to its sets of handles that are on: the Dirichlet
    // domain's first (the base disc; its clicks on the canvas are the fallback, a click
    // whose press another tool took is that tool's), the group transform's frame (a
    // Euclidean group's: transformFrameOn; before the group's edges, which often run
    // through its centre), the group's, then the view
    function routeSymmetryTool() {
        const transformOn = transformFrameOn();
        mDirichlet.setActive(mSymHandles.dirichlet);
        mGroupTransformTool.setActive(transformOn);
        if (mGroupUITool && mGroupUITool.setActive) mGroupUITool.setActive(mSymHandles.group && !mGroupOverride);
        mActiveTools = [mSymHandles.dirichlet ? mDirichlet : null,
                        transformOn ? mGroupTransformTool : null,
                        mSymHandles.group ? mGroupUIToolProxy : null,
                        mNavigator].filter(Boolean);
    }

    // the group maker's handles are on the canvas: the Symmetry tool, its toggle on, the
    // maker's group the one drawn (not a group override: a script's subgroup)
    function groupHandlesShown() {
        return !!mGroupUITool && mConfig.tools.toolName === TOOL_SYMMETRY && mSymHandles.group && !mGroupOverride;
    }

    // the group maker's tool works in the maker's coordinates; the group transform g
    // carries them to the world the canvas shows (docs/symmetry_tool_plan.md section 5.1):
    // toWorld, fromWorld (g and its inverse on points), toWorldSplane (g on splanes, an
    // arc's ends with it), and the view (mView: toWorld, toCanvas, scaleAt)
    //  A maker without a tool of its own may list its handles (getHandles, the kinds in
    //  lib/grouplib/GroupHandles.js): GroupHandlesTool runs them, in the true world as the
    //  frame of the group transform
    function updateGroupUITool() {
        if (mGroupUITool && mGroupUITool.setActive) mGroupUITool.setActive(false);
        const toWorld = (p) => groupTransformMaps(mConfig.symmetry.transform).toWorld(p);
        const fromWorld = (w) => groupTransformMaps(mConfig.symmetry.transform).fromWorld(w);
        if (mGroupMaker && mGroupMaker.createUITool) {
            mGroupUITool = mGroupMaker.createUITool({
                navigator: mNavigator,
                canvas: mCanvas.overlay,
                repaint: scheduleRepaint,
                toWorld,
                fromWorld,
                toWorldSplane: (sp) => transformSplane(sp, groupTransformParams()),
                view: mView,
            });
        } else if (mGroupMaker && mGroupMaker.getHandles) {
            const maker = mGroupMaker;
            mGroupUITool = GroupHandlesTool({
                getHandles: () => maker.getHandles(),
                toWorld,
                fromWorld,
                view: {
                    toWorld: (c) => mView.toWorld(c).pnt,
                    toCanvas: (w, seed) => mView.toCanvas(w, seed),
                    // the labels' places: where the picture shows the point, on the copy
                    // at the pointer under the conformal transformations; null where it
                    // shows it nowhere (the label is left out)
                    shownAt: (w) => mView.shownAt(w),
                    scaleAt: (c) => mView.scaleAt(c),
                },
                inReach: () => !mNavigator.toolsInTrueWorld || mNavigator.toolsInTrueWorld(),
                canvas: mCanvas.overlay,
                repaint: scheduleRepaint,
            });
        } else {
            mGroupUITool = null;
        }
        if (mGroupUITool && mGroupUITool.setActive) mGroupUITool.setActive(groupHandlesShown());
        // the Symmetry tool's bar shows the group's toggle when there are handles
        if (mPropertyBar && mConfig.tools.toolName === TOOL_SYMMETRY) mPropertyBar.refresh();
    }
    updateGroupUITool();

    // the undo steps of the symmetry's edits (SymmetryUndo.js): one per gesture, on the
    // page's undo stack where it has one (symdraw: the drawing's), else on a stack of their
    // own; the symmetry param is watched once it is made (getParams). An undo or a redo
    // keeps the Dirichlet sides it sets: no search follows the group it brings back
    const mSymUndo = createSymmetryUndo({
        page:        () => mPattern,
        beforeApply: () => mDirichlet.holdSides(),
        onApplied:   () => { refreshToolUI(); scheduleRepaint(); },
    });

    // the Dirichlet domain of the group as an operation on it (applied after the group
    // transform), with the choice of its sides on the canvas; its params are in the
    // symmetry folder (lib/symhublib/DirichletDomainTool.js)
    const mDirichlet = DirichletDomainTool({
        navigator: mNavigator,
        canvas: mCanvas.overlay,
        repaint: scheduleRepaint,
        onChanged: onGroupChanged,
        history: mSymUndo.history,
        onEdit: setDirichletEditing,
    });

    // the maker's group (before the group transform and the Dirichlet domain) and the box
    // of its fundamental domain, the frame of the transform's handles; the box is kept
    // while the domain's sides stay (the maker gives a new group at every preparation),
    // its version counts its changes
    let mMakerGroup = null;
    const mMakerDomainBox = { key: null, box: null, version: 0 };
    function makerDomainBox() {
        const g = mMakerGroup;
        let fd = null;
        try { fd = (g && g.getFundDomain) ? g.getFundDomain() : null; } catch (e) { fd = null; }
        const key = fd ? fd.map(sp => (sp && sp.v) ? sp.type + ':' + Array.from(sp.v).join(',') : '').join(';') : '';
        if (key !== mMakerDomainBox.key) {
            mMakerDomainBox.key = key;
            let box = null;
            try { box = fd ? domainBox(fd) : null; } catch (e) { box = null; }
            if (String(box) !== String(mMakerDomainBox.box)) mMakerDomainBox.version++;
            mMakerDomainBox.box = box;
        }
        return mMakerDomainBox.box;
    }

    // the frame is for the groups of the Euclidean plane only (docs/symmetry_tool_plan.md
    // section 16): a similarity is no isometry of the hyperbolic plane or the sphere, and
    // moves a Kleinian group's limit set as a whole; their transform stays in the
    // symmetry panel's row. Read off the maker's group once per group
    // (GroupGeometry.js groupGeometry); a group of no sides (the trivial one) is the plane's
    const mMakerGeometry = { group: undefined, euclidean: true };
    function makerGroupEuclidean() {
        const g = mMakerGroup;
        if (g !== mMakerGeometry.group) {
            mMakerGeometry.group = g;
            let euclidean = true;
            try {
                const fd = (g && g.getFundDomain) ? g.getFundDomain() : null;
                if (fd && fd.length) euclidean = groupGeometry(g).kind === 'euclidean';
            } catch (e) { euclidean = false; }
            mMakerGeometry.euclidean = euclidean;
        }
        return mMakerGeometry.euclidean;
    }

    // the transform's frame is on the canvas, in the Symmetry tool: its toggle, a Euclidean group
    function transformFrameOn() {
        return mSymHandles.transform && makerGroupEuclidean();
    }

    // the group transform's frame on the canvas, the Symmetry tool's transform handles: a
    // box round the maker's fundamental domain carried by the transform; its centre moves
    // the group, its corners turn and scale it about the centre (GroupTransformTool.js). It
    // edits the true world, the group's: it shows and takes presses while the tools work
    // there (not in the anchored world of a view off home,
    // InversiveNavigator.toolsInTrueWorld), and a drag keeps the frame of its press
    const mGroupTransformTool = GroupTransformTool({
        config: mConfig.symmetry.transform,
        view: {
            toWorld: (c) => mView.toWorld(c).pnt,
            toCanvas: (w) => mView.toCanvas(w),
            scaleAt: (c) => mView.scaleAt(c),
        },
        domainBox: makerDomainBox,
        inReach: () => !mNavigator.toolsInTrueWorld || mNavigator.toolsInTrueWorld(),
        canvas: mCanvas.overlay,
        repaint: scheduleRepaint,
        onChanged: onGroupTransformEdited,
    });

    let mActiveTools = [mNavigator]; // sequence of active event-handling tools (setTool)

    let mGroup = mGroupMaker.getGroup(); // the current group
    mMakerGroup = mGroup;
    let mGroupChanged = false;
    
    
    // create texture to store group data
    let mPackedGroupData = DataPacking.createGroupDataSampler(mGLCtx.gl);
    DataPacking.packGroupToSampler(mGLCtx.gl, mPackedGroupData, mGroup);

    let mTransGroup = mGroup;//.clone(); // group transformed into texture space
    
    // data of the transformed group to use inside of simulation buffer
    let mTransGroupData = DataPacking.createGroupDataSampler(mGLCtx.gl);

    DataPacking.packGroupToSampler(mGLCtx.gl, mTransGroupData, mTransGroup);

    addEventListeners(mCanvas.overlay);

    //let mTextureMaker = null;  // 
    
    //let mMipmapBuffer = null;  // buffer used for off-screen rendering 
    
    // the simulation object
    let mPattern = null;
    // true when animation play/restart buttons should be shown in the toolbox.
    // Set in startApplication() based on pattern capabilities and scripting options.
    let mCanAnimate = false;
    // visualization renderer object
    let mVisualization =  (options.visualization) ? (options.visualization): VisualizationManager(); 
    
    //
    // set of parameters usef for UI display and for state saving
    //
    let mParams = null;
    let mGUIWindow = null;
    let mPrograms = SymRendererPrograms();
    let mStartTime = 0;
    let mTimeStamp = 0;
    // 
    const mAppInfo = {
        appName: (options.appName) ? options.appName : makeAppName(),
        fileFormatRelease: FILE_FORMAT_RELEASE,
    }

    function makeAppName(){
        
        if(DEBUG)console.log(`${MYNAME}.makeAppName() mGroupMaker: `, mGroupMaker);
        
        return [MYNAME,mGroupMaker.getClassName(),mPatternCreator.getClassName(), mNavigator.getClassName()].join('.');
    }

    function run() {

        mPrograms.init(mGLCtx.gl);
        startApplication();

    }

    //
    //  the pattern's names for the images lists of the visualization layers
    //  (ParamImageList's chips), null for a pattern that has none: its tree of
    //  names, its selection, and listeners told when the names changed (looked
    //  at once after the changes of the pattern that came together)
    //
    function makeComponentSource(pattern) {
        if (!pattern.getComponentTree) return null;
        const listeners = new Set();
        let key = null;
        let queued = false;
        const check = () => {
            queued = false;
            const now = JSON.stringify(pattern.getComponentTree());
            if (now === key) return;
            key = now;
            for (const fn of listeners) fn();
        };
        pattern.addEventListener('imageChanged', () => {
            if (queued || !listeners.size) return;
            queued = true;
            queueMicrotask(check);
        });
        return {
            getTree:        () => pattern.getComponentTree(),
            getSelectedIds: () => (pattern.getSelectedIds ? pattern.getSelectedIds() : []),
            addListener:    (fn) => { listeners.add(fn); },
            removeListener: (fn) => { listeners.delete(fn); },
        };
    }

    function startApplication() {

        mDataPlot = createDataPlot({
            repainter: scheduleRepaint,
            left: 17.5,
            bottom: 0,
            width: 65,
            height: 20,
            plotName: 'simulation data',
            floating: true,
            storageId: 'bufferData',
        });

        mPattern = mPatternCreator.create();
        mPattern.init(mGLCtx);
        mEditingOverlay.init(mGLCtx);
        mVisualization.init({glCtx: mGLCtx, onChange:scheduleRepaint, groupTables: mGroupTables,
                             components: makeComponentSource(mPattern)});
        if (DEBUG)
            console.log(`${MYNAME} mPattern: ${mPattern.getName()}`);
        mPattern.addEventListener('imageChanged', onSimulationChanged);
        mPattern.addEventListener('componentRenamed', (e) => { if (mVisualization.renameComponent) mVisualization.renameComponent(e.from, e.to); });
        // the pattern's own editing tools (one or a list) get toolbox buttons,
        // the pointer events with world and pattern points, the keys and the
        // 2D overlay
        if (mPattern.createUITool) {
            const tools = mPattern.createUITool({
                canvas:           mCanvas.overlay,
                canvasTransform:  mCanvasTransform,
                patternTransform: mPatternTransform,
                view:             mView,
                repaint:          scheduleRepaint,
                getGroup:         getGroup,
                // the values of the tools' settings changed (getProperties)
                propertiesChanged: () => refreshToolUI(),
                // takes up one of these tools
                setTool:          (name) => setTool(TOOL_PATTERN_PREFIX + name),
                // the tools' settings go to a property bar, not the panel
                toolPalette:      !!mPaletteOptions,
            });
            mPatternTools = [].concat(tools || []).filter(Boolean);
        }

        //mTextureMaker = new TextureFile({
        //    texInfo: Textures.t1.concat(Textures.t2).concat(Textures.experimental),
        //    gl: mGLCtx.gl,
        //    onChanged: onTextureChanged
        //});

        const MIPMAP_SIZE = 512;
        const gl = mGLCtx.gl;
        //mMipmapBuffer = createFBO(gl, MIPMAP_SIZE, MIPMAP_SIZE, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,  gl.LINEAR_MIPMAP_LINEAR);
                                  //(gl, w, h, internalFormat, format, type, filtering) 
        
        // Determine once whether animation UI (Run/Restart buttons) should be shown.
        mCanAnimate = !!(mPattern.canAnimate || mPattern.doStep
                         || options.scriptUrl
                         || options.scriptUrls?.length > 0);

        initGUI();
        mToolbox = makeToolbox({useInternalWindow:!useSimpleUI});
        if (mPaletteOptions) makeToolPalette();
        if (visWindowOn()) makeVisualizationWindow();
        if (mSymWindowAsked) makeSymmetryWindow();
        if (transformsWindowOn()) makeTransformsWindow();
        setTool(mConfig.tools.toolName);
        if(useSimpleUI)
            mCanvas.container.appendChild(mToolbox.container);
        //toggleGUI();
        mPattern.setGroup(mGroup);
        onCanvasSize();
        mDrawingToolRenderer.init({
            simulation: mPattern,
            repainter: {
                scheduleRepaint: scheduleRepaint
            }
        });
        mCanvas.container.addEventListener("fullscreenchange", onFullScreenChange);
        if(mSamples){
            // Note: mDocManager.init() calls onShowSamples() and addItems internally
        }

        // Build the document manager â€” inject all SymRenderer callbacks
        mDocManager = createDocumentManager({
            appInfo:          mAppInfo,
            params:           mParams,
            rendererConfig:   mRendererConfig,
            groupMakerFactory: mGroupMakerFactory,
            docFolderId:      mDocFolderId,
            samples:          mSamples,
            dataUpgrader:     mDataUpgrader,
            getThumbMaker:    getThumbMaker,
            setTool:          (toolName) => setTool(toolName),
            getToolName:      () => mConfig.tools.toolName,
            setTitle:         (title) => { if(mCanvas.intWin) mCanvas.intWin.setTitle(title); },
            getNewDocName:    getNewDocumentName,
            onLoadDocumentText: readParamText,
            onDocumentLeaving: storeWorkingView,
            onDocumentLoaded: onDocumentLoaded,
            onDocumentSaved:  onDocumentSaved,
        });
        // the working view kept when the page is hidden or closed
        if (mViewStore) {
            window.addEventListener('pagehide', () => storeWorkingView(mDocManager.getDocumentKey()));
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') storeWorkingView(mDocManager.getDocumentKey());
            });
        }
        mDocManager.init();
        // the tool panels start above the samples and the files
        toolWindowEntries().forEach(e => e.window?.raise());

        let mCurrentDocument = mDocManager.createInitialDocument();
        mCurrentDocument.setName(getNewDocumentName());
        // the view of the start is the document view until a document comes
        onDocumentLoaded();
        // hash may carry a preset, inline params, or a preset + overrides
        if(mPreset) mDocManager.loadPresetUrl(mPreset, mInlineParams);
        else if(mInlineParams) mDocManager.loadInlineParams(mInlineParams);
        
        if(useSimpleUI){
            mDocManager.getSamplesSelector()?.setVisible(false);
            if (mGUIWindow) mGUIWindow.setVisible(false);
            updateToolbarSettingsBtnUI();
        }
        
        mStartTime = Date.now();
        // time of application from start
        mTimeStamp = 0.;
        
        // start animation loop
        startAnimationLoop();

        // Auto-load an external script if a scriptUrl was provided in options.
        if (options.scriptUrl) {
            mScripting.loadScriptUrl(options.scriptUrl);
        }
    }

    //
    //    creates layered canvas for GL rendering and 2D rendering
    //
    function createCanvas(args={}){
        
        let canvasContainer = document.createElement('div');
        canvasContainer.id = 'canvasContainer';
        let glCanvas = document.createElement('canvas');
        glCanvas.className = 'layeredCanvas';
        let overlay = document.createElement('canvas');
        overlay.className = 'layeredCanvas';
        canvasContainer.appendChild(glCanvas);
        canvasContainer.appendChild(overlay);
       // document.body.appendChild(canvasContainer);
                        
        let btnWidth = 40;
        let btnCount = 9;
        let extra = 22;
        let titleHeight = 22;
        let intWin = null;
        if(args.useInternalWindow){
        // floating window
            intWin = createInternalWindow({
                                        width: '75%', 
                                        height: '75%',
                                        left: '1px', 
                                        top:  '1px',
                                        title: 'visualization',
                                        background: true,
                                        canResize: true,
                                        storageId: 'visualization',
                                        onResize: onResize,
                                        });  
            let interior = intWin.interior;
        
            interior.style.overflowY = "auto";
            interior.style.overflowX = "auto";
            //interior.style.width = 'max-content';
            //interior.style.height = 'max-content';
        
            interior.appendChild(canvasContainer);
        } else {
            document.body.appendChild(canvasContainer);
        }            
                        
        return {
            intWin: intWin, 
            container: canvasContainer,
            glCanvas:  glCanvas,
            overlay:   overlay,            
        };
    }

    function resizeCanvases() {
        if (mIsExporting) return;

        let scale = mConfig.display.sizeMultiplier;
        //console.log('resizeCanvases():', mCanvas.glCanvas.width);
        resizeCanvas(mCanvas.glCanvas, scale);
        resizeCanvas(mCanvas.overlay, scale);

        //console.log(`mCanvas.glCanvas: [${mCanvas.glCanvas.width} x ${mCanvas.glCanvas.height}]`);

    }

    function makeParams() {

        const params = {

            files:          makeFilesParams(),
            display:        makeDisplayParams(),
            recording:      makeRecordingParams(mConfig.recording),
            pattern:        makePatternParams(),
            visualization:  visualizationParam(),
            misc:           makeMiscParams(),
            symmetry:       symmetryParam(),
            tools:          makeToolsParams(),
            scripting:      ParamObj({name: 'scripting', obj: mScripting}),
            test:           ParamObj({name: 'test', obj: mTestWriter, serializable: false}),
        };
        
        if (mParamsOrder){
            return reorderKeys(params, mParamsOrder);
        } else {
            return params;
        }
    } // function makeParams;

    // the visualization's param; with its own window (options.visualizationWindow)
    // it has no UI in the panel: a param keeps one control, the window's
    function visualizationParam(){
        const param = ParamObj({name: 'visualization', obj: mVisualization});
        return visWindowOn() ? { ...param, createUI: () => {} } : param;
    }

    // the symmetry's param; with its own window (options.symmetryWindow) it has
    // no UI in the panel: a param keeps one control, the window's
    function symmetryParam(){
        const param = makeSymParams();
        return mSymWindowAsked ? { ...param, createUI: () => {} } : param;
    }

    function makePatternParams(){
        return ParamGroup({
            name: 'pattern',
            params: {
                patternParams:  ParamObj({name: 'pattern params', obj: mPattern}),
                patternTransform:  makePatternTransformParams(),   
            }
        });        
    }
    //
    //
    //
    function makeFilesParams() {

        return ParamGroup({
            name: 'files',
            params: {
                globalOptions:  ParamFunc({func: () => mRendererConfig.toggleUI(), name: 'Global Options...'}),
                showSamples:    ParamFunc({func: () => mDocManager.onShowSamples(), name: 'Samples...'}),
                showDocuments:  ParamFunc({func: () => mDocManager.onShowDocuments(), name: 'Files...'}),
                save:           ParamFunc({func: () => mDocManager.onSaveDocument(), name: 'Save' }),
                saveNew:        ParamFunc({func: () => mDocManager.onSaveNewDocument(), name: 'Save New...'}),
                saveAs:         ParamFunc({func: () => mDocManager.onSaveDocumentAs(), name: 'Save As...'}),
                saveImage:      ParamFunc({func: onSaveImage, name: 'Export Image...'}),
            }
        });
    }

    //
    //
    //
    function makeRecordingParams(cfg) {
        
        let onc = scheduleRepaint;
        return ParamGroup({
            name: 'recording',
            params: {
                animTime: ParamFloat({obj:cfg, key:'animTime', onChange:onc}),
                animSpeed: ParamFloat({obj:cfg, key:'animSpeed', onChange:onc}),
                startFrame: ParamInt({obj: cfg,key: 'startFrame', min: 0, max: 100000, name: 'start Frame'}),
                endFrame:       ParamInt({obj: cfg,key: 'endFrame',min: 0,max: 100000,name: 'End Frame'}),
                currentFrame:   ParamInt({obj: cfg,key: 'currentFrame', name: 'frame'}),
                toggleRecording: ParamFunc({func: onToggleRecording,name: LABEL_START_RECORDING}),
            }

        });
    } // function makeRecordingParams()


    //
    //
    //
    function makePatternTransformParams() {

        let onc = onPatternTransformChanged;
        let onPivotChanged = onPatternPivotChanged;
        let conf = mConfig.patternTransConfig;
        const inc = 0.00001;
        return ParamGroup({
            name: 'pattern transform',
            params: {
                centerX: ParamFloat({obj:conf, key: 'centerX', min: -10, max: 10, step: inc, name: 'center X', onChange: onc}),
                centerY: ParamFloat({obj:conf, key: 'centerY', min: -10, max: 10, step: inc, name: 'center Y', onChange: onc}),
                scale:   ParamFloat({obj:conf, key: 'scale',  min: 0.0001, max: 100, step: inc, name: 'scale', onChange: onc}),
                angle:   ParamFloat({obj:conf, key: 'angle', min: -360, max: 360, step: inc, name: 'angle(deg)', onChange: onc}),
                pivotX:  ParamFloat({obj:conf, key: 'pivotX', step: inc, name: 'pivot X', onChange: onPivotChanged}),
                pivotY:  ParamFloat({obj:conf, key: 'pivotY', step: inc, name: 'pivot Y', onChange: onPivotChanged}),
                // the bend of the pose (PatternPose.js) and the tool's way of moving
                bendX:   ParamFloat({obj:conf, key: 'bendX', min: -100, max: 100, step: inc, name: 'bend X', onChange: onc}),
                bendY:   ParamFloat({obj:conf, key: 'bendY', min: -100, max: 100, step: inc, name: 'bend Y', onChange: onc}),
                geometric: ParamBool({obj:conf, key: 'geometric', name: 'in geometry'}),
            }
        });
    } // function makePatternTransformParams(){

    /** can the pattern's box be placed by a bent pose (an image pattern): the pattern transform tool then moves in the geometry of the group */
    // the group's UI tool (the orbifold's edges) is shown in the Symmetry tool with the group's
    // handles on, by the GPU editing overlay when it can
    function groupToolDrawsOnGPU(){
        return !!(groupHandlesShown() && mGroupUITool.getOverlayGeometry && mEditingOverlay.isReady());
    }

    function patternCanBend(){
        return !!(mPattern && typeof mPattern.canBend === 'function' && mPattern.canBend());
    }

    //
    //  the places of the pattern's images that some enabled layer shows (a pattern of
    //  several images, PatternImageArray): [{id, get, set}] for the pattern transform
    //  tool, null for other patterns. A layer's componentIds() is [] when it shows all
    //  the images and null when it shows none; without such a layer all are shown.
    //
    function shownImageTransforms(){
        const all = (mPattern && mPattern.getImageTransforms) ? mPattern.getImageTransforms() : null;
        if (!all || !all.length) return all;
        const layers = (mVisualization.getLayers ? mVisualization.getLayers() : []).filter(l => l && l.componentIds);
        if (!layers.length) return all;
        const shown = new Set();
        for (const l of layers) {
            if (!l.enabled) continue;
            const ids = l.componentIds();
            if (!ids) continue;
            if (!ids.length) return all;
            ids.forEach(id => shown.add(id));
        }
        return all.filter(t => shown.has(t.id));
    }

    function onPatternPivotChanged(key,value){
        onPatternTransformChanged();
    }
    //
    //
    //
    function makeDisplayParams() {
        
        let cfg = mConfig.display;
        let conf = mConfig.misc.options;
        let onc = scheduleRepaint;
        return ParamGroup({
            name: 'display',
            params: {
                canvasSize:     ParamChoice({obj: cfg,key: 'canvasSize',choice: CanvasSize.getNames(), serializable:false, onChange: onCanvasSize}),
                customWidth:    ParamInt({obj: cfg,key: 'customWidth', min: 128, max: 16 * 1024, name: 'custom width', serializable: false, onChange: onCanvasSize}),
                customHeight:   ParamInt({obj: cfg,key: 'customHeight',min: 128,max: 16 * 1024,name: 'custom height',serializable: false, onChange: onCanvasSize}),
                sizeMultiplier: ParamInt({obj: cfg, key: 'sizeMultiplier', min: 1, max: 4, name: 'size multiplier', serializable: false, onChange: onCanvasSize}),
                backgroundColor: ParamColor({obj: cfg,key: 'backgroundColor',name: 'background',onChange: scheduleRepaint}),
                showTiming:     ParamFunc({func: onShowTiming, name: 'show timing...'}),
                showChecker:    ParamBool({obj: conf,key: 'showChecker', name: 'Checker', serializable: false, onChange: onShowChecker}),
                showGrid:       ParamBool({obj: conf,key: 'showGrid', name: 'Grid', serializable: false, onChange: onc}),
                showRuler:      ParamBool({obj: conf,key: 'showRuler',name:'Ruler', serializable: false, onChange: onc}),
            }
        });
    } // function makeDisplayParams()

    //
    //
    //
    function makeMiscParams() {

        let visConf = mConfig.misc;
        let onChange = scheduleRepaint;

        return ParamGroup({
            name: 'misc',
            params: {
                dataPlot:   ParamObj({
                    name:   'plot',
                    obj:    mDataPlot
                }),

            }
        });
    } // function makeMiscParams()

    //
    //  the group transform, a similarity on top of the group: its panel is one
    //  row (x, y, angle in degrees, scale) with the commands in a hamburger;
    //  a document saves the four values under symmetry.transform, as ever
    //
    function makeGroupTransformParams() {

        let conf = mConfig.symmetry.transform;
        let onc = onGroupTransformChanged;
        let inc = 0.0000000000001;
        const group = ParamGroup({
            name: 'group transform',
            params: {
                translationX:
                ParamFloat({
                    obj: conf,
                    key: 'translationX',
                    name: 'translate X',
                    min: -2.,
                    max: 2.,
                    step: inc,
                    onChange: onc,
                }),
                translationY:
                ParamFloat({
                    obj: conf,
                    key: 'translationY',
                    name: 'translate Y',
                    min: -2.,
                    max: 2.,
                    step: inc,
                    onChange: onc,
                }),
                rotation:
                ParamFloat({
                    obj: conf,
                    key: 'rotation',
                    min: -360.,
                    max: 360.,
                    step: inc,
                    onChange: onc,
                }),
                scale:
                ParamFloat({
                    obj: conf,
                    key: 'scale',
                    min: 0.000001,
                    max: 1000000.,
                    step: inc,
                    onChange: onc,
                }),
            }
        });
        const row = ParamUiRow({
            name:        'transform',
            labelWidth:  'auto',
            tooltip:     'the group transform: translate X and Y, rotation in degrees, scale',
            menu:        groupTransformMenu,
            menuTooltip: 'commands of the group transform',
        });
        const ui = {
            row,
            translationX: row.contain(group.translationX, { tooltip: 'translate X' }),
            translationY: row.contain(group.translationY, { tooltip: 'translate Y' }),
            rotation:     row.contain(group.rotation, { tooltip: 'rotation, degrees' }),
            scale:        row.contain(group.scale, { tooltip: 'scale' }),
        };
        return { ...group, createUI: (gui) => createParamUI(gui, ui) };
    } // function makeGroupTransformParams(){

    // the group transform's commands: the panel row's hamburger, the Symmetry tool's bar
    function groupTransformMenu() {
        return [
            { label: 'Reset', title: 'no transform: no translation, no rotation, scale 1', action: resetGroupTransform },
            { label: 'Centre to 0', title: 'the frame\'s centre (the centre of the fundamental domain\'s box) to the origin; ' +
                                           'the angle and the scale stay', action: centreGroupTransform },
            { label: 'Origin to 0', title: 'the group\'s origin to the origin (no translation); the angle and the scale stay',
              action: originGroupTransform },
        ];
    }

    function resetGroupTransform() {
        Object.assign(mConfig.symmetry.transform, { translationX: 0, translationY: 0, rotation: 0, scale: 1 });
        onGroupTransformEdited();
    }

    // the frame's centre c = g(a) = s R (a + t), a the centre of the domain's box: t = -a puts it at the origin
    function centreGroupTransform() {
        const a = mGroupTransformTool.getFrame().anchor;
        Object.assign(mConfig.symmetry.transform, { translationX: -a[0], translationY: -a[1] });
        onGroupTransformEdited();
    }

    // g(0) = s R t: no translation puts the group's origin at the origin
    function originGroupTransform() {
        Object.assign(mConfig.symmetry.transform, { translationX: 0, translationY: 0 });
        onGroupTransformEdited();
    }

    // the group transform was set here (the frame's drags, the bar, the commands): the
    // panel's row shows it
    function onGroupTransformEdited() {
        if (mParams && mParams.symmetry && mParams.symmetry.transform) mParams.symmetry.transform.updateDisplay();
        onGroupTransformChanged();
    }

    // the group transform changed (in the panel's row too): the group follows, the
    // Symmetry tool's bar shows it
    function onGroupTransformChanged() {
        onGroupChanged();
        if (mPropertyBar && mConfig.tools.toolName === TOOL_SYMMETRY) mPropertyBar.refresh();
    }

    // the group transform as transformGroup takes it: radians, the translation as a vector
    function groupTransformParams() {
        const t = mConfig.symmetry.transform;
        return { rotation: t.rotation * TORADIANS, translation: [t.translationX, t.translationY], scale: t.scale };
    }

    //
    //
    //
    function makeSymOptionsParams() {

        let conf = mConfig.symmetry.options;
        let onChange = scheduleRepaint;
        return ParamGroup({
            name: 'symmetry options',
            params: {
                iterations: ParamInt({
                    obj: conf,
                    key: 'symIterations',
                    min: 0,
                    max: 1000,
                    step: 1,
                    name: 'iterations',
                    onChange: onChange,
                }),

            }
        });
    } // function makeSymOptionsParams()

    //
    //
    //
    function makeSymParams() {

        let conf = mConfig.symmetry;
        let onChange = scheduleRepaint;
        let params = {};
        // the Symmetry tool's toggles, here where there is no tool bar to show them (not saved)
        if (!mPaletteOptions) {
            const handles = ParamUiRow({ name: 'handles', labelWidth: 'auto' });
            params.handles = handles;
            params.groupHandles = handles.contain(ParamBool({ obj: mSymHandles, key: 'group', name: 'group',
                serializable: false, onChange: onSymmetryHandlesChanged }),
                { tooltip: 'the group\'s handles in the Symmetry tool: the orders at the corners (the wheel, − and +), the sizes and angles (drag the discs and diamonds); the orbifold: drag an edge of its domain to change its length, Shift+drag its twist' });
            params.transformHandles = handles.contain(ParamBool({ obj: mSymHandles, key: 'transform', name: 'transform',
                serializable: false, onChange: onSymmetryHandlesChanged }),
                { tooltip: 'the group transform\'s frame in the Symmetry tool, round the fundamental domain: drag its centre to move the group, a corner to turn and scale it about the centre (Euclidean groups only)' });
            // the Dirichlet domain's is its switch 'edit'
        }
        if(mGroupMakerFactory) 
            params.groupType = ParamChoice({obj:mConfig.symmetry, key:'groupType', name: 'group type',
                                            choice: mGroupMakerFactory.getNames(), onChange: onGroupTypeChanged});
        params.group = ParamObj({name: 'group params', obj: mGroupMaker});
        params.transform = makeGroupTransformParams();
        params.dirichlet = mDirichlet.getParams();
        params.options = makeSymOptionsParams();
        mSymPanelParams = params;
        
        return ParamGroup({
            name: 'symmetry',
            params: params,                        
        });
    }

    //
    //
    //
    function makeToolsParams() {

        //let edit = mEditors.tools = new EditorGroup();
        let conf = mConfig.tools;

        return ParamGroup({
            name: 'tools',
            params: {
                tool:             ParamChoice({obj: mConfig.tools,key: 'toolName',choice: getToolNames(),name: 'tool',serializable: false,onChange: onToolNameChanged}),
                transform:        ParamObj({name: 'move', obj: mNavigator}),
                drawing:          ParamObj({name: 'draw',obj: mDrawingToolRenderer}),
            }
        });

    }

    //
    //
    //
    function isGUIWindowVisible() {
        if (!mGUIWindow || !mGUIWindow.wnd) return false;
        return mGUIWindow.wnd.style.visibility !== 'hidden';
    }

    function updateToolbarSettingsBtnUI() {
        if (!mToolbox || !mToolbox.buttons || !mToolbox.buttons.settings) return;
        const visible = isGUIWindowVisible();
        const btn = mToolbox.buttons.settings;
        if (visible) {
            btn.classList.add('pressed');
            btn.setAttribute('aria-pressed', 'true');
        } else {
            btn.classList.remove('pressed');
            btn.setAttribute('aria-pressed', 'false');
        }
    }

    function initGUI() {
        if (mGUIWindow) return;

        // with the tool palette the settings are not needed for drawing: the
        // window is the app's own (not shared with the other apps) and starts
        // closed until it was opened once
        const settingsId = mPaletteOptions ? mDocFolderId + '_settings_window' : 'symrenderer_settings_window';
        let settingsShown = null;
        try { settingsShown = window.localStorage.getItem(settingsId + '_visible'); } catch (e) { /* no storage */ }

        mGUIWindow = createInternalWindow({
            title:     'settings',
            width:     '320px',
            height:    '520px',
            left:      'calc(100% - 340px)',
            top:       '10px',
            canClose:  true,
            canResize: true,
            storageId: settingsId,
            onClose:   () => {
                updateToolbarSettingsBtnUI();
            },
            onResize:  () => {
                if (mGUI && mGUIWindow && mGUIWindow.interior) {
                    mGUI.width = mGUIWindow.interior.clientWidth;
                }
            }
        });

        const interior = mGUIWindow.interior;
        interior.classList.add('gui-window-interior');

        mGUI = new GuiBuilder({
            autoPlace: false,
            width: 300
        });
        mGUI.domElement.classList.add('gui-window-panel');
        mGUI.domElement.id = "rightGUI";

        interior.appendChild(mGUI.domElement);

        if (mMenuBuilder) mMenuBuilder(mGUI, getParams());
        else createParamUI(mGUI, getParams());

        // to do final initialization
        onGroupChanged();

        // Connect the 'script params' DatGUI subfolder inside the 'scripting' folder.
        // Must happen after createParamUI() so the 'scripting' folder already exists.
        mScripting.initGUI(mGUI.__folders?.['scripting']);

        if (mGUI && interior) {
            mGUI.width = interior.clientWidth;
        }
        if (mPaletteOptions && settingsShown === null) mGUIWindow.setVisible(false);

        updateToolbarSettingsBtnUI();

    } // initGUI()

    //
    //  create toolbox
    //
    function makeToolbox(tbOptions={}) {

        if (DEBUG)
            console.log(`${MYNAME}.makeToolbox()`); 
        //let toolbox = $('#ttt');\r
        //console.log('toolsbox:', toolbox); 
        
        let container = document.createElement('div');        
        //container.style.backgroundColor = 'green';
        container.style.position = 'relative';
        //container.style.borderWidth = '5';
        //container.style.borderColor = 'red';        
        
        let buttons = {};
        
        function createImgBtn(opt={}){
            let btn = document.createElement('input');
            btn.src = opt.src;
            btn.title = opt.title;
            btn.onclick = opt.action;
            btn.className = 'imgbutton';
            btn.type = 'image';
            return btn;
        }
        let btnCount = 8.5;
        buttons.settings    = createImgBtn({title:'settings',  src:resPath('btn_settings.svg'),action:toggleGUI});
        container.appendChild(buttons.settings);
        if (mPaletteOptions) {
            // the documents' commands in one menu
            buttons.file = createImgBtn({title: 'files: samples, open, save', src: resPath('btn_file_menu.svg'),
                                         action: () => showToolboxMenu(buttons.file, fileMenuItems())});
            container.appendChild(buttons.file);
            btnCount++;
        }
        // the windows and panels shown, hidden and brought to the top from one menu
        buttons.windows = createImgBtn({title: 'windows: shown, hidden, brought to the top', src: resPath('btn_windows.svg'),
                                        action: () => showToolboxMenu(buttons.windows, windowsMenuItems())});
        container.appendChild(buttons.windows);
        btnCount++;
        // Show Run + Restart buttons when animation is available
        if (mCanAnimate) {
          buttons.run         = createImgBtn({title:LABEL_RUN,     src:resPath('btn_play.svg'),   action:onToggleRun});
          buttons.restart     = createImgBtn({title:'Restart',     src:resPath('btn_restart.svg'), action:onRestartAnimation});
          container.appendChild(buttons.run);
          container.appendChild(buttons.restart);
          btnCount += 2;
        }
        if(mPattern.initSimulation){
          buttons.init        = createImgBtn({title:'initialize',src:resPath('btn_initialize.svg'),action:onInitSimulation});
          container.appendChild(buttons.init);
          btnCount ++;
        }
        // the pattern's own commands (symdraw: undo, redo, the add menu)
        mToolboxCommands = [];
        if (mPaletteOptions && mPattern.getToolboxCommands) {
            mPattern.getToolboxCommands().forEach(cmd => {
                const btn = createImgBtn({title: cmd.title, src: cmd.icon, action: () => {
                    if (cmd.items) { showToolboxMenu(btn, cmd.items()); return; }
                    cmd.action();
                    refreshToolUI();
                    scheduleRepaint();
                }});
                buttons[cmd.name] = btn;
                container.appendChild(btn);
                mToolboxCommands.push({cmd, btn});
                btnCount++;
            });
        }
        buttons.recording   = createImgBtn({title:'recording', src:resPath('btn_record_start.svg'),action:onToggleRecording});
        // with the pattern's exports the image export is the first item of a menu
        const exportMenu = !!(mPaletteOptions && mPattern.getExportItems);
        buttons.download    = createImgBtn({title: exportMenu ? 'export: an image, the files of the pattern' : 'export image', src:resPath('btn_download.svg'),
                                            action: exportMenu ? () => showToolboxMenu(buttons.download, exportMenuItems()) : onSaveImage});
        buttons.full_screen = createImgBtn({title:'full screen',src:resPath('btn_full_screen.svg'),action:onFullScreen});
        container.appendChild(buttons.recording);
        container.appendChild(buttons.download);
        container.appendChild(buttons.full_screen);
        if (mPaletteOptions) {
            // the tools are in the tool palette (makeToolPalette)
            btnCount -= 4.5;
        } else {
            buttons.move        = createImgBtn({title:'move',      src:resPath('btn_move2.svg'),action:()=>setTool('move')});
            buttons.symmetry    = createImgBtn({title:'symmetry: the group\'s handles, the group transform\'s frame and the Dirichlet domain on the canvas (their toggles: symmetry > handles)',
                                                src:resPath(OWN_TOOLS[TOOL_SYMMETRY].icon), action:()=>setTool(TOOL_SYMMETRY)});
            btnCount++;
            buttons.patternTransform = createImgBtn({title:'pattern transform',src:resPath('btn_pattern_transform.svg'),action:()=>setTool('patternTransform')});
            buttons.draw        = createImgBtn({title:'draw',      src:resPath('btn_draw.svg'),action:()=>setTool('draw')});
            buttons.pick        = createImgBtn({title:'pick',      src:resPath('btn_pick.svg'),action:()=>setTool('pick')});
            mPatternTools.forEach(tool => {
                const name = TOOL_PATTERN_PREFIX + tool.name;
                buttons[name] = createImgBtn({title: tool.title || tool.name,
                                              src: tool.icon || resPath('btn_draw.svg'),
                                              action: () => setTool(name, true)});
                btnCount++;
            });
            let space       = createImgBtn({                   src:resPath('btn_vbar.svg')});
            space.classList.add('vbar-separator');

            container.appendChild(space);

            container.appendChild(buttons.move);
            container.appendChild(buttons.symmetry);
            container.appendChild(buttons.patternTransform);
            container.appendChild(buttons.draw);
            container.appendChild(buttons.pick);
            mPatternTools.forEach(tool => container.appendChild(buttons[TOOL_PATTERN_PREFIX + tool.name]));
        }

        let btnWidth = 40;
        let titleHeight = 22;
        
        // floating window
        let intWin = null;
        if(tbOptions.useInternalWindow){
            intWin = createInternalWindow({
                                        width: Math.ceil(btnWidth*btnCount + 22) + 'px', 
                                        height: (btnWidth + titleHeight) + 'px',
                                        left: '1px', 
                                        top:  '1px',
                                        title: 'toolbox',
                                        canResize: false,
                                        canClose: false,
                                        alwaysOnTop: true,
                                        alwaysVisible: true,
                                        storageId: 'toolbox',
                                        });  
            let interior = intWin.interior;
            
            interior.style.overflowY = "hidden";
            interior.style.overflowX = "hidden";
            interior.style.width = 'max-content';
            interior.style.height = 'max-content';
            
            //document.body.appendChild(container);
            interior.appendChild(container);
            // the window fits its buttons (sized by the page's style), also
            // when a script adds some later
            const fit = () => intWin.setInteriorSize(container.offsetWidth, container.offsetHeight);
            fit();
            new ResizeObserver(fit).observe(container);
        }

        setTimeout(() => {
            updateToolbarSettingsBtnUI();
        }, 0);

        return {container, buttons, intWin};

    } //function makeToolbox()

    // a menu of the toolbox, above the always-on-top windows; the toolbox
    // and the tools show what its command did
    function showToolboxMenu(anchor, items) {
        showPopupMenu({ anchor, items: items.map(it => (it.action
            ? { ...it, action: () => { it.action(); refreshToolUI(); scheduleRepaint(); } } : it)) });
    }

    function fileMenuItems() {
        return [
            { label: 'Samples…', title: 'the samples of the page', action: () => mDocManager.onShowSamples() },
            { label: 'Files…', title: 'the documents saved in a folder', action: () => mDocManager.onShowDocuments() },
            { separator: true },
            { label: 'Save', title: 'the document, where it was saved', action: () => mDocManager.onSaveDocument() },
            { label: 'Save New…', title: 'a new document, the next free name', action: () => mDocManager.onSaveNewDocument() },
            { label: 'Save As…', title: 'the document under a name you choose', action: () => mDocManager.onSaveDocumentAs() },
        ];
    }

    // the tool panels: the palette, the bar, the pattern's (symdraw: style,
    // layers), the visualization layers
    function toolWindowEntries() {
        return [
            { label: 'Tools', title: 'the tool palette', window: mToolPalette?.window },
            { label: 'Tool', title: 'the settings of the active tool, and its help', window: mPropertyBar?.window },
            ...(mToolUI?.windows || []),
            { label: 'Visualization', title: 'the visualization layers and their settings', window: mVisLayersWindow?.window },
            { label: 'Symmetry', title: 'the symmetry: the group, its transform, the Dirichlet domain', window: mSymWindow?.window },
            { label: 'Transformations', title: 'the conformal transformations the picture is seen through: the list and their settings',
              window: mTransformsWindow?.window },
        ];
    }

    //
    //  options.transformsWindow: the navigator's list of conformal transformations
    //  in a list with the settings of the selected one under it (TransformsWindow.js),
    //  left of the visualization window; closed until it is asked for (the windows
    //  menu, the Orientation tool's bar)
    //
    function transformsWindowOn() {
        return mTransformsWindowAsked && !!(mNavigator.getProjection && mNavigator.getProjection()
                                           && mNavigator.getProjection().getMaps);
    }

    function makeTransformsWindow() {
        // the list is a part of the document: its edits are steps of the
        // pattern's undo when it has one (the drawing's), as the symmetry's
        // and the visualization layers' are
        mTransformsWindow = createTransformsWindow({
            list:      mNavigator.getProjection(),
            storageId: 'transforms_window',
            left:      'calc(100% - 900px)',
            top:       '120px',
            pushUndo:  mPattern && mPattern.pushUndo ? (entry) => mPattern.pushUndo(entry) : null,
            // the row whose handles are on the canvas changed, or the window was opened or closed
            onChange:  () => scheduleRepaint(),
        });
        // the selected row's own handles and marks on the canvas, in every tool, while
        // the window is open and its switch is on (TransformHandles.js): the points of a
        // rational map, the cell of a periodic wrap, the fixed points of a word
        mTransformHandles = createTransformHandles({
            navigator: mNavigator,
            getRow:    () => (mTransformsWindow ? mTransformsWindow.getHandlesRow() : null),
            pointer:   () => mPointerAt,
            canvas:    mCanvas.overlay,
            repaint:   scheduleRepaint,
        });
    }

    // the handles of the selected transformation take the pointer and the keys now: they
    // are made, and the window says whose they are (it is open, its switch is on)
    function transformHandlesOn() {
        if (!mTransformHandles) return false;
        const on = !!(mTransformsWindow && mTransformsWindow.getHandlesRow());
        if (on !== mTransformHandles.isActive()) mTransformHandles.setActive(on);
        return on && mTransformHandles.isShown();
    }

    // the tools that get an event: the selected transformation's handles before the active tool's
    function toolsNow() {
        return transformHandlesOn() ? [mTransformHandles, ...mActiveTools] : mActiveTools;
    }

    function showTransformsWindow() {
        if (!mTransformsWindow) return;
        const win = mTransformsWindow.window;
        if (win.isVisible()) win.raise();
        else win.setVisible(true);
    }

    //
    //  options.visualizationWindow: the visualization layers in a list with
    //  the settings of the selected one under it, at the right edge under
    //  the pattern's windows
    //
    function visWindowOn() {
        return mVisWindowAsked && !!mVisualization.addListener;
    }

    function makeVisualizationWindow() {
        // left of symdraw's layers and style windows; its edits are steps of
        // the pattern's undo when it has one (the drawing's)
        mVisLayersWindow = createVisualizationLayersWindow({
            manager:   mVisualization,
            storageId: 'vis_layers',
            left:      'calc(100% - 600px)',
            top:       '120px',
            pushUndo:  mPattern && mPattern.pushUndo ? (entry) => mPattern.pushUndo(entry) : null,
        });
    }

    //
    //  options.symmetryWindow: the symmetry params in a window of their own,
    //  the Symmetry tool's panel, left of the canvas by the palette; it opens
    //  when the tool is taken up, unless the user closed it
    //
    function makeSymmetryWindow() {
        mSymWindow = createSymmetryWindow({
            params:      mSymPanelParams,
            storageId:   'symmetry_window',
            left:        '52px',
            top:         '120px',
            openFolders: ['group params'],
        });
    }

    // the tool panels, the settings, the samples and the files, then any
    // other window of the page
    function windowsMenuItems() {
        return windowMenuItems([
            ...toolWindowEntries(),
            { separator: true },
            { label: 'Settings', title: 'the parameters of the page', window: mGUIWindow },
            { label: 'Samples', title: 'the samples of the page', window: mDocManager.getSamplesSelector()?.getWindow() },
            { label: 'Files', title: 'the documents saved in a folder', window: mDocManager.filesWindow },
        ]);
    }

    function exportMenuItems() {
        return [
            { label: 'Image (PNG)…', title: "the document's frame or the view on screen, at a chosen size: PNG, or JPG, WEBP, TIFF", action: onSaveImage },
            { separator: true },
            ...mPattern.getExportItems(),
        ];
    }

    //
    //  options.toolPalette: the tools in a palette (SymRenderer's own tools
    //  named in options, then the pattern's), and a property bar with the
    //  active tool's settings (tool.getProperties()) and its help
    //
    function makeToolPalette() {

        const tools = [];
        (mPaletteOptions.tools || DEFAULT_PALETTE_TOOLS).forEach(name => {
            const t = OWN_TOOLS[name];
            if (t) tools.push({ name, label: t.label, key: t.key, icon: resPath(t.icon), group: 'view' });
        });
        // the pattern's tools come first, the view's after them
        const patternTools = mPatternTools.map(tool => ({
            name:  TOOL_PATTERN_PREFIX + tool.name,
            label: tool.label || tool.name,
            key:   tool.key,
            icon:  tool.icon || resPath('btn_draw.svg'),
            group: tool.group || 'pattern',
        }));
        tools.unshift(...patternTools);

        // the bar on the right of the toolbox, the palette under it
        const tbWnd = mToolbox && mToolbox.intWin ? mToolbox.intWin.wnd : null;
        const tbRight  = tbWnd ? tbWnd.offsetLeft + tbWnd.offsetWidth : 0;
        const tbBottom = tbWnd ? tbWnd.offsetTop + tbWnd.offsetHeight : 0;
        mPropertyBar = createPropertyBar({
            title:     'tool',
            // a new key when the toolbox grew: a place saved beside the narrower one covered it
            storageId: 'tool_bar',
            left:      (tbRight + 6) + 'px',
            top:       '1px',
        });
        // a place saved beside a narrower toolbox covers its last buttons: the bar goes to its right
        const barWnd = mPropertyBar.window.wnd;
        if (tbWnd && barWnd.offsetLeft < tbRight && barWnd.offsetLeft + barWnd.offsetWidth > tbWnd.offsetLeft &&
                     barWnd.offsetTop < tbBottom && barWnd.offsetTop + barWnd.offsetHeight > tbWnd.offsetTop) {
            barWnd.style.left = (tbRight + 6) + 'px';
        }
        mToolPalette = createToolPalette({
            title:     'tools',
            storageId: 'tool_palette',
            left:      '1px',
            top:       (tbBottom + 4) + 'px',
            tools,
            onSelect:  (name) => setTool(name, true),
        });
        // the pattern's parts: under the tools and windows of its own (symdraw:
        // the stroke and fill swatches, the layers window)
        if (mPattern.createToolUI) mToolUI = mPattern.createToolUI({ paletteBottom: mToolPalette.bottom });
        mToolPalette.fit();
        refreshToolUI();

    } // function makeToolPalette()

    //
    //  the settings SymRenderer's own tools show in the property bar
    //
    function ownToolProperties(toolName) {
        switch (toolName) {
        case TOOL_MOVE:
            return navigatorProperties();
        case TOOL_SYMMETRY:
            return symmetryProperties();
        case TOOL_PATTERN_TRANSFORM: {
            const ptc = mConfig.patternTransConfig;
            const num = (key, label, title, min, max, step) => ({ kind: 'number', key, label, title, min, max, step,
                get: () => ptc[key], set: (v) => { ptc[key] = v; onPatternTransformChanged(); } });
            // the centre, and the size and turn: two groups the bar may put in two rows;
            // an image pattern (one that can take a bent placement) moves in the geometry of
            // the group when the toggle is on
            const controls = [
                { kind: 'group', title: 'centre', controls: [
                    num('centerX', 'x', 'centre of the pattern box, x', -10, 10, 0.001),
                    num('centerY', 'y', 'centre of the pattern box, y', -10, 10, 0.001),
                ] },
                { kind: 'group', title: 'size and turn', controls: [
                    num('scale', 'scale', 'size of the pattern box', 0.0001, 100, 0.001),
                    num('angle', 'angle', 'turn of the pattern box, degrees', -360, 360, 0.1),
                ] },
            ];
            if (patternCanBend()) {
                controls.push({ kind: 'toggle', icon: ICON_GEOMETRY,
                    title: 'move, turn and scale the pattern in the geometry of the group (the hyperbolic plane, the sphere, ' +
                           'the local disks of a Kleinian group): the picture keeps its size in the pattern and bends; ' +
                           'off: in the plane, as before',
                    get: () => ptc.geometric !== false, set: (v) => { ptc.geometric = v; onPatternTransformChanged(); } });
            }
            return controls;
        }
        default:
            return [];
        }
    }

    //
    //  the Symmetry tool's settings: a toggle for each set of handles on the canvas, the
    //  group's (shown when the group maker has them) and the Dirichlet domain's, and the
    //  help button (docs/symmetry_tool_plan.md)
    //
    function symmetryProperties() {
        const toggle = (key, icon, title) => ({ kind: 'toggle', icon, title,
            get: () => mSymHandles[key], set: (v) => { mSymHandles[key] = !!v; onSymmetryHandlesChanged(); } });
        return [
            { ...toggle('group', ICON_GROUP_HANDLES,
                'the group\'s handles on the canvas: the orders at the corners of the domain (the wheel over a label, ' +
                'its − and +, the keys - and +, or a drag up and down on it), the sizes and angles (drag the discs and ' +
                'diamonds; Shift: fine; Escape: back as at the press); the orbifold: drag an edge of its domain to ' +
                'change its length, Shift+drag its twist, or turn the wheel over it'),
              visible: () => !!mGroupUITool },
            { ...toggle('transform', ICON_TRANSFORM_HANDLES,
                'the group transform on the canvas, a frame round the fundamental domain: drag its centre to move the ' +
                'group, a corner to turn and scale it about the centre (Shift: turn only, in steps of 15°; Alt: scale ' +
                'only; Escape: back as at the press). For the groups of the Euclidean plane; the transform of the ' +
                'others is in the symmetry panel'),
              visible: () => makerGroupEuclidean() },
            { kind: 'toggle', icon: ICON_DIRICHLET, get: () => mSymHandles.dirichlet, set: (v) => mDirichlet.requestEdit(!!v),
              title: 'the Dirichlet domain on the canvas, as the switch edit of its settings: drag the yellow disc to move ' +
                'the base (D: the base to the pointer); a click on a point, an arc or a cell adds or removes its side, ' +
                'Ctrl+Z undoes; on, the base shows also before the domain has a side, and the settings open' },
            { kind: 'hint' },
            groupTransformControls(),
        ];
    }

    //
    //  the group transform's numbers in the Symmetry tool's bar, with its frame on: the
    //  frame's centre c = g(a) (in the world; a the centre of the box of the maker's
    //  fundamental domain), its angle and its scale; the angle and the scale turn and
    //  scale the group about c. Written back as the stored numbers
    //  (GroupTransformFrame.js transformFromFrame)
    //
    function groupTransformControls() {
        const conf = mConfig.symmetry.transform;
        const frame = () => mGroupTransformTool.getFrame();
        const setFrame = (c, angle, scale) => {
            Object.assign(conf, transformFromFrame(c, angle, scale, frame().anchor));
            onGroupTransformEdited();
        };
        const num = (label, title, min, max, step, width, get, set) => ({ kind: 'number', label, title, min, max, step, width, get, set });
        return { kind: 'group', title: 'the group transform', visible: () => transformFrameOn(), controls: [
            num('x', 'the frame\'s centre, x: where the centre of the fundamental domain\'s box goes', -1000, 1000, 0.001, 7,
                () => frame().centre[0], (v) => { const f = frame(); setFrame([v, f.centre[1]], conf.rotation, f.scale); }),
            num('y', 'the frame\'s centre, y: where the centre of the fundamental domain\'s box goes', -1000, 1000, 0.001, 7,
                () => frame().centre[1], (v) => { const f = frame(); setFrame([f.centre[0], v], conf.rotation, f.scale); }),
            num('angle', 'the turn of the group about the centre, degrees', -360, 360, 0.1, 6,
                () => conf.rotation, (v) => { const f = frame(); setFrame(f.centre, v, f.scale); }),
            num('scale', 'the scale of the group about the centre', 0.000001, 1000000, 0.001, 7,
                () => conf.scale, (v) => { const f = frame(); setFrame(f.centre, conf.rotation, v); }),
            { kind: 'menu', icon: ICON_MENU, title: 'commands of the group transform: Reset, Centre to 0, Origin to 0', items: groupTransformMenu },
        ] };
    }

    //
    //  the orientation tool's settings: a row with the home button, the
    //  partial resets (the canvas, the Moebius transform, zoom 1, upright),
    //  the help button and the canvas's centre, zoom and angle; a row
    //  with the navigation modes and the sphere view; in the inversive mode a
    //  row with the pole O
    //  (docs/navigation_tool_plan.md section 1). A navigator without modes
    //  (PlaneNavigator) gets the home button only
    //
    function navigatorProperties() {
        const nav = mNavigator;
        const controls = [];
        const changed = () => { updatePropertyBarHint(); scheduleRepaint(); };
        // after a jump of the view the back button may come on
        const jumped = () => { if (mPropertyBar) mPropertyBar.refresh(); changed(); };
        if (nav.goToDocumentView) {
            // the document view (docs/document_view_plan.md): home goes to it, the next
            // button makes the canvas's view the document's
            controls.push({ kind: 'button', icon: ICON_RESET_VIEW,
                            title: 'home: the document view, the frame saved with the document, whole on the canvas (` goes back)',
                            action: () => { nav.goHome(); jumped(); } });
            controls.push({ kind: 'button', icon: ICON_PREV_VIEW,
                            title: 'back (` key): the view before home or a reset; again, the view you came back from',
                            enabled: () => nav.hasPreviousView(),
                            action: () => { goToPreviousView(); } });
            controls.push({ kind: 'button', icon: ICON_SET_DOC_VIEW,
                            title: 'set document view: the view on the canvas becomes the document\'s (saved with it, home goes to it)',
                            action: () => { nav.setDocumentViewFromCurrent(); scheduleRepaint(); } });
            if (nav.setFrameShown) {
                controls.push({ kind: 'toggle', icon: ICON_DOC_FRAME,
                    title: 'the document\'s frame on the canvas, the outside shaded (in every tool); in this tool drag its sides or ' +
                           'centre to move it, its corners to resize it (Shift keeps its shape), the round handle to turn it ' +
                           '(Shift: 15° steps)',
                    get: () => nav.getFrameShown(), set: (v) => { setFrameShown(v); changed(); } });
            }
        } else if (nav.onResetView) {
            controls.push({ kind: 'button', icon: ICON_RESET_VIEW, title: 'home: the view as it was at the start',
                            action: () => { nav.onResetView(); jumped(); } });
        }
        // a jump of the view (zoom 1, upright) keeps the view before it for back
        const jump = (f) => { if (nav.jumpView) nav.jumpView(f); else f(); jumped(); };
        // the partial resets
        if (nav.onResetEuclideanTrans) {
            controls.push({ kind: 'button', icon: ICON_RESET_CANVAS,
                title: 'reset the canvas: centre 0, zoom 1, upright; the Moebius transform stays',
                action: () => { nav.onResetEuclideanTrans(); jumped(); } });
        }
        if (nav.onResetInversiveTrans) {
            controls.push({ kind: 'button', icon: ICON_RESET_MOEBIUS,
                title: 'reset the Moebius transform: the motions of the geometry undone; the canvas stays',
                action: () => { nav.onResetInversiveTrans(); jumped(); } });
        }
        if (nav.setZoom) {
            controls.push({ kind: 'button', icon: ICON_ZOOM_1, title: 'zoom 1: the zoom of the start about the canvas centre',
                action: () => jump(() => nav.setZoom(1)) });
        }
        if (nav.setAngle) {
            controls.push({ kind: 'button', icon: ICON_UPRIGHT, title: 'upright: the canvas turned back to angle 0 about its centre',
                action: () => jump(() => nav.setAngle(0)) });
        }
        controls.push({ kind: 'hint' });
        if (nav.setCenter && nav.setZoom) {
            controls.push({ kind: 'group', title: 'the canvas: the world point at its centre, the zoom and the turn', controls: [
                { kind: 'number', label: 'x', title: 'the world point at the canvas centre, x', step: 0.001, digits: 3,
                  get: () => nav.getCenter()[0], set: (v) => nav.setCenter(v, nav.getCenter()[1]) },
                { kind: 'number', label: 'y', title: 'the world point at the canvas centre, y', step: 0.001, digits: 3,
                  get: () => nav.getCenter()[1], set: (v) => nav.setCenter(nav.getCenter()[0], v) },
                { kind: 'number', label: 'zoom', title: 'zoom of the canvas (1: the unit circle fits its width)',
                  min: 1e-6, max: 1e6, step: 0.01, digits: 3,
                  get: () => nav.getZoom(), set: (v) => nav.setZoom(v) },
                nav.setAngle ? { kind: 'number', label: 'angle', title: 'turn of the canvas, degrees counterclockwise (Ctrl+Shift+wheel turns it about the pointer)',
                  min: -360, max: 360, step: 0.1, digits: 1,
                  get: () => nav.getAngle(), set: (v) => nav.setAngle(v) } : null,
            ].filter(Boolean) });
        }
        // the navigation modes and the sphere view on a row of their own
        if (nav.setMode || nav.setSphereView) controls.push({ kind: 'break' });
        if (nav.setMode) {
            controls.push({ kind: 'iconChoice', title: 'navigation mode: the geometry whose motions the drags make',
                options: NAV_MODE_OPTIONS,
                get: () => nav.getMode(), set: (v) => { nav.setMode(v); changed(); } });
        }
        if (nav.setSphereView) {
            controls.push({ kind: 'toggle', icon: ICON_SPHERE_VIEW,
                title: 'sphere view: the plane shown on a sphere (stereographic projection); drags turn the sphere, Alt moves the canvas',
                get: () => nav.getSphereView(), set: (v) => { nav.setSphereView(v); changed(); } });
        }
        if (nav.setInfinitePan) {
            controls.push({ kind: 'toggle', icon: ICON_INFINITE_PAN,
                title: 'infinite pan: the folding starts at the view (the view anchor), so pans and hyperbolic moves go on without end; off: the view as before',
                get: () => nav.getInfinitePan(), set: (v) => { nav.setInfinitePan(v); changed(); } });
        }
        if (mTransformsWindow) {
            controls.push({ kind: 'button', icon: ICON_TRANSFORMS,
                title: 'transformations: the conformal transformations the picture is seen through (band, exponent, ...), a list in a window of its own',
                action: () => showTransformsWindow() });
        }
        if (nav.setPole) {
            // the pole of the inversive mode, on a row of its own: placed at the canvas centre or at infinity, its place
            const inv = () => nav.getMode() === 'inversive';
            const placed = () => inv() && !!nav.getPole();
            controls.push({ kind: 'break', visible: inv });
            controls.push({ kind: 'group', title: 'the pole O of the inversive moves', controls: [
                { kind: 'toggle', icon: ICON_POLE, visible: inv,
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
            const setF = (key) => (v) => { nav.setFrameValue(key, v); scheduleRepaint(); };
            controls.push({ kind: 'break', visible: shown });
            controls.push({ kind: 'group', title: 'the document\'s frame: the rectangle the document view shows (each change one undo step)', controls: [
                { kind: 'number', label: 'frame x', title: 'the frame\'s centre, x', step: 0.001, digits: 3, visible: shown,
                  get: () => fv('x'), set: setF('x') },
                { kind: 'number', label: 'y', title: 'the frame\'s centre, y', step: 0.001, digits: 3, visible: shown,
                  get: () => fv('y'), set: setF('y') },
                { kind: 'number', label: 'w', title: 'the frame\'s width, world units (2 / its zoom)', min: 1e-9, max: 1e9, step: 0.01, digits: 3, visible: shown,
                  get: () => fv('width'), set: setF('width') },
                { kind: 'number', label: 'h', title: 'the frame\'s height, world units', min: 1e-9, max: 1e9, step: 0.01, digits: 3, visible: shown,
                  get: () => fv('height'), set: setF('height') },
                { kind: 'number', label: 'angle', title: 'the frame\'s turn, degrees (the canvas\'s angle at the document view)',
                  min: -360, max: 360, step: 0.1, digits: 1, visible: shown,
                  get: () => fv('angle'), set: setF('angle') },
            ] });
        }
        return controls;
    }

    //
    //  the document's frame on the canvas, its toggle kept per app in the browser
    //  (docs/document_view_plan.md 3.7)
    //
    function setFrameShown(v) {
        if (!mNavigator.setFrameShown) return;
        mNavigator.setFrameShown(v);
        try { window.localStorage.setItem(DOC_FRAME_KEY, v ? '1' : '0'); } catch (e) { /* no storage */ }
        scheduleRepaint();
    }

    // the help line of the active tool; the orientation tool's follows the navigation mode
    function updatePropertyBarHint() {
        const toolName = mConfig.tools.toolName;
        if (!mPropertyBar || toolName !== TOOL_MOVE) return;
        let hint = mNavigator.gestureHint ? mNavigator.gestureHint(true) : OWN_TOOLS[TOOL_MOVE].help;
        if (mNavigator.getFrameShown && mNavigator.getFrameShown()) {
            hint += '. The document\'s frame: drag its sides or centre to move it, its corners to resize it (Shift keeps its shape), ' +
                    'the round handle to turn it (Shift: 15° steps)';
        }
        mPropertyBar.setHint(hint);
    }

    //  back (docs/document_view_plan.md phase 5, the ` key and the Orientation
    //  bar's button): the view before home or a reset; again, the view it came
    //  back from
    function goToPreviousView() {
        if (!mNavigator || !mNavigator.goToPreviousView || !mNavigator.goToPreviousView()) return false;
        scheduleRepaint();
        if (mPropertyBar && mConfig.tools.toolName === TOOL_MOVE) {
            mPropertyBar.refresh();
            updatePropertyBarHint();
        }
        return true;
    }

    //  the orientation tool's fields follow the view while it moves (the
    //  gestures, the gui)
    function scheduleNavigatorRefresh() {
        if (!mPropertyBar || mNavRefreshTimer || mConfig.tools.toolName !== TOOL_MOVE) return;
        mNavRefreshTimer = setTimeout(() => {
            mNavRefreshTimer = 0;
            if (mConfig.tools.toolName !== TOOL_MOVE) return;
            mPropertyBar.refresh();
            updatePropertyBarHint();
        }, NAV_REFRESH_MS);
    }

    // the property bar, the pattern's parts of the palette's UI and its
    // toolbox buttons show the current values
    function refreshToolUI() {
        if (mPropertyBar) mPropertyBar.refresh();
        if (mToolUI && mToolUI.refresh) mToolUI.refresh();
        mToolboxCommands.forEach(({cmd, btn}) => { if (cmd.enabled) btn.disabled = !cmd.enabled(); });
    }

    //
    //  the property bar shows the settings and the help of the active tool
    //
    function updatePropertyBar(toolName) {
        if (!mPropertyBar) return;
        const patternTool = getPatternTool(toolName);
        const own = OWN_TOOLS[toolName];
        const label = patternTool ? (patternTool.label || patternTool.name) : (own ? own.label : toolName);
        const controls = patternTool ? (patternTool.getProperties ? patternTool.getProperties() : [])
                                     : ownToolProperties(toolName);
        mPropertyBar.setControls([{ kind: 'label', text: label }, ...controls]);
        mPropertyBar.setHint(patternTool ? (patternTool.help || patternTool.title || '') : (own ? own.help : ''));
        updatePropertyBarHint();
    }

    //
    //
    // internal functions
    //
    function addEventListeners(canvas) {

        let evtHandler = makeEventHandler();

        canvas.addEventListener('pointerdown', evtHandler, {passive: false});
        canvas.addEventListener('pointerup',   evtHandler, {passive: false});
        canvas.addEventListener('pointermove', evtHandler, {passive: false});
        canvas.addEventListener('pointerleave',  evtHandler, {passive: false});
        canvas.addEventListener('wheel',       evtHandler, {passive: false});
        canvas.addEventListener('click',       evtHandler, {passive: false});
        canvas.addEventListener('dblclick',    evtHandler, {passive: false});
        canvas.addEventListener('pointerout',  evtHandler, {passive: false});
        canvas.addEventListener('contextmenu', onContextMenu);
        // the middle button pans the view: no autoscroll
        canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });

        // keys go to the active tools, the same way as the pointer events
        window.addEventListener('keydown', onKeyEvent);
        window.addEventListener('keyup',   onKeyEvent);
        // a key let go in another window is never seen
        window.addEventListener('blur', () => setSpacePan(false));

        window.addEventListener('resize', () => {
            onResize();
        });
    } // function addEventListeners(canvas)

    //
    //  a key event for the active tools which have handleKey(e); a tool that
    //  uses the key sets e.isConsumed. Keys typed into a text field, a menu
    //  or an editable element are not tool commands; a focused button (the
    //  toolbox buttons are image inputs) or checkbox takes no keys.
    //
    const NOT_TYPED_INPUTS = /^(button|image|submit|reset|checkbox|radio|color|file)$/;

    function isTypingTarget(t) {
        if (!t) return false;
        if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
        return t.tagName === 'INPUT' && !NOT_TYPED_INPUTS.test(t.type);
    }

    //
    //  Space held down (with the tool palette): a drag moves the view in
    //  every tool, the navigator gets the pointer events; a drag going on
    //  when Space is let go ends as a move of the view
    //
    let mSpacePan = false;
    let mSpaceReleased = false;     // let go during a drag: ends with it
    let mSpaceCursor = '';          // the tool's cursor, back after it
    let mButtonsDown = 0;           // the pointer's buttons, from its last event
    // a middle-button drag moves the view in every tool too (as in Inkscape)
    let mMiddlePan = false;
    // the cursor over the document frame's handles (the orientation tool), '' off them
    let mFrameCursor = '';

    function setSpacePan(on) {
        mSpaceReleased = false;
        if (on === mSpacePan) return;
        mSpacePan = on;
        if (on) {
            mSpaceCursor = mCanvas.overlay.style.cursor;
            mCanvas.overlay.style.cursor = 'grab';
        } else {
            mCanvas.overlay.style.cursor = mSpaceCursor;
        }
    }

    function onSpaceKey(e) {
        if (e.type === 'keydown') {
            if (!mSpacePan && !mButtonsDown) setSpacePan(true);
            else if (mSpacePan) mSpaceReleased = false;
        } else if (mSpacePan) {
            if (mButtonsDown) mSpaceReleased = true;
            else setSpacePan(false);
        }
        e.preventDefault();
    }

    function onKeyEvent(e) {
        if (isTypingTarget(e.target)) return;
        if (mPaletteOptions && e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            onSpaceKey(e);
            return;
        }
        const tools = toolsNow();
        for (let i = 0; i < tools.length; i++) {
            const tool = tools[i];
            if (tool && tool.handleKey) {
                tool.handleKey(e);
                if (e.isConsumed) {
                    e.preventDefault();
                    break;
                }
            }
        }
        // Ctrl+Z and Ctrl+Y the tools left alone: the page's undo, the symmetry's steps
        // among its (the drawing's tools take them for the same stack); on a page without
        // one, the symmetry's own in the Symmetry tool
        if (!e.isConsumed && mSymUndo.handleKey(e, mConfig.tools.toolName === TOOL_SYMMETRY)) {
            e.isConsumed = true;
            e.preventDefault();
        }
        // ` (Inkscape's key) goes back to the view before home or a reset, in every tool
        if (!e.isConsumed && e.type === 'keydown' && e.code === 'Backquote' &&
            !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
            if (!e.repeat) goToPreviousView();
            e.isConsumed = true;
            e.preventDefault();
        }
        // a key the tools left alone may pick a tool of the palette
        if (mToolPalette && !e.isConsumed && e.type === 'keydown' && !e.repeat) {
            const name = mToolPalette.toolForKey(e);
            if (name) {
                if (name !== mConfig.tools.toolName) setTool(name, true);
                e.isConsumed = true;
                e.preventDefault();
            }
        }
        // what the key did may show in the tool's settings (undo, a selection)
        if (e.type === 'keydown') refreshToolUI();
    }


    // a pattern tool's event gets the world point the screen shows there
    // (through the navigator's Moebius transform and sphere), and the point
    // in pattern space; e.canvasX, e.canvasY are set
    function setPatternToolPoints(e) {
        const w = mView.toWorld([e.canvasX, e.canvasY]);
        e.wpnt = w.pnt;
        e.wpntExact = w.exact;
        const simPnt = [0, 0];
        mPatternTransform.invTransform(e.wpnt, simPnt);
        e.simPnt = simPnt;
    }

    //
    //  a right click on the canvas opens the menu of the active pattern tool
    //  (tool.getContextMenu(e): PopupMenu items), else the browser's menu
    //
    function onContextMenu(e) {
        const tool = getPatternTool(mConfig.tools.toolName);
        if (!tool || !tool.getContextMenu) return;
        e.preventDefault();
        const scaling = mConfig.display.sizeMultiplier * getPixelRatio();
        e.canvasX = e.offsetX * scaling;
        e.canvasY = e.offsetY * scaling;
        setPatternToolPoints(e);
        const items = tool.getContextMenu(e) || [];
        refreshToolUI();
        scheduleRepaint();
        if (!items.length) return;
        showPopupMenu({ x: e.clientX, y: e.clientY, items: items.map(it => (it.action
            ? { ...it, action: () => { it.action(); refreshToolUI(); scheduleRepaint(); } } : it)) });
    }

    function makeEventHandler() {

        // the tool that took the last press, the view's navigator aside: the click that
        // ends it is that tool's alone. A tool before it in the list saw the press and let
        // it go (the Symmetry tool's Dirichlet handles, whose click anywhere changes the
        // sides, before the group's: a click on an edge of the orbifold's domain is the edge's)
        let mPressTaker = null;

        function handleEvent(e) {
            // a press on the canvas takes the focus from a panel control, as a
            // click elsewhere would (the tools prevent that default): the keys
            // then go to the tools, and a text field commits its edit
            if (e.type === 'pointerdown' && document.activeElement && document.activeElement !== document.body) {
                document.activeElement.blur();
            }
            // map pointer coord into internal canvas pixels
            let scaling = mConfig.display.sizeMultiplier * getPixelRatio();
            e.canvasX = e.offsetX * scaling;
            e.canvasY = e.offsetY * scaling;
            // where the pointer is: the sheet the view's map to the canvas answers on (mView)
            if (Number.isFinite(e.canvasX) && Number.isFinite(e.canvasY) &&
                (e.type === 'pointermove' || e.type === 'pointerdown' || e.type === 'pointerup' || e.type === 'wheel')) {
                mPointerAt = [e.canvasX, e.canvasY];
            }
            /*
            // event handlers handle events in sequence
            // event can be consumed and it should not be processed by repaining handlers
            gDrawingTool.handleEvent(e);
            if(!e.isConsumed)
            mNavigator.handleEvent(e);
             */
            let toolName = mConfig.tools.toolName;
            if (getPatternTool(toolName)) {
                setPatternToolPoints(e);
                toolName = '';
            }
            switch (toolName) {
            case '':
                break;
            default:
                console.error('unknown tool: ', toolName);
                break;
            case TOOL_MOVE:
            case TOOL_SYMMETRY:
                break;
            case TOOL_PICK:
                e.wpnt = canvas2sim([e.canvasX, e.canvasY]);
                break;
            case TOOL_DRAW:
                {
                    // World-space coordinate — same as TOOL_PATTERN_TRANSFORM so the
                    // navigator (zoom / pan) works correctly as a fallback.
                    const wpnt = [0, 0];
                    mCanvasTransform.invTransform([e.canvasX, e.canvasY], wpnt);
                    e.wpnt = wpnt;
                    // Simulation-space coordinate for the drawing tool itself.
                    const simPnt = [0, 0];
                    mPatternTransform.invTransform(wpnt, simPnt);
                    e.simPnt = simPnt;
                }
                break;
            case TOOL_PATTERN_TRANSFORM:
                // the world point the screen shows there, through the view's chain of maps
                e.wpnt = mView.toWorld([e.canvasX, e.canvasY]).pnt;
                break;
            }
            // with Space held down or the middle button the view moves, whatever the tool
            if (e.type === 'pointerdown' && e.button === 1) mMiddlePan = true;
            let tools = (mSpacePan || mMiddlePan) ? [mNavigator] : toolsNow();
            if ((e.type === 'click' || e.type === 'dblclick') && mPressTaker && tools.includes(mPressTaker)) tools = [mPressTaker];
            // in the orientation tool the plain gestures make the navigation mode's motions
            e.navigatorTool = (mConfig.tools.toolName === TOOL_MOVE) && !mSpacePan && !mMiddlePan;
            if (e.buttons !== undefined && e.type.startsWith('pointer')) mButtonsDown = e.buttons;
            if (mMiddlePan && e.type.startsWith('pointer') && !(e.buttons & 4)) mMiddlePan = false;
            let consumer = null;
            for (let i = 0; i < tools.length; i++) {
                const tool = tools[i];
                if (tool && tool.handleEvent) {
                    tool.handleEvent(e);
                    if (e.isConsumed) {
                        consumer = tool;
                        break;
                    }
                }
            }
            if (e.type === 'pointerdown') mPressTaker = (consumer && consumer !== mNavigator) ? consumer : null;
            // the document frame's handles in the orientation tool: their cursor (InversiveNavigator)
            if (e.frameCursor !== undefined && !mSpacePan && !mMiddlePan && mConfig.tools.toolName === TOOL_MOVE &&
                e.frameCursor !== mFrameCursor) {
                mFrameCursor = e.frameCursor;
                mCanvas.overlay.style.cursor = mFrameCursor || [CUR_MOVE, 'move'];
            }
            // a tool's gesture keeps the tools' frame (anchored far out) to its release: an
            // anchor step under it changes nothing for the tool (the navigator's own
            // gestures move the view and need no frame)
            if (mNavigator.holdToolFrame) {
                if (e.type === 'pointerdown' && consumer && consumer !== mNavigator) mNavigator.holdToolFrame(true);
                else if (e.type === 'pointerup' || e.type === 'pointercancel') mNavigator.holdToolFrame(false);
                carryToolWorld();
            }
            if (mSpacePan) {
                if (e.type === 'pointerdown') mCanvas.overlay.style.cursor = 'grabbing';
                if (e.type === 'pointerup') {
                    if (mSpaceReleased) setSpacePan(false);
                    else mCanvas.overlay.style.cursor = 'grab';
                }
            }
            // a click may have changed what the tool's settings show (a selection)
            if (e.type === 'pointerup' || e.type === 'dblclick') refreshToolUI();
            // the Symmetry tool's labels (the Dirichlet sides' names, the group handles'
            // orders) and those of a conformal transformation's handles are by the copy of
            // the picture at the pointer: where the transformations show a point on many
            // copies, they follow the pointer
            if (e.type === 'pointermove' && mNavigator.viewHasSheets &&
                (mConfig.tools.toolName === TOOL_SYMMETRY || transformHandlesOn()) &&
                mNavigator.viewHasSheets()) scheduleRepaint();

        }
        return {
            handleEvent: handleEvent
        };
    }

    //
    //  convert point from canvas to simulation space
    //
    function canvas2sim(cpnt) {

        let wpnt = [0, 0]; // point in world coordinates
        let tpnt = [0, 0]; // point in simulation coordinates

        mCanvasTransform.invTransform(cpnt, wpnt);
        mPatternTransform.invTransform(wpnt, tpnt);
        return tpnt;

    }

    function onGroupTypeChanged(){
        
        if (DEBUG) console.log(`${MYNAME}.onGroupTypeChanged()}`, mConfig.symmetry.groupType);
        let newGroupMaker = mGroupMakerFactory.getObject(mConfig.symmetry.groupType);

        mParams.symmetry.group.replaceObj(newGroupMaker);
        mGroupMaker = newGroupMaker;
        mGroupMaker.setOptions({onChanged:onGroupChanged});
        updateGroupUITool();
        onGroupChanged();
        
    }

    //
    //  Use the given group instead of the group maker's.  Pass null to go back
    //  to the maker.  The symmetry transform is still applied on top, exactly
    //  as it is for a maker supplied group.
    //
    function setGroupOverride(group) {
        mGroupOverride = group || null;
        mDirichlet.keepSides();     // no edit of the group: the sides stay as they are
        // the maker's handles are off while its group is not the one drawn
        if (mConfig.tools.toolName === TOOL_SYMMETRY) routeSymmetryTool();
        onGroupChanged();
    }

    function getGroupOverride() {
        return mGroupOverride;
    }

    function onGroupChanged() {

        if (DEBUG) console.log(`${MYNAME}.onGroupChanged()`);
        mGroupChanged = true;
        mSymUndo.changed();         // a step of undo when the user changed the symmetry
        mGroupTables.update();      // first: the layers ask it right after
        mScripting.events.fire('groupChanged', mGroup);
        if (mVisualization.onGroupChanged) mVisualization.onGroupChanged(mGroup);
        scheduleRepaint();

    }

    //
    //  the message 'Group Presentation Changed': the table of subgroups of the group
    //  is ready, or there is none. Not every change of the group is one: a or b of a
    //  wallpaper group does not change the presentation (SubgroupTables.js).
    //
    function onPresentationChanged(info) {

        if (DEBUG) console.log(`${MYNAME}.onPresentationChanged()`, info.key, info.state);
        if (mVisualization.onPresentationChanged) mVisualization.onPresentationChanged(info);
        mScripting.events.fire('groupPresentationChanged', info);
        scheduleRepaint();

    }

    // prepare group data if necessary 
    function prepareGroupData(){
        
        mGroup = mGroupOverride ? mGroupOverride : mGroupMaker.getGroup();
        mMakerGroup = mGroup;
        // in the Symmetry tool: the transform's frame (and its toggle and fields in the bar)
        // goes and comes with a Euclidean group, and it is round the maker's domain: the
        // bar shows its centre
        if (mConfig.tools.toolName === TOOL_SYMMETRY) {
            const wasEuclidean = mMakerGeometry.euclidean;
            let refresh = makerGroupEuclidean() !== wasEuclidean;
            if (refresh) routeSymmetryTool();
            if (transformFrameOn()) {
                const version = mMakerDomainBox.version;
                makerDomainBox();
                if (mMakerDomainBox.version !== version) refresh = true;
            }
            if (refresh && mPropertyBar) mPropertyBar.refresh();
        }
        if(DEBUG) console.log(`${MYNAME}.prepareGroupData()`, mGroup);
        mGroup = transformGroup(mGroup, groupTransformParams());
        
        // the Dirichlet domain of the transformed group, when it is on
        mGroup = mDirichlet.apply(mGroup);

        //console.log("onGroupChanged()", mGroup);

        DataPacking.packGroupToSampler(mGLCtx.gl, mPackedGroupData, mGroup);

        updateTransGroup();
        mGroupChanged = false;
        // the group is the new one from here on: the navigator's conformal transformations
        // that depend on it (the fixed points of a word) find their values again
        if (mNavigator.onGroupChanged) mNavigator.onGroupChanged(mGroup);
    }


    //
    //
    //
    function onCanvasSize() {

        let conf = mConfig.display;

        let canvInfo = CanvasSize.getCanvas(conf.canvasSize);
        if (DEBUG)
            console.log(`${MYNAME}.onCanvasSize() canvInfo: `, canvInfo);

        let scale = conf.sizeMultiplier;

        if (canvInfo == CanvasSize.FIT_TO_WINDOW) {
            let style = mCanvas.container.style;
            style.width = '100%';
            style.height = '100%';
            style.top = '0px';
            style.left = '0px';
            //mCanvas.container.style.borderWidth = '0px';
        } else if (canvInfo == CanvasSize.CUSTOM) {
            setCanvasSize(mCanvas.container, conf.customWidth / scale, conf.customHeight / scale);
        } else {
            setCanvasSize(mCanvas.container, canvInfo.width / scale, canvInfo.height / scale);
        }

        resizeCanvases();
        if (DEBUG)
            console.log(`${MYNAME} onCanvasSize() `, mCanvas.glCanvas.width, mCanvas.glCanvas.height);
        mCanvasTransform.onCanvasResize();
        scheduleRepaint();

    } // function onCanvasSize()


    function setCanvasSize(elem, width, height) {

        if (DEBUG)
            console.log(`${MYNAME}.setElementSize(${width}, ${height})`);
        let pr = getPixelRatio();
        width = (width + 0.35) / pr;
        height = (height + 0.35) / pr;
        if (DEBUG)
            console.log(`${MYNAME}.setElementSize() corrected size: (${width} x ${height})`);

        var swidth = width + 'px';
        var sheight = height + 'px';
        let style = elem.style;

        style.width = swidth;
        style.height = sheight;
        style.top = '0px';
        style.left = '0px';

    }

    function onToggleRun() {

        if (mConfig.simulationRunning) {
            stopAnimation();
        } else {
            startAnimation();
        }
        scheduleRepaint();
    }

    // ── Script UI handlers (thin wrappers — implementation in SymRendererScripting) ──

    /** Files > "Open Script..." — opens file picker and loads the chosen script */
    function onOpenScript() { mScripting.onOpenScript(); }

    /** Restart button — resets animTime to 0, notifies script via setTime(0) */
    function onRestartAnimation() { mScripting.onRestartAnimation(); }

    /** Insert Run/Restart buttons into toolbar when a script is loaded at runtime */
    // (no longer needed here — handled inside mScripting.onOpenScript)

    function stopAnimation(){

        mConfig.simulationRunning = false;
        if (mParams && mParams.runSim) {
            mParams.runSim.setName(LABEL_RUN);
        }
        let run = mToolbox && mToolbox.buttons.run;
        if (run){
            run.src = IMG_RUN;        
            run.title = LABEL_RUN;
        }
        scheduleRepaint();
    }

    function startAnimation(){
        if(DEBUG) console.log(`${MYNAME}.startAnimation()`); 
        mConfig.simulationRunning = true;
        if (mParams && mParams.runSim) {
            mParams.runSim.setName(LABEL_STOP);
        }
        let run = mToolbox && mToolbox.buttons.run;
        if (run){
            run.src = IMG_STOP;
            run.title = LABEL_STOP;
        }
        scheduleRepaint();
    }

    function onShowChecker() {
        let style = mCanvas.container.style;

        if (mConfig.misc.options.showChecker) {
            style.backgroundImage = 'conic-gradient(#e0e0e0 25%, #ffffff 25% 50%, #e0e0e0 50% 75%, #ffffff 75%)';
            style.backgroundSize = '20px 20px';
        } else {
            style.backgroundImage = 'none';
        }
    }

    //
    //  listener for simulation changed events
    //
    function onSimulationChanged(ev) {

        if (false) console.log('onSimulationChanged:', ev);
        if (!mConfig.simulationRunning) {
            // repaint if simulation is not running
            // otherwise repaint will happens anyway
            scheduleRepaint();
        }
    }

    function onTransformChanged() {
        //if (!mConfig.simulationRunning)
        scheduleRepaint();
        scheduleNavigatorRefresh();
    }

    function scheduleRepaint() {
        //console.log('scheduleRepaint()');
        //console.trace();
        mNeedRepaint = true;

    }

    function clearRepaintFlag(){
        
        mNeedRepaint = false;
        
    }

    function onResize() {

        if(DEBUG)console.log(`${MYNAME}.onResize():`, mCanvas.glCanvas.clientWidth);
        // resize the backing store BEFORE recomputing the transform.
        // onCanvasResize() caches width/height/aspect from the canvas, but the
        // backing store was only resized later, inside renderFrame() ->
        // resizeCanvases(), which never re-notifies the transform. The cached
        // aspect therefore stayed at the PRE-resize shape: rotating a phone
        // left every tile stretched until reload. onCanvasSize() (startup)
        // already uses this order.
        resizeCanvases();
        mCanvasTransform.onCanvasResize();
        scheduleRepaint();
    }

    function onToolNameChanged() {

        if (DEBUG)
            console.log(`${MYNAME}.onToolChanged() tool:`, mConfig.tools.toolName);
        setTool(mConfig.tools.toolName);

    }

    //
    // set the active tool from given toolName; taken: the user took it up
    // (its palette or toolbox button, its key), not a load or a program
    //
    function setTool(toolName, taken = false) {

        let btns = mToolbox ? mToolbox.buttons : null;
        let tools = btns ? [btns.move, btns.draw, btns.pick, btns.patternTransform, btns.symmetry,
                            ...mPatternTools.map(t => btns[TOOL_PATTERN_PREFIX + t.name])] : [];
        let toolBtn = btns ? btns[toolName] : null;
        const BGRND1 = "rgba(80, 80, 80, 0.9)";
        const BGRND2 = "rgba(255, 255, 255, 0.9)";
        if (toolBtn) {
            toolBtn.style["background-color"] = BGRND1;
        }
        tools.forEach((e) => {
            if (e && e != toolBtn)
                e.style["background-color"] = BGRND2;
        });

        mConfig.tools.toolName = toolName;
        // the symmetry's handles are the Symmetry tool's (routeSymmetryTool takes them up):
        // left, they drop what they were in the middle of
        if (toolName !== TOOL_SYMMETRY) {
            mDirichlet.setActive(false);
            mGroupTransformTool.setActive(false);
            if (mGroupUITool && mGroupUITool.setActive) mGroupUITool.setActive(false);
        }
        if (mToolPalette) mToolPalette.setActive(toolName);
        updatePropertyBar(toolName);
        activeTool = null;
        // the pattern tools learn when they are taken up and left, to drop what
        // they were in the middle of; setActive(true, true): the user took it
        // up (the Tile tool then selects or adds a tile, which a load must not)
        const patternTool = getPatternTool(toolName);
        mPatternTools.forEach(t => { if (t.setActive) t.setActive(t === patternTool, taken && t === patternTool); });
        if (patternTool) {
            mCanvas.overlay.style.cursor = patternTool.cursor || 'crosshair';
            activeTool = patternTool;
            mActiveTools = [patternTool, mNavigator];
            toolName = '';
        }

        switch (toolName) {
        case '':
            break;
        default:
            mActiveTools = [mNavigator];
            break;
        case TOOL_MOVE:
            mCanvas.overlay.style.cursor = [CUR_MOVE, 'move'];
            mFrameCursor = '';
            // the view only: the symmetry's handles are the Symmetry tool's
            mActiveTools = [mNavigator];
            break;
        case TOOL_SYMMETRY:
            mCanvas.overlay.style.cursor = 'default';
            // the Dirichlet domain's and the group maker's handles (the edges of the
            // orbifold's domain), as their toggles say, get first crack at the events
            routeSymmetryTool();
            if (mSymWindow) mSymWindow.openForTool();
            break;
        case TOOL_PICK:
            mCanvas.overlay.style.cursor = [CUR_PICK, 'crosshair'];
            if (!mDrawingToolHandler) {
                mDrawingToolRenderer.init({ctx: mGLCtx});
                // hand the handler a live view of the active tool, otherwise it
                // cannot tell picking from drawing
                mDrawingToolHandler = DrawingToolHandler({
                    renderer: mDrawingToolRenderer,
                    getToolName: () => mConfig.tools.toolName,
                });
            }
            mActiveTools = [mDrawingToolHandler, mNavigator];
            break;
        case TOOL_DRAW:
            mCanvas.overlay.style.cursor = [CUR_DRAW, 'pointer']; //

            mDrawingToolRenderer.init({ctx: mGLCtx});
            mDrawingToolHandler = DrawingToolHandler({
                renderer: mDrawingToolRenderer,
                getToolName: () => mConfig.tools.toolName,
            });
            mActiveTools = [mDrawingToolHandler, mNavigator];
            break;
        case TOOL_PATTERN_TRANSFORM:
            mCanvas.overlay.style.cursor = [CUR_MOVE, 'move'];
            if (!mPatternTransformHandler) {
                mPatternTransformHandler = PatternTransformHandler({
                    config: mConfig.patternTransConfig,
                    onChanged: onPatternTransformChanged,
                    canvasTransform: mCanvasTransform,
                    overlay: mCanvas.overlay,
                    cursorMove: [CUR_MOVE, 'move'],
                    cursorTransform: [CUR_PATTERN_TRANSFORM, 'move'],
                    getGroup: getGroup,
                    // the pattern box may be placed by a bent pose: the drags move in the geometry of the group
                    canBend: patternCanBend,
                    // the handles are found by pixels at the pointer, by the view's local scale there
                    scaleAt: (cpnt) => mView.scaleAt(cpnt),
                    // the images of a pattern of several, the shown ones: each can be selected and moved
                    getImageTransforms: shownImageTransforms,
                });
            }
            if (!mPatternTransformRenderer) {
                mPatternTransformRenderer = PatternTransformRenderer({
                    config: mConfig.patternTransConfig,
                    handler: mPatternTransformHandler
                });
            }
            activeTool = mPatternTransformRenderer;
            mActiveTools = [mPatternTransformHandler, mNavigator];
            break;
        }

        if (mParams && mParams.tools && mParams.tools.tool) {
            mParams.tools.tool.updateDisplay();
        }
        scheduleRepaint();
    }

    function disableBlending(){
        
        let gl = mGLCtx.gl;
        gl.disable(gl.BLEND);        
        
    }
            
    //
    //  render GL canvas
    //
    function renderGLCanvas() {

        const ptc = mConfig.patternTransConfig;    

        const renderParams = {
                patternTransConfig: ptc,
                timeStamp:          mTimeStamp,
                // the visualization layers, for a pattern that renders only
                // what the enabled layers sample
                visLayers:          mVisualization.getLayers ? mVisualization.getLayers() : [],
                };
        // the pattern renders its data here when it changed (e.g. a PatternImage after an edit)
        const patternData = timed('pattern data', () => mPattern.getPatternData(renderParams));
        // the navigator's uniforms first: they advance its animated motion
        const navigatorUni = mNavigator.getUniforms({}, mTimeStamp);
        // phase 2: the anchor's steps change the navigator's true transform
        if (updateViewAnchor() && mNavigator.moebiusUniforms) mNavigator.moebiusUniforms(navigatorUni);
        carryToolWorld();
        mVisualization.render({
                patternData,
                dataBuffer:     patternData.getMainBuffer(), 
                navigator:      mNavigator,
                timeStamp:      mTimeStamp,                    
                renderUni:      getRenderUni(),
                navigatorUni,
                canvas:         mCanvas.glCanvas,
                group:          mGroup,
                anchor:         mViewAnchor,
                patternTransform: ptc,
                timing:         mActiveTiming,
                });

        // the editing overlay: the group's handles, the group transform's frame and the
        // Dirichlet domain's marks (the Symmetry tool's, as its toggles say; the later on top,
        // as the first to take a press) and the active tool's geometry, in world
        // coordinates, over the layers, through the same chain of maps as the picture
        if (mEditingOverlay.isReady() && !mHideEditing) {
            const geometry = mergeGeometry(
                groupToolDrawsOnGPU() ? mGroupUITool.getOverlayGeometry() : null,
                mGroupTransformTool.getOverlayGeometry(),
                mDirichlet.getOverlayGeometry(),
                (activeTool && activeTool.getOverlayGeometry) ? activeTool.getOverlayGeometry() : null);
            if (geometry.polylines.length || geometry.points.length || geometry.splanes.length) {
                // the tools' transform (anchored far out: InversiveNavigator.getToolTransform)
                const toolUni = mNavigator.getUniforms({}, mTimeStamp);
                if (mNavigator.toolUniforms) mNavigator.toolUniforms(toolUni);
                // the tools' chain composed in double, centred at the view (uEditView): exact
                // where the float chain of the uniforms is not
                const ect = mNavigator.canvasTransform || mCanvasTransform;
                const em = mNavigator.viewChain ? centredViewMap(ect.getCenter(), chainMirrors(mNavigator.viewChain(true))) : null;
                Object.assign(toolUni, em ? { uEditView: true, uEditViewQ: em.q, uEditViewAB: em.AB, uEditViewAnti: em.anti } : { uEditView: false });
                mEditingOverlay.render({ navigatorUni: toolUni, renderUni: getRenderUni(), canvas: mCanvas.glCanvas }, geometry);
            }
            // the selected conformal transformation's handles and marks, in the plane of its
            // row: the same pass with the view's chain cut at the row (TransformHandles.js)
            const pass = transformHandlesOn() ? mTransformHandles.getOverlayPass() : null;
            if (pass) {
                const uni = mNavigator.getUniforms({}, mTimeStamp);
                if (mNavigator.toolUniforms) mNavigator.toolUniforms(uni);
                const packed = packViewChain(pass.chain.steps);
                Object.assign(uni, { uViewChainCount: packed.count, uViewChainStep: packed.steps, uViewChainData: packed.data });
                const ect = mNavigator.canvasTransform || mCanvasTransform;
                const em = centredViewMap(ect.getCenter(), chainMirrors(pass.chain));
                Object.assign(uni, em ? { uEditView: true, uEditViewQ: em.q, uEditViewAB: em.AB, uEditViewAnti: em.anti } : { uEditView: false });
                mEditingOverlay.render({ navigatorUni: uni, renderUni: getRenderUni(), canvas: mCanvas.glCanvas }, pass.geometry);
            }
        }
    }

    //
    //  the view anchor of this frame: the world point of the view's centre through the
    //  navigator's chain, in double. Off in the sphere's geometry (finite groups, a few
    //  steps) and while the navigator's infinite pan is off (getInfinitePan, the
    //  orientation tool's bar; off by default, 2026-11-12).
    //  Phase 2, when the navigator can keep the anchored view (anchorable): the anchored
    //  point of the centre is folded, the steps go into the navigator's anchored
    //  transform, and that transform is the view's chain (docs/infinite_navigation_plan.md)
    //  returns true when the navigator's true transform changed (the anchor's steps)
    //
    //
    //  the tools' world changed (InversiveNavigator.takeToolWorldChange: an anchor
    //  step, home left or reached, a gesture's end): what the pattern's tools hold in
    //  it (the selection's copies) is carried by the change h, in pattern coordinates
    //  (h carried as the group is, updateTransGroup), so the same copies stay selected
    //
    function carryToolWorld(){
        if (!mNavigator.takeToolWorldChange) return;
        const h = mNavigator.takeToolWorldChange();
        if (!h || !mPattern || !mPattern.toolWorldChanged) return;
        const H = new ITransform(h.slice(), '').applyTransform(poseInverseTransform(mConfig.patternTransConfig));
        mPattern.toolWorldChanged(H);
    }

    function updateViewAnchor(){
        const geo = mNavigator.groupAbsolute ? mNavigator.groupAbsolute() : null;
        const infinite = !!(mNavigator.getInfinitePan && mNavigator.getInfinitePan());
        const enabled = infinite && !(geo && geo.kind === 'spherical');
        const anchored = enabled && !!mGroup && !!mNavigator.anchorable && mNavigator.anchorable();
        if (anchored) {
            const ct = mNavigator.canvasTransform || mCanvasTransform;
            mNavigator.anchorFrame(mViewAnchor, mGroup);
            const r = viewChainToWorld(mNavigator.anchoredChain(true), ct.getCenter());
            mViewAnchor.update({ group: mGroup, refPoint: (r && r.exact) ? r.pnt : null, enabled, anchored: true });
            const stepped = mNavigator.absorbAnchorSteps(mViewAnchor);
            mViewUniforms = mViewAnchor.getViewUniforms(ct.getCenter(), chainMirrors(mNavigator.anchoredChain(true)));
            if (mViewAnchor.isPending() && mAnchorFrames++ < MAX_ANCHOR_FRAMES) scheduleRepaint();
            else if (!mViewAnchor.isPending()) mAnchorFrames = 0;
            return stepped;
        }
        if (mNavigator.leaveAnchored) mNavigator.leaveAnchored(mViewAnchor);
        let refPoint = null, disk = null, band = null;
        if (enabled) {
            const ct = mNavigator.canvasTransform || mCanvasTransform;
            const c = ct.getCenter();
            // the circle round the canvas: half its diagonal in plane units
            const cu = ct.getUniforms({});
            const radius = cu.u_scale*Math.hypot(1, cu.u_aspect);
            if (mNavigator.viewChain) {
                const r = viewChainToWorld(mNavigator.viewChain(), c);
                if (r && r.exact) refPoint = r.pnt;
                band = bandFrame(mNavigator.viewChain(true), c);
                const mirrors = chainMirrors(mNavigator.viewChain(true));
                if (refPoint && !band) disk = mirrors ? (viewDisk(c, mirrors, radius) || { c: refPoint, r: Infinity })
                                                      : sampledViewDisk(mNavigator.viewChain(), c, radius, refPoint);
            } else {
                refPoint = c;
                disk = { c, r: radius };
            }
        }
        // the anchor folds the view's disk (ViewAnchor.update): near F nothing, the picture as
        // without it; along a band it walks the band (band mode)
        mViewAnchor.update({ group: mGroup, refPoint, viewDisk: disk, enabled, band: band ? band.walk : null });
        // step 1b: a chain of Moebius maps alone is composed with the anchor in double, a
        // chain round the whole band too, the band of the pixel's offset taken in the shaders
        const ct = mNavigator.canvasTransform || mCanvasTransform;
        if (band) {
            const bu = mViewAnchor.getBandUniforms();
            mViewUniforms = bu.uAnchorBand ? { ...bu, uAnchorBandQ: band.pre.q, uAnchorBandAB: band.pre.AB, uAnchorBandAnti: band.pre.anti } : bu;
        } else {
            const mirrors = !enabled ? null : mNavigator.viewChain ? chainMirrors(mNavigator.viewChain(true)) : [];
            mViewUniforms = mViewAnchor.getViewUniforms(ct.getCenter(), mirrors);
        }
        // a jump far out takes the anchor several frames (its step budget): draw on,
        // but not forever (a centre on a Kleinian group's limit set never gets home)
        if (mViewAnchor.isPending() && mAnchorFrames++ < MAX_ANCHOR_FRAMES) scheduleRepaint();
        else if (!mViewAnchor.isPending()) mAnchorFrames = 0;
        return false;
    }

    //
    //  the band's frame of the view (ViewAnchor.js bandViewFrame): the chain is Moebius
    //  maps round the whole band (ViewChain.js viewChainBand) and those after the band take
    //  its disk onto the absolute of the group, a hyperbolic one; then a pan along the band
    //  is a motion of the group's plane, the anchor walks the band and the shaders take the
    //  band of the pixel's offset alone (docs/fold_precision_assessment.md, section 6.4).
    //  Null otherwise: the view's disk is folded as for any chain
    //
    function bandFrame(chain, c){
        const split = viewChainBand(chain);
        if (!split) return null;
        const geo = mNavigator.groupAbsolute ? mNavigator.groupAbsolute() : null;
        if (!geo || geo.kind !== 'hyperbolic') return null;
        return bandViewFrame(c, split.pre, split.post, split.rate, geo);
    }

    //
    //  the view's disk of a chain with projection maps (not a Moebius map): round the
    //  world points of the circle round the canvas, with room to spare; Infinity where the
    //  chain is not defined
    //
    function sampledViewDisk(chain, c, radius, refPoint){
        let r = 0;
        for (let k = 0; k < 16; k++) {
            const a = k*Math.PI/8;
            const w = viewChainToWorld(chain, [c[0] + radius*Math.cos(a), c[1] + radius*Math.sin(a)]);
            if (!w.exact) return { c: refPoint, r: Infinity };
            r = Math.max(r, Math.hypot(w.pnt[0] - refPoint[0], w.pnt[1] - refPoint[1]));
        }
        return { c: refPoint, r: 1.5*r };
    }

    //
    //  the reflections of a view chain (ViewChain.js) made of Moebius maps alone:
    //  the navigator's transform and the fixed points transformations of its list;
    //  null with the sphere or a conformal transformation of another kind
    //
    function chainMirrors(chain){
        return viewChainMirrors(chain);
    }

    //
    //  returns common uniforms used for symmetric rendering 
    //
    function getRenderUni(){
        
        const ptc = mConfig.patternTransConfig;    
        
        let visConf     = mConfig.misc;
        let symOptions  = mConfig.symmetry.options;
        let simBuffer   = mPattern.getPatternData({patternTransConfig:ptc}).getMainBuffer();

        let ss = 0.5 / ptc.scale; // 0.5 - because texture box originaly has range [0,1]. But drawing images have range [-1,1]
        let sa = ptc.angle * TORADIANS;
        
        let renderUni = {
            uBufScale:      [ss * Math.cos(sa), -ss * Math.sin(sa)],
            uBufCenter:     [ptc.centerX, ptc.centerY],
            uBufBend:       poseBendUniform(ptc),   // the bend of the pattern box's pose (bufferPose.glsl.mjs)
            uSimBuffer:     simBuffer.read,
            uGroupData:     mPackedGroupData,
            uIterations:    symOptions.symIterations,
            // each layer sets its own (VisualizationManager.render); on for the rest
            uSymmetry:      true,
            // the view anchor (updateViewAnchor): uAnchorEnabled, its map
            ...mViewAnchor.getUniforms(),
            ...mViewUniforms,
        }
                
        return renderUni;
    }
        
    let mPrevTime = 0;

    //
    //  main painting function, repaint everything
    //
    function onRepaint() {

        let DEBUG_REC = false;
        if(DEBUG_REC) console.log(`${MYNAME}.onRepaint() mNeedRepaint:`,mNeedRepaint);
        requestAnimationFrame(onRepaint);
        if (mIsExporting) return;
        let time = Date.now();
        let deltaTime = time-mPrevTime;
        
        mPrevTime = time;
        
        if(mConfig.simulationRunning) {
            let rcfg = mConfig.recording;
            rcfg.animTime += rcfg.animSpeed*(deltaTime*MS);
            mParams.recording.animTime.updateDisplay();
        }
        
        mTimeStamp = time - mStartTime;

        if (mTimingWindow && mTimingWindow.isVisible()) {
            if (mTimingContinuous) mNeedRepaint = true;
            // GPU results of the last frame arrive later: show them when nothing is drawn
            else if (!mNeedRepaint && mTiming.poll()) updateTimingWindow();
        }

        if (!mNeedRepaint) {
            return;
        }
        clearRepaintFlag();
                
        if(DEBUG_REC) console.log(`${MYNAME}.isRecording():`,mRecorder.isRecording());
        if (mRecorder.isRecording()) {
            if(DEBUG_REC) console.log(`${MYNAME}.mRecorder.isReady()`,mRecorder.isReady());
            if (mRecorder.isReady()) {
                               
                // TODO mTimeStamp has to be taken from mRecorder
                mTimeStamp = mRecorder.getNextFrameTime();
                mConfig.recording.currentFrame = mRecorder.getFrameCount();
                mParams.recording.currentFrame.updateDisplay();
                mConfig.recording.animTime = mTimeStamp;
                mParams.recording.animTime.updateDisplay();
                
                renderTimedFrame();
                mRecorder.appendFrame(mCanvas.glCanvas);
                mNeedRepaint = mNeedRepaint || mConfig.simulationRunning;

            } else {
                // recorder is not ready yet
                mNeedRepaint = mNeedRepaint || mConfig.simulationRunning;
                //requestAnimationFrame(onRepaint);
                //return;
            }
        } else {
            // no recording
            renderTimedFrame();
            mNeedRepaint = mNeedRepaint || mConfig.simulationRunning;
            //requestAnimationFrame(onRepaint);
        }
        //requestAnimationFrame(onRepaint);

    } // onRepaint

    //
    // main rendering function. 
    //
    function renderFrame() {

        mScripting.events.fire('beforeRender');

        if(mGroupChanged)
            prepareGroupData();
            
        if (mConfig.simulationRunning) {
        
            // Let the script update params for this time step
            timed('script', () => mScripting.callSetTime(mConfig.recording.animTime));

            timed('simulation', () => {
                if(mPattern.doStep) {
                    mPattern.doStep();
                }
                if(mPattern.render){
                    mPattern.render({gl:mGLCtx.gl, animationTime: mConfig.recording.animTime});
                }
            });
        } 

        resizeCanvases();
        onClearOverlay();
        onClearGLCanvas();
        
        renderGLCanvas();
        
        timed('2D overlay', () => {
            let opt = mConfig.misc.options;
            if (opt.showGrid || opt.showRuler)
                onDrawGridAndRuler();

            // the document's frame, under the tools' marks: shown in every tool, its handles in
            // the orientation tool; never in an export or a thumbnail
            if (mNavigator.renderDocumentFrame && !mIsExporting)
                mNavigator.renderDocumentFrame(mOverlayCtx, mConfig.tools.toolName === TOOL_MOVE);

            // the group's handles: on the 2D canvas where the GPU pass does not draw them, else
            // their text only (the orders' labels, a handle's values)
            if (groupHandlesShown() && mGroupUITool.renderUI && !groupToolDrawsOnGPU()) {
                mGroupUITool.renderUI(mOverlayCtx, mCanvasTransform);
            } else if (groupToolDrawsOnGPU() && mGroupUITool.renderText) {
                mGroupUITool.renderText(mOverlayCtx, mCanvasTransform);
            }
            if (!mEditingOverlay.isReady()) mGroupTransformTool.renderUI(mOverlayCtx, mCanvasTransform);
            // the pole of the navigator's inversive mode, moved in the orientation tool
            if (mConfig.tools.toolName == TOOL_MOVE && mNavigator.renderPole) mNavigator.renderPole(mOverlayCtx);
            // the Dirichlet domain's points, planes and sides show in the Symmetry tool with
            // its Dirichlet handles on (the tool is active then, it draws nothing else). The
            // GPU pass draws them, the 2D canvas their text
            if (mEditingOverlay.isReady()) mDirichlet.renderText(mOverlayCtx, mCanvasTransform);
            else mDirichlet.renderUI(mOverlayCtx, mCanvasTransform);

            // a tool that gives its geometry to the GPU pass keeps the 2D canvas for text only (renderText)
            if (activeTool && activeTool.getOverlayGeometry && mEditingOverlay.isReady()) {
                if (activeTool.renderText) activeTool.renderText(mOverlayCtx, mCanvasTransform);
            } else if (activeTool && activeTool.renderUI) {
                activeTool.renderUI(mOverlayCtx, mCanvasTransform);
            }

            // the selected conformal transformation's handles, over the tools' marks: their
            // labels (the GPU pass drew the rest), or all of them without that pass; never
            // in an export or a thumbnail
            if (!mIsExporting && !mHideEditing && transformHandlesOn()) {
                if (mEditingOverlay.isReady()) mTransformHandles.renderText(mOverlayCtx);
                else mTransformHandles.renderUI(mOverlayCtx);
            }

            updateDataPlot();
        });

        mScripting.events.fire('afterRender');

    } // function renderFrame()

    //
    //  frame timing, shown in the 'timing' window (display > show timing...)
    //
    //  mTiming exists once the window was opened; it measures only while the
    //  window is visible. renderFrame() is also called by image export and
    //  scripts; those frames are not measured (no beginFrame), timed() then
    //  just runs the function.
    //
    function timed(label, fn) {
        return mActiveTiming ? mActiveTiming.section(label, fn) : fn();
    }

    function renderTimedFrame() {
        const measure = mTiming && mTiming.isEnabled();
        if (measure) mTiming.beginFrame();
        renderFrame();
        if (measure) {
            mTiming.endFrame();
            updateTimingWindow();
        }
    }

    function onShowTiming() {
        if (!mTiming) mTiming = FrameTiming({ gl: mGLCtx.gl });
        mActiveTiming = mTiming;
        if (!mTimingWindow) {
            mTimingWindow = createStatsWindow({
                title:     'timing',
                width:     '420px',
                height:    '300px',
                left:      '10px',
                top:       '60px',
                storageId: 'symrenderer_timing_window',
                buttons: [{
                    label:   'benchmark',
                    title:   'Render 30 frames back to back after a warm-up and show their mean times. '
                           + 'A lightly loaded GPU runs at low clocks, so the live times can be several times longer than the real cost',
                    onClick: () => runTimingBenchmark(30),
                }],
                options: [{
                    label:    'repaint continuously',
                    title:    'Render every animation frame, not only after a change, so the averages settle',
                    checked:  mTimingContinuous,
                    onChange: (on) => { mTimingContinuous = on; scheduleRepaint(); },
                }],
                onClose: (visible) => {
                    mTiming.setEnabled(visible);
                    if (visible) scheduleRepaint();
                },
            });
        }
        mTimingWindow.show();
        mTiming.setEnabled(true);
        scheduleRepaint();
        updateTimingWindow();
    }

    //
    //  benchmark: after a warm-up (the GPU raises its clocks under load) render
    //  the frame `frames` times back to back and keep the means of the sections
    //  in mBenchTiming; the window shows them next to the live averages. A
    //  running simulation is stepped by these frames too.
    //
    let mBenchRunning = false;
    async function runTimingBenchmark(frames) {
        if (mBenchRunning || !mTiming) return;
        mBenchRunning = true;
        const gl = mGLCtx.gl;
        const px = new Uint8Array(4);
        const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        try {
            mActiveTiming = null;
            const t0 = performance.now();
            while (performance.now() - t0 < 300) { renderFrame(); sync(); }
            mBenchTiming = FrameTiming({ gl, mean: true });
            mBenchTiming.setEnabled(true);
            mActiveTiming = mBenchTiming;
            for (let i = 0; i < frames; i++) {
                mBenchTiming.beginFrame();
                renderFrame();
                mBenchTiming.endFrame();
            }
            sync();
        } finally {
            mActiveTiming = mTiming;
        }
        // the GPU results arrive after returning to the event loop
        for (let k = 0; k < 200 && mBenchTiming.pendingCount(); k++) {
            await new Promise(r => setTimeout(r, 10));
            mBenchTiming.poll();
        }
        mBenchRunning = false;
        scheduleRepaint();
        updateTimingWindow();
    }

    function updateTimingWindow() {
        if (!mTimingWindow || !mTimingWindow.isVisible()) return;
        const st = mTiming.getStats();
        const ms = (v) => (v === null || v === undefined) ? '—' : v.toFixed(2);
        const bench = mBenchTiming ? mBenchTiming.getStats() : null;
        const cnv = mCanvas.glCanvas;
        const lines = [
            ['canvas', `${cnv.width} × ${cnv.height} (${(cnv.width * cnv.height / 1e6).toFixed(2)} Mpx)`],
            ['frame interval', st.interval ? `${st.interval.toFixed(1)} ms (${(1000 / st.interval).toFixed(0)} fps)` : '—'],
            ['frames', String(st.frames)],
        ];
        let columns = ['ms', 'GPU', 'CPU'];
        let rows = st.sections.map(s => [s.label, ms(s.gpu), ms(s.cpu)]);
        let footer = ['frame', ms(st.gpuFrame), ms(st.cpuFrame)];
        let note = 'live: averages of the recent frames; the app draws only after a change unless "repaint continuously" is on';
        if (bench) {
            // the benchmark columns, rows matched by label; sections only one of them has get a dash
            columns = columns.concat(['bench GPU', 'bench CPU']);
            const labels = st.sections.map(s => s.label);
            for (const b of bench.sections) if (!labels.includes(b.label)) labels.push(b.label);
            rows = labels.map(label => {
                const l = st.sections.find(x => x.label === label) || {};
                const b = bench.sections.find(x => x.label === label) || {};
                return [label, ms(l.gpu), ms(l.cpu), ms(b.gpu), ms(b.cpu)];
            });
            footer = footer.concat([ms(bench.gpuFrame), ms(bench.cpuFrame)]);
            note += `; bench: means of ${bench.frames} frames rendered back to back`;
        }
        if (!st.gpuAvailable) note = 'GPU time is not available in this browser (EXT_disjoint_timer_query_webgl2); ' + note;
        mTimingWindow.update({ lines, columns, rows, footer, note });
    }

    function updateDataPlot(){        

        if (mDataPlot.isVisible()) {
            onPreparePlotData();
            mDataPlot.repaint();
        }
    }

    function onClearGLCanvas() {
        let gl = mGLCtx.gl;
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        let c = hexToPremult(mConfig.display.backgroundColor);
        //console.log('c:', c);
        gl.clearColor(c[0], c[1], c[2], c[3]);
        gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
    }

    function onClearOverlay() {
        mOverlayCtx.clearRect(0, 0, mCanvas.overlay.width, mCanvas.overlay.height);
    }

    function onPatternTransformChanged() {

        const ptc = mConfig.patternTransConfig;
        // only a pattern that can take a bent placement keeps a bend (a drawing's maps are a similarity's)
        if ((ptc.bendX || ptc.bendY) && !patternCanBend()) { ptc.bendX = 0; ptc.bendY = 0; }
        if(false) console.log(`${MYNAME}.onPatternTransformChanged()`, ptc);
        mPatternTransform.setParams({
            center: [ptc.centerX, ptc.centerY],
            scale: ptc.scale,
            angle: ptc.angle * TORADIANS,
            bend: poseBend(ptc),
        });
        updateTransGroup();
        scheduleRepaint();

        if (mParams && mParams.pattern && mParams.pattern.patternTransform) {
            mParams.pattern.patternTransform.updateDisplay();
        }
    }

    //
    //  update transformed group data
    //
    function updateTransGroup() {

        const ptc = mConfig.patternTransConfig;
        // transform group into texture space: the inverse of the pose of the pattern
        // box (the similarity's inverse, then the bend's; PatternPose.js)
        const tr = poseInverseTransform(ptc);

        mTransGroup = mGroup.clone();
        mTransGroup.applyTransform(tr);

        // the box it was put in, and the transform from the maker's coordinates to the world
        // (a drawing's clipboard knows the same group in another document by them)
        const t = mConfig.symmetry.transform;
        mPattern.setGroup(mTransGroup, { ptc: { ...ptc },
            groupTransform: { translationX: t.translationX, translationY: t.translationY, rotation: t.rotation, scale: t.scale } });
        if(false) console.log(`${MYNAME}.updateTransGroup()`, mTransGroup);

        DataPacking.packGroupToSampler(mGLCtx.gl, mTransGroupData, mTransGroup);

    }

    function startAnimationLoop() {
        if(DEBUG)console.log(`${MYNAME}.startAnimationLoop(): `, getTime());
        requestAnimationFrame(onRepaint);
        scheduleRepaint();
    }

    function onDrawGridAndRuler() {

        let {
            showGrid,
            showRuler
        } = mConfig.misc.options;
        drawGridAndRuler(mOverlayCtx,
            mCanvas.overlay, {
            canvasTransform: mCanvasTransform,
            hasGrid: showGrid,
            hasRuler: showRuler
        });

    }

    function onPreparePlotData() {

        //let plotData = mPattern.getPlotData();
        //let plotData = getTestPlotData();
        let vc = mConfig.misc;

        let plotData = getPlotData(vc.dataSlice, vc.plotType);
        //console.log('plotData: ', plotData[0])
        mDataPlot.setPlotData(plotData[0], 0);
        mDataPlot.setPlotData(plotData[1], 1);

    }

    function getPlotData(dataSliceY, plotType) {

        //console.log("getPlotData()");

        let gl = mGLCtx.gl;

        const ptcCanon = mConfig.patternTransConfig;
        let simBuffer = mPattern.getPatternData({patternTransConfig:ptcCanon}).getMainBuffer();

        // bind framefuffer to be used
        gl.bindFramebuffer(gl.FRAMEBUFFER, simBuffer.read.fbo);
        let att = gl.COLOR_ATTACHMENT0;
        //gSimBuffer.read.attach(0);
        //gl.framebufferTexture2D(gl.FRAMEBUFFER, att, gl.TEXTURE_2D, gSimBuffer.read.texture, 0);

        let x = 0;
        let y = Math.round(dataSliceY * simBuffer.height);
        let width = simBuffer.width;
        let height = 1;
        let data = readPixelsFromBuffer(gl, att, x, y, width, height);
        let len = data.length / 4;

        let plotDataU = [];
        let plotDataV = [];

        for (let i = 0; i < len; i++) {

            let x = i * 2. / len - 1;

            let u = data[4 * i];
            let v = data[4 * i + 1];

            switch (plotType) {
            default:
            case 0:
                break;
            case 1:
                let u1 = Math.sqrt(u * u + v * v);
                let v1 = Math.atan2(v, u) / Math.PI;
                u = u1;
                v = v1;
            }
            plotDataU.push(x);
            plotDataU.push(u);
            plotDataV.push(x);
            plotDataV.push(v);
        }
        return [plotDataU, plotDataV];
    }

    function getImageName() {
        return getDocumentName();
        //return IMG_PREFIX + date2s(new Date(), '-');
    }

    function getNewDocumentName() {
        return PARAM_PREFIX + date2s(new Date(), '-');
    }

    function getDocumentName(){
        const doc = mDocManager ? mDocManager.getCurrentDocument() : null;
        return doc ? doc.getName() : getNewDocumentName();
    }

    function onRecordingEnded() {
        // call back to refresh UI
        mParams.recording.toggleRecording.setName(LABEL_START_RECORDING);
        mToolbox.buttons.recording.src = IMG_RECORDING_START;
        stopAnimation();

    }

    function onToggleRecording() {

        if (mRecorder.isRecording()) {
            // stop recording
            mRecorder.stopRecording();
            mRecorder.saveRecording();
            mParams.recording.toggleRecording.setName(LABEL_START_RECORDING);
            if (mToolbox.buttons.recording)
                mToolbox.buttons.recording.src = IMG_RECORDING_START;
            if (mConfig.simulationRunning) {
                onToggleRun();
            }
            
        } else {

            mRecorder.startRecording({
                startFrame: mConfig.startFrame,
                endFrame: mConfig.recording.endFrame,
                onEnd: onRecordingEnded
            });
            mParams.recording.toggleRecording.setName(LABEL_STOP_RECORDING);

            if (mToolbox.buttons.recording)
                mToolbox.buttons.recording.src = IMG_RECORDING_STOP;
            if (!mConfig.simulationRunning) {
                onToggleRun();
            }
        }
    }

    function onInitSimulation() {
        
        if (DEBUG) console.log('onInitSimulation()');
        if(mPattern.initSimulation) mPattern.initSimulation();
        

    }

    function onFullScreen() {
        
        let canvas = mCanvas.container;
        const fsFunc = canvas.requestFullscreen || canvas.webkitRequestFullscreen;
        if (fsFunc) fsFunc.apply(canvas);
        
    }

    function toggleGUI() {
        if (!mGUIWindow) {
            initGUI();
        } else {
            const visible = isGUIWindowVisible();
            mGUIWindow.setVisible(!visible);
        }
        updateToolbarSettingsBtnUI();
    }
    
    function setUIvisible(visible){
        if (!mGUIWindow) {
            if (visible) initGUI();
            return;
        }
        mGUIWindow.setVisible(visible);
        updateToolbarSettingsBtnUI();
    }
    

    function onFullScreenChange() {
        if (DEBUG)
            console.log('onFullscreenChange()');
        resizeCanvases();
        onResize();
    }

    //
    //  getParams interface
    //
    function getParams() {

        if (!mParams) {
            mParams = makeParams();
            // its edits are undo steps from now on (a document's values and a script's are not)
            mSymUndo.watch(mParams.symmetry);
        }
        return mParams;

    }

    function getCanvasSize() {
        return {
            width:  mCanvas.glCanvas.width,
            height: mCanvas.glCanvas.height
        };
    }

    function setCanvaSize(width, height) {
        mCanvas.glCanvas.width  = width;
        mCanvas.glCanvas.height = height;
        mCanvas.overlay.width   = width;
        mCanvas.overlay.height  = height;
        mCanvasTransform.onCanvasResize();
    }

    //
    //  Render one frame at an explicit pixel size and return a detached copy of
    //  the result, then restore the previous canvas size.
    //
    //  mIsExporting is raised for the duration so that resizeCanvases() and the
    //  animation loop leave the temporary size alone - the same guard the tiled
    //  image export uses.  The pixels are copied into a plain 2d canvas right
    //  after the draw call, so the caller can encode them at leisure without
    //  depending on the WebGL drawing buffer surviving compositing.
    //
    //  Used by scripted / batch rendering.  Returns an HTMLCanvasElement.
    //
    //  options.view 'document': the document view, its frame whole in the
    //  canvas (as the export of the document view, docs/document_view_plan.md
    //  3.6), the working view back after it; else the view as it is, at the
    //  same zoom. Either way under the transforms as they are (the document's)
    //
    function renderToCanvas(width, height, options = {}) {

        const orig = getCanvasSize();
        const wasExporting = mIsExporting;
        const docView = options.view === 'document' && !!mNavigator.withView && !!mNavigator.getDocumentView;
        let out = null;

        const draw = () => {
            renderSettled();
            const c = document.createElement('canvas');
            c.width  = width;
            c.height = height;
            c.getContext('2d').drawImage(mCanvas.glCanvas, 0, 0);
            return c;
        };
        mIsExporting = true;
        try {
            setCanvaSize(width, height);
            out = docView ? mNavigator.withView(mNavigator.getDocumentView(), 'contain', draw, [width, height]) : draw();
        } finally {
            setCanvaSize(orig.width, orig.height);
            mIsExporting = wasExporting;
            renderSettled();
        }
        return out;
    }

    //
    //  options.marks: the editing marks in the image as on screen: the GPU
    //  overlay (handles, the transform box, the Dirichlet marks) and, in a
    //  single frame (not a tiled TIFF), the 2D overlay canvas (labels, grid,
    //  the move tool's handles)
    //
    //  options.view (docs/document_view_plan.md 3.6):
    //    'document'  the document view (the document's frame: centre, width,
    //                angle), fitted to the image: the frame itself
    //                in an image of its shape, more round it in another; the
    //                document written next to the image is the document as it is
    //    'current'   (the default) the view on screen, scaled; the document
    //                written next to the image has the exported view as its
    //                document view, so opening it shows the image (decision 6)
    //  The working view and the document view are back after it. A navigator
    //  without a document view exports the current view.
    //
    async function exportImageWrapper(chosenName, folderHandle, exportWidth, exportHeight, imgFormat, options = {}) {
        const marks = !!options.marks;
        const nav = mNavigator;
        const hasViews = !!(nav.getDocumentView && nav.setDocumentView && nav.getWorkingView && nav.applyView);
        const docMode = hasViews && options.view === 'document';
        const rendererObj = {
            getCanvasSize: () => getCanvasSize(),
            setCanvaSize: (w, h) => setCanvaSize(w, h),
            canvasTransform: mCanvasTransform,
            writeDocumentToFolder: (fh, name) => mDocManager.writeDocumentToFolder(fh, name),
            // the view anchor settled before each frame is read (infinite pan after a new view)
            renderFrame: () => renderSettled(),
            makeThumbnail: () => makeThumbnail(),
            saveImageTo: (canvas, fh, name, json, type) => mImageSaver.saveImageTo(canvas, fh, name, json, type),
            glCanvas: mCanvas.glCanvas,
            get exportTileSize() { return mRendererConfig.exportTileSize; },
            get exportWidth() { return mRendererConfig.exportWidth; },
            set exportWidth(v) { mRendererConfig.exportWidth = v; },
            get exportHeight() { return mRendererConfig.exportHeight; },
            set exportHeight(v) { mRendererConfig.exportHeight = v; },
            overlayCanvas: marks ? mCanvas.overlay : null,
            // the pattern's buffers as fine as the export's pixels (PatternDrawing), back after it
            setExportScale: (s) => { if (mPattern.setExportScale) mPattern.setExportScale(s); },
            setIsExporting: (v) => {
                mIsExporting = v; mHideEditing = v && !marks;
                if (!v && mPattern.setExportScale) mPattern.setExportScale(1);
            }
        };
        if (!hasViews) return exportImage(chosenName, folderHandle, exportWidth, exportHeight, rendererObj, imgFormat);

        const size = nav.canvasSize();
        const working = nav.getWorkingView();
        const docView = nav.getDocumentView();
        try {
            if (docMode) {
                // the canvas at the document view, its zoom fitted to the image by exportImage
                nav.applyView(docView.view, null, 'exact', size);
                const zoom = docView.view.euclidean ? docView.view.euclidean.zoom : mCanvasTransform.getZoom()[0];
                rendererObj.exportZoom = (w, h) => fitViewZoom(zoom, docView.aspect, w, h, 'contain');
            } else {
                // the image's view, the screen's scaled to the image (exportImage), as the
                // document view of the document written next to it
                const scr = getCanvasSize();
                const view = nav.getWorkingView();
                const zoom = exportViewZoom(mCanvasTransform.getZoom()[0], scr.width, scr.height, exportWidth, exportHeight);
                view.euclidean = { ...(view.euclidean || {}), zoom };
                nav.setDocumentView({ view, aspect: exportHeight / exportWidth });
            }
            await exportImage(chosenName, folderHandle, exportWidth, exportHeight, rendererObj, imgFormat);
        } finally {
            nav.setDocumentView(docView);
            if (docMode) {
                nav.applyView(working, null, 'exact', size);
                renderSettled();
            }
        }
    }

    //
    //  the largest side the GPU draws one frame into, Infinity when unknown
    //
    function getGpuSide() {
        const gl = mGLCtx && mGLCtx.gl;
        if (!gl) return Infinity;
        const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
        const rb = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
        return Math.min(vp ? Math.min(vp[0], vp[1]) : Infinity, rb || Infinity);
    }

    //
    //  Export Image...: the size of the last export (kept in the renderer's
    //  config across sessions), the canvas's own size before any export; the
    //  document's frame or the view as on screen scaled to the size chosen
    //  (the dialog's View, with the frame's aspect)
    //
    function onSaveImage() {
        const name = getImageName();
        const w = mRendererConfig.exportWidth, h = mRendererConfig.exportHeight;
        const size = (w > 0 && h > 0) ? { width: w, height: h } : getCanvasSize();
        mDocManager.openExportImageDialog({
            suggestedName: name,
            suggestedWidth: size.width,
            suggestedHeight: size.height,
            gpuSide: getGpuSide(),
            documentAspect: mNavigator.getDocumentView ? mNavigator.getDocumentView().aspect : null,
            onSave: exportImageWrapper,
        });
    }

    function getParamsAsJSON(name) {

        let pset = {
            name: name,
            appInfo: mAppInfo,
            params: getParamValues(mParams)
        };
        return JSON.stringify(pset, null, 4);

    }


    //
    //  Parses raw JSON text and applies it as document data.
    //  Stays in SymRenderer (uses addLineNumbersWithError; injected into SymDocumentManager).
    //
    function readParamText(txt, name){

        if(DEBUG)console.log(`${MYNAME}.readParamText(): `, name,':\n' + txt.substring(0,100));
        let values = {};
        try {
            values = JSON.parse(txt);
            if (DEBUG) console.log(`${MYNAME}.readParamText() parsed JSON: `, values);
            if (DEBUG) console.log(`${MYNAME}.readParamText() document name: `, values.name);
        } catch (err) {
            let listing = addLineNumbersWithError(txt, err.toString());
            console.error(`${listing}\nJSON syntax error\n file: '${name}'\n ${err}`);
        }
        mDocManager.setDocumentData(values);

    }

    //
    //  a document's thumbnail: the middle square of the picture, without the editing
    //  overlay (the GPU pass draws the tools' marks into the same canvas): a frame
    //  without them for the thumbnail, then the screen's frame again
    function makeThumbnail(){

        const hide = !mHideEditing && mEditingOverlay.isReady();
        if (hide) { mHideEditing = true; renderFrame(); }
        try {
            return getSquareThumbnailCanvas(mCanvas.glCanvas, TMB_WIDTH);
        } finally {
            if (hide) { mHideEditing = false; renderFrame(); }
        }
        //return createImageBitmap(tmbCanvas);
        
    }
    
    //
    //  a document's thumbnail, written with it: its document view (the frame
    //  covering the square, docs/document_view_plan.md 3.5) drawn off screen
    //  without the editing marks, then the working view again. A navigator
    //  without a document view: the screen's middle square (makeThumbnail)
    //
    function makeDocumentThumbnail(){

        if (!mNavigator.withView || !mNavigator.getDocumentView) return makeThumbnail();
        const orig = getCanvasSize();
        const wasExporting = mIsExporting, wasHidden = mHideEditing;
        mIsExporting = true;
        mHideEditing = true;
        try {
            setCanvaSize(TMB_WIDTH, TMB_WIDTH);
            return mNavigator.withView(mNavigator.getDocumentView(), 'cover', () => {
                renderSettled();
                const out = document.createElement('canvas');
                out.width = out.height = TMB_WIDTH;
                out.getContext('2d').drawImage(mCanvas.glCanvas, 0, 0);
                return out;
            });
        } finally {
            setCanvaSize(orig.width, orig.height);
            mIsExporting = wasExporting;
            mHideEditing = wasHidden;
            renderSettled();
        }
    }

    //
    //  a frame drawn, again while the view anchor still folds (infinite pan after a
    //  jump of the view; its steps have a budget per frame), a few times at most
    //
    function renderSettled(){
        renderFrame();
        for (let n = 0; n < 100 && mViewAnchor.isPending(); n++) renderFrame();
    }

    //
    //  a document was loaded (SymDocumentManager, and once at the start): the
    //  navigator takes its view as the document view (docs/document_view_plan.md).
    //  A document opened by the user (info.key, not a script's) then shows the
    //  working view kept for it, when that was made under the same document view
    //  (its stamp, 3.3); one made under another is dropped. A view is the canvas
    //  part alone: the views kept before 2026-11-19 held the transforms too, their
    //  stamps are of another kind and they are dropped with what they held (the
    //  transforms are the file's, docs/conformal_transforms_plan.md decision 10)
    //
    function onDocumentLoaded(info = {}){
        if (mNavigator.documentLoaded) mNavigator.documentLoaded();
        mFileStamp = mNavigator.getDocumentView ? viewStamp(mNavigator.getDocumentView()) : null;
        if (mViewStore && info.key && !info.script && mNavigator.applyView) {
            const kept = mViewStore.get(info.key);
            if (kept && kept.stamp === mFileStamp && kept.view) {
                mNavigator.applyView(kept.view, null, 'exact', mNavigator.canvasSize());
            } else if (kept) {
                mViewStore.remove(info.key);
            }
        }
        scheduleRepaint();
    }

    // the document was saved: the file's document view is the one it has now
    function onDocumentSaved(key){
        mFileStamp = mNavigator.getDocumentView ? viewStamp(mNavigator.getDocumentView()) : null;
        storeWorkingView(key);
    }

    //
    //  keep the working view of the document key in the browser, with the stamp
    //  of the document view of its file (mFileStamp): when the document is left
    //  (another loaded), saved, and when the page is hidden or closed
    //
    function storeWorkingView(key){
        if (!mViewStore || !key || !mFileStamp || !mNavigator.getWorkingView) return;
        mViewStore.set(key, { stamp: mFileStamp, view: mNavigator.getWorkingView() });
    }

    //
    //  Set document view, an edit of the document's frame: an undo step on the
    //  page's stack where it has one (symdraw's drawing stack). The view on the
    //  canvas stays; the frame, when shown, and the bar's fields follow. Steps of
    //  one mergeKey join (a number typed into a frame field)
    //
    function onDocumentViewSet(before, after, mergeKey){
        if (!mPattern || !mPattern.pushUndo) return;
        const set = (dv) => { mNavigator.setDocumentView(dv); if (mNavigator.informListener) mNavigator.informListener(); };
        mPattern.pushUndo({ label: 'document view', mergeKey,
            undo: () => set(before),
            redo: () => set(after) });
    }

    //
    //  return maker of thumbnails for those who wans one
    //
    function getThumbMaker(){
        return {
            getThumbnail: makeDocumentThumbnail,
        };
    }



    //
    //  presentation (generators and relators) of the current group as the group
    //  maker gives it, null when the maker has none: the subgroup code then
    //  works from its catalogue of presentations
    //
    function getGroupPresentation(){
        // the document's permutations stay of the maker's generators when the Dirichlet
        // domain is on: the colour layers take them to its sides (sidePermutations)
        if(mGroupOverride) return null;
        return (mGroupMaker && mGroupMaker.getPresentation) ? mGroupMaker.getPresentation() : null;
    }

    function getGroup(){
        if(DEBUG)console.log(`${MYNAME}.getGroup()`, mGroup);
        return mGroup;
        
    }

    //
    // Return the scripting API facade — delegates to the scripting controller.
    //
    function getScriptAPI() {
        return mScripting.getScriptAPI();
    }

    return myself;

} //function SymRenderer()


export {
    SymRenderer
};
