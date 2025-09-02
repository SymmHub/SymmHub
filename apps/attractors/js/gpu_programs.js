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

export function makeBufferRenderer(gl){
    console.log('makeBufferRenderer()');
    let result = buildProgramsCached(gl, gPrograms);
    if (!result) {
        throw new Error(`buildProgram() failed,  result: ${result}`);
    } else {
        console.log('makeBufferRenderer() success');        
    }
    return gPrograms.renderBuffer.program;
}