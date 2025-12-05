// initialize quiad with random points calculated using qrand2
export const init_qrand2_frag = 
`

out vec4 outColor;

uniform float u_resolution;

void main () {
    
   vec2 coord = gl_FragCoord.xy;
   float b = floor(coord.y) * u_resolution + floor(coord.x);
   outColor = vec4(qrand2(b)*2. - 1., 0., 1.);    
   
}
`;
