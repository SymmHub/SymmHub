export const patternMarkOverlayShader =
/*glsl*/`
in vec2 vUv;
out vec4 outColor;

// requires isplane.glsl, utils.glsl
//
// The pattern-transform tool's point marks — corner grab handles, the pivot and
// its ticks, and the fundamental-domain probe points — drawn from splanes like
// everything else in the tool.
//
// A ring handle is a sphere splane: iDistance() is already |p - c| - r, so the
// ring is |iDistance| < half the line width and the disk it encloses is
// iDistance < 0. A pivot tick is a line splane carrying a parametric extent
// along its own tangent — the same "bounded splane" idea a fundamental domain's
// arcs use, written for a line instead of a circle; clamping to that extent
// before measuring gives round caps for free.
//
// Marks are sized in screen pixels and their radii arrive already converted to
// world units, so a handle keeps its size as the view zooms while everything
// about it stays a splane. Every stroke sits on a slightly wider dark halo, so
// a hairline handle reads over a bright image as well as over the dark veil.

#define PM_MAX_MARKS    64
#define PM_STYLES       5

uniform vec4  uMarkSplane[PM_MAX_MARKS];   // the splane itself
uniform vec4  uMarkParam[PM_MAX_MARKS];    // (type, bound0, bound1, style)
uniform int   uMarkCount;

uniform float u_pixelSize;      // world units per screen pixel
uniform float uFeather;         // antialiasing half-width, in screen pixels

uniform vec4  uHaloColor;
uniform float uHaloExtra;       // px added to a stroke's width to make its halo

uniform vec4  uStrokeColor[PM_STYLES];
uniform vec4  uFillColor[PM_STYLES];
uniform float uStrokeWidth[PM_STYLES];  // px

//
//  distance from p to mark i's zero set, in world units. Signed for a ring
//  (negative inside); for a segment only the magnitude is meaningful, since a
//  segment bounds no region.
//
float markDistance(int i, vec3 p) {

    vec4 v  = uMarkSplane[i];
    vec4 pm = uMarkParam[i];
    int type = int(pm.x);

    if (type == SPLANE_PLANE) {
        // clamp to the stored extent along the line's own tangent, measured
        // from its foot point v.xy * v.w
        vec2 n    = normalize(v.xy);
        vec2 t    = vec2(-n.y, n.x);
        vec2 foot = n * v.w;
        float s   = clamp(dot(p.xy - foot, t), pm.y, pm.z);
        return length(p.xy - (foot + t * s));
    }

    return iDistance(iGeneralSplane(v, type), p);
}

float outline(float dpx, float widthPx) {
    float hw = 0.5 * widthPx;
    return 1. - smoothstep(hw - uFeather, hw + uFeather, abs(dpx));
}

vec4 tint(vec4 color, float density) {
    return premultColor(vec4(color.rgb, color.a * density));
}

void main () {

    vec3 p = vec3(vUv, 0.);
    float inv = 1. / u_pixelSize;
    vec4 col = vec4(0.);

    for (int i = 0; i < uMarkCount; i++) {

        int type  = int(uMarkParam[i].x);
        int style = int(uMarkParam[i].w);

        float dpx = markDistance(i, p) * inv;
        float w   = uStrokeWidth[style];

        // a segment bounds nothing, so only rings carry a fill
        float fill = (type == SPLANE_PLANE) ? 0. : smoothstep(uFeather, -uFeather, dpx);

        col = overlayColor(col, tint(uFillColor[style], fill));
        col = overlayColor(col, tint(uHaloColor, outline(dpx, w + uHaloExtra)));
        col = overlayColor(col, tint(uStrokeColor[style], outline(dpx, w)));
    }

    outColor = col;
}
/*glsl*/`;
