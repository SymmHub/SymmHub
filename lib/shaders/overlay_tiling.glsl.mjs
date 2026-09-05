export const OVERLAY_TILING =
/*glsl*/`
//
//  overlay item: edges of the tiling (the sides of the fundamental domain seen through the symmetry)
//
uniform float uTilingWidth;
uniform vec4  uTilingColor;

vec4 getItemColor(vec2 pnt, inout float scale, float pixelSize){

    OverlayPoint op = overlayFoldedPoint(pnt, scale, pixelSize);

    // the sides of F at the folded point are the walls of the cell of the point;
    // with a subgroup only the walls between two H-tiles are edges of the tiling of H
    float tilingDens = 0.;
    int domainSize = getDomainSize(uGroupData, 0);
    for(int gindex = 0; gindex < domainSize; gindex++){
        if(uSubEnabled && !subIsBoundary(op.cls, gindex)) continue;
        iSPlane sp = getSplane(uGroupData, 0, gindex);
        // distance to splane in pixels
        float distPix = abs(iDistance(sp, vec3(op.pfg, 0.)))/(pixelSize*op.gscale);
        float dens = smoothstep(0.5,-0.5, distPix - 0.5*uTilingWidth);
        tilingDens = max(tilingDens, dens);
    }
    return tilingDens*uTilingColor;
}
/*glsl*/`;
