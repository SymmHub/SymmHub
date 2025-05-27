export const ISO_MAIN = `

in vec2 vUv;
#define PI (3.1415926)

layout(location = 0) out vec4 outColor;


uniform float u_isoWidth;
uniform float u_isoShadowWidth;
uniform float u_isoShadowIntensity;
uniform float u_isoStep;
uniform float u_isoOffset;
uniform vec4 u_isoColor;
uniform int u_isoAlg; 
uniform vec2 u_symCenter;
uniform float u_time;
uniform float u_blur;
uniform float u_period;
uniform int u_symOrder;

bool mode = false;

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

vec3 getColor( in float t )
{
    vec3 col = vec3(0.4,0.4,0.4);
    
    col += 0.12*fcos(2.*PI*t*  1.0+vec3(0.0,0.8,1.1));
    col += 0.11*fcos(2.*PI*t*  3.1+vec3(0.3,0.4,0.1));
    col += 0.10*fcos(2.*PI*t*  5.1+vec3(0.1,0.7,1.1));
    col += 0.09*fcos(2.*PI*t*  9.1+vec3(0.2,0.8,1.4));
    col += 0.08*fcos(2.*PI*t* 17.1+vec3(0.2,0.6,0.7));
    col += 0.07*fcos(2.*PI*t* 31.1+vec3(0.1,0.6,0.7));
    col += 0.06*fcos(2.*PI*t* 65.1+vec3(0.0,0.5,0.8));
    col += 0.06*fcos(2.*PI*t*115.1+vec3(0.1,0.4,0.7));
    col += 0.09*fcos(2.*PI*t*265.1+vec3(1.1,1.4,2.7));
    col += 0.09*fcos(2.*PI*t*275.1+vec3(1.1,1.4,2.7));
    
    return col;
}

vec2 deform( in vec2 p )
{
    float a = 0.2;
    p += a*cos( 1.5*p.yx + 0.03*1.0*u_time + vec2(0.1,1.1) );
    p += a*cos( 2.4*p.yx + 0.03*1.6*u_time + vec2(4.5,2.6) );
    p += a*cos( 3.3*p.yx + 0.03*1.2*u_time + vec2(3.2,3.4) );
    p += a*cos( 4.2*p.yx + 0.03*1.7*u_time + vec2(1.8,5.2) );
    p += a*cos( 9.1*p.yx + 0.03*1.1*u_time + vec2(6.3,3.9) );
    
    return p;
}

vec2 noise( in vec2 p )
{
    float a = 0.2;
    p  = a*cos( 1.5*p.yx + 0.03*1.0*u_time + vec2(0.1,1.1) );
    p += a*cos( 2.4*p.yx + 0.03*1.6*u_time + vec2(4.5,2.6) );
    p += a*cos( 3.3*p.yx + 0.03*1.2*u_time + vec2(3.2,3.4) );
    p += a*cos( 4.2*p.yx + 0.03*1.7*u_time + vec2(1.8,5.2) );
    p += a*cos( 9.1*p.yx + 0.03*1.1*u_time + vec2(6.3,3.9) );
    
    return p;
}

float getValue(vec2 p){
    return (length(deform(p)));
    //return (length(noise(p)));
}

vec2 sdeform2( in vec2 p ){
    return (deform(p) + deform(-p));
    
}

float  getSymValue_N( in vec2 p ){

    float symOrder = float(u_symOrder);
    float phi = 2.*PI/symOrder;
    float ca = cos(phi);
    float sa = sin(phi);
    float count = symOrder;
    vec2 pt = p;
    float blur = u_blur;
    float v = 0.;
    
    for(float i = 0.; i < count; i++){
        
        v += smoothstep(-blur, blur, -pt.x*ca + pt.y*sa) * 
             smoothstep(-blur, blur, pt.y) * 
             getValue(pt);
       pt = vec2(pt.x*ca + pt.y * sa, -pt.x*sa + pt.y * ca);
    }
    return v;
    
}


vec2 sdeformX( in vec2 p ){

    vec2 v = vec2(0.);
    float blur = u_blur;
    float count = 10.;
    vec2 s = vec2(1., 1.);
    for(float i = 0.; i < count; i++){
        float period = u_period;
        float x0 = (i-0.5*count)*period;
        vec2 pt = (p - vec2(x0, 0.));
       v += smooth_box(x0, x0 + period, blur, p.x) * deform(pt*s);
       s.y = -s.y;
    }
    
    return v;
    
    //return smoothstep(-d, d, p.y)*v1 + (1.-smoothstep(-d, d, p.y))*v2;
    
}


float getSymValue(vec2 p){

    return getSymValue_N(p);
    
}

float getVisValue(vec2 p){
    return getSymValue(p);
}

float _getValue(vec2 p){

  return length(p) + sin(2.*p.x);

}


void main() {

  vec2 p = vUv;
  
  float v = getVisValue(p);
  float iso;
  switch(u_isoAlg){
    default:
    case 0: outColor = u_isoColor*isolines(v, u_isoOffset, u_isoStep, u_isoWidth); break;
    case 1: outColor = u_isoColor*isolines_v0(v, u_isoOffset, u_isoStep); break;
    case 2: outColor = u_isoColor*isolines_auto(v, u_isoStep, u_isoWidth); break;
    case 3: outColor = u_isoColor*isolines_with_shadow(v, u_isoOffset, u_isoStep,     
                                                       u_isoWidth, u_isoShadowWidth, u_isoShadowIntensity); 
    break;
    case 4: outColor = u_isoColor*isoline_with_shadow(v, u_isoOffset, u_isoWidth, u_isoShadowWidth, u_isoShadowIntensity); 
    break;
                                                       
    case 5: outColor = vec4(getColor((v-u_isoOffset)/u_isoStep), 1.); break;
  }
  //outColor = u_isoColor *  iso;
  
}
`;
