//
//  shaders for gray-scott simulation 
//
import {clearShader} from './clearShader.glsl.mjs';
import {grayScottShader} from './grayScottShader.glsl.mjs';
import {gsBrushShader} from './gsBrushShader.glsl.mjs';
import {gsImage2Shader} from './gsImage2Shader.glsl.mjs';
import {gsImageShader} from './gsImageShader.glsl.mjs';
import {gsNoise1Shader} from './gsNoise1Shader.glsl.mjs';
import {screenShader} from './screenShader.glsl.mjs';
import {simplexNoise} from './simplexNoise.glsl.mjs';
import {vertexShader} from './vertexShader.glsl.mjs';


const GSName = 'GrayScottFragments';

const GrayScottFragments = {
  name: GSName,
  getName: ()=>{return GSName;},
  clearShader,
  grayScottShader,
  gsBrushShader,
  gsImage2Shader,
  gsImageShader,
  gsNoise1Shader,
  screenShader,
  simplexNoise, 
  vertexShader,   
};

export {
  GrayScottFragments
} 
