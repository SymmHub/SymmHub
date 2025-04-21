export const patternTextures = `


/////////////////////   
/**  PatternTextures.glsl */



#ifndef MAX_TEX_COUNT
#define MAX_TEX_COUNT 4
#endif 

uniform int u_texCount;
uniform vec2 u_texScales[MAX_TEX_COUNT];
uniform vec2 u_texCenters[MAX_TEX_COUNT];
uniform sampler2D u_textures[MAX_TEX_COUNT];
uniform float u_texAlphas[MAX_TEX_COUNT];


vec4 getPattern(vec3 pnt, float scale){
	
	vec4 color = vec4(0,0,0,0);
	overlay(color, vec4(0.4,0.4,0.7,1)*iToDensity(iDistance(iSphere(vec4(0.,0.0,0,0.1)), pnt), u_pixelSize));	
	return color;
}

/**
  return texure with given index
*/
vec4 getTextureInd(vec3 pnt, int index, float scale){
	
	vec2 p = pnt.xy;
	vec2 hf = vec2(0.5);

  vec2 ts = u_texScales[index];		
  vec2 tc = u_texCenters[index];
  vec2 tp = hf + cMul(ts,p-tc);
  vec2 mask2 = step(-hf,-abs(tp-hf));
  float mask = u_texAlphas[index]*mask2.x*mask2.y;
  float lod = log2(512.*u_pixelSize*scale*length(u_texScales[index]));
  vec4 tcolor;
  switch(index){
    default:
    case 0: tcolor = textureLod(u_textures[0], tp, lod);break;
    #if (MAX_TEX_COUNT > 1)
    case 1: tcolor = textureLod(u_textures[1], tp, lod);break;
    #endif 
    #if (MAX_TEX_COUNT > 2)
    case 2: tcolor = textureLod(u_textures[2], tp, lod);break;
    #endif 
    #if (MAX_TEX_COUNT > 3)
    case 3: tcolor = textureLod(u_textures[3], tp, lod);break;
    #endif
    #if (MAX_TEX_COUNT > 4)
    case 4: tcolor = textureLod(u_textures[4], tp, lod);break;
    #endif 
    #if (MAX_TEX_COUNT > 5)
    case 5: tcolor = textureLod(u_textures[5], tp, lod);break;
    #endif 
    #if (MAX_TEX_COUNT > 6)
    case 6: tcolor = textureLod(u_textures[6], tp, lod);break;
    #endif 
    #if (MAX_TEX_COUNT > 7)
    case 7: tcolor = textureLod(u_textures[7], tp, lod);break;
    #endif 
    #if (MAX_TEX_COUNT > 8)
    case 8: tcolor = textureLod(u_textures[8], tp, lod);break;
    #endif 
    #if (MAX_TEX_COUNT > 9)
    case 9: tcolor = textureLod(u_textures[9], tp, lod);break;
    #endif 
    #if (MAX_TEX_COUNT > 10)
    case 10: tcolor = textureLod(u_textures[10], tp, lod);break;
    #endif 
    #if (MAX_TEX_COUNT > 11)
    case 11: tcolor = textureLod(u_textures[11], tp, lod);break;
    #endif 
    #if (MAX_TEX_COUNT > 12)
    case 12: tcolor = textureLod(u_textures[12], tp, lod);break;
    #endif 
    #if (MAX_TEX_COUNT > 13)
    case 13: tcolor = textureLod(u_textures[13], tp, lod);break;
    #endif 
    #if (MAX_TEX_COUNT > 14)
    case 14: tcolor = textureLod(u_textures[14], tp, lod);break;
    #endif 
    #if (MAX_TEX_COUNT > 15)
    case 15: tcolor = textureLod(u_textures[15], tp, lod);break;
    #endif 
    #if (MAX_TEX_COUNT > 16)
    case 16: tcolor = textureLod(u_textures[16], tp, lod);break;
    #endif 
    #if (MAX_TEX_COUNT > 17)
    case 17: tcolor = textureLod(u_textures[17], tp, lod);break;
    #endif 
  }
  return mask*iPremultColor(tcolor);	
}


vec4 getTexture(vec3 pnt, float scale){
	
	//return getPattern(pnt, scale);
	vec4 color = vec4(0,0,0,0);
	vec2 p = pnt.xy;
	vec2 hf = vec2(0.5);
	//for(int i=0; i < MAX_TEX_COUNT; i++){
	for(int i=0; i < u_texCount; i++){
		//if(i < u_texCount){
			vec2 ts = u_texScales[i];		
			vec2 tc = u_texCenters[i];
			vec2 tp = hf + cMul(ts,p-tc);
			vec2 mask2 = step(-hf,-abs(tp-hf));
			float mask = u_texAlphas[i]*mask2.x*mask2.y;
      //vec4 tcolor = vec4(0,0,0,0);
			//vec4 tcolor = mask*texture(u_textures[i], tp);
      float lod = log2(512.*u_pixelSize*scale*length(u_texScales[i]));
      vec4 texValue = vec4(0,0,0,0);
      switch(i){
        default:
        case 0: texValue = textureLod(u_textures[0], tp, lod); break;
        #if (MAX_TEX_COUNT > 1)
        case 1: texValue = textureLod(u_textures[1], tp, lod); break;
        #endif 
        #if (MAX_TEX_COUNT > 2)
        case 2: texValue = textureLod(u_textures[2], tp, lod); break;
        #endif 
        #if (MAX_TEX_COUNT > 3)
        case 3: texValue = textureLod(u_textures[3], tp, lod); break;
        #endif 
        #if (MAX_TEX_COUNT > 4)
        case 4: texValue = textureLod(u_textures[4], tp, lod); break;
        #endif 
        #if (MAX_TEX_COUNT > 5)
        case 5: texValue = textureLod(u_textures[5], tp, lod); break;
        #endif 
      }
			vec4 tcolor = mask*iPremultColor(texValue);
			overlay(color,tcolor);
		//}
	}
	
	return color;	
}
`;