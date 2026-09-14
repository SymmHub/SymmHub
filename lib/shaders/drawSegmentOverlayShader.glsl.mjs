export const drawSegmentOverlayShader =
/*glsl*/`
in vec2 vUv;
out vec4 outColor;

// requires sdf2d.glsl, utils.glsl
//
// draws one straight segment [pointA,pointB] as a solid stroke of the given
// half-width, antialiased over aa (all in the same units as vUv), directly
// onto whatever is already in the framebuffer (premultiplied-alpha blend).

uniform vec4  color;      // straight (non-premultiplied) rgba
uniform vec2  pointA;
uniform vec2  pointB;
uniform float halfWidth;
uniform float aa;

void main () {

    float distS = sdSegment(vUv, pointA, pointB);
    float density = 1. - smoothstep(halfWidth - aa, halfWidth + aa, distS);
    outColor = premultColor(vec4(color.xyz, color.w * density));
}
/*glsl*/`;
