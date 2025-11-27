import {    
    EventDispatcher,
    createDoubleFBO, 
    createFBO, 
    CliffordAttractor,
    AttPrograms,
    ParamFloat, 
    ParamBool, 
    ParamObj,
    ParamGroup,
    ParamFunc,
    ParamInt,

    iPoint, 
    
    mulberry32,
    splitmix32,
    lcg,
    antti2,
    qrand2x,
    qrand2y,

    TORADIANS, 
    cDiv, 
    cMul, 
    cAdd, 
    cSub,
    cPolar,
    setParamValues,
    
    IteratorCPU,
    IteratorGPU,
    
} from './modules.js';


const MYNAME = 'IteratedAttractor';
const DEBUG = true;

function IteratedAttractor(options){
    
    let mEventDispatcher = new EventDispatcher();
    
    
    function addEventListener( evtType, listener ){        
        if(DEBUG)console.log(`${MYNAME}.addEventListener()`, evtType);
        mEventDispatcher.addEventListener( evtType, listener );      
    };

    function setGroup(group) {
        
      if(DEBUG)console.log(`${MYNAME}.setGroup()`, group );
      mConfig.state.group = group;
      onRestart();
      
    };
            
    let mConfig = {
        
        iterations: {
            useGPU:       false,
            isRunning:    true,
            //iterate:        true,         
            accumulate:     true,
            startCount: 15,
            seed:       12345,
            batchSize:  100000,
            iterPerFrame: 1,
            maxBatchCount: 100,
            avgDist:    0,
            batchCount: 0,
        },
        
        attTrans: {
            absolute: true,
            centerX:    0,
            centerY:    0,
            scale:      1,
            angle:      0,
        },     
        
        bufTrans: {  // transformation of buffer in the parent view 
            centerX: 0,
            centerY: 0,
            scale: 1,
            angle: 0,            
            transScale: [1,0],   // transform to render attractor into buffer 
            transCenter: [0,1],
        },
        coloring: {
            gamma:      2.2,
            contrast:   1, 
            brightness: 0.3,
            saturation: 0.8,
            dynamicRange:0.1,
            invert:         false,  

            colorSpeed:   0.22,
            colorPhase:   Math.PI,
            pointSize:    1,
            colorSign:    1.,
            jitter:       1.25,
        },
        symmetry: {
            enabled:    false,        
            maxIter: 5, 
        },
        
        state: { // current state data
            histogram:      null,
            group:          null,
            attractor:      null, 
            renderedBuffer: null,  
            bufferWidth:    1024, 
            needToClear:    true,
            needToRender:   true,
            needToIterate:  true,
            totalCount:     0,
            hasNewPoints:   false,
        }
        
        
    };
    
    let mParams = null;
    let myself = null; 
    let mGL = null;
    
    
    let mIteratorGPU = null;
    let mIteratorCPU = null;
        
    //
    //  data for CPU calculations 
    //
    const mCpuConfig = {
        
        histogramBuilder:  'cpuHistogramBuilder',
        iterationsArray:    null, // array to perform iterations 
        float32Array:       null, // array to pass points to rendering
        posBuffer: null,    // buffer to pass points array to to GPU 
        posLoc:    null,    // location of attribute to pass points to GPU        
    };
    
    function init(glContext) {

        
        mGL = glContext.gl;
        let gl = mGL;
        
        const scfg = mConfig.state;
        
        scfg.attractor = CliffordAttractor(); 
        scfg.attractor.addEventListener('attractorChanged', onAttractorChanged);
                
        scfg.renderedBuffer = createImageBuffer(gl, scfg.bufferWidth);
        scfg.histogram = createHistogramBuffer(gl, scfg.bufferWidth);
        
        mParams = makeParams(mConfig);

        if(DEBUG)console.log(`${MYNAME}.init() gl:`,gl);
        
        if(!mIteratorCPU){
            mIteratorCPU = IteratorCPU();
        }
        if(!mIteratorGPU) {
            mIteratorGPU = IteratorGPU();
        }
        
        
        initIterators();
                    
    }

    function initIterators(){
        
        mIteratorCPU.init(mGL, mConfig);
        mIteratorGPU.init(mGL, mConfig);        
        
    }

    function restart(){
        
        if(DEBUG) console.log(`${MYNAME}.restart()`);
        
        if(mConfig.iterations.useGPU){
            mIteratorGPU.restart();
        } else {
            mIteratorCPU.restart();
        }
        
        mConfig.iterations.batchCount = 0;
        mParams.iterations.batchCount.updateDisplay();
        mConfig.state.hasNewPoints = true;
    }
    
    
    function clearHistogram(gl, buffer){
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.fbo);
        gl.disable(gl.BLEND);        
        gl.clearColor(0.0, 0.0, 0.0, 0.0);    
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    function getSimBuffer(options){
        
        if(options.simTransConfig){
        
            // buffer was possible moved 
            
            let bufTrans = mConfig.bufTrans;
            let simTrans = options.simTransConfig;
            if( simTrans.simCenterX != bufTrans.centerX || 
                simTrans.simCenterY != bufTrans.centerY ||
                simTrans.simScale   != bufTrans.scale ||
                simTrans.simAngle   != bufTrans.angle) {
                // buffer moved, need to re-render 
                bufTrans.centerX    = simTrans.simCenterX;
                bufTrans.centerY    = simTrans.simCenterY;
                bufTrans.scale      = simTrans.simScale;
                bufTrans.angle      = simTrans.simAngle;
                mConfig.state.needToRender = true;
                mConfig.state.needToClear = true;
                console.log(`${MYNAME} sim trans changed`);
            }
        }
        
        if(mConfig.state.needToRender) {
            renderBuffer(options);            
        }
        
        if(mConfig.iterations.isRunning) 
            scheduleRepaint();
        return mConfig.state.renderedBuffer;
    }
     
    //
    //  render the image buffer 
    //
    function _renderBuffer(options){
    
        if(mConfig.iterations.useGPU){
            renderBuffer_gpu(options);
        } else {
            renderBuffer_cpu(options);        
        }
    }

    
    function renderBuffer(options){
        
        //if(true)console.log(`${MYNAME}.renderBuffer()`, options);
        //if(DEBUG)console.trace(`${MYNAME}.render()`);
        let gl = mGL;
        
        if(false)console.log(`${MYNAME}.render()`);
            
        const {state} = mConfig;
        
        if(state.needToClear){
            
            if(DEBUG)console.log(`${MYNAME}.clearHistogram()`);
            clearHistogram(gl, state.histogram);
            restart();
            state.needToClear = false;
            state.totalCount = 0;
        }
        
        initAttTransforms();

        
        if(false)console.log(`${MYNAME}.render() gl: `, gl, buffer);
        
        
        let cfg = mConfig;
        let {iterations} = mConfig;
        
        if(iterations.batchCount < iterations.maxBatchCount){
        
            if(mConfig.iterations.useGPU)
                mIteratorGPU.updateHistogram();
            else 
                mIteratorCPU.updateHistogram();
            //updateHistogram_cpu();
            
            iterations.batchCount += iterations.iterPerFrame;        
            mParams.iterations.batchCount.updateDisplay();
            
            mParams.iterations.batchCount.updateDisplay();
            mParams.iterations.avgDist.updateDisplay();
         }
        
        let ccfg = cfg.coloring;
        
        if(true){
        
            let buffer = cfg.state.renderedBuffer.read;
            let histRenderer = AttPrograms.getProgram(gl, 'histogramRenderer');        
            gl.viewport(0, 0, buffer.width, buffer.height);  
                    
            histRenderer.bind();
            const bufWidth = cfg.state.bufferWidth;
            
            let histUni = {
                src:            cfg.state.histogram,
                scale:          state.totalCount/ (bufWidth*bufWidth),
                gamma:          ccfg.gamma,
                contrast:       ccfg.contrast,
                brightness:     ccfg.brightness,
                saturation:     ccfg.saturation,
                dynamicRange:   ccfg.dynamicRange,
                invert:         ccfg.invert,            
            };
            
            histRenderer.setUniforms(histUni);
            gl.disable(gl.BLEND); 
            //if(DEBUG) console.log(`${MYNAME} histRenderer.blit()`);
            histRenderer.blit(buffer);
        }        
                       
    } // render()


    //
    //
    //
    function initAttTransforms(){
    
        const cfg = mConfig;
        
        let attTrans = cfg.attTrans;
        
        let attScale = cPolar(attTrans.scale, attTrans.angle * TORADIANS);
        let attCenter = [attTrans.centerX,attTrans.centerY];
        
        const bufTrans = cfg.bufTrans;
        let bufCenter = [bufTrans.centerX, bufTrans.centerY];
        let bufScale = cPolar(bufTrans.scale, bufTrans.angle*TORADIANS);
        
        let transScale = attScale;
        let transCenter = attCenter;
        if(attTrans.absolute) {
            transScale = cDiv(attScale, bufScale);
            transCenter = cDiv(cSub(attCenter, bufCenter),bufScale);                
        }
        
        //
        // save the transformation to use for symmetrization step 
        //
        cfg.bufTrans.transScale  = transScale;
        cfg.bufTrans.transCenter = transCenter;
    }
        
    function informListeners(){


        mEventDispatcher.dispatchEvent({type: 'imageChanged', target: myself});
      
    }

    function scheduleRepaint(){
        
        informListeners();

    }
         
    function onAttractorChanged(){
        
        if(DEBUG)console.log(`${MYNAME}.onAttractorChanged()`); 
        onRestart();
    }
    
    function onSingleStep(){
        mConfig.state.needToIterate = true;
        scheduleRepaint();
    }
    
    function onAbsoluteChanged(){
    
        // Ca - absolute center 
        // Sa - absolute scale 
        //
        // Cr - relative center
        // Sr - relative scale
        // 
        // Cb - buffer center
        // Sb - buffer scale 
        // 
        // relative to absolute transform
        // Sa = Sb * Sr
        // Ca = Sb * Cr + Cb;
        //
        // absolute to relative transform
        // Sra = Sa/Sb
        // Cra = (Ca - Cb)/Sb;
        console.log(`${MYNAME} onAbsoluteChanged()`, mConfig.attTrans.absolute);
        onAttractorChanged();
         
    }
    
    function makeParams(cfg){
                
        if(DEBUG)console.log(`${MYNAME}.makeParams() `);
        let onc = onRerender;
        let onres = onRestart;
        
        let params = {
            attractor:      ParamObj({name:'attractor params', obj: cfg.state.attractor}),
            attTransform:   makeAttTransParams(cfg.attTrans, onres),
            iterations:     makeIterationsParams(cfg.iterations, onres),
            symmetry:       makeSymmetryParams(cfg.symmetry, onres),            
            coloring:       makeColoringParams(cfg.coloring),
        }
        return params;
        
    }
    
    
    function makeColoringParams(ccfg){
    
        let onc = onRerender;
        let onres = onRestart;
    
        return ParamGroup({
            name:   'coloring',
            params: {
                gamma:          ParamFloat({obj:ccfg,key:'gamma', onChange:onc}),
                contrast:       ParamFloat({obj:ccfg,key:'contrast', onChange:onc}),
                brightness:     ParamFloat({obj:ccfg,key:'brightness', onChange:onc}),
                saturation:     ParamFloat({obj:ccfg,key:'saturation', onChange:onc}),
                dynamicRange:   ParamFloat({obj:ccfg,key:'dynamicRange', onChange:onc}),
                invert:         ParamBool({obj:ccfg,key:'invert', onChange:onc}),   
                            
                colorSpeed:     ParamFloat({obj:ccfg,key:'colorSpeed', onChange:onres}),
                colorPhase:     ParamFloat({obj:ccfg,key:'colorPhase', onChange:onres}),
                pointSize:      ParamFloat({obj:ccfg,key:'pointSize', onChange:onres}),
                colorSign:      ParamFloat({obj:ccfg,key:'colorSign', onChange:onres}),
                jitter:         ParamFloat({obj:ccfg,key:'jitter', onChange:onres}),
            },            
        });
    
    }

    function makeAttTransParams(tcfg, onc){
        
        return ParamGroup({
            name:   'attractor transform',
            params: {        
                absolute:       ParamBool({obj:tcfg, key: 'absolute', onChange: onc}),
                centerX:        ParamFloat({obj:tcfg, key: 'centerX', onChange: onc}),
                centerY:        ParamFloat({obj:tcfg, key: 'centerY', onChange: onc}),
                scale:          ParamFloat({obj:tcfg, key: 'scale', onChange: onc}),
                angle:          ParamFloat({obj:tcfg, key: 'angle', name:'angle(deg)', onChange: onc}),                
                }
            });
    
    }
    
    function makeIterationsParams(icfg, onc){
        
        return ParamGroup({
            name: 'iterations',
            params: {
                useGPU:         ParamBool({obj:icfg,key:'useGPU', onChange:onc}),   
                isRunning:      ParamBool({obj:icfg,key:'isRunning', onChange:onc}),   
                //iterate:        ParamBool({obj:icfg,key:'iterate', onChange:onc}),   
                accumulate:     ParamBool({obj:icfg,key:'accumulate', onChange:onc}),   

                makeStep:       ParamFunc({func:onSingleStep, name:'single step!'}),            
                startCount:     ParamInt({obj:icfg, key:'startCount', onChange: onc}), 
                seed:           ParamInt({obj:icfg, key:'seed', onChange: onc}), 
                iterPerFrame:   ParamInt({obj:icfg, key:'iterPerFrame', onChange:onc}),
                batchSize:      ParamInt({obj:icfg, key:'batchSize', onChange:onc}),
                maxBatchCount:  ParamInt({obj:icfg, key:'maxBatchCount', onChange:onc}),            
                batchCount:     ParamInt({obj:icfg, key:'batchCount'}),
                avgDist:        ParamFloat({obj:icfg, key:'avgDist'}), 
            }
            
            
        });
        
    }
    
    function makeSymmetryParams(cfg, onchange){
                
        return ParamGroup({
            name: 'symmetry',
            params: {
                enabled:     ParamBool({obj: cfg, key: 'enabled', onChange: onchange}),
                maxIter:    ParamInt({obj: cfg, key: 'maxIter', onChange: onchange}),
                testSymm:    ParamFunc({func:onTestSymm, name:'test symm!'}),
            }
        });
        
    }  // makeSymmetryParams()
    
    function onTestSymm(){
        console.log('onTestSymm()', mConfig.state.group);
        for(let i = 0; i < 10; i++){
            let x = 5.*i - 25;
            let y = 50;
            let pnt = {x:x, y:y};
            pnt2fd_test(mCOnfig.state.group, pnt);
            console.log(' ', x, y, '-> , ',pnt.x, pnt.y);
        }
    }
    
    function onRerender(){
        mConfig.state.needToRender = true;
        scheduleRepaint();
    }

    function onRestart(){
        
        mConfig.state.needToRender = true;
        mConfig.state.needToClear = true;        
        scheduleRepaint();
    }
    
    function setParamsMap(pmap, initialize=false) {
    
        if(false) console.log(`${MYNAME}.setParamsMap()`, pmap); 
        if(!pmap.attTransform) {
            updateAttTransform(pmap);
        }
        setParamValues(mParams, pmap, initialize);
        
    }
    
    function updateAttTransform(pmap){
    
        if(DEBUG){
            console.log(`${MYNAME}.updateAttTrans()`, pmap); 
            console.log(`${MYNAME}. histCenterX:`,pmap.histCenterX);
            console.log(`${MYNAME}. histCenterY:`,pmap.histCenterY);
            console.log(`${MYNAME}. histWidth:`,  pmap.histWidth);
        }
        let scale = 2./pmap.histWidth;
        pmap.attTransform = {
            absolute:   false,
            scale:      scale,
            angle:      0,
            centerX:    -scale*pmap.histCenterX,
            centerY:    -scale*pmap.histCenterY,
            };
            
    }
    
    
    myself = {
        getName         : () => MYNAME,
        addEventListener: addEventListener, 
        setGroup        : setGroup, 
        init            : init,
        getParams:  ()=>{return mParams;},
        getSimBuffer    : getSimBuffer,
        setParamsMap    : setParamsMap,
        //render          : render,
        //get canAnimate() {return true;},
    };
    return myself;
}
    
function createHistogramBuffer(gl, width){
        
    const filtering = gl.NEAREST;
    const format = gl.RGBA, intFormat = gl.RGBA32F, texType = gl.FLOAT;        
    return createFBO( gl, width, width, intFormat, format, texType, filtering );

}

function createImageBuffer(gl, width) {

  const filtering = gl.LINEAR;
  const format = gl.RGBA, intFormat = gl.RGBA32F, texType = gl.FLOAT;              
  return createDoubleFBO( gl, width, width, intFormat, format, texType, filtering );

}

    
//
//  factory of iterated attracrtors 
//
const IteratedAttractorCreator = {
    //
    create:         ()=> {return IteratedAttractor();},
    getName:        () => {return `${MYNAME}-factory`;},
    getClassName:   ()=>{return `${MYNAME}-class`;}
    
}
    
export {IteratedAttractorCreator}