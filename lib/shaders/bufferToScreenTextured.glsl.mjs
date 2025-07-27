export const bufferToScreenTextured = 
`
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uSimBuffer;


uniform float u_pixelSize; 

uniform vec2 uBufCenter;
uniform vec2 uBufScale;    // complex scale (with rotation)

uniform int uVisualComponent;

uniform sampler2D uGroupData;
uniform int uIterations; 
uniform bool uSymmetry;
uniform int uInterpolation;

uniform sampler2D uColorTexture;
uniform bool uTexOnly;
uniform vec2 uUVorigin;// = vec2(0,0);
uniform vec2 uUVscale;// = vec2(1.,0);    // complex scale (with rotation)
uniform vec2 uTexCenter;// = vec2(0,0);
uniform float uTransparency;

#define USE_MIPMAP  
#ifdef USE_MIPMAP 
uniform bool uUseMipmap;
uniform sampler2D uMipmapData;
#endif  // USE_MIPMAP 


#define INTERP_LINEAR 0
#define INTERP_BIQUADRATIC 1



// biquadratic sampling of texture 
vec4 sample_biquadratic(sampler2D data, vec2 uv) {
    vec2 res = vec2(textureSize(data, 0));
    vec2 q = fract(uv * res);
    vec2 c = (q*(q - 1.0) + 0.5) / res;
    vec2 w0 = uv - c;
    vec2 w1 = uv + c;
    vec4 s = texture(data, vec2(w0.x, w0.y))
       + texture(data, vec2(w0.x, w1.y))
       + texture(data, vec2(w1.x, w1.y))
       + texture(data, vec2(w1.x, w0.y));
    return s / 4.0;
}

vec4 getTexData(sampler2D sampler, vec2 uv){

    switch(uInterpolation) {
    
    default: 
    case INTERP_LINEAR: return texture(sampler, uv);
    case INTERP_BIQUADRATIC:         
        return sample_biquadratic(sampler, uv);
     }
}


void main() {

    // point in world coordinates 

    int groupOffset = 0;
    int inDomain = 0;
    int refcount = 0;
    float scale = 1.;

    vec2 pp = vUv;   

    #ifdef HAS_SPHERICAL_PROJECTION
    if(u_sphericalProjectionEnabled){
        float sdist = makeSphericalProjection(pp, scale);
        if(sdist > 0.) { // signed distance to sphere 
            outColor = vec4(0,0,0,0);
            return;
        }
    }        
    #endif  //HAS_SPHERICAL_PROJECTION
    
    #ifdef HAS_PROJECTION        
    makeProjection(pp, scale);
    #endif 

    vec3 wpnt = vec3(pp, 0.);
    
    
    if(uSymmetry){ 
      iToFundamentalDomainSampler(wpnt, uGroupData, groupOffset, inDomain, refcount, scale, uIterations);
    }
        
    // 
    // map world point into sampler coordinates
    vec2 tc = cMul(uBufScale,(wpnt.xy - uBufCenter));
    vec2 tpnt = tc + vec2(0.5,0.5);
    
    vec4 bufValue = getTexData(uSimBuffer, tpnt);
   
    tc = abs(tc);
    
    float sdb = max(tc.x, tc.y)-0.5; // signed distance to the texture box 
    float blurWidth = u_pixelSize*0.5;
    float mask = 1.-smoothstep(-blurWidth, blurWidth, sdb);
    
    if(uTexOnly) bufValue = vec4(vUv, 0,0);
    // tv (transformed value) is in box[-1,-1][1,1]
    vec2 tv = uTexCenter + cMul((bufValue.xy - uUVorigin), uUVscale); 
    
    /*
    vec2 s = uUVmax - uUVmin;    
    vec2 v = (bufValue.xy-uUVmin)/s; // v is in unit box [0,0],[1,1]
    
    vec2 vv = 2.*v - vec2(1.); // vv is in box[-1,-1][1,1]
    
    vec2 tv = cMul(vv, uUVscale) + uUVcenter; // transformed values in box[-1,-1][1,1]
    */
    vec2 visValue = 0.5*(tv + vec2(1., 1.));   // visValue is in texmap coordinates 
        
    vec4 color = premultColor(texture(uColorTexture, visValue));
    //vec4 color = texture(uColorTexture, visValue);
  
    #ifdef USE_MIPMAP 
    if(uUseMipmap) {
        #define TSIZE(tex) float(textureSize(tex,0).x) 
        #define LOD(tex) (log2(TSIZE(tex)*u_pixelSize*scale*length(uBufScale)))
        
        float mipmapLevel = LOD(uMipmapData);        

        if(mipmapLevel > 0.) {
            color = textureLod(uMipmapData, tpnt, mipmapLevel);
        }
    } 
    #endif // ifdef USE_MIPMAP

  
    outColor = color*mask * (1.-uTransparency);
}
`;