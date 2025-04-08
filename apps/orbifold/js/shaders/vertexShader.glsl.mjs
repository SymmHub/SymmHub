export const vertexShader = 
`
VS_IN vec3 position;
VS_OUT vec2 vUV;

uniform float u_aspect;
uniform float u_scale;
uniform vec2 u_center;

void main() {
	gl_Position = vec4( position, 1.0 );
	//no deformation from space into the screen.
	// now what is the texture?
	vUV = u_scale*position.xy*vec2(1.,u_aspect) + u_center;
} 
`;