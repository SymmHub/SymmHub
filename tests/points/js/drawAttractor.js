import {
    CliffordAttractor
} from './clifford_attractor.js';


console.log('drawAttractor start');

const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2");

// Vertex shader
const vsSource = `#version 300 es
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
const fsSource = `#version 300 es
precision highp float;
in vec3 v_color;
out vec4 outColor;

void main() {
    outColor = vec4(v_color, 1.0); // use per-point color
}`;

// Helper to compile shader
function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
    }
    return shader;
}

// Create program
const vs = compileShader(gl.VERTEX_SHADER, vsSource);
const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
const program = gl.createProgram();
gl.attachShader(program, vs);
gl.attachShader(program, fs);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
}
gl.useProgram(program);

//let data = getDataSquare();
let attr = CliffordAttractor();

// === Setup Position Buffer ===
const posBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
gl.bufferData(gl.ARRAY_BUFFER, attr.getPoints(), gl.STATIC_DRAW);

const posLoc = gl.getAttribLocation(program, "a_position");
gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

// === Setup Color Buffer ===
const colorBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, attr.getColors(), gl.STATIC_DRAW);

const colorLoc = gl.getAttribLocation(program, "a_color");
gl.enableVertexAttribArray(colorLoc);
gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

requestAnimationFrame(drawFrame);
let frameCount = 0;
const FRAME_TIME = (1./60);

function drawFrame(){

    // Clear canvas and draw
   //gl.clearColor(1.0, 1.0, 1.0, 1.0);    
   //gl.clear(gl.COLOR_BUFFER_BIT);
    
    attr.iterate();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, attr.getPoints(), gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, attr.getColors(), gl.STATIC_DRAW);
    
    
    gl.drawArrays(gl.POINTS, 0, attr.getPointsCount());
    if(++frameCount < 120) requestAnimationFrame(drawFrame);
    
}
