

export const FDPatternRenderer = 
`


//general reflection group params 
uniform int u_iterations;
uniform int u_hasSymmetry;

uniform int u_drawLines;
uniform float u_lineWidth;
uniform vec4 u_lineColor;

uniform float u_texCrownFactor;

// all colors have to be premult 
uniform vec4 u_backgroundColor; 
uniform vec4 u_domainColor; 
uniform vec4 u_errorColor; 

uniform int u_genCount;  // count of group generators 


uniform float u_domainData[DOMAIN_DATA_SIZE];


uniform int u_domainCount[MAX_GEN_COUNT];
uniform int u_groupCumRefCount[MAX_GEN_COUNT];


uniform float u_groupTransformsData[TRANSFORMS_DATA_SIZE];  // transforms data
uniform int u_texCrownCount;   // count of transforms in the crown 
uniform float u_texCrownData[CROWN_DATA_SIZE];  // crown transforms data 
uniform int u_texCrownRefCount[MAX_CROWN_COUNT];          // reflections count per transform


void init(void){
    
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
	overlay(color, getTexture(pnt, scale));
	for(int g = 0; g < count; g++){// webgl2 allows variable-length loops
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


vec4 getColor(vec2 p){
  
  
  vec3 p3 = vec3(p, 0);

  int groupOffset = 0; // assume group packed at 0

  vec3 porig = p3; // point in world coordinates 
  int inDomain = 1;
  int refCount = 0;
  float scale = 1.;
  
  
	float pixelSize = u_pixelSize;

  vec4 color=u_backgroundColor;
  
  int colorIndex = (refCount % 2);

  // point in untransformed coordinates 
	

float dist2domain = getDist2Domain(porig, u_domainData, u_domainCount, u_genCount, u_domainColor,pixelSize);

int indomain2 = inDomainQ(porig, u_domainData, u_domainCount, u_genCount, u_domainColor,pixelSize);


// now move p3 to the FD if we are going to read it.
 if(u_hasSymmetry==1){
		iToWalledFundamentalDomain(p3, u_groupTransformsData, u_domainData, u_domainCount, u_groupCumRefCount, u_genCount, inDomain, refCount, scale, u_iterations);
  }

	overlay(color, u_texCrownFactor*getCrownTexturePacked(p3, u_groupTransformsData, u_groupCumRefCount, u_genCount, scale));						
  
  /*// WHAT IS DIFFERENT ABOUT THESE  VEC4s?
		// They composite differently
		vec4 newcolor;

		newcolor = u_domainColor;
		//newcolor = vec4(vec3(.1,.3,.4),u_domainColor.w);
		//newcolor = vec4(.1,.3,.4,u_domainColor.w);
		
		overlay(color,newcolor);	
		 */      
	

  float ww = pixelSize*scale;
	
	overlay(color,iGetWalledFundDomainOutline(p3, u_domainData,u_domainCount, u_genCount, u_lineColor,.004,.0005,0.));
	
  return color;//iFullColor(color);
    
}`
;