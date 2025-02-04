export const gsNoise1Shader = 
`
in vec2 vUv;
out vec4 outValue;

//uses simplexNoise.glsl 

uniform sampler2D tSource;
uniform float feedCoeff;
uniform float killCoeff;

uniform float NoiseFactor;
uniform float NoiseCell;
uniform vec2 NoiseCenter;

//float DiffR = 0.2097;
//float DiffG = 0.105;


vec2 homogen_uv()
{
  float sqrt_F = sqrt(feedCoeff);
  float U = 1.0;
  float V = 0.0;
  if (killCoeff < (sqrt_F - 2.0 * feedCoeff) / 2.0) {
    float A = sqrt_F / (feedCoeff + killCoeff);
    U = (A - sqrt(A*A - 4.0)) / (2.0 * A);
    U = clamp(U, 0.0, 1.0);
    V = sqrt_F * (A + sqrt(A*A - 4.0)) / 2.0;
    V = clamp(V, 0.0, 1.0);
  } // else, (U,V) already set to (1,0)
  return vec2(U, V);
}

float tnoise(vec2 pnt){
  
  return snoise(pnt) + 0.3*snoise(pnt*1.5) ;
  
}


void main() {
    
    ivec2 texSize = textureSize(tSource,0);
       
    float dx = 16./float(texSize.x);
    float dy = 16./float(texSize.y);
    vec2 texel = vec2(dx, dy);
      
    vec2 huv = homogen_uv();    
    //vec2 pnt = vUv/texel; 
    vec2 pnt = vUv; 
    
    // let's do some noise
    /*
    float t = 0.5*(snoise(0.1*vUv/texel) + snoise(0.16*vUv/texel));
    outValue = vec4(clamp(huv.r-t, 0.0, 1.0), clamp(huv.g+t, 0.0, 1.0), 0.0, 1.0);
    */
    /*
    float t1 = 0.5*(snoise(0.1*pnt) + snoise(0.16*pnt));
    float t2 = 0.5*(snoise(0.3-0.13*pnt) + snoise(0.7-0.21*pnt));
    float r = clamp(huv.r-0.25+t1, 0.0, 1.0);
    float g = clamp(huv.g-0.25+t2, 0.0, 1.0);
    */
    
    float scale = 1./NoiseCell;
    float factor = 20./scale;
    
    //float t1 = clamp(-factor*(abs(snoise(scale*(pnt - NoiseCenter)))-0.1) , 0., 1.);
    float t1 = clamp(-2.*factor*(abs(tnoise(scale*(pnt - NoiseCenter)))-0.2) , 0., 1.);
    //float t1 = clamp(-factor*(abs(snoise(scale*pnt))-0.1) , 0., 1.);
    
    float t2 = 1.-t1;
    float r = clamp(huv.r + NoiseFactor*t1, 0.0, 1.);
    float g = clamp(huv.g - NoiseFactor*t1, 0.0, 1.);


    outValue = vec4(r,g,0.0, 1.0);
    
        
    //float r = clamp(huv.r -0.25 + 0.9*snoise(0.3*pnt), 0.,1.);
    //float g = clamp(huv.g -0.25 + 0.9*snoise(0.25*pnt), 0., 1.);        
    //outValue = vec4(r,g,0.0, 1.0);
         
}
`;
