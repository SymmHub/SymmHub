
import {
    Shaders,
    buildProgramsCached,
    createFBO,
    getWebGLContext,
    resizeCanvas,
    setCanvasSize,
} from './modules.js';

function test_mtr3() {
    
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
    
    let twidth = 500, theight = 500;
    
    setCanvasSize(canvas, 3*twidth, theight);

    let backBuffer = createFBO(gl, 3*twidth, theight, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE,gl.NEAREST);
    
    const renderBuffer = createFBO(gl, twidth, theight, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE,gl.NEAREST, 3);
    
    let startTime = Date.now();
    requestAnimationFrame(renderFrame);
        
    function texSize(t){
        
         let s = 388 + 200*Math.sin(0.1* t);
          return Math.round(s);
    }
    
    function renderFrame(){
        
        let time = (Date.now()-startTime)/1000.; 
        let w = texSize(time);
        twidth = w;
        theight = w;
        setCanvasSize(canvas, 3*twidth, theight);
        
        resizeCanvas(canvas);
        renderBuffer.resize(twidth, theight);
        let prog = programs.mtr.program;
        prog.bind();
                
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error("Framebuffer incomplete");
        }
        prog.setUniforms({u_time: time});
        gl.viewport(0, 0, twidth, twidth);
        prog.blit(renderBuffer);
        
        const displayProg = programs.display.program; 
        displayProg.bind();        
        backBuffer.resize(3*twidth, theight);
        for(let i = 0; i < 3; i++){
            gl.viewport(i*twidth, 0, twidth, twidth);
            let tex = renderBuffer.textures[i];
            displayProg.setUniforms({u_tex: tex});
            displayProg.blit(backBuffer);
        }
        
        const drawBuff = programs.drawBuff.program; 
        drawBuff.bind();
        drawBuff.setUniforms({u_tex:backBuffer});
        gl.viewport(0, 0, 3*twidth, twidth);
        drawBuff.blit(null);
        if(time < 50.) requestAnimationFrame(renderFrame);
        
    }           
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

test_mtr3();
