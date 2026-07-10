import {
  isDefined, 
  gs_uniformUV,
  initFragments, 

  GroupUtils,
  getTime, 
  getBlitMaker,
  createDoubleFBO,
  createFBO,
  DataPacking,
  makePatternData,
  EventDispatcher,
  createDataPlot, 
  Colormaps,
  GrayScottPresets,
  
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

  saveBufferData,
  loadBufferData,

} from './modules.js';

import { GS_programs, gsFragments } from './gray_scott_programs.js';


const DEBUG = false;

/** Set to true to save/load simulation buffers as raw binary (.json.bin) instead of base64. */
const useBinaryData = true;


const MYNAME = 'Gray-Scott';
//const GrayScottPresets = GsPresets;



const INIT_TYPE_UNIFORM = 'clear uniform';
const INIT_TYPE_CLEAR10 = 'clear 10';
const INIT_TYPE_NOISE = 'noise';
const INIT_TYPE_SYM_NOISE = 'sym noise';

const initTypeNames = [INIT_TYPE_UNIFORM,INIT_TYPE_CLEAR10, INIT_TYPE_NOISE,INIT_TYPE_SYM_NOISE];

/**
*
*  function GrayScottSimulation()
*
*/
function GrayScottSimulation(){
  
  let glCtx = null;        // GL context object
  let m_guiFolder = null;  // folder of UI 
  //let gControllers = [];   // UI controllers 
  let gSimBuffer = null;   // simulation double buffer 
  let gBlitMaker = null;   // blit maker 
  let gGroupDataSampler = null;  // sym group data 
  let gNeedTexRender = true;     // flag to re-render texture 
  let gEventDispatcher = new EventDispatcher();
  let gGroup = null;

  let presetsPlot = makePresetsPlot();
  
    let config = {

        // Gray-Scott params 
        preset: GrayScottPresets.names[0],

        feedCoeff: 0.062,
        killCoeff: 0.0609, 
        feedGradient: 0,
        killGradient: 0,    
        deltaT: 0.8,
        DiffR: 0.2097,
        DiffG: 0.105,
        useHMetric: false,
        HMetricScale: 1,
        useLaplas9: true,
        stepsCount: 8, 
        initType: INIT_TYPE_NOISE,
        // simulation params 
        simGridSize: 	512,    // size of the simulation grid 
        //simGridSize: 	1024,    // size of the simulation grid 
        //simGridSize: 	2048,    // size of the simulation grid 
        boundary: {
            useBoundary: false,
            boundaryR:  0,
            boundaryG:  0,    
            useDisk:  false,
            diskR:    0.01,
            diskX:    0.5,
            diskY:    0.5,
        }, 
        noise: {
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
        symmetry:  {
            // parameters of symmetrization 
            symInterval:   1000,
            symIterations: 2,
            symSim: false,
            symMix: 1, 
        },
        
        
       
    }; // config 
  
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
        GS_programs.getProgram(glCtx.gl, 'gsSimulation'); // triggers compileAll
        if (DEBUG)
            console.log(`programBuilder() ready: ${getTime()-t0} ms`);

        initBuffers();
        gBlitMaker = getBlitMaker(glCtx.gl);

        presetsPlot.setPlotData(GrayScottPresets.getPlotData(), 0);

    }

    function onCalcUniformUV() {

        let uv = gs_uniformUV(config.feedCoeff, config.killCoeff);
        let dig = 6;
        if (DEBUG)
            console.log(`feed: ${config.feedCoeff.toFixed(dig)} kill: ${config.killCoeff.toFixed(dig)} uv: [${uv[0].toFixed(dig)},${uv[1].toFixed(dig)}]`);

    }
    
    
    function makePresetsPlot() {
        
        let plot = createDataPlot({
                          //repainter:scheduleRepaint, 
                          left:2, bottom:2, width:30, height: 40, 
                          bounds: GrayScottPresets.getBounds(), 
                          plotType: 1,
                          eventHandler:  makePresetsHandler(),
                          //background_image: "url('images/gs_map_600_trans1.png')",
                          //backgroundImagePath: 'images/gs_map_600_trans1.png',  
                          backgroundImagePath: 'images/gs_map_2048_trans.png',  
                          plotName: 'Gray-Scott parameters',
                          floating: true,  
                          storageId:  'presetParamsPlot',
                          });
        return plot;
    }
    

  function makePresetsHandler(){
    let mouseDown = false;
    
    function handleEvent(evt){
        
      switch(evt.type) {        
      case 'mouseup':
        mouseDown = false;
        break;
      case 'mousedown':
        mouseDown = true;
        if(evt.ctrlKey)
            setParamsFromPlot([evt.wpnt[1],evt.wpnt[0]]);        
      break;
      case 'mousemove':
        if(mouseDown && (evt.ctrlKey)) 
            setParamsFromPlot([evt.wpnt[1],evt.wpnt[0]]);                 
        break;        
      }        
      
    }
    return {handleEvent: handleEvent};
  }

  function setParamsFromPlot(pnt){
      
    let sp = mParams.simParams;
    sp.feedCoeff.setValue(pnt[0]);
    sp.killCoeff.setValue(pnt[1]);
    
    presetsPlot.setPlotData([pnt[1],pnt[0]], 1);
    
  }
  
  function onPresetChanged(){
    
    let set = GrayScottPresets[config.preset];
    if(isDefined(set)){
        if(isDefined(set.feed) && isDefined(set.kill)){
            setParamsFromPlot([set.feed,set.kill]);
        }
    }
        
  }
  
  function onFeedKillChanged(){
      presetsPlot.setPlotData([config.killCoeff,config.feedCoeff], 1);
  }
  
  //
  // create simulation double buffer and visualizaiton texture buffer 
  //
  function initBuffers(){

      let gl = glCtx.gl;
      
      let simWidth = config.simGridSize;
      let simHeight = simWidth;
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
      
      onClearSimUni();
      
                      
  }

  function informListeners(){
    
    
    gEventDispatcher.dispatchEvent({type: 'imageChanged', target: myself});
      
  }

  function scheduleRepaint(){
    
    //if(DEBUG)console.log('scheduleRepaint()', MYNAME);
    gNeedTexRender = true;
    informListeners();
    
  }

  //
  //
  //
  function onClearSimUni(){
    
    if(DEBUG)console.log(`${MYNAME}.onClearSimIni()`);
    let uv = gs_uniformUV(config.feedCoeff, config.killCoeff);
    clearSimBuffer([uv[0],uv[1],0,1]);
    scheduleRepaint();
    
  }

  //
  //
  //
  function clearSimBuffer(color){
    
    let gl = glCtx.gl;
    gl.clearColor(color[0],color[1],color[2],color[3]);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, gSimBuffer.write.fbo);
    gl.clear(gl.COLOR_BUFFER_BIT);  
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, gSimBuffer.read.fbo);
    gl.clear(gl.COLOR_BUFFER_BIT);  
  }

    function makeParams(){
        return {
            preset:  
                            ParamChoice({
                                obj: config, 
                                key: 'preset', 
                                choice: GrayScottPresets.names,
                                name: 'preset',
                                onChange: onPresetChanged
                            }),
            presetsPlot:    
                            ParamObj({
                                name:'presets plot',
                                obj: presetsPlot
                            }),
                            
            simParams:              makeSimulationParams(),
            simInit:                makeInitParams(),
            simSymmetry:            makeSymmetryParams(),
        };
    }

    function makeSimulationParams(){
        
        let cfg = config;
        
        return ParamGroup({
            name: 'simulation params',
            params: {
                feedCoeff:  
                            ParamFloat({
                                obj: cfg, 
                                key: 'feedCoeff', 
                                min: -0.1, 
                                max: 1.0, 
                                step: 0.0000001,
                                name: 'Feed',
                                onChange: onFeedKillChanged,
                            }),
                killCoeff:  
                            ParamFloat({
                                obj: cfg, 
                                key: 'killCoeff', 
                                min: -0.1, 
                                max: 1.0, 
                                step: 0.0000001,
                                name: 'Kill',
                                onChange: onFeedKillChanged,
                            }),
                feedGradient:  
                            ParamFloat({
                                obj: cfg, 
                                key: 'feedGradient', 
                                step: 0.0000001,
                                name: 'feed grad'
                            }),
                killGradient: ParamFloat({
                                    obj: config, 
                                    key: 'killGradient', 
                                    step: 0.0000001,
                                    name: 'kill grad'
                                }),
                stepsCount:    ParamInt({
                                    obj: cfg, 
                                    key: 'stepsCount', 
                                    min: 1,
                                    max: 10000,
                                    name: 'steps/frame',
                                }),
                deltaT:    ParamFloat({
                                    obj: cfg, 
                                    key: 'deltaT', 
                                    name: 'time step'
                                }),
                useHMetric: ParamBool({
                                obj: cfg, 
                                key: 'useHMetric',
                                name: 'use H-metric',
                                }),
                HMetricScale: ParamFloat({
                                obj: cfg, 
                                key: 'HMetricScale',
                                name: 'H-scale',
                                }),
                buffer: ParamCustom({
                                getValue: getBufferData,
                                setValue: setBufferData,
                               }),
            }
        });
        
    } // makeSimulationParams()

    function makeSymmetryParams(){
        
        let sconfig = config.symmetry;
        return ParamGroup({
            name: 'simulaton symmetry',
            params: {
                useSym:     ParamBool({
                                obj: sconfig, 
                                key: 'symSim',
                                name: 'use symmetry',
                                }),
                applySymmetry:    ParamFunc({
                                    func: onApplySymmetry, 
                                    name: 'Apply Symmetry',
                                }),
                symInterval:
                            ParamInt({
                                obj: sconfig, 
                                key: 'symInterval', 
                                min: 0, 
                                max: 10000, 
                                step: 1,
                                name: 'interval',
                                onChange: onSymmetryChanged,
                            }),
                symIterations:
                            ParamInt({
                                obj: sconfig, 
                                key: 'symIterations', 
                                min: 0, 
                                max: 100, 
                                step: 1,
                                name: 'iterations',
                                onChange: onSymmetryChanged,
                            }),
                
                symMix:    ParamFloat({
                                    obj: sconfig, 
                                    key: 'symMix', 
                                    name: 'symmetry mix',
                                    onChange: onSymmetryChanged,
                                }),
            }
        });
    }  // makeSymmetryParams()

    function makeNoiseParams(){
        
        let cfg = config.noise;
        return ParamGroup({
                    name: 'init params',
                    params: {
                        noiseCell: 
                                    ParamFloat({
                                        obj: cfg,
                                        key: 'noiseCell',
                                        min: 0, max: 1, step: 0.00001,
                                        name: 'noise cell'
                                    }),
                        noiseFactor: 
                                    ParamFloat({
                                        obj: cfg,
                                        key: 'noiseFactor',
                                        min: -1, max: 1, step: 0.00001,
                                        name: 'noise factor'
                                    }),
                        lineThickness: 
                                    ParamFloat({
                                        obj: cfg,
                                        key: 'lineThickness',
                                        min: 0, max: 1, step: 0.00001,
                                        name: 'line thickness'
                                    }),
                        noiseX: 
                                    ParamFloat({
                                        obj: cfg,
                                        key: 'noiseX',
                                        min: -10, max: 10, step: 0.00001,
                                        name: 'noise x'
                                    }),
                        noiseY: 
                                    ParamFloat({
                                        obj: cfg,
                                        key: 'noiseY',
                                        min: -10, max: 10, step: 0.00001,
                                        name: 'noise y'
                                    }),
                        noiseCapSizeX: 
                                    ParamFloat({
                                        obj: cfg,
                                        key: 'noiseCapSizeX',
                                        min: 0, max: 10, step: 0.00001,
                                        name: 'cap size x'
                                    }),
                        noiseCapSizeY: 
                                    ParamFloat({
                                        obj: cfg,
                                        key: 'noiseCapSizeY',
                                        min: 0, max: 10, step: 0.00001,
                                        name: 'cap size y'
                                    }),
                        noiseCapCenterX: 
                                    ParamFloat({
                                        obj: cfg,
                                        key: 'noiseCapCenterX',
                                        min: 0, max: 10, step: 0.00001,
                                        name: 'cap center x'
                                    }),
                        noiseCapCenterY: 
                                    ParamFloat({
                                        obj: cfg,
                                        key: 'noiseCapCenterY',
                                        min: 0, max: 10, step: 0.00001,
                                        name: 'cap center y'
                                    }),
                        noiseCrownWordCount: 
                                    ParamInt({
                                        obj: cfg,
                                        key: 'noiseCrownWordCount',
                                        min: 0, max: 10, 
                                        name: 'crow count'
                                    }),
                                    
                        
                    }
        });
            
    }
    //
    //
    //
    function makeInitParams(){
        
        let cfg = config;
        return ParamGroup({
                name: 'simulation init',
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
                                    func: onDoStep,
                                    name: 'Make One Step',
                                }),
                    initParams: makeNoiseParams(),
                     
                }
        });
        
        
    } // makeInitParams()
    
    
  function addEventListener(evtType, listener){
      
    if(DEBUG)console.log(`${MYNAME}.addEventListener(${evtType}, ${listener})`);            
    gEventDispatcher.addEventListener(evtType, listener);
    
  }
  
  function handleEvent(evt){
    if(false)console.log(`${MYNAME}.handleEvent(evt)`);            
      
  }
    
  function getSimBuffer(){
    
    if(DEBUG)console.log(`${MYNAME}.getSimBuffer()`);            
    return gSimBuffer;
    
  }

  function getPatternData(){
    
    if(DEBUG)console.log(`${MYNAME}.getPatternData()`);            
    return makePatternData({mainBuffer: gSimBuffer});
    
  }

  function initSimulation(){
      switch(config.initType){
          default: 
          case INIT_TYPE_UNIFORM:
            clearSimUni(); 
            break;
          case INIT_TYPE_CLEAR10:
            clearSim10();
            break;
          case INIT_TYPE_NOISE:
            applyNoise(); 
            break;
          case INIT_TYPE_SYM_NOISE:
             applySymNoise(); 
             break;        
      }
  }
   
  //
  //
  //
  function clearSimUni(){
    
    if(DEBUG)console.log(`${MYNAME}.onClearSimIni()`);
    let uv = gs_uniformUV(config.feedCoeff, config.killCoeff);
    clearSimBuffer([uv[0],uv[1],0,1]);
    scheduleRepaint();
    
  }

  //
  //
  //
  function clearSim10(){
    
    if(DEBUG)console.log(`${MYNAME}.onClearSim10()`);
    clearSimBuffer([1,0,0,1]);
    scheduleRepaint();
  }

  //
  //
  //
  function applyNoise(){
    
    if(DEBUG)console.log(`${MYNAME}.applyNoise()`);
    
    let gl = glCtx.gl;
    let program = GS_programs.getProgram(gl, 'gsNoise1');
    let buffer = gSimBuffer;
    gl.viewport(0, 0, buffer.width, buffer.height);      
    program.bind();
    // map [-1,1] (range or rendering quad) 
    //  into 
    // [0,1] - range of sampler input 
    let ctUni = { u_aspect: (buffer.height/buffer.width), u_scale: 1, u_center: [0.,0.] };
    program.setUniforms(ctUni);
    
    let noiseCfg = config.noise;
    
    let cUni = {
      killCoeff: config.killCoeff,
      feedCoeff: config.feedCoeff,
      NoiseCell: noiseCfg.noiseCell,
      NoiseFactor: noiseCfg.noiseFactor,
      NoiseCenter: [noiseCfg.noiseX,noiseCfg.noiseY],
    };
    
    program.setUniforms(cUni);
    gBlitMaker.blit(gSimBuffer.write);             
    gSimBuffer.swap();
    //gBlitMaker.blit(gSimBuffer.write); 
    
    scheduleRepaint();
          
  }

  //
  //  makes symmetrical noise 
  //
  function applySymNoise(){
    
    let group = gGroup;
    if(DEBUG)console.log(`${MYNAME}.onSymNoise() group:`, group);
    let noiseCfg = config.noise;    
    let gens = group.getReverseITransforms();
    if(DEBUG)console.log(`${MYNAME}.gens:`, gens);
    let trans = GroupUtils.makeTransforms(gens, {maxWordLength: noiseCfg.noiseCrownWordCount});
    //console.log('trans.length:', trans.length);    
    //console.log('trans:', trans);

    
    let gl = glCtx.gl;
    let program = GS_programs.getProgram(gl, 'symNoise');
    
    let buffer = gSimBuffer;
    gl.viewport(0, 0, buffer.width, buffer.height);      
     program.bind();
    // map [-1,1] range or rendering quad into [0,1] range of sampler input 
    let ctUni = { u_aspect: (buffer.height/buffer.width), u_scale: 1, u_center: [0.,0.] };
    program.setUniforms(ctUni);
    
    let fd = group.getFundDomain();
    if(DEBUG) console.log(`${MYNAME}.fd:`, fd);    
    let crownDataSampler = DataPacking.createGroupDataSampler(gl);    
    DataPacking.packGroupToSampler(gl, crownDataSampler, {s: fd, t:trans});
          
    let uv = gs_uniformUV(config.feedCoeff, config.killCoeff);
    
    
    let cUni = {
      GroupData: crownDataSampler,
      NoiseCell: noiseCfg.noiseCell,
      NoiseFactor: noiseCfg.noiseFactor,
      NoiseCenter: [noiseCfg.noiseX,noiseCfg.noiseY],        
      uLineThickness: noiseCfg.lineThickness,
      //MixWidth: config.mixWidth, 
      CapRadius: [noiseCfg.noiseCapSizeX,noiseCfg.noiseCapSizeY],
      CapCenter: [noiseCfg.noiseCapCenterX,noiseCfg.noiseCapCenterY],        
      uBaseColor: [uv[0],uv[1], 0, 0],
    };
    
    program.setUniforms(cUni);

    gl.disable(gl.BLEND);        

    gBlitMaker.blit(gSimBuffer.write);             
    gSimBuffer.swap();
    gBlitMaker.blit(gSimBuffer.write); 
        
    scheduleRepaint();
  }


    function onApplySymmetry(){
        applySymmetry();
        scheduleRepaint();
    }
    //
    //
    //
    function applySymmetry(){

        if(false)console.log(`${MYNAME}.applySymmetry()`);
        let gl = glCtx.gl;
        let symCfg    = config.symmetry;
        let program   = GS_programs.getProgram(gl, 'symSampler');

        gl.disable(gl.BLEND);  


        let buffer = gSimBuffer;
        gl.viewport(0, 0, buffer.width, buffer.height);          
        program.bind();

        // map [-1,1] range or rendering quad into [0,1] range of sampler input 
        let ctUni = { u_aspect: (buffer.height/buffer.width), u_scale: 1, u_center: [0.,0.] };
        program.setUniforms(ctUni);
              
        let symUni = {
            uSource:     gSimBuffer.read,
            uGroupData:  gGroupDataSampler,
            uSymMix:     symCfg.symMix,        
            uIterations: symCfg.symIterations,
        };
        program.setUniforms(symUni);
        gBlitMaker.blit(gSimBuffer.write);             
        gSimBuffer.swap();


    }

    function onSymmetryChanged(){
        if(DEBUG)console.log(`${MYNAME}.onSymmetryChanged()`);
        scheduleRepaint();
    }

    function onDoStep(){
        
        if(DEBUG)console.log(`${MYNAME}.onDoStep()`);
                
        let gl = glCtx.gl;      
        
        gl.disable(gl.BLEND);        
        let program = GS_programs.getProgram(gl, 'gsSimulation');
        let buffer = gSimBuffer;
        gl.viewport(0, 0, buffer.width, buffer.height);      
        
        // map [-1,1] range or rendering quad into [0,1] range of sampler input 
        let ctUni = { u_aspect: (buffer.height/buffer.width), u_scale: 0.5, u_center: [0.5,0.5] };
                      
        //console.log('ctUni:', ctUni);
        let boundaryCfg = config.boundary;
        
        
        let simUni = {
          killCoeff: config.killCoeff,
          feedCoeff: config.feedCoeff, 
          killGradient: config.killGradient, 
          feedGradient: config.feedGradient,       
          tSource: gSimBuffer.read,
          deltaT: config.deltaT,
          DiffR: config.DiffR,
          DiffG: config.DiffG,        
          useLaplas9: config.useLaplas9,
          
          useBoundary: boundaryCfg.useBoundary,
          boundaryR:  boundaryCfg.boundaryR,
          boundaryG:  boundaryCfg.boundaryG,
          useDisk: boundaryCfg.useDisk,
          diskX: boundaryCfg.diskX,
          diskY: boundaryCfg.diskY,
          diskR: boundaryCfg.diskR,
                
          useHMetric:   config.useHMetric,
          HMetricScale:   config.HMetricScale,
          
        };
        
        program.bind();
        program.setUniforms(ctUni);
        program.setUniforms(simUni);
        
        let stepsCount = config.stepsCount;
        
        let sUni = {};
        let sInterval = config.symmetry.symInterval;
                
        for(let i = 0; i < stepsCount; i++){
          
          sUni.tSource = gSimBuffer.read;
          program.setUniforms(sUni);
          
          gBlitMaker.blit(gSimBuffer.write);  
          gSimBuffer.swap();

          if(config.symmetry.symSim) {
            if(false)console.log(`i: ${i} symInterval: ${symInterval}`);
            if(--sInterval <= 0){
                  if(false)console.log(`symmetrization`);
                  applySymmetry(); 
                  // restore the simulation program which was reset in applySymmetry()
                  program = GS_programs.getProgram(gl, 'gsSimulation');
                  program.bind();
                  program.setUniforms(ctUni);
                  program.setUniforms(simUni);
                  sInterval = config.symmetry.symInterval;
            }              
          }                  
        }
        
        if(DEBUG)console.log(`${MYNAME}.config.symmetry.symSim: `, config.symmetry.symSim);
        if(config.symmetry.symSim && sInterval != config.symmetry.symInteval){
            
          if(false)console.log(`symInterval: ${symInterval} last applySymmetry()`);
            
          applySymmetry();
        }
                    
        scheduleRepaint();
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

    
    function getGroupData(){

        return { group: gGroup, groupDataSampler: gGroupDataSampler};
    }

    function getImage(){
      
        if(DEBUG)console.log(`${MYNAME}.getImage()`);            
      
    }
  
    function doStep(){
      
        if(DEBUG)console.log(`${MYNAME}.doStep()`);                  
        onDoStep();
    
    }


    function getGroup(){
        return gGroup;
    }

    function getParams(){
        return mParams;
    }

    var myself = {
      
        getName: ()=> {return MYNAME;},
        getClassName: () => {return MYNAME;},
        init: init,
        setGroup: setGroup,
        getGroupData: getGroupData,
        addEventListener: addEventListener,
        
        getParams: getParams,
        handleEvent: handleEvent,
        getImage: getImage,
        getSimBuffer: getSimBuffer,
        getPatternData: getPatternData,
        doStep: doStep,
        getGroup:  getGroup,
        applySymmetry: applySymmetry,
        initSimulation:  initSimulation,
        
    };
  
    return myself;
  
} // function GrayScottSimulation()


const GrayScottSimulationCreator = {
    //
    //  create new simulation 
    //
    create: ()=> {return GrayScottSimulation();},
    getName: () => {return MYNAME;},
    getClassName: () => {return MYNAME;},
    
}

export {GrayScottSimulation,GrayScottSimulationCreator};
