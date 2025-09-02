//
//  general shaders for simulation 
//
import {copyShader}              from './copyShader.glsl.mjs';
import {canvasVertexShader}      from './canvasVertexShader.glsl.mjs';
import {colormap}                from './colormap.glsl.mjs';
import {bufferVisColormap}       from './bufferVisColormap.glsl.mjs';
import {bufferVisTextured}       from './bufferVisTextured.glsl.mjs';
import {bufferVisHeightmap}      from './bufferVisHeightmap.glsl.mjs';
import {bufferToScreenColormap}  from './bufferToScreenColormap.glsl.mjs';
import {bufferToScreenImage}    from './bufferToScreenImage.glsl.mjs';
import {bufferToScreenTextured}  from './bufferToScreenTextured.glsl.mjs';
import {bufferToScreenBumpmap}   from './bufferToScreenBumpmap.glsl.mjs';
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
import {drawSymmetrySampler}     from './drawSymmetrySampler.glsl.mjs';
import {drawTextureShader}       from './drawTextureShader.glsl.mjs';
import {fundDomainShader}        from './fundDomainShader.glsl.mjs';
import {inversive}               from './inversive.glsl.mjs';
import {splatDiskShader}         from './splatDiskShader.glsl.mjs';
import {splatGaussShader}        from './splatGaussShader.glsl.mjs';
import {texture}                 from './texture.glsl.mjs';
import {projection}              from './projection_v2.glsl.mjs';
import {screenShader}            from './screenShader.glsl.mjs';
import {texUtils}                from './texUtils.glsl.mjs';
import {ISO_MAIN}                from './iso_main.glsl.mjs';
import {ISO_UTIL}                from './iso_util.glsl.mjs';
import {GRID_UTIL}                from './grid_util.glsl.mjs';


const MYNAME = import.meta.url;

const ShaderFragments = {
    getName: () => {return MYNAME},
    canvasVertexShader,    
    colormap,
    bufferVisColormap,
    bufferVisTextured,
    bufferVisHeightmap,
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
    bufferToScreenImage, 
    bufferToScreenColormap,
    bufferToScreenTextured,
    bufferToScreenBumpmap,
    drawSymmetrySampler,
    drawTextureShader,
    fundDomainShader,
    inversive,
    splatDiskShader,
    splatGaussShader,
    texture,
    projection, 
    screenShader,
    copyShader,
    texUtils,
    iso_main: ISO_MAIN,
    iso_util: ISO_UTIL,
    grid_util: GRID_UTIL,
};

export {
  ShaderFragments
} 
