export const bufferToScreenColormap = 
`
in vec2 vUv;
out vec4 outColor;

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

    vec2 pp = vUv;    

    float scale = 1.;
    //float scale = max(1.,1./(1.-dot(pp,pp)));
    
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
    
    tc = abs(tc);
    
    float sdb = max(tc.x, tc.y)-0.5; // signed distance to the texture box 
    float blurWidth = u_pixelSize*0.5;
    float mask = 1.-smoothstep(-blurWidth, blurWidth, sdb);


    vec4 bufValue = getTexData(uSimBuffer, tpnt);
       
    vec4 color = getVisualization(bufValue, uMinValue, uMaxValue, uVisualComponent, uColormap, uCmWrap, uCmBanding );
    
    if(uUseMipmap) {
        #define TSIZE(tex) float(textureSize(tex,0).x) 
        #define LOD(tex) (log2(TSIZE(tex)*u_pixelSize*scale*length(uBufScale)))
        
        float mipmapLevel = LOD(uMipmapData);        
        //vec4 mipmapColor = ;
        
        //vec4 mipmapColor = vec4(0.,0.,1.,1.);
        //color = mipmapColor;
        //color = vec4(vec3(mipmapLevel)*0.1, 1.);
        /*
        switch(int(mipmapLevel)){
            default: color = vec4(1.,0,1.,1.); break;
            case -1: color = vec4(1.,1.,0.,1.); break;
            case 0:  color = vec4(0.,0.,0.,1.); break;
            case 1:  color = vec4(0.1,0.1,0.1,1.); break;
            case 2:  color = vec4(0.2,0.2,0.2,1.); break;
            case 3:  color = vec4(0.3,0.3,0.3,1.); break;
            case 4:  color = vec4(0.4,0.4,0.4,1.); break;
            case 5:  color = vec4(0.5,0.5,0.5,1.); break;
            case 6:  color = vec4(0.3,0.8,0.3,1.); break;
            case 7:  color = vec4(0.3,0.9,0.3,1.); break;
            
        }
        */

        if(mipmapLevel > 0.) 
            color = textureLod(uMipmapData, tpnt, mipmapLevel);
    } 
        
    outColor = color*mask;
}
`;