export const GL_utils = 
`
// source: https://www.shadertoy.com/view/XlXcW4
// TODO more complete hash library
vec3 hash( ivec3 ix ) {
    uvec3 x = uvec3(ix);
    const uint k = 1103515245U;
    x = ((x>>8U)^x.yzx)*k;
    x = ((x>>8U)^x.yzx)*k;
    x = ((x>>8U)^x.yzx)*k;
    return vec3(x)*(1.0/float(0xffffffffU));
}
`;

