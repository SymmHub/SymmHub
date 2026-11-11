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
    mergeGeometry,
    createDataPlot,

    readPixelsFromBuffer,
    CanvasSize,
    createVideoRecorder3,
    date2s,
    getTime,
    transformGroup,
    DirichletDomainTool,
    makeGroupTables,

    ParamChoice,
    ParamInt,
    ParamBool,
    ParamColor,
    ParamFunc,
    ParamFloat,
    ParamGroup,
    ParamObj,

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

    getHashParams,
    reorderKeys,
    TestWriter,
    asyncTracker,
    exportImage,
    createDocumentManager,
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
// the editing tools a pattern may provide (pattern.createUITool), e.g. the
// drawing tools of symdraw, are named TOOL_PATTERN_PREFIX + tool.name; with
// the tool palette they show tool.label, tool.key, tool.group, tool.help and
// the settings tool.getProperties() (PropertyBar controls)
const TOOL_PATTERN_PREFIX = 'pattern.';
const TOOL_NAMES = [TOOL_MOVE, TOOL_DRAW, TOOL_PICK, TOOL_PATTERN_TRANSFORM];
// SymRenderer's own tools as the tool palette shows them (options.toolPalette)
const OWN_TOOLS = {
    [TOOL_MOVE]:              { label: 'Pan and zoom', key: 'H', icon: 'btn_move2.svg',
                                help: 'drag moves the view, the wheel zooms (in every tool the wheel zooms and Space+drag moves the view)' },
    [TOOL_PATTERN_TRANSFORM]: { label: 'Pattern box', key: 'M', icon: 'btn_pattern_transform.svg',
                                help: 'drag moves the box of the pattern, drag near its corners turns and scales it' },
    [TOOL_DRAW]:              { label: 'Draw', icon: 'btn_draw.svg', help: 'paints into the pattern' },
    [TOOL_PICK]:              { label: 'Pick', icon: 'btn_pick.svg', help: 'a click picks the colour under the pointer' },
};
const DEFAULT_PALETTE_TOOLS = [TOOL_MOVE, TOOL_PATTERN_TRANSFORM];
// a house: the view as it was at the start
const ICON_RESET_VIEW =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#303030" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">' +
    '<path d="M3 11 L12 3 L21 11"/><path d="M5.5 9 V21 H18.5 V9"/><path d="M10 21 V15 H14 V21"/></svg>';

