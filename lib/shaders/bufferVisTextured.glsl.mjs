export const bufferVisTextured = 

/*glsl*/`in vec2 vUv;
out vec4 outColor;

// input buffer to visualize
uniform sampler2D uSimBuffer;
//
uniform sampler2D uColorTexture;
uniform vec2 uUVorigin; // = vec2(0,0);
uniform vec2 uUVscale;  // = vec2(1.,0);    // complex scale (with rotation)
uniform vec2 uTexCenter;// = vec2(0,0);

// needs cMul from complex.glsl

//
// converts buffer of floats into RGBA image using a color texture.
// Output is premultiplied alpha to match bufferToScreenTextured expectations
// when the result is consumed via textureLod().
//
void main() {
    //
    // vUv should be mapped into range [0,1] in the vertex shader     
    //
    vec4 bufValue = texture(uSimBuffer, vUv);
    
    vec2 tv = uTexCenter + cMul((bufValue.xy - uUVorigin), uUVscale); 
    vec2 visValue = 0.5*(tv + vec2(1., 1.));   // visValue is in texmap coordinates

    // Clamp to [0,1] so out-of-range simulation values don't wrap-sample
    // the color texture into unexpected colors (e.g. yellowish background).
    visValue = clamp(visValue, 0.0, 1.0);

    // Sample and convert to premultiplied alpha to match what
    // bufferToScreenTextured does: premultColor(texture(uColorTexture, ...))
    vec4 color = texture(uColorTexture, visValue);
    outColor = vec4(color.rgb * color.a, color.a);
    
 }
/*glsl*/`;
