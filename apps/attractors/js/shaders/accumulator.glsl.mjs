//
// accumulation of iterated points 
//


export const accumulator_vert = 
`

in vec4 a_position; // point in attractor coordinates   
out vec3 vertColor;
out float actualPointSize;

// parameters to transfform attractor point into world coordinates 
uniform vec2 uTransScale;
uniform vec2 uTransCenter;
uniform float uJitter;
uniform float uPointSize;

uniform sampler2D uHistogram;  // previous histogram data 
uniform sampler2D uPointsData; // poiunts data stored in sampler (if(uUseGpu)
uniform bool uUseGpu;          // flag to use pointsData stored in  uPointsData 
uniform float uHistThreshold;  // max accumulation threshold 
uniform bool uUsePointsAA;     // whether to render antialised points 
  

void main () {    

    vec4 pntData   = a_position;
    if(uUseGpu){
        // in if(uUseGpu) points attribute is index of point in the sampler
       pntData = texelFetch(uPointsData, ivec2(pntData.xy), 0); 
    }
    float pntValue = pntData.z; // value used for coloring
    float pntId    = pntData.w; // 
    vec2 pndAtt  = pntData.xy;  // point in attractor coordinates 
    
    vertColor = getPointColor(pntValue);
    
    // point in clip coordinates (-1,1)
    vec2 pntClip = cMul(uTransScale,pndAtt) + uTransCenter;     
    gl_Position = vec4(pntClip, 0, 1);
    // point in histogram coordinates (0,1)
    vec2 pntHist = 0.5*(pntClip + 1.); 
    vec2 res = vec2(textureSize(uHistogram, 0));
    ivec2 iPntHist = ivec2(pntHist*res);    
    
    if(texelFetch(uHistogram,iPntHist,0).x >= uHistThreshold){
        // too many points hit this pixel already 
        // move point outside of screen 
        gl_Position = vec4(-2,-2,0,0);
        gl_PointSize = 1.;
    } else {
        if(uUsePointsAA) {
            // draw larger point and use Signed Distance Function in fragment shader 
            actualPointSize = (ceil(uPointSize) + 1.);
        } else {
            actualPointSize = uPointSize;
        }
        gl_PointSize = actualPointSize; 
       // gl_Position.xy += uJitter * (qrand2(pntId) - 0.5) / res;
    }
}
`;



export const accumulator_frag = 
`
in vec3 vertColor;
in float actualPointSize;
out vec4 outColor;

uniform float uPixelSizeFactor;
uniform float uPointSize;
uniform bool uUsePointsAA;
#define POINT_SQUARE 0
#define POINT_CIRCLE 1
#define POINT_CAP 2
#define POINT_GRADIENT_X 3
#define POINT_GRADIENT_Y 4
#define POINT_GRADIENT_XY 5

//uniform 
int uPointShape = POINT_GRADIENT_XY;


float getPointShape(int shape, vec2 pnt){

    switch(shape){
        default: 
        case POINT_SQUARE: 
            return 1.;
        case POINT_CIRCLE: {
            float dist = distance(pnt, vec2(0.5));
            float radius = uPointSize/(2.*actualPointSize);
            float delta = 0.1;
            return (1.-smoothstep(radius-delta, radius, dist));            
        }        
        case POINT_CAP: {
            float dist = distance(pnt, vec2(0.5));
            float radius = uPointSize/(2.*actualPointSize);
            return (1.-smoothstep(0., radius, dist));                    
        }        
        case POINT_GRADIENT_X: {
            return 1.-2.*abs(pnt.x-0.5);
        }        
        case POINT_GRADIENT_Y: {
            return 1.-2.*abs(pnt.y-0.5);
        }        
        case POINT_GRADIENT_XY: {
            return (1.-2.*abs(pnt.y-0.5))*(1.-2.*abs(pnt.x-0.5));
        }        
    }
}

void main () {

    // 1. Calculate distance from the center (0.5, 0.5)
    float dist = distance(gl_PointCoord, vec2(0.5));
    // fwidth(dist) calculates how much 'dist' changes between pixels.
    //float delta = fwidth(dist);
    float delta = 0.25;
    // Create a smooth alpha ramp.
    // This maps the edge of the circle (0.5) to a smooth transition.
    // calculate effective circle radius here 
    // because we increased gl_PointSize in vertex shader 
    // float radius = uPointSize/(2.*actualPointSize);

    float alpha = getPointShape(uPointShape, gl_PointCoord);

    outColor = alpha * vec4(1., vertColor)* uPixelSizeFactor;
}
`;

