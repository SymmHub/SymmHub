export const OVERLAY_EDITING =
/*glsl*/`
//
//  overlay item: the editing overlay (lib/symhublib/EditingOverlay.js): the selection
//  outlines, the transform boxes, the handles, the pivot, the snap marker, the lines
//  being drawn, the Dirichlet domain's points, bisectors and sides, as the tools hand
//  them in world coordinates (lib/symhublib/OverlayGeometry.js). Every pixel is taken
//  to its world point through the view's chain (overlayWorldPoint), so the overlay
//  lies on the picture under any projection; glyph sizes are pixels, through the
//  chain's local scale. Drawn on the picked copy: no folding.
//  The coordinates are taken from an origin (uEditOrigin): the view's centre with the
//  centred view map (uEditView), else the world's origin. The texture's geometry is from
//  the same origin (subtracted in double, EditingOverlay.js), so a deep zoom keeps the
//  float's precision of the view's size, where world coordinates near 1 keep 6e-8.
//
//  uEditData, a float texture EDIT_TEX_W texels wide, read texel by index:
//    texel 0:            [polylines, points, directory, pointsStart]
//    texel 1:            [splanes, splanesStart, 0, 0]
//    directory:          one texel per polyline [offset, 0, 0, 0]
//    a polyline:         [count, width, dash, gap]  (pixels; dash 0: solid)
//                        colour (premultiplied)
//                        halo colour (premultiplied; alpha 0: none)
//                        [haloWidth, closed, 0, 0]
//                        [x0, y0, x1, y1]  the box of its points (world, from the origin)
//                        count texels [x, y, 0, 0]
//    a point (4 texels): [x, y, kind, size]  kind 0 disc, 1 square, 2 diamond, 3 cross; size the radius, pixels
//                        stroke colour (premultiplied)
//                        fill colour (premultiplied; alpha 0: none)
//                        [strokeWidth, 0, 0, 0]
//    a splane (5 texels): [kind, width, dash, gap]  kind 0 a circle, 1 a line
//                        colour (premultiplied)
//                        halo colour (premultiplied; alpha 0: none)
//                        [haloWidth, ranged, u0, u1]  the arc: the angle about the centre
//                              (u1 may run past PI) or the position along the line
//                        [cx, cy, r, K] the circle |w - c| = r (K = |c|^2 - r^2, the power of
//                              the origin, in double), or [nx, ny, d, 0] the line n.w = d
//
uniform sampler2D uEditData;
// the point the coordinates are taken from (world): the float chain's points less it
uniform vec2 uEditOrigin;
// the tools' view (the navigator's tool transform and the chain's fixed mirrors) composed
// in double on the CPU, centred at the view (ViewAnchor centredViewMap), evaluated at the
// pixel's offset from the view's centre: exact however large the chain's mirrors are (the
// float chain gave the selection frame a wrong shape after a few long moves). uEditViewQ:
// the view's centre from the origin (0: the origin is the view's centre)
uniform bool uEditView;
uniform vec2 uEditViewQ;
uniform vec4 uEditViewAB;
uniform bool uEditViewAnti;
uniform int uEditPolylines;
uniform int uEditPoints;
uniform int uEditSplanes;

#define EDIT_TEX_W 2048
#define EDIT_MAX_POLYLINES 512
#define EDIT_MAX_POINTS 1024
#define EDIT_MAX_SEGMENTS 4096
#define EDIT_MAX_SPLANES 1024

vec4 editTexel(int i){
    return texelFetch(uEditData, ivec2(i & (EDIT_TEX_W - 1), i / EDIT_TEX_W), 0);
}

// an antialiased stroke of the width (pixels) at the pixel distance d from its centre line
float strokeDens(float d, float width){
    return smoothstep(0.5, -0.5, d - 0.5*width);
}

// the dash pattern along the stroke: on for dash pixels, off for gap pixels
float dashDens(float along, float dash, float gap){
    if(dash <= 0.) return 1.;
    float t = mod(along, dash + gap);
    return smoothstep(0., 1., t) * smoothstep(dash + 1., dash, t);
}

// the angle u brought into [u0, u0 + 2 PI): on the arc from u0 when it is at most the arc's end
float angleFrom(float u, float u0, float twoPi){
    return u + twoPi*ceil((u0 - u)/twoPi);
}

// the stroke and its halo of a curve at the pixel distance d, at along pixels from the curve's start
vec4 editStroke(vec4 color, float d, float along, vec4 h0, vec4 col, vec4 halo, float haloWidth){
    float dens = strokeDens(d, h0.y)*dashDens(along, h0.z, h0.w);
    if(halo.a > 0.) color = overlayColor(color, strokeDens(d, haloWidth)*halo);
    return overlayColor(color, dens*col);
}

vec4 getItemColor(vec2 pnt, inout float scale, float pixelSize){

    OverlayPoint op = overlayWorldPoint(pnt, scale);
    op.pnt -= uEditOrigin;
#ifdef VIEW_OFFSET
    if(uEditView){
        vec2 v = vViewOffset;
        if(uEditViewAnti) v.y = -v.y;
        vec2 A = uEditViewAB.xy;
        vec2 B = uEditViewAB.zw;
        vec2 den = A + vec2(B.x*v.x - B.y*v.y, B.x*v.y + B.y*v.x);
        float dd = dot(den, den);
        op.pnt = uEditViewQ + vec2(v.x*den.x + v.y*den.y, v.y*den.x - v.x*den.y)/dd;
        op.pntscale = length(A)/dd;
    }
#endif
    vec2 w = op.pnt;
    // world units per pixel here
    float pix = pixelSize*op.pntscale;
    // the screen's x and y directions in world coordinates, for the glyphs that keep their screen orientation
    vec2 ex = dFdx(w), ey = dFdy(w);
    float lex = length(ex), ley = length(ey);
    vec2 ux = lex > 0. ? ex/lex : vec2(1., 0.);
    vec2 uy = ley > 0. ? ey/ley : vec2(0., 1.);

    vec4 color = vec4(0.);
    vec4 head = editTexel(0);
    vec4 head1 = editTexel(1);
    int nPoly = min(int(head.x), EDIT_MAX_POLYLINES);
    int nPts  = min(int(head.y), EDIT_MAX_POINTS);
    int dir   = int(head.z);
    int ptBase = int(head.w);
    int nSpl  = min(int(head1.x), EDIT_MAX_SPLANES);
    int splBase = int(head1.y);

    // the splanes: circles and lines, whole or an arc of them, by their exact distance
    for(int k = 0; k < EDIT_MAX_SPLANES; k++){
        if(k >= nSpl) break;
        int off = splBase + 5*k;
        vec4 h0 = editTexel(off);
        vec4 h3 = editTexel(off + 3);
        vec4 g = editTexel(off + 4);
        float reach = (0.5*max(h0.y, h3.x) + 1.5)*pix;
        float d, along;
        bool circle = h0.x < 0.5;
        if(circle){
            vec2 dc = w - g.xy;
            float dist = length(dc);
            // |w - c| - r through the power of w, (|w|^2 - 2 w.c + K)/(|w - c| + r): exact
            // near the origin however large the circle, where the float of |w - c| keeps
            // 5e-4 of a radius 1e4 (a Dirichlet side that is nearly a line)
            d = abs((dot(w, w) - 2.*dot(w, g.xy) + g.w)/max(dist + g.z, 1.e-30));
            if(d > reach) continue;
            float u = atan(dc.y, dc.x);
            if(h3.y > 0.5){
                // on the arc u0..u1 (u1 may run past PI): the angle brought into [u0, u0 + 2 PI)
                float TWO_PI = 6.28318530717958648;
                float uu = angleFrom(u, h3.z, TWO_PI);
                if(uu > h3.w){
                    // beyond the arc: the distance to its nearer end
                    vec2 e0 = g.xy + g.z*vec2(cos(h3.z), sin(h3.z));
                    vec2 e1 = g.xy + g.z*vec2(cos(h3.w), sin(h3.w));
                    d = min(length(w - e0), length(w - e1));
                    if(d > reach) continue;
                }
                along = (uu - h3.z)*g.z;
            } else {
                along = (u + 3.14159265358979)*g.z;
            }
        } else {
            vec2 n = g.xy;
            vec2 t = vec2(-n.y, n.x);
            d = abs(dot(w, n) - g.z);
            if(d > reach) continue;
            float u = dot(w - n*g.z, t);
            along = u;
            if(h3.y > 0.5 && (u < h3.z || u > h3.w)){
                // beyond the arc: the distance to its nearer end
                along = u < h3.z ? h3.z : h3.w;
                d = length(w - (n*g.z + along*t));
                if(d > reach) continue;
            }
            // the dashes start at the arc's start (a ray from infinity: at the foot)
            if(h3.y > 0.5 && h3.z > -1.e29) along -= h3.z;
        }
        color = editStroke(color, d/pix, along/pix, h0, editTexel(off + 1), editTexel(off + 2), h3.x);
    }

    // the polylines: the nearest segment of each, then its stroke and halo
    for(int k = 0; k < EDIT_MAX_POLYLINES; k++){
        if(k >= nPoly) break;
        int off = int(editTexel(dir + k).x);
        vec4 h0 = editTexel(off);
        vec4 h3 = editTexel(off + 3);
        vec4 box = editTexel(off + 4);
        float reach = (0.5*max(h0.y, h3.x) + 1.5)*pix;
        if(w.x < box.x - reach || w.y < box.y - reach || w.x > box.z + reach || w.y > box.w + reach) continue;
        int count = int(h0.x);
        bool closed = h3.y > 0.5;
        int segs = closed ? count : count - 1;
        float best = 1.e30, bestAlong = 0., along = 0.;
        vec2 a = editTexel(off + 5).xy;
        for(int i = 0; i < EDIT_MAX_SEGMENTS; i++){
            if(i >= segs) break;
            int j = (i + 1 == count) ? 0 : i + 1;
            vec2 b = editTexel(off + 5 + j).xy;
            vec2 ab = b - a;
            float L2 = dot(ab, ab);
            float t = L2 > 0. ? clamp(dot(w - a, ab)/L2, 0., 1.) : 0.;
            vec2 c = a + t*ab;
            float dd = length(w - c);
            if(dd < best){ best = dd; bestAlong = along + t*sqrt(L2); }
            along += sqrt(L2);
            a = b;
        }
        if(best > 1.e29) continue;
        color = editStroke(color, best/pix, bestAlong/pix, h0, editTexel(off + 1), editTexel(off + 2), h3.x);
    }

    // the points: discs, squares, diamonds and crosses of a size in pixels
    for(int k = 0; k < EDIT_MAX_POINTS; k++){
        if(k >= nPts) break;
        int off = ptBase + 4*k;
        vec4 p0 = editTexel(off);
        vec2 d = w - p0.xy;
        float r = p0.w;
        // outside the glyph's reach: nothing
        float dd = length(d)/pix;
        float sw = editTexel(off + 3).x;
        if(dd > 1.5*r + sw + 2.) continue;
        vec4 stroke = editTexel(off + 1);
        vec4 fill = editTexel(off + 2);
        int kind = int(p0.z + 0.5);
        // the offset in screen pixels, for the glyphs with an orientation
        vec2 q = vec2(dot(d, ux), dot(d, uy))/pix;
        float sd;    // signed pixel distance to the glyph's edge
        if(kind == 1)      sd = max(abs(q.x), abs(q.y)) - r;
        else if(kind == 2) sd = abs(q.x) + abs(q.y) - r;
        else if(kind == 3) sd = min(abs(q.x) + max(0., abs(q.y) - r), abs(q.y) + max(0., abs(q.x) - r));
        else               sd = dd - r;
        if(kind == 3){
            // a cross: two strokes through the point
            color = overlayColor(color, strokeDens(sd, sw)*stroke);
        } else {
            if(fill.a > 0.) color = overlayColor(color, smoothstep(0.5, -0.5, sd)*fill);
            if(sw > 0.) color = overlayColor(color, strokeDens(abs(sd), sw)*stroke);
        }
    }

    return color;
}
/*glsl*/`;
