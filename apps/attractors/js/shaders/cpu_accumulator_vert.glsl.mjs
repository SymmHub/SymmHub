export const cpu_accumulator_vert = 
`
  #define PI 3.14159265358979323846
  in vec4 a_position;
  out vec3 v_color;

  uniform float colorSpeed;  
  uniform float colorPhase;
  uniform float pointSize;
  uniform float colorSign;
  uniform float jitter;
  uniform vec2 resolution;
  

  vec3 colorscale (float t) {
    return 0.5 + 0.5 * vec3(
      cos((2.0 * PI) * t - colorPhase),
      cos((2.0 * PI) * (t - 1.0 / 3.0) - colorPhase),
      cos((2.0 * PI) * (t - 2.0 / 3.0) - colorPhase)
    );
  }

  const float g = 1.32471795724474602596;
  const vec2 q = vec2(1.0 / g, 1.0/(g*g));
  vec2 qrand2(float n) {
    return fract(0.5 + q * n);
  }

  void main () {    
    //v_color = colorscale(0.1*floor(10.*(a_position.z * colorSpeed * colorSign)));
    v_color = colorscale(a_position.z * colorSpeed * colorSign);
    vec2 xy = 0.4*a_position.xy;
    gl_Position = vec4(xy, 0, 1);
    gl_PointSize = pointSize;

    gl_Position.xy += jitter * (qrand2(a_position.w) - 0.5) / resolution;
  }
`;