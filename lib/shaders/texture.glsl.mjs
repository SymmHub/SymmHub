export const texture = 
`
//#define FLIPY vec2(1.,-1)
//
//  #include  "complex.glsl"
//  return texture value 
//  texture is transformed using 
//  texScale - complex number which describes texure scale and rotation 
//
vec4 getTexture(vec2 pnt, sampler2D texture, vec2 texScale, vec2 texCenter, float pixelSize){
	
	// center of texture box [0,0],[1,1]
  //vec2 hf = vec2(0.5); 
  // point relative to the texture center 
  vec2 tc = cMul(texScale,pnt-texCenter);//*FLIPY;
  //tc.y = -tc.y; // flip y
  vec2 tp = tc + vec2(0.5); // point in texture coordinates 
  tc = abs(tc);
  float sd = max(tc.x, tc.y)-0.5; // signed distance to the box 
	
	float mask = 1.-smoothstep(0., pixelSize, sd);
    
  float lod = log2(float(textureSize(texture,0)) * pixelSize*length(texScale)); 
  
  vec4 tv = textureLod(texture, tp, lod);
  //vec4 tv = vec4(1.,0,0,1);
  //tv.xyz *= tv.w; // premult when we need that? 
  
  //vec4 texValue = vec4(tv.xy*mask, 0, mask);
  
  vec4 texValue = mask*tv;	
  
	return texValue;	
}
`;
