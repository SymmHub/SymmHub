import {    
    makeBufferRenderer, 
    EventDispatcher,
    createDoubleFBO, 
    
} from './modules.js';


const MYNAME = 'Patterns';
const DEBUG = true;

function Patterns(options){
    
    let eventDispatcher = new EventDispatcher();
    
    
    function addEventListener( evtType, listener ){        
        if(DEBUG)console.log(`${MYNAME}.addEventListener()`, evtType);
        eventDispatcher .addEventListener( evtType, listener );      
    };

    function setGroup(group) {
        
      if(DEBUG)console.log(`${MYNAME}.setGroup()`, group );
      
    };

    let buffer;
    
    function initBuffer(glContext) {
    
      const gl = glContext.gl;
        
      const bufWidth = 2048;
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
      
      const buffer = createDoubleFBO( gl, bufWidth, bufHeight, intFormat, format, texType, filtering );

      return buffer;
    }

    
    
    function init(glContext) {
        
        buffer = initBuffer(glContext);
        
    }
    
    let bufferRenderer = null;
    
    function renderBuffer(opt){
        let gl = opt.gl;
        let time = (opt.animationTime)? opt.animationTime: 0;
        
        //console.log('renderBuffer(), time:', time);
        
        if(!bufferRenderer){
            // prepare program 
            bufferRenderer = makeBufferRenderer(gl);
        } else {
            gl.viewport(0, 0, buffer.width, buffer.height);          
            bufferRenderer.bind();                        
            let uni = {
                uTime: time, 
            }                    
            bufferRenderer.setUniforms(uni);            
            gl.disable(gl.BLEND);        

            bufferRenderer.blit(buffer.read);  
            //buffer.swap();           
        }                
    }

    return {
        getName         : () => MYNAME,
        addEventListener: addEventListener, 
        setGroup        : setGroup, 
        init            : init,
        getSimBuffer    : () => buffer,
        render          : renderBuffer,
        get canAnimate() {return true;},
    };
}
    
//
//  factory of paterns
//
const PatternsCreator = {
    //
    create:         ()=> {return Patterns();},
    getName:        () => {return `${MYNAME}-factory`;},
    getClassName:   ()=>{return `${MYNAME}-class`;}
    
}


export {PatternsCreator}