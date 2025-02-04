export const drawTextureShader = 
`
in vec2 vUv;
out vec4 outColor;


uniform float uPixelSize; 

uniform vec2 u_texCenter;
uniform vec2 u_texScale;
uniform sampler2D u_texture;
uniform float u_texAlpha;

void main () {
  
    vec2 p = vUv;
        
    vec4 color = u_texAlpha*getTexture(p, u_texture, u_texScale, u_texCenter, uPixelSize);
        
    outColor = color;
    //outColor = vec4(1.,0.5, 0.3, 1.);
    
}
`;
