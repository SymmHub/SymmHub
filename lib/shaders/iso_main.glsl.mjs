export const ISO_MAIN = 
`
//
// draws isolines 
// 
// #include 'iso_util' 
//

in vec2 vUv; // fs input coming from vertex shader 

out vec4 outColor; // output data 


// apply projection and symmetry mapping transform to the inout vec2 pnt

void applyTransform(inout vec2 pp, sampler2D groupData, inout float scale, bool useSymm,int symIter){
  
  int groupOffset = 0;
  int inDomain = 0;
  int refcount = 0;
  
  makeProjection(pp, scale);  // from projection.glsl
  
  if(useSymm){
    vec3 pnt = vec3(pp, 0.);
    iToFundamentalDomainSampler(pnt, groupData, groupOffset, inDomain, refcount, scale, symIter);
    pp = pnt.xy;
  }  
}



uniform vec4 uIsolinesColor;
uniform float uIsoStep;
uniform float uIsoOffset;
uniform float uIsoThickness;
uniform int uIsoLevels;

uniform float u_pixelSize; 

uniform sampler2D uSimBuffer;
uniform vec2 uBufCenter;
uniform vec2 uBufScale;
uniform int uVisualComponent;

uniform sampler2D uGroupData;
uniform int uIterations; 
uniform bool uSymmetry;


void main () {
      
    vec2 p = vUv;
    float pixelSize = abs(dFdx(p.x));
    
    float scale = 1.;
        
    applyTransform(p, uGroupData, scale, uSymmetry, uIterations);
    
    //if(inDomain(length(p) > 1.){        
    // test domain component bounds 
    //    outColor = vec4(0,0,0,0);
    //    return;    
    //}
    
    
    // map world point into texture coordinates
    vec2 tpnt = world2tex(p, uBufScale, uBufCenter);
    // texture mask to avoid reading data outside of texture 
    float mask = getTexMask(tpnt, pixelSize); 
    
    if(mask == 0.0) {
        outColor = vec4(0,0,0,0);
        return;
    }
    
    float value = texture_biquad(uSimBuffer, tpnt)[uVisualComponent];     
    outColor = uIsolinesColor * mask *isolines_multi(value, uIsoOffset, uIsoStep, uIsoThickness, uIsoLevels);

        
}
`;