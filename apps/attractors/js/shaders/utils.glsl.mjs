
export const utils = `


// 2D random points 
const float g = 1.32471795724474602596;
const vec2 q = vec2(1.0 / g, 1.0/(g*g));
vec2 qrand2(float n) {
    return fract(0.5 + q * n);
}
`;