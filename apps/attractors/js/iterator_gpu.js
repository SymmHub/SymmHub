import {

   AttPrograms,
   createDoubleFBO,
   createFBO,
   readPixelsFromBuffer,
   qrand2, 
   mulberry32_2d,
   grid_2d,
   getRandomPoints2D,
   PointShapes,
} from './modules.js';


const MYNAME = 'IteratorGPU';
const DEBUG = false;

export function IteratorGPU(gl){

    //
    //  data for CPU calculations 
    //
    const mGpuConfig = {
        needRestart: true,
        posLoc:    null,    // location of attribute to pass points to GPU   
        indexBuffer: null,  // points indices 
        pointsPerIteration: 0,  // points in the current iteration 
        pointDataWidth:     0,  // initial data width 
        poinsData:          null, // doublke FBO used for iterations
        initialData:        null, // FBO used to store initial random data 
        oldBatchSize:          0,  // ititial batcvh size
        oldSeed:            -1,   // seed for initialization 
    };
    let mGL = null;
    let mIterParams;
    
    function init(gl){
    
        if(DEBUG) console.log(`${MYNAME}.init()`);
        mGL = gl;       
        
    }
        
    function restart(iterParams){
        
        if(DEBUG) console.log(`${MYNAME}.restart() `, iterParams);
        mIterParams = iterParams;
        
        let gl = mGL;
                       
        mGpuConfig.needRestart = true;

        
        //printBufferData(mGL, pointsData.read);
        //printBufferData(mGL, pointsData.write);
            
    }
    
    function initBuffers(gl){
    
        const {pointDataWidth, oldBatchSize, oldSeed} = mGpuConfig;
        const { batchSize, seed } = mIterParams.iterations;
        
        let newWidth = Math.ceil(Math.sqrt(batchSize)) | 0;
        if(DEBUG) console.log(`${MYNAME}.initBuffers() batchSize: `, batchSize, ` newWidth:`, newWidth);

        if(newWidth != mGpuConfig.pointDataWidth ) {
            
            if(true)console.log('${MYNAME}.initBuffers() newWidth:', newWidth);
            mGpuConfig.pointsData = createDoubleFBO( gl, newWidth, newWidth, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
            mGpuConfig.initialData = createFBO( gl, newWidth, newWidth, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);            
            mGpuConfig.pointDataWidth = newWidth;
        }

        if(oldBatchSize != batchSize || oldSeed != seed){
            let indexArray = makeIndexArray(newWidth, batchSize);
            mGpuConfig.indexBuffer = makeIndexBuffer(gl, indexArray);
            if(false)console.log('${MYNAME}.makeIndexBuffer() batchSize:', batchSize, '', oldBatchSize, seed, oldSeed);
            if(false)console.log('${MYNAME}.makeIndexBuffer() indexArray:', indexArray);
            initPointsData2(mGpuConfig.initialData ); 
            mGpuConfig.oldSeed = seed;
            mGpuConfig.oldBatchSize = batchSize;
            
        }
        //if(DEBUG) console.log(`${MYNAME}.initBuffers() indexArray: `, indexArray);                
                                        
    }
    
    
    function initPointsData(pData){

        if(DEBUG)console.log(`${MYNAME}.initPointsData()`, pData);

        // fill data array with random points 
        const {pointDataWidth} = mGpuConfig;
        const gl = mGL;
        
        let initProg = AttPrograms.getProgram(gl, 'gpuInitializer');         
        gl.viewport(0, 0, pData.width, pData.height);  
        initProg.bind();
        initProg.setUniforms({u_resolution: pData.width});
        initProg.blit(pData.write);
        pData.swap();
        //gl.bindTexture(gl.TEXTURE_2D, null);

    }

    function initPointsData2(pData){
                
        // TODO make initialization only if needed 
        if(false)console.log(`${MYNAME}.initPointsData2()`, pData);
        let gl = mGL;
        // fill data array with random points 
        let {pointDataWidth} = mGpuConfig;
        const {batchSize, seed} = mIterParams.iterations;        
        //let pcount = pointDataWidth*pointDataWidth;
        const pointsDataCount = pointDataWidth*pointDataWidth;
        const pointMaker = qrand2(seed);
        //const pointMaker = mulberry32_2d(seed);
        //const pointMaker = grid_2d([0,0], [0.1, 0.1], 11);
        let coord = getRandomPoints2D(new Float32Array(4*pointsDataCount), pointMaker, pointsDataCount);            
        
        //console.log('pointsCoord: ', pointsCoord);
        gl.bindTexture(gl.TEXTURE_2D, pData.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, pointDataWidth, pointDataWidth,0, gl.RGBA, gl.FLOAT, coord);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);         
        gl.bindTexture(gl.TEXTURE_2D, null);

    }

    function initPointsData(initialData, pointsData){
        
        const gl = mGL;
        let copyProg = AttPrograms.getProgram(gl, 'gpuCopy');        
        copyProg.bind();                
        copyProg.setUniforms({uSrc: initialData})
        gl.viewport(0, 0, pointsData.width, pointsData.height);              
        gl.disable(gl.BLEND);
        copyProg.blit(pointsData.write);
        pointsData.swap();
        
    }
    
    //
    //  called for updated rendering  
    //
    function updateHistogram(){
        
        //if(DEBUG)console.log(`${MYNAME}.updateHistogram()`);
        let gl = mGL;
        let config = mGpuConfig;        
        const {histogram, attractor, groupSampler, coloring, iterations, bufTrans, symmetry} = mIterParams;
        const {pointSize, colorSpeed, colorPhase,colorSign,jitter, pointsAA, pointShape} = coloring; 
        const {accumulate, startCount, iterPerFrame, accumThreshold, batchSize} = iterations;  
        const {transScale, transCenter} = bufTrans;

        const iterUni = attractor.getUniforms();

        if(config.needRestart) {            
            initBuffers(gl);
        }

        const {initialData, pointsData, indexBuffer} = mGpuConfig; 
        
        const accUni = {
            uUseGpu:        true, 
            uColorSpeed:    colorSpeed,
            uColorPhase:    colorPhase,
            uPointSize:     pointSize,
            uColorSign:     colorSign,
            uJitter:        jitter,
            uUsePointsAA:   pointsAA, 
            uPointShape:    PointShapes.getIndex(pointShape),
            uTransScale:    transScale,
            uTransCenter:   transCenter,
            uHistThreshold: accumThreshold,  
            uPixelSizeFactor: (pointSize > 1.) ? (1./(pointSize*pointSize)):1.,           
        };            
        const symUni = {
            uGroupData:     groupSampler,  
            uTransScale:    transScale,
            uTransCenter:   transCenter,
            uMaxIter:       symmetry.maxIter,       
        }

        if(config.needRestart) {            
            config.needRestart = false;
            config.pointsPerIteration = 0;
            initPointsData(initialData, pointsData);            
            for(let k = 0; k  < iterations.startCount; k++){
                iterate(pointsData, iterUni, symUni);
            }
            appendPointsToHistogram(histogram, pointsData, accumulate, accUni, indexBuffer, batchSize);
        }
        
        for(let k = 0; k < iterPerFrame; k++){
            
            if(iterations.batchCount >=  iterations.maxBatchCount) {
                return;
            }
            // do iteration
            iterate(pointsData, iterUni, symUni)
            // render histogram 
            appendPointsToHistogram(histogram, pointsData, accumulate, accUni, indexBuffer, batchSize);

            iterations.batchCount++;
            
        } 
        
    } // function updateHistogram()

    //
    // perform single iteration 
    //
    function iterate(pointsData, iterUni, symUni){
    
        if(DEBUG)console.log(`${MYNAME}.iterate()`);
        const gl = mGL;
        const {attractor} = mIterParams;
        if(false)console.log('symUni: ', symUni);
        gl.disable(gl.BLEND);         
        gl.viewport(0, 0, pointsData.width, pointsData.height);  

        const iterProg = attractor.getIteratorProgram(gl);          
        iterProg.bind();

        iterProg.setUniforms(iterUni);
        iterProg.setUniforms({uPointsData: pointsData.read});
        iterProg.blit(pointsData.write);
        pointsData.swap();            
        if(mIterParams.symmetry.enabled){
            const symProg =  AttPrograms.getProgram(gl, 'symmetrization'); 
            symProg.bind();
            symProg.setUniforms(symUni);
            symProg.setUniforms({uPointsData: pointsData.read});
            symProg.blit(pointsData.write);
            pointsData.swap();                        
        }
    }
    
    //
    //  append points to histogram 
    //
    function appendPointsToHistogram(histogram, pointsData, accumulate, accUni, indexBuffer, batchSize){
        
        if(DEBUG)console.log(`${MYNAME}.appendPointsToHistogram()`);
        let gl = mGL;
        //let batchSize = pointsData.width*pointsData.height;        
        if(accumulate){
            // enable blend to accumulate histogram 
            gl.enable(gl.BLEND);   
            gl.blendFunc(gl.ONE, gl.ONE);        
            gl.blendEquation(gl.FUNC_ADD);
            mGpuConfig.pointsPerIteration += batchSize;
        } else {
            // discard previous histogram data 
            gl.disable(gl.BLEND); 
            gl.clear(gl.COLOR_BUFFER_BIT);
            mGpuConfig.pointsPerIteration = batchSize;
        }
        const accProg = AttPrograms.getProgram(gl, 'accumulator'); 
        
        accProg.bind();

        accProg.setUniforms({uPointsData: pointsData.read});
        accProg.setUniforms(accUni);

        gl.viewport(0, 0, histogram.width, histogram.height); 
        
        let indexLoc = gl.getAttribLocation(accProg.program, "a_position");
        
        gl.bindBuffer(gl.ARRAY_BUFFER, indexBuffer);
        gl.enableVertexAttribArray(indexLoc);
        gl.vertexAttribPointer(indexLoc, 4, gl.UNSIGNED_SHORT, false, 0, 0);

        gl.bindFramebuffer(gl.FRAMEBUFFER, histogram.write.fbo);
        accProg.setUniforms({uHistogram: histogram.read});                    

        gl.drawArrays(gl.POINTS, 0, batchSize);        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        if(mIterParams.symmetry.useCrown){
            appendCrownPoints(histogram, pointsData, accUni, indexBuffer, batchSize);
        }
        
        histogram.swap();
        
        // copy histogram into back buffer         
        let copyProg = AttPrograms.getProgram(gl, 'gpuCopy');        
        copyProg.bind();                
        copyProg.setUniforms({uSrc: histogram.read})
        gl.viewport(0, 0, histogram.width, histogram.height);              
        gl.disable(gl.BLEND);
        copyProg.blit(histogram.write);
        histogram.swap();
        
    } // function appendPointsToHistogram()

    function appendCrownPoints(histogram, pointsData, accUni, indexBuffer, batchSize){
        
        //console.log(`${MYNAME}.appendCrownPoints()`, accUni);
        const gl = mGL;
        const prog = AttPrograms.getProgram(gl, 'accumulator_crown'); 
        prog.bind();

        prog.setUniforms(accUni);
        let cUni = {
            uGroupData: mIterParams.groupSampler,
            uPointsData: pointsData.read, 
            uHistogram:  histogram.read,
            uShellThickness: mIterParams.symmetry.shellThickness,
        }
        prog.setUniforms(cUni);
        
        let indexLoc = gl.getAttribLocation(prog.program, "a_position");
        gl.bindBuffer(gl.ARRAY_BUFFER, indexBuffer);
        gl.enableVertexAttribArray(indexLoc);
        gl.vertexAttribPointer(indexLoc, 4, gl.UNSIGNED_SHORT, false, 0, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, histogram.write.fbo);
        const genCount = mIterParams.group.getGeneratorsCount();
        
        for(let i = 0; i < genCount; i++){
            prog.setUniforms({uTransformIndex:i})
            gl.drawArrays(gl.POINTS, 0, batchSize);        
        }
                
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
    } // function appendCrownPoints

    
    return {
    
        init:           init,
        restart:        restart,
        updateHistogram: updateHistogram,
        getPointsCount:  () => {return mGpuConfig.pointsPerIteration;}        
    }
} 


