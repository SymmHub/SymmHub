import {vert_main} from './vert_main.glsl.mjs';
import {frag_main } from './frag_main.glsl.mjs';
import {draw_points_vert } from './draw_points_vert.glsl.mjs';
import {draw_points_frag } from './draw_points_frag.glsl.mjs';


const MYNAME = import.meta.url;

export const Shaders = {
    
    getName:  () => {return MYNAME;},
    vertMain:   vert_main,
    fragMain:   frag_main, 
    drawPointsVert:   draw_points_vert, 
    drawPointsFrag:   draw_points_frag,     
}
