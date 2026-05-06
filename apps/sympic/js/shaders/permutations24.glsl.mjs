// Implementation for Permutations of up to  24 elements, 
// 

export const permutations24 = 
/*glsl*/`

#ifndef MAX_GEN_COUNT
#define MAX_GEN_COUNT 6
#endif 

uvec4 perm_identity(uint permSize){
  uvec4 perm = uvec4(0u);
  for(uint i = 0u; i < permSize; i++){
    uint comp = i / 6u;
    uint shift = (i % 6u) * 5u;
    perm[comp] |= (i << shift);
  }
  return perm;
}

// Extract a 5-bit value (0-23) from the permutation state
uint get_perm_val(uvec4 perm, uint i) {
    uint comp = i / 6u;
    uint shift = (i % 6u) * 5u;
    return (perm[comp] >> shift) & 0x1Fu; // 0x1F is 31 (5 bits)
}

// Composes two full permutation states: P_new = P_outer(P_inner)
// pLength - length of the permutations (1-24)
uvec4 compose_perms(uvec4 outer_perm, uvec4 inner_perm, uint permSize){
    uvec4 result = uvec4(0u);
    // Unrolling this loop via a compiler pragma or manually is recommended, 
    // but the WebGL 2 compiler will likely unroll this fixed 20-step loop automatically.
    for(uint i = 0u; i < permSize; i++) {
        uint inner_val = get_perm_val(inner_perm, i);
        uint outer_val = get_perm_val(outer_perm, inner_val);
        
        uint comp = i / 6u;
        uint shift = (i % 6u) * 5u;
        // OR the bits into the clean result vector (no masking needed)
        result[comp] |= (outer_val << shift); 
    }
    return result;
}
//
//  transform point into fundamental domain of the group
//  group data is stored in sampler2D  
//
void iToFundamentalDomainSamplerPerm24(inout vec3 pnt, 
                                      sampler2D groupData, 
                                      int groupOffset, 
                                      uvec4 permData[MAX_GEN_COUNT], 
                                      uint permSize, 
                                      inout uvec4 currentPerm, 
                                      inout int inDomain, 
                                      inout int refcount, 
                                      inout float scale, 
                                      int maxIterations){

    float EPS = 1.e-7;
    vec2 texScale = getTexScale(groupData);

    int domainOffset = fetchInt(groupData, groupOffset);
    int transformsOffset = fetchInt(groupData, groupOffset+1);

    int domainSize = fetchInt(groupData, domainOffset);

    // location of splanes array 
    int domainSplanesOffset = domainOffset+1;
  
    refcount = 0;
    inDomain = 0;
    
    for(int count = 0; count < maxIterations; count++){
    
        int found = 0;
        // we try to move the point into the interior of the fundamental domain, 
        // where all distance should be negative 
        // cycle over all pairing transforms 
        for(int g = 0; g < domainSize; g++){
            // side of the FD       
            iSPlane sp = fetchSplane(groupData,domainSplanesOffset + g*2);
            float ip = iDistance(sp, pnt);
            //if(abs(ip) < EPS) ip = 0.0;
            if(ip > EPS){
                // point is outside => transform the point 
                // get the transform data 
                int transformOffset = fetchInt(groupData, transformsOffset + g + 1);
                // location of transforms splanes 
                int transformSplanesOffset = transformOffset+1;
                //
                // count of reflections in the transformation 
                // 
                int refCount = fetchInt(groupData, transformOffset);
                // perform the transformation
                for(int r = 0; r  < refCount; r++){
                  
                    iSPlane rsp = fetchSplane(groupData,transformSplanesOffset + r*2); 
                    iReflect(rsp, pnt, scale);
                }
                // accumulate the permutation
                currentPerm = compose_perms(permData[g], currentPerm, permSize);
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
