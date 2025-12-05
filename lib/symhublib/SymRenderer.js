import {
    DatGUI,
    ParamGui,
    guiUtils,
    isDefined,
    isFunction,
    $,
    fa2str,
    str2fa,
    hexToColor,
    premultColorArray,
    hexColorToArray,
    hexToPremult,
    resizeCanvas,
    getWebGLContext,

    blit,
    blitVP,
    createFBO,
    createDoubleFBO,

    CanvasTransform,
    TransformMotion2D,
    iPlane,
    iSphere,
    iPoint,
    iDrawSplane,
    splaneToString,
    getBlitMaker,
    PlaneNavigator,
    Group_WP,

    iPackDomain,
    iPackRefCount,
    iPackTransforms,
    DataPacking,
    TW,
    TORADIANS,
    ITransform,
    
    clamp01,
    sqrt,
    getPixelRatio,

    GroupUtils,

    drawGridAndRuler,
    //drawFDSampler,
    drawTexture,

    DrawingToolRenderer,
    DrawingToolHandler,
    createDataPlot,

    readPixelsFromBuffer,
    CanvasSize,
    Colormaps,
    writeCanvasToFile,
    Globals,
    AnimationControl,
    createVideoRecorder,
    createVideoRecorder2,
    createVideoRecorder3,
    date2s,
    getTime,
    transformGroup,
    initFragments,
    TextureManager,
    Textures,
    TextureFile,

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
    setParamValues,
    createInternalWindow,
    createImageSelector,
    createPresetsFilesFilter,        
    openFile,
    saveFileAs,
    saveTextFileAs,
    canvasToLocalFile,
    writeFile,
    getSquareThumbnailCanvas,
    getImageSaver,
    getDocumentHandler, 
    
    add, 
    mul, 
    cross, 
    dot,
    cDiv,
    PI,
    SymRendererUpgradeData,
    VisualizationOverlay,
    SymRendererPrograms, 
    VisualizationManager,
    
    getHashParams,
    reorderKeys,
    
}
from "./modules.js";

const MYNAME = 'SymRenderer';
const FILE_FORMAT_RELEASE = 1;
const DEBUG = false;

//const GuiBuilder = ParamGui;
const GuiBuilder = DatGUI;

const IMG_PREFIX = 'img';
const PARAM_PREFIX = 'par';

const TMB_WIDTH = 256;//1024;
const TYPE_JPEG = 'image/jpeg';
const TYPE_PNG = 'image/png';
const EXT_PNG = '.png';
const EXT_JPEG = '.jpg';
const TMB_EXT = EXT_PNG;
const TMB_TYPE = TYPE_PNG;
const EXT_JSON = '.json';
const EXT_JSON_PNG = ".json.png";
const MS = 0.001; // millisecond
const TOOL_DRAW = 'draw';
const TOOL_MOVE = 'move';
const TOOL_PICK = 'pick';
const INCREMENT = 1.e-12;
const TOOL_NAMES = [TOOL_MOVE, TOOL_DRAW, TOOL_PICK];


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
const CUR_MOVE              = `url(${resPath('cur_move3.svg')}) 15 15`;
const CUR_PICK              = `url(${resPath('cur_pick2.svg')}) 1 31`;
const CUR_DRAW              = `url(${resPath('cur_draw2.svg')}) 1 31`;


const LABEL_STOP_RECORDING = "Stop Recording";
const LABEL_START_RECORDING = "Start Recording";

const DEFAULT_DOC_FOLDER_ID = 'symrenderer_doc_folder';

const INTERP_LINEAR = 'linear';
const INTERP_QUADRATIC = 'biquadratic';
const INTERP_NAMES = [
    INTERP_LINEAR,
    INTERP_QUADRATIC
];

/**
container for single simulation
options.simCreator - function which creates simulation
 */
