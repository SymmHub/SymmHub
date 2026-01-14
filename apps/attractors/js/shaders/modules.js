import {vert_main}              from './vert_main.glsl.mjs';
import {frag_main }             from './frag_main.glsl.mjs';
import {draw_points_vert }      from './draw_points_vert.glsl.mjs';
import {draw_points_frag }      from './draw_points_frag.glsl.mjs';
import {draw_hist_vert }        from './draw_hist_vert.glsl.mjs';
import {draw_hist_frag }        from './draw_hist_frag.glsl.mjs';
import {utils}                  from './utils.glsl.mjs';
import {extract_overlay}        from './extract_overlay.glsl.mjs';
import {blit_vert}              from './blit_vert.glsl.mjs';
import {init_qrand2_frag}       from './init_qrand2_frag.glsl.mjs';

import {
    accumulator_cpu_vert,
    accumulator_gpu_vert,
    accumulator_frag
}  from './accumulator.glsl.mjs';

import {
    iterator_vert,
    iterator_frag
}   from './iterator.glsl.mjs';
import {
    copy_vert,
    copy_frag
}   from './copy.glsl.mjs';

import {
    symmetrization_vert,
    symmetrization_frag
}   from './symmetrization.glsl.mjs';



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
    draw_hist_vert:         draw_hist_vert,
    draw_hist_frag:         draw_hist_frag,
    accumulator_cpu_vert:   accumulator_cpu_vert,
    accumulator_gpu_vert:   accumulator_gpu_vert,
    accumulator_frag:       accumulator_frag,
    iterator_vert:          iterator_vert,
    iterator_frag:          iterator_frag,
    copy_vert:              copy_vert,
    copy_frag:              copy_frag,
    symmetrization_vert:    symmetrization_vert,
    symmetrization_frag:    symmetrization_frag,
};
