export const bufferToScreen = 
`
in vec2 vUv;
out vec4 outColor;

uniform sampler2D u_texture;

uniform float uMinValue;
uniform float uMaxValue;

uniform float uPixelSize; 
uniform vec2 u_texCenter;
uniform vec2 u_texScale;    // complex scale (with rotation)
uniform int uVisualComponent;

uniform sampler2D uColormap;
uniform sampler2D uGroupData;
uniform int uIterations; 
uniform bool uSymmetry;
uniform float uCmBanding;
uniform int uCmWrap;
uniform int uInterpolation;

#define INTERP_LINEAR 0
#define INTERP_BIQUADRATIC 1

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
//  convert value to visual color 
//
vec4 getVisualization(vec4 value,  float mi, float ma, int type, sampler2D colormap, int wrapping, float banding){


    float visValue = 0.;
    
    switch(type){
        default: 
        case 0: visValue = value.x; break;
        case 1: visValue = value.y; break;
        case 2: visValue = value.z; break;
        case 3: visValue = value.w; break;
        case 4: visValue = length(value.xy); break;
        case 5: visValue = length(value.xz); break;
        case 6: visValue = length(value.yz); break;
    }
    visValue = (visValue - mi)/(ma-mi);
    return getColormapColor(visValue, colormap, wrapping, banding); 
}

void main() {


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
    vec2 tc = cMul(u_texScale,(wpnt.xy - u_texCenter));
    vec2 tpnt = tc + vec2(0.5,0.5);
    
    tc = abs(tc);
    
    float sdb = max(tc.x, tc.y)-0.5; // signed distance to the texture box 
    float blurWidth = uPixelSize*0.5;
    float mask = 1.-smoothstep(-blurWidth, blurWidth, sdb);


    vec4 bufValue = getTexData(u_texture, tpnt);
       
    vec4 color = getVisualization(bufValue, uMinValue, uMaxValue, uVisualComponent, uColormap, uCmWrap, uCmBanding );
    
    if(uUseMipmap) {
        #define TSIZE(tex) float(textureSize(tex,0).x) 
        #define LOD(tex) log2(TSIZE(tex)*uPixelSize*scale*length(u_texScale))
        float mipmapLevel = LOD(uMipmapData);
        vec4 mipmapColor = textureLod(uMipmapData, tpnt, mipmapLevel);
        if(mipmapLevel > -1.) {
            color = mix(color, mipmapColor, smoothstep(-1.,0.,mipmapLevel));
        } 
    }
    
    outColor = color*mask;
}
`;