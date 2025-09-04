import {    
    getProgram, 
    EventDispatcher,
    createDoubleFBO, 
    DrawAttractor,
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
    
    function initBuffer(glContext) {
    
      const gl = glContext.gl;
        
      const bufWidth = 1024;
      const bufHeight = bufWidth;
      //const filtering = gl.NEAREST;
      const filtering = gl.LINEAR;
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
      
      return createDoubleFBO( gl, bufWidth, bufHeight, intFormat, format, texType, filtering );

    }
    
    
    function init(glContext) {
        
        mRenderedBuffer = initBuffer(glContext);
        mAttractor = DrawAttractor();
        mAttractor.init(glContext);
        
    }
    
    let bufferRenderer = null;
    
    function render(opt){
        
        let gl = opt.gl;
        let time = (opt.animationTime)? opt.animationTime: 0;
        
        if(false)console.log(`${MYNAME}.renderBuffer(), time:`, time);
        
        
        //bufferRenderer = getProgram(gl, 'renderBuffer');
        //gl.viewport(0, 0, mRenderedBuffer.width, mRenderedBuffer.height);   

        mAttractor.render(gl, mRenderedBuffer.read);
                
    }

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