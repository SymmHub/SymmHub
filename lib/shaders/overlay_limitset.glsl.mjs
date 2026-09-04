export const OVERLAY_LIMITSET =
/*glsl*/`
//
//  overlay item: limit set (the limit circle of a hyperbolic group)
//
uniform float uLsThickness;
uniform vec4  uLsColor;

vec4 getItemColor(vec2 pnt, inout float scale, float pixelSize){

    OverlayPoint op = overlayFoldedPoint(pnt, scale, pixelSize);

    float lensHeight = 1.;
    float lsDist = lensHeight / (op.scale*pixelSize);
    float lsDens = smoothstep(0.5,-0.5, lsDist - uLsThickness);

    return op.mask * (lsDens * uLsColor);
}
/*glsl*/`;
