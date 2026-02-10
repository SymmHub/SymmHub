export const colorize_frag = `
#ifndef PI
#define PI 3.14159265358979323846
#endif
uniform int u_coloringType;
float colorize(vec2 p0, vec2 p1){
    
    switch(u_coloringType){
        default:
        case 0: return (atan(p0.y, p0.x)/PI + 1.);
        case 1: return (atan(p1.y-p0.y, p1.x-p0.x)/PI + 1.);
        case 2: return (atan(p1.y-p0.x, p1.x-p0.y)/PI + 1.);
        case 3: return length(p1 - p0);
    }

}
`;
