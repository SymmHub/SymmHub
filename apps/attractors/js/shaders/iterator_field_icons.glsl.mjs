
export const  iterator_field_icons_frag = 

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
uniform float u_e;
uniform float u_n;


vec2 iterate(vec2 z){

    // z = (a + b*z*conj(z) + c*re(z^n) + d * i )*z + e*conj(z^(n-1))
    return cMul(vec2(u_a + u_b*dot(z,z) + u_c*cPow(z, u_n).x, u_d), z) + u_e * cPow(z, u_n-1.)*vec2(1., -1.);
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

