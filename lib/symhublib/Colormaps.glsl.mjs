//=========================================
//
//  cm_utils
//
//=========================================
export const cm_utils = `
float sstep(float x0, float x1, float x) {

  // Cubic or linear smoothing both work well.
  //return smoothstep(x0,x1,x);
  return clamp((x-x0)/(x1 - x0),0.0,1.0);
}

vec4 toLinear(vec4 c){
    return vec4(pow(c.xyz, vec3(2.2)), c.w);
    //return pow(c,vec4(2.2));
}

vec4 toGamma(vec4 c){
    return vec4(pow(c.xyz, vec3(0.4545)), c.w);
    //return pow(c, vec4(0.4545));
}

vec4 premult(vec4 c){
    return vec4(c.xyz*c.w, c.w);
}
`;

//=========================================
//
//  cm_sampler
//
//=========================================
export const cm_sampler = 
`
int cmSize(sampler2D tex){
    return textureSize(tex, 0).x/3;
}

float cmEV(sampler2D tex, int index){
    return texelFetch(tex, ivec2(index*3,0),0).x;
}

vec4 cmCL(sampler2D tex, int index){
    return texelFetch(tex, ivec2(index*3 + 1,0),0);
}

vec4 cmCR(sampler2D tex, int index){
    return texelFetch(tex, ivec2(index*3 + 2,0),0);
}


vec4 getInterpColor2(sampler2D tex, int index, float value, float colorFactor){
    
    //return vec4(1,0,0,1);
    //if(index < 0) {
    //    return CL(0);
    //}
    int size = cmSize(tex);
    vec4 c0 = toLinear(cmCR(tex,index));  // start color
    vec4 c1 = toLinear(cmCL(tex,index + 1));  // end color 
    
    float v0 = cmEV(tex,index);
    float v1 = cmEV(tex,index + 1);
    
    float mixFactor = (value - v0)/(v1-v0);
    if(colorFactor != 1.) 
        c0.xyz *= colorFactor;
    return mix(c0, c1, mixFactor);
        
}

vec4 getColormapColorRepeat(sampler2D tex, float value, float colorFactor) {
    int size = cmSize(tex);
    if(size == 1){
        // not useful case, but we need to return something 
        // we return mix of left and right colors 
        return premult(toGamma(mix(cmCL(tex,0),cmCR(tex,0),0.5)));    
    }
    int index = -1;
    float px = 0.5*length(vec2(dFdx(value),dFdy(value))); 
    float vv;
    vec4 c0, c1;
    float vstart = cmEV(tex,0);
    float range = cmEV(tex,size-1) - vstart;
        
    value = vstart + range*fract((value-vstart)/range);
    
    int minIndex = -1;
    float minDist = 1.e10;
    for(int i = 0; i < size; i++){
        float dist = abs(value - cmEV(tex,i));
        if(dist < minDist) {
           minIndex = i;
           minDist = dist;
        }
    }
    if(minIndex < 0) {
        // should not happens 
        return vec4(1,0,1, 1.);       
    } 
    vv = cmEV(tex,minIndex);
    
    if(minIndex == 0){
    
        c0 = getInterpColor2(tex,size-2, value+range, colorFactor); //eft 
        c1 = getInterpColor2(tex,0, value, colorFactor); // right 
        
    } else if(minIndex == (size-1)){
    
        c0 = getInterpColor2(tex,size-2, value, colorFactor); // left 
        c1 = getInterpColor2(tex,0, value-range, colorFactor); // right 
        
    } else {    
    
        c0 = getInterpColor2(tex,minIndex-1, value, colorFactor); // left
        c1 = getInterpColor2(tex,minIndex, value, colorFactor); // right 
    }
    
    return premult(toGamma(mix(c0,c1,sstep(vv-px,vv+px,value))));    

}

vec4 getColormapColorClamp(sampler2D tex, float value, float colorFactor) {

    int size = cmSize(tex);
    int index = -1;
    float px = 0.5*length(vec2(dFdx(value),dFdy(value))); 
    float vv;
    int minIndex = -1;
    vec4 c0, c1;
    if(size == 1) {
        c0 = toLinear(cmCL(tex, 0));
        c1 = toLinear(cmCR(tex, 0));
        vv = cmEV(tex, 0);
        return premult(toGamma(mix(c0,c1,sstep(vv-px,vv+px,value))));            
    }
    
    float minDist = 1.e10;
    minIndex = -1;
    for(int i = 0; i < size; i++){
    float dist = abs(value - cmEV(tex,i));
        if(dist < minDist) {
           minIndex = i;
           minDist = dist;
        }
    }
    if(minIndex == 0) {
        c0 = toLinear(cmCL(tex,0));
        c1 = getInterpColor2(tex, 0, value, colorFactor);
        vv = cmEV(tex,0);    
    }  else if(minIndex == (size-1)){
        c0 = getInterpColor2(tex,size-2, value, colorFactor);
        c1 = toLinear(cmCR(tex,size-1));
        vv = cmEV(tex,size-1);        
    } else {        
        c0 = getInterpColor2(tex,minIndex-1, value, colorFactor); // left of minIndex
        c1 = getInterpColor2(tex,minIndex, value, colorFactor); // right of minIndex
        vv = cmEV(tex,minIndex);
    }
    
    return premult(toGamma(mix(c0,c1,sstep(vv-px,vv+px,value))));    
    
}

#define WRAP_CLAMP 1
#define WRAP_REPEAT 0

vec4 getColormapColor(float value, sampler2D tex, int wrapFilter, float colorFactor) {
    switch(wrapFilter){
        default: 
        case WRAP_REPEAT: 
            return getColormapColorRepeat(tex, value, colorFactor);
        case WRAP_CLAMP: 
            return getColormapColorClamp(tex, value, colorFactor);
        
    }
}
vec4 getColormapColor(float value, sampler2D tex) {
    return getColormapColor(value, tex, WRAP_CLAMP, 1.);
}
`;
//export const cm_sampler 

export const ColormapFragments = {
    cm_fragment: cm_utils + cm_sampler,
    cm_utils,
    cm_sampler,
}
    

