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

//
//  render single isoline 
//
float isoline(float val, float v0, float lineWidth) {

    #define FADING_DISTANCE (5.)
    //#define D(v) (abs(fract(v + 0.5)-0.5)/grad - 0.5*lineWidth)
    float v = (val - v0);
    // gradient length
    float grad = length(vec2(dFdx(v), dFdy(v)));
    
    //float d = D(v);
    float d = (abs(v)/grad - 0.5*lineWidth);
        
    return linearstep(0.5,-0.5, d) * linearstep(0., 10., 1./grad);

}


// - Isoline ---------------------------------------------------------
// based on article
// https://iquilezles.org/articles/distance
//
// v0 - start of isolines 
// stp distance between isolines 
// lineWidth - isolines thickness 
float isolines(float val, float v0, float stp, float lineWidth) {

    #define FADING_DISTANCE (5.)
    //#define D(v) (abs(fract(v + 0.5)-0.5)/grad - 0.5*lineWidth)
    float v = val = (val - v0)/stp;
    // now isolines are draw at -1, 0, 1, 2, ...
    // gradient length
    float grad = length(vec2(dFdx(val), dFdy(val)));
    
    //float d = D(v);
    float d = (abs(fract(v + 0.5)-0.5)/grad - 0.5*lineWidth);
        
    //return smoothstep(1.,0., d) * linearstep(0., FADING_DISTANCE, 1./grad);
    //return linearstep(0.,-1., d) * linearstep(0.5, 1., 1./grad);
    return linearstep(0.5,-0.5, d) * linearstep(0., 10., 1./grad);

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
    float fading_factor = 0.5;
    float thinning_factor = 0.75;
    float thickness = lineWidth;
    for(int i=0; i < levels; i++){
        //thickness = max(2., thickness);
        iso = max(iso, intensity * isolines(v, v0, isoStep, thickness));
        isoStep *= fact[i & 1];
        intensity *= fading_factor;
        thickness *= thinning_factor;
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