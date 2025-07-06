export const bufferToScreenColormap = 
`
in vec2 vUv;

layout(location = 0) out vec4 outColor;
//layout(location = 1) out vec4 outPnt;

uniform float u_pixelSize; // important for AA. Set from CanvasTransform uniforms 

uniform sampler2D uSimBuffer;

uniform float uMinValue;   // normalization of values for visualization 
uniform float uMaxValue;

uniform vec2 uBufCenter;   // location of data buffer in world coord 
uniform vec2 uBufScale;    // complex scaling (with rotation) which maps world UV coordinates into data buffer coordinates 
uniform int uVisualComponent;

uniform sampler2D uColormap;
uniform sampler2D uGroupData;
uniform int uIterations; 
uniform bool uSymmetry;
uniform float uCmBanding;
uniform int uCmWrap;
uniform int uInterpolation;
//uniform float uColormapTransparency;
uniform float uTransparency;
#define INTERP_LINEAR 0
#define INTERP_BIQUADRATIC 1

// visualization components definitions 
#define VIS_U 0
#define VIS_V 1
#define VIS_MODU 2
#define VIS_ARGU 3


#define USE_MIPMAP  
#ifdef USE_MIPMAP 
uniform bool uUseMipmap;
uniform sampler2D uMipmapData;
#endif  // USE_MIPMAP 

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

//
//  convert data into value for visualization 
//
float getVisValue(vec4 value, int type){
    float visValue = 0.;    
    switch(type){
        default: 
        case VIS_U: visValue = value.x; break;
        case VIS_V: visValue = value.y; break;
        case VIS_MODU: visValue = length(value.xy); break;
        case VIS_ARGU: visValue = atan(value.y, value.x)/PI; break;
    }
    return visValue;
}
//
//  convert value to visual color 
//
vec4 getColormapVisualization(float visValue,  float mi, float ma, sampler2D colormap, int wrapping, float banding){

    visValue = (visValue - mi)/(ma-mi);
    return getColormapColor(visValue, colormap, wrapping, banding); 
}

void main() {


    int groupOffset = 0;
    int inDomain = 0;
    int refcount = 0;

    vec2 pp = vUv;    

    float scale = 1.;
    //float scale = max(1.,1./(1.-dot(pp,pp)));
    
    #ifdef HAS_SPHERICAL_PROJECTION
    if(u_sphericalProjectionEnabled){
        float sdist = makeSphericalProjection(pp, scale);
        if(sdist > 0.) { // signed distance to the unit sphere 
            outColor = vec4(0,0,0,0);
            //outPnt = vec4(0,0, 0,0);
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
    if(uSymmetry && inDomain == 0) {
       outColor = vec4(0,0,0,0);
       return;
    }
    // 
    // map world point into sampler coordinates
    vec2 tc = cMul(uBufScale,(wpnt.xy - uBufCenter));
    vec2 tpnt = tc + vec2(0.5,0.5);    
    tc = abs(tc);    
    float sdb = max(tc.x, tc.y)-0.5; // signed distance to the texture box 
    float blurWidth = u_pixelSize*0.5;
    float mask = 1.-smoothstep(-blurWidth, blurWidth, sdb);

    vec4 bufValue = getTexData(uSimBuffer, tpnt);
       
    float visValue = getVisValue(bufValue, uVisualComponent);   
    vec4 color = getColormapVisualization(visValue, uMinValue, uMaxValue, uColormap, uCmWrap, uCmBanding );
  
    #ifdef USE_MIPMAP 
    if(uUseMipmap) {
        #define TSIZE(tex) float(textureSize(tex,0).x) 
        #define LOD(tex) (log2(TSIZE(tex)*u_pixelSize*scale*length(uBufScale)))
        
        float mipmapLevel = LOD(uMipmapData);        
        //vec4 mipmapColor = ;
        
        if(mipmapLevel > 0.) 
            color = textureLod(uMipmapData, tpnt, mipmapLevel);
    } 
    #endif // ifdef USE_MIPMAP
    
    // writing output 
    outColor = color*mask * (1.-uTransparency);
    //outPnt = vec4(wpnt.xy, 0, 1.); // coordinate of the point inside of the fundamental domain 
    
}
`;