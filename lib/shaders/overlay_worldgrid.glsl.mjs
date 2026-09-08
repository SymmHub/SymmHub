export const OVERLAY_WORLDGRID =
/*glsl*/`
//
//  overlay item: cartesian or polar grid in world space
//
uniform int   uWorldGridType;
uniform vec4  uWorldGridColor;
uniform float uWorldGridWidth;
uniform int   uWorldGridLevels;
uniform vec2  uWorldGridStep;
uniform vec2  uWorldGridOffset;

// types of grid
#define GRID_TYPE_CARTESIAN 0
#define GRID_TYPE_POLAR 1

vec4 getItemColor(vec2 pnt, inout float scale, float pixelSize){

    OverlayPoint op = overlayWorldPoint(pnt, scale);
    vec2 p = op.pnt;

    // default grid is cartesian
    vec2 gridData = p.xy;
    switch(uWorldGridType){
        default:
        case GRID_TYPE_CARTESIAN: break;
        case GRID_TYPE_POLAR:
            gridData = vec2(log(length(p)),atan(p.y, p.x)/PI);
            break;
    }
    float gridDensX = isolines_multi(gridData.x, uWorldGridOffset.x, uWorldGridStep.x, uWorldGridWidth, uWorldGridLevels);
    float gridDensY = isolines_multi(gridData.y, uWorldGridOffset.y, uWorldGridStep.y, uWorldGridWidth, uWorldGridLevels);
    float gridDens = max(gridDensX,gridDensY);

    return uWorldGridColor * gridDens;
}
/*glsl*/`;
