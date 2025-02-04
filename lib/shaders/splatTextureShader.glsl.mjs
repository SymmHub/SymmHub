
in vec2 vUv;
out vec4 FRAG_COLOR;


uniform float uPixelSize; 

uniform vec2 u_texCenter;
uniform vec2 u_texScale;
uniform sampler2D u_texture;
uniform float u_texAlpha;

void main () {
  
    vec2 p = vUv;
        
    vec4 color = u_texAlpha*getTexture(p, u_texture, u_texScale, u_texCenter, uPixelSize);
        
    FRAG_COLOR = color;
    //FRAG_COLOR = vec4(color.xy, 0., 0.);
    
}
