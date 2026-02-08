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
import {coloring_hue}           from './coloring.glsl.mjs';

import {
    accumulator_vert,
    accumulator_frag
}  from './accumulator.glsl.mjs';

import {
    accumulator_crown_vert,
}  from './accumulator_crown.glsl.mjs';


import {
    iterator_vert,
}   from './iterator.glsl.mjs';

import {
    iterator_clifford_frag,
}   from './iterator_clifford.glsl.mjs';

import {
    iterator_dejong_frag,
}   from './iterator_dejong.glsl.mjs';

import {
    iterator_tinkerbell_frag,
}   from './iterator_tinkerbell.glsl.mjs';

import {
    iterator_conradi_frag,
}   from './iterator_conradi.glsl.mjs';

import {
    iterator_mandelbrot_frag,
}   from './iterator_mandelbrot.glsl.mjs';

import {
    iterator_field_icons_frag,
}   from './iterator_field_icons.glsl.mjs';

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
    accumulator_vert:       accumulator_vert,
    accumulator_frag:       accumulator_frag,
    accumulator_crown_vert: accumulator_crown_vert,
    
    iterator_vert:          iterator_vert,
    iterator_dejong_frag:   iterator_dejong_frag, 
    iterator_clifford_frag: iterator_clifford_frag, 
    iterator_conradi_frag:  iterator_conradi_frag,
    iterator_tinkerbell_frag:  iterator_tinkerbell_frag,
    iterator_mandelbrot_frag:  iterator_mandelbrot_frag,
    iterator_field_icons_frag: iterator_field_icons_frag,
    
    copy_vert:              copy_vert,
    copy_frag:              copy_frag,
    symmetrization_vert:    symmetrization_vert,
    symmetrization_frag:    symmetrization_frag,
    coloring_hue:           coloring_hue,
};
