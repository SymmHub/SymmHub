export const draw_hist_frag = 
`
in vec2 texCoord;
uniform sampler2D src;
uniform float brightness;
uniform float contrast;
uniform float gamma;
uniform float scale;      
uniform float saturation;
uniform float dynamicRange;
uniform bool invert;

out vec4 outColor;



vec3 rgb2yuv(vec3 rgb) {
    float y = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    return vec3(y, 0.493 * (rgb.b - y), 0.877 * (rgb.r - y));
}
  
vec3 yuv2rgb(vec3 yuv) {
    return 
        clamp(
            vec3(yuv.x + (1.0 / 0.877) * yuv.z,
                 yuv.x - 0.39393 * yuv.y - 0.58081 * yuv.z,
                 yuv.x + (1.0 / 0.493) * yuv.y), 
            vec3(0.,0.,0.), 
            vec3(1.,1.,1.)
        );
}

float smoothLimit(float x, float k) {
    x = 2. * x - 1.;
    float a = pow(abs(x), 1.0 / k);
    return sign(x) * pow(a / (a + 1.), k) * 0.5 + 0.5;
}


void main () {
    
    //outColor = vec4(1.,0.,0.,1.);
    //return;
    
    vec4 state = texture(src, texCoord);
    float density = state.r / scale;

    float v = (density == 0.0) ? (-20.0) : (log(density)/log(1000.0));
    float value = contrast * v + brightness;
    value = smoothLimit(value, dynamicRange);
    if (!invert) value = 1.0 - value;

    vec3 rgb = state.gba / max(state.r, 1.0);
    vec3 yuv = rgb2yuv(rgb);

    // Use the lightness from the overall density
    yuv.x = value;

    yuv.yz *= saturation;
    // Fade the saturation to zero at white and black:
    yuv.yz *= value * (1.0 - value) * 4.;

    rgb = yuv2rgb(yuv);
    
    vec4 rgba = vec4(pow(rgb, vec3(1.0 / gamma)), 1.0);
    if(invert)
        outColor = extractOverlay(vec4(0.,0.,0.,1.), rgba, OVERLAY_TYPE_BRIGHTER);    
    else 
        outColor = extractOverlay(vec4(1.,1.,1.,1.), rgba, OVERLAY_TYPE_DARKER);
}
`;
