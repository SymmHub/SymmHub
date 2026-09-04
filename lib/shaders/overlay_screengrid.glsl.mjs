export const OVERLAY_SCREENGRID =
/*glsl*/`
//
//  overlay item: grid in screen space, drawn over the whole canvas
//
#define OVERLAY_ITEM_SCREEN

uniform vec4  uScreenGridColor;
uniform float uScreenGridWidth;
uniform int   uScreenGridLevels;
uniform vec2  uScreenGridStep;

vec4 getItemColor(vec2 pnt, inout float scale, float pixelSize){

    float dens = getCartesianGrid2(vUv, uScreenGridStep, uScreenGridWidth, uScreenGridWidth*3.);
    return uScreenGridColor * dens;
}
/*glsl*/`;
