import {renderImage} from './renderImage.glsl.mjs';

// the color symmetry shaders (colorImageArray, colorTiles, permutations24,
// colorUtils) are in lib/shaders


const MYNAME = import.meta.url;

export const Shaders = {
    getName:            () => {return MYNAME;},
    renderImage:        renderImage,
};
