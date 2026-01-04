export const cpu_accumulator_frag = 
`
in vec3 v_color;
in vec2 v_histCoord; // coordinate of point in histogram coordinates (0,1)
out vec4 outColor;

uniform float uPixelSizeFactor;
uniform sampler2D uHistogram;
uniform float uHistThreshold;

void main () {

    vec4 oldValue = texelFetch(uHistogram,  ivec2(gl_FragCoord.xy), 0);
    if(oldValue.x > uHistThreshold) 
        discard;
    // 1. Calculate distance from the center (0.5, 0.5)
    float dist = distance(gl_PointCoord, vec2(0.5));
    // fwidth(dist) calculates how much 'dist' changes between pixels.
    //float delta = fwidth(dist);
    // Create a smooth alpha ramp.
    // This maps the edge of the circle (0.5) to a smooth transition.
    //float alpha = 1.0 - smoothstep(0.5 - delta, 0.5, dist);
    
    // smooth cap 
    float alpha = 2.*(1.0 - smoothstep(0., 0.5, dist));    
    // Discard fully transparent pixels to save performance
    if (alpha <= 0.) {
        discard;
    }
    outColor = alpha * vec4(1., v_color) * uPixelSizeFactor;
}
`;
