
export const  iterator_dejong_frag = 

`
#ifndef PI
#define PI 3.14159265358979323846
#endif

uniform sampler2D uPointsData;

out vec4 outPnt;  // result of iteration 

uniform float u_a;// = 3.;
uniform float u_b;// = 1.25;
uniform float u_c;// = 1.58;
uniform float u_d;// = 1.72;

vec2 iterate(vec2 p){
   
   return vec2(
        sin(u_a * p.y) - cos(u_b * p.x),
        sin(u_c * p.x) - cos(u_d * p.y));
}

float colorize(vec2 p0, vec2 p1){
    return (atan(p0.y, p0.x)/PI + 1.);
}


void main () {

    vec4 p0 = texelFetch(uPointsData, ivec2(gl_FragCoord.xy), 0);
    vec2 p1 = iterate(p0.xy);
    float dist = colorize(p0.xy, p1);
    
    outPnt = vec4(p1, dist, 1.);

}
`;

