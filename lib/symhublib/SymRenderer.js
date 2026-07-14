import {
    DatGUI,
    hexToPremult,
    resizeCanvas,
    getWebGLContext,

    CanvasTransform,
    TransformMotion2D,
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
    createDataPlot,

    readPixelsFromBuffer,
    CanvasSize,
    Globals,
    createVideoRecorder3,
    date2s,
    getTime,
    transformGroup,

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
    getSquareThumbnailCanvas,
    getImageSaver,
    SymRendererPrograms,
    VisualizationManager,

    getHashParams,
    reorderKeys,
    TestWriter,
    asyncTracker,
    exportImage,
}
from "./modules.js";
import { createDocumentManager } from './SymDocumentManager.js';
import { createSymRendererConfig } from './SymRendererConfig.js';
import { createSymRendererScripting } from './SymRendererScripting.js';



const MYNAME = 'SymRenderer';
const FILE_FORMAT_RELEASE = 1;
const DEBUG = true;

//const GuiBuilder = ParamGui;
const GuiBuilder = DatGUI;

const PARAM_PREFIX = 'par';

const TMB_WIDTH = 256;
const MS = 0.001; // millisecond
const TOOL_DRAW = 'draw';
const TOOL_MOVE = 'move';
const TOOL_PICK = 'pick';
const TOOL_PATTERN_TRANSFORM = 'patternTransform';
const TOOL_NAMES = [TOOL_MOVE, TOOL_DRAW, TOOL_PICK, TOOL_PATTERN_TRANSFORM];

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
        
    // some components needs that to locate the files ??
    Globals.LIBRARY_PATH = "js/";
    
    let mDocFolderId = (options.docFolderId)?options.docFolderId: DEFAULT_DOC_FOLDER_ID;
    let mPatternCreator = options.patternCreator;
    let mSamples = options.samples;
    let mPreset = options.preset;
    let mGroupMakerFactory = options.groupMakerFactory;
    let mGroupMaker = null;
    let useSimpleUI = ( options.useSimpleUI);
    let mDataUpgrader = options.dataUpgrader || null;

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
        options: {
            useSymm: false,
            symIterations: 10,
        }

    };

    let displayConfig = {

        canvasSize: CanvasSize.getNames()[0],
        customWidth: 1000,
        customHeight: 1000,
        sizeMultiplier: 1,
        frameTime: 0.0,
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
            pivotY:0
        },
        tools: {
            toolName: TOOL_MOVE,
        },
    };




    // repaint flag
    let mNeedRepaint = false;
    let mIsExporting = false;
    
    const mCanvas = createCanvas({useInternalWindow: !useSimpleUI});
    
    
    let mDataPlot = null;
    
    // toolbox with buttons 
    let mToolbox = null;
    
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
        angle: ptc.angle * TORADIANS
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

    let mActiveTools = [mNavigator]; // sequence of active event-handling tools

    let mGroup = mGroupMaker.getGroup(); // the current group
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
        mVisualization.init({glCtx: mGLCtx, onChange:scheduleRepaint});
        if (DEBUG)
            console.log(`${MYNAME} mPattern: ${mPattern.getName()}`);
        mPattern.addEventListener('imageChanged', onSimulationChanged);

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

        let mCurrentDocument = mDocManager.createInitialDocument();
        mCurrentDocument.setName(getNewDocumentName());
        if(mPreset) mDocManager.loadPresetUrl(mPreset);
        
        if(useSimpleUI){
            mDocManager.getSamplesSelector()?.setVisible(false);
            mGUI.domElement.hidden = true;
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
            visualization:  ParamObj({name: 'visualization', obj: mVisualization}),
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
                settings:       ParamFunc({func: () => mRendererConfig.toggleUI(), name: 'Settings...'}),
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
            }
        });
    } // function makePatternTransformParams(){

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
                frameTime:      ParamFloat({obj: cfg, key: 'frameTime', min: 0, max: 10000, step: 0.1, name: 'frame time', serializable: false,}),
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
                useSymm: ParamBool({
                    obj: conf,
                    key: 'useSymm',
                    name: 'use symmetry',
                    onChange: scheduleRepaint,
                }),
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
                tool:             ParamChoice({obj: mConfig.tools,key: 'toolName',choice: TOOL_NAMES,name: 'tool',serializable: false,onChange: onToolNameChanged}),
                transform:        ParamObj({name: 'move', obj: mNavigator}),
                drawing:          ParamObj({name: 'draw',obj: mDrawingToolRenderer}),
            }
        });

    }

    //
    //
    //
    function initGUI() {

        mGUI = new GuiBuilder({
            width: 300
        });
        mGUI.domElement.id = "rightGUI";

        createParamUI(mGUI, getParams());

        // to do final initialization
        onGroupChanged();

        // Connect the 'script params' DatGUI subfolder inside the 'scripting' folder.
        // Must happen after createParamUI() so the 'scripting' folder already exists.
        mScripting.initGUI(mGUI.__folders?.['scripting']);

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
        let btnCount = 8;
        buttons.tools       = createImgBtn({title:'options',   src:resPath('btn_options.svg'),action:toggleGUI});
        container.appendChild(buttons.tools);
        // Show Run + Restart buttons when animation is available
        if (mCanAnimate) {
          buttons.run         = createImgBtn({title:LABEL_RUN,     src:resPath('btn_play.svg'),   action:onToggleRun});
          buttons.restart     = createImgBtn({title:'Restart',     src:resPath('btn_restart.svg'), action:onRestartAnimation});
          container.appendChild(buttons.run);
          container.appendChild(buttons.restart);
          btnCount += 2;
        }
        if(mPattern.initSimulation){
          buttons.init        = createImgBtn({title:'initialize',src:resPath('btn_restart.svg'),action:onInitSimulation});
          container.appendChild(buttons.init);
          btnCount ++;
        }
        buttons.recording   = createImgBtn({title:'recording', src:resPath('btn_record_start.svg'),action:onToggleRecording});
        buttons.download    = createImgBtn({title:'export image',src:resPath('btn_download.svg'),action:onSaveImage});
        buttons.full_screen = createImgBtn({title:'full screen',src:resPath('btn_full_screen.svg'),action:onFullScreen});
        buttons.move        = createImgBtn({title:'move',      src:resPath('btn_move2.svg'),action:()=>setTool('move')});
        buttons.patternTransform = createImgBtn({title:'pattern transform',src:resPath('btn_pattern_transform.svg'),action:()=>setTool('patternTransform')});
        buttons.draw        = createImgBtn({title:'draw',      src:resPath('btn_draw.svg'),action:()=>setTool('draw')});
        buttons.pick        = createImgBtn({title:'pick',      src:resPath('btn_pick.svg'),action:()=>setTool('pick')});
        let space       = createImgBtn({                   src:resPath('btn_vbar.svg')});
        space.style.width = '20px';
        container.appendChild(buttons.recording);
        container.appendChild(buttons.download);
        container.appendChild(buttons.full_screen);
        
        container.appendChild(space);
        
        container.appendChild(buttons.move);
        container.appendChild(buttons.patternTransform);
        container.appendChild(buttons.draw);
        container.appendChild(buttons.pick);

        let btnWidth = 40;
        let titleHeight = 22;
        
        // floating window
        let intWin = null;
        if(tbOptions.useInternalWindow){
            intWin = createInternalWindow({
                                        width: (btnWidth*btnCount + 21) + 'px', 
                                        height: (btnWidth + titleHeight) + 'px',
                                        left: '1px', 
                                        top:  '1px',
                                        title: 'toolbox',
                                        canResize: false,
                                        storageId: 'toolbox',
                                        });  
            let interior = intWin.interior;
            
            interior.style.overflowY = "hidden";
            interior.style.overflowX = "hidden";
            interior.style.width = 'max-content';
            interior.style.height = 'max-content';
            
            //document.body.appendChild(container);
            interior.appendChild(container);
        }                       
        return {container, buttons};

    } //function makeToolbox()

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

        window.addEventListener('resize', () => {
            onResize();
        });
    } // function addEventListeners(canvas)


    function makeEventHandler() {

        function handleEvent(e) {
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
            switch (toolName) {
            default:
                console.error('unknown tool: ', toolName);
                break;
            case TOOL_MOVE:
                break;
            case TOOL_PICK:
            case TOOL_DRAW:
                e.wpnt = canvas2sim([e.canvasX, e.canvasY]);
                break;
            case TOOL_PATTERN_TRANSFORM:
                {
                    let wpnt = [0, 0];
                    mCanvasTransform.invTransform([e.canvasX, e.canvasY], wpnt);
                    e.wpnt = wpnt;
                }
                break;
            }
            for (let i = 0; i < mActiveTools.length; i++) {
                const tool = mActiveTools[i];
                if (tool && tool.handleEvent) {
                    tool.handleEvent(e);
                    if (e.isConsumed) {
                        break;
                    }
                }
            }

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
        onGroupChanged();
        
    }

    function onGroupChanged() {

        if (DEBUG) console.log(`${MYNAME}.onGroupChanged()`);
        mGroupChanged = true;
        mScripting.events.fire('groupChanged', mGroup);
        scheduleRepaint();

    }

    // prepare group data if necessary 
    function prepareGroupData(){
        
        mGroup = mGroupMaker.getGroup();
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

        console.log(`${MYNAME}.onResize():`, mCanvas.glCanvas.clientWidth);
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
        let tools = btns ? [btns.move, btns.draw, btns.pick, btns.patternTransform] : [];
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
        activeTool = null;

        switch (toolName) {
        default:
            mActiveTools = [mNavigator];
            break;
        case TOOL_MOVE:
            mCanvas.overlay.style.cursor = [CUR_MOVE, 'move'];
            mActiveTools = [mNavigator];
            break;
        case TOOL_PICK:
            mCanvas.overlay.style.cursor = [CUR_PICK, 'crosshair'];
            if (!mDrawingToolHandler) {
                mDrawingToolRenderer.init({ctx: mGLCtx});
                mDrawingToolHandler = DrawingToolHandler({renderer: mDrawingToolRenderer});
            }
            mActiveTools = [mDrawingToolHandler, mNavigator];
            break;
        case TOOL_DRAW:
            mCanvas.overlay.style.cursor = [CUR_DRAW, 'pointer']; //

            mDrawingToolRenderer.init({ctx: mGLCtx});
            mDrawingToolHandler = DrawingToolHandler({renderer: mDrawingToolRenderer});
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
                    getGroup: getGroup
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
                timeStamp:          mTimeStamp
                };
        const patternData = mPattern.getPatternData(renderParams);
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
                });
            
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
            uSimBuffer:     simBuffer.read,
            uGroupData:     mPackedGroupData,
            uIterations:    symOptions.symIterations,
            uSymmetry:      symOptions.useSymm,            
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
        let conf = mConfig.display;
        if (mPrevTime != 0)
            conf.frameTime = Number((0.95 * conf.frameTime + (time - mPrevTime) * 0.05).toFixed(1));
        //console.log('frame time: ', (time - mPrevTime));
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
                
                renderFrame();                
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
            renderFrame();
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
            mScripting.callSetTime(mConfig.recording.animTime);

            if(mPattern.doStep) {
                mPattern.doStep();
            }
            if(mPattern.render){
                mPattern.render({gl:mGLCtx.gl, animationTime: mConfig.recording.animTime});            
            }
        } 

        resizeCanvases();
        onClearOverlay();
        onClearGLCanvas();
        
        renderGLCanvas();
        
        let opt = mConfig.misc.options;
        if (opt.showGrid || opt.showRuler)
            onDrawGridAndRuler();

        if (activeTool && activeTool.renderUI) {
            activeTool.renderUI(mOverlayCtx, mCanvasTransform);
        }

        updateDataPlot();

        mScripting.events.fire('afterRender');

    } // function renderFrame()

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
        if(false) console.log(`${MYNAME}.onPatternTransformChanged()`, ptc);
        mPatternTransform.setParams({
            center: [ptc.centerX, ptc.centerY],
            scale: ptc.scale,
            angle: ptc.angle * TORADIANS
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
        // transform group into texture space
        let tr3 = ITransform.getScale(1 / ptc.scale);
        let tr2 = ITransform.getRotation([0, 0, 1], -TORADIANS * ptc.angle);
        let tr1 = ITransform.getTranslation([-ptc.centerX, -ptc.centerY]);
        let tr = tr1.concat(tr2).concat(tr3);

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

        if (!mGUI)
            return;
        
        mGUI.domElement.hidden = !mGUI.domElement.hidden;
        //const style = mGUI.domElement.style;
        //style.display = (style.display == 'none') ? '' : 'none'

    }
    
    function setUIvisible(visible){
        const style = mGUI.domElement.style;
        if(visible) 
            style.display = '';
        else   
            style.display = 'none';
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

    function exportImageWrapper(chosenName, folderHandle, exportWidth, exportHeight, imgFormat) {
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
            setIsExporting: (v) => { mIsExporting = v; }
        };
        exportImage(chosenName, folderHandle, exportWidth, exportHeight, rendererObj, imgFormat);
    }

    //
    //
    //
    function onSaveImage() {
        const name = getImageName();
        mDocManager.openExportImageDialog({
            suggestedName: name,
            suggestedWidth: mRendererConfig.exportWidth,
            suggestedHeight: mRendererConfig.exportHeight,
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
    function makeThumbnail(){
        
        let tmbCanvas = getSquareThumbnailCanvas(mCanvas.glCanvas, TMB_WIDTH);
        return tmbCanvas;
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
