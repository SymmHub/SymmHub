import {

   AttPrograms,
   createDoubleFBO,
   readPixelsFromBuffer,
} from './modules.js';


const MYNAME = 'IteratorGPU';


const DEBUG = true;

export function IteratorGPU(gl){

    //
    //  data for CPU calculations 
    //
    const mGpuConfig = {
        
        posLoc:    null,    // location of attribute to pass points to GPU   
        indexBuffer: null,  // points indices 
        pointDataWidth: 300, //60, //125, //(1 << 8),
        pointsPerIteration: 0,
        poinsCoord: null,
    };
    let mGL = null;
    let mIterParams;
    
    function init(gl){
    
        if(DEBUG) console.log(`${MYNAME}.init()`);
        mGL = gl;       
        initBuffers(gl);
        
    }
    
    function initBuffers(gl){
    
        const {pointDataWidth} = mGpuConfig;
        
        //let accProg = AttPrograms.getProgram(gl, 'gpuAccumulator'); 
        //mGpuConfig.posLoc = gl.getAttribLocation(accProg.program, "a_position");
        //console.log('accProg: ', accProg); 
        
        if(DEBUG)console.log('${MYNAME}.initBuffers() pointDataWidth:', pointDataWidth);
        mGpuConfig.indexBuffer = makeIndexBuffer(gl, pointDataWidth);
                
        mGpuConfig.pointsData = createDoubleFBO( gl, pointDataWidth, pointDataWidth, 
                                        gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
                                        
    }
    
    
    function restart(iterParams){
        
        if(DEBUG) console.log(`${MYNAME}.restart() `, iterParams);
        mIterParams = iterParams;
        
        let gl = mGL;
        let gcfg = mGpuConfig;
        
        gcfg.iterProg = AttPrograms.getProgram(gl, 'gpuIterator');          
        gcfg.accProg = AttPrograms.getProgram(gl, 'gpuAccumulator'); 
        //gcfg.posLoc = gl.getAttribLocation(gcfg.accProg.program, "a_position");

        const {pointsData} = mGpuConfig;
        
        initPointsData2(pointsData);
        
        //printBufferData(mGL, pointsData.read);
        //printBufferData(mGL, pointsData.write);
        
        

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

        if(DEBUG)console.log(`${MYNAME}.initPointsData()`, pData);
        let gl = mGL;
        // fill data array with random points 
        let {pointDataWidth, pointsCoord} = mGpuConfig;
        if(!pointsCoord) {
            let pcount = pointDataWidth*pointDataWidth;
            pointsCoord = getRandomPoints2D(pcount);
            mGpuConfig.pointsCoord = pointsCoord;
        }
        gl.bindTexture(gl.TEXTURE_2D, pData.write.texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, pointDataWidth, pointDataWidth, 
                        0, gl.RGBA, gl.FLOAT, pointsCoord);

        pData.swap();
        //gl.bindTexture(gl.TEXTURE_2D, null);

    }
    
    
    //
    //  called when new rendering is needed 
    //
    function updateHistogram(){
        
        if(DEBUG)console.log(`${MYNAME}.updateHistogram()`);
        let gl = mGL;
                
        const {
            histogram, 
            attractor, 
            groupData, 
            coloring,
            iterations,  
            bufTrans,
        } = mIterParams;
                
        const {
            pointsData, 
            indexBuffer, 
            pointDataWidth, 
            iterProg, 
            accProg,
            posLoc,
        } = mGpuConfig; 
        let{ batchCount} = iterations;     
        let batchSize = pointDataWidth*pointDataWidth;        
        mGpuConfig.pointsPerIteration = 0;

        let iterUni2 = attractor.getUniforms();
        //iterProg.setUniforms(iterUni2);
        //if(false)console.log('bufTrans.transScale:', bufTrans.transScale, bufTrans.transCenter);
        if(batchCount == 0) {
            gl.disable(gl.BLEND); 
            iterProg.bind();
            gl.viewport(0, 0, pointDataWidth, pointDataWidth);  
            for(let k = 0; k  < iterations.startCount; k++){
                let iterUni1 = {uPointsData: pointsData.read};
                iterProg.setUniforms(iterUni1);
                iterProg.setUniforms(iterUni2);
                iterProg.blit(pointsData.write);
                pointsData.swap();            
            }
        }
        for(let k = 0; k <= iterations.iterPerFrame; k++){
            if(k > 0) {
                // skip first iteration to display initial state 
                // do iteration 
                gl.disable(gl.BLEND); 
                iterProg.bind();
                gl.viewport(0, 0, pointDataWidth, pointDataWidth);  
                let iterUni1 = {uPointsData: pointsData.read};
                iterProg.setUniforms(iterUni1);
                iterProg.setUniforms(iterUni2);
                iterProg.blit(pointsData.write);
                pointsData.swap();
                //console.log('iterUni1: ',iterUni1);
                //console.log('iterUni2: ',iterUni2);
            }
            // render data into histogram 
            
            if(iterations.accumulate){
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
            let accUni1 = {
                uPointsData: pointsData.read,
            };
            const accUni2 = {
              colorSpeed:   coloring.colorSpeed,
              colorPhase:   coloring.colorPhase,
              uPointSize:   coloring.pointSize,
              colorSign:    coloring.colorSign,
              jitter:       coloring.jitter,
              resolution:   [histogram.width, histogram.height],
              uAttScale:    bufTrans.transScale,
              uAttCenter:   bufTrans.transCenter,
            };            
            
            batchCount++;
            accProg.bind();
            accProg.setUniforms(accUni1);
            accProg.setUniforms(accUni2);
            //console.log('accUni1: ',accUni1);
            //console.log('accUni2: ',accUni2);
            gl.viewport(0, 0, histogram.width, histogram.height);    

            let indexLoc = gl.getAttribLocation(accProg.program, "a_index");
            
            gl.bindBuffer(gl.ARRAY_BUFFER, indexBuffer);
            gl.enableVertexAttribArray(indexLoc);
            gl.vertexAttribPointer(indexLoc, 2, gl.UNSIGNED_SHORT, false, 0, 0);

            gl.bindFramebuffer(gl.FRAMEBUFFER, histogram.fbo);
            gl.drawArrays(gl.POINTS, 0, batchSize);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            //console.log('batchCount: ', batchCount);
        } // for(let k = 0; k < iterPerFrame; k++){    
    
    
    
    } // function updateHistogram()

    
    return {
    
        init:           init,
        restart:        restart,
        updateHistogram: updateHistogram,
        getPointsCount:  () => {return mGpuConfig.pointsPerIteration;}        
    }
} 


//
// makes array of indexes to be used for rendering points stored in a 2D sampler             
//
function makeIndexBuffer(gl, width){

    const array = new Uint16Array(2 * width * width);
      for (let i = 0, y = 0; y < width; y++) {
        for (let x = 0; x < width; x++) {
          array[i++] = x;
          array[i++] = y;
        }
      }
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      return buffer;
}

function printBufferData(gl, buffer){

        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.fbo);
        let att =  gl.COLOR_ATTACHMENT0;
        let x = 0;
        let y = 0;
        let width = buffer.width;
        let height = buffer.height;
        let data = readPixelsFromBuffer(gl, att, x, y, width, height);
        let length = data.length/4;
        
        for(let iy = 0; iy < width; iy++){
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

// two dimensional case 
const g2 = 1.32471795724474602596;
const q0 = 1.0/ g2;
const q1 = 1.0/(g2*g2);


function qrand2x(n) {
    return (0.5 + q0 * n) % 1.;
}

function qrand2y(n) {
    return (0.5 + q1 * n) % 1;
}


function getRandomPoints2D(count){
    let points = new Float32Array(4*count);
    for(let k = 0, i = 0; k < count; k++){
        points[i++] = (2*qrand2x(k)-1);
        points[i++] = (2*qrand2y(k)-1);
        points[i++] = 0;
        points[i++] = 0;        
    }
    return points;
}