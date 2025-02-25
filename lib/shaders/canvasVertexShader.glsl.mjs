export const canvasVertexShader = 
`
precision highp float;

in vec2 position;
out vec2 vUv;

uniform float u_aspect;
uniform float u_scale;
uniform vec2 u_center;

void main () {
    
    // position.xy in range [-1,1] 
	  vUv = u_scale*position.xy*vec2(1.,u_aspect) + u_center;

    gl_Position = vec4(position, 0, 1.);
    
}
`;