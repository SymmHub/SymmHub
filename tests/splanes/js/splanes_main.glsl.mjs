export const SPLANES_MAIN = `

in vec2 vUv;

layout(location = 0) out vec4 outColor;

uniform float u_lineWidth;
uniform float u_shadowWidth;
uniform float u_shadowIntensity;
uniform vec4 u_lineColor;

float getCircleDist(vec2 p, vec2 center, float radius){

    return length(p - center) - radius;
    
}


void main() {

    vec2 p = vUv;

    if(length(fwidth(p)) == 0.) {
        // test if we missing vUv calculations
        outColor = vec4(0.5, 0., 0.5, 0.5);
        return;
    }

    float totalDens = 0.;
    
    float N = 20.;
    
    float dx = 1./N;
    float dy = 1./N;
    float radius = dx;
    
    for(float i = -N; i <= N; i++){
        for(float j = -N; j <= N; j++){  
        
            vec2 center = vec2(i * dx, j * dy);
            
            float v = getCircleDist(p, center, radius);  
            
            //float dens = isoline_with_shadow(v, 0., u_lineWidth, u_shadowWidth, u_shadowIntensity);
            float dens = isoline_v0(v, 0.,u_lineWidth);
            totalDens = max(totalDens, dens);
        }
    }
    


    outColor = u_lineColor * totalDens;
    
}
`;
