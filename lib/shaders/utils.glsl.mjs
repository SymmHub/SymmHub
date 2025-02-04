export const utils = 
`
//
//  return result of overlaying premult color b over premult color a 
//
vec4 overlayColor(vec4 a, vec4 b){
	return (1.-b.w)*a + b;
}

//
// analog of overlay color, but works for vec2, where 
//  x component is value channel 
//  y component is alpha channel 
//
vec2 overlayValue(vec2 a, vec2 b){
	return (1.-b.y)*a + b;
}


//
//  return premult color from ful color 
//
vec4 premultColor(vec4 c){
  return vec4(c.xyz*c.w, c.w);
}

//
// analog of premultColor, but works for vec2, where 
//  x component is value channel 
//  y component is alpha channel 
//
vec2 premultValue(vec2 c){
  return vec2(c.x*c.y, c.y);
}

//
//  return full color from premult color
//
vec4 fullColor(vec4 c){
  
	if(c.w != 0.) 
		return vec4((c.xyz / c.w), c.w);
	else 
		return vec4(0., 0., 0., 0.);
}

//
// analog of fullColor, but works for vec2, where 
//  x component is value channel 
//  y component is alpha channel 
//
vec2 fullValue(vec2 c){
  
	if(c.y != 0.) 
		return vec2((c.x / c.y), c.y);
	else 
		return vec2(0., 0.);
}

//
// overlay full colors 
//
vec4 overlayFullColor(vec4 a, vec4 b){
  
    vec4 pa = premultColor(a);  
    vec4 pb = premultColor(b);     
    vec4 pab = overlayColor(pa, pb);    
    return fullColor(pab);
}


//
//  linear step function 
//
float linearStep(float edge0, float edge1, float x){
  
  if(edge1 == edge0) 
    return step(edge0, x);
  else 
    return  clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}
`;
