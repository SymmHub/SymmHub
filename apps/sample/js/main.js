
import { Group_5splanes } from "../../../lib/grouplib/Group_5splanes.js";
import { EventDispatcher } from "../../../lib/symhublib/EventDispatcher.js";
import { InversiveNavigator } from "../../../lib/symhublib/InversiveNavigator.js";
import { SymRenderer } from "../../../lib/symhublib/SymRenderer.js";
import { createDoubleFBO } from "../../../lib/symhublib/webgl_utils.js";

const createSampleApp = glContext =>
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

  let eventDispatcher = new EventDispatcher();
  const addEventListener = ( evtType, listener ) =>
  {
    eventDispatcher .addEventListener( evtType, listener );
  };

  const setGroup = group =>
  {
    console.log( 'setGroup' );
  };

  return {
    addEventListener, setGroup,
    getBuffer: () => buffer,
  }
}

const createStaticSimulation = createApp => () =>
{
  let app;

  return {
    init            : glContext => app = createApp( glContext ),
    getName         : () => "simName",
    addEventListener: ( evtType, listener ) => app .addEventListener( evtType, listener ),
    setGroup        : group => app .setGroup( group ),
    getSimBuffer    : () => app .getBuffer(),
  };
}

const staticSimFactory = {
  create: createStaticSimulation( createSampleApp ),
  getName: () => "factoryName",
  getClassName: () => "className",
}

try {
  const app = SymRenderer({
      simCreator: staticSimFactory,
      groupMaker:  new Group_5splanes(),
      navigator: new InversiveNavigator(),
  });
  app.run();
  const params = app .getParams();
  params.visualization.colormap.colormap .setValue( 'rainbow' );
} catch (err) {
  console.error('error: ', err);
}