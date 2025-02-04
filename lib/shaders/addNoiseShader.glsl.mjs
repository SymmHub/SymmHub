export const addNoiseShader = 
`
in vec2 vUv;
out vec4 outValue;

//requires simplexNoise.glsl 
//requires inversiveSampler.glsl 
//requires utils.glsl

uniform sampler2D tSource;

uniform sampler2D GroupData; 
uniform float NoiseFactor;
uniform float NoiseCell;
uniform vec2  NoiseCenter;
uniform vec2  CapRadius;
uniform vec2  CapCenter;
uniform vec4  NoiseColor;  
uniform float MixWidth;     // transition width
uniform vec4 uBaseColor;
uniform float uLineThickness;
float tnoise(vec2 pnt){
  
  return snoise(pnt) + 0.3*snoise(pnt*1.5) ;
  
}

struct GroupSamplerData {
  vec2 texScale;        // scaling factor to map integer index into sampler input (float)
  int domainCount;      // count of domain sides (may be 0 if no domain sides are given)
  int splanesOffset;    // absolute offset to the domain sides 
  int transformsCount;  // count of the transforms (may be 0 if no transforms are given) 
  int transformsOffset; // absolute offset of the array of individual transforms 
};

GroupSamplerData initGroupData(sampler2D groupSampler, int groupOffset){

  GroupSamplerData data;
  //data.offset = groupOffset;
  
  data.texScale = getTexScale(groupSampler);
  
  int domainOffset = int(getValueFromTex(groupSampler, data.texScale, groupOffset).x);
  int transformDataOffset = int(getValueFromTex(groupSampler, data.texScale, groupOffset + 1).x);
  
  if(domainOffset != 0) {
    // has domain data 
    data.domainCount = int(getValueFromTex(groupSampler, data.texScale, domainOffset).x);
    data.splanesOffset = domainOffset + 1;
    
  } else {    
    // has no domain data 
    data.domainCount = 0;
    data.splanesOffset = 0;
  }
  
  
  if(transformDataOffset != 0) {
    // has transform data 
    data.transformsCount = int(getValueFromTex(groupSampler, data.texScale, transformDataOffset).x);
    data.transformsOffset = transformDataOffset + 1;
    
  } else {
    // has no transform data 
    data.transformsCount = 0;
    data.transformsOffset = 0;
  }
  
  return data;
}
//
//  return splane with given index 
//
iSPlane getDomainSplane(sampler2D groupSampler, GroupSamplerData data, int index){

   return getSplaneFromTex(groupSampler,data.texScale, data.splanesOffset + index * 2);
  
}

//
//  apply transform with given index to the point 
//
int applyTransform(sampler2D gSampler, GroupSamplerData gData, int transIndex, inout vec3 pnt, inout float scale){

    // location position of individual transforms 
    int transformOffset = int(getValueFromTex(gSampler, gData.texScale, gData.transformsOffset + transIndex).x);       
    int refCount = int(getValueFromTex(gSampler, gData.texScale, transformOffset).x);
    int transformSplanesOffset = transformOffset+1;
    
    for(int r = 0; r  < refCount; r++){
      
      iSPlane rsp = getSplaneFromTex(gSampler,gData.texScale, transformSplanesOffset + r * 2); 
      iReflect(rsp, pnt, scale);
    }
    return 0;
}

float smin( float a, float b, float k ) {
  
    float h = max( k-abs(a-b), 0.0 )/k;
    return min( a, b ) - h*h*k*(1.0/4.0);    
}

float smax(float x, float y, float k){
  return -smin(-x,-y,k);
}

/**
  return signed distance to the group domain 
*/
float getDomainDistance(sampler2D gSampler, GroupSamplerData gData, vec3 pnt, float domainSmooth){
  
	float dist = -100.; // point inside
  
	for(int s =0; s < gData.domainCount; s++){
    
    iSPlane sp = getDomainSplane(gSampler,gData, s);
    float sdist = iDistance(sp, pnt);
    dist = smax(sdist, dist, domainSmooth);
	}
  
  return dist;
}

float getDomainDensity(sampler2D gSampler, GroupSamplerData gData, vec3 pnt, float blur, float domainSmooth){
  
  return iToDensity(getDomainDistance(gSampler, gData, pnt, domainSmooth), blur);
  
}

float getGaussCap(vec2 pnt, vec2 capCenter, vec2 capSize){
  
    vec2 pc = (pnt - capCenter)/capSize;    
    return exp(-dot(pc,pc));
}

//
// symmetric noise with gauss cap 
//
float getGaussCappedSymNoise(vec2 pnt, sampler2D gSampler, GroupSamplerData gData, vec2 capSize, vec2 capCenter, vec2 noiseScale, vec2 noiseCenter) {
  
  vec3 pnt3 = vec3(pnt, 0.);
  
  float cap = getGaussCap(pnt, capCenter, capSize);  
  float v = 0.;//snoise((pnt - noiseCenter)*noiseScale);
  float res = v*cap;
  
  float scale = 1.;
  
  for(int k =0; k < gData.transformsCount; k++){
    
    vec3 tp = pnt3;     // transformed point    
    applyTransform(gSampler, gData, k, tp, scale);    
    float tv = snoise((tp.xy - noiseCenter)*noiseScale);       
    float tcap = getGaussCap(tp.xy, capCenter, capSize);    
    res += tv*tcap;
        
  }
  
  return res;
    
}


//
// symmetric noise with domain cap 
//
float getDomainCappedSymNoise(	vec2 pnt, sampler2D gSampler, GroupSamplerData gData, float blurWidth, float domainSmooth, vec2 noiseScale, vec2 noiseCenter) {
  
  vec3 pnt3 = vec3(pnt, 0.);
  
  float cap = getDomainDensity(gSampler, gData, pnt3, blurWidth, domainSmooth);  
  float v = 0.;//snoise((pnt - noiseCenter)*noiseScale);    
  float res = v*cap;
    
  float scale = 1.;
  
  for(int k = 0; k < gData.transformsCount; k++){
    
    vec3 tp = pnt3; // transformed point    
    applyTransform(gSampler, gData, k, tp, scale);    
    float tv = snoise((tp.xy - noiseCenter)*noiseScale);
    float tcap = getDomainDensity(gSampler, gData, tp, blurWidth, domainSmooth);
    
    res += tv*tcap;
        
  }
  
  return res;
    
}

float f(vec2 x)                                 
{
    float r = length(x);
    float a = atan(x.y,x.x);
    return r - 1.0 + 0.5*sin(3.0*a+2.0*r*r);
}                                                   

vec2 grad( vec2 x )												 
{
    float r = length(x);
    float a = atan(x.y,x.x);
    vec2 da = vec2(x.y,-x.x)/(r*r);
    return (x/r) + (1.5*da+2.0*x)*cos(3.0*a+2.0*r*r);
}

void main() {
          
    vec2 pnt = vUv; 
        
    GroupSamplerData gsdata = initGroupData(GroupData, 0);
    float pixelSize =2./512.;
    //float v = getGaussCappedSymNoise(pnt, GroupData, gsdata, CapRadius, CapCenter, vec2(1.,1.)/vec2(NoiseCell,NoiseCell), NoiseCenter);
    float v = getDomainCappedSymNoise(pnt, GroupData, gsdata, CapRadius.x, CapRadius.y, vec2(1.,1.)/vec2(NoiseCell,NoiseCell), NoiseCenter);
    float v_x = getDomainCappedSymNoise(pnt+vec2(-pixelSize, 0.), GroupData, gsdata, CapRadius.x, CapRadius.y, vec2(1.,1.)/vec2(NoiseCell,NoiseCell), NoiseCenter);
    float vx = getDomainCappedSymNoise(pnt+vec2(pixelSize, 0.), GroupData, gsdata, CapRadius.x, CapRadius.y, vec2(1.,1.)/vec2(NoiseCell,NoiseCell), NoiseCenter);
    float vy = getDomainCappedSymNoise(pnt+vec2(0.,pixelSize), GroupData, gsdata, CapRadius.x, CapRadius.y, vec2(1.,1.)/vec2(NoiseCell,NoiseCell), NoiseCenter);
    float v_y = getDomainCappedSymNoise(pnt+vec2(0.,-pixelSize), GroupData, gsdata, CapRadius.x, CapRadius.y, vec2(1.,1.)/vec2(NoiseCell,NoiseCell), NoiseCenter);

    //vec2 x = pnt.xy;    
    //float vv = f( x ); 
    //vec2  g = grad( x );
    
    float vv = v;
    //vec2 g = 512.*vec2(dFdx(v), dFdy(v));    
    vec2 g = vec2((vx-v_x), (vy-v_y))/(2.*pixelSize);    
    
    float de = abs(vv)/length(g);
    float eps = uLineThickness;
    
    float cc = 1.-smoothstep( 0.0*eps, 1.0*eps, de );  
    //float cc = de;  
    
    vec4 c =  NoiseFactor*vec4(cc,-cc,0,0) + uBaseColor;
    //vec4 c =  0.5*(NoiseFactor*vec4(v,-v,v,v)+1.);
    

    outValue = c;
                    
}
`;
