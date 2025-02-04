export const fundDomainShader = 
`
//
// draws interior of fundamental domain 
// 
// #include 'isplane.glsl' 
// #include 'inversive.glsl' 
//

out vec4 FRAG_COLOR; // output data 

in vec2 vUv; // fs input coming from vertex shader 

// uniforms 
uniform float uPixelSize;
uniform vec4  u_fdColor;
uniform float u_domainData[DOMAIN_DATA_SIZE];
uniform int u_genCount;

void main () {
  
    vec2 p = vUv;
    float halfPixel = uPixelSize/2.;
    
    float sdfd = iGetFundDomainDistance(vec3(p, 0), u_domainData, u_genCount);
    
    FRAG_COLOR = u_fdColor * (1. - smoothstep(-halfPixel, halfPixel, sdfd));
        
}
`;