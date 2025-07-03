export const bufferToScreenBumpmap = 

`
in vec2 vUv;
out vec4 outColor;


uniform float u_pixelSize; 

uniform sampler2D uSimBuffer;
uniform vec2 uBufCenter;
uniform vec2 uBufScale;
uniform int uVisualComponent;

uniform sampler2D uGroupData;
uniform int uIterations; 
uniform bool uSymmetry;


// apply projection and symmetry mapping transform to the inout vec2 pnt

void applyTransform(inout vec2 pp, sampler2D groupData, inout float scale){
  
  int groupOffset = 0;
  int inDomain = 0;
  int refcount = 0;
  
  makeProjection(pp, scale);  // from projection.glsl
  
  if(uSymmetry){
    vec3 pnt = vec3(pp, 0.);
    iToFundamentalDomainSampler(pnt, groupData, groupOffset, inDomain, refcount, scale, uIterations);
    pp = pnt.xy;
  }  
}

#define USE_MIPMAP  
#ifdef USE_MIPMAP 
uniform bool uUseMipmap;
uniform sampler2D uMipmapData;
#endif  // USE_MIPMAP 


uniform float uMinValue, uMaxValue;
uniform float uBumpHeight;
uniform float uBumpSmoothFactor;

uniform int uBumpStyle;// = HEIGHT_STYLE_WAVE;
uniform float uTransparency;
    
float heightFunc(vec2 uv){
   
    float scale = 1.;
    
    applyTransform(uv, uGroupData, scale);
        
    // map world point into texture coordinates
    vec2 tpnt = world2tex(uv, uBufScale, uBufCenter);
    
    float mask = getTexMask(tpnt, u_pixelSize); 
    
    float value = texture_biquad(uSimBuffer, tpnt)[uVisualComponent]; 
    float height = value2height(value, uBumpStyle, uBumpSmoothFactor, uMinValue, uMaxValue);
        
    #ifdef USE_MIPMAP 
    if(uUseMipmap) {
        #define TSIZE(tex) float(textureSize(tex,0).x) 
        #define LOD(tex) (log2(TSIZE(tex)*u_pixelSize*scale*length(uBufScale)))
        
        float mipmapLevel = LOD(uMipmapData);        

        if(mipmapLevel > 0.) {
            height = textureLod(uMipmapData, tpnt, mipmapLevel).x;
            //value /= scale;
        }
    } 
    #endif // ifdef USE_MIPMAP
    
    height = height/(scale);

    return height*mask;
}

vec3 getNormal(vec3 p0,vec3 sn, float bumpHeight){
    
    // BUMP MAPPING - PERTURBING THE NORMAL
    //
    
    float dd = max(0.00001, (2.*u_pixelSize));
    vec2 e = vec2(dd, 0.);
    //float f   = heightFunc(p0.xy); 
    float f_x = heightFunc(p0.xy - e); 
    float fx  = heightFunc(p0.xy + e); 
    float fy  = heightFunc(p0.xy + e.yx);       
    float f_y = heightFunc(p0.xy - e.yx);       
    
    // Using the above to determine the dx and dy function gradients.
    float dfdx = (fx - f_x)/(2.*dd); // Change in X
    float dfdy = (fy - f_y)/(2.*dd); 
    
    // HW derivatives produce artifacts 
    //float dfdx = dFdx(f)/u_pixelSize;
    //float dfdy = dFdy(f)/u_pixelSize;

    
    return normalize( sn - vec3(dfdx, dfdy, 0)*bumpHeight); 
              
}


void main() {

    vec2 pp = vUv;  
    float scale = 1.;
    
    #ifdef HAS_SPHERICAL_PROJECTION
    if(u_sphericalProjectionEnabled){
        float sdist = makeSphericalProjection(pp, scale);
        if(sdist > 0.) { // signed distance to sphere 
            outColor = vec4(0,0,0,0);
            return;
        }
    }        
    #endif  //HAS_SPHERICAL_PROJECTION


    // point in world coordinates 
    vec3 wpnt = vec3(pp, 0.);

    vec3 p0 = wpnt;
    
    vec3 sp = wpnt;
    
    vec3 pn = vec3(0,0,-1); // plane normal 
    
    vec3 sn = getNormal(p0, pn, uBumpHeight);
    
    vec3 lp = vec3(-0.3, .2, -2); // Light position - Back from the screen.
    vec3 ld = lp - sp;
    float lDist = max(length(ld), 0.001);
    ld /= lDist;
    float atten = min(1./(1. + lDist*0.125 + lDist*lDist*0.05), 64.);
    vec3 rd = vec3(0.,0.,1.);

    

    float diff = max(dot(sn, ld), 0.);  

    // Enhancing the diffuse value a bit. Made up.
    diff = pow(diff, 2.)*0.66 + pow(diff, 4.)*0.34; 
    // Specular highlighting.
    float spec = pow(max(dot( reflect(-ld, sn), -rd), 0.),16.); 
    // surface color 
    vec3 texCol = vec3(0.2, 0.13, 0.1);
    
    //vec3 col = (texCol*(diff*1. + 0.125) + (texCol*.5 + .5)*vec3(0.5, 0.5, 0.5)*spec)*atten;
    vec3 col = (texCol*(diff) + (texCol*.5 + .5)*vec3(0.5, 0.5, 0.5)*spec)*atten;
    
    col += col*vec3(1)*diff;
    
    // Rough gamma correction, and we're done.
    outColor = vec4(sqrt(min(col, 1.)), 1.)*(1.-uTransparency);

}
`;
