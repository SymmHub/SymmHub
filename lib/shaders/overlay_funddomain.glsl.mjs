export const OVERLAY_FUNDDOMAIN =
/*glsl*/`
//
//  overlay item: fundamental domain, fill and outline with shadow; with a
//  subgroup the domain is the union of cells of the renderer's domain and the
//  interior walls of the union may be drawn as well
//
uniform bool  uFDfillEnabled;
uniform vec4  uFDfillColor;
uniform bool  uFDoutlineEnabled;
uniform float uFDoutlineWidth;
uniform vec4  uFDoutlineColor;
uniform float uFDoutlineShadowsWidth;
uniform vec4  uFDoutlineShadowsColor;
uniform bool  uFDwallsEnabled;
uniform float uFDwallsWidth;
uniform vec4  uFDwallsColor;

vec4 getItemColor(vec2 pnt, inout float scale, float pixelSize){

    OverlayPoint op = overlayWorldPoint(pnt, scale);
    vec4 color = vec4(0.);

    float fdDist;             // signed distance to the domain in pixels
    float outlineDens;
    float shadowDens;
    float wallsDens = 0.;

    if(uSubEnabled){
        SubDomainDist sd = subDomainDistances(op.pnt, op.pntscale, pixelSize, uFDoutlineWidth, uFDwallsWidth, uFDoutlineShadowsWidth);
        fdDist      = sd.unionDist;
        outlineDens = sd.boundaryDens;
        shadowDens  = sd.shadowDens;
        wallsDens   = sd.wallsDens;
    } else {
        fdDist = -1000.;
        int domainSize = getDomainSize(uGroupData, 0);
        for(int gindex = 0; gindex < domainSize; gindex++){
            iSPlane sp = getSplane(uGroupData, 0, gindex);
            float sdist = iDistance(sp, vec3(op.pnt, 0.))/(pixelSize*op.pntscale);
            fdDist = max(fdDist, sdist);
        }
        // outline shadow inside of the domain
        shadowDens  = linearstep(-max(0., uFDoutlineShadowsWidth), 0., fdDist) * smoothstep(0., -1., fdDist);
        outlineDens = smoothstep(0.5,-0.5, abs(fdDist) - 0.5*uFDoutlineWidth);
    }

    if(uFDfillEnabled){
        float fdDens = smoothstep(0.5, -0.5, fdDist);
        color = overlayColor(color, fdDens*uFDfillColor);
    }
    if(uFDwallsEnabled){
        color = overlayColor(color, wallsDens*uFDwallsColor);
    }
    if(uFDoutlineEnabled){
        color = overlayColor(color, shadowDens*uFDoutlineShadowsColor);
        color = overlayColor(color, outlineDens*uFDoutlineColor);
    }
    return color;
}
/*glsl*/`;
