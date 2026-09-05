export const OVERLAY_GENERATORS =
/*glsl*/`
//
//  overlay item: generators (the pairing sides of the fundamental domain) with shadow
//
uniform float uGensWidth;
uniform vec4  uGensColor;
uniform bool  uGensShadowsEnabled;
uniform vec4  uGensShadowsColor;
uniform float uGensShadowsWidth;

vec4 getItemColor(vec2 pnt, inout float scale, float pixelSize){

    OverlayPoint op = overlayWorldPoint(pnt, scale);

    float genDens = 0.;
    float sdwDens = 0.;
    if(uSubEnabled){
        // the generators of the subgroup pair the walls of its domain between H-tiles:
        // those walls as segments, with the shadow inside of the domain
        SubDomainDist sd = subDomainDistances(op.pnt, op.pntscale, pixelSize, uGensWidth, uGensWidth, uGensShadowsWidth);
        genDens = sd.boundaryDens;
        sdwDens = sd.shadowDens;
    } else {
        // the lines of the sides
        int domainSize = getDomainSize(uGroupData, 0);
        for(int gindex = 0; gindex < domainSize; gindex++){
            iSPlane sp = getSplane(uGroupData, 0, gindex);
            float distPix = iDistance(sp, vec3(op.pnt, 0.))/(pixelSize*op.pntscale);
            float gdens = smoothstep(0.5,-0.5, abs(distPix) - 0.5*uGensWidth);
            float sdens = linearstep(-max(0., uGensShadowsWidth), 0., distPix) * smoothstep(0., -1., distPix);
            genDens = max(genDens, gdens);
            sdwDens = max(sdwDens, sdens);
        }
    }
    vec4 color = vec4(0.);
    if(uGensShadowsEnabled)
        color = overlayColor(color, sdwDens*uGensShadowsColor);
    color = overlayColor(color, genDens*uGensColor);
    return color;
}
/*glsl*/`;
