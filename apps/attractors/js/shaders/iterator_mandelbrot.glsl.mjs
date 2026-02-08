
export const  iterator_mandelbrot_frag = 

`
#ifndef PI
#define PI 3.14159265358979323846
#endif

uniform sampler2D uPointsData;

out vec4 outPnt;  // result of iteration 

uniform float u_a;
uniform float u_b;
uniform int u_type;


vec2 mandelbrot(vec2 p){
   return vec2(
        (p.x*p.x - p.y*p.y + u_a),
        (2.* p.x*p.y + u_b));
}

vec2 cInv(vec2 p){
    return vec2(p.x, -p.y)/dot(p,p);
}

vec2 inv_mandelbrot(vec2 p){

    p = cInv(p);
    p = vec2((p.x*p.x - p.y*p.y + u_a),(2.* p.x*p.y + u_b));
    return cInv(p);
}

// return (a+ib)*p
vec2 scale(vec2 p) {
    vec2 c = vec2(u_a, u_b);
    
    return vec2((c.x*p.x - c.y*p.y), (c.x * p.y + c.y*p.x));
}

vec2 shift(vec2 p) {
    vec2 c = vec2(u_a, u_b);
    
    return p + vec2(u_a, u_b);
}


vec2 iterate(vec2 p){
   
   switch(u_type){
        default: 
        case 0: return mandelbrot(p);
        case 1: return inv_mandelbrot(p);
        case 2: return scale(p);        
        case 3: return shift(p);        
   }
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

