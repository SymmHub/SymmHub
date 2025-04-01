export const copyShader = 
`    
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uInput;
uniform float uMipmapLevel;

void main () {    
    vec2 p = vUv; 
    //vec4 c = texture(uInput, p);      
    float level = uMipmapLevel;
    vec4 c = textureLod(uInput, p, level);      
    // outColor = vec4(0.5, c.rg, 1.);
    outColor = c;//vec4(1., 1., 0., 1.);//
}
`;
