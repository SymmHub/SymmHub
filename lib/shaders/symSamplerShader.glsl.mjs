export const symSamplerShader = 
`
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uSource;
uniform sampler2D uGroupData;
uniform int uIterations; 
uniform float uSymMix;

void tunnelPoint(inout vec3 p){
  vec3 q = p - vec3(0.25,0.25, 0.);
  float r = sqrt(dot(q,q));
  if(r < 0.5){
      p -= vec3(0.5, 0.5, 0.);
  }
}

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

    //return sample_biquadratic(sampler, uv);
    return texture(sampler, uv);
    //switch(uInterpolation) {
    
    //default: 
    //case INTERP_LINEAR: return texture(sampler, uv);
    //case INTERP_BIQUADRATIC:         
    //    return sample_biquadratic(sampler, uv);
    // }
}

void main () {
      
    vec3 pnt = vec3(vUv, 0.);
    int inDomain = 0;
    int refcount = 0;
    float scale = 1.;
    int groupOffset = 0;
    vec4 origValue = texture(uSource, 0.5*pnt.xy+vec2(0.5,0.5));
    
    iToFundamentalDomainSampler(pnt, uGroupData, groupOffset, inDomain, refcount, scale, uIterations);
    //tunnelPoint(pnt);
    
    vec4 symValue = getTexData(uSource, 0.5*pnt.xy+vec2(0.5,0.5));
    // map point into [0,1] range         
    outColor = mix(origValue, symValue, uSymMix);
    
}
`;