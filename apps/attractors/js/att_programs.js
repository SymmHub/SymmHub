import {
    Shaders as AttShaders,    
} from './shaders/modules.js';

import {
    buildProgramsCached,
    LibShaders,
} from './modules.js';

const MYNAME = 'att_programs';

const complexFrag = {obj:LibShaders, id:'complex'};
const isplaneFrag = {obj:LibShaders, id: 'isplane'};
const inversiveSamplerFrag = {obj:LibShaders, id: 'inversiveSampler'};


const attUtils              = {obj:AttShaders, id:'utils'};
const overlay               = {obj:AttShaders, id:'extract_overlay'};
const drawHistVert          = {obj:AttShaders, id:'draw_hist_vert'};
const drawHistFrag          = {obj:AttShaders, id:'draw_hist_frag'};
const blitVert              = {obj:AttShaders, id:'blit_vert'};
const initQrand2Frag        = {obj:AttShaders, id:'init_qrand2_frag'};
const accumulatorCpuVert    = {obj:AttShaders, id:'accumulator_cpu_vert'};
const accumulatorGpuVert    = {obj:AttShaders, id:'accumulator_gpu_vert' };
const accumulatorFrag       = {obj:AttShaders, id:'accumulator_frag' };
const iteratorVert          = {obj:AttShaders, id:'iterator_vert' };
const iteratorFrag          = {obj:AttShaders, id:'iterator_frag' };
const copyVert              = {obj:AttShaders, id:'copy_vert' };
const copyFrag              = {obj:AttShaders, id:'copy_frag' };
const symmetrizationVert    = {obj:AttShaders, id:'symmetrization_vert' };
const symmetrizationFrag    = {obj:AttShaders, id:'symmetrization_frag' };



const cpuAccumulator = {
    name: 'cpuAccumulator', 
    vs: {frags:[complexFrag, attUtils, accumulatorCpuVert]}, 
    fs: {frags: [accumulatorFrag]},
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
    vs: {frags:[iteratorVert]},
    fs: {frags:[iteratorFrag]},
}

const gpuCopy = {
    name: 'gpuCopy',
    vs: {frags:[copyVert]},
    fs: {frags:[copyFrag]},
}

const gpuAccumulator = {
    name: 'gpuAccumulator',
    vs: {frags:[complexFrag, attUtils, accumulatorGpuVert]},
    //vs: {frags:[blitVert]},
    fs: {frags:[accumulatorFrag]},
}


const symmetrization = {
    name: 'symmetrization',
    vs: {frags:[symmetrizationVert]},
    //vs: {frags:[blitVert]},
    fs: {frags:[isplaneFrag, inversiveSamplerFrag, complexFrag, symmetrizationFrag]},    
}


function programBuilder(){

    const programs = {
        cpuAccumulator:  cpuAccumulator,
        histogramRenderer: histogramRenderer, 
        gpuAccumulator,
        gpuInitializer,
        gpuIterator,
        gpuCopy,
        symmetrization,
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
