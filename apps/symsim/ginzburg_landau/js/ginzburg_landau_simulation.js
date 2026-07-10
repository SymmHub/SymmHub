import {
  isDefined, 
  initFragments, 

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
  makePatternData,

  saveBufferData,
  loadBufferData,
  
} from './modules.js';

import { GL_programs, gsFragments } from './ginzburg_landau_programs.js';


const DEBUG = false;

/** Set to true to save/load simulation buffers as raw binary (.json.bin) instead of base64. */
const useBinaryData = true;


const MYNAME = 'Ginzburg-Landau';
const Presets = GinzburgLandauPresets;

const INIT_TYPE_CLEAR = 'clear';
const INIT_TYPE_NOISE = 'noise';
const INIT_TYPE_SYM_NOISE = 'sym noise';

const initTypeNames = [INIT_TYPE_CLEAR, INIT_TYPE_NOISE,INIT_TYPE_SYM_NOISE];




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
            console.log(MYNAME + '.init()', context);
        glCtx = context;
        let res = initFragments(gsFragments);

        if (!res) {
            console.error('initFragments() result: ', res);
            return;
        }

        let t0 = getTime();
        GL_programs.getProgram(glCtx.gl, 'glReset'); // triggers compileAll
        if (DEBUG)
            console.log(`programBuilder() ready: ${getTime()-t0} ms`);

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
    
    //if(DEBUG)console.log('scheduleRepaint()', MYNAME);
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
        
        
        if(DEBUG)console.log(`${MYNAME}.onReset()`, MYNAME);
        let gl = glCtx.gl;      
        
        gl.disable(gl.BLEND);        
        let program = GL_programs.getProgram(gl, 'glReset');
        let buffer = gSimBuffer;
        gl.viewport(0, 0, buffer.width, buffer.height);      
        program.bind();
        
        let par = mConfig.simpleNoise;
        
        let uni = {
            uNoiseForce:  par.noiseForce,
            uNoiseOffset: par.noiseOffset,
            uNoiseCell:   par.noiseCell,
        }
                
        if(DEBUG)console.log(`${MYNAME} uni: `, uni);
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
        if(false)console.log('onAlphaBetaChanged()');
    }
    
    function readSimBuffer() {
        const gl     = glCtx.gl;
        const width  = gSimBuffer.width;
        const height = gSimBuffer.height;
        const fa     = new Float32Array(2 * width * height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, gSimBuffer.read.fbo);
        gl.readPixels(0, 0, width, height, gl.RG, gl.FLOAT, fa);
        return fa;
    }

    function getInternalBufferData(){
        return fa2str(readSimBuffer());
    }

    function writeSimBuffer(fa, width, height) {
        const gl = glCtx.gl;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gSimBuffer.read.attach(0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, width, height, 0, gl.RG, gl.FLOAT, fa);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        scheduleRepaint();
    }

    function setInternalBufferData(data){
        if(DEBUG)console.log('setInternalBufferData()');
        const fdata = str2fa(data.buffer);
        if(DEBUG)console.log('fdata.length:  ', fdata.length);
        if(DEBUG)console.log('fdata: ', fdata[0], fdata[1], fdata[2], fdata[3], '...');
        writeSimBuffer(fdata, data.width, data.height);
    }

    function getBufferData(){
        console.log('getBufferData:');
        return saveBufferData({
            name:          `${MYNAME}.simData`,
            width:         gSimBuffer.width,
            height:        gSimBuffer.height,
            components:    2,
            useBinary:     useBinaryData,
            readData:      readSimBuffer,
            getLegacyData: getInternalBufferData,
        });
    }

    function setBufferData(data){
        loadBufferData(data, {
            name:        MYNAME,
            writeData:   writeSimBuffer,
            writeLegacy: setInternalBufferData,
        });
    }
    

  function addEventListener(evtType, listener){
      
    if(DEBUG)console.log(`${MYNAME}.addEventListener(${evtType}, ${listener})`);            
    gEventDispatcher.addEventListener(evtType, listener);
    
  }
  
  function handleEvent(evt){
    if(DEBUG)console.log(`${MYNAME}.handleEvent(evt)`);            
      
  }
    
  function getSimBuffer(){
    
    if(false)console.log(`${MYNAME}.getSimBuffer()`);            
    return gSimBuffer;
    
  }

  function getPatternData(){
    
    if(false)console.log(`${MYNAME}.getPatternData()`);            
    return makePatternData({mainBuffer: gSimBuffer});
    
  }
    
    //
    //
    //
    function applySymmetry(){

        if(false)console.log(`${MYNAME}.applySymmetry()`);
        let gl = glCtx.gl;            
        let symCfg = mConfig.symmetry;
        let program = GL_programs.getProgram(gl, 'symSampler');

        gl.disable(gl.BLEND);  


        let buffer = gSimBuffer;
        gl.viewport(0, 0, buffer.width, buffer.height);          
        program.bind();

        // map [-1,1] range or rendering quad into [0,1] range of sampler input 
        let ctUni = { u_aspect: (buffer.height/buffer.width), u_scale: 1, u_center: [0.,0.] };
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
        if(DEBUG)console.log(`${MYNAME}.onSymmetryChanged()`);
        scheduleRepaint();
    }
    
    let flag = true;
    
    function onStep(){
        
        if(false)console.log(`${MYNAME}.onStep()`);
                
        let gl = glCtx.gl;      
        
        gl.disable(gl.BLEND);        
        let program = GL_programs.getProgram(gl, 'glStep');
        let buffer = gSimBuffer;
        gl.viewport(0, 0, buffer.width, buffer.height);      
        
        program.bind();
         
        // map [-1,1] range of rendering quad into [0,1] range of sampler input 
        let ctUni = { u_aspect: (buffer.height/buffer.width), u_scale: 0.5, u_center: [0.5,0.5] };
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
        
        //if(DEBUG)console.log(`${MYNAME}.mConfig.symmetry.symSim: `, mConfig.symmetry.symSim);
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
      
        if(DEBUG)console.log(`${MYNAME}.setGroup()`);      
        gGroup = group;
        DataPacking.packGroupToSampler(glCtx.gl, gGroupDataSampler, gGroup); 
        scheduleRepaint();
    }

      
    function doStep(){
      
        if(false)console.log(`${MYNAME}.doStep()`);                  
        onStep();
    
    }

    //function _repaint(){
      
    //    if(DEBUG)console.log(`${MYNAME}.repaint()`);                  
    
    //}
  


    function getGroup(){
        return gGroup;
    }

    function getParams(){
        return mParams;
    }

    var myself = {
      
        getName: ()=>{return MYNAME;},
        init:               init,
        setGroup:           setGroup,
        addEventListener:   addEventListener,
        //initGUI: initGUI,
        handleEvent:        handleEvent,
        getSimBuffer:       getSimBuffer,
        getPatternData:     getPatternData,
        doStep:             doStep,
        //repaint: repaint,
        getGroup:           getGroup,
        applySymmetry:      applySymmetry,
        initSimulation:     initSimulation,
        getParams:          getParams,
        getClassName:       () => MYNAME,
    };
  
    return myself;
  
} // function GinzburgLandauSimulation()


const GinzburgLandauSimulationCreator = {
    //
    //  create new simulation 
    //
    create: ()=> {return GinzburgLandauSimulation();},
    getName: () => {return MYNAME;},
    getClassName: ()=>{return MYNAME;}
    
}

export {GinzburgLandauSimulation,GinzburgLandauSimulationCreator};
