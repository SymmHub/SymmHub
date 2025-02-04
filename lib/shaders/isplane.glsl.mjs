export const isplane = 
`
#define SPLANE_IDENTITY 0
#define SPLANE_SPHERE   1
#define SPLANE_PLANE    2
#define SPLANE_POINT    3
#define SPLANE_INFINITY 4



struct iSPlane { // sphere of plane 
  int type;     // 0 - sphere, 1 plane 
  vec3 center;  // center of sphere or normal to plane 
  float radius; // radius of sphere or distance to plane from origin
};


float linearstep(float edge0, float edge1, float x)
{
    return  clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

//
//  distance to the splane
//
float iDistance(iSPlane s, vec3 v){	

	if(s.type == SPLANE_SPHERE){ 
		// sphere is defined via it's external normal 
		// is radius > 0  - exterior of sphere is positive (empty)  and interior is negative (solid)
		// if radius < 0 - exterior of sphere is negative (solid) and interior is positive (empty) 		
		v -= s.center; 
		float d = sqrt(dot(v,v)) - abs(s.radius);
		if(s.radius > 0.) // inside is solid (negative) 
			return d;   
		else 
			return -d;  // outside is solid (negative)			
	} if(s.type == SPLANE_PLANE) { // plane 
		// plane is defined via it's external normal and signed distance to the origin
		return (dot(v,s.center) - s.radius);
		
	} else {
		return 1.; // outside of undefined object 
	}
}

//
//	returns plane with given normal and distance to origin 
//
iSPlane iPlane(vec3 normal, float distance){
	
	normal = normalize(normal);
	return iSPlane(SPLANE_PLANE,normal, distance);
	
}

//
//  return plane. params are packed into single vec4 (normal, distance) 
//
iSPlane iPlane(vec4 plane){
	
	return iPlane(plane.xyz,plane.w);
	
}

// 
// identity splane == identity transforms 
// 
iSPlane iIdentity(){
	return iSPlane(SPLANE_IDENTITY, vec3(0.,0.,0.),0.);
}

//
//	returns sphere with given radius and center 
//

iSPlane iSphere(vec3 center, float radius){

	return iSPlane(SPLANE_SPHERE,center, radius);
	
}

//
// return sphere. Params are packed into a single vec4 (center, radius)
//
iSPlane iSphere(vec4 sphere){
	return iSphere(sphere.xyz,sphere.w);
}


//
//  covert signed distance to density 
//
float iToDensity(float distance, float blur){	
	return 1.-smoothstep(-blur,blur, distance);
}

//
//	splane initialization from vec4 and type 
//
iSPlane iGeneralSplane(vec4 param, int type){
	
  switch(type){
    case SPLANE_PLANE: return iPlane(param);
    case SPLANE_SPHERE: return iSphere(param);
    default: iIdentity();
  }
  /*
	if(type == SPLANE_PLANE)
		return iPlane(param);
	else if(type == SPLANE_SPHERE)
		return iSphere(param);
	else 
		return iIdentity();
  */
}

//
//  reflect point in the in the splane 
//
void iReflect(iSPlane s, inout vec3 v, inout float scale){

	if(s.type == SPLANE_PLANE){ // plane
  
		float vn = dot( v - s.center*s.radius, s.center);
		v -= 2.*vn*s.center;
    
	} else if(s.type == SPLANE_SPHERE){
    
		v = v - s.center;
		float len2 = dot(v,v);
		float r2 = s.radius;
		r2 *= r2;
		float factor = (r2/len2);
		v *= factor;
		scale *= factor;
		v += s.center;
    
	} 
}
`;
