export const ISO_UTIL = `

/*
float linearstep(float edge0, float edge1, float x){

    return  clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}
*/
//#define sfract(x)   min( fract(x)/(1.-fwidth(x)), fract(-(x))/fwidth(x) ) 

float sfract(float x){
    float w = 1.5*fwidth(x);
    //if(w > 1.) return 0.5;
    //return min(fract(x)/(1.-w), fract(-x)/w);
    // v is in [0,1]
    float v = (1. + w) * min(fract(x), fract(-x)/w);
    return mix(0.2, v, max(0., (1.-w*w)));
}

//
//
//
float smooth_box(float x0, float x1, float blur, float value){
    return smoothstep(x0-blur, x0 + blur, value) * (1.-smoothstep(x1-blur, x1 + blur, value));
}

//
//
//
float isolines_v0(float v, float v0, float stp) {
    
    v = (v-v0)/stp;
    
    float distToInt = abs(v-round(v));
    //float div = 2.*fwidth(v);
    float div = 2.*length(vec2(dFdx(v), dFdy(v)));
    return smoothstep(max(div, 0.001), 0.0, distToInt);
    //return smoothstep(max(div, 0.001), 0.0, distToInt) * linearstep(1., 5., 1./div);
}

//
// return single isoline at level v0 
//
float isoline_v0(float v, float v0, float lineWidth) {
    
    v -= v0;    
    float div = 2.*length(vec2(dFdx(v), dFdy(v)));
    float av = abs(v)/div;
    //return smoothstep(max(div, 0.001), 0.0, av);
    
    return smoothstep(1.,0., av - 0.5*lineWidth);
    
}

// - Isoline ---------------------------------------------------------
// based on article
// https://iquilezles.org/articles/distance
//
// v0 - start of isolines 
// stp distance between isolines 
// thickness - isolines thickness 
float isolines(float val, float v0, float stp, float lineWidth) {

    val = (val - v0)/stp;
    
    float div = 2.*length(vec2(dFdx(val), dFdy(val)));
    
    float v = abs(fract(val - v0 + 0.5)-0.5)/div - 0.5*lineWidth;
    
    return smoothstep(1.,0., v) * mix(0.2, 1., linearstep(0., 5., 1./div));
    
}

//
//  draw multi-level isolines with fading of the levels 
//
float isolines_multi(float v, float v0, float stp, float lineWidth, int levels){

    float minLinesDistance = 1.; 
    float grad =  length(vec2(dFdx(v), dFdy(v)));
    
    #define LN10 (2.302585092994045)    
    //float isoStep = 1.*exp(LN10*round(log(grad*minLinesDistance)/LN10));
    float isoStep = stp;
    float iso = 0.;
    //float fact[] = float[2](5.,2.);
    //float fact[] = float[2](2., 5.);
    float fact[] = float[2](0.5, 0.2);
    //float th[] = float[2](0.5, 1.);
    float intensity = 1.;//0.2;
    float fading = 0.5;
    float thinning = 0.5;
    float thick = lineWidth;///2.;
    for(int i=0; i < levels; i++){
        iso = max(iso, intensity/(1. + intensity) * isolines(v, v0, isoStep, thick));
        isoStep *= fact[i & 1];
        intensity *= fading;
        thick *= thinning;
    }

    return iso;
    
}

//
//  render isolines with a shadow on the negative side 
//
float isolines_with_shadow(float val, float v0, float stp, float lineWidth, float shadowWidth, float shadowIntensity) {
    
    val = (val-v0)/stp;
    float div = 2.*length(vec2(dFdx(val), dFdy(val)));
    float sdist = (fract(val + 0.5)-0.5)/div; // signed distance in pixels 

    float vi = smoothstep(1.,0., abs(sdist) - 0.5*lineWidth);    
    // shadow 
    float vs = shadowIntensity * linearstep(-shadowWidth, 0., sdist) * smoothstep(0.5*lineWidth, 0., sdist);
    float dens = max(vi, vs);
    
    return  dens;
}

//
//  render single isoline with a shadow on the negative side 
//
float isoline_with_shadow(float val, float v0, float lineWidth, float shadowWidth, float shadowIntensity) {
    
    val -= v0;    
    float div = 2.*length(vec2(dFdx(val), dFdy(val)));
    
    float sdist = val/div; // signed distance in pixels 
    // line 
    float vi = smoothstep(1.,0., abs(sdist) - 0.5*lineWidth);
    // shadow 
    float vs = shadowIntensity * linearstep(-shadowWidth, 0., sdist) * smoothstep(0.5*lineWidth, 0., sdist);
    float dens = max(vi, vs);
    
    return  dens;
}
`;