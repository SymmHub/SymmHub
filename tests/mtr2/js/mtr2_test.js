
import {
    Shaders,
    buildProgramsCached,
    createFBO,
    getWebGLContext,
} from './modules.js';

function test_mtr2() {
    
    const canvas = document.getElementById('glcanvas');
    const gl = canvas.getContext('webgl2');

    if (!gl) {
        alert('WebGL2 not supported');
        throw new Error('WebGL2 not supported');
    }
    const fragVert    = { obj:Shaders, id:'vert'};
    const fragMTR     = { obj:Shaders, id:'MTR'};
    const fragDisplay = { obj:Shaders, id:'display'};
    const fragDrawBuff = { obj:Shaders, id:'drawBuff'};
    
    const progMTR = {
        name:   'progMTR', 
        vs:  {frags: [ fragVert]},
        fs:  {frags: [ fragMTR]},  
    };
    const progDisplay = {
        name:   'progDisplay', 
        vs:  {frags: [ fragVert]},
        fs: { frags: [ fragDisplay]},  
    };
    const progDrawBuff = {
        name:   'progDisplay', 
        vs:  {frags: [ fragVert]},
        fs: { frags: [ fragDrawBuff]},  
    };

    const programs = {
        mtr:        progMTR,
        display:    progDisplay,
        drawBuff:   progDrawBuff,
    };
    let res = buildProgramsCached(gl, programs);
    console.log('build programs result: ', res);
    console.log('programs: ', programs);
    
    
    // Create framebuffer and textures
    let twidth = 400, theight = 400;

    const framebuffer = createFBO(gl, twidth, theight, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE,gl.NEAREST);
    framebuffer.addRenderTarget(1);
    framebuffer.addRenderTarget(2);
    let prog = programs.mtr.program;
    prog.bind();
    // tell gl that we will be drawing to those attachments 
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1,gl.COLOR_ATTACHMENT2]);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("Framebuffer incomplete");
    }
    
    prog.blit(framebuffer);
    
    const displayProg = programs.display.program; 
    displayProg.bind();
    let backBuffer = createFBO(gl, 3*twidth, theight, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE,gl.NEAREST);
    
    for(let i = 0; i < 3; i++){
        gl.viewport(i*twidth, 0, twidth, twidth);
        let tex = framebuffer.textures[i];
        displayProg.setUniforms({u_tex: tex});
        displayProg.blit(backBuffer);
    }
    const drawBuff = programs.drawBuff.program; 
    drawBuff.bind();
    drawBuff.setUniforms({u_tex:backBuffer});
    let t0 = Date.now();
    for(let i = 0; i < 1; i++){
        gl.viewport(i*10, i*10, 3*twidth, twidth);
        drawBuff.blit(null);
    }
    console.log('drawBuff time: ', (Date.now() - t0));
        
    let startTime = Date.now();

    let data = new Uint8Array(4 * 20 * 10);
    for( let k = 0; k < 100; k++){
        // read textures data 
        for (let i = 0; i < 3; i++) {
            data = readDataRGBA8(gl, 25, 25, 20, 10, framebuffer.textures[i], data);
            if(k == 1) console.log(`data[${i}]:`, data);
        }
    }

    console.log('time: ', (Date.now() - startTime));

}

function readDataRGBA8(gl, x, y, width, height, tex, data=null) {

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    if(!data) 
        data = new Uint8Array(4 * width * height);
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    gl.readPixels(x, y, width, height, format, type, data);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);

    return data;
}

test_mtr2();
