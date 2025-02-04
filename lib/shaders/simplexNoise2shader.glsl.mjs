export const simplexNoise2shader = 
`
in vec2 vUv;
out vec4 outValue;

//uses simplexNoise.glsl 

uniform vec2 NoiseCell;
uniform vec2 NoiseCenter;
uniform vec2 NoiseFactor;
uniform vec2 minValue;
uniform vec2 maxValue;

float tnoise(vec2 pnt){
  
  return snoise(pnt) + 0.3*snoise(pnt*1.5) ;
  
}


void main() {
                 
    vec2 pnt = vUv; 
        
    float scale = 1./NoiseCell.x;
    float factor = 20./scale;
    float noice = tnoise(scale*(pnt - NoiseCenter));
    //float anoice = abs(noice);
    
    float t = clamp(-factor*(noice - 0.2) , 0., 1.);
    
    vec2 value = clamp(noiceOffset + t*NoiseFactor, minValue, maxValue);


    outValue = vec4(value.rg, 0.0, 1.0);
                    
}
`;
