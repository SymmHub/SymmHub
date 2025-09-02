import {
    
    buildProgramsCached
    
} from './modules.js';

import {
  Shaders, 
} from './shaders/modules.js';

const vertexMain    = {obj:Shaders, id:'vertMain'};
const fragmentMain  = {obj:Shaders, id:'fragMain'};


const progRenderBuffer = {
    name: 'renderBuffer', 
    vs: {frags:[vertexMain]}, 
    fs: {frags: [fragmentMain]},
};

const gPrograms = {
    renderBuffer: progRenderBuffer,
}

export function buildPrograms(gl, programs){
    console.log('makeBufferRenderer()');
    let result = buildProgramsCached(gl, programs);
    if (!result) {
        throw new Error(`buildProgram() failed,  result: ${result}`);
    } else {
        console.log('makeBufferRenderer() success');        
    }
    programs.isReady = true;
}


export function getProgram(gl, progName){
    
    if( !gPrograms.isReady){
        buildPrograms(gl, gPrograms);
    }
    
    return gPrograms[progName].program;
}