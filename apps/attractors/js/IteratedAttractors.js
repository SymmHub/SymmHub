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
      mGroup = group;
      onRestart();
      
    };

    let mRenderedBuffer;
    let mAttractor = null;
    //let mBufferWidth = 256;
    //let mBufferWidth = 512;
    let mBufferWidth = 1024;
    //let mBufferWidth = 2048;
    //let mBufferWidth = 4096;
    
    let mAccumulator;
    let mPosBuffer; // points buffer
    let mPosLoc;
    let mGroup = null;
    
    
    let mConfig = {
        
        iterations: {
            isRunning:    true,
            //iterate:        true,         
            accumulate:     true,
            startCount: 15,
            seed:       12345,
            batchSize:  100000,
            iterPerBatch: 1,
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
            transScale: [1,0],  
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
            iterations: 5, 
        },
        
    };
    
    let mParams = null;
    let myself = null; 
    let mGL = null;
    let mNeedToRender = true;
    let mNeedToClear = true;
    let mNeedToIterate = true;
    let mTotalCount = 0;
    let mHasNewPoints = false;
    
    let mIterationsArray; // array to perform iterations 
    let mFloat32Array;    // array to pass points to rendering
    
    function init(glContext) {

        mGL = glContext.gl;
        let gl = mGL;
        
        mAttractor = CliffordAttractor(); 
        mAttractor.addEventListener('attractorChanged', onAttractorChanged);
                
        mRenderedBuffer = createImageBuffer(gl, mBufferWidth);
        mAccumulator = createAccumBuffer(gl, mBufferWidth);
        mParams = makeParams(mConfig);

        if(DEBUG)console.log(`${MYNAME}.init() gl:`,gl);
        
        mPosBuffer = gl.createBuffer();

        let cpuAcc = AttPrograms.getProgram(gl, 'cpuAccumulator');
        
        mPosLoc = gl.getAttribLocation(cpuAcc.program, "a_position");

        cpuInitArrays();
        
    }

    function restart(){
        
        if(DEBUG) console.log(`${MYNAME}.restart()`);
        if(mIterationsArray.length != mConfig.iterations.batchSize * 4) 
            cpuInitArrays();
        cpuInitialize(mIterationsArray);    
        //mNeedToRestart = false;
    }
    
    function iterate(){
        // TODO CPU or WebGL
        cpuIterate(mIterationsArray);
    }

    function cpuInitArrays(){
        let asize = 4*getBatchSize();
        mIterationsArray = new Float64Array(asize);
        //mIterationsArray = new Float32Array(asize);
        mFloat32Array = new Float32Array(asize);        
    }

    let mCount = 0;

    function cpuIteratePoint(pnt0, pnt1){
        
        mAttractor.cpuIteratePoint(pnt0, pnt1);
        
        if(mConfig.symmetry.enabled){
            // map point to FD 
            pnt2fd(mGroup, pnt1);
        }
        
    }

    function cpuIterate(array) {
        let cfg = mConfig.iterations;
        if(cfg.batchCount >= cfg.maxBatchCount)
            return;
        
        mHasNewPoints = true;
        let avgDist = 0;
        let pnt0 = {x:0, y:0};
        let pnt1 = {x:0, y:0};
        for (let i = 0; i < array.length; i += 4) {
            pnt0.x = array[i];
            pnt0.y = array[i+1];            
            cpuIteratePoint(pnt0, pnt1);
            //let x = array[i];
            //let y = array[i + 1];
            //calculate(xy, xy1);
            let x1 = pnt1.x;
            let y1 = pnt1.y;            
            let dx = x1 - pnt0.x;
            let dy = y1 - pnt0.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            avgDist += dist;
            array[i    ] = x1;
            array[i + 1] = y1;
            array[i + 2] = dist;
            array[i + 3] = i >> 2;
        }
        
        avgDist /= (array.length/4);
        let par = mParams.iterations;
        cfg.avgDist = avgDist;
        par.avgDist.updateDisplay();
       
        cfg.batchCount++;        
        par.batchCount.updateDisplay();
    }

    function cpuInitialize(array) {
        console.log(`${MYNAME}.cpuInitialize(array)`);
        let cfg = mConfig.iterations;
        let par = mParams.iterations;
        let {startCount, seed} = cfg;

        //let seed = 12345;
        //let rnd = mulberry32(seed);
        let rnd = splitmix32(seed);
        //lcg,
        //let rnd = antti2(123);
                
        let w = Math.floor(Math.sqrt(getBatchSize())) | 0;
        
        let pnt = {x:0, y:0};
   
        for (let i = 0; i < array.length; i += 4) {
            
            let ii = i/4;

            let x = 2*rnd()-1;
            let y = 2*rnd()-1;
            
            //console.log('ii: ', ii, ' x:', x, ' y:', y);
            pnt.x = x;
            pnt.y = y;
           // for (let j = 0; j < startCount; j++) {
           //     cpuIteratePoint(pnt, pnt);
           // }
            array[i]   = pnt.x;
            array[i+1] = pnt.y;
            array[i+2] = 0.;
            array[i+3] = 0.;
            
        }

        cfg.batchCount = 0;
        par.batchCount.updateDisplay();
        mHasNewPoints = true;
                
    }

    //
    //  transform point into fundamental domain 
    //
    function pnt2fd(group, pnt){
        
        let {transScale, transCenter} = mConfig.bufTrans;
        
        //if(true)console.log(`point in fd:`, res.pnt.v);    
        let pb = cAdd(cMul(transScale, [pnt.x, pnt.y]), transCenter);
        let ipnt = iPoint(pb);
        let res = group.toFundDomain({pnt: ipnt});
        let v = cDiv(cSub(res.pnt.v, transCenter), transScale);
        pnt.x = v[0];
        pnt.y = v[1];
        
    }

    function getPoints(){
        if(mHasNewPoints){
            mHasNewPoints = false;
            mFloat32Array.set(mIterationsArray); 
        }            
        return mFloat32Array;
    }


    function clearAccumulator(gl, buffer){
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.fbo);
        gl.disable(gl.BLEND);        
        gl.clearColor(0.0, 0.0, 0.0, 0.0);    
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    function getSimBuffer(options){
        
        if(options.simTransConfig){
            let bufTrans = mConfig.bufTrans;
            let simTrans = options.simTransConfig;
            if( simTrans.simCenterX != bufTrans.centerX || 
                simTrans.simCenterY != bufTrans.centerY ||
                simTrans.simScale   != bufTrans.scale ||
                simTrans.simAngle   != bufTrans.angle) {
                bufTrans.centerX    = simTrans.simCenterX;
                bufTrans.centerY    = simTrans.simCenterY;
                bufTrans.scale      = simTrans.simScale;
                bufTrans.angle      = simTrans.simAngle;
                mNeedToRender = true;
                mNeedToClear = true;
                console.log(`${MYNAME} sim trans changed`);
            }
        }
        
        if(mNeedToRender) {
            renderBuffer(options);            
        }
        
        if(mConfig.iterations.isRunning) 
            scheduleRepaint();
        return mRenderedBuffer;
    }
     
    //
    //  render the image buffer 
    //
    function renderBuffer(options){
        
        //if(true)console.log(`${MYNAME}.renderBuffer()`, options);
        //if(DEBUG)console.trace(`${MYNAME}.render()`);
        let icfg = mConfig.iterations;
        mNeedToRender = icfg.isRunning;
        let gl = mGL;
        
        if(false)console.log(`${MYNAME}.render()`);
            
        if(mNeedToClear){
            
            if(DEBUG)console.log(`${MYNAME}.clearAccumulator()`);
            clearAccumulator(gl, mAccumulator);
            restart();
            mNeedToClear = false;
            mTotalCount = 0;
        }
        //mAttractor.render(gl, mRenderedBuffer.read);
        let buffer = mRenderedBuffer.read;
        
        if(false)console.log(`${MYNAME}.render() gl: `, gl, buffer);
        
        
        let cfg = mConfig;
        
        if(false)console.log('${MYNAME} has new points: ', mHasNewPoints);
        let cpuAcc = AttPrograms.getProgram(gl, 'cpuAccumulator');
        cpuAcc.bind();

        let {iterPerBatch,batchCount, startCount} = mConfig.iterations;
        
        for(let k = 0; k < iterPerBatch; k++){
            
            if(mNeedToIterate || icfg.isRunning) {
                mNeedToIterate = icfg.isRunning;
                // make new batch of points
                iterate();
            }
               
            
            if(mHasNewPoints){
                //
                // append points to accumulator
                //

                let points = getPoints();
                gl.bindBuffer(gl.ARRAY_BUFFER, mPosBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
                gl.enableVertexAttribArray(mPosLoc);
                gl.vertexAttribPointer(mPosLoc, 4, gl.FLOAT, false, 0, 0);        
                            
                let attTrans = cfg.attTrans;
                let ccfg = cfg.coloring;
                let attScale = cPolar(attTrans.scale, attTrans.angle * TORADIANS);
                let attCenter = [attTrans.centerX,attTrans.centerY];
                
                let bufTrans = mConfig.bufTrans;
                let bufCenter = [bufTrans.centerX, bufTrans.centerY];
                let bufScale = cPolar(bufTrans.scale, bufTrans.angle*TORADIANS);
                
                let transScale = attScale;
                let transCenter = attCenter;
                if(attTrans.absolute) {
                    transScale = cDiv(attScale, bufScale);
                    transCenter = cDiv(cSub(attCenter, bufCenter),bufScale);                
                }
                
                // save the trnasofomation to use for symmetrization 
                mConfig.bufTrans.transScale  = transScale;
                mConfig.bufTrans.transCenter = transCenter;
                
                let cpuAccUni = {
                  colorSpeed:   ccfg.colorSpeed,
                  colorPhase:   ccfg.colorPhase,
                  pointSize:    ccfg.pointSize,
                  colorSign:    ccfg.colorSign,
                  jitter:       ccfg.jitter,
                  resolution:   [mAccumulator.width, mAccumulator.height],
                  uAttScale:   transScale,
                  uAttCenter:  transCenter,
                };
                cpuAcc.setUniforms(cpuAccUni);
                
                gl.viewport(0, 0, mAccumulator.width, mAccumulator.height);              
                gl.bindFramebuffer(gl.FRAMEBUFFER, mAccumulator.fbo);
                if(icfg.accumulate && (batchCount > startCount)){
                    // enable blend to accumulate histogram 
                    gl.enable(gl.BLEND);   
                    gl.blendFunc(gl.ONE, gl.ONE);        
                    gl.blendEquation(gl.FUNC_ADD);
                    mTotalCount += getBatchSize();
                } else {
                    gl.disable(gl.BLEND); 
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    mTotalCount = getBatchSize();
                }
                gl.drawArrays(gl.POINTS, 0, points.length/4);
            }
        }
        //if(batchCount < startCount)  
        //        return;
        
        let ccfg = cfg.coloring;
        
        if(true){
            let histRenderer = AttPrograms.getProgram(gl, 'renderHistogram');        
            gl.viewport(0, 0, buffer.width, buffer.height);  
                    
            histRenderer.bind();
                    
            let histUni = {
                src:            mAccumulator,
                scale:          mTotalCount/ (mBufferWidth*mBufferWidth),
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

    function informListeners(){


        mEventDispatcher.dispatchEvent({type: 'imageChanged', target: myself});
      
    }

    function scheduleRepaint(){
        
        informListeners();

    }
     
    function  getBatchSize(){
        
        let {batchSize, iterPerBatch} = mConfig.iterations;
        return batchSize*iterPerBatch;
      
    }
    
    function onAttractorChanged(){
        
        if(DEBUG)console.log(`${MYNAME}.onAttractorChanged()`); 
        onRestart();
    }
    
    function onSingleStep(){
        mNeedToIterate = true;
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
                
        console.log(`${MYNAME}.makeParams() mAttractor:`, mAttractor);
        let onc = onRerender;
        let onres = onRestart;
        
        let params = {
            attractor:      ParamObj({name:'attractor params', obj: mAttractor}),
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
                isRunning:      ParamBool({obj:icfg,key:'isRunning', onChange:onc}),   
                //iterate:        ParamBool({obj:icfg,key:'iterate', onChange:onc}),   
                accumulate:     ParamBool({obj:icfg,key:'accumulate', onChange:onc}),   

                makeStep:       ParamFunc({func:onSingleStep, name:'single step!'}),            
                startCount:     ParamInt({obj:icfg, key:'startCount', onChange: onc}), 
                seed:           ParamInt({obj:icfg, key:'seed', onChange: onc}), 
                iterPerBatch:   ParamInt({obj:icfg, key:'iterPerBatch', onChange:onc}),
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
                iterations:  ParamInt({obj: cfg, key: 'iterations', onChange: onchange}),
                testSymm:    ParamFunc({func:onTestSymm, name:'test symm!'}),
            }
        });
        
    }  // makeSymmetryParams()
    
    function onTestSymm(){
        console.log('onTestSymm()', mGroup);
        for(let i = 0; i < 10; i++){
            let x = 5.*i - 25;
            let y = 50;
            let pnt = {x:x, y:y};
            pnt2fd_test(mGroup, pnt);
            console.log(' ', x, y, '-> , ',pnt.x, pnt.y);
        }
    }
    
    function onRerender(){
        mNeedToRender = true;
        scheduleRepaint();
    }

    function onRestart(){
        
        mNeedToRender = true;
        mNeedToClear = true;        
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
    
        if(DEBUG) console.log(`${MYNAME}.updateAttTrans()`, pmap); 
        console.log(`${MYNAME}. histCenterX:`,pmap.histCenterX);
        console.log(`${MYNAME}. histCenterY:`,pmap.histCenterY);
        console.log(`${MYNAME}. histWidth:`,  pmap.histWidth);
    
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
    
function createAccumBuffer(gl, width){
        
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