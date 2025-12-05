//
// accumulation of iterated points 
//
export const  gpu_accumulator_vert = 
`
//precision highp float;

#ifndef PI
#define PI 3.14159265358979323846
#endif


in vec2 a_position;  // used as 2D indices of points ([0,0], [0,1], etc)

uniform sampler2D uPointsData;  /// XY of points stored in texels

uniform float colorSpeed;  
uniform float colorPhase;
uniform float pointSize;
uniform float colorSign;
uniform float jitter;
uniform vec2 resolution;

uniform float uPointSize;
uniform vec2 uAttScale;// = vec2(0.2, 0.);
uniform vec2 uAttCenter;// = vec2(0., 0.);
out vec3 v_color;

vec3 colorscale (float t) {
    return 0.5 + 0.5 * vec3(
      cos((2.0 * PI) * t - colorPhase),
      cos((2.0 * PI) * (t - 1.0 / 3.0) - colorPhase),
      cos((2.0 * PI) * (t - 2.0 / 3.0) - colorPhase)
    );
}


void main() {

  vec4 data = texelFetch(uPointsData, ivec2(a_position), 0);
  vec2 pnt = data.xy;
  float dist = data.z;

  v_color = colorscale(dist * colorSpeed * colorSign);
  
  vec2 xy = cMul(uAttScale,pnt) + uAttCenter;   
  gl_Position = vec4(xy, 0, 1);
  gl_PointSize = uPointSize;

  //gl_Position.xy += jitter * (qrand2(a_position.w) - 0.5) / resolution;  
  
}
`;


export const  gpu_accumulator_frag = 

`
out vec4 outColor;  // result value of accumulator 
in vec3 v_color;
uniform float uPointSize;

void main () {

    // return new value 
    outColor = vec4(1., v_color) / (uPointSize * uPointSize);

}
`;

