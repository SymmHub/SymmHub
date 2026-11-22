//
//  SymRenderer.js: the renderer of a symmetric pattern, the core of SymmHub's apps
//  (docs/symrenderer_refactor_plan.md). It keeps the canvas pair and GL, the render loop,
//  the group, the pattern, the visualization, the navigator and the view, the list of
//  tools and the routing of the pointer and the keys to them, the params, the documents,
//  export and scripting. It builds no UI: the page passes a UI builder, which builds the
//  page around the canvas; the renderer tells it everything through the host and its
//  events.
//
//      const app = SymRenderer({ patternCreator, groupMakerFactory, navigator, visualization,
//                                samples, ..., ui: ClassicUI, uiOptions: { ... } });
//      app.run();
//
//  The app's id in the browser's storage (options.docFolderId): its documents' windows
//  (Files, Save As, Export image) keep their folders, places and sizes under it, and its
//  settings (host.storageKey). Without the option: the name of the folder the page is in
//  plus '_doc_folder' (apps/symsim/gray_scott/*.html: 'gray_scott_doc_folder'), so the
//  pages of one app share it and two apps open side by side keep theirs apart.
//
//  The UI builder (options.ui): { create(host, uiOptions) }; ui/ClassicUI.js,
//  ui/WorkspaceUI.js, ui/SimpleUI.js (ui/pickUI.js picks one by ?ui=). create is called
//  once, when the renderer makes its canvas, before the pattern exists: the builder makes
//  the canvas's place, the tools it wants (host.addTool) and its panels, and tells the
//  renderer its choices (host.configure, host.addParams); it builds the rest of the page
//  on the host's 'start'. It returns { canvasHost() }: the element the canvas goes in
//  (null: the page). Without a builder: the bare canvas on the page, and no tool.
//
//  The host (mHost): what the renderer gives its UI, its tools and its panels.
//    reading     canvas {container, glCanvas, overlay}, view, canvasTransform,
//                patternTransform, getNavigator, getGLContext, getGroup, getParams,
//                getPattern, getVisualization, getDocManager, getRendererConfig,
//                getSymmetryParams, getTools, getTool, getToolName, getActiveTool,
//                getDrawingRenderer, canAnimate, isRunning, isRecording,
//                storageKey(name), canvasToPattern(cpnt)
//    commands    scheduleRepaint, renderFrame, setTool(name, taken), addTool,
//                refreshToolUI, refreshToolBar, refreshToolHint, toggleRun, restart,
//                initSimulation, toggleRecording, exportImage, fullscreen, canvasResized,
//                goToPreviousView, setFrameShown, attachScriptFolder(folder),
//                setTransformHandlesRow(getRow), setFrameTiming(timing)
//    in create   configure({ startTool, toolBar, spacePan }),
//                addParams(group, key, make, { after })
//    parts       patternBox: the Pattern box tool's; symmetry: the Symmetry tool's
//    events      addEventListener(type, fn), removeEventListener(type, fn):
//                start, ready; toolChanged {name}, toolStateChanged, toolBarRefresh,
//                toolHintChanged; runChanged {running}, recordingChanged {recording},
//                canAnimateChanged; titleChanged {title}; contextMenu {x, y, items};
//                settingsToggleRequested, globalOptionsRequested, samplesRequested;
//                viewChanged, symmetryEditRequested; frameRendered, frameTimed
//
//  A tool (tools/, or the pattern's createUITool) follows the plan's section 4.3; a panel
//  (panels/) is { create(host) }. The renderer imports nothing from ui/, tools/ or panels/
//  (tests/structure/core_ui.mjs), and they never import the renderer.
//
import {
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
    groupWalls,
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
    getSquareThumbnailCanvas,
    getImageSaver,
    SymRendererPrograms,
    VisualizationManager,
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
    closeGroupTransformsWindow,
}
from "./modules.js";



const MYNAME = 'SymRenderer';
const FILE_FORMAT_RELEASE = 1;
const DEBUG = false;

const PARAM_PREFIX = 'par';

const TMB_WIDTH = 256;
const MS = 0.001; // millisecond
// the start tool: the Orientation tool (lib/symhublib/tools/, given by the UI builder)
const TOOL_MOVE = 'move';
// the recording command's names, while it starts and while it stops a recording
const RECORDING_START = 'Start Recording';
const RECORDING_STOP = 'Stop Recording';
// the editing tools a pattern may provide (pattern.createUITool), e.g. the
// drawing tools of symdraw, are named TOOL_PATTERN_PREFIX + tool.name; a UI
// with a palette shows their tool.label, tool.key, tool.group, tool.help and
// their settings, tool.getProperties() (PropertyBar controls)
const TOOL_PATTERN_PREFIX = 'pattern.';
// the Symmetry tool's sets of handles, each on or off (saved per app in the browser)
// the Dirichlet domain's are off at first: on, they show the base in every document, and
// its settings' switch 'edit' turns them on (2026-11-18)
const SYMMETRY_HANDLES = { group: true, transform: true, dirichlet: false };

