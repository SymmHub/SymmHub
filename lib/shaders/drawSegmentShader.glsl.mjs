export const drawSegmentShader = 
`
in vec2 vUv;
out vec4 outValue;

// requires sfd2d.glsl 
//
//

uniform vec4 color;
uniform vec2 pointA; // segment ends 
uniform vec2 pointB;  
uniform float thickness; 
uniform float blurValue; 

uniform sampler2D tSource; 

#define ZERO vec4(0.,0.,0.,0.)
#define ONE vec4(1.,1.,1.,1.)


void main () {
  
    vec2 p = vUv;

    vec4 srcColor = texture(tSource, p*0.5+vec2(0.5, 0.5));
   
    // signed distance to segment 
    float distS = sdSegment( p, pointA, pointB);
    // distance to segment's start
    //float distA = sdPoint( p, pointA);
    // distance to segment without start point 
    //float distSA = max(distS, (-distA+thickness));
    
    //float density = 1. - linearstep(0.6*thickness, thickness, distS);
    float density = exp(-(distS*distS)/(thickness*thickness));
    
    
    float shape = color.w*density;

    
    //outValue = mix(vec4(srcColor.xyz,1.), color, shape);
    //outValue = overlayFullColor(vec4(srcColor.xyz,1.), color);
    //outValue = overlayFullColor(vec4(srcColor.xyz,1.), vec4(color.xyz,color.w*shape));
    //outValue = overlayFullColor(vec4(srcColor.xyz,1.), vec4(color.xyz,color.w*shape));
    //outValue = overlayColor(vec4(srcColor.xyz,1.),vec4(shape*color.xyz,shape));
    //outValue = overlayColor(vec4(srcColor.xyz,1.),color*shape);
    outValue = overlayColor(vec4(srcColor.xyz,1.),premultColor(vec4(color.xyz,shape)));
    
}
`;