export const GRID_UTIL = `


//float linearstep(float edge0, float edge1, float x){
//
//    return  clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
//}

//
// this should be used to draw vertical or horizontal lines only 
// it makes sharp lines with 1 pixel gray level on the boundary (if necessary)
//
float getGridLine(float v, float pixelSize, float lineStep, float lineOffset, float lineWidth){

    
    v = (v - lineOffset)/lineStep;
    
    // the distToInt will be is 0,1,2,3
    float div = length(vec2(dFdx(v), dFdy(v)));
    //float distToInt = round(abs(v-round(v))/div); 
    //(v + 0.5) )
    float sDistToInt = (v-round(v))/div;
    if(sDistToInt >= -0.5 && sDistToInt <= 0.5)
        return 1.;
    else 
        return 0.;
        
    float distToInt = round(abs(sDistToInt)); 
    
    float halfWidth = 0.5*lineWidth;
    
    // we need to construct step function which will do linear step last pixel of the line 
    //return 1.;//
    return 1.-linearstep((halfWidth-0.5), (halfWidth+0.5), distToInt); 
            
}


float getAxis(float val, float thickness){

    //float div = 2.*length(vec2(dFdx(val), dFdy(val)));
    float div = length(vec2(dFdx(val), dFdy(val)));
    
    float v = abs(val)/div - 0.1*thickness;
    
    return 1.-smoothstep(0.2,0.8, v);
    //return 1.-smoothstep(0.2,0.8, v);
    
}

float getGridLines(float v, float gridStep, float thickness){
    
    // closest pixel to the line center     
    //float findex = round(v/gridStep);
    float findex = floor(v/gridStep + 0.5);
    
    float pixel = gridStep * findex;
    
    int index = int(findex);
    
    float sDistToInt = (v-pixel);
    
    //if(sDistToInt > -0.5 && sDistToInt <= 0.5){
    if(sDistToInt >= -0. && sDistToInt <= 1.){
        if(index % 50 == 0) return 1.;
        if(index % 10 == 0) return 0.5;
        if(index % 5  == 0) return 0.3;
        else                return 0.1;
    } else {
        return 0.;
    }     
}

float getCartesianGrid(vec2 p, vec2 gridStep, float lineWidth, float axesWidth){
    
    float pixelSize = dFdx(p.x);
    
    //#define LN10 (2.302585092994045)
    
    //float gridStep = 10.*exp(LN10*round(log(pixelSize)/LN10))/pixelSize;
    vec2 stp = gridStep/pixelSize;
    // offset pixel to avoid double lines 
    //p += vec2(pixelSize)*0.001; 
        
    float d =  getGridLines(p.x/pixelSize, stp.x, lineWidth);
    d = max(d, getGridLines(p.y/pixelSize, stp.y, lineWidth));
    d = max(d, getAxis(p.x, axesWidth));
    d = max(d, getAxis(p.y, axesWidth));
    
    return d;    
}

float getGridLines2(float v, float gridStep, float linewidth){
    
    // distance to closest line 
    float gridIndex = (floor(v/gridStep+0.5));
    int index = int(gridIndex);
    float distToLine = v - gridStep*gridIndex;    
    // distance to closest line rounded to integer
    float idist = abs(floor(distToLine)); 
    //int index = int(findex);
    float thining = 1.;
    if(index == 0) thining = 1.5;
    else if(index % 50 == 0)      thining = 1.0;
    else if(index % 10 == 0) thining = 0.4;
    else if(index % 5  == 0) thining = 0.2;
    else                     thining = 0.1;
    
    return linearstep(max((2.*idist-1.), 0.),(2.*idist + 1.),linewidth*thining);    
}

float getCartesianGrid2(vec2 p, vec2 gridStep, float lineWidth, float axesWidth){
    
    float pixelSize = dFdx(p.x);
    
    //#define LN10 (2.302585092994045)    
    //float gs = 20.*exp(LN10*floor(log(pixelSize)/LN10));
    vec2 gs = gridStep;
    
    // p and step are in pixel size now 
    p /= pixelSize;
    vec2 stp = gs/pixelSize;
    // offset pixel to avoid double lines 
    //p += vec2(pixelSize)*0.001; 
        
    float dx = getGridLines2(p.x, stp.x, lineWidth);
    float dy = getGridLines2(p.y, stp.y, lineWidth);
    float d = max(dx, dy);
    //d = max(d, getAxis(p.x, axesWidth));
    //d = max(d, getAxis(p.y, axesWidth));
    
    return d;    
}

`;
