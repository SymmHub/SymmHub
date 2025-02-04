export const grayScottShader = 

`
in vec2 vUv;
out vec4 outValue;

#ifndef PI 
#define PI 3.1415926535897932384626433832795
#endif 

uniform sampler2D tSource;
uniform float deltaT;
uniform float feedCoeff;
uniform float killCoeff;
uniform float feedGradient;
uniform float killGradient;

uniform bool useLaplas9;
uniform float DiffR; // R diffusion coeff
uniform float DiffG; // G diffusion coefficient 
uniform float boundaryR;
uniform float boundaryG;

uniform bool useHMetric;
uniform float HMetricScale; // = 1.;

uniform bool useBoundary;

uniform bool useDisk;
uniform float diskX;
uniform float diskY;
uniform float diskR;

//
// box mask return 1 inside, 0 outside
//
float box(vec2 bottomLeft, vec2 topRight, vec2 v) {

  vec2 s = step(bottomLeft, v) - step(topRight, v);
  return s.x * s.y;   
}


void main() {
    
    ivec2 texSize = textureSize(tSource,0);
       
    float dx = 1./float(texSize.x);
    float dy = 1./float(texSize.y);
    float coeff = 1.;
    float dt = deltaT;
    // vUv.xy in [0,1]  
    vec2 pnt = vUv;
    
    float factor = 1.;
    if(useHMetric){
      vec2 pp = HMetricScale*(pnt*2. - vec2(1.,1.));
      float r2 = dot(pp,pp);
      float f = max(0.,(1. - r2)); 
      factor = f*f;
    }
    
    float dr = DiffR*factor;
    float dg = DiffG*factor;
    
    vec2 uv  = texture(tSource, pnt).rg;
    vec2 uv_p0 = (
      texture(tSource, pnt + vec2(-dx, 0.0)) + 
      texture(tSource, pnt + vec2( dx, 0.0)) + 
      texture(tSource, pnt + vec2(0.0, -dy)) + 
      texture(tSource, pnt + vec2(0.0,  dy))).rg;
      
    // used for more uniform laplasian 
    vec2 lapl;
    if(useLaplas9){
      vec2 uv_pp = (
          texture(tSource, pnt + vec2( dx,  dy)) +
          texture(tSource, pnt + vec2(-dx, -dy)) + 
          texture(tSource, pnt + vec2( dx, -dy)) + 
          texture(tSource, pnt + vec2(-dx,  dy))).rg;   
      // 9 points more uniform lappasian 
      lapl = (0.8*uv_p0 + 0.2*uv_pp - 4.0*uv);      
    } else {
    // 5 points laplasian 
      lapl = (uv_p0 - 4.0*uv);
    }
    
    float r = uv.r;
    float g = uv.g;
    float feed = feedCoeff + feedGradient*pnt.y; 
    float kill = killCoeff + killGradient*pnt.x;    
    float du = dr * lapl.r - r*g*g + feed * (1.0 - r);
    float dv = dg * lapl.g + r*g*g - (feed + kill) * g;
    
    vec2 dst = uv + dt*vec2(du, dv);
      
    if(useBoundary){ 
      vec2 dd = vec2(dx, dy);
      dst = mix(vec2(boundaryR,boundaryG), dst, box(dd, vec2(1,1) - dd, pnt.xy));
    }

    if(useDisk){ 
      vec2 diskCenter = vec2(diskX, diskY);
      float diskRadius = diskR;
      float sd = sdDisk(pnt, diskCenter, diskRadius);
      float dd = smoothstep(-dx, dx, sd);      
      dst = mix(vec2(boundaryR,boundaryG), dst, dd);
    }
    
    outValue = vec4(dst.r, dst.g, 0.0, 1.0);
}
`;