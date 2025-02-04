export const GL_reset = 
`
in vec2 vUv;
out vec4 outValue;

uniform float uNoiseForce;
uniform float uNoiseOffset;
uniform int   uNoiseCell;


void main(){  

  ivec2 I = ivec2(gl_FragCoord.xy);
  I /= uNoiseCell;
 
  outValue =  vec4(uNoiseForce*(hash(I.xyy) + uNoiseOffset * vec3(1.,1.,1.)),1);
}
`;
