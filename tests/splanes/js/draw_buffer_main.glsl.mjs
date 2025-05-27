//
// transfer the input buffer with simple pixel scaling 
// 
export const DRAW_BUFFER_MAIN = `
uniform sampler2D u_tex;
uniform float u_scaling;

out vec4 outColor;

void main() {
  outColor = texelFetch(u_tex, ivec2(u_scaling*gl_FragCoord.xy),0);
}
`;
