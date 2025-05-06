export const bufferVisColormap = 

`in vec2 vUv;
out vec4 outColor;

// input buffer to visualize
uniform sampler2D uSimBuffer;
//
// texture used for visualization 
// each colormap entry is packed into two vec4 fields: (vec4 color, float value) 
// 
uniform sampler2D uColormap;

uniform float uMinValue;
uniform float uMaxValue;
uniform float uCmBanding;
uniform int uCmWrap;


uniform int uVisualComponent; // [0,1,2,3]

// needs getColormapColor from colormap.glsl

//
// converts buffer of floats into into RGBA image using colormap stored in texture 
//
void main() {
    //
    // vUv should be mapped into range [0,1] in the vertex shader     
    //
    vec4 src = texture(uSimBuffer, vUv);
    float visValue = src[uVisualComponent];
    
    visValue = (visValue - uMinValue)/(uMaxValue - uMinValue);
    
    //outColor = getColormapColor(src[uVisualComponent], uColormapTex);
    outColor = getColormapColor(visValue, uColormap, uCmWrap, uCmBanding);    
    
 }
`;
