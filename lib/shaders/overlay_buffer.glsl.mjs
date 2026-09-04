export const OVERLAY_BUFFER =
/*glsl*/`
//
//  overlay item: the box of the pattern buffer, fill and outline
//
uniform bool  uBufFillEnabled;
uniform bool  uBufOutlineEnabled;
uniform vec4  uBufFillColor;
uniform float uBufOutlineWidth;
uniform vec4  uBufOutlineColor;

vec4 getItemColor(vec2 pnt, inout float scale, float pixelSize){

    OverlayPoint op = overlayWorldPoint(pnt, scale);

    // bpnt point in buffer coordinates in range [0,1]
    vec2 bpnt = world2tex(op.pnt, uBufScale, uBufCenter);
    vec2 tc = abs(bpnt - vec2(0.5));
    float bufDist = max(tc.x, tc.y)-0.5; // signed distance to the texture box
    bufDist /= (pixelSize*op.pntscale*length(uBufScale)); // normalize to pixels

    vec4 color = vec4(0.);
    if(uBufFillEnabled) {
        float bufDens = smoothstep(0.5, -0.5, bufDist);
        color = overlayColor(color, bufDens*uBufFillColor);
    }
    if(uBufOutlineEnabled){
        float outDens = smoothstep(0.5,-0.5, abs(bufDist) - 0.5*uBufOutlineWidth);
        color = overlayColor(color, outDens*uBufOutlineColor);
    }
    return color;
}
/*glsl*/`;
