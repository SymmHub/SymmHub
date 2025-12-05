import {vert_main}              from './vert_main.glsl.mjs';
import {frag_main }             from './frag_main.glsl.mjs';
import {draw_points_vert }      from './draw_points_vert.glsl.mjs';
import {draw_points_frag }      from './draw_points_frag.glsl.mjs';
import {cpu_accumulator_vert }  from './cpu_accumulator_vert.glsl.mjs';
import {cpu_accumulator_frag }  from './cpu_accumulator_frag.glsl.mjs';
import {draw_hist_vert }        from './draw_hist_vert.glsl.mjs';
import {draw_hist_frag }        from './draw_hist_frag.glsl.mjs';
import {utils}                  from './utils.glsl.mjs';
import {extract_overlay}        from './extract_overlay.glsl.mjs';
import {blit_vert}              from './blit_vert.glsl.mjs';
import {init_qrand2_frag}       from './init_qrand2_frag.glsl.mjs';
import {
    gpu_accumulator_vert,
    gpu_accumulator_frag
}   from './gpu_accumulator.glsl.mjs';
import {
    gpu_iterator_vert,
    gpu_iterator_frag
}   from './gpu_iterator.glsl.mjs';



const MYNAME = import.meta.url;

export const Shaders = {
    
    getName:  () => {return MYNAME;},
    
    utils:                  utils,
    blit_vert:              blit_vert,
    extract_overlay:        extract_overlay,
    init_qrand2_frag:       init_qrand2_frag,
    vertMain:               vert_main,
    fragMain:               frag_main, 
    drawPointsVert:         draw_points_vert, 
    drawPointsFrag:         draw_points_frag,     
    cpu_accumulator_vert:   cpu_accumulator_vert,
    cpu_accumulator_frag:   cpu_accumulator_frag,
    draw_hist_vert:         draw_hist_vert,
    draw_hist_frag:         draw_hist_frag,
    gpu_accumulator_vert:   gpu_accumulator_vert,
    gpu_accumulator_frag:   gpu_accumulator_frag,
    gpu_iterator_vert:      gpu_iterator_vert,
    gpu_iterator_frag:      gpu_iterator_frag,
    
    
}
