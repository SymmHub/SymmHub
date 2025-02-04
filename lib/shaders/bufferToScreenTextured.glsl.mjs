export const bufferToScreenTextured = 
`
in vec2 vUv;
out vec4 outColor;

uniform sampler2D u_texture;


uniform float uPixelSize; 
uniform vec2 u_texCenter;
uniform vec2 u_texScale;    // complex scale (with rotation)
uniform int u_VisualComponent;

uniform sampler2D uGroupData;
uniform int uIterations; 
uniform bool uSymmetry;
uniform int uInterpolation;

uniform sampler2D uColorTexture;
uniform bool uTexOnly;
uniform vec2 uUVorigin;// = vec2(0,0);
uniform vec2 uUVscale;// = vec2(1.,0);    // complex scale (with rotation)
uniform vec2 uTexCenter;// = vec2(0,0);


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
   
    tc = abs(tc);
    
    float sdb = max(tc.x, tc.y)-0.5; // signed distance to the texture box 
    float blurWidth = uPixelSize*0.5;
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
    vec2 visValue = 0.5*(tv + vec2(1., 1.));   // visValue is in texture coordinates 
        
    vec4 color = getTexData(uColorTexture, visValue);
    
    outColor = color*mask;
}
`;