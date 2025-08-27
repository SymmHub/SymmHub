import {
    vert_main
} from './vert_main.glsl.mjs';

import {
    frag_main
} from './frag_main.glsl.mjs';

const MYNAME = import.meta.url;

export const Shaders = {
    
    getName:  () => {return MYNAME;},
    vertMain:   vert_main,
    fragMain:   frag_main, 
    
}
