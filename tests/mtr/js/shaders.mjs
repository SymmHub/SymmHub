const VERT_SRC = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;


const FRAG_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
layout(location = 0) out vec4 outColor0;
layout(location = 1) out vec4 outColor1;
layout(location = 2) out vec4 outColor2;

//
//  convert signed short into vec2 represended as ubute
//
vec2 s2v2(int s){
  int b0 = (s & 255);
  int b1 = (s >> 8) & 255;
  return vec2(float(b0)/255., float(b1)/255.);
}


void main() {

  vec2 pnt = gl_FragCoord.xy;
  
  outColor0 = vec4(v_uv.x, 0,0.0, 1.0); // texture 1: horz gradient
  outColor1 = vec4(0.,     v_uv.y, 0.0, 1.0);     // texture 0: vert gradient
  
  int ix = int(pnt.x) << 10;
  int iy = int(pnt.y) << 10;
  
  outColor2 = vec4(s2v2(1024+ix), s2v2(4096+iy));
  
}
`;

const DISPLAY_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 outColor;
void main() {
  outColor = texture(u_tex, v_uv);
}
`;


export const Shaders = {
    vert: VERT_SRC,
    frag: FRAG_SRC,
    display: DISPLAY_FS,
};