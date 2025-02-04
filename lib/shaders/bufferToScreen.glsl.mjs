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
uniform int u_VisualComponent;

uniform sampler2D uColormap;
uniform sampler2D uGroupData;
uniform int uIterations; 
uniform bool uSymmetry;
uniform float uCmBanding;
uniform int uCmWrap;
uniform int uInterpolation;

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


    int groupOffset = 0;
    int inDomain = 0;
    int refcount = 0;
    float scale = 1.;

    vec2 pp = vUv;    
    
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
    
    vec4 bufValue = getTexData(u_texture, tpnt);
    
    float visValue = 0.;
    
    switch(u_VisualComponent){
        default: 
        case 0: visValue = bufValue.x; break;
        case 1: visValue = bufValue.y; break;
        case 2: visValue = bufValue.z; break;
        case 3: visValue = bufValue.w; break;
        case 4: visValue = length(bufValue.xy); break;
        case 5: visValue = length(bufValue.xz); break;
        case 6: visValue = length(bufValue.yz); break;
    }
    visValue = (visValue - uMinValue)/(uMaxValue - uMinValue);
    
    //float value = texture(u_texture, tpnt)[u_VisualComponent];

    tc = abs(tc);
    
    float sdb = max(tc.x, tc.y)-0.5; // signed distance to the texture box 
    float blurWidth = uPixelSize*0.5;
    float mask = 1.-smoothstep(-blurWidth, blurWidth, sdb);
    
    float a;

    vec4 color = getColormapColor(visValue, uColormap, uCmWrap, uCmBanding);    
    
    outColor = color*mask;
}
`;