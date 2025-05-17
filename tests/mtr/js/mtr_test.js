import {
    Shaders,
    
} from './shaders.mjs';


import {
    createProgram
} from './util.js';

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2');

if (!gl) {
  alert('WebGL2 not supported');
  throw new Error('WebGL2 not supported');
}


const program = createProgram(gl, Shaders.vert, Shaders.frag);

const posLoc = gl.getAttribLocation(program, 'a_pos');

// Fullscreen quad
const quad = new Float32Array([
  -1, -1, 1, -1, -1, 1,
  -1, 1, 1, -1, 1, 1,
]);
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);


// Create framebuffer and textures
const framebuffer = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

const WIDTH = 400, HEIGHT = 400;
const attachments = [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2];
const textures = [];

function createTexture(width, height, attachment, internalFormat, format, type){
    
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + attachment, gl.TEXTURE_2D, tex, 0);
    return tex;
  
};

textures.push(createTexture(WIDTH, HEIGHT, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE));
textures.push(createTexture(WIDTH, HEIGHT, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE));
textures.push(createTexture(WIDTH, HEIGHT, 2, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE));

gl.drawBuffers(attachments);

if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
  throw new Error("Framebuffer incomplete");
}

// Render to framebuffer
gl.viewport(0, 0, WIDTH, HEIGHT);
gl.useProgram(program);
gl.bindVertexArray(vao);
gl.drawArrays(gl.TRIANGLES, 0, 6);

// Now draw textures to screen for display
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

const displayProg = createProgram(gl, Shaders.vert, Shaders.display);
const texLoc = gl.getUniformLocation(displayProg, 'u_tex');

function renderTexture(tex, x) {
  gl.viewport(x, 0, WIDTH, HEIGHT);
  gl.useProgram(displayProg);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(texLoc, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// Render both textures side by side
renderTexture(textures[0], 0);
renderTexture(textures[1], WIDTH);
renderTexture(textures[2], 2*WIDTH);

//gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
// unbind texture from that framebuffer 
//gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0+2, gl.TEXTURE_2D, null, 0);


for(let i = 0; i < 3; i++){
    let data = readData(25,25,2, 1, textures[i]);
    console.log(`data[${i}]:`, data);
}

for(let i = 0; i < 500; i+=4){
    
    let data = readData(i,i,1, 1, textures[2]);
    console.log(`data[${i}]:`, data[0],data[1],data[2],data[3]);
    
}

function readData(x, y, width, height, tex){
    
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        
    const data = new Uint8Array(4*width*height);
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    gl.readPixels(x, y, width, height, format, type, data);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);

    return data;
}
