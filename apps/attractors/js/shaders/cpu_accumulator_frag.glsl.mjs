export const cpu_accumulator_frag = 
`
 in vec3 v_color;
 out vec4 outColor;

 uniform float pointSize;
 
 void main () {
    outColor = vec4(1, v_color) / (pointSize * pointSize);
}
`;
