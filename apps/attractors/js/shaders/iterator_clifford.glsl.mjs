
export const  iterator_clifford_frag = 

`
uniform sampler2D uPointsData;

out vec4 outPnt;  // result of iteration 

uniform float u_a;// = -1.2924227902;
uniform float u_b;// = -2.2028329188;
uniform float u_c;// =  2.9478754451; 
uniform float u_d;// = -0.6062945894;

vec2 iterate(vec2 p){
   
   return vec2(
        sin(u_a * p.y) + u_c * cos(u_a * p.x),
        sin(u_b * p.x) + u_d * cos(u_b * p.y));    
}

// experiment 
vec2 iterate_1(vec2 p){
   
   return vec2(
        (1.-u_c)*sin(u_a * p.y) + u_c * cos(u_a * p.x),
        (1.-u_d)*sin(u_b * p.x) + u_d * cos(u_b * p.y));    
}

void main () {

    vec4 p0 = texelFetch(uPointsData, ivec2(gl_FragCoord.xy), 0);
    vec2 p1 = iterate(p0.xy);
    float dist = colorize(p0.xy, p1);
    
    outPnt = vec4(p1, dist, 1.);

}
`;

