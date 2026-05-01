export const permutations = 
/*glsl*/`
#ifndef PERM_SIZE
#define PERM_SIZE 3
#endif 

#ifndef MAX_GEN_COUNT
#define MAX_GEN_COUNT 3
#endif 

#define PERMDATASIZE (MAX_GEN_COUNT*PERM_SIZE+2)

#ifndef TRANSFORMS_DATA_SIZE
#define TRANSFORMS_DATA_SIZE (MAX_GEN_COUNT*MAX_REF_COUNT*5)
#endif

#ifndef DOMAIN_DATA_SIZE
#define DOMAIN_DATA_SIZE (MAX_GEN_COUNT*5+1)
#endif

/**
  return composition of two permutations 
*/
void PermMul(int p1[PERM_SIZE], int p2[PERMDATASIZE], int offset2, out int p3[PERM_SIZE], int permSize){
    
  for(int i = 0; i < permSize; i++){
    p3[i] = p1[p2[i + offset2]]; 
  }
  
}

void PermIdentity(out int p[PERM_SIZE], int permSize){
  for(int i = 0; i < permSize; i++){
    p[i] = i;
  }  
}

void PermSet(int p0[PERM_SIZE], out int p1[PERM_SIZE], int permSize){
  for(int i = 0; i < permSize; i++){
    p1[i] = p0[i];
  }  
}


//
//  transforms point into fundamental domain using reflections and permutations 
//  
void iToFundamentalDomainPermRef(
        inout vec3 p, 
        float domain[DOMAIN_DATA_SIZE], 
        int permData[PERMDATASIZE], 
        int genCount, 
        inout int inDomain, 
        inout int refcount, 
        inout float scale, 
        int iterations,
        inout int perm[PERM_SIZE],
        int permSize){
      
  refcount = 0;
  inDomain = 0;
  int permT[PERM_SIZE];
  
  iSPlane splanes[MAX_GEN_COUNT];
  int tOffset = 0;
  for(int g =0; g < genCount; g++){             
    #define IND (5*g)			
    splanes[g] = iGeneralSplane(vec4(domain[IND], domain[IND+1], domain[IND+2], domain[IND+3]), int(domain[IND+4]));
    #undef IND       
  }
  
  for(int count = 0; count < iterations; count++){
  
    int found = 0;
    // we move the point into interior of the fundamental domain, where all distances should be negative 
    for(int g =0; g < genCount; g++){
      iSPlane sp = splanes[g];
      float ip = iDistance(sp, p);
      if(ip > 0.){ // outsize 
        iReflect(sp, p, scale);
        PermMul(perm, permData, g*permSize+2, permT, permSize);
        PermSet(permT, perm, permSize);
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
//  transforms point into fundamental domain using moebius transforms and permutations 
//  
void iToFundamentalDomainPerm(
        inout vec3 p, 
        in float transData[TRANSFORMS_DATA_SIZE], // array of raw transform data 
        in float domain[DOMAIN_DATA_SIZE],  // array of raw domain data 
        in int refCount[MAX_GEN_COUNT],  // count of reflections for each generator
        //float domainData[DOMAIN_DATA_SIZE], 
        int permData[PERMDATASIZE], 
        int genCount, 
        inout int inDomain, 
        inout int refcount, 
        inout float scale, 
        int iterations,
        inout int perm[PERM_SIZE],
        int permSize){
      
	refcount = 0;
	inDomain = 0;
  int permT[PERM_SIZE];
    
	for(int count = 0; count <  iterations; count++){
    
    int found = 0;
    // we move the point into interior of fundamental domain, where all distance should be negative 
    for(int g =0; g <  genCount; g++){
      #define SIND (5*g)
      iSPlane sp = iGeneralSplane(vec4(domain[SIND], domain[SIND+1], domain[SIND+2], domain[SIND+3]), int(domain[SIND+4]));
      #undef SIND
      int rCount = refCount[g];				        
      float ip = iDistance(sp, p);
      if(ip > 0.){
        // transform the point 
        for(int r = 0; r  < MAX_REF_COUNT; r++){
          if(r < rCount){
            #define RIND (5*(g*MAX_REF_COUNT + r))
            iSPlane rsp = iGeneralSplane(vec4(transData[RIND], transData[RIND+1], transData[RIND+2], transData[RIND+3]), int(transData[RIND+4]));                
            #undef RIND
            iReflect(rsp, p, scale);
          }
        }
        PermMul(perm, permData, g*permSize+2, permT, permSize);
        PermSet(permT, perm, permSize);
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
`;
