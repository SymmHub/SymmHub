

export const patternFromFDRenderer = 
`

//////////////////////////////////   
/**  PatternFromFDRenderer.glsl */

// This renders the hyp plane from a FD texture, overlaying uniform lines

uniform int u_curvature;

uniform sampler2D u_FDdata;

//general reflection group params 
uniform int u_iterations;
uniform int u_hasSymmetry;

uniform int u_drawLines;
uniform float u_lineWidth;
uniform vec4 u_lineColor;
uniform float u_maxlineWidth;
uniform float u_zoom;
uniform float u_scale;

uniform float u_texCrownFactor;

// all colors have to be premult 
uniform vec4 u_backgroundColor; 
uniform vec4 u_domainColor; 
uniform vec4 u_errorColor; 

uniform float u_aspect;

uniform int u_genCount;  // count of group generators 


uniform float u_domainData[DOMAIN_DATA_SIZE];


uniform int u_domainCount[MAX_GEN_COUNT];
uniform int u_groupCumRefCount[MAX_GEN_COUNT];


uniform float u_groupTransformsData[TRANSFORMS_DATA_SIZE];  
	// transforms data to bring a point into the fundamental domain

void init(void){
    
}


// returns a position in [-1x1]^2 coordinates within a sampler, in texture coords, 
// rendered in the resolution 'scale' 

vec4 getTextureValue(vec3 pnt, sampler2D sampler,float scale)
{
	vec2 p = pnt.xy; //in math coordinates, [-1,1]x[-1,1]
	vec2 hf = vec2(0.5);

  vec2 tp = hf+cMul(vec2(.5,0.),p);// in texture coordinates, [0,1]x[0,1]
  float lod = log2(512.*1.*scale);
  vec4 tcolor;
  tcolor = textureLod(sampler, tp, lod);
  return tcolor;
}



vec4 getTextureValueWithBoundaries(vec3 pnt, sampler2D sampler, float scale, float zoom, float aspect)
{	float inset = 0.;

	vec2 p = pnt.xy; //in math coordinates, [-1,1]x[-1,1]  the buffer  
	// stretches from  +/- (width,height)/2 in math coordinates.
	vec2 hf = vec2(0.5);
	vec2 st = vec2(p.x*zoom*.5, p.y*zoom/aspect*.5);
  vec2 tp = hf+st;// in texture coordinates, [0,1]x[0,1]
  float lod = log2(512.*1.*scale);
  vec4 tcolor;
  if(tp.x>inset && tp.x<1.-inset&&tp.y>inset&&tp.y<1.-inset){
  	tcolor = textureLod(sampler, tp, lod);}
  else{tcolor = u_backgroundColor;}//was not in the sampler
  return tcolor;
}





vec4 getColor(vec2 p){


	float pixelSize = u_pixelSize;//this should now work, for ... ?
  

  // don't bother drawing anything outside the unit disk: 
  if(u_curvature!=0 && p.x*p.x+p.y*p.y>1.){return u_backgroundColor;}
  // don't bother drawing anything outside the unit disk

  if(u_curvature!=0 && p.x*p.x+p.y*p.y>1.){return u_backgroundColor;}

if(u_curvature>0){
	//transform out to the plane from an inverse orthogonal projection
	float spz= 1.0/(1.0-sqrt(1.0-p.x*p.x-p.y*p.y));
	p.x = p.x*spz;
	p.y = p.y*spz;
}


	// TODO: DEPENDING ON CURVATURE AND PROJECTION, 
	// Further adjust based on whatever projection we have

  vec4 color=u_backgroundColor;
  vec4 texture2;
  
  vec3 p3 = vec3(p, 0); //Splanes act on vec3's, so upgrade

  int groupOffset = 0; // assume group packed at 0

  vec3 porig = p3; // the original point in math coordinates 
  int refCount = 0;
  float scale = 1.; // keep track of scaling changes

	//if we are making a symmetrical drawing, 
	// bring p3 to a representative point within the fundamental domain. 
 	if(u_hasSymmetry==1){
 		int successq=1;
		iToWalledFundamentalDomain(p3, u_groupTransformsData, u_domainData, u_domainCount, u_groupCumRefCount, u_genCount, successq, refCount, scale, u_iterations);
  

  	//grab the pixel color at p3 
		texture2 = getTextureValueWithBoundaries(p3, u_FDdata,scale, u_zoom, u_aspect);
  	overlay(color,texture2);

		
  }

 	// shall we draw some boundaries? // this is where we draw lines of constant 
 	// screenwidth
  if(u_drawLines>0){
	
  
		float ww = .06*scale*u_pixelSize;
	
		if(u_drawLines==1){
		overlay(color,iGetWalledFundDomainOutline(p3, u_domainData,u_domainCount, u_genCount, u_lineColor,10.*ww, ww,0.));
		}


  }


	

	/* misc experiments*/
	
	//trying to overlay the FD onto the buffer 
	// there are still problems with blending: is it gl.blendFunc()?
  
  //texture2 = getTextureValueWithBoundaries(pt2draw, u_FDdata,scale, u_zoom, u_aspect);
  // texture2= .3*texture2;
  //	overlay(color,texture2);
 
 	
  return color;
    
}`
;