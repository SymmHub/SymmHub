import {renderImage} from './renderImage.glsl.mjs';
import {colorImageArray} from './colorImageArray.glsl.mjs';
import {permutations} from './permutations.glsl.mjs';


const MYNAME = import.meta.url;

export const Shaders = {  
    getName:            () => {return MYNAME;},
    renderImage:        renderImage,
    colorImageArray:    colorImageArray,
    permutations:       permutations,
};
