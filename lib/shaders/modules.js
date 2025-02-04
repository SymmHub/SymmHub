//
//  general shaders for simulation 
//
import {canvasVertexShader}      from './canvasVertexShader.glsl.mjs';
import {colormap}                from './colormap.glsl.mjs';
import {bufferVisualization}     from './bufferVisualization.glsl.mjs';
import {simplexNoise}            from './simplexNoise.glsl.mjs';
import {complex}                 from './complex.glsl.mjs';
import {sdf2d}                   from './sdf2d.glsl.mjs';
import {utils}                   from './utils.glsl.mjs';
import {drawDotShader}           from './drawDotShader.glsl.mjs';
import {drawMultiDotShader}      from './drawMultiDotShader.glsl.mjs';
import {drawSegmentShader}       from './drawSegmentShader.glsl.mjs';
import {inversiveSampler}        from './inversiveSampler.glsl.mjs';
import {isplane}                 from './isplane.glsl.mjs';
import {symSamplerShader}        from './symSamplerShader.glsl.mjs';
import {fundDomainSamplerShader} from './fundDomainSamplerShader.glsl.mjs';
import {addNoiseShader}          from './addNoiseShader.glsl.mjs';
import {bufferToScreen}          from './bufferToScreen.glsl.mjs';
import {bufferToScreenTextured}  from './bufferToScreenTextured.glsl.mjs';
import {bufferBumpmapToScreen}   from './bufferBumpmapToScreen.glsl.mjs';
import {drawSymmetrySampler}     from './drawSymmetrySampler.glsl.mjs';
import {drawTextureShader}       from './drawTextureShader.glsl.mjs';
import {fundDomainShader}        from './fundDomainShader.glsl.mjs';
import {inversive}               from './inversive.glsl.mjs';
import {splatDiskShader}         from './splatDiskShader.glsl.mjs';
import {splatGaussShader}        from './splatGaussShader.glsl.mjs';
import {texture}                 from './texture.glsl.mjs';
import {projection}              from './projection.glsl.mjs';
import {screenShader}         from './screenShader.glsl.mjs';




const ShaderFragments = {
    getName: () => {return 'ShaderFragments'},
    canvasVertexShader,    
    colormap,
    bufferVisualization,
    simplexNoise,
    complex,
    sdf2d,
    utils,
    drawDotShader,
    drawMultiDotShader,
    drawSegmentShader,
    inversiveSampler,
    isplane,
    symSamplerShader,
    fundDomainSamplerShader,
    addNoiseShader,
    bufferToScreen,
    bufferToScreenTextured,
    bufferBumpmapToScreen,
    drawSymmetrySampler,
    drawTextureShader,
    fundDomainShader,
    inversive,
    splatDiskShader,
    splatGaussShader,
    texture,
    projection, 
    screenShader,
};

export {
  ShaderFragments
} 
