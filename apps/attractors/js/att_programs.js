import {
    Shaders as AttShaders,    
} from './shaders/modules.js';

import {
    buildProgramsCached,
    LibShaders,
} from './modules.js';

const MYNAME = 'att_programs';

const complexFrag =         {obj:LibShaders, id:'complex'};

const attUtils =            {obj:AttShaders, id:'utils'};
const overlay =             {obj:AttShaders, id:'extract_overlay'};
const cpuAccumulatorVert =  {obj:AttShaders, id:'cpu_accumulator_vert'};
const cpuAccumulatorFrag =  {obj:AttShaders, id:'cpu_accumulator_frag'};
const drawHistVert =        {obj:AttShaders, id:'draw_hist_vert'};
const drawHistFrag =        {obj:AttShaders, id:'draw_hist_frag'};
const blitVert         =    {obj:AttShaders, id:'blit_vert'};
const initQrand2Frag    =   {obj:AttShaders, id:'init_qrand2_frag'};
const gpuAccumulatorVert  = {obj:AttShaders, id:'gpu_accumulator_vert' };
const gpuAccumulatorFrag  = {obj:AttShaders, id:'gpu_accumulator_frag' };
const gpuIteratorVert     = {obj:AttShaders, id:'gpu_iterator_vert' };
const gpuIteratorFrag     = {obj:AttShaders, id:'gpu_iterator_frag' };
const gpuCopyVert         = {obj:AttShaders, id:'gpu_copy_vert' };
const gpuCopyFrag         = {obj:AttShaders, id:'gpu_copy_frag' };



const cpuHistogramBuilder = {
    name: 'cpuHistogramBuilder', 
    vs: {frags:[complexFrag, attUtils, cpuAccumulatorVert]}, 
    fs: {frags: [cpuAccumulatorFrag]},
};

const histogramRenderer = {
    name: 'histogramRenderer', 
    vs: {frags: [drawHistVert]}, 
    fs: {frags: [overlay, drawHistFrag]},
};


const gpuInitializer = {
    name: 'gpuInitializer',
    vs: {frags:[blitVert]},
    fs: {frags:[attUtils,initQrand2Frag]},
}

const gpuIterator = {
    name: 'gpuIterator',
    vs: {frags:[gpuIteratorVert]},
    fs: {frags:[gpuIteratorFrag]},
}

const gpuCopy = {
    name: 'gpuCopy',
    vs: {frags:[gpuCopyVert]},
    fs: {frags:[gpuCopyFrag]},
}

const gpuAccumulator = {
    name: 'gpuAccumulator',
    vs: {frags:[complexFrag, attUtils, gpuAccumulatorVert]},
    //vs: {frags:[blitVert]},
    fs: {frags:[gpuAccumulatorFrag]},
}


function programBuilder(){

    const programs = {
        cpuHistogramBuilder:  cpuHistogramBuilder,
        histogramRenderer: histogramRenderer, 
        gpuAccumulator,
        gpuInitializer,
        gpuIterator,
        gpuCopy,
    };
 
    
    function getProgram(gl, progName){
        
        if(false)console.log(`${MYNAME}.getProgram()`, gl, progName);
        
        if(!programs.isReady){
            
            let result = buildProgramsCached(gl, programs);            
            console.log('ready: ', programs);
            programs.isReady = true;            
        }
        let pr = programs[progName];
        if(pr) return pr.program;
        else throw new Error(`program ${progName} not found`);
    }
    
    return  {
        getProgram: getProgram,
    }
} // programBuilder


export const AttPrograms = programBuilder();
