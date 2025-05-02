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
    buildProgram,
    buildProgramsCached,
    addLineNumbersWithError,
    //getFileFetcher,

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

    drawGrid,
    drawAxes,

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

    makeDocument, 
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

    ShaderFragments as SF,
    
    add, 
    mul, 
    cross, 
    dot,
    cDiv,
    PI,
    SymRendererUpgradeData,
}
from "./modules.js";

const DEBUG = false;
//const GuiBuilder = ParamGui;
const GuiBuilder = DatGUI;

const SPLANE_STYLE = {
    lineWidth: 1,
    shadowWidth: 10,
    lineStyle: '#AAFF',
    shadowStyle: '#AAF6'
};

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

const TOOL_DRAW = 'draw';
const TOOL_MOVE = 'move';
const TOOL_PICK = 'pick';
const INCREMENT = 1.e-12;
const TOOL_NAMES = [TOOL_MOVE, TOOL_DRAW, TOOL_PICK];

const VIS_COLORMAP = 'colormap';
const VIS_TEXTURE = 'texture';
const VIS_BUMPMAP = 'bumpmap';

const RENDER_STYLES = [VIS_COLORMAP, VIS_BUMPMAP, VIS_TEXTURE];

const MYNAME = 'SymRenderer';
const FILE_FORMAT_RELEASE = 1;

const LABEL_RUN = 'Run Simulation';
const LABEL_STOP = 'Stop Simulation';

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

console.log('CUR_MOVE:', CUR_MOVE);


const LABEL_STOP_RECORDING = "Stop Recording";
const LABEL_START_RECORDING = "Start Recording";

const fragGsScreen = {
    obj: SF,
    id: 'screenShader'
};
const fragBaseVertex = {
    obj: SF,
    id: 'canvasVertexShader'
};
const fragComplex = {
    obj: SF,
    id: 'complex'
};
const fragDrawTexture = {
    obj: SF,
    id: 'drawTextureShader'
};
const fragIsplane = {
    obj: SF,
    id: 'isplane'
};
const fragInversiveSampler = {
    obj: SF,
    id: 'inversiveSampler'
};
const fragDrawFdSampler = {
    obj: SF,
    id: 'fundDomainSamplerShader'
};
const fragTexture = {
    obj: SF,
    id: 'texture'
};
const fragColormap = Colormaps.shaders['colormap'];

const fragBufferVisColormap = {
    obj: SF,
    id: 'bufferVisColormap'
};

const fragBufferToScreenColormap = {
    obj: SF,
    id: 'bufferToScreenColormap'
};
const fragBufferToScreenTextured = {
    obj: SF,
    id: 'bufferToScreenTextured'
};
const fragBufferToScreenBumpmap = {
    obj: SF,
    id: 'bufferToScreenBumpmap'
};
const fragProjection = {
    obj: SF,
    id: 'projection'
};

const fragCopyShader = {
    obj: SF,
    id: 'copyShader'
};


const gFragments = [
    fragBaseVertex,
    fragGsScreen,
    fragComplex,
    fragDrawTexture,
    fragIsplane,
    fragInversiveSampler,
    fragDrawFdSampler,
    fragTexture,
    fragColormap,
    fragBufferToScreenColormap,
    fragBufferToScreenTextured,
    fragBufferToScreenBumpmap,
    fragIsplane,
    fragProjection, 
    fragCopyShader,
];

let baseVertexShader = {
    frags: [fragBaseVertex],
};

const progGsScreen = {
    name: 'GsScreen',
    vs: baseVertexShader,
    fs: {
        frags: [fragComplex, fragGsScreen]
    }
};

const progBufferToScreenColormap = {
    name: 'BufferToScreen',
    vs: baseVertexShader,
    fs: {
        frags: [fragIsplane, fragInversiveSampler, fragComplex, fragColormap, fragProjection, fragBufferToScreenColormap]
    }
};

const progBufferVisColormap = {
    name: 'BufferToScreen',
    vs: baseVertexShader,
    fs: {
        frags: [fragColormap, fragBufferVisColormap]
    }
};

const progBufferToScreenTextured = {
    name: 'BufferToScreenTextured',
    vs: baseVertexShader,
    fs: {
        frags: [fragIsplane, fragInversiveSampler, fragComplex, fragColormap, fragProjection, fragBufferToScreenTextured]
    }
};

const progBufferBumpmapToScreen = {
    name: 'BufferToScreen',
    vs: baseVertexShader,
    fs: {
        frags: [fragIsplane, fragInversiveSampler, fragComplex, fragColormap, fragProjection, fragBufferToScreenBumpmap]
    }
};

const progDrawTexture = {
    name: 'DrawTexture',
    vs: baseVertexShader,
    fs: {
        frags: [fragComplex, fragTexture, fragDrawTexture]
    }
};

const progDrawFdSampler = {
    name: 'DrawFDSampler',
    vs: baseVertexShader,
    fs: {
        frags: [fragIsplane, fragInversiveSampler, fragDrawFdSampler]
    }
};

const progCopy = {
    name: 'Copy',
    vs: baseVertexShader,
    fs: {
        frags: [fragCopyShader]
    }
};

let gPrograms = [

    progGsScreen,
    progDrawTexture,
    progDrawFdSampler,
    progBufferToScreenColormap,
    progBufferToScreenTextured,
    progBufferBumpmapToScreen,
    progCopy,
    progBufferVisColormap,
];

const INTERP_LINEAR = 'linear';
const INTERP_QUADRATIC = 'biquadratic';
const INTERP_NAMES = [
    INTERP_LINEAR,
    INTERP_QUADRATIC
]

/**
container for single simulation
options.simCreator - function which creates simulation
 */
