
export const utils = `

// https://extremelearning.com.au/unreasonable-effectiveness-of-quasirandom-sequences/ 
// 2D random points 
const float g = 1.32471795724474602596;
const vec2 q = vec2(1.0 / g, 1.0/(g*g));
vec2 qrand2(float n) {
    return fract(0.5 + q * n);
}
// hi-precision integer version
// https://www.shadertoy.com/view/4dtBWH
vec2 qrand2i(int n) {
    return fract(0.5 + vec2(n*12664745, n*9560333)/exp2(24.));
}
       
`;