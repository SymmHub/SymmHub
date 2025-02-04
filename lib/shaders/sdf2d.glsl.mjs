export const sdf2d = 
`
//
// 2d signed distance functions 
// https://iquilezles.org/articles/distfunctions2d/
//

//   
//  signed distance to line segment [a,b]
//
float sdSegment( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}

//
//  signed distance to disk 
//
float sdDisk( in vec2 p, in vec2 center, in float radius )
{
    p -= center;
    return sqrt(dot(p,p))-radius;
    
}

//
//  distance to point a
//
float sdPoint(vec2 p, vec2 a){
  
  return length(p-a);
  
}


//
//   linear step 
//
float linearstep(float edge0, float edge1, float x)
{
    return  clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

//
//  convert signed distance to density 
//
float sd2dens(float distance, float blur){	

	return 1.-smoothstep(-blur,blur, distance);
  
}
`;
