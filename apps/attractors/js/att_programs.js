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
const accumulatorCrownVert  = {obj:AttShaders, id:'accumulator_crown_vert'};
const accumulatorVert       = {obj:AttShaders, id:'accumulator_vert'};
const accumulatorFrag       = {obj:AttShaders, id:'accumulator_frag' };
const iteratorVert          = {obj:AttShaders, id:'iterator_vert' };
const iteratorCliffordFrag  = {obj:AttShaders, id:'iterator_clifford_frag' };
const iteratorDeJongFrag    = {obj:AttShaders, id:'iterator_dejong_frag' };
const iteratorConradiFrag   = {obj:AttShaders, id:'iterator_conradi_frag' };
const iteratorTinkerbellFrag   = {obj:AttShaders, id:'iterator_tinkerbell_frag' };
const iteratorMandelbrotFrag   = {obj:AttShaders, id:'iterator_mandelbrot_frag' };
const iteratorFieldIconsFrag   = {obj:AttShaders, id:'iterator_field_icons_frag' };

const copyVert              = {obj:AttShaders, id:'copy_vert' };
const copyFrag              = {obj:AttShaders, id:'copy_frag' };
const symmetrizationVert    = {obj:AttShaders, id:'symmetrization_vert' };
const symmetrizationFrag    = {obj:AttShaders, id:'symmetrization_frag' };
const coloring_hue          = {obj:AttShaders, id:'coloring_hue' };


const accumulator = {
    name: 'accumulator', 
    vs: {frags:[complexFrag, attUtils, coloring_hue, accumulatorVert]}, 
    fs: {frags: [accumulatorFrag]},
};

const accumulator_crown = {
    name: 'accumulator_crown', 
    vs: {frags:[complexFrag, attUtils, coloring_hue, isplaneFrag, inversiveSamplerFrag, accumulatorCrownVert]}, 
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

const iteratorClifford = {
    name: 'iteratorClifford',
    vs: {frags:[iteratorVert]},
    fs: {frags:[iteratorCliffordFrag]},
}

const iteratorDeJong = {
    name: 'iteratorDeJong',
    vs: {frags:[iteratorVert]},
    fs: {frags:[iteratorDeJongFrag]},
}

const iteratorConradi = {
    name: 'iteratorConradi',
    vs: {frags:[iteratorVert]},
    fs: {frags:[iteratorConradiFrag]},
}

const iteratorTinkerbell = {
    name: 'iteratorTinkerbell',
    vs: {frags:[iteratorVert]},
    fs: {frags:[iteratorTinkerbellFrag]},
}


const iteratorMandelbrot = {
    name: 'iteratorMandelbrot',
    vs: {frags:[iteratorVert]},
    fs: {frags:[iteratorMandelbrotFrag]},
}

const iteratorFieldIcons = {
    name: 'iteratorDeJong',
    vs: {frags:[iteratorVert]},
    fs: {frags:[complexFrag, iteratorFieldIconsFrag]},
}

const gpuCopy = {
    name: 'gpuCopy',
    vs: {frags:[copyVert]},
    fs: {frags:[copyFrag]},
}


const symmetrization = {
    name: 'symmetrization',
    vs: {frags:[symmetrizationVert]},
    //vs: {frags:[blitVert]},
    fs: {frags:[isplaneFrag, inversiveSamplerFrag, complexFrag, symmetrizationFrag]},    
}


function programBuilder(){

    const programs = {
        accumulator_crown:  accumulator_crown,
        accumulator:        accumulator,
        histogramRenderer:  histogramRenderer, 
        gpuInitializer,
        iteratorClifford,
        iteratorDeJong,
        iteratorConradi,
        iteratorTinkerbell,
        iteratorMandelbrot,
        iteratorFieldIcons,
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
