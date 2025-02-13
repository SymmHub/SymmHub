

#ifndef PI 
#define PI 3.1415926535897932384626433832795
#endif 

#ifndef MAX_GEN_COUNT
#define MAX_GEN_COUNT 4
#endif 

#ifndef MAX_ITERATIONS
#define MAX_ITERATIONS 100
#endif 

#ifndef MAX_REF_COUNT
#define MAX_REF_COUNT 4 
#endif 

// size of array to hold transforms to tiles around fundamental domain (crown transform)
#ifndef MAX_CROWN_COUNT
#define MAX_CROWN_COUNT 20
#endif 


// size of splane data transfer size 
#define SPLANE_DATA_SIZE 5
// fixed size array to transfer sides of fundamental domain via uniform vector 
#define DOMAIN_DATA_SIZE (SPLANE_DATA_SIZE*MAX_GEN_COUNT)

// size of single moebius transform data 
#define TRANSFORM_DATA_SIZE (MAX_REF_COUNT*SPLANE_DATA_SIZE)

// size of array to hold group transform data 
#define TRANSFORMS_DATA_SIZE (MAX_GEN_COUNT*TRANSFORM_DATA_SIZE)

// size of array to hold crown transform data 
#define CROWN_DATA_SIZE (MAX_CROWN_COUNT*TRANSFORM_DATA_SIZE)


#define SPLANE_IDENTITY 0
#define SPLANE_SPHERE   1
#define SPLANE_PLANE    2
#define SPLANE_POINT    3
#define SPLANE_INFINITY 4

float EPSILON = 1.e-10;

struct iSPlane { // sphere of plane 
  int type;     // 0 - sphere, 1 plane 
  vec3 center;  // center of sphere or normal to plane 
  float radius; // radius of sphere or distance to plane from origin
};


// description of fundamental domain 
struct iFundamentalDomain {
	iSPlane s[MAX_GEN_COUNT];  // sides of fundamental domain 
	int count;               // actual count of sides 
};


// moebius transform is sequence of general reflections 
struct iMoebiusTransform {
	iSPlane s[MAX_REF_COUNT];  // place holder for sequence of reflections in spanes 
	int length;       // actual lengh of sequence 
};

struct iInversiveGroup {
	iSPlane s[MAX_GEN_COUNT];           // sides of fundamental domain 
	iMoebiusTransform t[MAX_GEN_COUNT]; // pairing moebius transforms 
	int count;   // actual count of sides
};

struct iCrown {
	iMoebiusTransform t[MAX_GEN_COUNT]; // holder for all moebius transforms 
	int count;   // actual count of transforms 
};

//
//  conversion from fraction to angles 
//
float getAngle(float n){
	if( n >= 20.) 
		return 0.;
	else 
		return PI/float(n);
}


// color compositions are based on paper 
// based on Porter T.,Duff T.(1984) Composing Digital Images.
// anti-aliased color composition is defined as result in the 4 possible areas 
// (nA /\ nB, A /\ nB,  nA /\ B,  A /\ B)  
//  where  /\ - intersection 
//   nA - complement of A 
//
// combine pre-multiplied colors and store result in the first color
//  B over A    most common combination: 
// (0, A, B, B) 
void overlay(inout vec4 ca, vec4 cb){
	ca = (1.-cb.w)*ca + cb;
}

void iCombineBoverA(inout vec4 ca, vec4 cb){
	overlay(ca, cb);
}

// makes pre-multiplied color 
vec4 iPremultColor(vec4 C){
	return vec4(C.xyz*C.w, C.w);
}

// makes full color from premult 
vec4 iFullColor(vec4 c){
	if(c.w != 0.) 
		return vec4(c.xyz*(1./c.w), c.w);
	else 
		return vec4(0., 0., 0., 0.);
}

//
//  covert signed distance to density 
//
float iToDensity(float distance, float blur){	
	return 1.-smoothstep(-blur,blur, distance);
}


//
//  reflect in the splane 
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


