import {
  isDefined, 
  gs_uniformUV,
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
  Colormaps,
  GrayScottPresets,
  GrayScottFragments as GS, 
  ShaderFragments as SF,
  
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
  
} from './modules.js';


const debug = false;


const myName = 'Gray-Scott';
//const GrayScottPresets = GsPresets;

const fragGsSimulation     = {obj:GS,id:'grayScottShader'};
const fragGsNoise1         = {obj:GS,id:'gsNoise1Shader'};

const fragSdf2d            = {obj:SF,id:'sdf2d'};
const fragUtils            = {obj:SF,id:'utils'};
const fragBaseVertex       = {obj:SF,id:'canvasVertexShader'};
const fragSimplexNoise     = {obj:SF,id:'simplexNoise'};
const fragIsplane          = {obj:SF,id:'isplane'};
const fragInversiveSampler = {obj:SF,id:'inversiveSampler'};
const fragDrawFdSampler    = {obj:SF,id:'fundDomainSamplerShader'};
const fragAddNoise         = {obj:SF,id:'addNoiseShader'};
const fragSymSampler       = {obj:SF,id:'symSamplerShader'};


const gsFragments = [
    fragGsSimulation,
    fragGsNoise1,
    fragBaseVertex,
    fragSimplexNoise,
    fragSdf2d,
    fragUtils,
    fragIsplane,
    fragInversiveSampler,
    fragSymSampler,
    fragAddNoise,
];

const baseVertexShader = {
    frags: [fragBaseVertex],
};

const progGsSimulation =  {name: 'GsSimulation', vs:baseVertexShader, 
    fs: {frags:[fragSdf2d, fragGsSimulation]}
}; 

const progGsNoise1 =  {name: 'GsNoise1', vs:baseVertexShader, 
    fs: {frags:[fragSimplexNoise,fragGsNoise1]}
};

const progSymSampler = { name: 'SymSampler', vs:baseVertexShader, 
    fs: {frags: [fragIsplane, fragInversiveSampler, fragSymSampler]},
 };

const progSymNoise =  { name: 'SymNoise', vs: baseVertexShader,
        fs: { frags: [ fragUtils, fragIsplane, fragInversiveSampler,fragSimplexNoise,fragAddNoise]},
      };

