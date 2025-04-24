export const fundDomainSamplerShader = 
`
//
// draws interior of the fundamental domain 
// 
// #include 'isplane.glsl' 
// #include 'inversive_sampler.glsl' 
//


out vec4 outColor; // output data 

in vec2 vUv; // fs input coming from vertex shader 

// uniforms 
uniform float u_pixelSize;
uniform vec4  u_fdColor;
uniform sampler2D u_groupData;

void main () {
  
    vec2 p = vUv;
    float halfPixel = u_pixelSize/2.;
    int groupOffset = 0; // assume group packed at 0

    float dist = iGetFundDomainDistanceSampler(vec3(p, 0), u_groupData, groupOffset);
    
    float lineWidth = 10.*u_pixelSize;
    
    float dd = (abs(dist + lineWidth)-lineWidth);
    
    // thick transparent interior 
    vec4 color = 0.25 * u_fdColor * (1. - smoothstep(-halfPixel, 0., dd));
    
    lineWidth = 2.*u_pixelSize;
    dd = (abs(dist + lineWidth)-lineWidth);
    // sharp outline 
    color += u_fdColor * (1. - smoothstep(-halfPixel, 0., dd));    
    
    outColor = color;
    
    //FRAG_COLOR = u_fdColor*dens;
        
}
`;
