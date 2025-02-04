export const splatDiskShader = 
`
in vec2 vUv;
out vec4 FRAG_COLOR;

uniform float uPixelSize;

uniform vec4 color;
uniform vec2 point;
uniform float radius;
uniform float blurWidth;


float linearstep(float edge0, float edge1, float x)
{
    return  clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

void main () {
    vec2 p = vUv - point.xy;
    float halfPixel = uPixelSize/2.;
    float d = sqrt(dot(p,p));
    if(d > radius+halfPixel) {
      FRAG_COLOR = vec4(0,0,0,0);
      return;
    } 
    
    //FRAG_COLOR = color *(1.-smoothstep(radius-blurWidth, radius, d));
    FRAG_COLOR = color *(1.-linearstep(radius-blurWidth-halfPixel, radius+halfPixel, d));
    
}
`;
