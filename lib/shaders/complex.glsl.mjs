export const complex = 
/*glsl*/`
#ifndef PI 
#define PI 3.1415926535897932384626433832795
#endif 


/**
complex multiplication 
*/
vec2 cMul(vec2 a, vec2 b){
	return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
}
// complex division 
vec2 cDiv( vec2 a, vec2 b ) {
        float d = dot(b,b);
        return vec2( dot(a,b), a.y*b.x - a.x*b.y ) / d;
}


// complex inverse 
vec2 cInverse(vec2 a) {
	return	vec2(a.x,-a.y)/dot(a,a);
}


vec2 cExp(vec2 p) {
	return vec2(exp(p.x) * cos(p.y), exp(p.x) * sin(p.y));
}

//
//	complex log(z)
//
vec2 cLog(vec2 a) {
	float b =  atan(a.y,a.x);
	//if (b > 0.0) b -= 2.0*PI; // ??? 
	return vec2(log(length(a)),b);
}

vec2 cPow(vec2 z, float n){
    return cExp(n*cLog(z));
}
/*
void cLog(inout vec3 p, inout float scale) {
	scale *= 1./length(p.xy);
	p.xy = cLog(p.xy);
}
*/

/**
   complex tanh(z) and its scale |tanh'(z)| = 1/|cosh(z)|^2, z = x + iy:

       tanh(z) = (sinh 2x + i sin 2y)/(cosh 2x + cos 2y)

   written by e = exp(-2|x|), with d = (1 - e)^2 + 4e cos(y)^2 = 2e (cosh 2x + cos 2y):

       re = +-(1 - 2e (cos 2y + e)/d),   im = 2e sin 2y/d,   scale = 4e/d

   Far along the real axis tanh is next to +-1 and e is what is left of it. Here the
   real part is 1 less a small number, right to half a step of the floats next to 1,
   and d is a sum of squares; nothing overflows: far out the value is +-1 and the
   scale 0. As (e^z - e^-z)/(e^z + e^-z) the value was four to five steps off from
   |x| = 3 on, the disk's centre from 43.7 and no number further; the scale as
   |1 - tanh^2| was a hundredth off at |x| = 5, a half at 7, with no digits left from
   8 on (measured: tests/symhublib/view_chain_gpu.html, runBandCheck)
*/
vec2 cTanh(vec2 z, out float scale){

  float e = exp(-2.*abs(z.x));
  float c = cos(z.y), s = sin(z.y);
  float t = 1. - e;
  float d = t*t + 4.*e*c*c;
  float re = 1. - 2.*e*(2.*c*c - t)/d;
  scale = 4.*e/d;
  return vec2((z.x < 0.) ? -re : re, 4.*e*s*c/d);

}

/**
   complex tanh(z)
*/
vec2 cTanh(vec2 z){

  float scale;
  return cTanh(z, scale);

}


vec2 cSin(vec2 c){

    vec2 e = cExp(vec2(-c.y, c.x)); // exp(iz)
    return 0.5*(e-cInverse(c));    // (e - 1/e)/2
        
}

vec2 cCos(vec2 c){

    vec2 e = cExp(vec2(-c.y, c.x)); // exp(iz)
    return 0.5*(e + cInverse(c));    // (e + 1/e)/2
        
}


/**
   conformally maps infinite horizontal band -1 < y < 1 into unit disk 
*/
vec2 band2disc(vec2 z){
    return cTanh(z*(PI/4.));
}

/**
   conformally maps infinite horizontal band -1 < y < 1 into unit disk ignoring z component 
*/
//vec3 band2disc(vec3 p){
//    return vec3(cTanh(p.xy*(PI/4.)), p.z);
//}

//
//   conformally maps infinite horizontal band -1 < y < 1 into unit disk ignoring z component 
//
void band2disc(inout vec3 p, inout float scale){
	float coeff = (PI/4.);
	float ds;
    p = vec3(cTanh(p.xy*coeff, ds), p.z);
	scale *= coeff*ds;

}
//
//   conformally maps infinite horizontal band -1 < y < 1 into unit disk ignoring z component 
//  fraction - transition parameter 
//   when fraction = 0 - identity transform 
//   when fraction = 1 - band transform
//
// uses complex transformation 
//  z -> b*tanh(a*z) 
// where 
// a = fraction*pi/4
// b = 1/tan(a);  normal tan
void band2disc(inout vec3 p, inout float scale, float fraction){
	float a = (PI/4.)*fraction;
    
    if(abs(a) < 1.e-4) {
        // identity transform 
        return;
    }
    float b = 1./tan(a); // b = 1 when fraction = 1;
    float ds;
    p = vec3(b*cTanh(a*p.xy, ds), p.z);
	scale *= a*b*ds;

}

//
//	conformally map band to upper half plane using exp()
//
void band2uhp(inout vec3 p, inout float scale){
	//vec2 pp = cTanh(p.xy*coeff);
	vec2 pp = cExp(p.xy);
	scale *= length(pp);
	p.xy = pp;
}

/** 
	conformally maps upper-half plane y > 0 to the unit disk
*/
void uhp2disc(inout vec3 z, inout float scale){
	float mag = z.x*z.x + z.y*z.y;
	float denom = mag+2.*z.y+1.;
	float x = (1.-mag)/denom;
	float y = 2.*z.x/denom;
	z.x=x; z.y=y;
	scale *=2./denom;
}

vec2 uhp2disc(vec2 z){
	float mag = z.x*z.x + z.y*z.y;
	float denom = mag + 2.*z.y+1.;
	float x = (1. - mag)/denom;
	float y = 2.*z.x/denom;
	return vec2(x,y);
}

void plane2band(inout vec3 p, inout float scale){
  
	scale /= length(p);
	vec2 pp = cLog(p.xy);
	p.xy = pp;
  
}

/**
  complex multiplication acting on p.xy 
*/
void cScale(inout vec3 p, vec2 cScale, inout float scale){
  p.xy = cMul(p.xy, cScale);
  scale *= length(cScale);
}


/**
  maps cylinder or radius 1 along z axis into ball of radius 1
  point (0,0,oo) is mapped to (0,0,1)
  point (0,0,-oo) is mapped to (0,0,-1)
  unit circle in xy plane centered at (0,0,0) is mapped to itself 
  interior is mapped to interior
  surface is conformally(?) mapped to surface 
*/
vec3 cylinder2ball(vec3 p){

    float r = length(p.xy);
    
    vec2 w = vec2(p.z, r);

    vec2 u = band2disc(w);
    
    float s = u.y/r;
    
    return vec3(p.xy*s, u.x);
    
}
/*glsl*/`;
