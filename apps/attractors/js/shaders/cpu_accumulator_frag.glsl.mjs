export const cpu_accumulator_frag = 
`
 in vec3 v_color;
 in vec2 v_histCoord; // coordinate of point in histogram coordinates (0,1)
 out vec4 outColor;

 uniform float pointSize;
 uniform sampler2D uHistogram;
 
 void main () {
 
    //vec4 oldValue = texelFetch(uHistogram,  ivec2(gl_FragCoord.xy), 0);
    vec4 oldValue = texture(uHistogram,  v_histCoord);
    //if(oldValue.x > 10.) 
    //    discard;
    
    outColor = oldValue + vec4(1., v_color) / (pointSize * pointSize);
}
`;