//
//  transform point using Moebius transform 
//
void iTransform(iMoebiusTransform mt, inout vec3 p, inout float scale){
	for(int i = 0; i < MAX_REF_COUNT; i++){
		if(i < mt.length){
			// reflect in the splane 
			iReflect(mt.s[i], p, scale);
		}
	}
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
//	splane initialization from vec4 and type 
//
iSPlane iGeneralSplane(vec4 param, int type){
	
	if(type == SPLANE_PLANE)
		return iPlane(param);
	else if(type == SPLANE_SPHERE)
		return iSphere(param);
	else 
		return iIdentity();
}


//
//	returns plane with given normal and point on plane
//
iSPlane iPlane(vec3 normal, vec3 pointOnPlane){
	
	normal  = normalize(normal);
    float distance = dot(normal, pointOnPlane);
	return iSPlane(SPLANE_PLANE,normal, distance);
	
}

//
//  transforms point into fundamental domain 
//	returns distance to the limit set 
//
float iToFundamentalDomain(iFundamentalDomain fd, inout vec3 p, inout int inDomain, inout int refcount, inout float scale){
			
	refcount = 0;
	inDomain = 0;
	int genCount = 4;
    
	for(int count = 0; count < MAX_ITERATIONS; count++){
	
		int found = 0;
		// we move the point into interior of fundamental domain, where all distance should be negative 
		for(int i =0; i < MAX_GEN_COUNT; i++){
			if(i < fd.count){
				float ip = iDistance(fd.s[i], p);
				if(ip > 0.){
					iReflect(fd.s[i], p, scale);
					refcount++;	
					found = 1;
					break;
				}
			}
		}
		if(found == 0){
			// no new reflections found - we are in the fundamental domain
			inDomain = 1;			
			break;
		}		
	}
			
	float dist = 1./scale;		
	return dist;
	
}

float iToFundamentalDomain(iFundamentalDomain fd, inout vec3 p, inout int inDomain, inout int refcount, inout float scale, int iterations){
			
	refcount = 0;
	inDomain = 0;
	int genCount = 4;
#if __VERSION__ < 300 		
	for(int count = 0; count < MAX_ITERATIONS; count++){
		if(count < iterations)
#else     
	for(int count = 0; count < iterations; count++){
#endif   		
        {
			int found = 0;
			// we move the point into interior of fundamental domain, where all distance should be negative 
			for(int i =0; i < MAX_GEN_COUNT; i++){
				if(i < fd.count){
					float ip = iDistance(fd.s[i], p);
					if(ip > 0.){
						iReflect(fd.s[i], p, scale);
						refcount++;	
						found = 1;
						break;
					}
				}
			}
			if(found == 0){
				// no new reflections found - we are in the fundamental domain
				inDomain = 1;			
				break;
			}		
		}
	}
			
	float dist = 1./scale;		
	return dist;
	
}

//
//  transforms point into fundamental domain of inversive group 
//	
//
void iToFundamentalDomain(iInversiveGroup group, inout vec3 p, out int inDomain, out int refcount, inout float scale){
			
	refcount = 0;
	inDomain = 0;
	int genCount = 4;
    
	for(int count = 0; count < MAX_ITERATIONS; count++){
	
		int found = 0;
		// we move the point into interior of fundamental domain, where all distance should be negative 
		for(int i =0; i < MAX_GEN_COUNT; i++){
			
			if(i < group.count){
				
				float ip = iDistance(group.s[i], p);
				if(ip > 0.){
					
					iTransform(group.t[i], p, scale);
					
					refcount++;	
					found = 1;
					break;
				}
			}
		}
		if(found == 0){
			// no new reflections found - we are in the fundamental domain
			inDomain = 1;			
			break;
		}		
	}
				
}

//
//  transforms point into fundamental domain of inversive group 
//	
//
void iToFundamentalDomain(iInversiveGroup group, inout vec3 p, out int inDomain, out int refcount, inout float scale, int iterations){
			
	refcount = 0;
	inDomain = 0;
    
	for(int count = 0; count < MAX_ITERATIONS; count++){
		if(count < iterations){
			int found = 0;
			// we move the point into interior of fundamental domain, where all distance should be negative 
			for(int i =0; i < MAX_GEN_COUNT; i++){
				
				if(i < group.count){
					
					float ip = iDistance(group.s[i], p);
					if(ip > 0.){
						
						iTransform(group.t[i], p, scale);
						
						refcount++;	
						found = 1;
						break;
					}
				}
			}
			if(found == 0){
				// no new reflections found - we are in the fundamental domain
				inDomain = 1;			
				break;
			}		
		}
	}
				
}


//
//  transforms point into fundamental domain of inversive group 
//	
//
void iToFundamentalDomain(

      inout vec3 p,  
      in float transData[TRANSFORMS_DATA_SIZE], // array of raw transform data 
			in float domainData[DOMAIN_DATA_SIZE],  // array of raw domain data 
			in int refCount[MAX_GEN_COUNT],  // count of reflections for each generator
			in int genCount, // generators count       
      out int inDomain, 
      out int refcount, 
      inout float scale, 
      int iterations){
        
			
	refcount = 0;
	inDomain = 0;
    
	for(int count = 0; count <  MAX_ITERATIONS; count++){
    
		if(count < iterations){
			int found = 0;
			// we move the point into interior of fundamental domain, where all distance should be negative 
			for(int g =0; g < MAX_GEN_COUNT; g++){
        				
				if(g < genCount){
          #define SIND (5*g)
          iSPlane sp = iGeneralSplane(vec4(domainData[SIND], domainData[SIND+1], domainData[SIND+2], domainData[SIND+3]), int(domainData[SIND+4]));
          #undef SIND
          int rCount = refCount[g];				        
					float ip = iDistance(sp, p);
					if(ip > 0.){
						
            for(int r = 0; r  < MAX_REF_COUNT; r++){
              if(r < rCount){
                #define RIND (5*(g*MAX_REF_COUNT + r))
                iSPlane rsp = iGeneralSplane(vec4(transData[RIND], transData[RIND+1], transData[RIND+2], transData[RIND+3]), int(transData[RIND+4]));                
                #undef RIND
                iReflect(rsp, p, scale);
              }
            }
						refcount++;	
						found = 1;
						break;
					}
				}
			}
			if(found == 0){
				// no new reflections found - we are in the fundamental domain
				inDomain = 1;			
				break;
			}		
		}
	}
				
}


//
//
//
//
vec4 iGetFundDomainInterior(vec3 pnt, iFundamentalDomain fd, vec4 color, float pixelSize){
	
	vec4 pcolor = vec4(0.,0.,0.,0.);
	float d = 1.;
	for(int i =0; i < MAX_GEN_COUNT; i++){
		if(i < fd.count){
			d *= iToDensity(iDistance(fd.s[i], pnt),pixelSize);		
		}
	}
	
	iCombineBoverA(pcolor,color*d);							
	
	return pcolor;	
	
}

//
//
//  
vec4 iGetFundDomainInterior(vec3 pnt, float sides[DOMAIN_DATA_SIZE], int count, vec4 color, float pixelSize){
	
	vec4 pcolor = vec4(0.,0.,0.,0.);
	float d = 1.;
	for(int i =0; i < MAX_GEN_COUNT; i++){
		if(i < count){
			#define IND (5*i)			
      iSPlane sp = iGeneralSplane(vec4(sides[IND], sides[IND+1], sides[IND+2], sides[IND+3]), int(sides[IND+4]));
      #undef IND       
      d *= iToDensity(iDistance(sp, pnt),pixelSize);		
		}
	}
	
	iCombineBoverA(pcolor,color*d);							
	
	return pcolor;	
	
}


//
//
//
vec4 iGetFundDomainOutline(vec3 pnt, iFundamentalDomain fd, vec4 lineColor, float lineWidth, float pixelSize, float offset){
	
	//vec4 pcolor = vec4(0.,0.,0.,0.);
  
  float dens = 0.;
	for(int i =0; i < MAX_GEN_COUNT; i++){
		if(i < fd.count){
			float d = abs(iDistance(fd.s[i], pnt)+offset);		
			if(d < lineWidth){
				float a = clamp((lineWidth-d)/pixelSize,0.,1.);			
				dens = max(dens, a); 
			}		
		}
	}
  
	return dens*lineColor;
	
}

//
//
//
vec4 iGetFundDomainOutline(vec3 pnt, iFundamentalDomain fd, vec4 lineColor, float lineWidth, float pixelSize){
	return iGetFundDomainOutline(pnt, fd, lineColor, lineWidth, pixelSize, 0.);
}

//
//
//
vec4 iGetFundDomainOutline(vec3 pnt, iInversiveGroup group, vec4 lineColor, float lineWidth, float pixelSize){
	
  float dens = 0.;

	for(int i =0; i < MAX_GEN_COUNT; i++){
		if(i < group.count){
			float d = abs(iDistance(group.s[i], pnt));		
			if(d < lineWidth){
				float a = clamp((lineWidth-d)/pixelSize,0.,1.);			
				dens = max(dens, a); 
			}		
		}
	}
			
	return dens*lineColor;
	
}


//
//
//
vec4 iGetFundDomainOutline(vec3 pnt, float sides[DOMAIN_DATA_SIZE], int count, vec4 lineColor, float lineWidth, float pixelSize, float offset){
	
  float dens = 0.;
      
	for(int i =0; i < MAX_GEN_COUNT; i++){
		if(i < count){
      #define IND (5*i)			
      iSPlane sp = iGeneralSplane(vec4(sides[IND], sides[IND+1], sides[IND+2], sides[IND+3]), int(sides[IND+4]));
      #undef IND       
      float d = abs(iDistance(sp, pnt)+offset);		
      if(d < lineWidth+pixelSize){
        float a = clamp((lineWidth-d)/pixelSize,0.,1.);			
				dens = max(dens, a); 
      }		
		}
	}
			
	return dens*lineColor;
	
}


vec4 iGetSplaneOutline(vec3 pnt, iSPlane splane, vec4 lineColor, float lineWidth, float pixelSize){
	
	// transparent color 
	vec4 pcolor = vec4(0.,0.,0.,0.);
		
	float d = abs(iDistance(splane, pnt));		
	if(d < lineWidth){
		float a = clamp((lineWidth-d)/pixelSize,0.,1.);			
		iCombineBoverA(pcolor,lineColor*a);		
	}		
		
	
	return pcolor;	
	
}

//
//  initialize fundamental domain from array of sides stored in float array 
//  
//
/*
void initFundDomain(in float sides[DOMAIN_DATA_SIZE],in int count,inout iFundamentalDomain fundDomain){
	
	fundDomain.count = count;
	for(int g = 0; g < count; g++){
		#define IND (5*g)			
		fundDomain.s[g] = iGeneralSplane(vec4(sides[IND], sides[IND+1], sides[IND+2], sides[IND+3]), int(sides[IND+4]));
		#undef IND 
	}
}
*/
void initFundDomain(in float sides[DOMAIN_DATA_SIZE],in int count,inout iFundamentalDomain fundDomain){
	
	fundDomain.count = count;
	for(int g = 0; g < MAX_GEN_COUNT; g++){
		if(g < count){
			#define IND (5*g)			
			fundDomain.s[g] = iGeneralSplane(vec4(sides[IND], sides[IND+1], sides[IND+2], sides[IND+3]), int(sides[IND+4]));
			#undef IND 
		}
	}
}


/**
	initialize group from raw data 
*/
void initGroup(in float transData[TRANSFORMS_DATA_SIZE], // array of raw transform data 
			   in float domainData[DOMAIN_DATA_SIZE],  // array of raw domain data 
			   in int refCount[MAX_GEN_COUNT],  // count of reflections for each generator
			   in int genCount, // generators count 
			   inout iInversiveGroup group){
	
	group.count = genCount;
	
	for(int g = 0; g < MAX_GEN_COUNT; g++){
		if(g < genCount){
			#define SIND (5*g)
			group.s[g] = iGeneralSplane(vec4(domainData[SIND], domainData[SIND+1], domainData[SIND+2], domainData[SIND+3]), int(domainData[SIND+4]));
			#undef SIND
			int rCount = refCount[g];
			group.t[g].length = rCount;
			for(int r = 0; r  < MAX_REF_COUNT; r++){
				if(r < rCount){
					#define RIND (5*(g*MAX_REF_COUNT + r))
					group.t[g].s[r] = iGeneralSplane(vec4(transData[RIND], transData[RIND+1], transData[RIND+2], transData[RIND+3]), int(transData[RIND+4]));
					#undef RIND
				}
			}
		}
	}
}

void initGroup2(in float transData[TRANSFORMS_DATA_SIZE], // array of raw transform data 
			   in float domainData[DOMAIN_DATA_SIZE],  // array of raw domain data 
			   in int refCount[MAX_GEN_COUNT],  // count of reflections for each generator
			   in int genCount, // generators count 
			   inout iInversiveGroup group){
	
	group.count = genCount;
	
	for(int g = 0; g < genCount; g++){
		#define SIND (5*g)
		group.s[g] = iGeneralSplane(vec4(domainData[SIND], domainData[SIND+1], domainData[SIND+2], domainData[SIND+3]), int(domainData[SIND+4]));
		#undef SIND
		int rCount = refCount[g];
		group.t[g].length = rCount;
		for(int r = 0; r  < rCount; r++){
			#define RIND (5*(g*MAX_REF_COUNT + r))
			group.t[g].s[r] = iGeneralSplane(vec4(transData[RIND], transData[RIND+1], transData[RIND+2], transData[RIND+3]), int(transData[RIND+4]));
			#undef RIND
		}
	}
}

/**
	init crown from raw transform data 
*/
void initCrown(in float transData[CROWN_DATA_SIZE], // array of raw transform data 
			   in int refCount[MAX_CROWN_COUNT],  // count of reflections for each transform
			   in int count, 
			   inout iCrown crown){
	
	crown.count = count;
	
	for(int g = 0; g < MAX_GEN_COUNT; g++){
		if(g < count){
			int rCount = refCount[g];
			crown.t[g].length = rCount;
			for(int r = 0; r  < MAX_REF_COUNT; r++){
				if(r < rCount){
					#define RIND (5*(g*MAX_REF_COUNT + r))
					crown.t[g].s[r] = iGeneralSplane(vec4(transData[RIND], transData[RIND+1], transData[RIND+2], transData[RIND+3]), int(transData[RIND+4]));
					#undef RIND
				}
			}
		}
	}
}


//
//  apply moebius transform to the point 
//
void transformPoint(inout vec3 v, float td[TRANSFORM_DATA_SIZE], inout float ss){

		for(int r = 0; r  < MAX_REF_COUNT; r++){
			#define RIND (5*(r))
			iSPlane splane = iGeneralSplane(vec4(td[RIND+0],td[RIND+1],td[RIND+2], td[RIND+3]), int(td[RIND+4]));   
			#undef RIND			
			iReflect(splane, v, ss);					
		}
}


/**
  transforms point into fundamental domain of inversive group 
	
*/
void iToWalledFundamentalDomain(

	inout vec3 p,  
	in float transData[TRANSFORMS_DATA_SIZE], // array of raw transform data 
	in float domainData[DOMAIN_DATA_SIZE],  // array of raw domain data 
	in int domainCount[MAX_GEN_COUNT], // cumulative count of sides per fd
	in int refCount[MAX_GEN_COUNT],  // cumulative count of reflections for each generator
	in int genCount, // generators count       
	out int inDomain, 
	out int refcount, 
	inout float scale, 
	int iterations){
        
	refcount = 0;
	inDomain = 0;
	int check;
	int sind,rind,startCount,rCount, eCount;
//	int indMinus,indPlus;
	iSPlane sp;
	
	
	for(int count = 0; count < iterations; count++){
		int found = 0;
		// we move the point into interior of fundamental domain, where all distance should be negative 
		for(int g =0; g < genCount; g++){
			
			check=1;		
			
			if(g==0)
        startCount=0;
			else 
        startCount = domainCount[g-1];
      
			eCount = domainCount[g]-startCount;
			
			for(int gg =0; gg < eCount && check > 0; gg++){
				sind=5*(startCount+gg);
				sp	= iGeneralSplane(vec4(domainData[sind], domainData[sind+1], domainData[sind+2], domainData[sind+3]), int(domainData[sind+4]));
				if(iDistance(sp, p) <= 0.)
          check = -1;
			}
			
			if(check > 0){
				// refcount is now cumulative!!
				// rCount is the number of reflections in the generator
				startCount = 0;
				if(g > 0){
					startCount = refCount[g-1];
				}
				rCount = refCount[g]-startCount;
								
				for(int r = 0; r < rCount; r++){
						rind = (5*(startCount + r));
						iSPlane rsp = iGeneralSplane(vec4(transData[rind], transData[rind+1], transData[rind+2], transData[rind+3]), int(transData[rind+4]));                
						iReflect(rsp, p, scale);
					}
				
				refcount++;	
				found = 1;
				break;
			}
		}
	
		if(found == 0){
			// no new reflections found - we are in the fundamental domain
			inDomain = 1;			
			break;
		}		
	}			
}



//
//
//  
vec4 iGetWalledFundDomainInterior(vec3 pnt, float sides[DOMAIN_DATA_SIZE], int domainCount[MAX_GEN_COUNT], int count, vec4 color, float pixelSize){
	
	vec4 pcolor = vec4(0.,0.,0.,0.);
	float d = 1.;
	int ind;
	int ii;
	
	for(int i =0; i < MAX_GEN_COUNT; i++){
		if(i < count){
			if(i==0){ii=0;}
			else{ii=domainCount[i-1];}
			ind = 5*ii;			
			iSPlane sp = iGeneralSplane(vec4(sides[ind], sides[ind+1], sides[ind+2], sides[ind+3]), int(sides[ind+4]));      
			float dd = iDistance(sp,pnt);
			if(dd>pixelSize){
				// further check to see if this domain wall should even count:
				int use = 1;
				int n = domainCount[i]-ii;
				for(int j=1; j<n && use ==1; j++){
					ind = 5*(ii+j);
					sp = iGeneralSplane(vec4(sides[ind], sides[ind+1], sides[ind+2], sides[ind+3]), int(sides[ind+4]));      
					if(iDistance(sp,pnt)<0.){
						use = -1;
					}
				}
				if(use==1){
					d *= iToDensity(dd, pixelSize);
				}
			}
		}
	}
	iCombineBoverA(pcolor,color*d);							
	return pcolor;	
}

//
//
//  
vec4 iGetWalledFundDomainExterior(vec3 pnt, float sides[DOMAIN_DATA_SIZE], int domainCount[MAX_GEN_COUNT], int count, vec4 color, float pixelSize){
	
	vec4 pcolor = vec4(0.,0.,0.,0.);
	float d = 1.;
	int ind;
	int ii;
	
	for(int i =0; i < MAX_GEN_COUNT; i++){
		if(i < count){
			if(i==0){ii=0;}
			else{ii=domainCount[i-1];}
			ind = 5*ii;			
			iSPlane sp = iGeneralSplane(vec4(sides[ind], sides[ind+1], sides[ind+2], sides[ind+3]), int(sides[ind+4]));      
			float dd = iDistance(sp,pnt);
			if(dd>pixelSize){
				// further check to see if this domain wall should even count:
				int use = 1;
				int n = domainCount[i]-ii;
				for(int j=1; j<n && use ==1; j++){
					ind = 5*(ii+j);
					sp = iGeneralSplane(vec4(sides[ind], sides[ind+1], sides[ind+2], sides[ind+3]), int(sides[ind+4]));      
					if(iDistance(sp,pnt)<0.){
						use = -1;
					}
				}
				if(use==1){
					d *= iToDensity(dd, pixelSize);
				}
			}
		}
	}
	iCombineBoverA(pcolor,color*(1.0-d));							
	return pcolor;	
}

//
//
//
vec4 iGetWalledFundDomainOutline(vec3 pnt, float sides[DOMAIN_DATA_SIZE], int domainCount[MAX_GEN_COUNT], int count, vec4 lineColor, float lineWidth, float pixelSize, float offset)
{
	
	float dens = 0.;
  
	int ind, ii,n;
		
	for(int i =0; i < MAX_GEN_COUNT; i++){
		if(i < count){
      		if(i==0){ii=0;}
			else{ii=domainCount[i-1];}
			ind = 5*ii;
			n=domainCount[i]-ii;
			iSPlane sp = iGeneralSplane(vec4(sides[ind], sides[ind+1], sides[ind+2], sides[ind+3]), int(sides[ind+4]));    
			float d = abs(iDistance(sp, pnt)+offset);		
			if(d < lineWidth){
				// now check to make sure we aren't out of bounds
				int ok =1;
				
				for(int j=1; j < n && ok > 0; j++)
				{	ind = 5*(ii+j);
					iSPlane sp = iGeneralSplane(vec4(sides[ind], sides[ind+1], sides[ind+2], sides[ind+3]), int(sides[ind+4]));
					if(iDistance(sp,pnt) < 0.){
						ok=-1;
					}
				}
				if(ok > 0){
					float a = clamp((lineWidth-d)/pixelSize,0.,1.);			
					dens = max(dens, a);	
				}	
			}		
		}
	}
	return dens*lineColor;
}