// the id all the apps shared before they had one each (2026-11-22): a page off any
// folder keeps it, and an app's settings start from the ones kept under it
const DEFAULT_DOC_FOLDER_ID = 'symrenderer_doc_folder';

// the app's id in the browser's storage when the page names none: the name of the
// folder the page is in, plus '_doc_folder'
function pageDocFolderId() {
    const parts = (globalThis.location?.pathname ?? '').split('/').filter(Boolean);
    const folder = (parts.length > 1) ? parts[parts.length - 2].replace(/[^A-Za-z0-9_-]/g, '_') : '';
    return folder ? folder + '_doc_folder' : DEFAULT_DOC_FOLDER_ID;
}

function SymRenderer(options) {
    // the page's address may add or change options: #{"preset":..., "params":{...}, ...}
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
        // a script loaded later: the page can animate (its UI adds Run and Restart)
        onScriptLoaded:   () => onScriptLoaded(),
        // Animation restart
        getConfig:        () => mConfig,
        getUIParams:      () => mParams,
        // Script list
        scriptUrls:       options.scriptUrls || [],
    });

    // the host's listeners by event (mHost.addEventListener, fireHostEvent)
    const mHostListeners = {};

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
        
    // the app's id in the browser's storage (the header)
    let mDocFolderId = (options.docFolderId) ? options.docFolderId : pageDocFolderId();
    let mPatternCreator = options.patternCreator;
    let mSamples = options.samples;
    let mPreset = options.preset;
    // inline document params from the URL hash: #{"params":{...}}
    let mInlineParams = options.params;
    let mGroupMakerFactory = options.groupMakerFactory;
    let mGroupMaker = null;
    let mDataUpgrader = options.dataUpgrader || null;
    // the UI builder's options (options.uiOptions, docs/symrenderer_refactor_plan.md 4.2):
    // the renderer reads none of them
    const mUIOptions = options.uiOptions || {};
    // what the UI told the renderer (mHost.configure): the tools' settings are in a bar
    // of the UI, Space held down moves the view in every tool
    let mToolBar = false;
    let mSpacePanKey = false;

    // Persistent renderer configuration (localStorage, editable via UI)
    // an app without its own yet starts from the ones the apps shared
    const mRendererConfig = createSymRendererConfig({
        storageKey:  mDocFolderId + '_config',
        fallbackKey: DEFAULT_DOC_FOLDER_ID + '_config',
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
            toolName: TOOL_MOVE,
        },
    };




    // repaint flag
    let mNeedRepaint = false;
    // the frame's timing (a FrameTiming, the UI's timing panel's, host.setFrameTiming): the
    // sections of renderFrame() report to it, and while it is enabled the animation's frames
    // are measured whole
    let mFrameTiming = null;
    let mIsExporting = false;
    // an image export leaves out the editing overlay (handles, the pattern box,
    // the Dirichlet marks) unless the export dialog's 'Handles and marks' asks
    // for them, nor does a document's thumbnail (makeThumbnail); renderToCanvas
    // keeps it, the overlay tests read it
    let mHideEditing = false;
    
    // the canvas; the UI builder says where it goes (mUI.canvasHost)
    const mCanvas = createCanvas();
    
    
    // the params the UI adds (host.addParams): [{group, key, make, after}]
    const mAddedParams = [];
    
    let mTransformHandles = null;   // the selected transformation's handles on the canvas (TransformHandles.js)
    let mTransformHandlesRow = null; // () => the row whose handles they are (the UI's transformations window)
    let mSymPanelParams = null;     // the symmetry param's params, the window's panel

    // recorder of video 
    const mRecorder = createVideoRecorder3({});
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

    // the tools by name, in the order they came: the UI builder's (host.addTool) and the
    // pattern's (named TOOL_PATTERN_PREFIX + tool.name; their events come with the world
    // and pattern points, setPatternToolPoints). One contract for all: name, label, key,
    // icon, group, help, cursor, getProperties, handleEvent or getHandlers, handleKey,
    // setActive, getHint, navigates, getContextMenu, getOverlayGeometry, renderUI, renderText
    // (docs/symrenderer_refactor_plan.md section 4.3)
    const mTools = new Map();       // name -> { tool, owner: 'renderer' | 'pattern' }

    function addTool(tool, owner = 'renderer') {
        mTools.set(owner === 'pattern' ? TOOL_PATTERN_PREFIX + tool.name : tool.name, { tool, owner });
    }

    function getToolNames() {
        return [...mTools.keys()];
    }

    function getTool(toolName) {
        const entry = mTools.get(toolName);
        return entry ? entry.tool : null;
    }

    function getPatternTool(toolName) {
        const entry = mTools.get(toolName);
        return (entry && entry.owner === 'pattern') ? entry.tool : null;
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
        if (mSymEditing) {
            applySymmetryEditing();
            fireHostEvent('toolBarRefresh');
        }
        scheduleRepaint();
    }

    // the Dirichlet domain on the canvas to edit, or not (its switch 'edit', the tool bar's
    // toggle; both through the tool's requestEdit): on asks for the tool that edits the
    // symmetry (the Symmetry tool takes itself up) with the Dirichlet handles and opens the
    // domain's settings; off turns the handles off, the tool stays
    function setDirichletEditing(on) {
        mSymHandles.dirichlet = !!on;
        if (on && !mSymEditing) fireHostEvent('symmetryEditRequested');
        onSymmetryHandlesChanged();
        if (on) mDirichlet.getParams().open();
    }

    // the symmetry is edited on the canvas: the Symmetry tool is active and its sets of
    // handles take the pointer as their toggles say (setSymmetryEditing)
    let mSymEditing = false;
    // those sets, in the order they get the events: the Dirichlet domain's first (the base
    // disc; its clicks on the canvas are the fallback, a click whose press another tool took
    // is that tool's), the group transform's frame (a Euclidean group's: transformFrameOn;
    // before the group's edges, which often run through its centre), the group's; the view
    // after them
    let mSymHandlers = [];

    function setSymmetryEditing(on) {
        mSymEditing = !!on;
        applySymmetryEditing();
    }

    function applySymmetryEditing() {
        const on = mSymEditing;
        const transformOn = on && transformFrameOn();
        mDirichlet.setActive(on && mSymHandles.dirichlet);
        mGroupTransformTool.setActive(transformOn);
        if (mGroupUITool && mGroupUITool.setActive) mGroupUITool.setActive(on && mSymHandles.group && !mGroupOverride);
        mSymHandlers = on ? [mSymHandles.dirichlet ? mDirichlet : null,
                             transformOn ? mGroupTransformTool : null,
                             mSymHandles.group ? mGroupUIToolProxy : null].filter(Boolean) : [];
        refreshActiveTools();
    }

    // the group maker's handles are on the canvas: the symmetry edited, their toggle on, the
    // maker's group the one drawn (not a group override: a script's subgroup)
    function groupHandlesShown() {
        return !!mGroupUITool && mSymEditing && mSymHandles.group && !mGroupOverride;
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
        if (mSymEditing) fireHostEvent('toolBarRefresh');
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
            try { box = fd ? domainBox(fd, { walls: groupWalls(g) }) : null; } catch (e) { box = null; }
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
    let mActiveTool = null;          // the active tool (setTool); null: none, the view alone

    // the tools that get the events: the active tool, or the sets of handles it is made of
    // (getHandlers: the Symmetry tool's), each as a tool of its own; the view after them
    function refreshActiveTools() {
        const tool = mActiveTool;
        mActiveTools = tool ? [...(tool.getHandlers ? tool.getHandlers() : [tool]), mNavigator] : [mNavigator];
    }

    //
    //  the host: what the renderer gives its UI builder and its tools
    //  (docs/symrenderer_refactor_plan.md section 4.1). The canvas and the view, the
    //  params, the pattern, the documents, the tools and their bar, the commands, the
    //  pattern box, the drawing renderer, the symmetry's handles, and events:
    //    start                   the pattern and the params exist: build the page
    //    ready                   the documents exist, before the first is loaded
    //    toolChanged {name}      a tool was taken up
    //    toolStateChanged        what the tools' UI shows may have changed (refreshToolUI)
    //    toolBarRefresh          the active tool's bar shows its values again
    //    toolHintChanged         the active tool's help line changed
    //    runChanged {running}, recordingChanged {recording}, canAnimateChanged
    //    titleChanged {title}    the document's name
    //    contextMenu {x, y, items}   the active tool's menu at a right click
    //    settingsToggleRequested, globalOptionsRequested
    //    samplesRequested        the param 'Samples...': the UI's samples window
    //    viewChanged             the view moved
    //    symmetryEditRequested   the Dirichlet domain's switch 'edit'
    //
    function fireHostEvent(type, detail) {
        (mHostListeners[type] || []).slice().forEach(fn => fn(detail));
    }
    const mHost = {
        canvas:           mCanvas,
        view:             mView,
        canvasTransform:  mCanvasTransform,
        patternTransform: mPatternTransform,
        getNavigator:     () => mNavigator,
        getGLContext:     () => mGLCtx,
        getGroup:         () => getGroup(),
        // a canvas point in pattern space
        canvasToPattern:  (cpnt) => canvas2sim(cpnt),
        scheduleRepaint:  () => scheduleRepaint(),
        // the params (made once; saved with documents, the settings panel's), the pattern,
        // the visualization, the documents (samples, files, save), the renderer's options
        // kept in the browser (SymRendererConfig), the symmetry's params (its window's panel)
        getParams:         () => getParams(),
        getPattern:        () => mPattern,
        getVisualization:  () => mVisualization,
        getDocManager:     () => mDocManager,
        getRendererConfig: () => mRendererConfig,
        getSymmetryParams: () => mSymPanelParams,
        // a key of the browser's storage, of this app (its documents' folder id)
        storageKey:        (name) => mDocFolderId + '_' + name,
        // the canvas's place was resized
        canvasResized:     () => onResize(),
        // the tools: [{name, tool, owner}] in their order, one by name, the active one;
        // add one ('renderer'), take one up
        getTools:         () => [...mTools].map(([name, { tool, owner }]) => ({ name, tool, owner })),
        getTool:          (name) => getTool(name),
        getToolName:      () => mConfig.tools.toolName,
        getActiveTool:    () => mActiveTool,
        addTool:          (tool) => addTool(tool),
        setTool:          (name, taken = false) => setTool(name, taken),
        // the tools' UI shows the values again (toolStateChanged), the active tool's bar
        // (toolBarRefresh), its help line (toolHintChanged)
        refreshToolUI:    () => refreshToolUI(),
        refreshToolBar:   () => fireHostEvent('toolBarRefresh'),
        refreshToolHint:  () => updateToolHint(),
        // the commands: run and stop, restart, initialize, recording, the image export,
        // full screen; whether the page animates, runs, records
        canAnimate:       () => mCanAnimate,
        isRunning:        () => mConfig.simulationRunning,
        isRecording:      () => mRecorder.isRecording(),
        toggleRun:        () => onToggleRun(),
        restart:          () => onRestartAnimation(),
        initSimulation:   () => onInitSimulation(),
        toggleRecording:  () => onToggleRecording(),
        exportImage:      () => onSaveImage(),
        fullscreen:       () => onFullScreen(),
        // the settings panel's folder 'scripting': the scripts' params go into it
        attachScriptFolder: (folder) => mScripting.initGUI(folder),
        // a param the UI adds to the renderer's (saved with the documents as they are),
        // called in its create: make() gives it when the params are made (the pattern
        // exists then), null for none; group: '' the top level, or a group's key
        // ('display'); after: the key it follows, else it comes last
        addParams: (group, key, make, { after } = {}) => { mAddedParams.push({ group, key, make, after }); },
        // the FrameTiming the frame's sections report to (null: none); while it is enabled
        // the animation's frames are measured whole ('frameTimed' after each)
        setFrameTiming:   (timing) => { mFrameTiming = timing || null; },
        // a frame rendered now, outside the animation (a benchmark's)
        renderFrame:      () => renderFrame(),
        // the transformations' window: () => the row whose handles are on the canvas
        setTransformHandlesRow: (getRow) => setTransformHandlesRow(getRow),
        // the view's commands: back, the document's frame shown (kept in the browser)
        goToPreviousView: () => goToPreviousView(),
        setFrameShown:    (v) => setFrameShown(v),
        // the pattern's box: its numbers (changed() after an edit), whether it bends with
        // the group, the transforms of the images shown
        patternBox: {
            getConfig:       () => mConfig.patternTransConfig,
            changed:         () => onPatternTransformChanged(),
            canBend:         () => patternCanBend(),
            imageTransforms: () => shownImageTransforms(),
        },
        // the renderer Draw and Pick paint with (its settings in the tools panel)
        getDrawingRenderer: () => mDrawingToolRenderer,
        // the symmetry's sets of handles on the canvas: edited (on while the Symmetry tool
        // is active), their toggles, the group transform's frame and numbers
        symmetry: {
            setEditing:        (on) => setSymmetryEditing(on),
            handlers:          () => mSymHandlers,
            getHandles:        () => mSymHandles,
            setHandle:         (key, on) => { mSymHandles[key] = !!on; onSymmetryHandlesChanged(); },
            editDirichlet:     (on) => mDirichlet.requestEdit(!!on),
            hasGroupHandles:   () => !!mGroupUITool,
            groupIsEuclidean:  () => makerGroupEuclidean(),
            transformFrameOn:  () => transformFrameOn(),
            getTransform:      () => mConfig.symmetry.transform,
            getTransformFrame: () => mGroupTransformTool.getFrame(),
            // the frame's centre, angle and scale written back as the stored numbers
            setTransformFrame: (c, angle, scale) => {
                Object.assign(mConfig.symmetry.transform,
                              transformFromFrame(c, angle, scale, mGroupTransformTool.getFrame().anchor));
                onGroupTransformEdited();
            },
            transformMenu:     () => groupTransformMenu(),
        },
        // what the UI tells the renderer, in its create(): the tool taken up at the start
        // (startTool), the tools' settings in a bar of the UI (toolBar: the pattern's tools
        // put theirs there, the Symmetry tool's toggles leave the settings panel), Space
        // held down moves the view in every tool (spacePan)
        configure: (c = {}) => {
            if (c.startTool) mConfig.tools.toolName = c.startTool;
            if ('toolBar' in c) mToolBar = !!c.toolBar;
            if ('spacePan' in c) mSpacePanKey = !!c.spacePan;
        },
        addEventListener: (type, fn) => {
            (mHostListeners[type] = mHostListeners[type] || []).push(fn);
        },
        removeEventListener: (type, fn) => {
            const list = mHostListeners[type];
            if (list && list.includes(fn)) list.splice(list.indexOf(fn), 1);
        },
    };

    //
    //  the UI: the page's builder (options.ui, docs/symrenderer_refactor_plan.md 4.2)
    //  makes the canvas's place and the tools it wants now, the rest of the page on the
    //  host's 'start'. The canvas goes into its place, the page without one. Without a
    //  builder: the bare canvas on the page (the view still moves by the wheel)
    //
    const mUI = (options.ui && options.ui.create(mHost, mUIOptions)) || {};
    (mUI.canvasHost && mUI.canvasHost() || document.body).appendChild(mCanvas.container);

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

    // the simulation object
    let mPattern = null;
    // the pattern animates (the UI then offers run and restart): set in startApplication()
    // from the pattern and the scripts, later by a script loaded (canAnimateChanged)
    let mCanAnimate = false;
    // visualization renderer object
    let mVisualization =  (options.visualization) ? (options.visualization): VisualizationManager(); 
    
    //
    // set of parameters usef for UI display and for state saving
    //
    let mParams = null;
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

        mPattern = mPatternCreator.create();
        mPattern.init(mGLCtx);
        mEditingOverlay.init(mGLCtx);
        mVisualization.init({glCtx: mGLCtx, onChange:scheduleRepaint, groupTables: mGroupTables,
                             components: makeComponentSource(mPattern)});
        if (DEBUG)
            console.log(`${MYNAME} mPattern: ${mPattern.getName()}`);
        mPattern.addEventListener('imageChanged', onSimulationChanged);
        mPattern.addEventListener('componentRenamed', (e) => { if (mVisualization.renameComponent) mVisualization.renameComponent(e.from, e.to); });
        // the pattern's own editing tools (one or a list) join the tool list (the UI
        // shows them), with the pointer events in world and pattern points, the keys
        // and the 2D overlay
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
                toolPalette:      mToolBar,
            });
            mPatternTools = [].concat(tools || []).filter(Boolean);
            mPatternTools.forEach(tool => addTool(tool, 'pattern'));
        }


        // Determine once whether animation UI (Run/Restart buttons) should be shown.
        mCanAnimate = !!(mPattern.canAnimate || mPattern.doStep
                         || options.scriptUrl
                         || options.scriptUrls?.length > 0);

        // the params, then the page around the canvas: the UI builds it now
        getParams();
        fireHostEvent('start');
        // to do final initialization
        onGroupChanged();
        setTool(mConfig.tools.toolName);
        mPattern.setGroup(mGroup);
        onCanvasSize();
        mDrawingToolRenderer.init({
            simulation: mPattern,
            repainter: {
                scheduleRepaint: scheduleRepaint
            }
        });
        mCanvas.container.addEventListener("fullscreenchange", onFullScreenChange);

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
            setTitle:         (title) => fireHostEvent('titleChanged', { title }),
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
        // the documents' windows exist (the UI's tool panels start above them)
        fireHostEvent('ready');

        let mCurrentDocument = mDocManager.createInitialDocument();
        mCurrentDocument.setName(getNewDocumentName());
        // the view of the start is the document view until a document comes
        onDocumentLoaded();
        // hash may carry a preset, inline params, or a preset + overrides
        if(mPreset) mDocManager.loadPresetUrl(mPreset, mInlineParams);
        else if(mInlineParams) mDocManager.loadInlineParams(mInlineParams);

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
    function createCanvas(){
        
        // the canvas stack is positioned here, so it needs no stylesheet:
        // the container (sized by onCanvasSize) holds the GL canvas and the
        // overlay, one over the other
        let canvasContainer = document.createElement('div');
        canvasContainer.id = 'canvasContainer';
        Object.assign(canvasContainer.style, {
            position: 'absolute', width: '512px', height: '512px', backgroundColor: '#FFF' });
        const layer = () => {
            const c = document.createElement('canvas');
            c.className = 'layeredCanvas';
            Object.assign(c.style, {
                position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' });
            return c;
        };
        let glCanvas = layer();
        let overlay = layer();
        canvasContainer.appendChild(glCanvas);
        canvasContainer.appendChild(overlay);
        return {
            container: canvasContainer,
            glCanvas:  glCanvas,
            overlay:   overlay,
        };
    }

    function resizeCanvases() {
        if (mIsExporting) return false;

        let scale = mConfig.display.sizeMultiplier;
        const glChanged = resizeCanvas(mCanvas.glCanvas, scale);
        const ovChanged = resizeCanvas(mCanvas.overlay, scale);
        if (glChanged || ovChanged) {
            mCanvasTransform.onCanvasResize();
            return true;
        }
        return false;
    }

    function makeParams() {

        const params = withAddedParams('', {

            files:          makeFilesParams(),
            display:        makeDisplayParams(),
            recording:      makeRecordingParams(mConfig.recording),
            pattern:        makePatternParams(),
            visualization:  ParamObj({name: 'visualization', obj: mVisualization}),
            symmetry:       makeSymParams(),
            tools:          makeToolsParams(),
            scripting:      ParamObj({name: 'scripting', obj: mScripting}),
            test:           ParamObj({name: 'test', obj: mTestWriter, serializable: false}),
        });
        
        if (mParamsOrder){
            return reorderKeys(params, mParamsOrder);
        } else {
            return params;
        }
    } // function makeParams;

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
                globalOptions:  ParamFunc({func: () => fireHostEvent('globalOptionsRequested'), name: 'Global Options...'}),
                showSamples:    ParamFunc({func: () => fireHostEvent('samplesRequested'), name: 'Samples...'}),
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
                toggleRecording: ParamFunc({func: onToggleRecording,name: RECORDING_START}),
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
            params: withAddedParams('display', {
                canvasSize:     ParamChoice({obj: cfg,key: 'canvasSize',choice: CanvasSize.getNames(), serializable:false, onChange: onCanvasSize}),
                customWidth:    ParamInt({obj: cfg,key: 'customWidth', min: 128, max: 16 * 1024, name: 'custom width', serializable: false, onChange: onCanvasSize}),
                customHeight:   ParamInt({obj: cfg,key: 'customHeight',min: 128,max: 16 * 1024,name: 'custom height',serializable: false, onChange: onCanvasSize}),
                sizeMultiplier: ParamInt({obj: cfg, key: 'sizeMultiplier', min: 1, max: 4, name: 'size multiplier', serializable: false, onChange: onCanvasSize}),
                backgroundColor: ParamColor({obj: cfg,key: 'backgroundColor',name: 'background',onChange: scheduleRepaint}),
                showChecker:    ParamBool({obj: conf,key: 'showChecker', name: 'Checker', serializable: false, onChange: onShowChecker}),
                showGrid:       ParamBool({obj: conf,key: 'showGrid', name: 'Grid', serializable: false, onChange: onc}),
                showRuler:      ParamBool({obj: conf,key: 'showRuler',name:'Ruler', serializable: false, onChange: onc}),
            }),
        });
    } // function makeDisplayParams()

    //
    //  the params the UI added (host.addParams) to the group ('' the top level), each after
    //  its key or last; a maker that gives nothing adds nothing
    //
    function withAddedParams(group, params) {
        let out = params;
        for (const a of mAddedParams) {
            if (a.group !== group) continue;
            const param = a.make();
            if (!param) continue;
            const keys = Object.keys(out).filter(k => k !== a.key);
            const at = (a.after && keys.includes(a.after)) ? keys.indexOf(a.after) + 1 : keys.length;
            keys.splice(at, 0, a.key);
            const next = {};
            keys.forEach(k => { next[k] = (k === a.key) ? param : out[k]; });
            out = next;
        }
        return out;
    }

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
        if (mSymEditing) fireHostEvent('toolBarRefresh');
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
        if (!mToolBar) {
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
    //  the selected row's own handles and marks on the canvas, in every tool, while the
    //  UI's window is open and its switch is on (TransformHandles.js): the points of a
    //  rational map, the cell of a periodic wrap, the fixed points of a word. getRow:
    //  the window's row whose handles they are, null for none
    //
    function setTransformHandlesRow(getRow) {
        mTransformHandlesRow = getRow;
        if (mTransformHandles) return;
        mTransformHandles = createTransformHandles({
            navigator: mNavigator,
            getRow:    () => (mTransformHandlesRow ? mTransformHandlesRow() : null),
            pointer:   () => mPointerAt,
            canvas:    mCanvas.overlay,
            repaint:   scheduleRepaint,
        });
    }

    // the handles of the selected transformation take the pointer and the keys now: they
    // are made, and the window says whose they are (it is open, its switch is on)
    function transformHandlesOn() {
        if (!mTransformHandles) return false;
        const on = !!(mTransformHandlesRow && mTransformHandlesRow());
        if (on !== mTransformHandles.isActive()) mTransformHandles.setActive(on);
        return on && mTransformHandles.isShown();
    }

    // the tools that get an event: the selected transformation's handles before the active tool's
    function toolsNow() {
        return transformHandlesOn() ? [mTransformHandles, ...mActiveTools] : mActiveTools;
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

    // the active tool's help line again (the Orientation tool's follows the navigation mode)
    function updateToolHint() {
        fireHostEvent('toolHintChanged');
    }

    //  back (docs/document_view_plan.md phase 5, the ` key and the Orientation
    //  bar's button): the view before home or a reset; again, the view it came
    //  back from
    function goToPreviousView() {
        if (!mNavigator || !mNavigator.goToPreviousView || !mNavigator.goToPreviousView()) return false;
        scheduleRepaint();
        // the view's tool shows it (its back button may go off)
        if (mActiveTool && mActiveTool.navigates) {
            fireHostEvent('toolBarRefresh');
            updateToolHint();
        }
        return true;
    }

    // the tools' UI shows the current values (the UI's bars and buttons, the pattern's
    // parts of them)
    function refreshToolUI() {
        fireHostEvent('toolStateChanged');
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
    //  or an editable element are not tool commands; a focused button (a UI's
    //  image buttons are image inputs) or checkbox takes no keys.
    //
    const NOT_TYPED_INPUTS = /^(button|image|submit|reset|checkbox|radio|color|file)$/;

    function isTypingTarget(t) {
        if (!t) return false;
        if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
        return t.tagName === 'INPUT' && !NOT_TYPED_INPUTS.test(t.type);
    }

    //
    //  Space held down (when the UI asks for it, host.configure spacePan): a drag
    //  moves the view in every tool, the navigator gets the pointer events; a drag
    //  going on when Space is let go ends as a move of the view
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
        if (mSpacePanKey && e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey) {
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
        if (!e.isConsumed && mSymUndo.handleKey(e, mSymEditing)) {
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
        // a key the tools left alone may pick a tool: the UI's (its palette), after this
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
    //  (tool.getContextMenu(e): PopupMenu items; the UI shows it), else the browser's menu
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
        fireHostEvent('contextMenu', { x: e.clientX, y: e.clientY, items });
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
            // the pattern's tools get the world and pattern points; the renderer's own
            // tools find theirs (a page without a UI builder may have no tool at all)
            const toolEntry = mTools.get(mConfig.tools.toolName);
            if (toolEntry && toolEntry.owner === 'pattern') setPatternToolPoints(e);
            // with Space held down or the middle button the view moves, whatever the tool
            if (e.type === 'pointerdown' && e.button === 1) mMiddlePan = true;
            let tools = (mSpacePan || mMiddlePan) ? [mNavigator] : toolsNow();
            if ((e.type === 'click' || e.type === 'dblclick') && mPressTaker && tools.includes(mPressTaker)) tools = [mPressTaker];
            // in the view's tool (the Orientation tool) the plain gestures make the navigation mode's motions
            e.navigatorTool = !!(mActiveTool && mActiveTool.navigates) && !mSpacePan && !mMiddlePan;
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
            // the document frame's handles in the view's tool: their cursor (InversiveNavigator),
            // off them the tool's
            if (e.frameCursor !== undefined && !mSpacePan && !mMiddlePan && mActiveTool && mActiveTool.navigates &&
                e.frameCursor !== mFrameCursor) {
                mFrameCursor = e.frameCursor;
                mCanvas.overlay.style.cursor = mFrameCursor || mActiveTool.cursor;
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
                (mSymEditing || transformHandlesOn()) &&
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
        if (mSymEditing) applySymmetryEditing();
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
        if (mSymEditing) {
            const wasEuclidean = mMakerGeometry.euclidean;
            let refresh = makerGroupEuclidean() !== wasEuclidean;
            if (refresh) applySymmetryEditing();
            if (transformFrameOn()) {
                const version = mMakerDomainBox.version;
                makerDomainBox();
                if (mMakerDomainBox.version !== version) refresh = true;
            }
            if (refresh) fireHostEvent('toolBarRefresh');
        }
        if(DEBUG) console.log(`${MYNAME}.prepareGroupData()`, mGroup);
        mGroup = transformGroup(mGroup, groupTransformParams());
        
        // the Dirichlet domain of the transformed group, when it is on
        mGroup = mDirichlet.apply(mGroup);

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

    /** a script was loaded later (Files > Open Script...): the page can animate, the UI adds Run and Restart */
    function onScriptLoaded() {
        if (mCanAnimate) return;
        mCanAnimate = true;
        fireHostEvent('canAnimateChanged');
    }

    function stopAnimation(){

        mConfig.simulationRunning = false;
        fireHostEvent('runChanged', { running: false });
        scheduleRepaint();
    }

    function startAnimation(){
        if(DEBUG) console.log(`${MYNAME}.startAnimation()`); 
        mConfig.simulationRunning = true;
        fireHostEvent('runChanged', { running: true });
        scheduleRepaint();
    }

    function onShowChecker() {
        mCanvas.container.classList.toggle('checker-backdrop', !!mConfig.misc.options.showChecker);
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
        scheduleRepaint();
        fireHostEvent('viewChanged');
    }

    function scheduleRepaint() {
        mNeedRepaint = true;
    }

    function clearRepaintFlag(){
        
        mNeedRepaint = false;
        
    }

    function onResize() {

        if(DEBUG)console.log(`${MYNAME}.onResize():`, mCanvas.glCanvas.clientWidth);
        // Defer canvas backing-store reallocation to renderFrame() (inside rAF)
        // so the WebGL drawing buffer is never cleared between ResizeObserver
        // and browser paint (preventing a 1-frame blank flash). resizeCanvases()
        // calls mCanvasTransform.onCanvasResize() immediately whenever a canvas
        // dimension changes, right before renderGLCanvas() draws the new frame.
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

        mConfig.tools.toolName = toolName;
        // the UI shows it: its button pressed, its bar (the settings and the help)
        fireHostEvent('toolChanged', { name: toolName });
        mFrameCursor = '';
        // the tools learn when they are taken up and left, in their order, to drop what
        // they were in the middle of; setActive(true, true): the user took it up (the Tile
        // tool then selects or adds a tile, which a load must not)
        const tool = getTool(toolName);
        mTools.forEach(({ tool: t }) => { if (t.setActive) t.setActive(t === tool, taken && t === tool); });
        if (tool) mCanvas.overlay.style.cursor = tool.cursor || 'crosshair';
        mActiveTool = tool;
        refreshActiveTools();

        if (mParams && mParams.tools && mParams.tools.tool) {
            mParams.tools.tool.updateDisplay();
        }
        scheduleRepaint();
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
                timing:         mFrameTiming,
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
                (mActiveTool && mActiveTool.getOverlayGeometry) ? mActiveTool.getOverlayGeometry() : null);
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
            }
        } else {
            // no recording
            renderTimedFrame();
            mNeedRepaint = mNeedRepaint || mConfig.simulationRunning;
        }

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
                mNavigator.renderDocumentFrame(mOverlayCtx, !!(mActiveTool && mActiveTool.navigates));

            // the group's handles: on the 2D canvas where the GPU pass does not draw them, else
            // their text only (the orders' labels, a handle's values)
            if (groupHandlesShown() && mGroupUITool.renderUI && !groupToolDrawsOnGPU()) {
                mGroupUITool.renderUI(mOverlayCtx, mCanvasTransform);
            } else if (groupToolDrawsOnGPU() && mGroupUITool.renderText) {
                mGroupUITool.renderText(mOverlayCtx, mCanvasTransform);
            }
            if (!mEditingOverlay.isReady()) mGroupTransformTool.renderUI(mOverlayCtx, mCanvasTransform);
            // the pole of the navigator's inversive mode, moved in the orientation tool
            if (mActiveTool && mActiveTool.navigates && mNavigator.renderPole) mNavigator.renderPole(mOverlayCtx);
            // the Dirichlet domain's points, planes and sides show in the Symmetry tool with
            // its Dirichlet handles on (the tool is active then, it draws nothing else). The
            // GPU pass draws them, the 2D canvas their text
            if (mEditingOverlay.isReady()) mDirichlet.renderText(mOverlayCtx, mCanvasTransform);
            else mDirichlet.renderUI(mOverlayCtx, mCanvasTransform);

            // a tool that gives its geometry to the GPU pass keeps the 2D canvas for text only (renderText)
            if (mActiveTool && mActiveTool.getOverlayGeometry && mEditingOverlay.isReady()) {
                if (mActiveTool.renderText) mActiveTool.renderText(mOverlayCtx, mCanvasTransform);
            } else if (mActiveTool && mActiveTool.renderUI) {
                mActiveTool.renderUI(mOverlayCtx, mCanvasTransform);
            }

            // the selected conformal transformation's handles, over the tools' marks: their
            // labels (the GPU pass drew the rest), or all of them without that pass; never
            // in an export or a thumbnail
            if (!mIsExporting && !mHideEditing && transformHandlesOn()) {
                if (mEditingOverlay.isReady()) mTransformHandles.renderText(mOverlayCtx);
                else mTransformHandles.renderUI(mOverlayCtx);
            }
        });

        // the UI's panels read the frame (a simulation's data plot)
        fireHostEvent('frameRendered');
        mScripting.events.fire('afterRender');

    } // function renderFrame()

    //
    //  frame timing: the sections of a frame report to the UI's FrameTiming (its timing
    //  panel's, host.setFrameTiming); while it is enabled the animation's frames are
    //  measured whole, the host event 'frameTimed' after each. renderFrame() is also
    //  called by image export and scripts; those frames are not measured (no beginFrame),
    //  timed() then just runs the function.
    //
    function timed(label, fn) {
        return mFrameTiming ? mFrameTiming.section(label, fn) : fn();
    }

    function renderTimedFrame() {
        const timing = mFrameTiming;
        const measure = timing && timing.isEnabled();
        if (measure) timing.beginFrame();
        renderFrame();
        if (measure) {
            timing.endFrame();
            fireHostEvent('frameTimed');
        }
    }

    function onClearGLCanvas() {
        let gl = mGLCtx.gl;
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        let c = hexToPremult(mConfig.display.backgroundColor);
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

    function getImageName() {
        return getDocumentName();
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
        mParams.recording.toggleRecording.setName(RECORDING_START);
        fireHostEvent('recordingChanged', { recording: false });
        stopAnimation();

    }

    function onToggleRecording() {

        if (mRecorder.isRecording()) {
            // stop recording
            mRecorder.stopRecording();
            mRecorder.saveRecording();
            mParams.recording.toggleRecording.setName(RECORDING_START);
            fireHostEvent('recordingChanged', { recording: false });
            if (mConfig.simulationRunning) {
                onToggleRun();
            }
            
        } else {

            mRecorder.startRecording({
                startFrame: mConfig.startFrame,
                endFrame: mConfig.recording.endFrame,
                onEnd: onRecordingEnded
            });
            mParams.recording.toggleRecording.setName(RECORDING_STOP);
            fireHostEvent('recordingChanged', { recording: true });
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

    // the settings shown or hidden: the UI's window
    function toggleGUI() {
        fireHostEvent('settingsToggleRequested');
    }


    function onFullScreenChange() {
        if (DEBUG)
            console.log('onFullscreenChange()');
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
        // the fixed points' window of the group's transformations was of the group left
        closeGroupTransformsWindow();
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
