export const drawMultiDotShader = 
`
in vec2 vUv;
out vec4 outValue;

// requires sfd2d.glsl 
//
//

uniform vec4 color;
uniform float thickness; 
uniform float blurValue; 

// points count 
uniform int pointsCount;
// point stored in sampler 
uniform sampler2D tPoints; 

// source image we draw over it
uniform sampler2D tSource; 

void main () {
  
    vec2 p = vUv;
    vec2 pt = p*0.5+vec2(0.5, 0.5); // pnt in texture coord [-1,1] -> [0,1]
    vec4 curColor = texture(tSource, pt);
    
    for(int i = 0; i < pointsCount; i++){
      
      vec2 point = texelFetch(tPoints, ivec2(i,0), 0).xy;         
      float dist = sdPoint( p, point);
    
      float r = (dist/thickness);
      float density = exp(-r*r);
    
      float shape = color.w*density;
      vec4 preColor = premultColor(vec4(color.xyz,shape));
      //curColor = overlayColor(vec4(curColor.xyz,1.),preColor);
      curColor = mix(vec4(curColor.xyz,1.), vec4(color.xyz,1.), shape);
    }

    outValue = curColor;
           
}
`;
