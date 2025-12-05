export const cpu_accumulator_vert = 
`
#ifndef PI
#define PI 3.14159265358979323846
#endif

in vec4 a_position;
out vec3 v_color;

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
    vec2 xy = cMul(uAttScale,a_position.xy) + uAttCenter;     
    gl_Position = vec4(xy, 0, 1);
    gl_PointSize = pointSize;

    gl_Position.xy += jitter * (qrand2(a_position.w) - 0.5) / resolution;
}
`;