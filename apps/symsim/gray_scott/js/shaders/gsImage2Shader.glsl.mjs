export const gsImage2Shader = 

`
in vec2 vUv;
out vec4 outColor;


#ifndef MAX_COLORS_COUNT
#define MAX_COLORS_COUNT 20
#endif 

uniform sampler2D uSimBuffer;

uniform vec4 uColors[MAX_COLORS_COUNT]; 

uniform int uColorsCount;  // count of colors used for gradient 
uniform int uVisualComponent; // [0 or 1]
/**
  return gradient color 
*/
vec4 getGradientColor(float value, vec4 colors[MAX_COLORS_COUNT], int count){
  
    // init first color
    vec4 c0 = vec4(colors[0].rgb, 0.); 
    
    vec4 color;
    bool found = false;
    for(int i = 0; i < count; i++){
      vec4 c1 = colors[i];
      if(value < c1.a){
        float a = (value - c0.a)/(c1.a - c0.a);
        return vec4(mix(c0.rgb, c1.rgb, a), 1.);
      } 
      c0 = c1;
    }
    // return last color 
    return vec4(colors[count-1].rgb, 1.);
    
}
//
// converts GS simulation buffer into RGBA image 
//
void main() {
  
    // vUv is mapped into range [0,1] in the vertex shader 
    
    vec2 src = texture(uSimBuffer, vUv).rg;
    switch(uVisualComponent){
      default: 
      case 0: outColor = getGradientColor(src.r, uColors, uColorsCount);
        break;
      case 1: outColor = getGradientColor(src.g, uColors, uColorsCount);
        break;
    }
    //float value = (uVisualComponent == 0) ? src.r: src.g;
    
    //float value = 0.5*(0.8 - texture(uSimBuffer, vUv).r);
    //value  = mod(5.*value, 1.);
    //outColor = getGradientColor(value, uColors, uColorsCount);    
}
`;