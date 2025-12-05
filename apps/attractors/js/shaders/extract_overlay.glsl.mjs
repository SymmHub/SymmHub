
export const extract_overlay = `



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
`;