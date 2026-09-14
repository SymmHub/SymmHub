export const drawSplaneOverlayShader =
/*glsl*/`
in vec2 vUv;
out vec4 outColor;

// requires isplane.glsl, utils.glsl
//
// Strokes one splane directly from its own definition — no tessellation.
// A point lies on the splane where iDistance() is zero: |p - center| == |radius|
// for a sphere, dot(p, normal) == distance for a line. A path of thickness
// 2*uHalfWidth is the set of points within uHalfWidth of that zero set,
// antialiased over uAA. All lengths are in the same world units as vUv.
//
// uOffset shifts the stroke toward the splane's solid side (the side iDistance
// reports as negative), which is how the wide translucent shadow pass sits
// inside the domain the way iDrawSplane()'s 2D version did.

uniform vec4  uSplane;      // sphere: (center.xyz, signed radius); line: (unit normal.xyz, distance)
uniform int   uSplaneType;  // SPLANE_SPHERE | SPLANE_PLANE
uniform vec2  uBounds;      // arc end angles, negated-angle convention (see ISplane.iSphere)
uniform bool  uBounded;
uniform vec4  uColor;       // straight (non-premultiplied) rgba
uniform float uHalfWidth;
uniform float uAA;
uniform float uOffset;

#ifndef PI
#define PI 3.1415926535897932384626433832795
#endif

//
//  is the angle t on the bounded arc?
//
//  ISplane.iSphere() stores the two end angles without recording which of the
//  two arcs between them is meant, and resolves the ambiguity by always
//  choosing the arc that does NOT cross the atan2 branch cut at +-PI: when the
//  ends are less than PI apart that is the interval between them, and when they
//  are more than PI apart it is the other one, wrapping through +-PI. Reading
//  bounds as "always the interval between them" draws the complement of the arc
//  in that second case — a circle with a wedge missing instead of just the
//  wedge. nearArcQ() and 2D canvas arc(...,true) both split the cases this way.
//
bool onArc(float t, float lo, float hi) {

    return (hi - lo < PI) ? (t >= lo && t <= hi) : (t <= lo || t >= hi);
}

//
//  distance from p to the bounded splane, with round caps at the arc ends
//
float splaneDistance(vec2 p) {

    // shifting v.w toward the solid side works for both flavors: it shrinks a
    // positive sphere radius, grows a negative one, and slides a line along -normal
    vec4 v = vec4(uSplane.xyz, uSplane.w - uOffset);
    float d = abs(iDistance(iGeneralSplane(v, uSplaneType), vec3(p, 0.)));

    if (!uBounded || uSplaneType != SPLANE_SPHERE) return d;

    float lo = min(uBounds.x, uBounds.y);
    float hi = max(uBounds.x, uBounds.y);
    vec2 q = p - v.xy;
    if (onArc(-atan(q.y, q.x), lo, hi)) return d;

    float r = abs(v.w);
    vec2 e0 = v.xy + r * vec2(cos(-lo), sin(-lo));
    vec2 e1 = v.xy + r * vec2(cos(-hi), sin(-hi));
    return min(length(p - e0), length(p - e1));
}

void main () {

    float density = 1. - smoothstep(uHalfWidth - uAA, uHalfWidth + uAA, splaneDistance(vUv));
    outColor = premultColor(vec4(uColor.xyz, uColor.w * density));
}
/*glsl*/`;
