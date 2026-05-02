import {
    programBuilder
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
};

const gProgs = programBuilder(gPrograms);


export function makeBufferRenderer(gl){
    console.log('makeBufferRenderer()');
    const prog = gProgs.getProgram(gl, 'renderBuffer');
    if (!prog)
        throw new Error(`makeBufferRenderer(): failed to compile renderBuffer program`);
    console.log('makeBufferRenderer() success');
    return prog;
}