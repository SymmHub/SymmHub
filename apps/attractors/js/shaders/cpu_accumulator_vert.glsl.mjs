export const cpu_accumulator_vert = 
`
#ifndef PI
#define PI 3.14159265358979323846
#endif

in vec4 a_position; // point in attractor coordinates   
out vec3 v_color;
out vec2 v_histCoord; // point in histogram coordinates (0,1)

uniform float colorSpeed;  
uniform float colorPhase;
uniform float pointSize;
uniform float colorSign;
uniform float jitter;
uniform vec2 resolution;
// parameters to transform points positions into histogram image 
//uniform float uHistScale;
//uniform vec2 uHistCenter;

// parameters to transfform attractor point into world coordinates 
uniform vec2 uAttScale;
uniform vec2 uAttCenter;
uniform sampler2D uHistogram;
  

vec3 colorscale (float t) {
    return 0.5 + 0.5 * vec3(
      cos((2.0 * PI) * t - colorPhase),
      cos((2.0 * PI) * (t - 1.0 / 3.0) - colorPhase),
      cos((2.0 * PI) * (t - 2.0 / 3.0) - colorPhase)
    );
}

void main () {    
    //v_color = colorscale(0.1*floor(10.*(a_position.z * colorSpeed * colorSign)));

    v_color = colorscale(a_position.z * colorSpeed * colorSign);
    // point in webgl clip coordinates (-1,1)
    vec2 pnt = cMul(uAttScale,a_position.xy) + uAttCenter;     
    gl_Position = vec4(pnt, 0, 1);
    // point in histogram coordinates 
    v_histCoord = 0.5*(pnt + 1.); 
    //if(false) {
    if(texture(uHistogram, v_histCoord).x > 10.) {
        // move point outside of screen 
        gl_Position = vec4(-2,-2,-2,-2);
        gl_PointSize = 0.;
    } else {
        gl_PointSize = pointSize;
        gl_Position.xy += jitter * (qrand2(a_position.w) - 0.5) / resolution;
    }
}
`;