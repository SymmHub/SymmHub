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
import {bufferToScreenImage}     from './bufferToScreenImage.glsl.mjs';
import {bufferToScreenImageArray} from './bufferToScreenImageArray.glsl.mjs';
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
import {maskShader}               from './maskShader.glsl.mjs';
// overlay items (VisualizationOverlay): shared prologue and main, one fragment per item kind
import {OVERLAY_PRE}              from './overlay_pre.glsl.mjs';
import {OVERLAY_MAIN}             from './overlay_main.glsl.mjs';
import {OVERLAY_ISOLINES}         from './overlay_isolines.glsl.mjs';
import {OVERLAY_TILING}           from './overlay_tiling.glsl.mjs';
import {OVERLAY_LIMITSET}         from './overlay_limitset.glsl.mjs';
import {OVERLAY_FUNDDOMAIN}       from './overlay_funddomain.glsl.mjs';
import {OVERLAY_GENERATORS}       from './overlay_generators.glsl.mjs';
import {OVERLAY_BUFFER}           from './overlay_buffer.glsl.mjs';
import {OVERLAY_WORLDGRID}        from './overlay_worldgrid.glsl.mjs';
import {OVERLAY_SCREENGRID}       from './overlay_screengrid.glsl.mjs';


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
    bufferToScreenImageArray,
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
    maskShader,
    overlay_pre:        OVERLAY_PRE,
    overlay_main:       OVERLAY_MAIN,
    overlay_isolines:   OVERLAY_ISOLINES,
    overlay_tiling:     OVERLAY_TILING,
    overlay_limitset:   OVERLAY_LIMITSET,
    overlay_funddomain: OVERLAY_FUNDDOMAIN,
    overlay_generators: OVERLAY_GENERATORS,
    overlay_buffer:     OVERLAY_BUFFER,
    overlay_worldgrid:  OVERLAY_WORLDGRID,
    overlay_screengrid: OVERLAY_SCREENGRID,
};

export {
  ShaderFragments
} 
