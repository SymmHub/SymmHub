export const drawSymmetrySampler = 
`
in vec2 vUv;
out vec4 FRAG_COLOR;


uniform float uPixelSize; 

uniform vec2 u_texCenter;
uniform vec2 u_texScale;
uniform sampler2D u_texture;
uniform sampler2D u_groupData;
uniform float u_texAlpha;
uniform int u_iterations; 

void main () {
  
    vec2 p = vUv;
    
//    p = p*vec2(1.,1.2);
    
    vec3 pnt = vec3(p, 0.);
    int inDomain = 0;
    int refcount = 0;
    float scale = 1.;
    
    iToFundamentalDomainSampler(pnt, u_groupData, 0, inDomain, refcount, scale, u_iterations);
    
    vec4 color = u_texAlpha*getTexture(pnt.xy, u_texture, u_texScale, u_texCenter, uPixelSize);
        
    FRAG_COLOR = color;
    
}
`;