
import { ISO_MAIN }         from './iso_main.glsl.mjs';
import { ISO_UTIL }         from './iso_util.glsl.mjs';
import { GRID_UTIL }        from './grid_util.glsl.mjs';
import { GRID_MAIN }        from './grid_main.glsl.mjs';
import { SPLANES_MAIN }      from './splanes_main.glsl.mjs';
import { DRAW_BUFFER_MAIN } from './draw_buffer_main.glsl.mjs';
import { VERTEX_MAIN }      from './vertex_main.glsl.mjs';

const DISPLAY_FS = `
in vec2 vUv;
uniform sampler2D u_tex;
out vec4 outColor;
void main() {
  outColor = texture(u_tex, 0.5*vUv + 0.5);
}
`;

const MYNAME = import.meta.url;

export const Shaders = {
    
    name:    MYNAME,
    getName: ()=> {return MYNAME;},
    
    vert:           VERTEX_MAIN,
    iso_util:       ISO_UTIL,
    iso_main:       ISO_MAIN,
    grid_util:      GRID_UTIL,
    grid_main:      GRID_MAIN,
    splanes_main:   SPLANES_MAIN,
    display:          DISPLAY_FS,
    draw_buffer_main: DRAW_BUFFER_MAIN,
};