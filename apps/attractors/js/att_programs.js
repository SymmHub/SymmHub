import {
    Shaders as AttrShaders,    
} from './shaders/modules.js';

import {
    buildProgramsCached,
    LibShaders,
} from './modules.js';

const MYNAME = 'att_programs';

const cpuAccumulatorVert = {obj:AttrShaders, id:'cpu_accumulator_vert'};
const cpuAccumulatorFrag = {obj:AttrShaders, id:'cpu_accumulator_frag'};
const drawHistVert = {obj:AttrShaders, id:'draw_hist_vert'};
const drawHistFrag = {obj:AttrShaders, id:'draw_hist_frag'};
const complexFrag = {obj:LibShaders, id:'complex'};


const cpuHistogramBuilder = {
    name: 'cpuHistogramBuilder', 
    vs: {frags:[complexFrag, cpuAccumulatorVert]}, 
    fs: {frags: [cpuAccumulatorFrag]},
};

const histogramRenderer = {
    name: 'histogramRenderer', 
    vs: {frags: [drawHistVert]}, 
    fs: {frags: [drawHistFrag]},
};


function programBuilder(){

    const programs = {
       cpuHistogramBuilder:  cpuHistogramBuilder,
       histogramRenderer: histogramRenderer,       
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
