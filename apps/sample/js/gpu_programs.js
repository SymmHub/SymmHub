import {
    
    buildProgramsCached
    
} from './modules.js';


const vertexShaderMainText = 
`
precision highp float;

in vec2 position;
out vec2 vUv;

void main () {
    
    // position.xy is in range [-1,1] 
    vUv = position.xy;

    gl_Position = vec4(position, 0, 1.);
    
}
`;


const fragmentShaderMainText = 
`
in vec2 vUv;
out vec2 outValue;
    
void main(){
    
  outValue = vec2( sin(25.*vUv.x)*cos(36.*vUv.y), sin(25.*vUv.y)*cos(36.*vUv.x));
  //outValue = vec2(1.+vUv.x, 1.+vUv.y);
  
}
`;

const textChunks = {
    getName:  () => {return 'textChunks'},
    vertexShaderMain: vertexShaderMainText,
    fragmentShaderMain: fragmentShaderMainText, 
    
}

const vertexShaderMain    = {obj:textChunks, id:'vertexShaderMain'};
const fragmentShaderMain  = {obj:textChunks, id:'fragmentShaderMain'};


const progRenderBuffer = {
    name: 'renderBuffer', 
    vs: {frags:[vertexShaderMain]}, 
    fs: {frags: [fragmentShaderMain]},
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