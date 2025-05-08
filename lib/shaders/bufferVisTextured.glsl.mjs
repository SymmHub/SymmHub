export const bufferVisTextured = 

`in vec2 vUv;
out vec4 outColor;

// input buffer to visualize
uniform sampler2D uSimBuffer;
//
uniform sampler2D uColorTexture;
uniform vec2 uUVorigin; // = vec2(0,0);
uniform vec2 uUVscale;  // = vec2(1.,0);    // complex scale (with rotation)
uniform vec2 uTexCenter;// = vec2(0,0);

uniform int uVisualComponent; // [0,1,2,3]

// needs getColormapColor from colormap.glsl

//
// converts buffer of floats into into RGBA image using colormap stored in texture 
//
void main() {
    //
    // vUv should be mapped into range [0,1] in the vertex shader     
    //
    vec4 bufValue = texture(uSimBuffer, vUv);
    
    
    vec2 tv = uTexCenter + cMul((bufValue.xy - uUVorigin), uUVscale); 
    vec2 visValue = 0.5*(tv + vec2(1., 1.));   // visValue is in texmap coordinates 
    
    // map buffer xy values into color from uColorTexture     
    vec4 color = texture(uColorTexture, visValue);
        
    outColor = color;
    
 }
`;
