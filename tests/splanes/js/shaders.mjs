const VERT_SRC = `
in vec2 a_pos;
out vec2 vUv;
uniform float u_scale;
uniform float u_aspect;
uniform vec2 u_center;

void main() {
  vUv = u_scale * a_pos * vec2(1., u_aspect) + u_center;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;


const FRAG_GRID1 = 
`
float grid_intensity = 0.1;

// Thick lines 
float grid(vec2 fragCoord, float space, float gridWidth)
{
    vec2 p  = fragCoord - vec2(.5);
    vec2 size = vec2(gridWidth);
    
    vec2 a1 = mod(p - size, space);
    vec2 a2 = mod(p + size, space);
    vec2 a = a2 - a1;
       
    float g = min(a.x, a.y);
    return clamp(g, 0., 1.0);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;

    // Pixel color
    vec3 col = vec3(.9,.9,.9);
    
    // Gradient across screen
    vec2 p = fragCoord.xy;           // Point
	vec2 c = iResolution.xy / 2.0;   // Center
    //col *= (1.0 - length(c - p)/iResolution.x*0.7);
	
    // 2-size grid2
    col *= clamp(grid(fragCoord, 5., 0.7) *  grid(fragCoord, 100., 1.)*grid(fragCoord, 200., 2.0), grid_intensity, 1.0);
    
    // Output to screen
    fragColor = vec4(col,1.0);
}


in vec2 vUv;
layout(location = 0) out vec4 outColor;
void main() {

  vec2 p = vUv;
  mainImage(outColor, p);
  
}
`;

const FRAG_ISO = `
in vec2 vUv;
#define PI (3.1415926)
uniform float u_time;

layout(location = 0) out vec4 outColor;


//#define sfract(x)   min( fract(x)/(1.-fwidth(x)), fract(-(x))/fwidth(x) ) 
float sfract(float x){
    float w = 1.5*fwidth(x);
    //if(w > 1.) return 0.5;
    //return min(fract(x)/(1.-w), fract(-x)/w);
    // v is in [0,1]
    float v = (1. + w) * min(fract(x), fract(-x)/w);
    return mix(0.2, v, max(0., (1.-w*w)));
}

float isolineF(float v) {
    float distToInt = abs(v-round(v));
    //float div = 2.*fwidth(v);
    float div = 2.*length(vec2(dFdx(v), dFdy(v)));
    return smoothstep(max(div, 0.001), 0.0, distToInt);
}

// - Isoline ---------------------------------------------------------
// based on article
// https://iquilezles.org/articles/distance
//
// v0 - start of isolines 
// stp distance between isolines 
// thickness - isolines thickness 
float isoline(float val, float v0, float stp, float thickness) {

    float div = 2.*length(vec2(dFdx(val), dFdy(val)));
    
    float v = abs(mod(val - v0 + stp*0.5, stp)-stp*0.5)/div - 0.1*thickness;
    
    return 1.-smoothstep(0.2,0.8, v);
}

uniform float u_lineWidth;
uniform float u_isoStep;
uniform float u_isoOffset;
uniform vec4 u_lineColor;
uniform vec2 u_direction;

void main() {

  vec2 p = vUv;
  
  float v0 = length(p) + sin(2.*p.x);
  //float v0 = dot(p, u_direction);
           
  float iso = isoline(v0, u_isoOffset, u_isoStep, u_lineWidth);
  
  outColor = u_lineColor *  iso;
  
}
`;

import { GRID_UTIL }        from './grid_util.glsl.mjs';
import { GRID_MAIN }        from './grid_main.glsl.mjs';
import { DRAW_BUFFER_MAIN } from './draw_buffer_main.glsl.mjs';

const DISPLAY_FS = `
in vec2 vUv;
uniform sampler2D u_tex;
out vec4 outColor;
void main() {
  outColor = texture(u_tex, 0.5*vUv + 0.5);
}
`;

// shader to transfer image per pixel 
const DRAW_BUFF = `
uniform sampler2D u_tex;
uniform float u_scaling;
out vec4 outColor;
void main() {
  outColor = texelFetch(u_tex, ivec2(u_scaling*gl_FragCoord.xy),0);
}
`;

const MYNAME = import.meta.url;

export const Shaders = {
    
    name:    MYNAME,
    getName: ()=> {return MYNAME;},
    
    vert:           VERT_SRC,
    isolines:       FRAG_ISO,
    grid_util:      GRID_UTIL,
    grid_main:      GRID_MAIN,
    display:          DISPLAY_FS,
    draw_buffer_main: DRAW_BUFFER_MAIN,
};