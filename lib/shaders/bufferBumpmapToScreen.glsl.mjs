export const bufferBumpmapToScreen = 

`
in vec2 vUv;
out vec4 outColor;

uniform sampler2D u_texture;

uniform float uPixelSize; 
uniform vec2 u_texCenter;
uniform vec2 u_texScale;
uniform float u_texAlpha;
uniform int u_VisualComponent;

uniform sampler2D uColormap;
uniform sampler2D uGroupData;
uniform int uIterations; 
uniform bool uSymmetry;

uniform float uMinValue;
uniform float uMaxValue;
uniform float uBumpHeight;
uniform float uBumpSmooth;
uniform float uDelta;

#define BUMP_WRAP_CLAMP 1
#define BUMP_WRAP_REPEAT 2

int bumpWrapStyle = BUMP_WRAP_REPEAT;

float bumpFunc2(vec2 uv){
  float v = sin(30.*(uv.x + uv.y));
  
  return v*v*v*v; 
}

// polynomial smooth min
float smin( float a, float b, float k )
{   
    k = max(0.00001, k);
    float h = max( k-abs(a-b), 0.0 )/k;
    return min( a, b ) - h*h*h*k*(1.0/6.0);
}

float smax(float a, float b, float k){
    return -smin(-a,-b,k);
}

float sclamp(float v, float vmin, float vmax, float k){
    return smin(smax(v,vmin, k), vmax, k);    
}

void toFD(inout vec3 pnt, sampler2D groupData){
  
  int groupOffset = 0;
  int inDomain = 0;
  int refcount = 0;
  float scale = 1.;
  iToFundamentalDomainSampler(pnt, groupData, groupOffset, inDomain, refcount, scale, uIterations);
  
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



float bumpFunc(vec2 uv){
    
  if(uSymmetry){
    vec3 p = vec3(uv, 0.);
    toFD(p, uGroupData);
    uv = p.xy;
  }
  
  // map world point into texture coordinates
  vec2 tc = cMul(u_texScale,(uv - u_texCenter));
  vec2 tpnt = tc + vec2(0.5,0.5);
  tc = abs(tc);
  float sdb = max(tc.x, tc.y)-0.5; // signed distance to the texture box 
  float blurWidth = uPixelSize*0.5;
  float mask = 1.-smoothstep(-blurWidth, blurWidth, sdb);
    
  //float value = texture(u_texture, tpnt)[u_VisualComponent];
  vec4 v4 = sample_biquadratic(u_texture, tpnt);
  
  float value = v4[u_VisualComponent];
  // value in the range (0, 1)
  value = (value-uMinValue)/(uMaxValue-uMinValue);
  switch(bumpWrapStyle){
    case BUMP_WRAP_CLAMP:
        value = sclamp(value, 0., 1., uBumpSmooth);
        break;
    case BUMP_WRAP_REPEAT:
        value = value - floor(value);
        value = 4.*value*(1.-value);
        break;
    }
  value = sqrt(value);
  
  //value = sqrt(max(0., value-uThreshold)/uRange);
  return value*mask;
}

vec3 bump(vec3 p0,vec3 sn, float delta, float bumpHeight){
    
      // BUMP MAPPING - PERTURBING THE NORMAL
    //
    // Setting up the bump mapping variables. Normally, you'd amalgamate a lot of the following,
    // and roll it into a single function, but I wanted to show the workings.
    //
    // f - Function value
    // fx - Change in "f" in in the X-direction.
    // fy - Change in "f" in in the Y-direction.
    vec2 eps = vec2(delta, 0.);
    
    float f =  bumpFunc(p0.xy); 
    float fx = bumpFunc(p0.xy + vec2(delta, 0.)); 
    float fy = bumpFunc(p0.xy + vec2(0., delta));       
    
    // Using the above to determine the dx and dy function gradients.
    fx = (fx - f)/(eps.x); // Change in X
    fy = (fy - f)/(eps.x); 
      
    return normalize( sn - vec3(fx, fy, 0)*bumpHeight); 
    
           
}


void main() {

    vec2 pp = vUv;  
    float scale = 1.;
    
    #ifdef HAS_PROJECTION        
    makeProjection(pp, scale);
    #endif 

    // point in world coordinates 
    vec3 wpnt = vec3(pp, 0.);

    vec3 p0 = wpnt;
    
    vec3 sp = wpnt;
    
    vec3 pn = vec3(0,0,-1); // plane normal 
    
    vec3 sn = bump(p0, pn, uDelta, uBumpHeight);
    
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
    outColor = vec4(sqrt(min(col, 1.)), 1.);

}
`;
