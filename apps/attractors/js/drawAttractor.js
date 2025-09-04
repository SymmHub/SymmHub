import {
    CliffordAttractor,
    createFBO,
    AttPrograms,
} from './modules.js';

const MYNAME = 'drawAttractor';


const DEBUG = false;

export function DrawAttractor(){
    
    if(DEBUG)console.log(`${MYNAME}.DrawAttractor()`);

    let posBuffer;
    let posLoc;
    let mAccumulator;
    let mAccumulatorWidth = 2048;
    let mAttractor = CliffordAttractor();
        
    function init(glContext){
        
        let gl = glContext.gl;
        
        mAccumulator = createAccumulator(gl, mAccumulatorWidth);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, mAccumulator.fbo);
        gl.disable(gl.BLEND);        
        gl.clearColor(0.0, 0.0, 0.0, 0.0);    
        gl.clear(gl.COLOR_BUFFER_BIT);

        if(DEBUG)console.log(`${MYNAME}.init() gl:`,gl);
        
        posBuffer = gl.createBuffer();

        let cpuAcc = AttPrograms.getProgram(gl, 'cpuAccumulator');
        
        posLoc = gl.getAttribLocation(cpuAcc.program, "a_position");
            
    } // function init()
           
    function render(gl, buffer){
        
        if(DEBUG)console.log(`${MYNAME}.render() gl: `, gl, buffer);
        
        gl.viewport(0, 0, mAccumulator.width, mAccumulator.height);              
        gl.bindFramebuffer(gl.FRAMEBUFFER, mAccumulator.fbo);

        // enable blend to accumulate histogram 
        gl.enable(gl.BLEND);   
        gl.blendFunc(gl.ONE, gl.ONE);        
        gl.blendEquation(gl.FUNC_ADD);
        
        let cpuAcc = AttPrograms.getProgram(gl, 'cpuAccumulator');
        cpuAcc.bind();
        
        mAttractor.iterate();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mAttractor.getPointsCombined(), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 4, gl.FLOAT, false, 0, 0);
                
        let cpuAccUni = {
          colorSpeed:   0.22,
          colorPhase:   Math.PI,
          pointSize:    1,
          colorSign:    1.,
          jitter:        1.25,
          resolution:   [mAccumulator.width, mAccumulator.height],
        };
        cpuAcc.setUniforms(cpuAccUni);
        
        gl.drawArrays(gl.POINTS, 0, mAttractor.getPointsCount());
            
        //gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.fbo);
        
        let histRenderer = AttPrograms.getProgram(gl, 'renderHistogram');        
        gl.viewport(0, 0, buffer.width, buffer.height);  
                
        histRenderer.bind();
        
        let histUni = {
            scale: 1,
            gamma: 2.2,
            contrast: 1, 
            brightness: 0.3,
            saturation: 0.8,
            dynamicRange:0.1,
            invert: false,
            src: mAccumulator,
        };
        
        histRenderer.setUniforms(histUni);
        gl.disable(gl.BLEND);        
        histRenderer.blit(buffer);
               
        
    } // function render()
    
    
    return {
        init: init,
        render: render,
    }
}

/*
scale = (totalPointsCount/bufPointsCount) * props.scaleFactor;


function scaleFactor(scales) {
  const X = scales.x.domain()[1] - scales.x.domain()[0];
  const X0 = scales.xOriginal.domain()[1] - scales.xOriginal.domain()[0];
  const Y = scales.y.domain()[1] - scales.y.domain()[0];
  const Y0 = scales.yOriginal.domain()[1] - scales.yOriginal.domain()[0];
  return (X * Y) / (X0 * Y0);
}        
*/

function createAccumulator(gl, width, ){
        
    const filtering = gl.NEAREST;
    //const filtering = gl.LINEAR;
    //ext.formatRGBA.internalFormat, ext.formatRGBA.format, ext.halfFloatTexType, gl.NEAREST
    // compatible formats see twgl / textures.js getTextureInternalFormatInfo()
    // or https://webgl2fundamentals.org/webgl/lessons/webgl-data-textures.html
    // 2 components data 
    //const format = gl.RG, intFormat = gl.RG32F, texType = gl.FLOAT;
    //const format = gl.RG, intFormat = gl.RG16F, texType = gl.FLOAT;
    // 4 components data  4 byters per channel 
    const format = gl.RGBA, intFormat = gl.RGBA32F, texType = gl.FLOAT;        
    // 4 components data, 1 byte per channel 
    //const format = gl.RGBA, intFormat = gl.RGBA, texType = gl.UNSIGNED_BYTE;
  
    return createFBO( gl, width, width, intFormat, format, texType, filtering );

}