function SymRenderer(options) {
    //window.localStorage.clear();
    Object.assign(options, getHashParams());
    if(DEBUG)console.log(`${MYNAME} options: `, options);
    // pointer to myself. 

    const myself = {

        run: run,
        fullscreen: onFullScreen,
        toggleGUI: toggleGUI,
        saveImage: onSaveImage,
        getParams: getParams,
        // method of groupMaker 
        getGroup:  getGroup,
    };
    
    let loadStartTime = getTime();
    
    // some components needs that to locate the files ??
    Globals.LIBRARY_PATH = "js/";
    
    let mDocFolderId = (options.docFolderId)?options.docFolderId: DEFAULT_DOC_FOLDER_ID;
    let mPreset = options.preset;
    let mSimCreator = options.simCreator;
    let mSamples = options.samples;
    let mGroupMaker = options.groupMaker;
    let mParamsOrder = null;
    
    
    if(!mGroupMaker){
        console.error('mGroupMaker is undefined');
        return {};
    }
    mGroupMaker.setOptions({onChanged:onGroupChanged});
        
    if (DEBUG)console.log(`${MYNAME} (simulation: ${mSimCreator.getName()})`);

    window.addEventListener('hashchange', onHashChange);
    //

    let mDocHandler = getDocumentHandler({docFolderID:mDocFolderId});
    let mCurrentDocument = null;

    // parameters of visualization
    let mMiscConfig = {

        interpolation: INTERP_QUADRATIC,
        plotType: 0,
        dataSlice: 0.5,
        
        options: {
            showGrid:    false,//true,
            showRuler:   false,//true,
            showChecker: false,
            useMipmap:   false,
        },
        
    };

    let mSymConfig = {
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

    let mDisplayConfig = {

        canvasSize: CanvasSize.getNames()[0],
        customWidth: 1000,
        customHeight: 1000,
        sizeMultiplier: 1,
        frameTime: 0.0,
        backgroundColor: '#FFFFFF00',

    };

    let mRecorderConfig = {
        animTime: 0,
        animSpeed: 1, 
        startFrame: 0,
        endFrame: 100,
    };

    let mConfig = {
        
        simulationRunning: false,

        display: mDisplayConfig,
        misc:    mMiscConfig,

        recording: mRecorderConfig,
        symmetry: mSymConfig,

        simTransConfig: {
            simCenterX: -0.,
            simCenterY: -0.,
            simScale: 0.5,
            simAngle: 0,
        },
        tools: {
            toolName: TOOL_MOVE,
        },
    };


    // repaint flag
    let mNeedRepaint = false;

    // handle of folder to save files into
    let exportFolderHandle = null;
    
    const mCanvas = createCanvas();
    
    let mDocumentsSelector = null;
    let mSamplesSelector = null;
    
    let mDataPlot = null;
    
    // toolbox with buttons 
    let mToolbox = null;
    
    // recorder of video 
    const mRecorder = createVideoRecorder3({});
    //
    // UI root 
    let mGUI = null;
    let mImageSaver = getImageSaver('image_export');
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
    let {
        simCenterX,
        simCenterY,
        simScale,
        simAngle
    } = mConfig.simTransConfig;
    
    let gSimTransform = new TransformMotion2D({
        center: [simCenterX, simCenterY],
        scale: simScale,
        angle: simAngle * TORADIANS
    });

    let mBlitMaker = getBlitMaker(mGLCtx.gl);

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

    let mEventHandler = mNavigator; // current event handler

    let mGroup = mGroupMaker.getGroup(); // the current group

    // create texture to store group data
    let mPackedGroupData = DataPacking.createGroupDataSampler(mGLCtx.gl);
    DataPacking.packGroupToSampler(mGLCtx.gl, mPackedGroupData, mGroup);

    let mTransGroup = mGroup;//.clone(); // group transformed into texture space
    
    // data of the transformed group to use inside of simulation buffer
    let mTransGroupData = DataPacking.createGroupDataSampler(mGLCtx.gl);

    DataPacking.packGroupToSampler(mGLCtx.gl, mTransGroupData, mTransGroup);

    addEventListeners(mCanvas.overlay);
    // controls of UI
    //const gControls = {};

    let mTextureMaker = null;  // 
    
    let mMipmapBuffer = null;  // buffer used for off-screen rendering 
    
    // the simulation object
    let mSimulation = null;   
    // visualization renderer object
    let mVisualization =  (options.visualization) ? (options.visualization): VisualizationManager(); 
    
    //
    // set of parameters usef for UI display and for state saving
    //
    let mParams = null;
    let mPrograms = SymRendererPrograms();
    let startTime = 0;
    let mTimeStamp = 0;
    // 
    const mAppInfo = {
        appName: (options.appName) ? options.appName : makeAppName(),
        fileFormatRelease: FILE_FORMAT_RELEASE,
    }

    function makeAppName(){
        
        if(DEBUG)console.log(`${MYNAME}.makeAppName() mGroupMaker: `, mGroupMaker);
        
        return [MYNAME,mGroupMaker.getClassName(),mSimCreator.getClassName(), mNavigator.getClassName()].join('.');
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

        mSimulation = mSimCreator.create();
        mSimulation.init(mGLCtx);
        mVisualization.init({glCtx: mGLCtx, onChange:scheduleRepaint});
        if (DEBUG)
            console.log(`${MYNAME} mSimulation: ${mSimulation.getName()}`);
        mSimulation.addEventListener('imageChanged', onSimulationChanged);

        mTextureMaker = new TextureFile({
            texInfo: Textures.t1.concat(Textures.t2).concat(Textures.experimental),
            gl: mGLCtx.gl,
            onChanged: onTextureChanged
        });

        const MIPMAP_SIZE = 512;
        const gl = mGLCtx.gl;
        mMipmapBuffer = createFBO(gl, MIPMAP_SIZE, MIPMAP_SIZE, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,  gl.LINEAR_MIPMAP_LINEAR);
                                  //(gl, w, h, internalFormat, format, type, filtering) 
        
        initGUI();
        mToolbox = makeToolbox();
        //toggleGUI();
        mSimulation.setGroup(mGroup);
        onCanvasSize();
        mDrawingToolRenderer.init({
            simulation: mSimulation,
            repainter: {
                scheduleRepaint: scheduleRepaint
            }
        });
        mCanvas.container.addEventListener("fullscreenchange", onFullScreenChange);
        if(mSamples){
            onShowSamples() ;
            let imageItems = mSamples;
            mSamplesSelector.addItems(imageItems);          
        }  
        mCurrentDocument = mDocHandler.createDocument({appInfo: mAppInfo, params:mParams, thumbMaker: getThumbMaker()});
        mCurrentDocument.setName(getNewDocumentName());
        if(mPreset) readParamsUrl(mPreset);
        
        startTime = Date.now();
        // time of application from start
        mTimeStamp = 0.;
        
        // start animation loop
        startAnimationLoop();
    }

    //
    //    creates layered canvas for GL rendering and 2D rendering
    //
    function createCanvas(){
        
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
        
        // floating window
        let intWin = createInternalWindow({
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
        
        //document.body.appendChild(toolbox);
        interior.appendChild(canvasContainer);
                        
                        
        return {
            intWin: intWin, 
            container: canvasContainer,
            glCanvas:  glCanvas,
            overlay:   overlay,            
        };
    }

    function resizeCanvases() {

        let scale = mConfig.display.sizeMultiplier;
        //console.log('resizeCanvases():', mCanvas.glCanvas.width);
        resizeCanvas(mCanvas.glCanvas, scale);
        resizeCanvas(mCanvas.overlay, scale);

        //console.log(`mCanvas.glCanvas: [${mCanvas.glCanvas.width} x ${mCanvas.glCanvas.height}]`);

    }

    function makeParams() {

        const params = {

            runSim:         ParamFunc({func: onToggleRun, name: LABEL_RUN}),
            files:          makeFilesParams(),
            display:        makeDisplayParams(),
            recording:      makeRecordingParams(mConfig.recording),
            simulation:     ParamObj({name: 'simulation', obj: mSimulation}),
            simTransform:   makeSimTransformParams(),
            visualization:  ParamObj({name: 'visualization', obj: mVisualization}),
            misc:           makeMiscParams(),
            symmetry:       makeSymParams(),
            tools:          makeToolsParams(),
        };
        
        if (mParamsOrder){
            return reorderKeys(params, mParamsOrder);
        } else {
            return params;
        }
    } // function makeParams;

    //
    //
    //
    function makeFilesParams() {

        return ParamGroup({
            name: 'files',
            params: {
                showSamples:    ParamFunc({func: onShowSamples, name: 'Samples...'}),
                showDocuments:  ParamFunc({func: onShowDocuments, name: 'Files...'}),
                read:           ParamFunc({func: onOpenDocument, name: 'Open...'}),
                selectDocFolder:ParamFunc({func: onSelectFolder,name: 'Select Doc Folder...'}),    
                save:           ParamFunc({func: onSaveDocument, name: 'Save' }),
                saveNew:        ParamFunc({func: onSaveNewDocument,name: 'Save New...'}),
                saveAs:         ParamFunc({func: onSaveDocumentAs,name: 'Save As...'}),
                saveImage:      ParamFunc({func: onSaveImage,name: 'Save Image'}),
                selectImageFolder: ParamFunc({func: onSelectImageFolder,name: 'Select Image Folder...'}),                
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
                endFrame: ParamInt({obj: cfg,key: 'endFrame',min: 0,max: 100000,name: 'End Frame'}),
                toggleRecording: ParamFunc({func: onToggleRecording,name: LABEL_START_RECORDING}),
            }

        });
    } // function makeRecordingParams()

    //
    //
    //
    function makeSimTransformParams() {

        let onc = onSimTransChanged;
        let conf = mConfig.simTransConfig;
        const inc = 0.00001;
        return ParamGroup({
            name: 'simulation transform',
            params: {
                simCenterX: ParamFloat({obj:conf, key: 'simCenterX', min: -10, max: 10, step: inc, name: 'center X', onChange: onc}),
                simCenterY: ParamFloat({obj:conf, key: 'simCenterY', min: -10, max: 10, step: inc, name: 'center Y', onChange: onc}),
                simScale:   ParamFloat({obj:conf, key: 'simScale',  min: 0.0001, max: 100, step: inc, name: 'scale', onChange: onc}),
                simAngle:   ParamFloat({obj:conf, key: 'simAngle', min: -360, max: 360, step: inc, name: 'angle(deg)', onChange: onc}),
            }
        });
    } // function makeSimTransformParams(){

    //
    //
    //
    function makeDisplayParams() {
        
        let cfg = mConfig.display;
        let ocus = onCustomSize;
        return ParamGroup({
            name: 'display',
            params: {
                canvasSize:     ParamChoice({obj: cfg,key: 'canvasSize',choice: CanvasSize.getNames(), serializable:false, onChange: onCanvasSize}),
                customWidth:    ParamInt({obj: cfg,key: 'customWidth', min: 128, max: 16 * 1024, name: 'custom width',  onChange: ocus}),
                customHeight:   ParamInt({obj: cfg,key: 'customHeight',min: 128,max: 16 * 1024,name: 'custom height',  onChange: ocus}),
                sizeMultiplier: ParamChoice({obj: cfg,key: 'sizeMultiplier',choice:[1,2,3,4],serializable:false, onChange: onCanvasSize}),
                backgroundColor: ParamColor({obj: cfg,key: 'backgroundColor',name: 'background',onChange: scheduleRepaint}),
                frameTime:      ParamFloat({obj: cfg, key: 'frameTime', min: 0, max: 10000, step: 0.1, name: 'frame time', listen: true,}),
            }
        });
    } // function makeDisplayParams()

    //
    //
    //
    function makeVisOptionsParams() {

        let visConf = mConfig.misc;
        let onc = scheduleRepaint;
        let conf = visConf.options;
        return ParamGroup({
            name: 'options',
            params: {
                showChecker:    ParamBool({obj:conf,key: 'showChecker', name: 'Checker', onChange: onShowChecker}),
                showGrid:       ParamBool({obj:conf,key: 'showGrid', name: 'Grid', onChange: onc}),
                showRuler:      ParamBool({obj:conf,key: 'showRuler',name:'Ruler',onChange: onc}),
            }
        });
    } // function makeVisOptionsParams()
    

    //
    //
    //
    function makeMiscParams() {

        let visConf = mConfig.misc;
        let onChange = scheduleRepaint;

        return ParamGroup({
            name: 'misc',
            params: {
                options:    makeVisOptionsParams(),
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

        return ParamGroup({
            name: 'symmetry',
            params: {
                group: ParamObj({
                    name: 'group',
                    obj: mGroupMaker,
                }),
                transform: makeGroupTransformParams(),
                options: makeSymOptionsParams(),

            }
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
                tool:
                ParamChoice({obj: mConfig.tools,key: 'toolName',choice: TOOL_NAMES,name: 'tool',serializable: false,onChange: onToolNameChanged}),
                //transform: ParamObj({name: 'transform', obj: mCanvasTransform}),
                transform: ParamObj({name: 'move', obj: mNavigator}),
                drawing: ParamObj({name: 'draw',obj: mDrawingToolRenderer}),
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

        //let gui = mGUI.addFolder('old UI');

        createParamUI(mGUI, getParams()); //.createUI(mGUI);

        // to do final initialization
        onGroupChanged();

    } // initGUI()

    //
    //  create toolbox 
    //
    function makeToolbox() {

        if (DEBUG)
            console.log(`${MYNAME}.makeToolbox()`); 
        //let toolbox = $('#ttt');
        //console.log('toolsbox:', toolbox); 
        
        let toolbox = document.createElement('div');        
        
        let btn = {};
        
        function createImgBtn(opt={}){
            let btn = document.createElement('input');
            btn.src = opt.src;
            btn.title = opt.title;
            btn.onclick = opt.action;
            btn.className = 'imgbutton';
            btn.type = 'image';
            return btn;
        }
        let btnCount = 7;
        btn.tools       = createImgBtn({title:'options',   src:resPath('btn_options.svg'),action:toggleGUI});
        toolbox.appendChild(btn.tools);
        if ( mSimulation.canAnimate || mSimulation.doStep ) {
          btn.run         = createImgBtn({title:LABEL_RUN,      src:resPath('btn_play.svg'),action:onToggleRun});
          toolbox.appendChild(btn.run);
          btnCount ++;
        }
        if(mSimulation.initSimulation){
          btn.init        = createImgBtn({title:'initialize',src:resPath('btn_restart.svg'),action:onInitSimulation});
          toolbox.appendChild(btn.init);
          btnCount ++;
        }
        btn.recording   = createImgBtn({title:'recording', src:resPath('btn_record_start.svg'),action:onToggleRecording});
        btn.download    = createImgBtn({title:'save image',src:resPath('btn_download.svg'),action:onSaveImage});
        btn.full_screen = createImgBtn({title:'full screen',src:resPath('btn_full_screen.svg'),action:onFullScreen});
        btn.move        = createImgBtn({title:'move',      src:resPath('btn_move2.svg'),action:()=>setTool('move')});
        btn.draw        = createImgBtn({title:'draw',      src:resPath('btn_draw.svg'),action:()=>setTool('draw')});
        btn.pick        = createImgBtn({title:'pick',      src:resPath('btn_pick.svg'),action:()=>setTool('pick')});
        let space       = createImgBtn({                   src:resPath('btn_vbar.svg')});
        space.style.width = '20px';
        toolbox.appendChild(btn.recording);
        toolbox.appendChild(btn.download);
        toolbox.appendChild(btn.full_screen);
        
        toolbox.appendChild(space);
        
        toolbox.appendChild(btn.move);
        toolbox.appendChild(btn.draw);
        toolbox.appendChild(btn.pick);

        let btnWidth = 40;
        let titleHeight = 22;
        
        // floating window
        let intWin = createInternalWindow({
                                        //width: 'max-content', 
                                        //height: 'max-content',
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
        
        //document.body.appendChild(toolbox);
        interior.appendChild(toolbox);
                       
        return btn;

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
            case TOOL_DRAW:
                e.wpnt = canvas2sim([e.canvasX, e.canvasY]);
                break;
            }
            mEventHandler.handleEvent(e);

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
        gSimTransform.invTransform(wpnt, tpnt);
        return tpnt;

    }

    function onTextureChanged() {

        //if (DEBUG) console.log(`${MYNAME} texture changed`);
        //let tex = mTextureMaker.getTexture();
        //console.log('texture: ', tex);
        scheduleRepaint();
    }

    function onGroupChanged() {

        if (DEBUG) console.log(`${MYNAME}.onGroupChanged()`);
        mGroup = mGroupMaker.getGroup();

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

        scheduleRepaint();

    }

    function onCustomSize() {

        let conf = mConfig.display;
        let canvInfo = CanvasSize.getCanvas(conf.canvasSize);
        if (DEBUG)
            console.log('canv: ', canvInfo);

        if (canvInfo != CanvasSize.CUSTOM) {
            return;
        }
        setElementSize(mCanvas.container, conf.customWidth, conf.customHeight);
        resizeCanvases();
        mCanvasTransform.onCanvasResize();

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
    
    function stopAnimation(){
        mConfig.simulationRunning = false;
        mParams.runSim.setName(LABEL_RUN);
        if (isDefined(mToolbox.run)){
            mToolbox.run.src = IMG_RUN;        
            mToolbox.run.title = LABEL_RUN;
        }
        scheduleRepaint();
    }

    function startAnimation(){
        
        if ( ! mParams.runSim )
            return;
        //start simulation
        mConfig.simulationRunning = true;
        mParams.runSim.setName(LABEL_STOP);
        if (isDefined(mToolbox.run)){
            mToolbox.run.src = IMG_STOP;
            mToolbox.run.title = LABEL_STOP;
        }

        scheduleRepaint();
    }

    function onShowChecker() {
        //console.log('document.body: ', document.body);
        //console.log('document.body.style: ', document.body.style);
        //let style = document.body.style;

        let style = mCanvas.container.style;

        if (mConfig.misc.options.showChecker) {
            style.backgroundImage = 'url("images/checker_bgrnd_10.png"';
            style.backgroundSize = '30px';
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

        //console.log('onResize():', mCanvas.glCanvas.clientWidth);
        mCanvasTransform.onCanvasResize();
        //scheduleRepaint();
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

        let btns = mToolbox;
        let tools = [btns.move, btns.draw, btns.pick];
        let toolBtn = btns[toolName];
        const BGRND1 = "rgba(80, 80, 80, 0.9)";
        const BGRND2 = "rgba(255, 255, 255, 0.9)";
        toolBtn.style["background-color"] = BGRND1;
        tools.forEach((e) => {
            if (e != toolBtn)
                e.style["background-color"] = BGRND2
        });

        mConfig.tools.toolName = toolName;

        switch (toolName) {
        default:
            break;
        case TOOL_MOVE:
            mCanvas.overlay.style.cursor = [CUR_MOVE, 'move'];
            mEventHandler = mNavigator;
            break;
        case TOOL_PICK:
            mCanvas.overlay.style.cursor = [CUR_PICK, 'crosshair'];
            break;
        case TOOL_DRAW:
            mCanvas.overlay.style.cursor = [CUR_DRAW, 'pointer']; //

            mDrawingToolRenderer.init({
                ctx: mGLCtx
            });
            mDrawingToolHandler = DrawingToolHandler({
                renderer: mDrawingToolRenderer
            });
            mEventHandler = mDrawingToolHandler;
            break;
        }

    }

    function disableBlending(){
        
        let gl = mGLCtx.gl;
        gl.disable(gl.BLEND);        
        
    }
            
    //
    //  render GL canvas
    //
    function renderGLCanvas() {

        mVisualization.render({
                dataBuffer:     mSimulation.getSimBuffer({simTransConfig:mConfig.simTransConfig}), 
                navigator:      mNavigator,
                timeStamp:      mTimeStamp,                    
                renderUni:      getRenderUni(),
                navigatorUni:   mNavigator.getUniforms({}, mTimeStamp),            
                canvas:         mCanvas.glCanvas,                    
                });
            
    }

    //
    //  returns common uniforms used for symmetric rendering 
    //
    function getRenderUni(){
        
        let {
            simCenterX,
            simCenterY,
            simScale,
            simAngle
        } = mConfig.simTransConfig;
        let visConf     = mConfig.misc;
        let symOptions  = mConfig.symmetry.options;
        let simBuffer   = mSimulation.getSimBuffer({simTransConfig:mConfig.simTransConfig});

        let ss = 0.5 / simScale; // 0.5 - because texture box originaly has range [0,1]. But drawing images have range [-1,1]
        let sa = simAngle * TORADIANS;
        
        let renderUni = {
            uBufScale:      [ss * Math.cos(sa), -ss * Math.sin(sa)],
            uBufCenter:     [simCenterX, simCenterY],
            uSimBuffer:     simBuffer.read,
            uInterpolation: getInterpolationId(visConf.interpolation),
            uGroupData:     mPackedGroupData,
            uIterations:    symOptions.symIterations,
            uSymmetry:      symOptions.useSymm,            
        }
                
        return renderUni;
    }
    
    //
    //  return uni for rendering with mipmap
    //
    function getMipmapUni(){

        let visOpt      = mConfig.misc.options;       
        // mipmap uniforms             
        let mipmapUni = {
            uUseMipmap: visOpt.useMipmap,
        };
        if(visOpt.useMipmap){
           mipmapUni.uMipmapData = mMipmapBuffer;                
        }
    }
        
    let oldTime = 0;

    //
    //  main painting function, repaint everything
    //
    function onRepaint() {

        let DEBUG_REC = false;
        if(DEBUG_REC) console.log(`${MYNAME}.onRepaint() mNeedRepaint:`,mNeedRepaint);
        requestAnimationFrame(onRepaint);
        let time = Date.now();
        let conf = mConfig.display;
        if (oldTime != 0)
            conf.frameTime = Number((0.95 * conf.frameTime + (time - oldTime) * 0.05).toFixed(1));
        //console.log('frame time: ', (time - oldTime));
        let deltaTime = time-oldTime;
        
        oldTime = time;
        
        if(mConfig.simulationRunning) {
            let rcfg = mConfig.recording;
            rcfg.animTime += rcfg.animSpeed*(deltaTime*MS);
            mParams.recording.animTime.updateDisplay();
        }
        
        mTimeStamp = time - startTime;
        
        if (!mNeedRepaint) {
            return;
        }
        clearRepaintFlag();
                
        if(DEBUG_REC) console.log(`${MYNAME}.isRecording():`,mRecorder.isRecording());
        if (mRecorder.isRecording()) {
            if(DEBUG_REC) console.log(`${MYNAME}.mRecorder.isReady()`,mRecorder.isReady());
            if (mRecorder.isReady()) {
                               
                // TODO mTimeStamp has to be taken from mRecorder
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

        if (mConfig.simulationRunning && mSimulation.doStep) {
            
            mSimulation.doStep();

        } 
        if(mSimulation.render){
            
           mSimulation.render({gl:mGLCtx.gl, animationTime: mConfig.recording.animTime});
           
        }
        resizeCanvases();
        onClearOverlay();
        onClearGLCanvas();
        
        renderGLCanvas();
        
        let opt = mConfig.misc.options;
        if (opt.showGrid || opt.showRuler)
            onDrawGridAndRuler();

        updateDataPlot();

        //mSimulation.repaint();

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

    function onSimTransChanged() {

        let {
            simCenterX,
            simCenterY,
            simScale,
            simAngle
        } = mConfig.simTransConfig;

        gSimTransform.setParams({
            center: [simCenterX, simCenterY],
            scale: simScale,
            angle: simAngle * TORADIANS
        });
        updateTransGroup();
        scheduleRepaint();

    }

    //
    //  update transformed group data
    //
    function updateTransGroup() {

        let {
            simCenterX,
            simCenterY,
            simScale,
            simAngle
        } = mConfig.simTransConfig;
        // transform group into texture space
        let tr3 = ITransform.getScale(1 / simScale);
        let tr2 = ITransform.getRotation([0, 0, 1], -TORADIANS * simAngle);
        let tr1 = ITransform.getTranslation([-simCenterX, -simCenterY]);
        let tr = tr1.concat(tr2).concat(tr3);

        mTransGroup = mGroup.clone();
        mTransGroup.applyTransform(tr);

        mSimulation.setGroup(mTransGroup);

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

        //let plotData = mSimulation.getPlotData();
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

        let simBuffer = mSimulation.getSimBuffer({simTransConfig:mConfig.simTransConfig});

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
        
        if(mCurrentDocument) {
            return mCurrentDocument.getName();
        } else {
            return getNewDocumentName();                   
        }
    }

    function onRecordingEnded() {
        // call back to refresh UI
        mParams.recording.toggleRecording.setName(LABEL_START_RECORDING);
        mToolbox.recording.src = IMG_RECORDING_START;
        stopAnimation();

    }

    function onToggleRecording() {

        if (mRecorder.isRecording()) {
            // stop recording
            mRecorder.stopRecording();
            mRecorder.saveRecording();
            mParams.recording.toggleRecording.setName(LABEL_START_RECORDING);
            if (isDefined(mToolbox.recording))
                mToolbox.recording.src = IMG_RECORDING_START;
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

            if (isDefined(mToolbox.recording))
                mToolbox.recording.src = IMG_RECORDING_STOP;
            if (!mConfig.simulationRunning) {
                onToggleRun();
            }
        }
    }

    function onInitSimulation() {
        if (DEBUG)
            console.log('onInitSimulation()');
        mSimulation.initSimulation && mSimulation.initSimulation();

    }

    function onFullScreen() {
        let canvas = mCanvas.container;
        const f = canvas.requestFullscreen || canvas.webkitRequestFullscreen;
        if (f)
            f.apply(document.body);//canvas);
        //onResize();
    }

    function toggleGUI() {

        if (!mGUI)
            return;
        const style = mGUI.domElement.style;
        style.display = (style.display == 'none') ? '' : 'none'

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

    function onSelectFolder() {
        
        if (DEBUG)console.log(`${MYNAME}.onSelectFolder()`);
        
        mDocHandler.selectDocFolder();
            
    }

    //
    //
    //
    function onSaveImage() {
        
        let name = getImageName();
        mImageSaver.saveImage(mCanvas.glCanvas, name, getParamsAsJSON(name));
        
    }

    function onSelectImageFolder() {        
    
        mImageSaver.selectExportFolder();        
        
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
    //  saving document into new file 
    //
    function onSaveNewDocument() {
        
        let newName = getNewDocumentName();
        saveDocAs(newName);
        
    } 

    function onSaveDocumentAs() {
        
        let suggestedName = getNewDocumentName();
        
        let newName = prompt(' save document as:', suggestedName);
        if(newName != null){
            saveDocAs(newName);
        }
        
    } 
    
    
    
    function saveDocAs(newName){
        
        let newDoc = mCurrentDocument.clone();
        newDoc.setName(newName);
        let res = newDoc.save().then(newDocSaved);
        
        
        function newDocSaved(res){
            
            if(DEBUG)console.log(`${MYNAME}.newDocSaved()`, res);
            mCurrentDocument = newDoc;
            onShowDocuments();
            let tmb = newDoc.getTmb();
            //console.log('tmb:', tmb);
            mDocumentsSelector.addItems([{tmb: tmb, data: newDoc}]);
            let item = mDocumentsSelector.findItem(newDoc);
            mDocumentsSelector.selectItem(item);
            return res;
            
        }
        
    }

    //
    //
    //
    function onSaveDocument() {
        
        let doc = mCurrentDocument;
        
        if(DEBUG)console.log(`${MYNAME} onSaveDocument()`, mCurrentDocument);
            
        doc.save().then(docSaved);
        
        function docSaved(res){  
            
            if(DEBUG)console.log(`${MYNAME}.docSaved()`, res);
            onShowDocuments();
            let item = mDocumentsSelector.findItem(doc);
            if(DEBUG)console.log(`${MYNAME} item found: `, item);
            if(item) {
                mDocumentsSelector.updateItem({tmb: doc.getTmb(), data: doc});
            } else {
                mDocumentsSelector.addItems([{tmb: doc.getTmb(), data: doc}]);                
            }
            return res;
            
        }
                
    }

    //
    //  called by imageSelector panel 
    //
    function onDocumentSelected(itemData){
        
        if(DEBUG)console.log(`${MYNAME}.onDocumentSelected():`, itemData);
        
        if(itemData.isDocument) {
            
            if(DEBUG) console.log(`${MYNAME} reading params from document: `,itemData);
            mCurrentDocument = itemData;
            readParamText(mCurrentDocument.getJsonText(), mCurrentDocument.getName());            
            
        } else if(itemData.isSample) {
            
            if(DEBUG) console.log(`${MYNAME} reading params from URL: `,itemData);
            readParamsUrl(itemData.jsonUrl);
            
        } else if(itemData.jsonFile){
            
            if(DEBUG) console.log(`${MYNAME}.onDocumentSelected() reading params from file:`, itemData);
            mCurrentDocument = mDocHandler.createDocument({appInfo: mAppInfo, jsonFile:itemData.jsonFile, params:mParams, thumbMaker: getThumbMaker()});
            let jsonFile = mCurrentDocument.getJsonFile();
            if(jsonFile) {
                readParamsFile(jsonFile);
            }
            
        }   
        
    } 

    //
    //
    //
    function setDocumentData(jsonObj){
 
        if(DEBUG)console.log(`${MYNAME}.setDocumentData()`, jsonObj);
        SymRendererUpgradeData(jsonObj);
        setParamValues(mParams, jsonObj.params, true);
        mCanvas.intWin.setTitle(mCurrentDocument.getName());
    }

    //
    //
    //
    async function readParamsUrl(jsonUrl) {
        
        if(DEBUG)console.log(`${MYNAME}.readParamsUrl()`, jsonUrl);
        let docName = getFileNameFromPath(jsonUrl);
        if(DEBUG) console.log(`${MYNAME} docName:`,docName);
        mCurrentDocument = mDocHandler.createDocument({appInfo: mAppInfo, params:mParams, thumbMaker: getThumbMaker(), name: docName});
        
        const response = await fetch(jsonUrl);
        const json = await response.json();
        setDocumentData(json);
        
    }

    //
    //
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
        setDocumentData(values);
    }
    
    //
    //  
    //
    async function readParamsFile(jsonFile){

        if(DEBUG)console.log(`${MYNAME}.readParamsFile():`, jsonFile);
        const jsonText = await jsonFile.text(); 
        readParamText(jsonText,jsonFile.name);
        
    } 
    
    //
    //
    // enable internal window with files
    function onShowDocuments(){
        console.log('onShowDocuments()');
        if(!mDocumentsSelector){
            mDocumentsSelector = createImageSelector({
                                                width:'95%', 
                                                height:'20%', 
                                                left: '1%', 
                                                top:'75%', 
                                                title:'my files',
                                                filesFilter: createPresetsFilesFilter(),
                                                onSelect: onDocumentSelected,
                                                storageId: 'files',
                                                });
        } else { 
            // panel already exists - make it visible 
            mDocumentsSelector.setVisible(true);
            
        }
    }

    //
    // dislays samples panel 
    //
    function onShowSamples(){
        
        if(DEBUG)console.log(`${MYNAME}.onShowSamples()`);
        if(!mSamplesSelector){
            mSamplesSelector = createImageSelector({
                                                width:'600px', 
                                                height:'160px', 
                                                left: '1px', 
                                                top:'500px', 
                                                title:'samples',
                                                //filesFilter: createPresetsFilesFilter(),
                                                onSelect: onDocumentSelected,
                                                storageId: 'samples',
                                                });
        } else { 
            // panel already exists - make it visible 
            mSamplesSelector.setVisible(true);
            
        }
    }
    
    //
    //  opens system dialog for open files 
    // 
    function onOpenDocument() {

        if (DEBUG)
            console.log('onOpenDocument()');        
        const type = [{
                description: "presets",
                accept: {
                    "presets/*": [EXT_JSON_PNG, EXT_JSON],
                },
            },
        ];
        
        let prom = openFile(type, true);
        if(DEBUG)console.log(`${MYNAME} prom: `, prom);
        prom.then(addDocumentFiles);
        
    }
    
    //
    //  called after user selected files in the system openFile dialog with a list of selected files 
    //
    function addDocumentFiles(files){
        
        if(DEBUG)console.log(`${MYNAME}.addDocumentFiles()`, files);
        onShowDocuments();
        mDocumentsSelector.addFiles(files);
    }
    
    //
    //    makes thumbnail of the current document
    //    returns canvas with the thumbnail image 
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

    // 
    //  responds on change of # part of URL 
    //
    function onHashChange(){
        
        let opt = getHashParams();
        if(DEBUG)console.log('onHashChange()', opt);
        if(opt.preset) {
            readParamsUrl(opt.preset);            
        }
        
    }

    function getGroup(){
        if(DEBUG)console.log(`${MYNAME}.getGroup()`, mGroup);
        return mGroup;
        
    }

    function getInterpolationId(interpName){
        
        return (interpName === INTERP_NAMES[0]) ? 0 : 1;

    }

    return myself;

} //function SymRenderer()


export function getFileNameFromPath(path){
    
    console.log('getFileNameFromPath()', path);
    //const u = new URL(url);
    const filename = path.substring(path.lastIndexOf('/') + 1);
    const dotIndex = filename.lastIndexOf('.');
    if(dotIndex != -1) 
        return filename.substring(0, dotIndex);
    else 
        return filename;
        
}

export {
    SymRenderer
};
