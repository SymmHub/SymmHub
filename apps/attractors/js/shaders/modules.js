import {vert_main} from './vert_main.glsl.mjs';
import {frag_main } from './frag_main.glsl.mjs';
import {draw_points_vert } from './draw_points_vert.glsl.mjs';
import {draw_points_frag } from './draw_points_frag.glsl.mjs';
import {cpu_accumulator_vert } from './cpu_accumulator_vert.glsl.mjs';
import {cpu_accumulator_frag } from './cpu_accumulator_frag.glsl.mjs';
import {draw_hist_vert } from './draw_hist_vert.glsl.mjs';
import {draw_hist_frag } from './draw_hist_frag.glsl.mjs';


const MYNAME = import.meta.url;

export const Shaders = {
    
    getName:  () => {return MYNAME;},
    vertMain:               vert_main,
    fragMain:               frag_main, 
    drawPointsVert:         draw_points_vert, 
    drawPointsFrag:         draw_points_frag,     
    cpu_accumulator_vert:   cpu_accumulator_vert,
    cpu_accumulator_frag:   cpu_accumulator_frag,
    draw_hist_vert:         draw_hist_vert,
    draw_hist_frag:         draw_hist_frag,
    
    
}
