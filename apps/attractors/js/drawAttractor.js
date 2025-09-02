import {
    CliffordAttractor,
    buildPrograms,
} from './modules.js';

// Vertex shader
const vsSource = 
`
in vec2 a_position;
in vec3 a_color;

out vec3 v_color; // pass to fragment shader

void main() {
    gl_PointSize = 1.; // set size of each point
    vec2 p = a_position * 0.4;
    gl_Position = vec4(p, 0.0, 1.0);
    v_color = a_color;
}`;

// Fragment shader
const fsSource = 
`
precision highp float;
in vec3 v_color;
out vec4 outColor;

void main() {
    //outColor = vec4(v_color, 1.0); // use per-point color
    outColor = vec4(0.,0,1.,1.);
}`;

const MYNAME = 'drawAttractor';

const Shaders = {
    getName:  () => {return MYNAME;},
    vsSource:vsSource,
    fsSource,fsSource,
}
const drawPointsVert = {obj:Shaders, id:'vsSource'};
const drawPointsFrag = {obj:Shaders, id:'fsSource'};
const progPoints = {
    name: 'pointsRenderer', 
    vs: {frags:[drawPointsVert]}, 
    fs: {frags: [drawPointsFrag]},
};

const gPrograms = {
   progPoints,
};

export function DrawAttractor(){
    
    console.log(`${MYNAME}.DrawAttractor()`);

    let posBuffer;
    let colorBuffer;
    
    let mAttractor = CliffordAttractor();
        
    function init(glContext){
        
        let gl = glContext.gl;
        
        console.log(`${MYNAME}.init() gl:`,gl);
        
        buildPrograms(gl, gPrograms);

        //let data = getDataSquare();

        // === Setup Position Buffer ===
        posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mAttractor.getPoints(), gl.STATIC_DRAW);
        let prog = progPoints.program.program;
        console.log(`${MYNAME} progPoints: `, prog);
        
        let posLoc = gl.getAttribLocation(prog, "a_position");
        console.log(`${MYNAME} posLoc: `, posLoc);

        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        // === Setup Color Buffer ===
        colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mAttractor.getColors(), gl.STATIC_DRAW);

        const colorLoc = gl.getAttribLocation(prog, "a_color");
        console.log(`${MYNAME} colorLoc: `, colorLoc);
        
        gl.enableVertexAttribArray(colorLoc);
        gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);
            
    } // function init()
           
    let renderFlag = false;

    function render(gl, buffer){
        
        console.log(`${MYNAME}.render() gl: `, gl, buffer);
        if(renderFlag) 
           return;
       renderFlag = true;
        // Clear canvas and draw
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.read.fbo);
        
        gl.clearColor(1.0, 1.0, 1.0, 1.0);    
        gl.clear(gl.COLOR_BUFFER_BIT);
        let prog = progPoints.program.program;
        gl.useProgram(prog);
        
        mAttractor.iterate();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mAttractor.getPoints(), gl.STATIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mAttractor.getColors(), gl.STATIC_DRAW);       
        gl.drawArrays(gl.POINTS, 0, mAttractor.getPointsCount());
            
    } // function render()
    
    
    return {
        init: init,
        render: render,
    }
}
