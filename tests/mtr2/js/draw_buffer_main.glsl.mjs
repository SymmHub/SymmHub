export const DRAW_BUFF = `
uniform sampler2D u_tex;
out vec4 outColor;
void main() {
  outColor = texelFetch(u_tex, ivec2(gl_FragCoord.xy),0);
}
`;
