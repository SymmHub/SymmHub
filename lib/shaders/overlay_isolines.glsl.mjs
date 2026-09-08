export const OVERLAY_ISOLINES =
/*glsl*/`
//
//  overlay item: isolines of one data source of the pattern
//
uniform int   uIsoDataSource;
uniform vec4  uIsoColor;
uniform float uIsoStep;
uniform float uIsoOffset;
uniform float uIsoThickness;
uniform int   uIsoLevels;

vec4 getItemColor(vec2 pnt, inout float scale, float pixelSize){

    OverlayPoint op = overlayFoldedPoint(pnt, scale, pixelSize);

    vec4 bufValue = getTexData(uSimBuffer, op.tpnt, uInterpolation);
    float value = getDataSouceValue(bufValue, uIsoDataSource);
    float isoValue = isolines_multi(value, uIsoOffset, uIsoStep, uIsoThickness, uIsoLevels);

    return op.mask * (isoValue * uIsoColor);
}
/*glsl*/`;
