import {
  isDefined, 
  initFragments, 
  buildProgramsCached,
  GroupUtils,
  getTime, 
  getBlitMaker,
  createDoubleFBO,
  createFBO,
  DataPacking,
  EventDispatcher,
  createDataPlot,
  
  GinzburgLandauPresets,
  
  ParamBool, 
  ParamFloat, 
  ParamInt, 
  ParamGroup,
  ParamChoice,
  ParamFunc,
  ParamObj,
  ParamCustom, 
  
  fa2str,
  fa2stra,
  str2fa,
  
  //GrayScottFragments as GS, 
  GinzburgLandauFragments as GLF, 
  ShaderFragments as SF 
  
} from './modules.js';


const DEBUG = true;


const MY_NAME = 'Ginzburg-Landau';
const Presets = GinzburgLandauPresets;

const INIT_TYPE_CLEAR = 'clear';
const INIT_TYPE_NOISE = 'noise';
const INIT_TYPE_SYM_NOISE = 'sym noise';

const initTypeNames = [INIT_TYPE_CLEAR, INIT_TYPE_NOISE,INIT_TYPE_SYM_NOISE];


const fragGL_utils      = {obj:GLF,id:'GL_utils'};
const fragGL_reset      = {obj:GLF,id:'GL_reset'};
const fragGL_step       = {obj:GLF,id:'GL_step'};
const fragGL_render_inc = {obj:GLF,id:'render_inc'};
const fragGL_render_fp =  {obj:GLF, id:'render_fp'};
const fragGL_hist_vp = {obj:GLF,id:'hist_vp'};
const fragGL_hist_fp = {obj:GLF,id:'hist_fp'};

const fragBaseVertex       = {obj:SF,id:'canvasVertexShader'};
const fragColormap         = {obj:SF,id:'colormap'};
const fragBufferVisualization = {obj:SF,id:'bufferVisualization'};
const fragComplex          = {obj:SF,id:'complex'};
const fragSimplexNoise     = {obj:SF,id:'simplexNoise'};
const fragSdf2d            = {obj:SF,id:'sdf2d'};
const fragUtils            = {obj:SF,id:'utils'};
const fragDrawDot          = {obj:SF,id:'drawDotShader'};
const fragDrawMultiDot     = {obj:SF,id:'drawMultiDotShader'};
const fragDrawSegment      = {obj:SF,id:'drawSegmentShader'};
const fragIsplane          = {obj:SF,id:'isplane'};
const fragInversiveSampler = {obj:SF,id:'inversiveSampler'};
const fragSymSampler       = {obj:SF,id:'symSamplerShader'};
const fragDrawFdSampler    = {obj:SF,id:'fundDomainSamplerShader'};
const fragAddNoise         = {obj:SF,id:'addNoiseShader'};



const gsFragments = [

    fragGL_utils,
    fragGL_reset,
    fragGL_step,
    fragGL_render_inc,
    fragGL_hist_vp,
    fragGL_hist_fp,
    fragGL_render_fp,

    fragBaseVertex,
    fragColormap,
    fragBufferVisualization,
    fragComplex,
    fragSimplexNoise,
    fragSdf2d,
    fragUtils,
    fragDrawDot,
    fragDrawMultiDot,
    fragDrawSegment,
    fragIsplane,
    fragInversiveSampler,
    fragSymSampler,
    fragDrawFdSampler,
    fragAddNoise,
];

const baseVertexShader = {
    frags: [fragBaseVertex],
};

const progGL_reset = {name: 'GL_reset', vs: baseVertexShader, 
    fs: {frags:[fragGL_utils, fragGL_reset]}
};

const progGL_step = {name: 'GL_step', vs: baseVertexShader, 
    fs: {frags:[fragGL_step]}
};

const progSymSampler = { name: 'SymSampler', vs:baseVertexShader, 
    fs: {frags: [fragIsplane, fragInversiveSampler, fragSymSampler]},
 };

