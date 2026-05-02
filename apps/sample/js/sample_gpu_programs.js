import {
    programBuilder
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

uniform float uTime;
vec2 deform( in vec2 p, float time )
{
    float a = 0.2;
    p += a*cos( 1.5*p.yx + 1.0*time + vec2(0.1,1.1) );
    p += a*cos( 2.4*p.yx + 1.6*time + vec2(4.5,2.6) );
    p += a*cos( 3.3*p.yx + 1.2*time + vec2(3.2,3.4) );
    p += a*cos( 4.2*p.yx + 1.7*time + vec2(1.8,5.2) );
    p += a*cos( 9.1*p.yx + 1.1*time + vec2(6.3,3.9) );
    
    return p;
}

    
void main(){
    
  //outValue = vec2( sin(25.*vUv.x)*cos(36.*vUv.y), sin(25.*vUv.y)*cos(36.*vUv.x));  
  outValue = deform(10.*vUv, uTime);
  
}
`;

const DEBUG = true;
const MYNAME='gpu_programs';

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
};

const gProgs = programBuilder(gPrograms);


export function makeBufferRenderer(gl){
    if(DEBUG)console.log(`${MYNAME}.makeBufferRenderer()`);
    const prog = gProgs.getProgram(gl, 'renderBuffer');
    if (!prog)
        throw new Error(`makeBufferRenderer(): failed to compile renderBuffer program`);
    console.log('makeBufferRenderer() success');
    return prog;
}