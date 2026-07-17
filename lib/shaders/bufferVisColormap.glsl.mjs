export const bufferVisColormap = 

/*glsl*/`in vec2 vUv;
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

// Data source type — same values as uDataSource in bufferToScreenColormap.
// Uses getDataSouceValue() from texUtils so all 6 source types (u, v, mod, arg, abs(u), abs(v))
// are handled correctly. Requires texUtils to be included in the program fragment chain.
uniform int uDataSource;

// needs getColormapColor from colormap.glsl
// needs getDataSouceValue from texUtils.glsl

//
// converts buffer of floats into RGBA image using colormap stored in texture 
//
void main() {
    //
    // vUv should be mapped into range [0,1] in the vertex shader     
    //
    vec4 src = texture(uSimBuffer, vUv);
    float visValue = getDataSouceValue(src, uDataSource);
    
    visValue = (visValue - uMinValue)/(uMaxValue - uMinValue);
    
    outColor = getColormapColor(visValue, uColormap, uCmWrap, uCmBanding);    
    
 }
/*glsl*/`;
