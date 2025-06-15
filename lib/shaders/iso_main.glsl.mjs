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

//
//  thickness of spherical lens build inside of unit circle 
//  s - max thickness 
float lens(vec2 p, float s){
    float R = (1. + s*s)/(2.*s);
    float Z = R-s;
    float r2 = dot(p,p);
    float h = sqrt(R*R - r2)-Z;
    return h;
}

//
//  inverse of metric inside of poincare circle 
//
float inv_circle_metric(vec2 p, float s){
    return  s *max(0.,(1.-dot(p,p)));
}


void main () {
      
    vec2 p = vUv;
    float pixelSize = abs(dFdx(p.x));
    
    float lensHeight = 1.;
    
    float scale = 1.;///(1.-dot(p.xy,p.xy));
        
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
    
    //if(mask == 0.0) {
    //    outColor = vec4(0,0,0,0);
    //    return;
    //}
    
    float value = texture_biquad(uSimBuffer, tpnt)[uVisualComponent];     
    
    //float value = 1./scale; 
    //float value = lens(vUv, lensHeight);
    float limitSetDist = inv_circle_metric(p, lensHeight) / scale;
    if(vUv.x < 0.0) value = inv_circle_metric(vUv, lensHeight);
    float fadeFactor = 1.;// min(limitSetDist, 1.);
    float isoValue = fadeFactor*isolines_multi(value, uIsoOffset, uIsoStep, uIsoThickness, uIsoLevels);
    //float isoValue = isolines_with_shadow(value, uIsoOffset, uIsoStep, uIsoThickness, 5., 0.3);
    float limitSetValue = isoline(limitSetDist, 0., 2.*uIsoThickness);
    isoValue = max(isoValue, limitSetValue);
    outColor = uIsolinesColor * mask * isoValue;

        
}
`;