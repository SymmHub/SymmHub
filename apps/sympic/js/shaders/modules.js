import {renderImage} from './renderImage.glsl.mjs';

const MYNAME = import.meta.url;

export const Shaders = {
    
    getName:  () => {return MYNAME;},
    renderImage:    renderImage,
    
    
}
