export const generalGroupMain_v2 = 
`
#define PROJECTION_CIRCLE 0
#define PROJECTION_LOG 1
#define PROJECTION_BAND 2
#define PROJECTION_UHP 3
#define PROJECTION_EXP 4
#define PROJECTION_SPHERE 5

#ifndef  TILE_COLOR_COUNT
#define TILE_COLOR_COUNT 2
#endif 

//general reflection group params 
uniform int u_iterations;
uniform int u_hasSymmetry;
uniform int u_drawFill;
uniform int u_drawLines;

uniform int u_fillDomain;
uniform int u_drawTexture;
uniform int u_drawTexCrown;
uniform float u_texCrownFactor;
uniform float u_lineWidth;

// all colors have to be premult 
uniform vec4 u_backgroundColor; 
uniform vec4 u_domainColor; 
uniform vec4 u_lineColor; 
uniform vec4 u_errorColor; 
uniform vec4 u_tileColors[TILE_COLOR_COUNT]; 

uniform int u_genCount;  // count of group generators 

#ifdef USE_SAMPLER
// samples which contains domain and transform data 
uniform sampler2D u_groupData;

#else //#ifdef USE_SAMPLER

uniform float u_domainData[DOMAIN_DATA_SIZE];

#ifdef USE_PACKING
uniform int u_domainCount[MAX_GEN_COUNT];
uniform int u_groupCumRefCount[MAX_GEN_COUNT];
#else
uniform int u_groupRefCount[MAX_GEN_COUNT];            // reflections count per transform 
#endif

uniform float u_groupTransformsData[TRANSFORMS_DATA_SIZE];  // transforms data
uniform int u_texCrownCount;   // count of transforms in the crown 
uniform float u_texCrownData[CROWN_DATA_SIZE];  // crown transforms data 
uniform int u_texCrownRefCount[MAX_CROWN_COUNT];          // reflections count per transform
#endif // ifdef USE_SAMPLER

#ifdef USE_PERMUTATIONS
uniform int u_permutationsData[PERMDATASIZE];
uniform int u_permutationsBase;
uniform int u_texPermutationsBase;
#endif


#define USE_MOEBIUS_TRANSFORM 1

#ifdef USE_MOEBIUS_TRANSFORM
uniform float uMoebiusTransformData[TRANSFORM_DATA_SIZE];  // moebius transforms data 
#endif 	

uniform int u_projection;
// scale to apply after projection 
uniform int u_cScaleEnabled;
uniform vec2 u_cScale;


void init(void){
    
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
  return scaling factor to access data in texture via integer index
*/
vec2 getTexScale(sampler2D data){
  
  ivec2 tSize = textureSize(data,0);
  return vec2(1./float(tSize.x), 1./float(tSize.y));
    
}

/**
  calculate contribution of textures from the crown . group data stored in sampler2D 
*/
vec4 getCrownTextureSampler(vec3 pnt, sampler2D groupData, int groupOffset, float scale){
  
	vec4 color = vec4(0,0,0,0);
  vec2 texScale = getTexScale(groupData);
  
  int domainOffset = int(getValueFromTex(groupData, texScale, groupOffset).x);
  int domainSize = int(getValueFromTex(groupData, texScale, domainOffset).x);
  int transformsOffset = int(getValueFromTex(groupData, texScale, groupOffset+1).x);
  
  for(int g = 0; g < domainSize; g++){
    // remember the original point and scale 
		vec3 v  = pnt;  
		float ss = scale;

    int transformOffset = int(getValueFromTex(groupData, texScale, transformsOffset + g + 1).x);
    int refCount = int(getValueFromTex(groupData, texScale, transformOffset).x);
    int transformSplanesOffset = transformOffset+1;

    for(int r = 0; r  < refCount; r++){
      
      iSPlane rsp = getSplaneFromTex(groupData,texScale, transformSplanesOffset + r*2); 
      iReflect(rsp, v, ss);
    }
		overlay(color, getTexture(v, ss));					
  }
  
	return color;
    
}
  
vec4 getCrownTexturePacked(vec3 pnt, 
                    //float cd[CROWN_DATA_SIZE], // transforms data 
                    float cd[TRANSFORMS_DATA_SIZE], // transforms data 
                    //int rc[MAX_CROWN_COUNT],  // reflection counts per transform 
                    int rc[MAX_GEN_COUNT],  // reflection counts per transform 
											// NOTE THAT THIS IS NOW CUMULATIVE
                    int count, // count of transforms 
                    float scale  // scale to use 
                    ){
	
	vec4 color = vec4(0,0,0,0);
	//for(int g = 0; g < MAX_GEN_COUNT; g++){
	for(int g = 0; g < count; g++){
		int startCount = 0;
		if(g > 0){
      startCount=rc[g-1];
    }
		int rCount = rc[g]-startCount;

		vec3 v  = pnt;  
		float ss = scale;
		// apply transform g
		for(int r = 0; r  < rCount; r++){
			int RIND=(5*(startCount + r));
			iSPlane splane = iGeneralSplane(vec4(cd[RIND], cd[RIND+1], cd[RIND+2], cd[RIND+3]), int(cd[RIND+4]));
			iReflect(splane, v, ss);							
		}
		overlay(color, getTexture(v, ss));					
	}
	return color;
}

vec4 getCrownTexture(vec3 pnt, 
                    //float cd[CROWN_DATA_SIZE], // transforms data 
                    float cd[TRANSFORMS_DATA_SIZE], // transforms data 
                    //int rc[MAX_CROWN_COUNT],  // reflection counts per transform 
                    int rc[MAX_GEN_COUNT],  // reflection counts per transform 
                    int count, // count of transforms 
                    float scale  // scale to use 
                    ){
	
	vec4 color = vec4(0,0,0,0);

	for(int g = 0; g < count; g++){
		int rCount = rc[g];
		
		vec3 v  = pnt;  
		float ss = scale;
		// apply transform g
		for(int r = 0; r  < rCount; r++){
			#define RIND (5*(g*MAX_REF_COUNT + r))
			iSPlane splane = iGeneralSplane(vec4(cd[RIND], cd[RIND+1], cd[RIND+2], cd[RIND+3]), int(cd[RIND+4]));
			iReflect(splane, v, ss);					
			#undef RIND			
		}
		overlay(color, getTexture(v, ss));					
	}
	return color;
}



vec3 projectionExp(inout vec3 p, inout float scale){
  
	vec2 pp = cExp(p.xy);
	scale *= length(pp);
	p.xy = pp;  
  
  return p;
}



/**
  return color of interior of fund domain stored insid eof sampler ad given offest 
  
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
  return outline of fundamental domain sides 
*/
float iGetFundDomainOutlineSampler(vec3 pnt,  sampler2D groupData, int groupOffset, float lineWidth, float pixelSize){
	
  float dMax = 0.;
  
  vec2 texScale = getTexScale(groupData);
  int domainOffset = int(getValueFromTex(groupData, texScale, groupOffset).x);
  // splanes count 
  int count = int(getValueFromTex(groupData, texScale, domainOffset).x);
  // location of splanes array 
  int splanesOffset = domainOffset+1;
  
	for(int i =0; i < count; i++){
    
    iSPlane sp = getSplaneFromTex(groupData,texScale, splanesOffset + i*2);
    float d = abs(iDistance(sp, pnt));		
    if(d < lineWidth){
      float a = clamp((lineWidth-d)/pixelSize,0.,1.);			
      dMax  = max(a, dMax);
    }		
		
	}
		
	
	return dMax;	
	
}

#ifdef USE_SAMPLER 
/**
    
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


void iToFundamentalDomainSamplerV2(inout vec3 pnt, sampler2D groupData, int groupOffset, inout int inDomain, inout int refcount, inout float scale, int iterations){

  vec2 texScale = getTexScale(groupData);
  
  int domainOffset = int(getValueFromTex(groupData, texScale, groupOffset).x);
  int transformsOffset = int(getValueFromTex(groupData, texScale, groupOffset+1).x);
  
  int domainSize = int(getValueFromTex(groupData, texScale, domainOffset).x);
  
  // location of splanes array 
  int domainSplanesOffset = domainOffset+1;
  
  #define MAX_DOMAIN_SIZE 8
  #define MAX_TRANS_COUNT 30
  iSPlane domain[MAX_DOMAIN_SIZE];
  iSPlane transforms[MAX_TRANS_COUNT];
  int transCount[MAX_DOMAIN_SIZE*2];
  int tOffset = 0;
  for(int g =0; g < domainSize; g++){             
    domain[g] = getSplaneFromTex(groupData,texScale, domainSplanesOffset + g*2);
    int transOffset = int(getValueFromTex(groupData, texScale, transformsOffset + g + 1).x);
    int transformSplanesOffset = transOffset+1;       
    int refCount = int(getValueFromTex(groupData, texScale, transOffset).x);
    transCount[2*g] = refCount;
    transCount[2*g+1] = tOffset;
    for(int r = 0; r  < refCount; r++){      
      transforms[tOffset + r] = getSplaneFromTex(groupData,texScale, transformSplanesOffset + r*2); 
    }      
    tOffset += refCount;
  }
  
	refcount = 0;
	inDomain = 0;
    
	for(int count = 0; count <  iterations; count++){
    
    int found = 0;
    // we move the point into interior of fundamental domain, where all distance should be negative 
    
    //for(int g =0; g < domainSize; g++){
    //for(int g =0; g < domainSize; g++){
    for(int g =0; g < 8; g++){
      if( g >= domainSize) break;
              
      float ip = iDistance(domain[g], pnt);
      if(ip > 0.){
        // transform the point         
        int refCount = transCount[2*g];
        int tOffset = transCount[2*g+1];        
        //for(int r = 0; r  < refCount; r++){
        for(int r = 0; r  < 5; r++){
          if(r >= refCount)break;
          iSPlane rsp = transforms[tOffset + r];
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
#endif // USE_SAMPLER 

vec4 getColor(vec2 p){
  
  
  vec3 p3 = vec3(p, 0);

  int groupOffset = 0; // assume group packed at 0

  vec3 porig = p3; // point in world coordinates 
  int inDomain = 1;
  int refCount = 0;
  float scale = 1.;
  

  switch(u_projection){
    default: 
    case PROJECTION_CIRCLE: break;
    case PROJECTION_LOG:  band2uhp(p3, scale); break;
    case PROJECTION_BAND: band2disc(p3, scale); break;
    case PROJECTION_UHP:  uhp2disc(p3,scale); break;
    case PROJECTION_EXP:  {
      plane2band(p3, scale); 
      if(u_cScaleEnabled != 0)cScale(p3, u_cScale, scale);
      break;
    }
   
  }

  #ifdef USE_SAMPLER
    //  TODO replace with Sampler code 
    transformPoint(p3, uMoebiusTransformData, scale);
  #else 
    transformPoint(p3, uMoebiusTransformData, scale);
  #endif   
  
  // point in transformed coordinates 
	vec3 ptrans = p3;
#ifdef USE_PERMUTATIONS  
  int perm[PERM_SIZE];
  int permSize = u_permutationsData[1];  
  PermIdentity(perm, permSize);
#endif 
  
	if(u_hasSymmetry == 1){
#ifdef USE_SAMPLER
      iToFundamentalDomainSamplerV2(p3, u_groupData, groupOffset, inDomain, refCount, scale, u_iterations);
#else     
  #ifdef USE_PACKING
      iToWalledFundamentalDomain(p3, u_groupTransformsData, u_domainData, u_domainCount, u_groupCumRefCount, u_genCount, inDomain, refCount, scale, u_iterations);
  #else
      #ifdef USE_PERMUTATIONS     
        //iToFundamentalDomainPermRef(p3, u_domainData, u_permutationsData, u_genCount, inDomain, refCount, scale, u_iterations, perm,permSize);
        iToFundamentalDomainPerm(p3, u_groupTransformsData, u_domainData, u_groupRefCount, u_permutationsData, u_genCount, inDomain, refCount, scale, u_iterations, perm,permSize);    
      #else   
        iToFundamentalDomain(p3, u_groupTransformsData, u_domainData, u_groupRefCount, u_genCount, inDomain, refCount, scale, u_iterations);
      #endif 
  #endif
#endif   // USE_SAMPLER   
	}
	
	float pixelSize = u_pixelSize;

  vec4 color=u_backgroundColor;
#ifdef USE_PERMUTATIONS  
  int colorIndex = perm[u_permutationsBase];
#else   
  int colorIndex = (refCount % 2);
#endif 
 
	if(inDomain == 1) {
		if(u_drawFill == 1){
      overlay(color, u_tileColors[colorIndex]);
		}
		if(u_drawTexture == 1) {
      #ifdef USE_PERMUTATIONS
          overlay(color, getTextureInd(p3, perm[u_texPermutationsBase], scale)); 
      #else
        overlay(color, getTexture(p3, scale));
      #endif  
		}
	
		if(u_drawTexCrown == 1){
#ifdef USE_SAMPLER 
        overlay(color, u_texCrownFactor*getCrownTextureSampler(p3, u_groupData, groupOffset, scale));
#else       
  #ifdef USE_PACKING
        overlay(color, u_texCrownFactor*getCrownTexturePacked(p3, u_groupTransformsData, u_groupCumRefCount, u_genCount, scale));						
  #else	// unpacket group data 		
        overlay(color, u_texCrownFactor*getCrownTexture(p3, u_groupTransformsData, u_groupRefCount, u_genCount, scale));						
  #endif 
#endif //   USE_SAMPLER 
		}

		//if(length(p3) > 1.) {
	  //		// exterior part of FD
	  //		color *= vec4(0.6,0.6,0.6,1);        
		//}
		if(u_drawLines == 1) {
      
			float ww = pixelSize*scale; 
#ifdef USE_SAMPLER 
    overlay(color, u_lineColor* iGetFundDomainOutlineSampler(p3, u_groupData, groupOffset, u_lineWidth*ww, ww));
#else           
  #ifdef USE_PACKING
        overlay(color, iGetWalledFundDomainOutline(p3, u_domainData,u_domainCount, u_genCount, u_lineColor,u_lineWidth*ww, ww,0.));
  #else    
        overlay(color, iGetFundDomainOutline(p3, u_domainData,u_genCount, u_lineColor,u_lineWidth*ww, ww,0.));
  #endif
#endif // USE_SAMPLER 
    
		}
	} else {
		// not in domain 
		color = u_errorColor;        
	}
	
	if(u_fillDomain == 1){	
#ifdef USE_SAMPLER 
    overlay(color, u_domainColor*iGetFundDomainInteriorDensitySampler(ptrans, u_groupData, groupOffset, clamp(scale, 50., 0.02)*pixelSize));
#else   
  #ifdef USE_PACKING
      overlay(color, iGetWalledFundDomainInterior(ptrans, u_domainData, u_domainCount, u_genCount, u_domainColor,pixelSize));
  #else
      overlay(color, iGetFundDomainInterior(ptrans, u_domainData,u_genCount, u_domainColor,clamp(scale, 50., 0.02)*pixelSize));
  #endif
#endif // USE_SAMPLER 

	}
	
  return color;//iFullColor(color);
    
}
`;