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
    cAbs, 
    cArg, 
    setParamValues,
    
    IteratorCPU,
    IteratorGPU,
    
    ParamsAnimator,
    printBufferData,
    
} from './modules.js';


const MYNAME = 'IteratedAttractor';
const DEBUG = false;
const PRINT_TIME = true;

function IteratedAttractor(options){
    
    let mEventDispatcher = new EventDispatcher();
    
    
    function addEventListener( evtType, listener ){        
        if(DEBUG)console.log(`${MYNAME}.addEventListener()`, evtType);
        mEventDispatcher.addEventListener( evtType, listener );      
    };

    function setGroup(group) {
        
        if(false)console.log(`${MYNAME}.setGroup()`, group );
        mConfig.state.group = group;
        // TODO update sampler 
        mConfig.state.groupSampler = null; 

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
            accumThreshold: 1000,
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
            attAnimator:    null,
            renderedBuffer: null,  
            bufferWidth:    (1 << 10), // 20 
            needToClear:    true,
            needToRender:   true,
            needToIterate:  true,
            totalCount:     0,
        }
        
        
    };
    
    let mParams = null;
    let myself = null; 
    let mGL = null;
    
    
    let mIteratorGPU = null;
    let mIteratorCPU = null;
    let mIterator = null;    

    function init(glContext) {

        
        mGL = glContext.gl;
        let gl = mGL;
        
        const scfg = mConfig.state;
        
        scfg.attractor = CliffordAttractor(); 
        scfg.attractor.addEventListener('attractorChanged', onAttractorChanged);
        scfg.attAnimator = ParamsAnimator({count: 4, onChange: onAnimatorChanged});
                
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

    //
    //  it is called when we need to restart iterations 
    //
    function restart(){
        
        if(DEBUG) console.log(`${MYNAME}.restart()`);
        const {state} = mConfig;
        const iterParams = {
            histogram:      state.histogram,
            attractor:      state.attractor,
            groupSampler:   state.groupSampler,
            group:          state.group,
            coloring:       mConfig.coloring,
            iterations:     mConfig.iterations,
            bufTrans:       mConfig.bufTrans,
            symmetry:       mConfig.symmetry,
            
        }
        
        if(mConfig.iterations.useGPU){
            mIterator =  mIteratorGPU;
        } else {
            mIterator =  mIteratorCPU;
        }
        
        mConfig.iterations.batchCount = 0;
        mParams.iterations.batchCount.updateDisplay();
        mIterator.restart(iterParams);
        
    }
    
    
    function clearHistogram(gl, buffer){
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.fbo);
        gl.disable(gl.BLEND);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    function render(arg){
        if(DEBUG)console.log(`${MYNAME}.render()`, arg);
        const {state} = mConfig;
        if(state.attAnimator.enabled){
        
            state.attAnimator.setTime(arg.animationTime);
            let values = mConfig.state.attAnimator.getValues();
            state.attractor.setParamValues(values);
        }
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
     
    
    let debugCount = 0;
    
    function renderBuffer(options){
        
        if(debugCount -- > 0) console.log(`${MYNAME}.renderBuffer()`, options);

        let gl = mGL;
                    
        const {state, coloring} = mConfig;
        
        if(state.attAnimator.enabled && state.attAnimator.isModified){        
            let values = mConfig.state.attAnimator.getValues();
            state.attractor.setParamValues(values);
        }

        if(state.needToClear){
            
            if(DEBUG)console.log(`${MYNAME}.clearHistogram()`);
            clearHistogram(gl, state.histogram.write);
            state.histogram.swap();
            clearHistogram(gl, state.histogram.write);
            restart();
            state.needToClear = false;
            state.totalCount = 0;
        }
        
        initAttTransforms();

        
        if(false)console.log(`${MYNAME}.render() gl: `, gl, buffer);
        
        
        let cfg = mConfig;
        let {iterations} = mConfig;
        
        if(state.totalCount == 0 || iterations.batchCount < iterations.maxBatchCount){
            
            const start = performance.now();
            mIterator.updateHistogram();
            const duration = performance.now() - start;
            if(PRINT_TIME) console.log(`updateHistogram() time: ${duration.toFixed(4)} ms`);
            state.totalCount = mIterator.getPointsCount();
            
            //iterations.batchCount is updated by mIterator
            mParams.iterations.batchCount.updateDisplay();
            mParams.iterations.avgDist.updateDisplay();
         } else {
            state.needToRender = false;
         }
        
        
        if(true){
        
            let buffer = state.renderedBuffer.read;
            let histRenderer = AttPrograms.getProgram(gl, 'histogramRenderer');        
            gl.viewport(0, 0, buffer.width, buffer.height);  
                    
            histRenderer.bind();
            const {bufferWidth} = state;
            const {gamma,contrast,brightness,saturation,dynamicRange,invert, pointSize} = coloring;
            let histUni = {
                src:            state.histogram.read,
                scale:          state.totalCount / (bufferWidth*bufferWidth),
                gamma:          gamma,
                contrast:       contrast,
                brightness:     brightness,
                saturation:     saturation,
                dynamicRange:   dynamicRange,
                invert:         invert, 
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

    function onAnimatorChanged(){
        if(true)console.log(`${MYNAME}.onAnimatorChanged()`); 
        mConfig.state.needToRender = true;
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

    function onPrintHistogram(){
        let hist = mConfig.state.histogram.read;        
        printBufferData(mGL, hist);
    }

    function onPrintBuffer(){
        let buf = mConfig.state.renderedBuffer.read;        
        printBufferData(mGL, buf);
    }
    
    
    //
    //  convert on user request between absolute and relative transform
    //
    function onConvertTransformAbs2Rel(){
    
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
        const {attTrans, bufTrans} = mConfig;
        console.log(`${MYNAME} onConvertTransform()`, attTrans.absolute);
        // attractor transform params
        let Sa = cPolar(attTrans.scale, attTrans.angle * TORADIANS);
        let Ca = [attTrans.centerX,attTrans.centerY];   
        
        // buffer transform params     
        let Sb = cPolar(bufTrans.scale, bufTrans.angle*TORADIANS);        
        let Cb = [bufTrans.centerX, bufTrans.centerY];
        console.log('bufTrans:', bufTrans);
        attTrans.absolute = !attTrans.absolute;
        console.log('attTrans.absolute:', attTrans.absolute);

        let sa, ca;
        if(attTrans.absolute){
            console.log('convert to absolute');
            // relative to absolute transform
            // sa = Sb * Sa
            // ca = Sb * Ca + Cb;
            sa = cMul(Sb,Sa);
            ca = cAdd(cMul(Sb, Ca), Cb);   
            console.log('Sa:', Sa, 'Ca:', Ca);
            console.log('Sb:', Sb, 'Cb:', Cb);
            console.log('sa:', sa, 'ca:', ca);   
        } else {
            console.log('convert to relative');
            // absolute to relative  
            // sa = Sa/Sb
            // ca = (Ca - Cb)/Sb;              
            sa = cDiv(Sa,Sb);
            ca = cDiv(cSub(Ca, Cb), Sb);
            console.log('Sa:', Sa, 'Ca:', Ca);
            console.log('Sb:', Sb, 'Cb:', Cb);
            console.log('sa:', sa, 'ca:', ca);   
        }
        attTrans.centerX = ca[0];
        attTrans.centerY = ca[1];
        attTrans.scale = cAbs(sa);
        attTrans.angle = cArg(sa)/TORADIANS;
        let par = mParams.attTrans;
        par.centerX.updateDisplay();
        par.centerY.updateDisplay();
        par.scale.updateDisplay();
        par.angle.updateDisplay();
        par.absolute.updateDisplay();
        
        onAttractorChanged();
         
    }
    
    //
    //
    //
    function makeParams(cfg){
                
        if(DEBUG)console.log(`${MYNAME}.makeParams() `);
        let onc = onRerender;
        let onres = onRestart;
        
        let params = {
            attractor:      ParamObj({name:'attractor params', obj: cfg.state.attractor}),
            animation:      ParamObj({name:'attractor animation', obj: cfg.state.attAnimator}),
            attTrans:       makeAttTransParams(cfg.attTrans, onres),
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
                abs2rel:        ParamFunc({func: onConvertTransformAbs2Rel,name: 'ans<->rel'}),
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
                startCount:     ParamInt({obj:icfg, key:'startCount', onChange: onc}), 
                seed:           ParamInt({obj:icfg, key:'seed', onChange: onc}), 
                iterPerFrame:   ParamInt({obj:icfg, key:'iterPerFrame', onChange:onc}),
                batchSize:      ParamInt({obj:icfg, key:'batchSize', onChange:onc}),
                maxBatchCount:  ParamInt({obj:icfg, key:'maxBatchCount', onChange:onc}),
                batchCount:     ParamInt({obj:icfg, key:'batchCount'}),
                accumThreshold: ParamFloat({obj:icfg, key:'accumThreshold', onChange:onc}),
                avgDist:        ParamFloat({obj:icfg, key:'avgDist'}), 
                makeStep:       ParamFunc({func:onSingleStep, name:'single step!'}),
                printHist:      ParamFunc({func:onPrintHistogram, name:'Print Histogram!'}),
                printBufer:     ParamFunc({func:onPrintBuffer, name:'Print Buffer!'}),
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
        
        if(pmap.attTransform) {
            // rename wrong key
            pmap.attTrans = pmap.attTransform;
            delete pmap.attTransform;
        }
        
        if(!pmap.attTrans) {
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
        pmap.attTrans = {
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
        render:         render,
        getSimBuffer    : getSimBuffer,
        setParamsMap    : setParamsMap,
        get canAnimate() {return true;},
    };
    return myself;
    
} // function IteratedAttractor 
    
    
    
function createHistogramBuffer(gl, width){
        
    const filtering = gl.NEAREST;
    const format = gl.RGBA, intFormat = gl.RGBA32F, texType = gl.FLOAT;        
    return createDoubleFBO( gl, width, width, intFormat, format, texType, filtering );

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