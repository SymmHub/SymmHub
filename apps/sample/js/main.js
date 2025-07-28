
import { 
    Group_5splanes, 
    EventDispatcher,
    InversiveNavigator,
    SymRenderer,
    createDoubleFBO,    
} from "./modules.js";

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

  gl.clearColor( 1, 0.5, 0, 1 );
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, buffer.write.fbo);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, buffer.read.fbo);
  gl.clear(gl.COLOR_BUFFER_BIT);

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
    const init = glContext => buffer = options.initBuffer( glContext );

    return {
      getName         : () => options.name,
      addEventListener, setGroup, init,
      getSimBuffer    : () => buffer,
    };
  }
  const simCreator = {
    create,
    getName: () => `${options.name}-factory`,
    getClassName: () => `${options.name}-class`,
  }
  const app = SymRenderer({
      simCreator,
      groupMaker: options.groupMaker,
      navigator: options.navigator,
  });
  app.run();
  return app;
}

try {
  const app = SymmHubApp( {
    initBuffer,
    name: 'SampleApp',
    groupMaker: new Group_5splanes(),
    navigator: new InversiveNavigator(),
  } );

  // parameters cannot be set in a granular fashion, but a group can be set as a whole
  const visParam = app .getParams() .visualization .getValue();
  console.dir( visParam );
  visParam .colormap .colormap = 'rainbow';
  app .getParams() .visualization .setValue( visParam );
} catch (err) {
  console.error('error: ', err);
}