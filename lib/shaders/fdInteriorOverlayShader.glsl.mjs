export const fdInteriorOverlayShader =
/*glsl*/`
in vec2 vUv;
out vec4 outColor;

// requires isplane.glsl, utils.glsl
//
// Fills the interior of a fundamental domain bounded by splanes. The domain is
// the intersection of the solid (negative-iDistance) side of every bounding
// splane, so its signed distance is the max over them; the bounds carried by
// the individual arcs are irrelevant here — each splane bounds the domain as a
// whole half-space. Distances are converted to screen pixels so the boundary is
// antialiased over a fixed pixel width at any zoom.

#define FD_STRIDE       5
#define FD_MAX_SPLANES  64

uniform float uFDData[FD_MAX_SPLANES * FD_STRIDE]; // (v.xyzw, type) per splane
uniform int   uFDCount;
uniform vec4  uFillColor;   // straight (non-premultiplied) rgba
uniform float u_pixelSize;  // world units per screen pixel
uniform float uFeather;     // antialiasing half-width, in screen pixels

void main () {

    vec3 p = vec3(vUv, 0.);
    float d = -1e9; // signed distance to the domain, in world units

    for (int i = 0; i < uFDCount; i++) {
        int k = i * FD_STRIDE;
        iSPlane sp = iGeneralSplane(
            vec4(uFDData[k], uFDData[k + 1], uFDData[k + 2], uFDData[k + 3]),
            int(uFDData[k + 4]));
        d = max(d, iDistance(sp, p));
    }

    float density = smoothstep(uFeather, -uFeather, d / u_pixelSize);
    outColor = premultColor(vec4(uFillColor.xyz, uFillColor.w * density));
}
/*glsl*/`;
