//
//  Shared GLSL helpers for animatable World Curtain Split (per-layer clip)
//  and Solution 1 Placement SPlane Region Mixing (world / domain / shape).
//
//  Used by colorTiles, colorImageArray, and colorImageSprites via ColorSymPrograms.
//  When uClipEnabled and uMixEnabled are both false (default), overhead is a
//  single uniform branch.
//

export const placementTransition =
/*glsl*/`
// World-space curtain clip (clips this layer so two layers can split the canvas)
uniform bool  uClipEnabled;
uniform int   uClipSpace;       // 0 = screen-world vUv, 1 = projected plane pp (for hyperbolic geodesics)
uniform int   uClipSplaneType;  // 0 = identity (all outside), 1 = sphere, 2 = plane
uniform vec4  uClipSplaneData;  // sphere: (cx, cy, 0, r), plane: (nx, ny, 0, dist)
uniform float uClipBlur;        // softness in world units (0 = crisp pixel AA)
uniform bool  uClipInvert;      // false: keep outside (d > 0), true: keep inside (d < 0)

// Single-layer SPlane placement mix (uPlacement1 outside, uMixPlacement2 inside)
uniform bool  uMixEnabled;
uniform uint  uMixPlacement2;   // second placement index (0..23)
uniform int   uMixSpace;        // 0 = screen-world vUv, 1 = projected pp, 2 = domain FD, 3 = shape/sprite local
uniform int   uMixSplaneType;   // 0 = identity, 1 = sphere, 2 = plane
uniform vec4  uMixSplaneData;
uniform float uMixBlur;
uniform bool  uMixInvert;

// Optional subtle divider hairline along the active splane boundary
uniform bool  uMixShowLine;
uniform vec4  uMixLineColor;    // premultiplied RGBA

// Evaluate world curtain clip alpha in [0, 1] and optional divider hairline weight.
float evalWorldClip(vec2 screenWorldP, vec2 projWorldP, float aaScreen, float aaProj, out float lineWeight) {
    lineWeight = 0.0;
    if (!uClipEnabled) return 1.0;
    vec2 p = (uClipSpace == 1) ? projWorldP : screenWorldP;
    float aa = (uClipSpace == 1) ? aaProj : aaScreen;
    iSPlane sp = iGeneralSplane(uClipSplaneData, uClipSplaneType);
    float d = iDistance(sp, vec3(p, 0.0));
    float w = max(uClipBlur, aa);
    float inside = 1.0 - smoothstep(-w, w, d);
    if (uMixShowLine && uClipSplaneType != SPLANE_IDENTITY) {
        lineWeight = 1.0 - smoothstep(0.0, aa * 1.9, abs(d));
    }
    return uClipInvert ? inside : (1.0 - inside);
}

// Evaluate placement mix factor m in [0, 1]:
//   0 = outside (primary placement), 1 = inside (uMixPlacement2)
float evalPlacementMix(vec3 p, float aa, out float lineWeight) {
    lineWeight = 0.0;
    if (!uMixEnabled) return 0.0;
    iSPlane sp = iGeneralSplane(uMixSplaneData, uMixSplaneType);
    float d = iDistance(sp, p);
    if (uMixInvert) d = -d;
    float w = max(uMixBlur, aa);
    if (uMixShowLine && uMixSplaneType != SPLANE_IDENTITY) {
        lineWeight = 1.0 - smoothstep(0.0, aa * 1.8, abs(d));
    }
    return 1.0 - smoothstep(-w, w, d);
}

// Overlay optional divider hairline (premultiplied SRC_OVER)
vec4 applyCutLine(vec4 base, float lineWeight) {
    if (lineWeight <= 0.001) return base;
    vec4 ln = uMixLineColor * lineWeight;
    return ln + base * (1.0 - ln.a);
}
`;
