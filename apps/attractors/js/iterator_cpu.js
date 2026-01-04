import {
    AttPrograms,
    splitmix32,
    qrand2,
    cAdd, 
    cSub, 
    cDiv, 
    cMul, 
    iPoint,
} from './modules.js';

const DEBUG = true;

const MYNAME = 'IteratorCPU';

export function IteratorCPU(){

    let mGL = null;
    
    //let mConfig = null; // pointer to IteratedAttractors mConfig
    let mIterParams = null;
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
        needRestart: true,
    };


    function init(gl, config){
        if(DEBUG) console.log(`${MYNAME}.init()`);
        mGL = gl;
        //mConfig = config;
        
        mCpuConfig.posBuffer = gl.createBuffer();

        let prg = AttPrograms.getProgram(gl, mCpuConfig.histogramBuilder);
        
        mCpuConfig.posLoc = gl.getAttribLocation(prg.program, "a_position");
        //if(true) console.log(`${MYNAME} histogramBuilder: `, prg);
        //if(true) console.log(`${MYNAME}mCpuConfig.posLoc: `, mCpuConfig.posLoc);
        //cpuInitArrays();
    }

    function cpuInitArrays(){
       
        
        if(mIterParams && mCpuConfig.iterationsArray){
            if(mCpuConfig.iterationsArray.length != mIterParams.iterations.batchSize * 4){
                let asize = (4*mIterParams.iterations.batchSize);            
                mCpuConfig.iterationsArray = new Float32Array(asize);
                mCpuConfig.float32Array = new Float32Array(asize);        
            }
        } else {
                mCpuConfig.iterationsArray = new Float32Array(4);
                mCpuConfig.float32Array = new Float32Array(4);                        
        }
    }

    function restart(iterParams){

        if(DEBUG) console.log(`${MYNAME}.restart() `, iterParams);
        mIterParams = iterParams;
        
        cpuInitArrays();        
        initRandomPoints(mCpuConfig.iterationsArray); 
        mCpuConfig.needRestart = true;
    
    }

    function cpuIteratePoint(pnt0, pnt1){
        
        mIterParams.attractor.cpuIteratePoint(pnt0, pnt1);
        
        if(mIterParams.symmetry.enabled){
            // map point to FD 
            cpuPnt2fd(mIterParams.group, pnt1);
        }
        
    }

    function iterate(array) {
    
        //if(DEBUG) console.log(`${MYNAME}.iterate()`);
        
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
        mIterParams.iterations.avgDist = avgDist;
        
    }


    //
    // is called by IteratedAttractor 
    //
    function updateHistogram(){
        
        // if(DEBUG)console.log(`${MYNAME}.updateHistogram()`);
        const gl = mGL;

        

        const {histogram, iterations, coloring, bufTrans} = mIterParams;        
        const {iterPerFrame,batchCount, startCount, batchSize, accumulate, accumThreshold} = iterations;
        const {pointSize, colorSpeed, colorPhase,colorSign,jitter} = coloring;  
        const {transScale, transCenter} = bufTrans;

        const cpuAccUni = {
          colorSpeed:   colorSpeed,
          colorPhase:   colorPhase,
          uPointSize:    Math.max(pointSize, 1.),
          colorSign:    colorSign,
          jitter:       jitter,
          resolution:   [histogram.width, histogram.height],
          uAttScale:    transScale,
          uAttCenter:   transCenter,
          uHistThreshold: accumThreshold,  
          uPixelSizeFactor: (pointSize > 1.) ? (1./(pointSize*pointSize)): 1., 
        };
        
        if(mCpuConfig.needRestart){
            
            if(DEBUG)console.log(`${MYNAME} initialIterations`);
            mCpuConfig.needRestart = false;

            for(let k = 0; k < startCount; k++){
                iterate(mCpuConfig.iterationsArray);
            }
            
            appendPointToHistogram(histogram, accumulate, batchSize, cpuAccUni);
            mCpuConfig.pointsPerIteration = iterations.batchSize;
        }
        

        for(let k = 0; k < iterPerFrame; k++){
            
            if(iterations.batchCount >=  iterations.maxBatchCount) {
                return;
            }
            
            //if(DEBUG) console.log(`${MYNAME} iteration: ${k}`);
            iterate(mCpuConfig.iterationsArray);
            appendPointToHistogram(histogram, accumulate, batchSize, cpuAccUni);
            iterations.batchCount++;
            
        }
    } // updateHistogram()

    //
    //  
    //
    function appendPointToHistogram(histogram, accumulate, batchSize, cpuAccUni){
        
        //if(DEBUG)console.log(`${MYNAME}.addPointsToHistogram()`);
        const gl = mGL;
        prepareFloat32Array();
        let cpuAcc = AttPrograms.getProgram(gl, mCpuConfig.histogramBuilder);
        cpuAcc.bind();
        cpuAcc.setUniforms(cpuAccUni);
        //console.log('cpuAccUni: ', cpuAccUni);
        gl.bindBuffer(gl.ARRAY_BUFFER, mCpuConfig.posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mCpuConfig.float32Array, gl.STATIC_DRAW);
        
        gl.enableVertexAttribArray(mCpuConfig.posLoc);
        gl.vertexAttribPointer(mCpuConfig.posLoc, 4, gl.FLOAT, false, 0, 0);        
                                                    
        gl.viewport(0, 0, histogram.width, histogram.height);              
        gl.bindFramebuffer(gl.FRAMEBUFFER, histogram.write.fbo);
        
        if(accumulate ){
            // enable blend to accumulate histogram 
            // need blendi8ng to accumulate historghram data 
            gl.enable(gl.BLEND);   
            gl.blendFunc(gl.ONE, gl.ONE);
            gl.blendEquation(gl.FUNC_ADD); 
            // pass histogram data to the renderer                    
            cpuAcc.setUniforms({uHistogram: histogram.read});                    
            mCpuConfig.pointsPerIteration += batchSize;
        } else {
            // discard previous histogram data 
            gl.disable(gl.BLEND); 
            gl.clear(gl.COLOR_BUFFER_BIT);
            // enable blending to accumulate histogram 
            gl.enable(gl.BLEND);   
            gl.blendFunc(gl.ONE, gl.ONE);
            gl.blendEquation(gl.FUNC_ADD); 
            mCpuConfig.pointsPerIteration = batchSize;
        }
        gl.drawArrays(gl.POINTS, 0, batchSize);
        histogram.swap();
        let copyProg = AttPrograms.getProgram(gl, 'gpuCopy');
        
        copyProg.bind();                
        copyProg.setUniforms({uSrc: histogram.read})
        gl.viewport(0, 0, 1.1*histogram.width, 1.1*histogram.height);              
        gl.disable(gl.BLEND);
        copyProg.blit(histogram.write);
        histogram.swap();
    } // function appendHistogram()
    
    //
    //  transform point into fundamental domain 
    //
    function cpuPnt2fd(group, pnt){
        
        let {transScale, transCenter} = mIterParams.bufTrans;
        
        //
        // transform point into group coordinates
        //
        let pb = cAdd(cMul(transScale, [pnt.x, pnt.y]), transCenter);
        
        // transform to FD 
        let ipnt = iPoint(pb);
        let res = group.toFundDomain({pnt: ipnt, maxIterations: mIterParams.symmetry.maxIter});
        //
        // transform point back 
        //
        let v = cDiv(cSub(res.pnt.v, transCenter), transScale);
        pnt.x = v[0];
        pnt.y = v[1];
        
    }

    function prepareFloat32Array(){
        mCpuConfig.float32Array.set(mCpuConfig.iterationsArray);                 
    }
 
    function initRandomPoints(array) {
    
        if(DEBUG)console.log(`${MYNAME}.initRandomPoints(array)`);
        let {iterations} = mIterParams;
        //let par = mParams.iterations;
        let {startCount, seed} = iterations;

        //let seed = 12345;
        //let rnd = mulberry32(seed);
        //let rnd = splitmix32(seed);
        //let rnd = antti2(123);
        let rnd = qrand2(seed);
        
        let pnt = [0,0];
        for (let i = 0, j = 0; i < array.length; i++, j+=4) {
            
            //let x = 2*rnd()-1;
            //let y = 2*rnd()-1;
            rnd.nextPoint(pnt);
            let x = 2*pnt[0] - 1;
            let y = 2*pnt[1] - 1;
            
            //console.log('ii: ', ii, ' x:', x, ' y:', y);
            //pnt.x = x;
            //pnt.y = y;
            array[j]   = x;
            array[j+1] = y;
            array[j+2] = Math.atan2(y,x)/Math.PI;// initial coloring 
            array[j+3] = i >> 2;
        }
    }
 
    return {
        init:           init,
        restart:        restart,
        updateHistogram: updateHistogram,
        getPointsCount:  () => {return mCpuConfig.pointsPerIteration;}

    }
}