const progSymNoise =  { name: 'SymNoise', vs: baseVertexShader,
        fs: { frags: [ fragUtils, fragIsplane, fragInversiveSampler,fragSimplexNoise,fragAddNoise]},
      };

//
const gsPrograms = [
    progGL_reset,
    progGL_step,
    progSymSampler,
    progSymNoise,
];




/**
*
*  function GinzburgLandauSimulation()
*
*/
function GinzburgLandauSimulation(){
  
    let glCtx = null; // GL context object
    let m_guiFolder = null; // folder of UI
    let gControllers = []; // UI controllers
    let gSimBuffer = null; // simulation double buffer
    let gBlitMaker = null; // blit maker
    let gGroupDataSampler = null; // sym group data
    let gNeedTexRender = true; // flag to re-render texture
    let gEventDispatcher = new EventDispatcher();
    let gGroup = null;
    let mPresetsPlot = makePresetsPlot();

    let mConfig = {

        // simulation params
        preset: Presets.names[0],

        simParams: {
            stepsCount: 4,
            alpha: 0.84, //1.26,
            beta:  0.84, //-0.127,
            //alphaRe: 1.,
            //betaRe: 1.,

            alphaGradient: 0,
            betaGradient: 0,
            Da: 2.0,
            Db: 2.0,
            timestep: 0.06,
            useHMetric: false,
        },
        initType: INIT_TYPE_NOISE,
        
        clearValue: {
            
            value0: 0, 
            value1: 0,             
        },
        simpleNoise: {

            noiseForce: 0.5,
            noiseOffset: -0.5,
            noiseCell: 4,
        },

        symmetricalNoise: {
            noiseCell: 0.2,
            noiseFactor: 0.3,
            noiseX: 0.,
            noiseY: 0.,
            noiseCapSizeX: 0.2,
            noiseCapSizeY: 0.2,
            noiseCapCenterX: 0.2,
            noiseCapCenterY: 0.,
            noiseCrownWordCount: 1,
            lineThickness: 0.005,
        },

        symmetry: {
            // parameters of symmetrization
            symIterations: 2,
            symSim: false,
            symMix: 1,
        },

        // simulation params

        simGridSize: 512, // size of the simulation grid
        //simGridSize: 4096,    // size of the simulation grid

    };
    
    
    let mParams = makeParams();

    function init(context) {

        if (DEBUG)
            console.log(MY_NAME + '.init()', context);
        glCtx = context;
        let res = initFragments(gsFragments);

        if (!res) {
            console.error('initFragments() result: ', res);
            return;
        }

        let t0 = getTime();
        let result = buildProgramsCached(glCtx.gl, gsPrograms);
        if (DEBUG)
            console.log(`makeProgramsCached() ready: ${getTime()-t0} ms`);
        if (!result) {
            console.error(`GS_Simulation.buildProgramsCached() result: ${result}`);
            return;
        }
        initBuffers();
        gBlitMaker = getBlitMaker(glCtx.gl);

        initSimulation();

        mConfig.boundary = {
            useBoundary: false,
            boundaryR: 0,
            boundaryG: 0,
            useDisk: false,
            diskR: 0.01,
            diskX: 0.5,
            diskY: 0.5,
        };
        
        mPresetsPlot.setPlotData(Presets.getPlotData(), 0);

    }
    
    function makePresetsPlot() {
        
        let plot = createDataPlot({
                          //repainter:scheduleRepaint, 
                          left:'2%', top:'2px', width:'40%', height: '40%', 
                          bounds: Presets.getBounds(), 
                          plotType: 1,
                          eventHandler:  makePresetsHandler(),
                          backgroundImagePath: 'images/gl_map_2048_trans.png',  
                          plotName: 'Ginzburg-Landau parameters',
                          floating: true,  
                          storageId:  'presetParamsPlot',
                          });
        return plot;
    }

    function makePresetsHandler() {
        let mouseDown = false;

        function handleEvent(evt) {

            switch (evt.type) {
            case 'mouseup':
                mouseDown = false;
                break;
            case 'mousedown':
                mouseDown = true;
                if (evt.ctrlKey){
                    setParamsFromPlot(evt.wpnt);
                }
                break;
            case 'mousemove':
                if (mouseDown && (evt.ctrlKey)){
                    setParamsFromPlot(evt.wpnt);
                }
                break;
            }

        }
        return {
            handleEvent: handleEvent
        };
    }

    function setParamsFromPlot(p){
       //console.log('setParamsFromPlot()', p); 
       let sp = mParams.simParams;
       sp.alpha.setValue(p[0]);
       sp.beta.setValue(p[1]);
       
       mPresetsPlot.setPlotData(p, 1);

       
    }

  function setPresetData(presetData){
    
    if(DEBUG)console.log('setPresetData:', presetData);
    // assign preset data via mParams
    mParams.simParams.setValue(presetData.params);
    let sp = mConfig.simParams;
    mPresetsPlot.setPlotData([sp.alpha,sp.beta], 1);
  }
  
  function onPresetChanged(){
    
    let set = Presets[mConfig.preset];
    if(set) setPresetData(set);    
    
  }
  
  //
  // create simulation double buffewr and visualizaiton texture buffer 
  //
  function initBuffers(){

      let gl = glCtx.gl;
      
      let simWidth = mConfig.simGridSize;
      let simHeight = simWidth;
      //let filtering = gl.NEAREST;
      let filtering = gl.LINEAR;
      //ext.formatRGBA.internalFormat, ext.formatRGBA.format, ext.halfFloatTexType, gl.NEAREST
      // compatible formats see twgl / textures.js getTextureInternalFormatInfo()
      // or https://webgl2fundamentals.org/webgl/lessons/webgl-data-textures.html
      // 2 components data 
      let format = gl.RG, intFormat = gl.RG32F, texType = gl.FLOAT;
      //let format = gl.RG, intFormat = gl.RG16F, texType = gl.FLOAT;
      // 4 components data  4 byters per channel 
      //let format = gl.RGBA, intFormat = gl.RGBA32F, texType = gl.FLOAT;        
      // 4 components data, 1 byte per channel 
      //let format = gl.RGBA, intFormat = gl.RGBA, texType = gl.UNSIGNED_BYTE;
      
      gSimBuffer = createDoubleFBO(gl, simWidth, simHeight, intFormat, format, texType, filtering);
      
      gGroupDataSampler = DataPacking.createGroupDataSampler(gl);
            
                      
  }

  function informListeners(){
    
    
    gEventDispatcher.dispatchEvent({type: 'imageChanged', target: myself});
      
  }

  function scheduleRepaint(){
    
    //if(DEBUG)console.log('scheduleRepaint()', MY_NAME);
    gNeedTexRender = true;
    informListeners();
    
  }

    function initSimulation(){
        switch(mConfig.initType){
            default: 
            case INIT_TYPE_NOISE: 
                makeNoise(); 
                break;
            case INIT_TYPE_CLEAR: 
                clearSimBuffer();
                break;
                
        }

    }
    
    
    function makeNoise(){
        
        
        if(DEBUG)console.log(`${MY_NAME}.onReset()`, MY_NAME);
        let gl = glCtx.gl;      
        
        gl.disable(gl.BLEND);        
        let program = progGL_reset.program;
        let buffer = gSimBuffer;
        gl.viewport(0, 0, buffer.width, buffer.height);      
        program.bind();
        
        let par = mConfig.simpleNoise;
        
        let uni = {
            uNoiseForce:  par.noiseForce,
            uNoiseOffset: par.noiseOffset,
            uNoiseCell:   par.noiseCell,
        }
                
        console.log('uni: ', uni);
        program.setUniforms(uni);
        
        gBlitMaker.blit(gSimBuffer.write);  
        gSimBuffer.swap();
                    
        scheduleRepaint();
      
  }


    //
    //
    //
    function clearSimBuffer(color) {

        let gl = glCtx.gl;
        let v = mConfig.clearValue;
        
        gl.clearColor(v.value0, v.value1, 0, 0);
        
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, gSimBuffer.write.fbo);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, gSimBuffer.read.fbo);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        scheduleRepaint();
    }
    
    function makeParams() {
        
        let cfg = mConfig;
        
        let params = {
            preset:
            ParamChoice({
                obj: cfg,
                key: 'preset',
                choice: Presets.names,
                name: 'preset',
                onChange: onPresetChanged
            }),
            presetsPlot:
            ParamObj({
                name: 'presets plot',
                obj: mPresetsPlot
            }),

            simParams: makeSimulationParams(),
            simInit:   makeInitParams(),
            simmetry:  makeSymmetryParams(),
        };
        return params;
    }
    
    function makeSimulationParams() {

        let cfg = mConfig.simParams;

        return ParamGroup({
            name: 'sim params',
            params: {
                alpha:
                ParamFloat({
                    obj: cfg,
                    key: 'alpha',
                    min: -0.1,
                    max: 1.0,
                    step: 0.0000001,
                    //name: 'Alpha',
                    onChange: onAlphaBetaChanged,
                }),
                beta:
                ParamFloat({
                    obj: cfg,
                    key: 'beta',
                    min: -0.1,
                    max: 1.0,
                    step: 0.0000001,
                    //name: 'Beta',
                    onChange: onAlphaBetaChanged,
                }),
                alphaGradient:
                ParamFloat({
                    obj: cfg,
                    key: 'alphaGradient',
                    step: 0.0000001,
                    name: 'a-gradient'
                }),
                betaGradient: ParamFloat({
                    obj: cfg,
                    key: 'betaGradient',
                    step: 0.0000001,
                    name: 'b-gradient'
                }),
                stepsCount: ParamInt({
                    obj: cfg,
                    key: 'stepsCount',
                    min: 1,
                    max: 10000,
                    name: 'sim steps',
                }),
                timestep: ParamFloat({
                    obj: cfg,
                    key: 'timestep',
                    name: 'Time Step'
                }),
                useHMetric: ParamBool({
                    obj: cfg,
                    key: 'useHMetric',
                    name: 'H-metric',
                }),
                /*
                Da: ParamFloat({
                    obj: cfg,
                    key: 'Da',
                    name: 'Da'
                }),
                Db: ParamFloat({
                    obj: cfg,
                    key: 'Db',
                    name: 'Db'
                }),
                */
                buffer: ParamCustom({
                    getValue: getBufferData,
                    setValue: setBufferData,
                }),

            },
        });
    }
    

