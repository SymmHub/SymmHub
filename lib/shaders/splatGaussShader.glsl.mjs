export const splatGaussShader = 
`
in vec2 vUv;
out vec4 FRAG_COLOR;


uniform vec4 color;
uniform vec2 point;
uniform float radius;

void main () {
    vec2 p = vUv - point.xy;
    
    float splat = exp(-dot(p, p) / (radius*radius));
        
    FRAG_COLOR = splat*color;
    
}
`;
