
import { 
    GroupMakerFactory, 
    EventDispatcher,
    InversiveNavigator,
    SymRenderer,
    createDoubleFBO, 
    makeBufferRenderer, 
    makeSamplesArray,
    makePatternData,
} from "./modules.js";

import {
    presets
} from './presets.js';

 
const initBuffer = glContext =>
{
  const gl = glContext.gl;
    
  const simWidth = 512;
  const simHeight = simWidth;
  //const filtering = gl.NEAREST;
  const filtering = gl.LINEAR;
  //ext.formatRGBA.internalFormat, ext.formatRGBA.format, ext.halfFloatTexType, gl.NEAREST
  // compatible formats see twgl / textures.js getTextureInternalFormatInfo()
  // or https://webgl2fundamentals.org/webgl/lessons/webgl-data-textures.html
  // 2 components data 
  const format = gl.RG, intFormat = gl.RG32F, texType = gl.FLOAT;
  //const format = gl.RG, intFormat = gl.RG16F, texType = gl.FLOAT;
  // 4 components data  4 byters per channel 
  //const format = gl.RGBA, intFormat = gl.RGBA32F, texType = gl.FLOAT;        
  // 4 components data, 1 byte per channel 
  //const format = gl.RGBA, intFormat = gl.RGBA, texType = gl.UNSIGNED_BYTE;
  
  const buffer = createDoubleFBO( gl, simWidth, simHeight, intFormat, format, texType, filtering );

  return buffer;
}


const SymmHubApp = options =>
{
  // TODO: validate options

  const create = () =>
  {
    let eventDispatcher = new EventDispatcher();
    const addEventListener = ( evtType, listener ) =>
    {
      eventDispatcher .addEventListener( evtType, listener );
    };

    const setGroup = group =>
    {
      console.log( 'setGroup irrelevant' );
    };

    let buffer;
    let bufferRenderer = null;
    let glContext;
    
    function init(context) {
        
        glContext = context;
        buffer = options.initBuffer( glContext );
        bufferRenderer = makeBufferRenderer(glContext.gl);
        renderBuffer({animationTime:0});
    }
    
    
    function renderBuffer(opt={}){
        
        let gl = glContext.gl;
        let time = (opt.animationTime)? opt.animationTime: 0;
        
        //console.log('renderBuffer(), time:', time);
                
        gl.viewport(0, 0, buffer.width, buffer.height);          
        bufferRenderer.bind();                        
        let uni = {
            uTime: time, 
        }                    
        bufferRenderer.setUniforms(uni);            
        gl.disable(gl.BLEND);        
        bufferRenderer.blit(buffer.read);  

    }

    return {
      getName         : () => options.name,
      addEventListener, 
      setGroup, 
      init,
      getSimBuffer    : () => buffer,
      getPatternData  : () => makePatternData({mainBuffer: buffer}),
      render          : renderBuffer,
      get canAnimate() {return true;},
    };
  }
  const patternCreator = {
    create,
    getName: () => `${options.name}`,
    getClassName: () => `${options.name}`,
  }
  const app = SymRenderer({
      patternCreator,
      groupMakerFactory: options.groupMakerFactory,
      navigator: options.navigator,
      preset:    options.preset,
      samples:   options.samples,
  });
  app.run();
  return app;
}

try {
  const app = SymmHubApp( {
    initBuffer,
    name: 'SampleApp',
    //groupMaker: new Group_5splanes(),
    groupMakerFactory: GroupMakerFactory({defaultName:'Wallpaper'}),
    navigator: new InversiveNavigator(),
    preset: 'presets/par-26-03-04-09-46-44-345.json',
    samples: makeSamplesArray(presets, 'presets/'),

  } );

  // parameters cannot be set in a granular fashion, but a group can be set as a whole
  const visParam = app .getParams() .visualization .getValue();
  console.dir( visParam );
  visParam .colormap .colormap = 'rainbow';
  app .getParams() .visualization .setValue( visParam );
} catch (err) {
  console.error('error: ', err);
}