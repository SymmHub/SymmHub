export const vertexShader = 
`
precision highp float;

VS_IN vec2 position;
VS_OUT vec2 vUv;

uniform float uAspect;
uniform float uScale;
uniform vec2 uCenter;

void main () {
    
    // position.xy in rangle [-1,1] 
	  vUv = uScale*position.xy*vec2(1.,uAspect) + uCenter;

    gl_Position = vec4(position, 0, 1.);
    
}
`;