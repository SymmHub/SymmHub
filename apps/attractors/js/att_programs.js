import {
    Shaders as AttrShaders
} from './shaders/modules.js';

import {
    buildProgramsCached
} from './modules.js';

const MYNAME = 'att_programs';

const cpuAccumulatorVert = {obj:AttrShaders, id:'cpu_accumulator_vert'};
const cpuAccumulatorFrag = {obj:AttrShaders, id:'cpu_accumulator_frag'};
const drawHistVert = {obj:AttrShaders, id:'draw_hist_vert'};
const drawHistFrag = {obj:AttrShaders, id:'draw_hist_frag'};


const cpuAccumulator = {
    name: 'cpuAccumulator', 
    vs: {frags:[cpuAccumulatorVert]}, 
    fs: {frags: [cpuAccumulatorFrag]},
};

const renderHistogram = {
    name: 'drawHist', 
    vs: {frags: [drawHistVert]}, 
    fs: {frags: [drawHistFrag]},
};


function programBuilder(){

    const programs = {
       cpuAccumulator:  cpuAccumulator,
       renderHistogram: renderHistogram,       
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
        else throw new Error('progrma ${progName} not found');
    }
    
    return  {
        getProgram: getProgram,
    }
} // programBuilder


export const AttPrograms = programBuilder();
