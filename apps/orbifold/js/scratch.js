
int inDomainQ2(vec3 pnt, float sides[DOMAIN_DATA_SIZE], int domainCount[MAX_GEN_COUNT], int count, vec4 color, float pixelSize){
	float d = 1.;
	int ind;
	int ii;
	int insideQ = 1;
	
	for(int i =0; i < count && insideQ>0; i++){
			int use = 0;//a priori, doesn't count against being inside

			if(i==0){ii=0;}
			else{ii=domainCount[i-1];}
			ind = 5*ii;			
			iSPlane sp = iGeneralSplane(vec4(sides[ind], sides[ind+1], sides[ind+2], sides[ind+3]), int(sides[ind+4]));      
			float dd = iDistance(sp,pnt);
			// are we on the inside of this wall?
			// 
			if(dd>0.*pixelSize){
				// further check to see if this domain wall should even count:
				// In other words, check against the bounds of the wall, if there are any
				use = 1; // now presume that we do use this part of the fd
				int n = domainCount[i]-ii;
				for(int j=1; j<n && use>0; j++){
					ind = 5*(ii+j);
					sp = iGeneralSplane(vec4(sides[ind], sides[ind+1], sides[ind+2], sides[ind+3]), int(sides[ind+4]));      
					if(iDistance(sp,pnt)<0.){
						use = 0;// but if we ever fall outside, then we do not use this part.	
						}
				}
				if(use>0){insideQ=0}
			}
	}
							
	return insideQ;	
}
