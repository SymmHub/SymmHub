export const bufferVisHeightmap = 

`in vec2 vUv;
out vec4 outColor;

// requires value2height() from texUtils.glsl 

// input buffer to visualize
uniform sampler2D uSimBuffer;
//

uniform float uMinValue;
uniform float uMaxValue;
uniform float uBumpSmoothFactor;
uniform int   uBumpStyle; 

uniform int uVisualComponent; // [0,1,2,3]


//
// converts buffer of floats into into height map 
//
void main() {
    //
    // vUv is in range [0,1] is coming from vertex shader 
    //    

    float value = texture(uSimBuffer, vUv)[uVisualComponent];
    float height = value2height(value, uBumpStyle, uBumpSmoothFactor, uMinValue, uMaxValue);

    outColor = vec4(vec3(height), 1.); 
    
 }
`;
