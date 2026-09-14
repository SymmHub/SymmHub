export const patternBoxOverlayShader =
/*glsl*/`
in vec2 vUv;
out vec4 outColor;

// requires isplane.glsl, utils.glsl
//
// The pattern-transform tool's box overlay, drawn entirely from splanes.
//
// Every rectangle in the tool — each texture image's placement box, and the
// pattern box around them — is stored as four bounding splanes oriented so the
// rectangle's interior is the solid (negative-iDistance) side of all four. A
// point is inside the box exactly when the max of the four distances is
// negative, so one number, boxDistance(), gives both the fill (d < 0) and the
// outline (|d| < half the line width) with no tessellation and no corner
// special cases: the outline's corners come out mitered on the inside and
// rounded on the outside, at any zoom.
//
// Storing bounding *splanes* rather than corners is what lets a box survive a
// Mobius transform: iTransformU4 turns a bounding line into a bounding circle,
// and iDistance handles both, so the same shader draws the fundamental-domain
// preview of the pattern box as draws the box itself.
//
// Shading rule (the point of the overlay — it tells the images apart by how
// much of the picture each one lets through):
//
//   not in any image            -> uShadowOut       (the darkest veil)
//   in the selected image       -> no veil at all, whatever else covers it
//   in k >= 1 unselected images -> uShadowOne at k = 1, approaching uShadowOut
//                                  geometrically as k grows, never reaching it
//
// so an unselected overlap always reads lighter than the bare background, and
// the selected image is the only fully unveiled region.
//
// Outlines are a pale hairline over a slightly wider dark halo, which is what
// keeps a one-pixel line legible over both the dark outside veil and a bright
// unveiled image.
//
// The splanes arrive as vec4 arrays rather than one flat float array: GLSL
// packing gives every element of a float[] its own uniform vector on many
// drivers, so a flat array of the same data costs four times the uniform space.

#define PB_MAX_BOXES    16

uniform vec4  uBoxSplane[PB_MAX_BOXES * 4];  // four bounding splanes per box
uniform vec4  uBoxType[PB_MAX_BOXES];        // their four types, as floats
uniform int   uBoxCount;
uniform int   uSelected;         // index of the selected box, or -1

uniform vec4  uPatternSplane[4];
uniform vec4  uPatternType;
uniform bool  uHasPattern;
uniform bool  uPatternSelected;  // the pattern as a whole is selected: unveil it

uniform vec4  uGhostSplane[4];   // the pattern box under the fd transform
uniform vec4  uGhostType;
uniform bool  uHasGhost;

uniform float u_pixelSize;       // world units per screen pixel
uniform float uFeather;          // antialiasing half-width, in screen pixels

uniform vec3  uShadowColor;
uniform float uShadowOut;        // veil alpha outside every image
uniform float uShadowOne;        // veil alpha inside exactly one unselected image
uniform float uShadowRatio;      // per-extra-overlap approach to uShadowOut, in (0,1)

uniform vec4  uHaloColor;        // dark backing under every hairline
uniform float uHaloExtra;        // px added to a line's width to make its halo

uniform float uLineWidth;        // px
uniform float uSelLineWidth;
uniform vec4  uLineColor;        // unselected image outline
uniform vec4  uSelLineColor;     // selected image outline
uniform vec4  uPatternLineColor;
uniform vec4  uGhostLineColor;

//
//  signed distance (world units) from p to the convex region bounded by box i's
//  four splanes: the region is the intersection of their solid sides, so its
//  signed distance is the max of theirs.
//
float boxDistance(int i, vec3 p) {

    float d = -1e9;
    for (int j = 0; j < 4; j++)
        d = max(d, iDistance(iGeneralSplane(uBoxSplane[i * 4 + j], int(uBoxType[i][j])), p));
    return d;
}

//  the same for the two standalone boxes (GLSL has no references to uniforms)
float patternDistance(vec3 p) {

    float d = -1e9;
    for (int j = 0; j < 4; j++)
        d = max(d, iDistance(iGeneralSplane(uPatternSplane[j], int(uPatternType[j])), p));
    return d;
}

float ghostDistance(vec3 p) {

    float d = -1e9;
    for (int j = 0; j < 4; j++)
        d = max(d, iDistance(iGeneralSplane(uGhostSplane[j], int(uGhostType[j])), p));
    return d;
}

//  how much of this pixel is inside the region (dpx in screen pixels)
float coverage(float dpx) {
    return smoothstep(uFeather, -uFeather, dpx);
}

//  how much of this pixel a stroke of the given width covers
float outline(float dpx, float widthPx) {
    float hw = 0.5 * widthPx;
    return 1. - smoothstep(hw - uFeather, hw + uFeather, abs(dpx));
}

vec4 tint(vec4 color, float density) {
    return premultColor(vec4(color.rgb, color.a * density));
}

//  a hairline with its halo, composited over dst. haloExtra is how far the
//  halo reaches past the line on each side; the pattern box uses a narrower one
//  so it stays quieter than the image outlines it encloses.
vec4 hairline(vec4 dst, float dpx, vec4 color, float widthPx, float haloExtra) {

    dst = overlayColor(dst, tint(uHaloColor, outline(dpx, widthPx + haloExtra)));
    return overlayColor(dst, tint(color,     outline(dpx, widthPx)));
}

void main () {

    vec3 p = vec3(vUv, 0.);
    float inv = 1. / u_pixelSize;

    float selCoverage = 0.;     // coverage by the selected region
    float overlap     = 0.;     // summed coverage by the unselected image boxes
    vec4  lines       = vec4(0.);
    float selDistPx   = 0.;
    bool  haveSel     = false;

    for (int i = 0; i < uBoxCount; i++) {

        float dpx = boxDistance(i, p) * inv;

        if (i == uSelected) {
            // held back so its outline lands on top of all the others
            selCoverage = coverage(dpx);
            selDistPx   = dpx;
            haveSel     = true;
            continue;
        }
        overlap += coverage(dpx);
        lines = hairline(lines, dpx, uLineColor, uLineWidth, uHaloExtra);
    }

    float patDistPx = uHasPattern ? patternDistance(p) * inv : 1e9;
    if (uHasPattern && uPatternSelected)
        selCoverage = max(selCoverage, coverage(patDistPx));

    // veil alpha as a function of how many unselected boxes cover the pixel:
    // linear over the first box (so the edge of a lone image fades in cleanly),
    // then geometric toward uShadowOut. The branches agree at overlap == 1.
    float veil = (overlap <= 1.)
        ? mix(uShadowOut, uShadowOne, overlap)
        : uShadowOut - (uShadowOut - uShadowOne) * pow(uShadowRatio, overlap - 1.);

    veil *= 1. - selCoverage;   // the selected region is never veiled

    if (uHasGhost)
        lines = hairline(lines, ghostDistance(p) * inv, uGhostLineColor, uLineWidth, uHaloExtra);

    if (uHasPattern)
        lines = hairline(lines, patDistPx, uPatternLineColor, uLineWidth, 0.5 * uHaloExtra);

    if (haveSel)
        lines = hairline(lines, selDistPx, uSelLineColor, uSelLineWidth, uHaloExtra);

    outColor = overlayColor(premultColor(vec4(uShadowColor, veil)), lines);
}
/*glsl*/`;
