
export const  iterator_conradi_frag = 

`
uniform sampler2D uPointsData;

out vec4 outPnt;  // result of iteration 

uniform float u_a;
uniform float u_b;
vec2 iterate(vec2 p){
   
   return vec2(
        sin(p.x*p.x - p.y*p.y + u_a),
        cos(2.* p.x*p.y + u_b));
}

void main () {

    vec4 p0 = texelFetch(uPointsData, ivec2(gl_FragCoord.xy), 0);
    vec2 p1 = iterate(p0.xy);
    float dist = colorize(p0.xy, p1);
    
    outPnt = vec4(p1, dist, 1.);

}
`;

