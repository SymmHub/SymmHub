//
//  general shaders 
//
import {canvasVertexShader}      from './canvasVertexShader.glsl.mjs';
import {overlayExtractorShader}      from './overlayExtractorShader.glsl.mjs';


const ShaderFragments = {
    getName: () => {return 'ShaderFragments'},
    canvasVertexShader,    
    overlayExtractorShader,
};

export {
  ShaderFragments
} 
