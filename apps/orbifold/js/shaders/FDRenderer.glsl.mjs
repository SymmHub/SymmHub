

export const FDRenderer = 
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
uniform int u_useSymmetryBlending;

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
	
	// we'll try applying the reflections in reverse order, to take the inverse transform
	// and we'll stash the color values at each of the pts in an orbit in the crown 
	// The alpha channel can be used in a variety of ways. 

	vec4 color = vec4(1.,.9,1.,1.);//u_backgroundColor;// this behaves mysteriously: compare to 1111, 1001, 1101, etc
	vec4 colors[MAX_CROWN_COUNT+1];
	
	//we will populate an array of colors, and then work out which one we want.

		
	colors[0]=getTexture(pnt, scale);// the identity
	if(u_useSymmetryBlending==0){overlay(color, colors[0]);}
	for(int g = 0; g < count; g++)
		{ //walk through the crown and generate an array of colors. 
			// webgl2 allows variable-length loops
			int startCount = 0;
			if(g > 0){
      			startCount=rc[g-1];}

			int rCount = rc[g]-startCount;

			vec3 v  = pnt;  
			float ss = scale;
			// apply transform g
			for(int r = 0; r  < rCount; r++)
				{ //step by step
					int RIND=(5*(startCount + r));
					iSPlane splane = iGeneralSplane(vec4(cd[RIND], cd[RIND+1], cd[RIND+2], cd[RIND+3]), int(cd[RIND+4]));
					iReflect(splane, v, ss);							
				}
			colors[g+1]=getTexture(v, ss);
			if(u_useSymmetryBlending==0){overlay(color,colors[g+1]);}
		}
	if(u_useSymmetryBlending==1)
	{
		color = vec4(1.,1.,0.,1.);
		//using the alpha channel for height information.
		float highestalpha = -1.;
		for(int i = 0; i<=MAX_CROWN_COUNT;i++){
			if(colors[i].w>highestalpha){
				color = colors[i];
				highestalpha = color.w;
				}
		//	color.x=color.w;
				if(color.w>0.){	
					color.x=clamp(color.x/color.w,0.,1.);
					color.y=clamp(color.y/color.w,0.,1.);
					color.z=clamp(color.z/color.w,0.,1.);
					color.w = 1.;}
		} //end looping through the stored colors

	}// end if u_useSymmetryBlending
	return color;
}


vec4 getColor(vec2 p){
  
  
  // don't bother drawing anything outside the unit disk: 
  if(p.x*p.x+p.y*p.y>1.){return u_backgroundColor;}

  vec3 p3 = vec3(p, 0);



  int groupOffset = 0; // assume group packed at 0

  vec3 porig = p3; // point in math coordinates 
  int inDomain = 1;
  int refCount = 0;
  float scale = 1.;
  
  
	float pixelSize = u_PixelSize;

  vec4 color=vec4(1.,1.,1.,1.);//u_backgroundColor;
  
 
	if(0< inDomainQ(porig, u_domainData, u_domainCount, u_genCount, pixelSize)
	){scale=2.;
		vec4 newcolor = getCrownTexturePacked(p3, u_groupTransformsData, u_groupCumRefCount, u_genCount, scale);						

		overlay(color, newcolor);
  	float ww = pixelSize*scale;
	
		if(u_drawLines==1){
		overlay(color,iGetWalledFundDomainOutline(p3, u_domainData,u_domainCount, u_genCount, u_lineColor,u_lineWidth*.001*scale,.0002*scale,0.));
		}

	}

  return color;
    
}`
;