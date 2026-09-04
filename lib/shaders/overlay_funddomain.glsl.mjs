export const OVERLAY_FUNDDOMAIN =
/*glsl*/`
//
//  overlay item: fundamental domain, fill and outline with shadow
//
uniform bool  uFDfillEnabled;
uniform vec4  uFDfillColor;
uniform bool  uFDoutlineEnabled;
uniform float uFDoutlineWidth;
uniform vec4  uFDoutlineColor;
uniform float uFDoutlineShadowsWidth;
uniform vec4  uFDoutlineShadowsColor;

vec4 getItemColor(vec2 pnt, inout float scale, float pixelSize){

    OverlayPoint op = overlayWorldPoint(pnt, scale);
    vec4 color = vec4(0.);

    // signed distance to the domain in pixels
    float fdDist = -1000.;
    int domainSize = getDomainSize(uGroupData, 0);
    for(int gindex = 0; gindex < domainSize; gindex++){
        iSPlane sp = getSplane(uGroupData, 0, gindex);
        float sdist = iDistance(sp, vec3(op.pnt, 0.))/(pixelSize*op.pntscale);
        fdDist = max(fdDist, sdist);
    }
    if(uFDfillEnabled){
        float fdDens = smoothstep(0.5, -0.5, fdDist);
        color = overlayColor(color, fdDens*uFDfillColor);
    }
    if(uFDoutlineEnabled){
        // outline shadow inside of the domain
        float sdens = linearstep(-max(0., uFDoutlineShadowsWidth), 0., fdDist) * smoothstep(0., -1., fdDist);
        color = overlayColor(color, sdens*uFDoutlineShadowsColor);
        float outdens = smoothstep(0.5,-0.5, abs(fdDist) - 0.5*uFDoutlineWidth);
        color = overlayColor(color, outdens*uFDoutlineColor);
    }
    return color;
}
/*glsl*/`;
