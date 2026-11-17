export const fdInteriorOverlayShader =
/*glsl*/`
in vec2 vUv;
out vec4 outColor;

// requires isplane.glsl, utils.glsl
//
// Fills the interior of a fundamental domain bounded by walls. Usually a wall is
// one splane and the domain is the intersection of their solid
// (negative-iDistance) sides, so its signed distance is the max over them.
//
// A wall may instead be a splane plus bounds — further splanes saying where
// along it this wall runs. That happens in an orbifold with a handle or a
// second crosscap, where two or three walls lie on ONE splane, and once such an
// orbifold is given a twist its domain is genuinely non-convex: a point inside
// it can sit outside a wall's supporting splane. A wall therefore counts at p
// only where p is on the positive side of every one of its bounds; elsewhere
// that splane is not bounding the domain and must not cut the fill. Outside a
// non-convex domain this is the distance to the nearest wall actually bounding
// it there, which is what an antialiased edge needs.
//
// Distances are converted to screen pixels so the boundary is antialiased over
// a fixed pixel width at any zoom.

#define FD_STRIDE       5
#define FD_MAX_SPLANES  64

uniform float uFDData[FD_MAX_SPLANES * FD_STRIDE]; // (v.xyzw, type) per splane
uniform int   uFDWallSize[FD_MAX_SPLANES];         // splanes in wall i: 1, or 1 + bounds
uniform int   uFDCount;                            // number of walls
uniform vec4  uFillColor;   // straight (non-premultiplied) rgba
uniform float u_pixelSize;  // world units per screen pixel
uniform float uFeather;     // antialiasing half-width, in screen pixels

iSPlane fdSplane(int index){
    int k = index * FD_STRIDE;
    return iGeneralSplane(
        vec4(uFDData[k], uFDData[k + 1], uFDData[k + 2], uFDData[k + 3]),
        int(uFDData[k + 4]));
}

void main () {

    vec3 p = vec3(vUv, 0.);
    float d = -1e9; // signed distance to the domain, in world units

    int k = 0;
    for (int i = 0; i < uFDCount; i++) {
        int n = uFDWallSize[i];

        // does this wall bound the domain at p, or are we past one of its ends?
        bool bounded = true;
        for (int j = 1; j < n; j++) {
            if (iDistance(fdSplane(k + j), p) < 0.) { bounded = false; break; }
        }
        if (bounded) d = max(d, iDistance(fdSplane(k), p));

        k += n;
    }

    float density = smoothstep(uFeather, -uFeather, d / u_pixelSize);
    outColor = premultColor(vec4(uFillColor.xyz, uFillColor.w * density));
}
/*glsl*/`;
