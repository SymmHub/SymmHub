export const OVERLAY_GENERATORS =
/*glsl*/`
//
//  overlay item: generators.  The pairing sides of the fundamental domain with
//  a shadow, and the symmetry elements of the generators, packed into uGenData
//  by lib/grouplib/GeneratorElements.js: cone points as hurricane symbols with
//  as many arms as the order of the rotation, mirrors as lines, glide axes as
//  dashed lines with the glide vector as an arrow, translations as arrows.
//
uniform bool  uGensSidesEnabled;
uniform float uGensWidth;
uniform vec4  uGensColor;
uniform bool  uGensShadowsEnabled;
uniform vec4  uGensShadowsColor;
uniform float uGensShadowsWidth;

uniform sampler2D uGenData;        // the elements: header [count,0,0,0], then ELEM_TEXELS texels each
uniform bool  uGenElemEnabled;
uniform float uGenElemWidth;       // line width of mirrors, axes and arrows, pixels
uniform bool  uGenConeEnabled;
uniform float uGenConeSize;        // radius of a cone point symbol, pixels
uniform vec4  uGenConeColor2;
uniform vec4  uGenConeColor3;
uniform vec4  uGenConeColor4;
uniform vec4  uGenConeColor6;
uniform vec4  uGenConeColorN;      // the other orders
uniform vec4  uGenConeOutline;
uniform bool  uGenMirrorEnabled;
uniform vec4  uGenMirrorColor;
uniform bool  uGenGlideEnabled;
uniform vec4  uGenGlideColor;
uniform float uGenGlideDash;       // dash length, pixels; 0 for a solid axis
uniform bool  uGenTransEnabled;
uniform vec4  uGenTransColor;

#define ELEM_CONE        1
#define ELEM_MIRROR      2
#define ELEM_GLIDE       3
#define ELEM_TRANSLATION 4
#define ELEM_OTHER       5
#define ELEM_TEXELS      4

// signed distance (pixels) to the line or circle of the splane, and the position along it
void splaneLine(iSPlane sp, vec2 pnt, float pix, out float dist, out float along){
    if(sp.type == SPLANE_PLANE){
        dist  = (dot(pnt, sp.center.xy) - sp.radius)/pix;
        along = dot(pnt, vec2(-sp.center.y, sp.center.x))/pix;
    } else {
        vec2 d = pnt - sp.center.xy;
        float r = abs(sp.radius);
        dist  = (length(d) - r)/pix;
        along = atan(d.y, d.x)*r/pix;
    }
}

// a line of the given width, dashed when dash > 0
float lineDens(float dist, float along, float width, float dash){
    float dens = smoothstep(0.5, -0.5, abs(dist) - 0.5*width);
    if(dash > 0.){
        float t = mod(along, 2.*dash);
        dens *= smoothstep(0., 1., t) * smoothstep(dash + 1., dash, t);
    }
    return dens;
}

// an arrow from a to b (world coordinates), shaft width and sizes in pixels
float arrowDens(vec2 p, vec2 a, vec2 b, float width, float pix){
    vec2 d = b - a;
    float L = length(d)/pix;
    if(L < 1.) return 0.;
    vec2 e = d/length(d);
    vec2 q = (p - a)/pix;
    float x = dot(q, e);
    float y = dot(q, vec2(-e.y, e.x));
    float headLen = clamp(4.*width + 4., 4., 0.6*L);
    float headHW  = 0.5*headLen;
    float shaft = max(max(-x, x - (L - 0.6*headLen)), abs(y) - 0.5*width);
    float head  = max(max(x - L, (L - headLen) - x), abs(y) - headHW*(L - x)/headLen);
    return max(smoothstep(0.5, -0.5, shaft), smoothstep(0.5, -0.5, head));
}

// hurricane symbol with n arms, radius R pixels: fill and outline coverage at the offset d (pixels)
void hurricane(vec2 d, int n, float R, out float fill, out float outline){
    float r = length(d)/R;
    float phi = atan(d.y, d.x);
    float twist = 1.3;                              // the arms curl: radians over the radius
    float sector = 6.2831853/float(max(n, 1));
    float psi = phi - twist*r*r;
    float u = mod(psi, sector) - 0.5*sector;        // angle to the centre line of the nearest arm
    float across = abs(u)*r*R;                      // distance to it, pixels
    // the arm's half width: widest near the centre, pointed at the tip
    float hw = R*(0.16 + 0.34*sqrt(max(0., 1. - r)))*min(1., 0.35 + 3.*r);
    float sd = across - hw;                         // inside an arm when negative
    if(n < 2) sd = 1.e6;                            // no arms: the disk alone
    sd = min(sd, (r - 0.22)*R);                     // the central disk
    sd = max(sd, (r - 1.)*R);                       // cut at the radius
    fill    = smoothstep(0.5, -0.5, sd);
    outline = smoothstep(0.5, -0.5, abs(sd) - 0.75);
}

vec4 coneColor(int order){
    if(order == 2) return uGenConeColor2;
    if(order == 3) return uGenConeColor3;
    if(order == 4) return uGenConeColor4;
    if(order == 6) return uGenConeColor6;
    return uGenConeColorN;
}

// the elements: lines and arrows first, cone points on top
vec4 elementsColor(OverlayPoint op, float pixelSize){
    vec4 color = vec4(0.);
    float pix = pixelSize*op.pntscale;
    int n = fetchInt(uGenData, 0);
    for(int pass = 0; pass < 2; pass++){
        for(int k = 0; k < n; k++){
            int base = 1 + ELEM_TEXELS*k;
            vec4 t0 = texelFetch(uGenData, ivec2(base, 0), 0);
            int kind = int(t0.x);
            if(pass == 0){
                if(kind == ELEM_CONE) continue;
                vec4 t2 = texelFetch(uGenData, ivec2(base + 2, 0), 0);
                bool hasAxis  = int(t2.x) != SPLANE_IDENTITY;
                bool hasArrow = t2.y > 0.5;
                vec4 arrow = texelFetch(uGenData, ivec2(base + 3, 0), 0);
                float dens = 0.;
                vec4 col;
                if(kind == ELEM_MIRROR){
                    if(!uGenMirrorEnabled || !hasAxis) continue;
                    float dist, along;
                    splaneLine(fetchSplane(uGenData, base + 1), op.pnt, pix, dist, along);
                    dens = lineDens(dist, along, uGenElemWidth, 0.);
                    col = uGenMirrorColor;
                } else {
                    bool glide = (kind == ELEM_GLIDE);
                    if(glide ? !uGenGlideEnabled : !uGenTransEnabled) continue;
                    if(hasAxis){
                        float dist, along;
                        splaneLine(fetchSplane(uGenData, base + 1), op.pnt, pix, dist, along);
                        dens = lineDens(dist, along, uGenElemWidth, uGenGlideDash);
                    }
                    if(hasArrow) dens = max(dens, arrowDens(op.pnt, arrow.xy, arrow.zw, uGenElemWidth, pix));
                    col = glide ? uGenGlideColor : uGenTransColor;
                }
                color = overlayColor(color, dens*col);
            } else {
                if(kind != ELEM_CONE || !uGenConeEnabled) continue;
                int order = int(t0.y);
                vec2 d = (op.pnt - t0.zw)/pix;
                if(dot(d, d) > 4.*uGenConeSize*uGenConeSize) continue;
                float fill, outline;
                hurricane(d, order, uGenConeSize, fill, outline);
                color = overlayColor(color, fill*coneColor(order));
                color = overlayColor(color, outline*uGenConeOutline);
            }
        }
    }
    return color;
}

vec4 getItemColor(vec2 pnt, inout float scale, float pixelSize){

    OverlayPoint op = overlayWorldPoint(pnt, scale);
    vec4 color = vec4(0.);

    if(uGensSidesEnabled){
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
        if(uGensShadowsEnabled)
            color = overlayColor(color, sdwDens*uGensShadowsColor);
        color = overlayColor(color, genDens*uGensColor);
    }
    if(uGenElemEnabled){
        color = overlayColor(color, elementsColor(op, pixelSize));
    }
    return color;
}
/*glsl*/`;
