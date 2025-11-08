export const draw_hist_frag = 
`
in vec2 uv;
uniform sampler2D src;
uniform float brightness;
uniform float contrast;
uniform float gamma;
uniform float scale;      
uniform float saturation;
uniform float dynamicRange;
uniform bool invert;

out vec4 outColor;


#define MAXG  1.e5
#define OVERLAY_TYPE_BRIGHTER  0
#define OVERLAY_TYPE_DARKER  1
#define OVERLAY_TYPE_ANY  2

float get_best_g(float c0, float c2, int overlayType){

    float c20 = c2 - c0; 
    if(c20 == 0.)
      return MAXG;  
      
    switch(overlayType){
        default:
        case OVERLAY_TYPE_ANY:
            if(c20 < 0.) return -c0/c20;
            else  return (1.-c0)/c20; 
        case OVERLAY_TYPE_DARKER:
            if(c20 < 0.) return -c0/c20;
            else return MAXG;
        case OVERLAY_TYPE_BRIGHTER:
            if(c20 < 0.) return MAXG;
            else return (1.-c0)/c20;                     
    }
}

vec4 extractOverlay(vec4 backcolor, vec4 incolor, int overlayType){

// non premult color 
// combination of color c1 with alpha "a"  over color c0 give color c2
// c2 = (1-a) c0 + a c1 
// given c2, c0  we have to find best (c1, a) 
// c0 - background 
// c2 - image to match (incolor) 
// trivial solution if we put a = 1; c1 = c2;
// we want to find value "a" closest to 0, 
// such that all colors are inside of allowed range (0, 1) 
//
// c2-c0 = a (c1-c0) 
// let g = 1/a
// (c1-c0) = g(c2-c0)
// c1 = c0 + g(c2-c0) 
// c1 = 0, 1 are boundary values 
// c0 + g(c2-c0) = 0 => g = -c0/(c2-c0) 
// c0 + g(c2-c0) = 1 => g = (1-c0)/(c2-c0)
// 
// we have to find minimal positive value of (g > 1) for which c1 is at the boundary [0,1]
// gmin = minimal values of all color components 
// a = 1/gmin 
// c1 = c0 + gmin (c2-c0) 


    float ming = MAXG;
    float g = get_best_g(backcolor.x,incolor.x, overlayType);    
    if(g < ming) ming = g;    
    g = get_best_g(backcolor.y,incolor.y, overlayType);    
    if(g < ming) ming = g;    
    g = get_best_g(backcolor.z,incolor.z, overlayType);    
    if(g < ming) ming = g;    
    
    float a = 1.; 
    if(ming < MAXG)
        a = 1./ming;
    else 
        a = 0.;
    // make output premult 
    if(a == 0.){
        // overlay is transparent. Premult Color is 0;
        return vec4(0,0,0,0);
    } else {
        float g = 1./a;
        // premult color 
        vec4 outcolor;
        outcolor = (backcolor + g * (incolor - backcolor))/g;
        outcolor.w = a;
        return outcolor;        
    }       
}           


vec3 rgb2yuv(vec3 rgb) {
    float y = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    return vec3(y, 0.493 * (rgb.b - y), 0.877 * (rgb.r - y));
}
  
vec3 yuv2rgb(vec3 yuv) {
    return vec3(
        yuv.x + (1.0 / 0.877) * yuv.z,
        yuv.x - 0.39393 * yuv.y - 0.58081 * yuv.z,
        yuv.x + (1.0 / 0.493) * yuv.y
    );
}

float smoothLimit(float x, float k) {
    x = 2.0 * x - 1.0;
    float a = pow(abs(x), 1.0 / k);
    return sign(x) * pow(a / (a + 1.0), k) * 0.5 + 0.5;
}


void main () {
    
    //outColor = vec4(1.,0.,0.,1.);
    //return;
    
    vec4 state = texture(src, uv);
    float density = state.r / scale;

    float v = density == 0.0 ? -20.0 : log(density)/log(1000.0);
    float value = contrast * v + brightness;
    value = smoothLimit(value, dynamicRange);
    if (!invert) value = 1.0 - value;

    vec3 rgb = state.gba / max(state.r, 1.0);
    vec3 yuv = rgb2yuv(rgb);

    // Use the lightness from the overall density
    yuv.x = value;

    // Fade the saturation to zero at white and black:
    yuv.yz *= saturation * value * (1.0 - value) * 4.0;

    rgb = yuv2rgb(yuv);
    
    vec4 rgba = vec4(pow(rgb, vec3(1.0 / gamma)), 1.0);
    if(invert)
        outColor = extractOverlay(vec4(0.,0.,0.,1.), rgba, OVERLAY_TYPE_BRIGHTER);    
    else 
        outColor = extractOverlay(vec4(1.,1.,1.,1.), rgba, OVERLAY_TYPE_DARKER);

}
`;
