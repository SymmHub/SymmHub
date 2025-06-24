export const ISO_MAIN = 
`
//
// draws isolines 
// 
// #include 'iso_util' 
//

in vec2 vUv; // fs input coming from vertex shader 

out vec4 outColor; // output data 


// apply projection and symmetry mapping transform to the inout vec2 pnt


void applyTransform(inout vec2 pp, inout float scale){
    
  makeProjection(pp, scale);  // from projection.glsl
  
}

void applySymmetry(inout vec2 pp, sampler2D groupData, inout float scale, bool useSymm,int symIter){

  int groupOffset = 0;
  int inDomain = 0;
  int refcount = 0;

  if(useSymm){
    vec3 pnt = vec3(pp, 0.);
    iToFundamentalDomainSampler(pnt, groupData, groupOffset, inDomain, refcount, scale, symIter);
    pp = pnt.xy;
  }  
}


uniform sampler2D uSimBuffer;
uniform vec2 uBufCenter;
uniform vec2 uBufScale;
uniform int uVisualComponent;



uniform sampler2D uGroupData;
uniform int uIterations; 
uniform bool uSymmetry;

//
// isolines rendering params 
//
uniform bool  uIsoEnabled;
uniform vec4  uIsoColor;
uniform float uIsoStep;
uniform float uIsoOffset;
uniform float uIsoThickness;
uniform int   uIsoLevels;

//
//  Limit Set rendering params 
//
uniform bool  uLsEnabled;
uniform float uLsThickness;
uniform vec4  uLsColor;

//
//  Fund Domain outline rendering params
//
uniform bool uFDoutlineEnabled;
uniform float uFDoutlineWidth;
uniform vec4 uFDoutlineColor;
uniform float uFDoutlineShadowsWidth;
uniform vec4 uFDoutlineShadowsColor;

//
//  Fund Domain fill rendering params
//
uniform bool uFDfillEnabled;
uniform vec4 uFDfillColor;

//
//  tiling outline rendering params
//
uniform bool uTilingEnabled;
uniform float uTilingWidth;
uniform vec4 uTilingColor;


//
//  generators rendering params
//
uniform bool  uGensEnabled;
uniform float uGensWidth;
uniform vec4  uGensColor;
uniform bool uGensShadowsEnabled;
uniform vec4 uGensShadowsColor;
uniform float uGensShadowsWidth;


// grid parameters 
uniform bool uGridEnabled;
uniform vec4 uGridColor;
uniform float uGridWidth;
uniform int uGridLevels;
uniform vec2 uGridStep;


//
//  thickness of spherical lens build inside of unit circle 
//  s - max thickness 
float lens(vec2 p, float s){
    float R = (1. + s*s)/(2.*s);
    float Z = R-s;
    float r2 = dot(p,p);
    float h = sqrt(R*R - r2)-Z;
    return h;
}

//
//  inverse of metric inside of poincare circle 
//
float inv_circle_metric(vec2 p, float s){
    return  s *max(0.,(1.-dot(p,p)));
}


void main () {
      
    vec2 pnt = vUv;
    float pixelSize = abs(dFdx(pnt.x));
    
    float lensHeight = 1.;
    
    float scale = 1.;///(1.-dot(p.xy,p.xy));
        
    applyTransform(pnt, scale);
    // pnt is now in world coordinated before applying symmetry 
    float pntscale = scale;
    
    vec2 pfd = pnt; 
    applySymmetry(pfd, uGroupData, scale, uSymmetry, uIterations);
    // pfd is now in world coordinated before applying symmetry 
    
    
    //if(inDomain(length(p) > 1.){        
    // test domain component bounds 
    //    outColor = vec4(0,0,0,0);
    //    return;    
    //}
    
    
    // map world point into texture coordinates
    vec2 tpnt = world2tex(pfd, uBufScale, uBufCenter);
    // texture mask to avoid reading data outside of texture 
    float mask = getTexMask(tpnt, pixelSize); 
    
    //if(mask == 0.0) {
    //    outColor = vec4(0,0,0,0);
    //    return;
    //}
    //if(vUv.x < 0.0) value = inv_circle_metric(vUv, lensHeight);
    float fadeFactor = 1.;// min(limitSetDist, 1.);
    vec4 color = vec4(0,0,0,0);
    
    if(uIsoEnabled){
        float value = texture_biquad(uSimBuffer, tpnt)[uVisualComponent];         
        //float value = 1./scale; 
        //float value = lens(vUv, lensHeight);
        //float limitSetDist = inv_circle_metric(p, lensHeight) / scale;          
        float isoValue = fadeFactor*isolines_multi(value, uIsoOffset, uIsoStep, uIsoThickness, uIsoLevels);
        color = mask*overlayColor(color, isoValue * uIsoColor);        
        //float isoValue = isolines_with_shadow(value, uIsoOffset, uIsoStep, uIsoThickness, 5., 0.3);
    }
        
    if(uTilingEnabled){
        float tilingDens = 0.;//
        int domainSize = getDomainSize(uGroupData, 0);
        for(int gindex = 0; gindex < domainSize; gindex++){
            iSPlane sp = getSplane(uGroupData, 0, gindex);
            // distance to splane in pixels 
            float distPix = abs(iDistance(sp, vec3(pfd, 0.)))/(pixelSize*scale);	 
            float dens = smoothstep(0.5,-0.5, distPix - 0.5*uTilingWidth);            
            tilingDens = max(tilingDens, dens);
        }
        color = overlayColor(color, tilingDens*uTilingColor);         
  }
  
    if(uLsEnabled){
    
        float lsDist = lensHeight / (scale*pixelSize);
        
        float lsDens = smoothstep(0.5,-0.5, lsDist - uLsThickness);            
        color = mask*overlayColor(color, lsDens * uLsColor);                
    }  

    if(uGensEnabled){
        //float genDist = abs(length(pnt)-0.5)-0.5*uGensWidth;
        float genDens = 0.;//
        float sdwDens = 0.;//
        int domainSize = getDomainSize(uGroupData, 0);
        for(int gindex = 0; gindex < domainSize; gindex++){
            iSPlane sp = getSplane(uGroupData, 0, gindex);
            float distPix = iDistance(sp, vec3(pnt, 0.))/(pixelSize*pntscale);	    
            float gdens = smoothstep(0.5,-0.5, abs(distPix) - 0.5*uGensWidth);
            float sdens = linearstep(-max(0., uGensShadowsWidth), 0., distPix) * smoothstep(0., -1., distPix);
            //float sdens = smoothstep(0.5,-0.5, abs(distPix+0.5*uGensShadowsWidth) - 0.5*uGensShadowsWidth);                        
            genDens = max(genDens, gdens);
            sdwDens = max(sdwDens, sdens);
        }
        color = overlayColor(color, sdwDens*uGensShadowsColor);                
        
        color = overlayColor(color, genDens*uGensColor);                
    }
  
    if(uFDfillEnabled || uFDoutlineEnabled){
        float fdDist = -1000.;
        int domainSize = getDomainSize(uGroupData, 0);
        for(int gindex = 0; gindex < domainSize; gindex++){
            iSPlane sp = getSplane(uGroupData, 0, gindex);
            float sdist = iDistance(sp, vec3(pnt, 0.))/(pixelSize*pntscale);
            fdDist = max(fdDist, sdist);
        }
        if(uFDoutlineEnabled){
            // FD outline shadows
            float sdens = linearstep(-max(0., uFDoutlineShadowsWidth), 0., fdDist) * smoothstep(0., -1., fdDist);
            color = overlayColor(color, sdens*uFDoutlineShadowsColor);             
            float outdens = smoothstep(0.5,-0.5, abs(fdDist) - 0.5*uFDoutlineWidth);
            color = overlayColor(color, outdens*uFDoutlineColor); 
        }
        if(uFDfillEnabled){
            float fdDens = smoothstep(0.5, -0.5, fdDist);        
            color = overlayColor(color, fdDens*uFDfillColor); 
        }
        
    }

    if(uGridEnabled) {
        float gridDens = getCartesianGrid(vUv, uGridStep,uGridWidth, 3.);    
        color = overlayColor(color, uGridColor * gridDens);
        
    }
    outColor = color;
            
}
`;