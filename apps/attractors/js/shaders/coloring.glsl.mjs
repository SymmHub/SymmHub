export const coloring_hue = 
`
#ifndef PI
#define PI 3.14159265358979323846
#endif

uniform float uColorSpeed;  
uniform float uColorPhase;
uniform float uColorSign;

vec3 color_hue(float t) {
    
    return 0.5 + 0.5 * 
        vec3(cos((2. * PI) * (t)),        
             cos((2. * PI) * (t - 1./3.)),
             cos((2. * PI) * (t - 2./3.))
            );
}

vec3 getPointColor(float value){

    return color_hue(value * uColorSpeed * uColorSign - uColorPhase);
    
}
`;
