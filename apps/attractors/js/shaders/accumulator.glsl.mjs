//
// accumulation of iterated points 
//

export const accumulator_cpu_vert = 
`
#ifndef PI
#define PI 3.14159265358979323846
#endif

in vec4 a_position; // point in attractor coordinates   
out vec3 v_color;

uniform float colorSpeed;  
uniform float colorPhase;
uniform float uPointSize;
uniform float colorSign;
uniform float jitter;
uniform vec2 resolution;

// parameters to transfform attractor point into world coordinates 
uniform vec2 uAttScale;
uniform vec2 uAttCenter;

uniform sampler2D uHistogram;  // previous histogram data 
uniform sampler2D uPointsData; // poiunts data stored in sampl,er (in case of useGPUI)
uniform bool uUseGpu;          // flag to use pointsData stored in  uPointsData 
uniform float uHistThreshold;
  

vec3 colorscale (float t) {
    
    return 0.5 + 0.5 * 
        vec3(cos((2. * PI) * (t)),        
             cos((2. * PI) * (t - 1./3.)),
             cos((2. * PI) * (t - 2./3.))
            );
}

void main () {    

    vec4 pntData   = a_position;
    if(uUseGpu){
       pntData = texelFetch(uPointsData, ivec2(pntData.xy), 0); 
    }
    float pntValue = pntData.z;
    float pntId    = pntData.w;
    vec2 pndCoord  = pntData.xy;
    
    v_color = colorscale(pntValue * colorSpeed * colorSign - colorPhase);
    
    // point in webgl clip coordinates (-1,1)
    vec2 pnt = cMul(uAttScale,pndCoord) + uAttCenter;     
    gl_Position = vec4(pnt, 0, 1);
    // point in histogram coordinates 
    vec2 histCoord = 0.5*(pnt + 1.); 
    
    ivec2 ipnt = ivec2(histCoord*vec2(textureSize(uHistogram, 0)));    
    
    if(texelFetch(uHistogram,ipnt,0).x >= uHistThreshold){
        // move point outside of screen 
        gl_Position = vec4(-2,0,0,0);
        gl_PointSize = 1.;
    } else {
        gl_PointSize = uPointSize;
        gl_Position.xy += jitter * (qrand2(pntId) - 0.5) / resolution;
    }
}
`;

export const  accumulator_gpu_vert = 
`
#ifndef PI
#define PI 3.14159265358979323846
#endif


in vec2 a_index;  // used as 2D indices of points ([0,0], [0,1], etc)

uniform sampler2D uPointsData;  /// XY of points stored in texels

uniform float colorSpeed;  
uniform float colorPhase;
uniform float pointSize;
uniform float colorSign;
uniform float jitter;
uniform vec2 resolution;

uniform float uPointSize;
uniform vec2 uAttScale;
uniform vec2 uAttCenter;
out vec3 v_color;

vec3 colorscale (float t) {
    
    return 0.5 + 0.5 * 
        vec3(cos((2. * PI) * (t)),        
             cos((2. * PI) * (t - 1./3.)),
             cos((2. * PI) * (t - 2./3.))
            );
}

void main() {
  
    ivec2 dataDim = textureSize(uPointsData,0);
    vec4 data = texelFetch(uPointsData, ivec2(a_index), 0);
    vec2 pntCoord = data.xy;
    float pntValue = data.z;

    v_color = colorscale(pntValue * colorSpeed * colorSign - colorPhase);


    float pointIndex = a_index.y * float(dataDim.x) + a_index.x;
    vec2 randomShift = jitter * (qrand2(pointIndex) - 0.5) / resolution;  

    vec2 histPnt = cMul(uAttScale,pntCoord) + uAttCenter + randomShift;   
    gl_Position = vec4(histPnt, 0, 1);
    gl_PointSize = uPointSize;
  
}
`;



export const accumulator_frag = 
`
in vec3 v_color;
out vec4 outColor;

uniform float uPixelSizeFactor;

void main () {

    // 1. Calculate distance from the center (0.5, 0.5)
    float dist = distance(gl_PointCoord, vec2(0.5));
    // fwidth(dist) calculates how much 'dist' changes between pixels.
    //float delta = fwidth(dist);
    // Create a smooth alpha ramp.
    // This maps the edge of the circle (0.5) to a smooth transition.
    //float alpha = 1.0 - smoothstep(0.5 - delta, 0.5, dist);
    
    // smooth cap 
    float alpha = 2.*(1.0 - smoothstep(0., 0.5, dist));    
    // Discard fully transparent pixels to save performance
    if (alpha <= 0.) {
        discard;
    }
    outColor = alpha * vec4(1., v_color) * uPixelSizeFactor;
}
`;

