import {    
    EventDispatcher,
    createDoubleFBO, 
    createFBO, 
    CliffordAttractor,
    AttPrograms,
} from './modules.js';


const MYNAME = 'IteratedAttractor';
const DEBUG = true;

function IteratedAttractor(options){
    
    let eventDispatcher = new EventDispatcher();
    
    
    function addEventListener( evtType, listener ){        
        if(DEBUG)console.log(`${MYNAME}.addEventListener()`, evtType);
        eventDispatcher .addEventListener( evtType, listener );      
    };

    function setGroup(group) {
        
      if(DEBUG)console.log(`${MYNAME}.setGroup()`, group );
      
    };

    let mRenderedBuffer;
    let mAttractor;
    let mBufferWidth = 2*1024;
    let mAccumulator;
    let mPosBuffer; // points buffer
    let mPosLoc;
    
    function init(glContext) {

        let gl = glContext.gl;
        
        mAttractor = CliffordAttractor();        
        //mAttractor.initialize(glContext);
        mRenderedBuffer = createImageBuffer(gl, mBufferWidth);
        mAccumulator = createAccumBuffer(gl, mBufferWidth);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, mAccumulator.fbo);
        gl.disable(gl.BLEND);        
        gl.clearColor(0.0, 0.0, 0.0, 0.0);    
        gl.clear(gl.COLOR_BUFFER_BIT);

        if(DEBUG)console.log(`${MYNAME}.init() gl:`,gl);
        
        mPosBuffer = gl.createBuffer();

        let cpuAcc = AttPrograms.getProgram(gl, 'cpuAccumulator');
        
        mPosLoc = gl.getAttribLocation(cpuAcc.program, "a_position");
        
    }
    
    let bufferRenderer = null;
    
    function render(opt){
        
        let gl = opt.gl;
        let time = (opt.animationTime)? opt.animationTime: 0;
        
        if(false)console.log(`${MYNAME}.renderBuffer(), time:`, time);
            
        
        //mAttractor.render(gl, mRenderedBuffer.read);
        let buffer = mRenderedBuffer.read;
        
        if(false)console.log(`${MYNAME}.render() gl: `, gl, buffer);
        
        gl.viewport(0, 0, mAccumulator.width, mAccumulator.height);              
        gl.bindFramebuffer(gl.FRAMEBUFFER, mAccumulator.fbo);

        // enable blend to accumulate histogram 
        gl.enable(gl.BLEND);   
        gl.blendFunc(gl.ONE, gl.ONE);        
        gl.blendEquation(gl.FUNC_ADD);
        
        let cpuAcc = AttPrograms.getProgram(gl, 'cpuAccumulator');
        cpuAcc.bind();
        
        mAttractor.iterate();
        gl.bindBuffer(gl.ARRAY_BUFFER, mPosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mAttractor.getPoints(), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(mPosLoc);
        gl.vertexAttribPointer(mPosLoc, 4, gl.FLOAT, false, 0, 0);
                
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
            scale:      mAttractor.getTotalCount()/(mBufferWidth*mBufferWidth),
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
                       
    } // render()

    return {
        getName         : () => MYNAME,
        addEventListener: addEventListener, 
        setGroup        : setGroup, 
        init            : init,
        getSimBuffer    : () => mRenderedBuffer,
        render          : render,
        get canAnimate() {return true;},
    };
}
    
function createAccumBuffer(gl, width){
        
    const filtering = gl.NEAREST;
    const format = gl.RGBA, intFormat = gl.RGBA32F, texType = gl.FLOAT;        
    return createFBO( gl, width, width, intFormat, format, texType, filtering );

}

function createImageBuffer(gl, width) {

  const filtering = gl.LINEAR;
  const format = gl.RGBA, intFormat = gl.RGBA32F, texType = gl.FLOAT;              
  return createDoubleFBO( gl, width, width, intFormat, format, texType, filtering );

}

    
//
//  factory of iterated attracrtors 
//
const IteratedAttractorCreator = {
    //
    create:         ()=> {return IteratedAttractor();},
    getName:        () => {return `${MYNAME}-factory`;},
    getClassName:   ()=>{return `${MYNAME}-class`;}
    
}


    

export {IteratedAttractorCreator}