export const gsBrushShader = 

`
in vec2 vUv;
out vec2 outValue;

// result of operation 

//   mix(src, brushValue, brushShape);
//
// brushValue have 2 channels
// brushValue may be positive and negative 

uniform vec2 brushColor;
uniform vec2 brushCenter;
uniform float brushRadius;
uniform float brushBlur; 
uniform sampler2D tSource; 

float linearStep(float edge0, float edge1, float x)
{
    return  clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}


void main () {
  
    vec2 p = vUv - brushCenter;
    
    //float shape = exp(-dot(p, p) / brushRadius2);
    
    float radius = brushRadius;
    float blur = brushBlur*brushRadius;
    float shape = (1. - linearStep(radius - blur, radius, sqrt(dot(p, p))));
    
    vec2 src = texture(tSource, vUv*0.5+vec2(0.5, 0.5)).rg;
            
    outValue = clamp(mix(src, brushColor, shape), vec2(0.,0.), vec2(1., 1.));
    
}
`;