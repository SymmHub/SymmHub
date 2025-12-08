// initialize quiad with random points calculated using qrand2
export const init_qrand2_frag = 
`

out vec4 outColor;

uniform float u_resolution;

void main () {
    
   ivec2 coord = ivec2(gl_FragCoord.xy);
   int b = (coord.y) * int(u_resolution) + coord.x;
   outColor = vec4(qrand2i(int(b))*2. - 1., 0., 1.);    
   
}
`;
