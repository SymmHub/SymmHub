export const projection = 
`
#define HAS_PROJECTION 

#ifndef TRANSFORM_DATA_SIZE 

#ifndef MAX_GEN_COUNT
#define MAX_GEN_COUNT 4
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

#endif // TRANSFORM_DATA_SIZE


//#ifdef USE_MOEBIUS_TRANSFORM
uniform bool uHasMoebiusTransform;
uniform float uMoebiusTransformData[TRANSFORM_DATA_SIZE];  // moebius transforms data 
//#endif 	

#ifdef USE_ANIMATION_TRANSFORM
uniform int uHasAnimationTransform;
uniform float uAnimationTransformData[TRANSFORM_DATA_SIZE];  // animation transforms data 
#endif 	

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

#ifndef USE_PERIODIC_WRAP
#define USE_PERIODIC_WRAP
uniform bool uPeriodicWrapEnabled;
#define PERIODIC_WRAP_DATA_SIZE (7*3)
uniform float uPeriodicWrapData[PERIODIC_WRAP_DATA_SIZE];
uniform int  uPWdim; // periodic wrap dimension 
uniform vec3 uPWcenter;  // FD center
uniform vec3 uPWa1;  // lattice vectors
uniform vec3 uPWa2;
uniform vec3 uPWa3;
uniform vec3 uPWd1;  // dual lattice vectors 
uniform vec3 uPWd2;
uniform vec3 uPWd3;

//
// transform point into fundamental domain of periodic lattice corresponding to 
// reciprocal vectors uPW1, uPW2
//
void periodicWrap(inout vec3 p, inout float scale){

    #define A(i) (uPeriodicWrapData[i])
    #define VA(k) vec3(A(3*k),A(3*k+1),A(3*k+2))
    #define VD(k) vec3(A(3*k+9),A(3*k+9+1),A(3*k+9+2))
    #define A1 VA(0)
    #define A2 VA(1)
    #define A3 VA(2)
    #define D1 VD(0)
    #define D2 VD(1)
    #define D3 VD(2)
    #define C  vec3(A(18),A(18+1),A(18+2))
    vec3 a1 = A1;
    vec3 a2 = A2;
    vec3 a3 = A3;
    vec3 center = C.x * a1 + C.y * a2 + C.z * a3;
    
    p -= center;
    vec3 e = vec3(dot(p,D1),dot(p,D2),dot(p,D3));
    
    e -= round(e); // e.xyz in [-0.5, 0.5];
    
    p = vec3(e.x * a1 + e.y*a2 + e.z * a3);

    p += center;

    #undef A1
    #undef A2
    #undef A3
    #undef D1
    #undef D2
    #undef D3
    #undef C 
    
}

#endif // USE_PERIODIC_WRAP

#ifndef RATIONAL_MAP_DATA_SIZE
#define RATIONAL_MAP_DATA_SIZE (4*3+1)
#endif 
uniform float uRationalMapData[RATIONAL_MAP_DATA_SIZE];
uniform bool  uRationalMapEnabled;


//
//  applies complex rational function to the point 
//
void rationalMap(inout vec3 p3, inout float scale){
      
      #define PX(k) (uRationalMapData[k*3+1])
      #define PY(k) (uRationalMapData[k*3+2])
      #define PT(k) int(uRationalMapData[k*3+3])
      #define COUNT()  int(uRationalMapData[0])

      int count = COUNT();
      
      vec2 q = p3.xy;
      // initial valye
      vec2 qp = vec2(1.,0.);
      float div0 = fwidth(length(q));

      for(int i = 0; i < count; i++){
        vec2 s = q - vec2(PX(i), PY(i));
        switch(PT(i)){
            default: break;
            case 3:    qp = cMul(qp, cMul(s,cMul(s,s))); break;
            case 2:    qp = cMul(qp, cMul(s,s));         break;
            case 1:    qp = cMul(qp, s);                 break;
            case -1:   qp = cDiv(qp, s);                 break;
            case -2:   qp = cDiv(qp, cMul(s,s));         break;
            case -3:   qp = cDiv(qp, cMul(s,cMul(s,s))); break;
        }
      }
      #undef PX
      #undef PY
      #undef PT
      
      p3.xy = qp;
      
      float div1 = fwidth(length(qp));
      scale *= div1/div0;  // hardware derivative 
     
}

void projection_loxodromic(inout vec3 p, inout float scale){

    // maps [(-1,0), (1,0)] into [(0,0) , oo]
    iSPlane s = iSphere(vec3(-1.,0,0),2.);
    iReflect(s, p, scale);
    p.x -= 1.;
    // maps  [(0,0) , oo] into  [-oo, oo]
    plane2band(p, scale);

}


uniform int uProjection;

#define PROJECTION_CIRCLE 0
#define PROJECTION_LOG 1
#define PROJECTION_BAND 2
#define PROJECTION_UHP 3
#define PROJECTION_EXP_0_oo 4
#define PROJECTION_LOXODROMIC 5
#define PROJECTION_SPHERE 6
#define RATIONAL_PLUS_EXP_0_oo 7

// params of EXP mapping 
uniform vec2 uCScale;
uniform bool uCScaleEnabled;

        
vec2 makeProjection(inout vec2 p, inout float scale){
    
    vec3 p3 = vec3(p, 0.);
    if(uHasMoebiusTransform){    
        transformPoint(p3, uMoebiusTransformData, scale);    
    }
    
    if(uRationalMapEnabled) 
        rationalMap(p3, scale);
        
    switch(uProjection){
    default: 
    case PROJECTION_CIRCLE: break;
    
    case PROJECTION_LOG:
        band2uhp(p3, scale);
        break;
    
    case PROJECTION_EXP_0_oo: {

            // maps  [(0,0) , oo] into  [-oo, oo]
            plane2band(p3, scale);
            if (uCScaleEnabled) cScale(p3, uCScale, scale);               
            break;
        }
    
    //case PROJECTION_LOG:    return band2uhp(p);
    case PROJECTION_BAND:   {
            band2disc(p3, scale); 
            break;
        }
        
    case PROJECTION_UHP:    {
            uhp2disc(p3, scale);  
            break;
        }
        
      case PROJECTION_LOXODROMIC: {

            projection_loxodromic(p3, scale);
            if (uCScaleEnabled) cScale(p3, uCScale, scale);
        }
        
    }
    if(uPeriodicWrapEnabled)
       periodicWrap(p3, scale);

    p = p3.xy;
    return p;
}
`;

