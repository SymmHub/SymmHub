//
// https://en.wikipedia.org/wiki/Tinkerbell_map
//
export const  iterator_tinkerbell_frag = 

`
#ifndef PI
#define PI 3.14159265358979323846
#endif

uniform sampler2D uPointsData;

out vec4 outPnt;  // result of iteration 

uniform float u_a;
uniform float u_b;
uniform float u_c;
uniform float u_d;

vec2 iterate(vec2 p){
   
   return vec2(
        (p.x*p.x - p.y*p.y + u_a*p.x + u_b*p.y),
        (2.* p.x*p.y + u_c*p.x + u_d*p.y));
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

