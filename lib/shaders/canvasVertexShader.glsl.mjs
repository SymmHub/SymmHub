export const canvasVertexShader = 
`
precision highp float;

in vec2 position;
out vec2 vUv;

uniform float uAspect;
uniform float uScale;
uniform vec2 uCenter;

void main () {
    
    // position.xy in range [-1,1] 
	  vUv = uScale*position.xy*vec2(1.,uAspect) + uCenter;

    gl_Position = vec4(position, 0, 1.);
    
}
`;