function SymRenderer(options) {

    Object.assign(options, getHashParams());
    console.log(`${MYNAME} options: `, options);
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
    // some components needs that to locate the files
    Globals.LIBRARY_PATH = "js/";
    let mPreset = options.preset;
    let mSimCreator = options.simCreator;
    let mSamples = options.samples;
    let mGroupMaker = options.groupMaker;
    if(!mGroupMaker){
        console.error('mGroupMaker is undefined');
        return {};
    }
    mGroupMaker.setOptions({onChanged:onGroupChanged});
        
    if (DEBUG)
        console.log(`SymRenderer(simulation: ${mSimCreator.getName()})`);

    window.addEventListener('hashchange', onHashChange);
    
    let mCurrentDocument = null;

    // parameters of visualization
    let mVisConfig = {

        renderStyle: VIS_COLORMAP,
        visualComponent: 0,
        colormap: Colormaps.getNames()[0],
        minValue: 0.0,
        maxValue: 1.0,
        cmWrap: Colormaps.wrapNames[0],
        cmBanding: 0.5,
        mipmapLevel: 0,
        interpolation: INTERP_QUADRATIC,
        plotType: 0,
        dataSlice: 0.5,

        options: {
            showGrid:    true,
            showRuler:   true,
            showChecker: false,
            useMipmap:   false,
        },

        bump: {

            bumpHeight: 0.01,
            minValue: -1,
            maxValue: 1,
            bumpSmooth: 0.1,
            delta: 0.001,
        }

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
            showGroup: false,
            showDomain: false,
            symIterations: 10,
            fdDrawingColor: '#008800ff', //FFAAAAAA',
        }

    };

    let mTexTransform = {
        scale: 1,
        angle: 0,
        texCenterX: 0,
        texCenterY: 0,
        uvOriginX: 0,
        uvOriginY: 0,
    };

    let mDisplayConfig = {

        canvasSize: 'HD',
        customWidth: 1000,
        customHeight: 1000,
        sizeMultiplier: 1,
        frameTime: 0.0,
        backgroundColor: '#FFFFFF00',

    };

    let mRecorderConfig = {
        startFrame: 0,
        endFrame: 100,
    };

    let mConfig = {

        simulationRunning: false,

        display: mDisplayConfig,
        visualization: mVisConfig,

        texTransform: mTexTransform,
        recording: mRecorderConfig,
        symmetry: mSymConfig,

        simTransConfig: {
            simCenterX: -0.,
            simCenterY: -0.,
            simScale: 0.5,
            simAngle: 0,
            simAlpha: 1,
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
    //const mRecorder = createVideoRecorder2({});
    //const mRecorder = createVideoRecorder({});
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
        simAlpha,
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
    console.log('navigator: ', mNavigator);
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
    
    
    //
    // set of parameters usef for UI display and for state saving
    //
    let mParams = null;
    let startTime = 0;
    let mTimeStamp = 0;

    const mAppInfo = {
        appName: (options.appName) ? options.appName : makeAppName(),
        fileFormatRelease: FILE_FORMAT_RELEASE,
    }

    function makeAppName(){
        console.log('group: ', mGroupMaker);
        //console.log('simulation: ', mSimulation);
        //console.log('navigator: ', mNavigator);
        
        return [MYNAME,mGroupMaker.getClassName(),mSimCreator.getClassName(), mNavigator.getClassName()].join('.');
    }

    function run() {


        loadShaders();

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
        if (DEBUG)
            console.log(`mSimulation: ${mSimulation}`);
        mSimulation.addEventListener('imageChanged', onSimulationChanged);

        mTextureMaker = new TextureFile({
            texInfo: Textures.t1.concat(Textures.t2).concat(Textures.experimental),
            gl: mGLCtx.gl,
            onChanged: onTextureChanged
        });

        const MIPMAP_SIZE = 1024;
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
        mCurrentDocument = makeDocument({appInfo: mAppInfo, params:mParams, thumbMaker: getThumbMaker()});
        mCurrentDocument.setName(getNewDocumentName());
        if(mPreset) readDocFromUrl(mPreset);
        
        startTime = Date.now();
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

        return {
            runSim:         ParamFunc({func: onToggleRun, name: LABEL_RUN}),

            files:          makeFilesParams(),
            display:        makeDisplayParams(),
            recording:      makeRecordingParams(),
            simulation:     ParamObj({name: 'simulation', obj: mSimulation}),

            simTransform:   makeSimTransformParams(),
            visualization:  makeVisParams(),
            symmetry:       makeSymParams(),
            tools:          makeToolsParams(),
        };

    } // function makeParams;

    //
    //
    //
    function makeFilesParams() {

        return ParamGroup({
            name: 'files',
            params: {
                showSamples:
                ParamFunc({
                    func: onShowSamples,
                    name: 'Samples...'
                }),
                showDocuments:
                ParamFunc({
                    func: onShowDocuments,
                    name: 'Files...'
                }),
                read:
                ParamFunc({
                    func: onReadParams,
                    name: 'Open...'
                }),
                save:
                ParamFunc({ 
                    func: onSaveDocument,
                    name: 'Save'
                }),
                saveNew:
                ParamFunc({ 
                    func: onSaveNewDocument,
                    name: 'Save New...'
                }),
                s2f:
                ParamFunc({
                    func: onSelectFolder,
                    name: 'Select Doc Folder...'
                }),    
                saveImage: ParamFunc({
                    func: onSaveImage,
                    name: 'Save Image',
                }),
                selectImageFolder: ParamFunc({
                    func: onSelectImageFolder,
                    name: 'Select Image Folder...',
                }),                
            }
        });
    }

    //
    //
    //
    function makeRecordingParams() {

        return ParamGroup({
            name: 'recording',
            params: {
                startFrame: ParamInt({
                    obj: mConfig.recording,
                    key: 'startFrame',
                    min: 0,
                    max: 100000,
                    name: 'start Frame',
                }),
                endFrame: ParamInt({
                    obj: mConfig.recording,
                    key: 'endFrame',
                    min: 0,
                    max: 100000,
                    name: 'End Frame',
                }),
                toggleRecording: ParamFunc({
                    func: onToggleRecording,
                    name: LABEL_START_RECORDING
                }),
                saveBuffer: ParamFunc({
                    func: onSaveBuffer,
                    name: 'Save Buffer'
                }),

            }

        });
    } // function makeRecordingParams()

    //
    //
    //
    function makeSimTransformParams() {

        return ParamGroup({
            name: 'simulation transform',
            params: {
                simCenterX:
                ParamFloat({
                    obj: mConfig.simTransConfig,
                    key: 'simCenterX',
                    min: -1,
                    max: 1,
                    step: 0.00001,
                    name: 'center X',
                    onChange: onSimTransChanged,
                }),
                simCenterY:
                ParamFloat({
                    obj: mConfig.simTransConfig,
                    key: 'simCenterY',
                    min: -1,
                    max: 1,
                    step: 0.00001,
                    name: 'center Y',
                    onChange: onSimTransChanged,
                }),
                simScale:
                ParamFloat({
                    obj: mConfig.simTransConfig,
                    key: 'simScale',
                    min: 0.0001,
                    max: 10,
                    step: 0.00001,
                    name: 'scale',
                    onChange: onSimTransChanged,
                }),
                simAngle:
                ParamFloat({
                    obj: mConfig.simTransConfig,
                    key: 'simAngle',
                    min: -360,
                    max: 360,
                    step: 0.00001,
                    name: 'angle',
                    onChange: onSimTransChanged,
                }),
                simAlpha:
                ParamFloat({
                    obj: mConfig.simTransConfig,
                    key: 'simAlpha',
                    min: 0,
                    max: 1,
                    step: 0.00001,
                    name: 'alpha',
                    onChange: onSimTransChanged,
                }),

            }
        });
    } // function makeSimTransformParams(){

    //
    //
    //
    function makeDisplayParams() {

        return ParamGroup({
            name: 'display',
            params: {
                frameTime:
                ParamFloat({
                    obj: mConfig.display,
                    key: 'frameTime',
                    min: 0,
                    max: 10000,
                    step: 0.1,
                    name: 'frame time',
                    listen: true,
                }),

                customWidth:
                ParamInt({
                    obj: mConfig.display,
                    key: 'customWidth',
                    min: 128,
                    max: 16 * 1024,
                    step: 1,
                    name: 'custom width',
                    onChange: onCustomSize,
                }),
                customHeight:
                ParamInt({
                    obj: mConfig.display,
                    key: 'customHeight',
                    min: 128,
                    max: 16 * 1024,
                    step: 1,
                    name: 'custom height',
                    onChange: onCustomSize,
                }),
                sizeMultiplier:
                ParamInt({
                    obj: mConfig.display,
                    key: 'sizeMultiplier',
                    min: 1,
                    max: 4,
                    step: 1,
                    onChange: onCanvasSize,
                }),
                canvasSize:
                ParamChoice({
                    obj: mConfig.display,
                    key: 'canvasSize',
                    choice: CanvasSize.getNames(),
                    onChange: onCanvasSize,
                }),
                backgroundColor: 
                    ParamColor({
                        obj: mConfig.display,
                        key: 'backgroundColor',
                        name: 'background',
                        onChange: scheduleRepaint,
                    }),

            }
        });
    } // function makeDisplayParams()

    function makeColormapParams() {

        let cf = mConfig.visualization;
        let oc = scheduleRepaint;

        return ParamGroup({
            name: 'colormap params',
            params: {
                colormap:
                ParamChoice({
                    obj: cf,
                    key: 'colormap',
                    choice: Colormaps.getNames(),
                    onChange: oc,
                }),
                plotType: ParamInt({
                    obj: cf,
                    key: 'plotType',
                    min: 0,
                    max: 1,
                    onChange: oc,
                }),
                dataSlice: ParamFloat({
                    obj: cf,
                    key: 'dataSlice',
                    min: 0,
                    max: 1,
                    step: 0.00001,
                    onChange: oc,
                }),
                minValue: ParamFloat({
                    obj: cf,
                    key: 'minValue',
                    min: -10,
                    max: 10,
                    step: 0.00001,
                    onChange: oc,
                }),
                maxValue: ParamFloat({
                    obj: cf,
                    key: 'maxValue',
                    min: -10,
                    max: 10,
                    step: 0.00001,
                    onChange: oc,
                }),
                cmBanding: ParamFloat({
                    obj: cf,
                    key: 'cmBanding',
                    min: -1,
                    max: 1,
                    step: 0.00001,
                    onChange: oc,
                }),
                cmWrap: ParamChoice({
                    obj: cf,
                    key: 'cmWrap',
                    choice: Colormaps.wrapNames,
                    onChange: oc,
                }),
                mipmapLevel: ParamFloat({
                    obj: cf,
                    key: 'mipmapLevel',
                    min: 0,
                    max: 20,
                    step: 0.00001,
                    onChange: oc,                    
                }),
            }
        });

    } // function makeColormapParams()

    //
    //
    //
    function makeBumpParams() {

        let cf = mConfig.visualization.bump;
        let oc = scheduleRepaint;
        let inc = INCREMENT;
        
        return ParamGroup({
            name: 'bumps params',
            params: {
                bumpHeight: ParamFloat({obj:cf, key: 'bumpHeight',  min: -0.5, max: 0.5, onChange: oc}),
                minValue:   ParamFloat({obj:cf, key: 'minValue',    min: -5,max: 5,step: inc,onChange: oc}),
                maxValue:   ParamFloat({obj:cf, key: 'maxValue',    min: -5,max: 5,step: inc,onChange: oc}),
                bumpSmooth: ParamFloat({obj:cf, key: 'bumpSmooth',  min: -5,max: 5,step: inc,onChange: oc}),
                delta:      ParamFloat({obj:cf, key: 'delta',       min: 0,max: 0.5,step: inc,onChange: oc}),
            }
        });
    } //function makeBumpParams(){

    //
    //
    //
    function makeVisOptionsParams() {

        let visConf = mConfig.visualization;
        let onc = scheduleRepaint;
        let oConf = visConf.options;
        return ParamGroup({
            name: 'options',
            params: {
                visualComponent: ParamInt({obj:   visConf,key: 'visualComponent',name: 'Component',min: 0, max: 5,onChange: onc}),
                interpolation:  ParamChoice({obj: visConf,key: 'interpolation', name: 'Interpolation', choice: INTERP_NAMES,onChange: onc}),
                showChecker:    ParamBool({obj: oConf,key: 'showChecker', name: 'Checker', onChange: onShowChecker}),
                showGrid:       ParamBool({obj: oConf,key: 'showGrid', name: 'Grid', onChange: onc}),
                showRuler:      ParamBool({obj: oConf,key: 'showRuler',name:'Ruler',onChange: onc}),
                useMipmap:      ParamBool({obj: oConf,key: 'useMipmap',name:'Mipmap',onChange: onc}),
            }
        });
    } // function makeVisOptionsParams()
    

    //
    //
    //
    function makeVisParams() {

        let visConf = mConfig.visualization;
        let onChange = scheduleRepaint;

        return ParamGroup({
            name: 'visualization',
            params: {
                renderStyle:
                ParamChoice({
                    obj: visConf,
                    key: 'renderStyle',
                    name: 'rendering',
                    choice: RENDER_STYLES,
                    onChange: onChange,
                }),
                colormap: makeColormapParams(),
                bump: makeBumpParams(),
                texture: makeTexVisParams(),
                options: makeVisOptionsParams(),
                dataPlot: ParamObj({
                    name: 'plot',
                    obj: mDataPlot
                }),

            }
        });
    } // function makeVisParams()


    //
    //
    //
    function makeTexVisParams() {

        let tc = mConfig.texTransform;
        let onChange = scheduleRepaint;

        return ParamGroup({
            name: 'texture params',
            params: {
                texture:
                ParamObj({
                    name: 'texture',
                    obj: mTextureMaker
                }),
                transform:
                ParamGroup({
                    name: 'transform',
                    params: {
                        scale: ParamFloat({
                            obj: tc,
                            key: 'scale',
                            min: -10,
                            max: 10,
                            step: 0.00001,
                            onChange: onChange
                        }),
                        angle: ParamFloat({
                            obj: tc,
                            key: 'angle',
                            min: -360,
                            max: 360,
                            step: 0.00001,
                            onChange: onChange
                        }),
                        texCenterX: ParamFloat({
                            obj: tc,
                            key: 'texCenterX',
                            min: -1,
                            max: 1,
                            step: 0.00001,
                            onChange: onChange
                        }),
                        texCenterY: ParamFloat({
                            obj: tc,
                            key: 'texCenterY',
                            min: -1,
                            max: 1,
                            step: 0.00001,
                            onChange: onChange
                        }),
                        uvOriginX: ParamFloat({
                            obj: tc,
                            key: 'uvOriginX',
                            min: -1,
                            max: 1,
                            step: 0.00001,
                            onChange: onChange
                        }),
                        uvOriginY: ParamFloat({
                            obj: tc,
                            key: 'uvOriginY',
                            min: -1,
                            max: 1,
                            step: 0.00001,
                            onChange: onChange
                        }),
                    }
                }),
            },
        });

    } // function makeTexVisParams()

    //
    //
    //
    function makeGroupTransformParams() {

        let conf = mConfig.symmetry.transform;
        let onChanged = onGroupChanged;
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
                    step: 0.00001,
                    onChange: onChanged,
                }),
                translationY:
                ParamFloat({
                    obj: conf,
                    key: 'translationY',
                    name: 'translate Y',
                    min: -2.,
                    max: 2.,
                    step: 0.00001,
                    onChange: onChanged,
                }),
                rotation:
                ParamFloat({
                    obj: conf,
                    key: 'rotation',
                    //name 'rotation',
                    min: -360.,
                    max: 360.,
                    step: 0.00001,
                    onChange: onChanged,
                }),
                scale:
                ParamFloat({
                    obj: conf,
                    key: 'scale',
                    min: 0.0001,
                    max: 10.,
                    step: 0.00001,
                    onChange: onChanged,
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
                showGroup: ParamBool({
                    obj: conf,
                    key: 'showGroup',
                    name: 'show group',
                    onChange: onChange,
                }),
                showDomain: ParamBool({
                    obj: conf,
                    key: 'showDomain',
                    name: 'show domain',
                    onChange: onChange,
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
                ParamChoice({
                    obj: mConfig.tools,
                    key: 'toolName',
                    choice: TOOL_NAMES,
                    name: 'tool',
                    onChange: onToolNameChanged,
                }),
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
            console.log("makeToolbox()"); 
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
        btn.tools       = createImgBtn({title:'options',   src:resPath('btn_options.svg'),action:toggleGUI});  
        btn.run         = createImgBtn({title:'play',      src:resPath('btn_play.svg'),action:onToggleRun});
        btn.init        = createImgBtn({title:'initialize',src:resPath('btn_restart.svg'),action:onInitSimulation});
        btn.recording   = createImgBtn({title:'recording', src:resPath('btn_record_start.svg'),action:onToggleRecording});
        btn.download    = createImgBtn({title:'save image',src:resPath('btn_download.svg'),action:onSaveImage});
        btn.full_screen = createImgBtn({title:'full screen',src:resPath('btn_full_screen.svg'),action:onFullScreen});
        btn.move        = createImgBtn({title:'move',      src:resPath('btn_move2.svg'),action:()=>setTool('move')});
        btn.draw        = createImgBtn({title:'draw',      src:resPath('btn_draw.svg'),action:()=>setTool('draw')});
        btn.pick        = createImgBtn({title:'pick',      src:resPath('btn_pick.svg'),action:()=>setTool('pick')});
        let space       = createImgBtn({                   src:resPath('btn_vbar.svg')});
        space.style.width = '20px';
        toolbox.appendChild(btn.tools);
        toolbox.appendChild(btn.run);
        toolbox.appendChild(btn.init);
        toolbox.appendChild(btn.recording);
        toolbox.appendChild(btn.download);
        toolbox.appendChild(btn.full_screen);
        
        toolbox.appendChild(space);
        
        toolbox.appendChild(btn.move);
        toolbox.appendChild(btn.draw);
        toolbox.appendChild(btn.pick);

        let btnWidth = 40;
        let btnCount = 9;
        let extra = 22;
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

        canvas.addEventListener('pointerdown', evtHandler);
        canvas.addEventListener('pointerup',   evtHandler);
        canvas.addEventListener('pointermove', evtHandler);
        canvas.addEventListener('wheel',       evtHandler);
        canvas.addEventListener('click',       evtHandler);
        canvas.addEventListener('pointerout',  evtHandler);

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

        if (DEBUG)
            console.log('texture changed');
        //let tex = mTextureMaker.getTexture();
        //console.log('texture: ', tex);
        scheduleRepaint();
    }

    function onGroupChanged() {

        if (DEBUG)
            console.log("onGroupChanged()");
        mGroup = mGroupMaker.getGroup();

        let {
            translationX,
            translationY,
            scale,
            rotation
        } = mConfig.symmetry.transform;
        if (DEBUG)
            console.log(`${translationX},${translationY}, ${scale}, ${rotation}`);
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
    function onCanvasSize() {

        let conf = mConfig.display;

        let canvInfo = CanvasSize.getCanvas(conf.canvasSize);
        if (DEBUG)
            console.log('canv: ', canvInfo);

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
            console.log('glCanvasSize: ', mCanvas.glCanvas.width, mCanvas.glCanvas.height);
        mCanvasTransform.onCanvasResize();

    } // function onCanvasSize()


    function setCanvasSize(elem, width, height) {

        if (DEBUG)
            console.log(`setElementSize(${width}, ${height})`);
        let pr = getPixelRatio();
        width = (width + 0.35) / pr;
        height = (height + 0.35) / pr;
        if (DEBUG)
            console.log(`  corrected size: (${width} x ${height})`);

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
        if (isDefined(mToolbox.run))
            mToolbox.run.src = IMG_RUN;        
        scheduleRepaint();
    }

    function startAnimation(){
        
        //start simulation
        mConfig.simulationRunning = true;
        mParams.runSim.setName(LABEL_STOP);
        if (isDefined(mToolbox.run))
            mToolbox.run.src = IMG_STOP;
        scheduleRepaint();
    }

    function onShowChecker() {
        //console.log('document.body: ', document.body);
        //console.log('document.body.style: ', document.body.style);
        //let style = document.body.style;

        let style = mCanvas.container.style;

        if (mConfig.visualization.options.showChecker) {
            style.backgroundImage = 'url("images/checker_bgrnd_10.png"';
            style.backgroundSize = '30px';
        } else {
            style.backgroundImage = 'none';
        }
    }
    function onDrawGroup() {

        drawGroup(mGroup);

        //drawFD(mPackedGroupData);
    }

    function drawFD(groupDataSampler) {

        mGLCtx.gl.viewport(0, 0, mCanvas.glCanvas.width, mCanvas.glCanvas.height);
        let fdColor = premultColorArray(hexColorToArray(mConfig.symmetry.fdDrawingColor));
        drawFDSampler(mGLCtx.gl, mBlitMaker, Programs.drawFdSampler.program, mCanvasTransform, null, groupDataSampler, fdColor);

    }

    function drawGroup(group) {

        let fd = group.getFundDomain();

        let ct = mCanvasTransform;
        for (let i = 0; i < fd.length; i++) {
            iDrawSplane(fd[i], mOverlayCtx, ct, SPLANE_STYLE);
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
            console.log('onToolChanged() tool:', mConfig.tools.toolName);
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
    
    function enableBlending(){
        
        let gl = mGLCtx.gl;
        // blend the rendering 
       gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
       gl.enable(gl.BLEND);        
        
    }
        
    //
    //  render GL canvas
    //
    function renderGLCanvas() {

        //enableBlending();
        
        switch (mConfig.visualization.renderStyle) {
        default:
        case VIS_COLORMAP:
            renderVisColormap();
            break;
        case VIS_TEXTURE:
            renderVisTexture();
            break;
        case VIS_BUMPMAP:
            drawSimBumpmap();
            break;
        }

    }

    //
    //  render visualisation using texture image for coloring the UV values
    //
    function renderVisTexture() {

        let gl = mGLCtx.gl;

        let {
            simCenterX,
            simCenterY,
            simAlpha,
            simScale,
            simAngle
        } = mConfig.simTransConfig;

        let visConf = mConfig.visualization;
        let symOptions = mConfig.symmetry.options;

        let texScale = 0.5 / simScale; // 0.5 - because texture box originaly has range [0,1]. But drawing images have range [-1,1]
        let texAngle = simAngle * TORADIANS;

        let tvc = mConfig.texTransform;
        let uvAngle = TORADIANS * tvc.angle;
        let uvScale = tvc.scale;

        let simBuffer = mSimulation.getSimBuffer();
        if (!isDefined(simBuffer))
            return;

        gl.viewport(0, 0, mCanvas.glCanvas.width, mCanvas.glCanvas.height);
        let target = null; // canvas
        let program = progBufferToScreenTextured.program;

        program.bind();

        //let ctUni = mCanvasTransform.getUniforms({});
        let ctUni = mNavigator.getUniforms({}, mTimeStamp);

        program.setUniforms(ctUni);

        let texUni = {
            u_texScale:     [texScale * Math.cos(texAngle), -texScale * Math.sin(texAngle)],
            u_texCenter:    [simCenterX, simCenterY],
            u_texture:      simBuffer.read,
            u_texAlpha:     simAlpha,
            //uCmWrap:        Colormaps.getWrapValue(visConf.cmWrap),
            uInterpolation: getInterpolationId(visConf.interpolation),
            uGroupData:     mPackedGroupData,
            uIterations:    symOptions.symIterations,
            uSymmetry:      symOptions.useSymm,
            
        }
            //uVisualComponent: visConf.visualComponent,
        let texVisUni = {
            
            uMinValue:      visConf.minValue,
            uMaxValue:      visConf.maxValue,
            uColorTexture:  mTextureMaker.getTexture(),
            uUVscale:       [uvScale * Math.cos(uvAngle), -uvScale * Math.sin(uvAngle)],
            uUVorigin:      [tvc.uvOriginX, tvc.uvOriginY],
            uTexCenter:     [tvc.texCenterX, tvc.texCenterY],

        };
        program.setUniforms(texUni);
        program.setUniforms(texVisUni);

        mBlitMaker.blit(target);

    }

    //
    //  visualization using colormap with optional mipmap
    //
    function renderVisColormap() {

        let gl = mGLCtx.gl;
        let {
            simCenterX,
            simCenterY,
            simAlpha,
            simScale,
            simAngle
        } = mConfig.simTransConfig;

        let visConf     = mConfig.visualization;
        let symOptions  = mConfig.symmetry.options;
        let visOpt      = mConfig.visualization.options;        

        let simBuffer   = mSimulation.getSimBuffer();
        if (!isDefined(simBuffer)){
            // nothing to visualize 
            return;
        }
        
        //
        //  colormap uniforms 
        //
        let colormapUni = { 
            uSimBuffer :    simBuffer.read,//.texture,
            uColormap :     Colormaps.getColormapTexture(gl, {name: visConf.colormap}),
            uVisualComponent: visConf.visualComponent,            
            uCmBanding:     visConf.cmBanding,
            uCmWrap:        Colormaps.getWrapValue(visConf.cmWrap),
            uMinValue:      visConf.minValue,
            uMaxValue:      visConf.maxValue,
        };

        
        if(visOpt.useMipmap){
            
            // make mipmap iage 
            let cnv = mMipmapBuffer;
            gl.viewport(0, 0, cnv.width, cnv.height);
            // no need to clear because we render the whole viewport and have no belnding
            disableBlending();
                    
            let progVis = progBufferVisColormap.program;
            progVis.bind();
            
            let transUni = { // transformation to render data into buffer 
                u_aspect:   (cnv.height/cnv.width), 
                u_scale:    0.5, 
                u_center:   [0.5,0.5],                         
            };
            //console.log('colormapUni:', colormapUni);
            
            progVis.setUniforms(transUni);
            progVis.setUniforms(colormapUni);
            
            progVis.blit(mMipmapBuffer);      // render to top mipmap level 
            
            mMipmapBuffer.attach(0);          // set as the current texture. Needed for  generateMipmap()
            
            gl.generateMipmap(gl.TEXTURE_2D); 
            
        }
        
        //
        // render the complete image 
        // 
        enableBlending();
                         
        if(true){
            
            let renderProg = progBufferToScreenColormap.program;
            renderProg.bind();
            
            // uniforms for complate canvas transform 
            let ctUni = mNavigator.getUniforms({}, mTimeStamp);
            renderProg.setUniforms(ctUni);
            
            let ss = 0.5 / simScale; // 0.5 - because texture box originally has range [0,1]. But drawing images have range [-1,1]
            let sa = simAngle * TORADIANS;
        
            
            let renderUni = {
                uBufScale:     [ss * Math.cos(sa), -ss * Math.sin(sa)],
                uBufCenter:    [simCenterX, simCenterY],
                uSimBuffer:     simBuffer.read,
                uInterpolation: getInterpolationId(visConf.interpolation),
                uGroupData:     mPackedGroupData,
                uIterations:    symOptions.symIterations,
                uSymmetry:      symOptions.useSymm,
            };
            renderProg.setUniforms(renderUni);
            // colormap uniforms are the same as for mipmap rendering 
            renderProg.setUniforms(colormapUni);
            
            let mipmapUni = {
                uUseMipmap: visOpt.useMipmap,
            };
            if(visOpt.useMipmap){
               mipmapUni.uMipmapData = mMipmapBuffer;                
            }
            
            renderProg.setUniforms(mipmapUni);
             

            let canvas = mCanvas.glCanvas;
            gl.viewport(0, 0, canvas.width, canvas.height);
            renderProg.blit(null); 
            
        } 
        
        if(false) {
                
            // for tests to show mipmap image texture 
            let cprog = progCopy.program;
            
            cprog.bind();
            let cn = mCanvas.overlay;
            let ctUni = {
                u_aspect: (cn.height/cn.width), 
                u_scale: 1, 
                u_center: [0.5,0.5],             
                uInput: mMipmapBuffer.texture,
                uMipmapLevel: visConf.mipmapLevel,
            };        
            cprog.setUniforms(ctUni);
                   
            gl.viewport(0, 0, cn.width, cn.height);
            cprog.blit(null); 
        }                   

    } // function drawSimColormapMipmap()


    //
    //  draw simulation as bumpmap
    //
    function drawSimBumpmap() {

        let gl = mGLCtx.gl;

        let {
            simCenterX,
            simCenterY,
            simAlpha,
            simScale,
            simAngle
        } = mConfig.simTransConfig;
        let visConf = mConfig.visualization;

        let scale = 0.5 / simScale; // 0.5 - because texture box originaly has range [0,1]. But drawing images have range [-1,1]
        let angle = simAngle * TORADIANS;

        let buffer = mSimulation.getSimBuffer();
        if (!isDefined(buffer))
            return;

        gl.viewport(0, 0, mCanvas.glCanvas.width, mCanvas.glCanvas.height);
        let target = null; // canvas
        let program = progBufferBumpmapToScreen.program;

        program.bind();

        let ctUni = mNavigator.getUniforms({}, mTimeStamp);

        program.setUniforms(ctUni);

        let bumpConf = visConf.bump;
        let symConf = mConfig.symmetry;

        let texUni = {
            u_texScale: [scale * Math.cos(angle), -scale * Math.sin(angle)],
            u_texCenter: [simCenterX, simCenterY],
            u_texture: buffer.read.texture,
            u_texAlpha: simAlpha,
            uColormap: Colormaps.getColormapTexture(gl, visConf.colormap),
            uVisualComponent: visConf.visualComponent,
            uGroupData: mPackedGroupData,
            uIterations: symConf.options.symIterations,
            uSymmetry: symConf.options.useSymm,

            uBumpHeight: bumpConf.bumpHeight,
            uMinValue: bumpConf.minValue,
            uMaxValue: bumpConf.maxValue,
            uBumpSmooth: Math.max(0.000001, bumpConf.bumpSmooth),
            uDelta: Math.max(0.000001, bumpConf.delta),

        };

        program.setUniforms(texUni);

        mBlitMaker.blit(target);

    } // function drawSimBumpmap()

    let oldTime = 0;

    //
    //  main painting function, repaint everything
    //
    function onRepaint() {

        requestAnimationFrame(onRepaint);
        let time = Date.now();
        let conf = mConfig.display;
        if (oldTime != 0)
            conf.frameTime = Number((0.95 * conf.frameTime + (time - oldTime) * 0.05).toFixed(1));
        //console.log('frame time: ', (time - oldTime));
        oldTime = time;
        
        mTimeStamp = time - startTime;
        
        if (!mNeedRepaint) {
            return;
        }
        clearRepaintFlag();

        if (mRecorder.isRecording()) {
            if (mRecorder.isReady()) {
                
                // TODO mTimeStamp has to be taken from mRecorder
                renderFrame();                
                mRecorder.appendFrame(mCanvas.glCanvas);

            } else {
                // recorder is not ready yet
                return;
            }
        } else {
            // no recording
            renderFrame();
            mNeedRepaint = mNeedRepaint || mConfig.simulationRunning;
        }

    } // onRepaint

    //
    // main rendering function. 
    //
    function renderFrame() {

        if (mConfig.simulationRunning) {

            mSimulation.doStep();

        }
        resizeCanvases();
        onClearOverlay();
        onClearGLCanvas();
        

        renderGLCanvas();
        let opt = mConfig.visualization.options;
        if (opt.showGrid || opt.showRuler)
            onDrawGridAndRuler();

        if (mConfig.symmetry.options.showGroup)
            onDrawGroup();

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

    function onLoadFail() {

        let files = Fragments;
        console.error('failed to load fragments:');
        for (const prop in files) {
            let file = files[prop];
            if (!isDefined(file.txt))
                console.error('failed to load: ', prop, "->", file.url);
        }
    }

    function onFragLoaded() {

        if (DEBUG)
            console.log(`onFragLoaded() ${getTime()-loadStartTime} ms`);

        let t0 = getTime();
        let result = buildProgramsCached(mGLCtx.gl, gPrograms);
        if (!result) {
            console.error(`buildProgramsCached() result: ${result}`);
            return;
        }

        if (DEBUG)
            console.log(`makeProgramsCached() ready ${getTime()-t0} ms`);

        startApplication();

    }

    function loadShaders() {

        loadStartTime = getTime();
        //initFragments(gFragments);
        onFragLoaded();
        //fetchTextFilesCached(gFragments, onFragLoaded, onLoadFail);


    }

    function onSimTransChanged() {

        let {
            simCenterX,
            simCenterY,
            simAlpha,
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
            simAlpha,
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
        console.warn('startAnimationLoop(): ', getTime());
        requestAnimationFrame(onRepaint);
        scheduleRepaint();
    }

    function onDrawGridAndRuler() {

        let {
            showGrid,
            showRuler
        } = mConfig.visualization.options;
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
        let vc = mConfig.visualization;

        let plotData = getPlotData(vc.dataSlice, vc.plotType);
        //console.log('plotData: ', plotData[0])
        mDataPlot.setPlotData(plotData[0], 0);
        mDataPlot.setPlotData(plotData[1], 1);

    }

    function getPlotData(dataSliceY, plotType) {

        //console.log("getPlotData()");

        let gl = mGLCtx.gl;

        let simBuffer = mSimulation.getSimBuffer();

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
        return IMG_PREFIX + date2s(new Date(), '-');
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


    function getBufferName() {
        return 'sim' + date2s(new Date(), '-') + '.dat';
    }

    function onSaveBuffer() {
        // testing of buffer saving
        let nx = 2,
        ny = 3;
        let fa = new Float32Array(nx * ny);
        for (let y = 0; y < ny; y++) {
            for (let x = 0; x < nx; x++) {
                fa[x + nx * y] = (x + y);
            }
        }
        //console.log('fa: ', fa);
        let str = fa2str(fa);
        //console.log('str: ', str);
        let fa1 = str2fa(str);
        //console.log('fa1: ', fa1);

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
        mSimulation.initSimulation();

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

        if (DEBUG)
            console.log('before call selectFolder()');
            function folderSelected(fhandle){
                console.log('then() folder selected:', fhandle);
                exportFolderHandle = fhandle;        
            }
            selectFolder().then(folderSelected);
            if (DEBUG)
                console.log('after call selectFolder()');

    }

    //
    //
    //
    function onSaveImage() {
        
        let name = getImageName();
        mImageSaver.saveImage(mCanvas.glCanvas, name, getParamsAsJSON(name));
        
    }

    function onSelectImageFolder() {        
    
        mImageSaver.selectWritingFolder();        
        
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
    //
    //
    function onSaveNewDocument() {
        
        // TODO save the new name 
        let newName = getNewDocumentName();
        let newDoc = mCurrentDocument.clone();
        newDoc.setName(newName);
        let res = newDoc.save().then(newDocSaved);
        
        function newDocSaved(res){
            
            console.log('newDocSaved()', res);
            onShowDocuments();
            let tmb = newDoc.getTmb();
            //console.log('tmb:', tmb);
            mDocumentsSelector.addItems([{tmb: tmb, data: newDoc}]);
            let item = mDocumentsSelector.findItem(newDoc);
            mDocumentsSelector.selectItem(item);
            return res;
            
        }
        
    }

    function onSaveDocument() {
        
        let doc = mCurrentDocument;
            
        doc.save().then(docSaved);
        
        function docSaved(res){            
            console.log('docSaved()', res);
            onShowDocuments();
            //let tmb = doc.getTmb();
            //console.log('tmb:', tmb.sunstrong);
            // TODO - update doc icon 
            let item = mDocumentsSelector.findItem(doc);
            if(item)
                mDocumentsSelector.updateItem({data: doc, tmb: doc.getTmb()});
            else 
                mDocumentsSelector.addItems([{tmb: doc.getTmb(), data: doc}]);                
            return res;
            
        }
        
        //saveDocument(getDocumentName());
        
    }
    //
    //
    //
    function saveDocument(name) {

        if (exportFolderHandle == null){
            selectFolder().then((res) => {
                exportFolderHandle = res;
                saveDocTo(name);
            });
        } else {
            saveDocTo(name);
        }

    } // function onSaveDocument()

    //
    //  save current doc to file with given name
    //
    function saveDocTo(name) {
        
         console.log(`saveDocTo(${name}`);
        
        
        let jsontxt = getParamsAsJSON(name)
        let fileName = name + EXT_JSON;

        writeFile(exportFolderHandle, fileName, jsontxt);

        // save thumbnail
        let tmbName = fileName + TMB_EXT;
        //let tmbCanvas = getThumbnailCanvas(mCanvas.glCanvas, TMB_WIDTH);
        let tmbCanvas = getSquareThumbnailCanvas(mCanvas.glCanvas, TMB_WIDTH);
        canvasToLocalFile(tmbCanvas, exportFolderHandle, tmbName, TMB_TYPE);
        
    }


    //
    //  called by imageSelector panel 
    //
    function onDocumentSelected(itemData){
        
        console.log('onDocumentSelected():', itemData);
        if(itemData.isDocument) {
            mCurrentDocument = itemData;
            readParamText(mCurrentDocument.getJsonText(), mCurrentDocument.getName());            
            
        } else if(itemData.isSample) {
            console.log('reading sample');
            readDocFromUrl(itemData.jsonUrl);
            console.log('if(itemData.isSample)', mAppInfo);
            mCurrentDocument = makeDocument({appInfo: mAppInfo, params:mParams, thumbMaker: getThumbMaker()});
        } else {
            
            mCurrentDocument = makeDocument({appInfo: mAppInfo, jsonFile:itemData.jsonFile, params:mParams, thumbMaker: getThumbMaker()});
            let jsonFile = mCurrentDocument.getJsonFile();
            if(jsonFile) 
                readParamsFile(jsonFile);
            
        }   
        /*
        let jsonTxt = mCurrentDocument.getJsonText();
        if(jsonTxt) {
            readParamText(jsonTxt, mCurrentDocument.getName());
        } else {
            let jsonFile = mCurrentDocument.getJsonFile();
            if(jsonFile) 
                readParamsFile(jsonFile);
        } else {
            console.log('undefined JSON data in document: ', mCurrentDocument);
        }
        */
        
    } 

    function setDocumentData(jsonObj){
 
        console.log(`${MYNAME}.setDocumentData()`, jsonObj);
        SymRendererUpgradeData(jsonObj);
        setParamValues(mParams, jsonObj.params, true);
        
    }

    async function readDocFromUrl(jsonUrl) {
        
        console.log('readDocFromUrl()', jsonUrl);
        const response = await fetch(jsonUrl);
        const json = await response.json();
        setDocumentData(json);
        
    }

    function readParamText(txt, name){
        
        console.log('readParamText()\n', name,'\n' + txt.substring(0,100));
        let values = {};
        try {
            values = JSON.parse(txt);

            if (DEBUG)
                console.log('parsed JSON:', values);
            if (DEBUG)
                console.log('document name: ', values.name);

        } catch (err) {

            let listing = addLineNumbersWithError(txt, err.toString());
            console.error(`${listing}\nJSON syntax error\n file: '${name}'\n ${err}`);
        }
        setDocumentData(values);
    }
    
    //
    //
    //
    function readParamsFile(jsonFile){

        const reader = new FileReader();

        reader.onload = onloaded;
        reader.onerror = onerror;
        console.log(' reading document', jsonFile);
        reader.readAsText(jsonFile); 
        
        function onerror(){
            console.error(`failed to read file: ${jsonFile.name}: `, reader.error); 
        }
        
        function onloaded() {
            readParamText(reader.result,jsonFile.name);
            
        }              
    } 

    //
    //
    // displays internal window with presets 
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

    // dislays samples panel 
    function onShowSamples(){
        
        console.log('onShowSamples()');
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
    
    function onReadParams() {

        if (DEBUG)
            console.log('onReadParams()');        
        const type = [{
                description: "presets",
                accept: {
                    "presets/*": [EXT_JSON_PNG, EXT_JSON],
                },
            },
        ];
        
        let prom = openFile(type, true);
        console.log('file: ', prom);
        prom.then(addDocumentFiles);
        
    }
    
    function addDocumentFiles(files){
        
        console.log('addDocumentFiles()', files);
        onShowDocuments();
        mDocumentsSelector.addFiles(files);
    }

    async function selectFolder() {

        if (DEBUG)
            console.log('selectFolder()');

        let folderHandle = await showDirectoryPicker();

        if (DEBUG)
            console.log('directoryHandle:', folderHandle);

        folderHandle.requestPermission({
            writable: true
        });

        //const relativePaths = await paramFolderHandle.resolve(handle);
        //console.log('relativePaths:', relativePaths);

        //listFiles(paramFolderHandle);

        if (DEBUG)
            console.log('in selectFolder() folderHandle: ', folderHandle);
        return new Promise(resolve => resolve(folderHandle));

    }
    
    /**
        makes thumbnail of the current document
        returns canvas with the thumbnail image 
    */
    function makeThumbnail(){
        
        let tmbCanvas = getSquareThumbnailCanvas(mCanvas.glCanvas, TMB_WIDTH);
        return tmbCanvas;
        //return createImageBitmap(tmbCanvas);
        
    }
    
    function getThumbMaker(){
        return {
            getThumbnail: makeThumbnail,
        };
    }

    function onHashChange(){
        let opt = getHashParams();
        console.log('onHashChange()', opt);
        if(opt.preset) {
            readDocFromUrl(opt.preset);            
        }
        
    }

    function getGroup(){
        console.log(`${MYNAME}.getGroup()`, mGroup);
        return mGroup;
        
    }

    function getInterpolationId(interpName){
        
        return (interpName === INTERP_NAMES[0]) ? 0 : 1;

    }

    return myself;

} //function SymRenderer()

function getHashParams(){
    let hash = window.location.hash;
    let decodedHash = decodeURIComponent(hash);
    if(!decodedHash.startsWith('#')){
        /// empty 
        return {};
    }
    let paramString = decodedHash.substring(1);
    console.log('paramString: ', paramString);
    let param = JSON.parse(paramString); 
    return param;
    //console.log('hash: ', hash);
    //console.log('decodedHash: ', decodedHash);
}


export {
    SymRenderer
};
