//
//  default vertex shader 
//  maps standard quad (-1-1), (1,1)
//  into world coordinates vUv which are used by fragment shaders 
//
export const VERTEX_MAIN = `
in vec2 a_pos;           // 
out vec2 vUv;            // output world coordinates 
uniform float u_scale;   // 
uniform float u_aspect;  // height/width 
uniform vec2 u_center;   // word coordinate of image center

void main() {
  vUv = u_scale * a_pos * vec2(1., u_aspect) + u_center;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;