//
const gsPrograms = [
  progGsSimulation,
  progGsNoise1,  
  progSymSampler,
  progSymNoise,
];


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

        if (debug)
            console.log(myName + '.init()', context);
        glCtx = context;
        let res = initFragments(gsFragments);

        if (!res) {
            console.error('initFragments() result: ', res);
            return;
        }

        let t0 = getTime();
        let result = buildProgramsCached(glCtx.gl, gsPrograms);
        if (debug)
            console.log(`makeProgramsCached() ready: ${getTime()-t0} ms`);
        if (!result) {
            console.error(`GS_Simulation.buildProgramsCached() result: ${result}`);
            return;
        }
        initBuffers();
        gBlitMaker = getBlitMaker(glCtx.gl);

        presetsPlot.setPlotData(GrayScottPresets.getPlotData(), 0);

    }

    function onCalcUniformUV() {

        let uv = gs_uniformUV(config.feedCoeff, config.killCoeff);
        let dig = 6;
        if (debug)
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
    
    setParamsFromPlot([set.feed,set.kill]);
        
  }
  
  function onFeedKillChanged(){
      presetsPlot.setPlotData([config.killCoeff,config.feedCoeff], 1);
  }
  
  //
  // create simulation double buffewr and visualizaiton texture buffer 
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
    
    //if(debug)console.log('scheduleRepaint()', myName);
    gNeedTexRender = true;
    informListeners();
    
  }

  //
  //
  //
  function onClearSimUni(){
    
    if(debug)console.log(`${myName}.onClearSimIni()`);
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
        
    //initFolder.add(config, 'initType', initTypeNames).name('init type');
    //initFolder.add({ fun: initSimulation}, 'fun').name('Initialize');    
    //initFolder.add({ fun: onDoStep},'fun').name('one step');

    //let snFolder = initFolder.addFolder('params');
    
        
    } // makeInitParams()
    
    
  function addEventListener(evtType, listener){
      
    if(debug)console.log(`${myName}.addEventListener(${evtType}, ${listener})`);            
    gEventDispatcher.addEventListener(evtType, listener);
    
  }
  
  function handleEvent(evt){
    if(false)console.log(`${myName}.handleEvent(evt)`);            
      
  }
    
  function getSimBuffer(){
    
    if(debug)console.log(`${myName}.getSimBuffer()`);            
    return gSimBuffer;
    
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
    
    if(debug)console.log(`${myName}.onClearSimIni()`);
    let uv = gs_uniformUV(config.feedCoeff, config.killCoeff);
    clearSimBuffer([uv[0],uv[1],0,1]);
    scheduleRepaint();
    
  }

  //
  //
  //
  function clearSim10(){
    
    if(debug)console.log(`${myName}.onClearSim10()`);
    clearSimBuffer([1,0,0,1]);
    scheduleRepaint();
  }

  //
  //
  //
  function applyNoise(){
    
    if(debug)console.log(`${myName}.applyNoise()`);
    
    let gl = glCtx.gl;
    let program = progGsNoise1.program;
    let buffer = gSimBuffer;
    gl.viewport(0, 0, buffer.width, buffer.height);      
    program.bind();
    // map [-1,1] (range or rendering quad) 
    //  into 
    // [0,1] - range of sampler input 
    let ctUni = { uAspect: (buffer.height/buffer.width), uScale: 1, uCenter: [0.,0.] };
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
    if(debug)console.log(`${myName}.onSymNoise() group:`, group);
    let noiseCfg = config.noise;    
    let gens = group.getReverseITransforms();
    if(debug)console.log(`${myName}.gens:`, gens);
    let trans = GroupUtils.makeTransforms(gens, {maxWordLength: noiseCfg.noiseCrownWordCount});
    //console.log('trans.length:', trans.length);    
    //console.log('trans:', trans);

    
    let gl = glCtx.gl;
    let program = progSymNoise.program;
    
    let buffer = gSimBuffer;
    gl.viewport(0, 0, buffer.width, buffer.height);      
     program.bind();
    // map [-1,1] range or rendering quad into [0,1] range of sampler input 
    let ctUni = { uAspect: (buffer.height/buffer.width), uScale: 1, uCenter: [0.,0.] };
    program.setUniforms(ctUni);
    
    let fd = group.getFundDomain();
    if(debug) console.log(`${myName}.fd:`, fd);    
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

        if(false)console.log(`${myName}.applySymmetry()`);
        let symCfg    = config.symmetry;
        let program   = progSymSampler.program;

        let gl = glCtx.gl;            
        gl.disable(gl.BLEND);  


        let buffer = gSimBuffer;
        gl.viewport(0, 0, buffer.width, buffer.height);          
        program.bind();

        // map [-1,1] range or rendering quad into [0,1] range of sampler input 
        let ctUni = { uAspect: (buffer.height/buffer.width), uScale: 1, uCenter: [0.,0.] };
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
        if(debug)console.log(`${myName}.onSymmetryChanged()`);
        scheduleRepaint();
    }

    function onDoStep(){
        
        if(debug)console.log(`${myName}.onDoStep()`);
                
        let gl = glCtx.gl;      
        
        gl.disable(gl.BLEND);        
        let program = progGsSimulation.program;
        let buffer = gSimBuffer;
        gl.viewport(0, 0, buffer.width, buffer.height);      
        
        // map [-1,1] range or rendering quad into [0,1] range of sampler input 
        let ctUni = { uAspect: (buffer.height/buffer.width), uScale: 0.5, uCenter: [0.5,0.5] };
                      
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
                  // restore the simulation program whoich was reset in applySymmetry()
                  program = progGsSimulation.program;
                  program.bind();
                  program.setUniforms(ctUni);
                  program.setUniforms(simUni);
                  sInterval = config.symmetry.symInterval;
            }              
          }                  
        }
        
        if(debug)console.log(`${myName}.config.symmetry.symSim: `, config.symmetry.symSim);
        if(config.symmetry.symSim && sInterval != config.symmetry.symInteval){
            
          if(false)console.log(`symInterval: ${symInterval} last applySymmetry()`);
            
          applySymmetry();
        }
                    
        scheduleRepaint();
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

    // ----------------------
    //
    //  interface methods 
    //
    //-----------------------

    function setGroup(group){
      
        if(debug)console.log(`${myName}.setGroup()`);      
        gGroup = group;
        DataPacking.packGroupToSampler(glCtx.gl, gGroupDataSampler, gGroup); 
        scheduleRepaint();
    }

    
    function getGroupData(){

        return { group: gGroup, groupDataSampler: gGroupDataSampler};
    }

    function getImage(){
      
        if(debug)console.log(`${myName}.getImage()`);            
      
    }
  
    function doStep(){
      
        if(debug)console.log(`${myName}.doStep()`);                  
        onDoStep();
    
    }

    //function repaint(){
      
    //    if(debug)console.log(`${myName}.repaint()`);                  
    
    //}
  
    function getPlotData(){
      
        if(debug)console.log(`${myName}.getPlotData()`);                  
      
    } 
  
  
    function getGroup(){
        return gGroup;
    }

    function getParams(){
        return mParams;
    }

    var myself = {
      
        getName: ()=>{return myName;},
        init: init,
        setGroup: setGroup,
        getGroupData: getGroupData,
        addEventListener: addEventListener,
        
        //initGUI: initGUI,
        //createUI: initGUI,
        getParams: getParams,
        handleEvent: handleEvent,
        //getColormapName: getColormapName,
        getImage: getImage,
        getSimBuffer: getSimBuffer,
        doStep: doStep,
        //repaint: repaint,
        getPlotData: getPlotData,
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
    getName: () => {return myName;},
    
}

export {GrayScottSimulation,GrayScottSimulationCreator};
