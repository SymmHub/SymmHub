import {
    AttPrograms,
    splitmix32,
    cAdd, 
    cSub, 
    cDiv, 
    cMul, 
    iPoint,
} from './modules.js';

const DEBUG = false;

const MYNAME = 'IteratorCPU';

export function IteratorCPU(){

    let mGL = null;
    
    let mConfig = null; // pointer to IteratedAttractors mConfig
    //
    //  data for CPU calculations 
    //
    const mCpuConfig = {
        
        histogramBuilder:  'cpuHistogramBuilder',
        iterationsArray:    null, // array to perform iterations 
        float32Array:       null, // array to pass points to rendering
        posBuffer: null,    // buffer to pass points array to to GPU 
        posLoc:    null,    // location of attribute to pass points to GPU  
        pointsPerIteration: 0, 
    };


    function init(gl, config){
        if(DEBUG) console.log(`${MYNAME}.init()`);
        mGL = gl;
        mConfig = config;
        
        mCpuConfig.posBuffer = gl.createBuffer();

        let prg = AttPrograms.getProgram(gl, mCpuConfig.histogramBuilder);
        
        mCpuConfig.posLoc = gl.getAttribLocation(prg.program, "a_position");
        if(true) console.log(`${MYNAME} histogramBuilder: `, prg);
        if(true) console.log(`${MYNAME}mCpuConfig.posLoc: `, mCpuConfig.posLoc);
        cpuInitArrays();
    }

    function cpuInitArrays(){
    
        let asize = 4 * mConfig.iterations.batchSize;
        mCpuConfig.iterationsArray = new Float32Array(asize);
        mCpuConfig.float32Array = new Float32Array(asize);        
    }

    function restart(){

        if(DEBUG) console.log(`${MYNAME}.restart()`);
        
        if(mCpuConfig.iterationsArray.length != mConfig.iterations.batchSize * 4) {
            cpuInitArrays();
        }
        initRandomPoints(mCpuConfig.iterationsArray);    
    
    }

    function cpuIteratePoint(pnt0, pnt1){
        
        mConfig.state.attractor.cpuIteratePoint(pnt0, pnt1);
        
        if(mConfig.symmetry.enabled){
            // map point to FD 
            cpuPnt2fd(mConfig.state.group, pnt1);
        }
        
    }

    function iterate(array) {
    
        if(DEBUG) console.log(`${MYNAME}.iterate()`);
        let cfg = mConfig.iterations;
        const {state} = mConfig;
        
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
            //let dist = Math.sqrt(dx * dx + dy * dy);
            let dist = (Math.atan2(pnt0.y, pnt0.x)/Math.PI+1.);
            avgDist += dist;
            array[i    ] = x1;
            array[i + 1] = y1;
            array[i + 2] = dist;
            array[i + 3] = i >> 2;
        }
        
        avgDist /= (array.length/4);
        cfg.avgDist = avgDist;
        state.hasNewPoints = true;
        
    }


    //
    //
    //
    function updateHistogram(){
        
        if(DEBUG)console.log(`${MYNAME} updateHistogram()`);
        const gl = mGL;

        let cpuAcc = AttPrograms.getProgram(gl, mCpuConfig.histogramBuilder);

        const cfg = mConfig;
        const {state} = cfg;
        const icfg = cfg.iterations;
        cfg.state.needToRender = icfg.isRunning;
        let {iterPerFrame,batchCount, startCount} = icfg;
        const {histogram} = state;
         
        let ccfg = cfg.coloring;
        mCpuConfig.pointsPerIteration = 0;
       
        const cpuAccUni = {
          colorSpeed:   ccfg.colorSpeed,
          colorPhase:   ccfg.colorPhase,
          pointSize:    ccfg.pointSize,
          colorSign:    ccfg.colorSign,
          jitter:       ccfg.jitter,
          resolution:   [histogram.width, histogram.height],
          uAttScale:    cfg.bufTrans.transScale,
          uAttCenter:   cfg.bufTrans.transCenter,
        };
        console.log('trans: ', cfg.bufTrans.transScale, cfg.bufTrans.transCenter);
        cpuAcc.bind();
        cpuAcc.setUniforms(cpuAccUni);

        
        for(let k = 0; k < iterPerFrame; k++){
            
            iterate(mCpuConfig.iterationsArray);
               
           
            if(state.hasNewPoints){
                //
                // append points to histogram 
                //

                prepareFloat32Array();
                gl.bindBuffer(gl.ARRAY_BUFFER, mCpuConfig.posBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, mCpuConfig.float32Array, gl.STATIC_DRAW);
                
                gl.enableVertexAttribArray(mCpuConfig.posLoc);
                gl.vertexAttribPointer(mCpuConfig.posLoc, 4, gl.FLOAT, false, 0, 0);        
                                                            
                gl.viewport(0, 0, histogram.width, histogram.height);              
                gl.bindFramebuffer(gl.FRAMEBUFFER, histogram.write.fbo);
                
                if(icfg.accumulate && (batchCount > startCount)){
                    // enable blend to accumulate histogram 
                    gl.disable(gl.BLEND);   
                    //gl.enable(gl.BLEND);   
                    //gl.blendFunc(gl.ONE, gl.ONE);        
                    //gl.blendEquation(gl.FUNC_ADD);
                    // pass histogram data to the renderer
                    let histUni = {uHistogram: histogram.read};
                    cpuAcc.setUniforms(histUni);                    
                    mCpuConfig.pointsPerIteration += icfg.batchSize;
                } else {
                    // discard previous histogram data 
                    gl.disable(gl.BLEND); 
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    mCpuConfig.pointsPerIteration = icfg.batchSize;
                }
                gl.drawArrays(gl.POINTS, 0, icfg.batchSize);
                histogram.swap();
            }
        }
    } // renderHistogram_cpu()
    
    //
    //  transform point into fundamental domain 
    //
    function cpuPnt2fd(group, pnt){
        
        let {transScale, transCenter} = mConfig.bufTrans;
        
        //
        // transform point into group coordinates
        //
        let pb = cAdd(cMul(transScale, [pnt.x, pnt.y]), transCenter);
        
        // transform to FD 
        let ipnt = iPoint(pb);
        let res = group.toFundDomain({pnt: ipnt, maxIterations: mConfig.symmetry.maxIter});
        //
        // transform point back 
        //
        let v = cDiv(cSub(res.pnt.v, transCenter), transScale);
        pnt.x = v[0];
        pnt.y = v[1];
        
    }

    function prepareFloat32Array(){
        if(mConfig.state.hasNewPoints){
            mConfig.state.hasNewPoints = false;
            mCpuConfig.float32Array.set(mCpuConfig.iterationsArray); 
        }            
    }
 
    function initRandomPoints(array) {
    
        console.log(`${MYNAME}.initRandomPoints(array)`);
        let cfg = mConfig.iterations;
        //let par = mParams.iterations;
        let {startCount, seed} = cfg;

        //let seed = 12345;
        //let rnd = mulberry32(seed);
        let rnd = splitmix32(seed);
        //lcg,
        //let rnd = antti2(123);
                
        let w = Math.floor(Math.sqrt(cfg.batchSize)) | 0;
        
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
                
    }
 
    return {
        init:           init,
        restart:        restart,
        updateHistogram: updateHistogram,
        getPointsCount:  () => {return mCpuConfig.pointsPerIteration;}

    }
}