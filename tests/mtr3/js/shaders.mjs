const VERT_SRC = `
in vec2 a_pos;
out vec2 v_uv;
void main() {
  //v_uv = a_pos * 0.5 + 0.5;
  v_uv = 1.0*a_pos;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;


const FRAG_SRC = `
in vec2 v_uv;
#define PI (3.1415926)
uniform float u_time;

layout(location = 0) out vec4 outColor0;
layout(location = 1) out vec4 outColor1;
layout(location = 2) out vec4 outColor2;

void main() {

  //vec2 pnt = gl_FragCoord.xy;
  float w = 0.05;
  float phi0 = w*u_time*PI*2.;
  float phi1 = w*u_time*PI*2.*2.+ PI/3.;
  float phi2 = w*u_time*PI*2.*4. + 2.*PI/3.;
  
  vec2 d0 = vec2(cos(phi0), sin(phi0));
  vec2 d1 = vec2(cos(phi1), sin(phi1));
  vec2 d2 = vec2(cos(phi2), sin(phi2));
  
  float v0 = 10.*length(v_uv);
  float v1 = 8.*dot(v_uv, d1);
  float v2 = 6.*length(v_uv);
  v0 -= floor(v0);
  v1 -= floor(v1);
  v2 -= floor(v2);
  
  outColor0 = vec4(v0, 0, 0, 1.); // texture 0
  outColor1 = vec4(v1, v1, 0, 1.);  // texture 1
  outColor2 = vec4(0, v2,  v2, 1.); // texture 2
  
}
`;

const DISPLAY_FS = `
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 outColor;
void main() {
  outColor = texture(u_tex, 0.5*v_uv + 0.5);
}
`;

const DRAW_BUFF = `
uniform sampler2D u_tex;
out vec4 outColor;
void main() {
  outColor = texelFetch(u_tex, ivec2(gl_FragCoord.xy),0);
}
`;

const MYNAME = import.meta.url;

export const Shaders = {
    
    name:    MYNAME,
    getName: ()=> {return MYNAME;},
    
    vert:       VERT_SRC,
    MTR:        FRAG_SRC,
    display:    DISPLAY_FS,
    drawBuff:   DRAW_BUFF,
};