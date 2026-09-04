export const OVERLAY_PRE =
/*glsl*/`
//
//  overlay items: shared declarations and helpers
//
//  the program of an overlay item is assembled as
//
//     [isplane, utils, inversiveSampler, complex, texUtils, projection, iso_util, grid_util,
//      overlay_pre, overlay_<kind>, overlay_main]
//
//  overlay_<kind> defines
//
//     vec4 getItemColor(vec2 pnt, inout float scale, float pixelSize)
//
//  which returns the premultiplied colour of the item at the point, and may
//  #define OVERLAY_ITEM_SCREEN when it draws in screen space (no projection,
//  no clipping to the unit circle).
//

in vec2 vUv;        // fs input coming from vertex shader

out vec4 outColor;  // premultiplied output colour

uniform sampler2D uSimBuffer;
uniform vec2 uBufCenter;
uniform vec2 uBufScale;

uniform sampler2D uGroupData;
uniform int uIterations;
uniform bool uSymmetry;

uniform int uInterpolation;

// transparency of the item, the transparency of the overlay layer included
uniform float uTransparency;

// apply projection to the point
void applyTransform(inout vec2 pp, inout float scale){

  makeProjection(pp, scale);  // from projection.glsl

}

// map the point into the fundamental domain
void applySymmetry(inout vec2 pp, sampler2D groupData, inout float scale, bool useSymm, int symIter){

  int groupOffset = 0;
  int inDomain = 0;
  int refcount = 0;

  if(useSymm){
    vec3 pnt = vec3(pp, 0.);
    iToFundamentalDomainSampler(pnt, groupData, groupOffset, inDomain, refcount, scale, symIter);
    pp = pnt.xy;
  }
}

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

//
//  the point of an item: in world coordinates after the projection and,
//  for the items which read the pattern, folded into the fundamental domain
//
struct OverlayPoint {
    vec2  pnt;       // world point after the projection
    float pntscale;  // scale of the projection at pnt
    vec2  pfd;       // pnt folded into the fundamental domain
    float scale;     // scale after the folding
    vec2  tpnt;      // pfd in texture coordinates of the pattern buffer
    float mask;      // 1 inside of the pattern buffer, 0 outside
};

// projection only: for items drawn in world space (domain, generators, buffer box, world grid)
OverlayPoint overlayWorldPoint(vec2 pnt, float scale){
    OverlayPoint op;
    applyTransform(pnt, scale);
    op.pnt      = pnt;
    op.pntscale = scale;
    op.pfd      = pnt;
    op.scale    = scale;
    op.tpnt     = vec2(0.);
    op.mask     = 1.;
    return op;
}

// projection and folding: for items which read the pattern (isolines, tiling, limit set)
OverlayPoint overlayFoldedPoint(vec2 pnt, float scale, float pixelSize){
    OverlayPoint op = overlayWorldPoint(pnt, scale);
    vec2 pfd = op.pnt;
    float s = op.pntscale;
    applySymmetry(pfd, uGroupData, s, uSymmetry, uIterations);
    op.pfd   = pfd;
    op.scale = s;
    // map world point into texture coordinates
    op.tpnt  = world2tex(pfd, uBufScale, uBufCenter);
    // texture mask to avoid reading data outside of texture
    op.mask  = getTexMask(op.tpnt, pixelSize);
    return op;
}
/*glsl*/`;
