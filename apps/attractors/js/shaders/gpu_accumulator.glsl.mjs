//
// accumulation of iterated points 
//
export const  gpu_accumulator_vert = 
`
//precision highp float;

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
  
  ivec2 dataDim = textureSize(uPointsData,0);
  vec4 data = texelFetch(uPointsData, ivec2(a_index), 0);
  vec2 pnt = data.xy;
  float dist = data.z;

  v_color = colorscale(dist * colorSpeed * colorSign);
  

  float pointIndex = a_index.y * float(dataDim.x) + a_index.x;
  vec2 randomShift = jitter * (qrand2(pointIndex) - 0.5) / resolution;  

  vec2 histPnt = cMul(uAttScale,pnt) + uAttCenter + randomShift;   
  gl_Position = vec4(histPnt, 0, 1);
  gl_PointSize = uPointSize;
  
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

