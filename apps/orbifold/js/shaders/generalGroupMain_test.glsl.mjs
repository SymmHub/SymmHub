export const generalGroupMain_test = 
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

///////////////////////////////////
////general reflection group params 

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


/////////////////////////
// 
// Transform info
//
// These constants are set when the defines are 
// constructed, dispatched through getDefines in 
// local library /GroupRenderer.js. 
// They are assembled in buildProgramsCached in 
// ../../lib/invlib/program_loader.js
// Most of the defines we care
// about are added in by ../../lib/invlib/defaultDomainBuilder
// which in turn will pull them from orbifold_main.js
// (TODO There's some gap, because changing them there leads to a crash)

uniform int u_genCount;  // count of group generators 

uniform float u_domainData[DOMAIN_DATA_SIZE];

uniform int u_domainCount[MAX_GEN_COUNT];
uniform int u_groupCumRefCount[MAX_GEN_COUNT];

uniform float u_groupTransformsData[TRANSFORMS_DATA_SIZE];  // transforms data
uniform int u_texCrownCount;   // count of transforms in the crown 
uniform float u_texCrownData[CROWN_DATA_SIZE];  // crown transforms data 
uniform int u_texCrownRefCount[MAX_CROWN_COUNT];          // reflections count per transform

// a global transformation of the plane, a sequence of inversions

uniform float u_moebiusTransformData[TRANSFORM_DATA_SIZE];  

// TRANSFORM_DATA_SIZE is the max size a transform may have, 
//= MAX_REF_COUNT*SPLANE_DATA_SIZE


uniform int u_projection;
// scale to apply after projection 
uniform int u_cScaleEnabled;
uniform vec2 u_cScale;


void init(void){
}


// conversion from array coordinates to texture coordinates 
vec2 toTexCoord(vec2 arrayCoord, vec2 texScale){
  
  return (arrayCoord + vec2(0.5,0.5))*texScale;
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


vec3 projectionExp(inout vec3 p, inout float scale){
  
	vec2 pp = cExp(p.xy);
	scale *= length(pp);
	p.xy = pp;  
  
  return p;
}




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

    transformPoint(p3, u_moebiusTransformData, scale);
 
  
  // point in transformed coordinates 
	vec3 ptrans = p3;

  
	if(u_hasSymmetry == 1){

     iToWalledFundamentalDomain(p3, u_groupTransformsData, u_domainData, u_domainCount, u_groupCumRefCount, u_genCount, inDomain, refCount, scale, u_iterations);
    
	}
	
	float pixelSize = u_pixelSize;

  vec4 color=u_backgroundColor;
 
  int colorIndex = (refCount % 2);

	if(inDomain == 1) {
		if(u_drawFill == 1){
      overlay(color, u_tileColors[colorIndex]);
		}
		if(u_drawTexture == 1) {
      
        overlay(color, getTexture(p3, scale));
     
		}
	
		if(u_drawTexCrown == 1){

      overlay(color, u_texCrownFactor*getCrownTexturePacked(p3, u_groupTransformsData, u_groupCumRefCount, u_genCount, scale));						
  
		}

		//if(length(p3) > 1.) {
	  //		// exterior part of FD
	  //		color *= vec4(0.6,0.6,0.6,1);        
		//}
		if(u_drawLines == 1) {
      
			float ww = pixelSize*scale; 

        overlay(color, iGetWalledFundDomainOutline(p3, u_domainData,u_domainCount, u_genCount, u_lineColor,u_lineWidth*ww, ww,0.));
 
    
		}
	} else {
		// not in domain 
		color = u_errorColor;        
	}
	
	if(u_fillDomain == 1){	


      overlay(color, iGetWalledFundDomainInterior(ptrans, u_domainData, u_domainCount, u_genCount, u_domainColor,pixelSize));
  

	}
	
  return color;//iFullColor(color);
    
}
`;