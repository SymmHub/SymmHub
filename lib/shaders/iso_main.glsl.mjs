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

// buffer visualization 
uniform bool uBufFillEnabled;// = true;
uniform bool uBufOutlineEnabled;// = true;
uniform vec4 uBufFillColor;// = vec4(0., 0.2, 0, 0.2);
uniform float uBufOutlineWidth;// = 1.;
uniform vec4 uBufOutlineColor;// = vec4(0., 0.6, 0, 0.9);


uniform sampler2D uGroupData;
uniform int uIterations; 
uniform bool uSymmetry;

//
// isolines rendering params 
//
uniform bool  uIsoEnabled;
uniform int uIsoDataSource;
uniform vec4  uIsoColor;
uniform float uIsoStep;
uniform float uIsoOffset;
uniform float uIsoThickness;
uniform int   uIsoLevels;
uniform int uInterpolation;

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
uniform bool uScreenGridEnabled;
uniform vec4 uScreenGridColor;
uniform float uScreenGridWidth;
uniform int uScreenGridLevels;
uniform vec2 uScreenGridStep;

// world grid parameters 
uniform bool uWorldGridEnabled;
uniform int uWorldGridType;
uniform vec4 uWorldGridColor;
uniform float uWorldGridWidth;
uniform int uWorldGridLevels;
uniform vec2 uWorldGridStep;
uniform vec2 uWorldGridOffset;
// types of grid 
#define GRID_TYPE_CARTESIAN 0
#define GRID_TYPE_POLAR 1


// total transparency of the layer
uniform float uTransparency;


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

vec4 getOverlayColor(vec2 pnt, inout float scale, float pixelSize){
    
    float lensHeight = 1.;

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
    
        //float value = texture_biquad(uSimBuffer, tpnt);
        
        vec4 bufValue = getTexData(uSimBuffer, tpnt, uInterpolation);           
        float value = getDataSouceValue(bufValue, uIsoDataSource);   
        
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

    if(uFDfillEnabled || uFDoutlineEnabled){
        float fdDist = -1000.;
        int domainSize = getDomainSize(uGroupData, 0);
        for(int gindex = 0; gindex < domainSize; gindex++){
            iSPlane sp = getSplane(uGroupData, 0, gindex);
            float sdist = iDistance(sp, vec3(pnt, 0.))/(pixelSize*pntscale);
            fdDist = max(fdDist, sdist);
        }
        if(uFDfillEnabled){
            float fdDens = smoothstep(0.5, -0.5, fdDist);        
            color = overlayColor(color, fdDens*uFDfillColor); 
        }
        if(uFDoutlineEnabled){
            // FD outline shadows
            float sdens = linearstep(-max(0., uFDoutlineShadowsWidth), 0., fdDist) * smoothstep(0., -1., fdDist);
            color = overlayColor(color, sdens*uFDoutlineShadowsColor);             
            float outdens = smoothstep(0.5,-0.5, abs(fdDist) - 0.5*uFDoutlineWidth);
            color = overlayColor(color, outdens*uFDoutlineColor); 
        }
        
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

    if(uBufFillEnabled || uBufOutlineEnabled){
        // bpnt point in buffer coordinates in range [0,1]
        vec2 bpnt = world2tex(pnt, uBufScale, uBufCenter);
        vec2 tc = abs(bpnt - vec2(0.5));        
        float bufDist = max(tc.x, tc.y)-0.5; // signed distance to the texture box         
        bufDist /= (pixelSize*pntscale*length(uBufScale)); // normalize to pixels 
        if(uBufFillEnabled) {
            float bufDens = smoothstep(0.5, -0.5, bufDist);        
            color = overlayColor(color, bufDens*uBufFillColor);         
         }
         if(uBufOutlineEnabled){
            float outDens = smoothstep(0.5,-0.5, abs(bufDist) - 0.5*uBufOutlineWidth);
            color = overlayColor(color, outDens*uBufOutlineColor);                     
         }
        
    }
    
    if(uWorldGridEnabled){
        // default grid is cartesian 
        vec2 gridData = pnt.xy;
        switch(uWorldGridType){
            default: 
            case GRID_TYPE_CARTESIAN: break;
            case GRID_TYPE_POLAR: 
                gridData = vec2(log(length(pnt)),atan(pnt.y, pnt.x)/PI);
                break;
        }
        float gridDensX = isolines_multi(gridData.x, uWorldGridOffset.x, uWorldGridStep.x, uWorldGridWidth, uWorldGridLevels);
        float gridDensY = isolines_multi(gridData.y, uWorldGridOffset.y, uWorldGridStep.y, uWorldGridWidth, uWorldGridLevels);
        float gridDens = max(gridDensX,gridDensY);
        color = overlayColor(color, uWorldGridColor * gridDens);    
    }
    return color;
} 

void main () {
      
    vec2 pnt = vUv;
    float pixelSize = abs(dFdx(pnt.x));
    
    float scale = 1.;///(1.-dot(p.xy,p.xy));
    float sdist = -1.;
    vec4 color = vec4(0);
    
    #ifdef HAS_SPHERICAL_PROJECTION
    if(u_sphericalProjectionEnabled){
        sdist = makeSphericalProjection(pnt, scale);
        scale = 1.;
    }        
    #endif  //HAS_SPHERICAL_PROJECTION
    
    if(sdist < 0.) {
        // inside of unit circle 
        color = getOverlayColor(pnt, scale, pixelSize);
    }
    
    if(uScreenGridEnabled) {
        float dens =  getCartesianGrid2(vUv, uScreenGridStep,uScreenGridWidth, uScreenGridWidth*3.);   
        color = overlayColor(color, uScreenGridColor * dens);        
    }

    outColor = color*(1.-uTransparency);
            
}
`;