//
// makes GL buffer from index array 
//
function makeIndexBuffer(gl, array){

    /*
    const array = new Uint16Array(2 * width * width);
      for (let i = 0, y = 0; y < width; y++) {
        for (let x = 0; x < width; x++) {
          array[i++] = x;
          array[i++] = y;
        }
      }
      */
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      return buffer;
}

function makeIndexArray(width, elemCount){
    
    // we store 4 elements per pixel to be compatible with CPU rendering 
    // where we store [x,y,value,index]
    const array = new Uint16Array(4 * elemCount);
    
    for(let i = 0, j = 0; i < elemCount; i++, j+=4){
        
        let y = Math.trunc(i/ width); 
        let x = i % width;
        array[j]     = x;
        array[j + 1] = y; 
        //array[j + 2] = 0; // unused 
        //array[j + 3] = 0;        
    }
    return array;
}

function printBufferData(gl, buffer){

        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.fbo);
        let att =  gl.COLOR_ATTACHMENT0;
        let x = 0;
        let y = 0;
        let width = buffer.width;
        let height = buffer.height;
        let data = readPixelsFromBuffer(gl, att, x, y, width, height);
        //let length = data.length/4;
        
        for(let iy = 0; iy < heigtht; iy++){
            let line = '';
            for(let ix = 0; ix < width; ix++){
                let ind = 4*(ix + iy*width);
                let x = data[ind];
                let y = data[ind+1];
                line += x.toFixed(2);line += ' '
                line += y.toFixed(2);line += '; '
            }
            console.log('',iy,':', line);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
