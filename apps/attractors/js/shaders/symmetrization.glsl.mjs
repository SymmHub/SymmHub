
export const symmetrization_vert = 
`
in vec2 position;

void main () {
   
    gl_Position = vec4(position, 0, 1);
    
}`;


export const  symmetrization_frag = 

`
#ifndef PI
#define PI 3.14159265358979323846
#endif

uniform sampler2D uPointsData;

out vec4 outPnt;  // result of iteration 

void main () {

    vec4 p0 = texelFetch(uPointsData, ivec2(gl_FragCoord.xy), 0);
    
    outPnt = vec4(p0, p0.z, p0.w);

}
`;