/*    
    
    function initGUI(folder){
      
        if(DEBUG)console.log(`${MY_NAME}.initGUI()`);      
        
        m_guiFolder = folder;
        
        folder.add({ fun: onStep},'fun').name('make one step');

        initPresetsGUI(folder.addFolder('presets'));
                    
        initSimParamsGUI(folder.addFolder('simulation params'), 'simParams');            
        initResetGUI(folder.addFolder('reset'));                      
        initSymmetryGUI(folder.addFolder('symmetry'),'symmetry');

    }

    function initPresetsGUI(folder){
        
        folder.add(mConfig, 'preset', Presets.names).name('preset').onChange(onPresetChanged);
        let presetsPlotFolder = folder.addFolder('presets plot');      
        //mPresetsPlot.initGUI(presetsPlotFolder);
    }
    
    function initResetGUI(folder, key){
        
        folder.add({ fun: initSimulation},'fun').name('initialize');
        
        initSimpleNoiseGUI(folder.addFolder('simple noise'), 'simpleNoise');
        
        initSymmetricalNoiseGUI(folder.addFolder('Symmetrical Noise'), 'symmetricalNoise');
        
    }
    */

    //
    //
    //
    function makeInitParams(){
        
        let cfg = mConfig;
        return ParamGroup({
                name: 'sim init',
                params: {
                    initType:   
                                ParamChoice({
                                    obj: cfg,
                                    key: 'initType',
                                    choice: initTypeNames,
                                    name: 'init type',
                                }),
                    initSim:    
                                ParamFunc({
                                    func: initSimulation,
                                    name: 'Initialize',
                                }),
                    simStep:    
                                ParamFunc({
                                    func: onStep,
                                    name: 'Make Step',
                                }),
                    //initParams: makeNoiseParams(),
                }
        });
                
    } // makeInitParams()

    /*
    function makeSimInitParams(){
                
        initSimpleNoiseGUI(folder.addFolder('simple noise'), 'simpleNoise');        
        initSymmetricalNoiseGUI(folder.addFolder('Symmetrical Noise'), 'symmetricalNoise');
        
    }
    */
    /*
    function initSimpleNoiseGUI(folder, key){
        
        let cfg = mConfig[key];
        let ed = mEditors[key];
        
        ed.noiseCell   = folder.add(cfg, 'noiseCell', 1, 50, 1).name('cell size(px)');
        ed.noiseForce  = folder.add(cfg, 'noiseForce').name('noise force');
        ed.noiseOffset = folder.add(cfg, 'noiseOffset').name('noise offset');
        
    }

    function initSymmetricalNoiseGUI(folder, key){
        
        let ed = mEditors[key];
        let cfg = mConfig[key];
                      
                                 folder.add({ fun: onSymNoise},'fun').name('Do Sym Noise');    
        ed.noiseCell           = folder.add(cfg,'noiseCell', 0, 1, 0.001).name('Noise Cell');
        ed.noiseFactor         = folder.add(cfg,'noiseFactor', -1, 1,0.001).name('Noise Factor');
        ed.lineThickness       = folder.add(cfg,'lineThickness', 0, 1,0.0001).name('Line Thickness');
        ed.noiseX              = folder.add(cfg,'noiseX', -10, 10,0.001).name('Noise X');
        ed.noiseY              = folder.add(cfg,'noiseY', -10, 10,0.001).name('Noise Y');
        ed.noiseCapSizeX       = folder.add(cfg,'noiseCapSizeX', 0, 10,0.001).name('Cap Size X');
        ed.noiseCapSizeY       = folder.add(cfg,'noiseCapSizeY', 0, 10,0.001).name('Cap Size Y');
        ed.noiseCapCenterX     = folder.add(cfg,'noiseCapCenterX', -1,1,0.001).name('Cap Center X');
        ed.noiseCapCenterY     = folder.add(cfg,'noiseCapCenterY', -1,1,0.001).name('Cap Center Y');
        ed.noiseCrownWordCount = folder.add(cfg,'noiseCrownWordCount', 0, 10, 1).name('Crown Word Count');
        
    }

   function initSymmetryGUI(folder, key){
       
    let cfg = mConfig[key];
    let ed = mEditors[key];
    ed.symSim     = folder.add(cfg,'symSim').name('use symmetry');
                    folder.add({ fun: applySymmetry},'fun').name('apply symmetry');
    ed.symMix     = folder.add(cfg,'symMix', 0, 1., 0.001).name('symmetry mix').onChange(onSymmetryChanged);
    ed.symIterations = folder.add(cfg,'symIterations', 0, 100, 1).name('symmetry iterations').onChange(onSymmetryChanged);
    
   }
   
*/
    
    function makeSymmetryParams(){
        
        let cfg = mConfig.symmetry;
        return ParamGroup({
            name: 'sim symmetry',
            params: {
                useSym:     ParamBool({
                                obj: cfg, 
                                key: 'symSim',
                                name: 'use symmetry',
                                }),
                applySymmetry:    ParamFunc({
                                    func: applySymmetry, 
                                    name: 'Apply Symmetry',
                                }),
                symIterations:
                            ParamInt({
                                obj: cfg, 
                                key: 'symIterations', 
                                min: 0, 
                                max: 100, 
                                step: 1,
                                name: 'iterations',
                                onChange: onSymmetryChanged,
                            }),
                symMix:    ParamFloat({
                                    obj: cfg, 
                                    key: 'symMix', 
                                    name: 'symmetry mix',
                                    onChange: onSymmetryChanged,
                                }),
            }
        });
    }  // makeSymmetryParams()
    
    
    function onAlphaBetaChanged(){
        console.log('onAlphaBetaChanged()');
    }
    
    function getInternalBufferData(){
        
        let gl = glCtx.gl; 
        let width = gSimBuffer.width;
        let height = gSimBuffer.height;

        gl.bindFramebuffer(gl.FRAMEBUFFER, gSimBuffer.read.fbo);
        
        const data = new Float32Array(2*width*height);
        //const format = gl.RGBA;
        const format = gl.RG;
        const type = gl.FLOAT;
        gl.readPixels(0, 0, width, height, format, type, data);
        return fa2str(data);
        //return fa2stra(data);
    }

    function setInternalBufferData(data){
        
        console.log('setInternalBufferData()');
        
        let gl = glCtx.gl; 
        let fdata = str2fa(data.buffer);
        console.log('fdata.length:  ', fdata.length);
        console.log('fdata: ', fdata[0], fdata[1], fdata[2], fdata[3], '...');
        const level = 0;
        const internalFormat = gl.RG32F; 
        const width = data.width;
        const height = data.height;
        const border = 0;
        const format = gl.RG; 
        const type = gl.FLOAT;
        
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); 
        gSimBuffer.read.attach(0); 
        gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border,format, type, fdata);  
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); 
        
        //gSimBuffer.swap();
        scheduleRepaint();
                        
        
    }
    
    
    function getBufferData(){
        console.log('getBufferData:');
        let data = {
            width: gSimBuffer.width, 
            height: gSimBuffer.height, 
            buffer: getInternalBufferData()
        };
        //console.log('getBufferData() return: ', data);        
        return data;
    }

    function setBufferData(data){
        
        console.log(`setBufferData: [${data.width} x ${data.height}] = ${data.width*data.height}`);
        setInternalBufferData(data);
        
    }
    
    
  function addEventListener(evtType, listener){
      
    if(DEBUG)console.log(`${MY_NAME}.addEventListener(${evtType}, ${listener})`);            
    gEventDispatcher.addEventListener(evtType, listener);
    
  }
  
  function handleEvent(evt){
    if(DEBUG)console.log(`${MY_NAME}.handleEvent(evt)`);            
      
  }
    
  function getSimBuffer(){
    
    if(false)console.log(`${MY_NAME}.getSimBuffer()`);            
    return gSimBuffer;
    
  }
    
    //
    //
    //
    function applySymmetry(){

        if(false)console.log(`${MY_NAME}.applySymmetry()`);
        let symCfg = mConfig.symmetry;
        let iteration = symCfg.symIterations;
        let symMix = symCfg.symMix;
        let program = progSymSampler.program;

        let gl = glCtx.gl;            
        gl.disable(gl.BLEND);  


        let buffer = gSimBuffer;
        gl.viewport(0, 0, buffer.width, buffer.height);          
        program.bind();

        // map [-1,1] range or rendering quad into [0,1] range of sampler input 
        let ctUni = { uAspect: (buffer.height/buffer.width), uScale: 1, uCenter: [0.,0.] };
        program.setUniforms(ctUni);
              
        let symUni = {
            uSource: gSimBuffer.read,
            uGroupData: gGroupDataSampler,
            uSymMix: symCfg.symMix,        
            uIterations: symCfg.symIterations,
        };
        program.setUniforms(symUni);
        gBlitMaker.blit(gSimBuffer.write);             
        gSimBuffer.swap();

        scheduleRepaint();

    }

    function onSymmetryChanged(){
        if(DEBUG)console.log(`${MY_NAME}.onSymmetryChanged()`);
        scheduleRepaint();
    }
    
    let flag = true;
    
    function onStep(){
        
        if(false)console.log(`${MY_NAME}.onStep()`);
                
        let gl = glCtx.gl;      
        
        gl.disable(gl.BLEND);        
        let program = progGL_step.program;
        let buffer = gSimBuffer;
        gl.viewport(0, 0, buffer.width, buffer.height);      
        
        program.bind();
         
        // map [-1,1] range of rendering quad into [0,1] range of sampler input 
        let ctUni = { uAspect: (buffer.height/buffer.width), uScale: 0.5, uCenter: [0.5,0.5] };
        program.setUniforms(ctUni);

          
        let par = mConfig.simParams;
        
        let simUni = {
          alpha: par.alpha,
          beta:  par.beta,
          //alphaRe: par.alphaRe,
          //betaRe:  par.betaRe,
          alphaGradient: par.alphaGradient,
          betaGradient:  par.betaGradient,
          useHMetric:    par.useHMetric,
          Da:            par.Da,
          Db:            par.Db, 
            
          timestep: par.timestep,
        };
        
        if(flag) {
            console.log('simUni:',simUni);
            flag = false;
        }
        
        program.setUniforms(simUni);
        
        let stepsCount = par.stepsCount;
        
        let sUni = {};
        
        for(let i = 0; i < stepsCount; i++){
          
          sUni.tSource = gSimBuffer.read;
          program.setUniforms(sUni);          
          gBlitMaker.blit(gSimBuffer.write);  
          gSimBuffer.swap();
                              
        }
        
        //if(DEBUG)console.log(`${MY_NAME}.mConfig.symmetry.symSim: `, mConfig.symmetry.symSim);
        if(mConfig.symmetry.symSim)
          applySymmetry();
                    
        scheduleRepaint();
    }
    
    // ----------------------
    //
    //  interface methods 
    //
    //-----------------------

    function setGroup(group){
      
        if(DEBUG)console.log(`${MY_NAME}.setGroup()`);      
        gGroup = group;
        DataPacking.packGroupToSampler(glCtx.gl, gGroupDataSampler, gGroup); 
        scheduleRepaint();
    }

      
    function doStep(){
      
        if(false)console.log(`${MY_NAME}.doStep()`);                  
        onStep();
    
    }

    //function _repaint(){
      
    //    if(DEBUG)console.log(`${MY_NAME}.repaint()`);                  
    
    //}
  
    function getPlotData(){
      
        if(DEBUG)console.log(`${MY_NAME}.getPlotData()`);                  
      
    } 
    
    function getGroup(){
        return gGroup;
    }

    function getParams(){
        return mParams;
    }

    var myself = {
      
        getName: ()=>{return MY_NAME;},
        init: init,
        setGroup: setGroup,
        addEventListener: addEventListener,
        //initGUI: initGUI,
        handleEvent: handleEvent,
        getSimBuffer: getSimBuffer,
        doStep: doStep,
        //repaint: repaint,
        getPlotData: getPlotData,
        getGroup:  getGroup,
        applySymmetry: applySymmetry,
        initSimulation:  initSimulation,
        getParams:       getParams,
        
    };
  
    return myself;
  
} // function GinzburgLandauSimulation()


const GinzburgLandauSimulationCreator = {
    //
    //  create new simulation 
    //
    create: ()=> {return GinzburgLandauSimulation();},
    getName: () => {return MY_NAME;},
    
}

export {GinzburgLandauSimulation,GinzburgLandauSimulationCreator};
