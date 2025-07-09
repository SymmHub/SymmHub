export const texUtils = `

#ifndef PI 
#define PI 3.1415926535897932384626433832795
#endif 

// biquadratic sampling of texture 
vec4 texture_biquad(sampler2D data, vec2 uv) {
    vec2 res = vec2(textureSize(data, 0));
    vec2 q = fract(uv * res);
    vec2 c = (q*(q - 1.0) + 0.5) / res;
    vec2 w0 = uv - c;
    vec2 w1 = uv + c;
    vec4 s = 
        texture(data, vec2(w0.x, w0.y)) + texture(data, vec2(w0.x, w1.y)) + 
        texture(data, vec2(w1.x, w1.y)) + texture(data, vec2(w1.x, w0.y));
    return s / 4.0;
}


#define INTERP_LINEAR 0
#define INTERP_BIQUADRATIC 1

vec4 getTexData(sampler2D sampler, vec2 uv, int interp){

    switch(interp) {
    
    default: 
    case INTERP_LINEAR: return texture(sampler, uv);
    case INTERP_BIQUADRATIC:         
        return texture_biquad(sampler, uv);
     }
}

// visualization components definitions 
#define DATA_SOURCE_U 0
#define DATA_SOURCE_V 1
#define DATA_SOURCE_MODU 2
#define DATA_SOURCE_ARGU 3
#define DATA_SOURCE_ABSU 4
#define DATA_SOURCE_ABSV 5

//
//  convert data into value for visualization 
//
float getDataSouceValue(vec4 value, int type){
    float visValue = 0.;    
    switch(type){
        default: 
        case DATA_SOURCE_U: visValue = value.x; break;
        case DATA_SOURCE_V: visValue = value.y; break;
        case DATA_SOURCE_MODU: visValue = length(value.xy); break;
        case DATA_SOURCE_ARGU: visValue = atan(value.y, value.x)/PI; break;
        case DATA_SOURCE_ABSU: visValue = abs(value.x); break;
        case DATA_SOURCE_ABSV: visValue = abs(value.y); break;
    }
    return visValue;
}



// polynomial smooth min
float smin( float a, float b, float k )
{   
    k = max(1.e-10, k); // to prevent division by 0
    float h = max( k-abs(a-b), 0.0 )/k;
    return min( a, b ) - h*h*h*k*(1.0/6.0);
}

// smooth max
float smax(float a, float b, float k){
    return -smin(-a,-b,k);
}

// smooth clamp 
float sclamp(float v, float vmin, float vmax, float k){
    return smin(smax(v,vmin, k), vmax, k);    
}


#define HEIGHT_STYLE_CLAMP 0
#define HEIGHT_STYLE_CLAMP_SQRT 1
#define HEIGHT_STYLE_QUAD_WAVE  2
#define HEIGHT_STYLE_WAVE     3
//
//  convert value into heightmap 
//
float value2height(float value, int style, float smoothFactor, float minValue, float maxValue){

    // put value in the range [0, 1]
    float range = max(1.e-10, (maxValue - minValue));
    value = (value-minValue)/range;
    switch(style){
        case HEIGHT_STYLE_CLAMP:
        value = (sclamp(value, 0., 1., smoothFactor));
        break;
        case HEIGHT_STYLE_CLAMP_SQRT:
        value = sqrt(sclamp(value, 0., 1., smoothFactor)); // from texUtils
        break;
        case HEIGHT_STYLE_QUAD_WAVE:
        value = value - floor(value);
        value = 4.*value*(1.-value);
        break;
        case HEIGHT_STYLE_WAVE: 
        value = 0.5*(1.+sin(value*(2.*PI)));  
        break;
    }
    return value;
}

//
// convert world coord into texture box coordinates 
//
vec2 world2tex(vec2 uv, vec2 scale, vec2 center){
    return cMul(scale, (uv -  center)) + vec2(0.5,0.5);    
}
// return smooth make of texture box [0,0]-[1,1]
float getTexMask(vec2 tuv, float pixelSize){
    
    vec2 tc = tuv - vec2(0.5,0.5);
    
    tc = abs(tc);
    
    float sdb = max(tc.x, tc.y)-0.5; // signed distance to the texture box 
    float blurWidth = pixelSize*0.5;
    
    return (1.-smoothstep(-blurWidth, blurWidth, sdb));
    
}

`;