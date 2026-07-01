import {renderImage} from './renderImage.glsl.mjs';
import {colorImageArray} from './colorImageArray.glsl.mjs';
import {colorTiles} from './colorTiles.glsl.mjs';
import {permutations} from './permutations.glsl.mjs';
import {permutations24} from './permutations24.glsl.mjs';
import {colorUtils} from './color_utils.glsl.mjs';


const MYNAME = import.meta.url;

export const Shaders = {  
    getName:            () => {return MYNAME;},
    renderImage:        renderImage,
    colorImageArray:    colorImageArray,
    colorTiles:         colorTiles,
    permutations:       permutations,
    permutations24:     permutations24, 
    colorUtils:         colorUtils,
};
