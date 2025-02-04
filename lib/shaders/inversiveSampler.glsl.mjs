export const inversiveSampler = 
`
/**
  return scaling factor to access data in texture via integer index
*/
vec2 getTexScale(sampler2D data){
  
  ivec2 tSize = textureSize(data,0);
  return vec2(1./float(tSize.x), 1./float(tSize.y));
    
}

/**
  conversion from array coordinates to texture coordinates 
*/
vec2 toTexCoord(vec2 arrayCoord, vec2 texScale){
  
  return (arrayCoord + vec2(0.5,0.5))*texScale;
}

/**
  return splane read from sampler data 
*/
iSPlane getSplaneFromTex(sampler2D data, vec2 texScale,int offset){
  
  vec4 sdata = texture(data, toTexCoord(vec2(float(offset),0), texScale));
  int stype = int(texture(data, toTexCoord(vec2(float(offset + 1),0), texScale)).x);  
  return iGeneralSplane(sdata, stype);
  
}

/**
  return one value from texture at given offset 
*/
vec4 getValueFromTex(sampler2D data, vec2 texScale, int offset){
  
  return texture(data, toTexCoord(vec2(offset,0), texScale));
  
}


/**
  return density of interior of the fund domain stored inside of sampler at the given offest 
  
*/
float iGetFundDomainInteriorDensitySampler(vec3 pnt, sampler2D groupData, int offset, float pixelSize){
	  
	float dens = 1.;
  vec2 texScale = getTexScale(groupData);
  int domainOffset = int(getValueFromTex(groupData, texScale, offset).x);
  int count = int(getValueFromTex(groupData, texScale, domainOffset).x);
  
  int splanesOffset = domainOffset+1;
  
	for(int i =0; i < count; i++){
    
    iSPlane sp = getSplaneFromTex(groupData,texScale, splanesOffset + i*2);
    dens *= iToDensity(iDistance(sp, pnt),pixelSize);				
	}
	
	return dens;
		
}

/**
  return signed distance to the interior of the fund domain stored inside of sampler at the given offest 
  
*/
float iGetFundDomainDistanceSampler(vec3 pnt, sampler2D groupData, int offset){
	  
	float dist = -100.;
  vec2 texScale = getTexScale(groupData);
  int domainOffset = int(getValueFromTex(groupData, texScale, offset).x);
  int count = int(getValueFromTex(groupData, texScale, domainOffset).x);
  
  int splanesOffset = domainOffset+1;
  
	for(int i =0; i < count; i++){
    
    iSPlane sp = getSplaneFromTex(groupData,texScale, splanesOffset + i*2);
    dist = max(dist, iDistance(sp, pnt));
	}
	
	return dist;
		
}


/**
  transform point into fundamental domain of the group
  group data is stored in sampler2D  
*/
void iToFundamentalDomainSampler(inout vec3 pnt, sampler2D groupData, int groupOffset, inout int inDomain, inout int refcount, inout float scale, int iterations){

  vec2 texScale = getTexScale(groupData);
  
  int domainOffset = int(getValueFromTex(groupData, texScale, groupOffset).x);
  int transformsOffset = int(getValueFromTex(groupData, texScale, groupOffset+1).x);
  
  int domainSize = int(getValueFromTex(groupData, texScale, domainOffset).x);
  
  // location of splanes array 
  int domainSplanesOffset = domainOffset+1;
  
	refcount = 0;
	inDomain = 0;
    
	for(int count = 0; count <  iterations; count++){
    
    int found = 0;
    // we move the point into interior of fundamental domain, where all distance should be negative 
    
    for(int g =0; g < domainSize; g++){
              
      iSPlane sp = getSplaneFromTex(groupData,texScale, domainSplanesOffset + g*2);
      float ip = iDistance(sp, pnt);
      if(ip > 0.){
        // transform the point 
        // location of individual transform data 
        int transformOffset = int(getValueFromTex(groupData, texScale, transformsOffset + g + 1).x);
        int transformSplanesOffset = transformOffset+1;
        
        int refCount = int(getValueFromTex(groupData, texScale, transformOffset).x);
        
        for(int r = 0; r  < refCount; r++){
          
          iSPlane rsp = getSplaneFromTex(groupData,texScale, transformSplanesOffset + r*2); 
          iReflect(rsp, pnt, scale);
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

`;
