export const inversiveSampler = 
/*glsl*/`
/**
  return scaling factor to access data in texture via integer index
*/
vec2 getTexScale(sampler2D data){
  
  ivec2 tSize = textureSize(data,0);
  return vec2(1./float(tSize.x), 1./float(tSize.y));
    
}

/**
  conversion from array coordinates to texture coordinates 
*/
vec2 toTexCoord(vec2 arrayCoord, vec2 texScale){
  
  return (arrayCoord + vec2(0.5,0.5))*texScale;
}

/**
  return splane read from sampler data 
*/
iSPlane getSplaneFromTex(sampler2D data, vec2 texScale,int offset){
  
  vec4 sdata = texture(data, toTexCoord(vec2(float(offset),0), texScale));
  int stype = int(texture(data, toTexCoord(vec2(float(offset + 1),0), texScale)).x);  
  return iGeneralSplane(sdata, stype);
  
}

/**
  return one value from texture at given offset 
*/
vec4 getValueFromTex(sampler2D data, vec2 texScale, int offset){
  
  return texture(data, toTexCoord(vec2(offset,0), texScale));
  
}

//
//  the bounds of the walls (DataPacking.packGroupToArray). In an orbifold with a handle
//  or a second crosscap two or three sides of the domain lie on one splane, told apart
//  by bounds (further splanes saying where along it each side runs), each side with
//  its own pairing; with a twist the domain is not convex. A side counts only where the
//  point is on the positive side of each of its bounds: the fold crosses it only there,
//  and only there does it bound the domain. The offset of the bounds data is the y of
//  the group's transforms texel, 0 for a group without bounds (every group but those)
//
int getWallsOffset(sampler2D groupData, int groupOffset){
  return int(texelFetch(groupData, ivec2(groupOffset + 1, 0), 0).y);
}

//  true if pnt is within the stretch of side g; always for a group without bounds
bool inWallBounds(sampler2D groupData, int wallsOffset, int g, vec3 pnt){
  if(wallsOffset == 0) return true;
  int boundsOffset = int(texelFetch(groupData, ivec2(wallsOffset + 1 + g, 0), 0).x);
  if(boundsOffset == 0) return true;      // an unbounded side
  int count = int(texelFetch(groupData, ivec2(boundsOffset, 0), 0).x);
  for(int j = 0; j < count; j++){
    int k = boundsOffset + 1 + 2*j;
    iSPlane bp = iGeneralSplane(texelFetch(groupData, ivec2(k, 0), 0), int(texelFetch(groupData, ivec2(k + 1, 0), 0).x));
    if(iDistance(bp, pnt) <= 0.) return false;
  }
  return true;
}


/**
  return density of interior of the fund domain stored inside of sampler at the given offest 
  
*/
float iGetFundDomainInteriorDensitySampler(vec3 pnt, sampler2D groupData, int offset, float pixelSize){
	  
	float dens = 1.;
  vec2 texScale = getTexScale(groupData);
  int domainOffset = int(getValueFromTex(groupData, texScale, offset).x);
  int count = int(getValueFromTex(groupData, texScale, domainOffset).x);
  int wallsOffset = getWallsOffset(groupData, offset);
  
  int splanesOffset = domainOffset+1;
  
	for(int i =0; i < count; i++){
    
    // past the ends of its stretch a side does not bound the domain
    if(!inWallBounds(groupData, wallsOffset, i, pnt)) continue;
    iSPlane sp = getSplaneFromTex(groupData,texScale, splanesOffset + i*2);
    dens *= iToDensity(iDistance(sp, pnt),pixelSize);				
	}
	
	return dens;
		
}

/**
  return signed distance to the interior of the fund domain stored inside of sampler at the given offest 
  
*/
float iGetFundDomainDistanceSampler(vec3 pnt, sampler2D groupData, int offset){
	  
	float dist = -100.;
  vec2 texScale = getTexScale(groupData);
  int domainOffset = int(getValueFromTex(groupData, texScale, offset).x);
  int count = int(getValueFromTex(groupData, texScale, domainOffset).x);
  int wallsOffset = getWallsOffset(groupData, offset);
  
  int splanesOffset = domainOffset+1;
  
  // the sides that bound the domain at the point: inside a domain not convex the
  // distance to the nearest of them
	for(int i =0; i < count; i++){
    
    if(!inWallBounds(groupData, wallsOffset, i, pnt)) continue;
    iSPlane sp = getSplaneFromTex(groupData,texScale, splanesOffset + i*2);
    dist = max(dist, iDistance(sp, pnt));
	}
	
	return dist;
		
}


float fetchFloat(sampler2D data, int offset){

    return texelFetch(data,ivec2(offset, 0), 0).x;
    
}

int fetchInt(sampler2D data, int offset){

    return int(texelFetch(data,ivec2(offset, 0), 0).x);
    
}


iSPlane fetchSplane(sampler2D data, int offset){

    vec4 sdata = texelFetch(data, ivec2(offset,0), 0);
    int stype = int(texelFetch(data, ivec2(offset+1,0), 0).x);  
    return iGeneralSplane(sdata, stype);

}

iSPlane getSplane(sampler2D groupData, int groupOffset, int index){

  int domainOffset = int(fetchFloat(groupData, groupOffset));
  int domainSplanesOffset = domainOffset+1;

  return fetchSplane(groupData,domainSplanesOffset + index*2); 
     
}

int getDomainSize(sampler2D groupData, int groupOffset){

  int domainOffset = int(fetchFloat(groupData, groupOffset));
  int domainSize = int(fetchFloat(groupData, domainOffset));
  return domainSize;
  
    
}
//
//  the view anchor (lib/grouplib/ViewAnchor.js): the element a of the group that
//  folds the view's centre c into F. A view shader folds a(p) instead of the world
//  point p, the fold's state started from a's (the colour permutation uAnchorPerm,
//  the class of a subgroup's cell uAnchorClass): the same picture in the few steps
//  of the screen's extent. Centred at c, only w = p - c in float:
//     a(c + w) = q + w'/(A + B w'),  w' = anti ? conj(w) : w,  |a'| = |A|/|A + B w'|^2
//
uniform bool uAnchorEnabled;
uniform vec4 uAnchorCQ;     // c.xy, q.xy
uniform vec4 uAnchorAB;     // A, B complex
uniform bool uAnchorAnti;

#ifdef VIEW_OFFSET
//  step 1b: when the view's chain is Moebius maps only, the whole map from the
//  pixel's offset v from the view's centre (vViewOffset, viewOffset.glsl.mjs) to
//  the anchored world point, a o (chain) o (centre + v), composed in double on the
//  CPU, in the same form centred at v = 0: q + v'/(A + B v'). The float world
//  point of the chain is not used, only the small offset
uniform bool uAnchorView;
uniform vec2 uAnchorViewQ;
uniform vec4 uAnchorViewAB;
uniform bool uAnchorViewAnti;
//  step 1b through the whole band (ViewAnchor.js band mode): the chain is Moebius maps
//  before the band, the band tanh(pi/4 z), Moebius maps after it. A pan along the band
//  is a motion of the disk, tanh(pi/4 (x + z)) = L(tanh(pi/4 z)), so the maps before the
//  band at the offset come centred with the real part x of the centre's point taken out
//  (uAnchorBandQ = (0, y)), the band of that small point is taken here, and the map from
//  the band's point to the anchored world point (the pan L and the maps after the band
//  composed with the anchor in double, uAnchorView*) is centred at the band's point 0
uniform bool uAnchorBand;
uniform vec2 uAnchorBandQ;
uniform vec4 uAnchorBandAB;
uniform bool uAnchorBandAnti;

//  tanh(z) and |tanh'(z)| in the closed form of cTanh (complex.glsl.mjs): the real part
//  1 less a small number held with all its digits
vec2 anchorTanh(vec2 z, out float ds){
    float e = exp(-2.*abs(z.x));
    float c = cos(z.y), s = sin(z.y);
    float t = 1. - e;
    float d = t*t + 4.*e*c*c;
    float re = 1. - 2.*e*(2.*c*c - t)/d;
    ds = 4.*e/d;
    return vec2((z.x < 0.) ? -re : re, 4.*e*s*c/d);
}
#endif

// pnt: the world point after the chain, scale its magnification (from 1 at the canvas)
void applyAnchor(inout vec3 pnt, inout float scale){
    if(!uAnchorEnabled) return;
    vec2 w = pnt.xy - uAnchorCQ.xy;
    vec2 q = uAnchorCQ.zw;
    vec4 AB = uAnchorAB;
    bool anti = uAnchorAnti;
#ifdef VIEW_OFFSET
    if(uAnchorView){
        w = vViewOffset;
        q = uAnchorViewQ;
        AB = uAnchorViewAB;
        anti = uAnchorViewAnti;
        // the composed map's magnification replaces the chain's
        scale = 1.;
        if(uAnchorBand){
            // the maps before the band at the offset, then the band: w is the band's point
            vec2 v = w;
            if(uAnchorBandAnti) v.y = -v.y;
            vec2 A1 = uAnchorBandAB.xy;
            vec2 B1 = uAnchorBandAB.zw;
            vec2 d1 = A1 + vec2(B1.x*v.x - B1.y*v.y, B1.x*v.y + B1.y*v.x);
            float dd1 = dot(d1, d1);
            vec2 z = uAnchorBandQ + vec2(v.x*d1.x + v.y*d1.y, v.y*d1.x - v.x*d1.y)/dd1;
            float ds;
            w = anchorTanh(0.7853981633974483*z, ds);
            scale *= length(A1)/dd1*0.7853981633974483*ds;
        }
    }
#endif
    if(anti) w.y = -w.y;
    vec2 A = AB.xy;
    vec2 B = AB.zw;
    vec2 den = A + vec2(B.x*w.x - B.y*w.y, B.x*w.y + B.y*w.x);
    float dd = dot(den, den);
    pnt.xy = q + vec2(w.x*den.x + w.y*den.y, w.y*den.x - w.x*den.y)/dd;
    scale *= length(A)/dd;
}

//
//  transform point into fundamental domain of the group
//  group data is stored in sampler2D
//
void iToFundamentalDomainSampler(inout vec3 pnt, sampler2D groupData, int groupOffset, inout int inDomain, inout int refcount, inout float scale, int iterations){

    float EPS = 1.e-7;
    vec2 texScale = getTexScale(groupData);

    int domainOffset = fetchInt(groupData, groupOffset);
    int transformsOffset = fetchInt(groupData, groupOffset+1);

    int domainSize = fetchInt(groupData, domainOffset);
    int wallsOffset = getWallsOffset(groupData, groupOffset);

    // location of splanes array 
    int domainSplanesOffset = domainOffset+1;
  
    refcount = 0;
    inDomain = 0;

    for(int count = 0; count <  iterations; count++){
    
        int found = 0;
        // we try to move the point into the interior of the fundamental domain, 
        // where all distance should be negative 
        // cycle over all pairing transforms 
        for(int g = 0; g < domainSize; g++){
            // side of the FD       
            iSPlane sp = fetchSplane(groupData,domainSplanesOffset + g*2);
            float ip = iDistance(sp, pnt);
            //if(abs(ip) < EPS) ip = 0.0;
            // outside the side, within the stretch of its wall it runs on
            if(ip > EPS && inWallBounds(groupData, wallsOffset, g, pnt)){
                // point is outside => transform the point 
                // get the transform data 
                int transformOffset = fetchInt(groupData, transformsOffset + g + 1);
                // location of transforms splanes 
                int transformSplanesOffset = transformOffset+1;
                //
                // count of reflections in the transformation 
                // 
                int refCount = fetchInt(groupData, transformOffset);
                // perform the transformation
                for(int r = 0; r  < refCount; r++){
                  
                    iSPlane rsp = fetchSplane(groupData,transformSplanesOffset + r*2); 
                    iReflect(rsp, pnt, scale);
                }
                refcount++;	
                found = 1;
                break;        
            }
        }
        if(found == 0){
          // no new reflections found - we are in the fundamental domain
          inDomain = 1;			
          break;
        }		
	}    
}

/*glsl*/`;
