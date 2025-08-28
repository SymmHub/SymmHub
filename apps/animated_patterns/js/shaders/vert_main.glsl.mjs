export const vert_main = 
`
precision highp float;

in vec2 position;
out vec2 vUv;

void main () {
    
    // position.xy is in range [-1,1] 
    vUv = position.xy;
    gl_Position = vec4(position, 0, 1.);
    
}
`;
