
export const gpu_copy_vert = 
`
in vec2 position;

void main () {

    gl_Position = vec4(position, 0, 1);
    
}`;

export const  gpu_copy_frag = 
`
uniform sampler2D uSrc;
out vec4 outPnt;
void main () {
    outPnt = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0);
    //outPnt = vec4(1.,1.,1.,1.);
}
`;

