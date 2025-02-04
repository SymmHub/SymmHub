export const inversive = 
`
#ifndef MAX_GEN_COUNT
#define MAX_GEN_COUNT 4
#endif 

#ifndef MAX_REF_COUNT
#define MAX_REF_COUNT 4 
#endif 

// size of array to hold transforms to tiles around fundamental domain (crown transform)
#ifndef MAX_CROWN_COUNT
#define MAX_CROWN_COUNT 20
#endif 


// size of splane data transfer size 
#define SPLANE_DATA_SIZE 5
// fixed size array to transfer sides of fundamental domain via uniform vector 
#define DOMAIN_DATA_SIZE (SPLANE_DATA_SIZE*MAX_GEN_COUNT)


vec4 iGetFundDomainInterior(vec3 pnt, float sides[DOMAIN_DATA_SIZE], int count, vec4 color, float pixelSize){
	
	float d = 1.;
	for(int i =0; i < count; i++){
	//for(int i =0; i < MAX_GEN_COUNT; i++){
	//	if(i < count)
  {
			#define IND (5*i)			
      iSPlane sp = iGeneralSplane(vec4(sides[IND], sides[IND+1], sides[IND+2], sides[IND+3]), int(sides[IND+4]));
      #undef IND       
      d *= iToDensity(iDistance(sp, pnt),pixelSize);		
		}
	}
		
	return color*d;	
	
}
/**
  return signed distance to fund domain 
*/
float iGetFundDomainDistance(vec3 pnt, float sides[DOMAIN_DATA_SIZE], int count){
	
	float d = -1.;
	for(int i = 0; i < count; i++){
	//for(int i =0; i < MAX_GEN_COUNT; i++){
	//	if(i < count)
  {
			#define IND (5*i)			
      iSPlane sp = iGeneralSplane(vec4(sides[IND], sides[IND+1], sides[IND+2], sides[IND+3]), int(sides[IND+4]));
      #undef IND       
      d = max(d, iDistance(sp, pnt));
		}
	}
		
	return d;	
	
}
`;