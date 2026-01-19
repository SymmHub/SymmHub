//
// accumulation of points with additional crown transform 
// it render only one transform per call 
// group data are passed via uGroupData;
// transform index is passed as uTransformIndex 


export const accumulator_crown_vert = 
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
  
uniform sampler2D uGroupData;
uniform int uTransformIndex;
uniform float uShellThickness;


vec2 applyCrownTransform2D(vec2 pnt, sampler2D groupData, int groupOffset, int crownIndex, float shellThickness){

    vec3 pp = vec3(pnt, 0.);
    float scale = 1.;
    int domainOffset = fetchInt(groupData, groupOffset);
    int transformsOffset = fetchInt(groupData, groupOffset+1);

    //int domainSize = fetchInt(groupData, domainOffset);

    if(shellThickness > 0.){ // use thin shell only         
        // location of splanes array 
        int domainSplanesOffset = domainOffset+1;    
        iSPlane sp = fetchSplane(groupData,domainSplanesOffset + crownIndex*2);
        float ip = iDistance(sp, pp);
        if(ip < -shellThickness) {
            // move point outside clip area 
            return vec2(-2., -2.);
        }
    }        
    int transformOffset = fetchInt(groupData, transformsOffset + crownIndex + 1);

    int refCount = fetchInt(groupData, transformOffset);
    int transformSplanesOffset = transformOffset+1;
    for(int r = 0; r  < refCount; r++){      
      iSPlane rsp = fetchSplane(groupData,transformSplanesOffset + r*2); 
      iReflect(rsp, pp, scale);
    }
    
    //int domainSize = int(getValueFromTex(groupData, texScale, domainOffset).x);

    return pp.xy;
}

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
    vec2 pntCrown = applyCrownTransform2D(pntClip, uGroupData, 0, uTransformIndex, uShellThickness);
    if(pntCrown.x <= -2.){
        // point is outsiode of clip area 
        gl_Position = vec4(-2,-2,0,0);
        gl_PointSize = 1.;
        return;
    }
    
    pntClip = pntCrown;
    
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
        return;
    } else {    
        if(uUsePointsAA) {
            // draw larger point and use Signed Distance Function in fragment shader 
            actualPointSize = (ceil(uPointSize) + 2.);
        } else {
            actualPointSize = uPointSize;
        }
        gl_PointSize = actualPointSize; 
        //gl_Position.xy += uJitter * (qrand2(pntId) - 0.5) / res;
    }
}
`;
