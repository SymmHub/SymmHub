export const OVERLAY_TILING =
/*glsl*/`
//
//  overlay item: edges of the tiling (the sides of the fundamental domain seen through the symmetry)
//
uniform float uTilingWidth;
uniform vec4  uTilingColor;

vec4 getItemColor(vec2 pnt, inout float scale, float pixelSize){

    OverlayPoint op = overlayFoldedPoint(pnt, scale, pixelSize);

    float tilingDens = 0.;
    int domainSize = getDomainSize(uGroupData, 0);
    for(int gindex = 0; gindex < domainSize; gindex++){
        iSPlane sp = getSplane(uGroupData, 0, gindex);
        // distance to splane in pixels
        float distPix = abs(iDistance(sp, vec3(op.pfd, 0.)))/(pixelSize*op.scale);
        float dens = smoothstep(0.5,-0.5, distPix - 0.5*uTilingWidth);
        tilingDens = max(tilingDens, dens);
    }
    return tilingDens*uTilingColor;
}
/*glsl*/`;
