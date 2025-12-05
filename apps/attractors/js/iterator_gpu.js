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
        pointDataWidth: 256,//(1 << 10),
    };
    let mGL = null;
    let mConfig = null;
    
    function init(gl, config){
    
        if(DEBUG) console.log(`${MYNAME}.init()`);
        mGL = gl;
        mConfig = config;
        
        initBuffers(gl);
        
    }
    
    function initBuffers(gl){
    
        const {pointDataWidth} = mGpuConfig;
        
        let accProg = AttPrograms.getProgram(gl, 'gpuAccumulator'); 
        mGpuConfig.posLoc = gl.getAttribLocation(accProg.program, "a_position");
        console.log('accProg: ', accProg); 
        
        if(DEBUG)console.log('${MYNAME}.initBuffers() pointDataWidth:', pointDataWidth);
        mGpuConfig.indexBuffer = makeIndexBuffer(gl, pointDataWidth);
                
        mGpuConfig.pointsData = createDoubleFBO( gl, pointDataWidth, pointDataWidth, 
                                        gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
                                        
    }
    
    
    function restart(){
    
        if(DEBUG) console.log(`${MYNAME}.restart() pointDataWidth: `, mGpuConfig.pointDataWidth);
        let gl = mGL;
        let gcfg = mGpuConfig;
        
        gcfg.iterProg = AttPrograms.getProgram(gl, 'gpuIterator');          
        gcfg.accProg = AttPrograms.getProgram(gl, 'gpuAccumulator'); 
        gcfg.posLoc = gl.getAttribLocation(gcfg.accProg.program, "a_position");

        const {pointsData} = mGpuConfig;
        
        initPointsData(pointsData);
        
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
    
    
    
    function updateHistogram(){
        
        if(DEBUG)console.log(`${MYNAME}.updateHistogram()`);
        let gl = mGL;
        
        const cfg = mConfig;
        const {state} = cfg;
        const icfg = cfg.iterations;
        cfg.state.needToRender = icfg.isRunning;
        let {iterPerFrame,batchCount, startCount} = icfg;         
        const {histogram} = state;
        let ccfg = cfg.coloring;
        
        const {
            pointsData, 
            indexBuffer, 
            pointDataWidth, 
            iterProg, 
            accProg,
            posLoc,
        } = mGpuConfig; 
        
        let batchSize = pointDataWidth*pointDataWidth;        

        const accColoringUni = {
          colorSpeed:   ccfg.colorSpeed,
          colorPhase:   ccfg.colorPhase,
          uPointSize:    ccfg.pointSize,
          colorSign:    ccfg.colorSign,
          jitter:       ccfg.jitter,
          resolution:   [histogram.width, histogram.height],
          uAttScale:    cfg.bufTrans.transScale,
          uAttCenter:   cfg.bufTrans.transCenter,
        };

        let iterUni2 = state.attractor.getUniforms();
        //iterProg.setUniforms(iterUni2);

                
        for(let k = 0; k < iterPerFrame; k++){
            
            // do iteration 
            
            iterProg.bind();
            gl.viewport(0, 0, pointDataWidth, pointDataWidth);  
            let iterUni = {uPointsData: pointsData.read};
            iterProg.setUniforms(iterUni);
            iterProg.setUniforms(iterUni2);
            iterProg.blit(pointsData.write);
            pointsData.swap();
                           
            // render data into histogram 
            
            if(icfg.accumulate && (batchCount > startCount)){
                // enable blend to accumulate histogram 
                gl.enable(gl.BLEND);   
                gl.blendFunc(gl.ONE, gl.ONE);        
                gl.blendEquation(gl.FUNC_ADD);
                state.totalCount += batchSize;
            } else {
                // discard previous histogram data 
                gl.disable(gl.BLEND); 
                gl.clear(gl.COLOR_BUFFER_BIT);
                state.totalCount = batchSize;
            }
            let accUni = {
                uPointsData: pointsData.read,
            };
            

            accProg.bind();
            accProg.setUniforms(accUni);
            accProg.setUniforms(accColoringUni);
            
            gl.viewport(0, 0, histogram.width, histogram.height);    
                        
            gl.bindBuffer(gl.ARRAY_BUFFER, indexBuffer);
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 2, gl.UNSIGNED_SHORT, false, 0, 0);

            gl.bindFramebuffer(gl.FRAMEBUFFER, histogram.fbo);
            gl.drawArrays(gl.POINTS, 0, batchSize);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } // for(let k = 0; k < iterPerFrame; k++){    
    
    } // function updateHistogram()

    
    return {
    
        init:           init,
        restart:        restart,
        updateHistogram: updateHistogram,
        
    }
} 


//
// makes array of indices to be used for rendering points stored in a 2D sampler             
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