// the geometry of the group: a disk with two geodesics and a diameter
const ICON_GEOMETRY =
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="#303030" stroke-width="1.5"/>' +
    '<path d="M5.3 5.3 A 9 9 0 0 0 5.3 18.7 M18.7 5.3 A 9 9 0 0 1 18.7 18.7" fill="none" stroke="#303030" stroke-width="1.3"/>' +
    '<path d="M3 12 H21" fill="none" stroke="#303030" stroke-width="1.3"/></svg>';

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
        loadPresetUrl:    (url) => mDocManager.loadPresetUrl(url),
        saveToFolder:     (folder, baseName) => mDocManager.writeDocumentToFolder(folder, baseName),
        loadFromFolder:   (folder, fileName) => mDocManager.readParamsFromFolder(folder, fileName),
        getCanvasSize:    () => getCanvasSize(),
        renderToCanvas:   (w, h) => renderToCanvas(w, h),
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
    let mToolUI = null;             // the pattern's parts of the palette's UI: {refresh(), windows: [{label, title, window}]}
    let mVisLayersWindow = null;    // options.visualizationWindow: the layers and their settings
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
                     });

    let mDrawingToolRenderer = DrawingToolRenderer({
        gl: mGLCtx.gl
    }); // drawing tool renderer

    let mDrawingToolHandler; //  drawing evens handler
    let mPatternTransformHandler = null; // pattern transform events handler
    let mPatternTransformRenderer = null; // pattern transform renderer
    let activeTool = null; // currently active tool for UI rendering
    // the active tool's overlay drawn by the GPU through the view's chain, when the tool gives its geometry
    const mEditingOverlay = EditingOverlay();

    // optional interactive tool provided by the group maker
    // (e.g. Group_Orbifold: dragging fundamental domain edges on the image)
    let mGroupUITool = null;
    // optional editing tools provided by the pattern, made in startApplication()
    let mPatternTools = [];

    function getToolNames() {
        return [...TOOL_NAMES, ...mPatternTools.map(t => TOOL_PATTERN_PREFIX + t.name)];
    }

    function getPatternTool(toolName) {
        if (!toolName || !toolName.startsWith(TOOL_PATTERN_PREFIX)) return null;
        return mPatternTools.find(t => TOOL_PATTERN_PREFIX + t.name === toolName) || null;
    }

    //
    //  the map between canvas pixels and the world points they show, through
    //  the navigator (its Moebius transform and projections) when it can,
    //  else through the canvas transform alone
    //
    const mView = {
        toWorld: (cpnt) => mNavigator.screenToWorld
            ? mNavigator.screenToWorld(cpnt)
            : { pnt: mCanvasTransform.invTransform(cpnt, [0, 0]), exact: true },
        toCanvas: (wpnt) => mNavigator.worldToScreen
            ? mNavigator.worldToScreen(wpnt)
            : mCanvasTransform.transform(wpnt, [0, 0]),
        isLinear: () => mNavigator.isLinearView ? mNavigator.isLinearView() : true,
        // the canvas in pixels: [width, height]
        canvasSize: () => { const s = getCanvasSize(); return [s.width, s.height]; },
        // the world rectangle the canvas shows, [x0, y0, x1, y1] (the canvas transform's;
        // the drawing editor's fit to the view)
        visible: () => {
            const c = mCanvasTransform.getCenter(), s = mCanvasTransform.getWorldSize();
            return [c[0] - s[0]/2, c[1] - s[1]/2, c[0] + s[0]/2, c[1] + s[1]/2];
        },
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
        }
    };

    function updateGroupUITool() {
        mGroupUITool = (mGroupMaker && mGroupMaker.createUITool)
            ? mGroupMaker.createUITool({
                navigator: mNavigator,
                canvas: mCanvas.overlay,
                repaint: scheduleRepaint,
            })
            : null;
    }
    updateGroupUITool();

    // the Dirichlet domain of the group as an operation on it (applied after the group
    // transform), with the choice of its sides on the canvas; its params are in the
    // symmetry folder (lib/symhublib/DirichletDomainTool.js)
    const mDirichlet = DirichletDomainTool({
        navigator: mNavigator,
        canvas: mCanvas.overlay,
        repaint: scheduleRepaint,
        onChanged: onGroupChanged,
    });

    let mActiveTools = [mDirichlet, mGroupUIToolProxy, mNavigator]; // sequence of active event-handling tools

    let mGroup = mGroupMaker.getGroup(); // the current group
    let mGroupChanged = false;
    // When set, this group is used instead of the group maker's own.  Batch /
    // scripted rendering uses it to draw a subgroup (its fundamental domain,
    // tiling and pairing transforms) without disturbing the maker or the UI.
    let mGroupOverride = null;
    
    
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
        });
        mDocManager.init();
        // the tool panels start above the samples and the files
        toolWindowEntries().forEach(e => e.window?.raise());

        let mCurrentDocument = mDocManager.createInitialDocument();
        mCurrentDocument.setName(getNewDocumentName());
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
            symmetry:       makeSymParams(),
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
    // the group's UI tool (the orbifold's edges) is shown in the move tool, by the GPU editing overlay when it can
    function groupToolDrawsOnGPU(){
        return !!(mGroupUITool && mGroupUITool.getOverlayGeometry && mConfig.tools.toolName == TOOL_MOVE && mEditingOverlay.isReady());
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
    //
    //
    function makeGroupTransformParams() {

        let conf = mConfig.symmetry.transform;
        let onc = onGroupChanged;
        let inc = 0.0000000000001;
        return ParamGroup({
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
    } // function makeGroupTransformParams(){

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
        if(mGroupMakerFactory) 
            params.groupType = ParamChoice({obj:mConfig.symmetry, key:'groupType', name: 'group type',
                                            choice: mGroupMakerFactory.getNames(), onChange: onGroupTypeChanged});
        params.group = ParamObj({name: 'group params', obj: mGroupMaker});
        params.transform = makeGroupTransformParams();
        params.dirichlet = mDirichlet.getParams();
        params.options = makeSymOptionsParams();
        
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
            buttons.patternTransform = createImgBtn({title:'pattern transform',src:resPath('btn_pattern_transform.svg'),action:()=>setTool('patternTransform')});
            buttons.draw        = createImgBtn({title:'draw',      src:resPath('btn_draw.svg'),action:()=>setTool('draw')});
            buttons.pick        = createImgBtn({title:'pick',      src:resPath('btn_pick.svg'),action:()=>setTool('pick')});
            mPatternTools.forEach(tool => {
                const name = TOOL_PATTERN_PREFIX + tool.name;
                buttons[name] = createImgBtn({title: tool.title || tool.name,
                                              src: tool.icon || resPath('btn_draw.svg'),
                                              action: () => setTool(name)});
                btnCount++;
            });
            let space       = createImgBtn({                   src:resPath('btn_vbar.svg')});
            space.classList.add('vbar-separator');

            container.appendChild(space);

            container.appendChild(buttons.move);
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
        ];
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
            { label: 'Image (PNG)…', title: 'the view as on screen, scaled to a chosen size: PNG, or JPG, WEBP, TIFF', action: onSaveImage },
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
            onSelect:  (name) => setTool(name),
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
        case TOOL_MOVE: {
            const reset = mNavigator.onResetView ? () => mNavigator.onResetView() : null;
            return reset ? [{ kind: 'button', icon: ICON_RESET_VIEW, title: 'the view as it was at the start', action: reset }] : [];
        }
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
        for (let i = 0; i < mActiveTools.length; i++) {
            const tool = mActiveTools[i];
            if (tool && tool.handleKey) {
                tool.handleKey(e);
                if (e.isConsumed) {
                    e.preventDefault();
                    break;
                }
            }
        }
        // a key the tools left alone may pick a tool of the palette
        if (mToolPalette && !e.isConsumed && e.type === 'keydown' && !e.repeat) {
            const name = mToolPalette.toolForKey(e);
            if (name) {
                if (name !== mConfig.tools.toolName) setTool(name);
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
            const tools = (mSpacePan || mMiddlePan) ? [mNavigator] : mActiveTools;
            if (e.buttons !== undefined && e.type.startsWith('pointer')) mButtonsDown = e.buttons;
            if (mMiddlePan && e.type.startsWith('pointer') && !(e.buttons & 4)) mMiddlePan = false;
            for (let i = 0; i < tools.length; i++) {
                const tool = tools[i];
                if (tool && tool.handleEvent) {
                    tool.handleEvent(e);
                    if (e.isConsumed) {
                        break;
                    }
                }
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
        onGroupChanged();
    }

    function getGroupOverride() {
        return mGroupOverride;
    }

    function onGroupChanged() {

        if (DEBUG) console.log(`${MYNAME}.onGroupChanged()`);
        mGroupChanged = true;
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
        if(DEBUG) console.log(`${MYNAME}.prepareGroupData()`, mGroup);
        let {
            translationX,
            translationY,
            scale,
            rotation
        } = mConfig.symmetry.transform;
        //if (DEBUG) console.log(`${translationX},${translationY}, ${scale}, ${rotation}`);
        let angle = rotation * TORADIANS;
        let trans = [translationX, translationY];

        mGroup = transformGroup(mGroup, {
            rotation: angle,
            translation: trans,
            scale: scale
        });
        
        // the Dirichlet domain of the transformed group, when it is on
        mGroup = mDirichlet.apply(mGroup);

        //console.log("onGroupChanged()", mGroup);

        DataPacking.packGroupToSampler(mGLCtx.gl, mPackedGroupData, mGroup);

        updateTransGroup();
        mGroupChanged = false;
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
    // set the active tool from given toolName
    //
    function setTool(toolName) {

        let btns = mToolbox ? mToolbox.buttons : null;
        let tools = btns ? [btns.move, btns.draw, btns.pick, btns.patternTransform,
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
        mDirichlet.setActive(toolName === TOOL_MOVE);
        if (mToolPalette) mToolPalette.setActive(toolName);
        updatePropertyBar(toolName);
        activeTool = null;
        // the pattern tools learn when they are taken up and left, to drop what
        // they were in the middle of
        const patternTool = getPatternTool(toolName);
        mPatternTools.forEach(t => { if (t.setActive) t.setActive(t === patternTool); });
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
            // the Dirichlet domain tool and the group maker's UI tool (if any) get
            // first crack at the events, e.g. dragging the edges of the orbifold
            // fundamental domain
            mActiveTools = [mDirichlet, mGroupUIToolProxy, mNavigator];
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
        mVisualization.render({
                patternData,
                dataBuffer:     patternData.getMainBuffer(), 
                navigator:      mNavigator,
                timeStamp:      mTimeStamp,                    
                renderUni:      getRenderUni(),
                navigatorUni:   mNavigator.getUniforms({}, mTimeStamp),            
                canvas:         mCanvas.glCanvas,
                group:          mGroup,
                patternTransform: ptc,
                timing:         mActiveTiming,
                });

        // the editing overlay: the Dirichlet domain's marks (shown in every tool) and the
        // active tool's geometry, in world coordinates, over the layers, through the same
        // chain of maps as the picture
        if (mEditingOverlay.isReady() && !mHideEditing) {
            const geometry = mergeGeometry(mDirichlet.getOverlayGeometry(),
                groupToolDrawsOnGPU() ? mGroupUITool.getOverlayGeometry() : null,
                (activeTool && activeTool.getOverlayGeometry) ? activeTool.getOverlayGeometry() : null);
            if (geometry.polylines.length || geometry.points.length || geometry.splanes.length) {
                mEditingOverlay.render({ navigatorUni: mNavigator.getUniforms({}, mTimeStamp), renderUni: getRenderUni(), canvas: mCanvas.glCanvas }, geometry);
            }
        }
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

            if (mGroupUITool && mGroupUITool.renderUI && mConfig.tools.toolName == TOOL_MOVE && !groupToolDrawsOnGPU()) {
                mGroupUITool.renderUI(mOverlayCtx, mCanvasTransform);
            }
            // the Dirichlet domain's points, planes and sides show in every tool
            // (symdraw starts with its select tool); the move tool edits them. The GPU
            // pass draws them, the 2D canvas their text
            if (mEditingOverlay.isReady()) mDirichlet.renderText(mOverlayCtx, mCanvasTransform);
            else mDirichlet.renderUI(mOverlayCtx, mCanvasTransform);

            // a tool that gives its geometry to the GPU pass keeps the 2D canvas for text only (renderText)
            if (activeTool && activeTool.getOverlayGeometry && mEditingOverlay.isReady()) {
                if (activeTool.renderText) activeTool.renderText(mOverlayCtx, mCanvasTransform);
            } else if (activeTool && activeTool.renderUI) {
                activeTool.renderUI(mOverlayCtx, mCanvasTransform);
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

        mPattern.setGroup(mTransGroup);
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
    function renderToCanvas(width, height) {

        const orig = getCanvasSize();
        const wasExporting = mIsExporting;
        let out = null;

        mIsExporting = true;
        try {
            setCanvaSize(width, height);
            renderFrame();
            out = document.createElement('canvas');
            out.width  = width;
            out.height = height;
            out.getContext('2d').drawImage(mCanvas.glCanvas, 0, 0);
        } finally {
            setCanvaSize(orig.width, orig.height);
            mIsExporting = wasExporting;
            renderFrame();
        }
        return out;
    }

    //
    //  options.marks: the editing marks in the image as on screen: the GPU
    //  overlay (handles, the transform box, the Dirichlet marks) and, in a
    //  single frame (not a tiled TIFF), the 2D overlay canvas (labels, grid,
    //  the move tool's handles)
    //
    function exportImageWrapper(chosenName, folderHandle, exportWidth, exportHeight, imgFormat, options = {}) {
        const marks = !!options.marks;
        const rendererObj = {
            getCanvasSize: () => getCanvasSize(),
            setCanvaSize: (w, h) => setCanvaSize(w, h),
            canvasTransform: mCanvasTransform,
            writeDocumentToFolder: (fh, name) => mDocManager.writeDocumentToFolder(fh, name),
            renderFrame: () => renderFrame(),
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
        exportImage(chosenName, folderHandle, exportWidth, exportHeight, rendererObj, imgFormat);
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
    //  view as on screen scaled to the size chosen
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
    //  return maker of thumbnails for those who wans one 
    //
    function getThumbMaker(){
        return {
            getThumbnail: makeThumbnail,
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
