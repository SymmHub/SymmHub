export const drawDotShader = 
`
in vec2 vUv;
out vec4 outValue;

// requires sfd2d.glsl 
//
//

uniform vec4 color;
uniform vec2 pointA; // point locaton
uniform float thickness; 
uniform float blurValue; 

uniform sampler2D tSource; 

#define ZERO vec4(0.,0.,0.,0.)
#define ONE vec4(1.,1.,1.,1.)


void main () {
  
    vec2 p = vUv;

    vec4 srcColor = texture(tSource, p*0.5+vec2(0.5, 0.5));
   
    // signed distance to segment 
    float distA = sdPoint( p, pointA);
    
    //float density = 1. - smoothstep(0., thickness, distA);
    float density = 1. - linearstep(0.6*thickness, thickness, distA);
    float shape = color.w*density;
    //vec3 cc = color.xyz;
    //outValue = mix(vec4(srcColor.xyz,1.), vec4(cc,1.), shape);
    //outValue = overlayFullColor(vec4(srcColor.xyz,1.), vec4(color.xyz,color.w*shape));
    //outValue = overlayColor(vec4(srcColor.xyz,1.),color*shape);
    //outValue = overlayColor(vec4(srcColor.xyz,1.),vec4(shape*color.xyz,color.w*shape));
    outValue = overlayColor(vec4(srcColor.xyz,1.),premultColor(vec4(color.xyz,shape)));
       
    
}
`;
