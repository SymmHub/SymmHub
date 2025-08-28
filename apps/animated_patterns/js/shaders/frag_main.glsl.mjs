export const frag_main = 
`
in vec2 vUv;
out vec4 outValue;

#define PI2 (2.*3.1415926)

bool mode;

vec3 fcos( vec3 x )
{
    if( mode) return cos(x);                // naive

    vec3 w = fwidth(x);
    #if 0
    return cos(x) * sin(0.5*w)/(0.5*w);     // filtered-exact
	#else
    return cos(x) * smoothstep(6.28,0.0,w); // filtered-approx
	#endif  
}

vec4 getColor( in float t )
{
    vec3 col = vec3(0.4,0.4,0.4);
    col += 0.12*fcos(PI2*t*  1.0+vec3(0.0,0.8,1.1));
    col += 0.11*fcos(PI2*t*  3.1+vec3(0.3,0.4,0.1));
    col += 0.10*fcos(PI2*t*  5.1+vec3(0.1,0.7,1.1));
    col += 0.09*fcos(PI2*t*  9.1+vec3(0.2,0.8,1.4));
    col += 0.08*fcos(PI2*t* 17.1+vec3(0.2,0.6,0.7));
    col += 0.07*fcos(PI2*t* 31.1+vec3(0.1,0.6,0.7));
    col += 0.06*fcos(PI2*t* 65.1+vec3(0.0,0.5,0.8));
    col += 0.06*fcos(PI2*t*115.1+vec3(0.1,0.4,0.7));
    col += 0.09*fcos(PI2*t*265.1+vec3(1.1,1.4,2.7));
    col += 0.09*fcos(PI2*t*275.1+vec3(1.1,1.4,2.7));
    return vec4(col, 1.);
}

uniform float uTime;
vec2 deform( in vec2 p, float time )
{
    float a = 0.2;
    p += a*cos( 1.5*p.yx + 1.0*time + vec2(0.1,1.1) );
    p += a*cos( 2.4*p.yx + 1.6*time + vec2(4.5,2.6) );
    p += a*cos( 3.3*p.yx + 1.2*time + vec2(3.2,3.4) );
    p += a*cos( 4.2*p.yx + 1.7*time + vec2(1.8,5.2) );
    p += a*cos( 9.1*p.yx + 1.1*time + vec2(6.3,3.9) );
    
    return p;
}

vec2 sdeform4(vec2 p, float time){
    return deform(p, time) + 
           deform(-p, time) +  
           deform(vec2(-p.y, p.x), time) + 
           deform(vec2( p.y, -p.x), time);
}

vec2 sdeform2(vec2 p, float time){
    return deform(p, time) + deform(-p, time);
}

vec2 sdeform( in vec2 p, float time ){

    return sdeform4(p, time);
    
}
    
void main(){
  
    mode = false;
  
    outValue = getColor(sdeform(2.*vUv, 0.05*uTime).x);
    
    // palette
    if( vUv.y < -0.9 ) outValue = getColor(vUv.x);
  
  
}
`;
