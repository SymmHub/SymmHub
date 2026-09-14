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
    float t = -atan(q.y, q.x);
    if (t >= lo && t <= hi) return d;

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
