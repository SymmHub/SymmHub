const MYNAME = 'IteratorGPU';

const DEBUG = true;

export function IteratorGPU(gl){

    //
    //  data for CPU calculations 
    //
    const mGpuConfig = {
        
        histogramBuilder:  'gpuHistogramBuilder',
        posBuffer: null,    // buffer to pass points array to to GPU 
        posLoc:    null,    // location of attribute to pass points to GPU        
    };
    let mGL = null;
    let mConfig = null;
    
    function init(gl, config){
    
        if(DEBUG) console.log(`${MYNAME}.init()`);
        mGL = gl;
        mConfig = config;
    
    }
    
    function restart(){
        
        if(DEBUG) console.log(`${MYNAME}.restart()`);

    }
    
    function updateHistogram(){
        if(DEBUG)console.log(`${MYNAME} updateHistogram()`);
    
    }
    
    return {
    
        init:           init,
        restart:        restart,
        updateHistogram: updateHistogram,
        
    }
}