export const renderImage = 
`
in vec2 vUv;

layout(location = 0) out vec4 outColor;
//layout(location = 1) out vec4 outPnt;

uniform float u_pixelSize; // important for AA. Set from CanvasTransform uniforms 

uniform sampler2D uImage;

uniform vec2 uImageCenter;// = vec2(0.,0.);   // location of imagfe center in world coord 
uniform vec2 uImageScale;// = vec2(1.,0.);    // complex scaling (with rotation) which maps world UV coordinates into image coordinates 
uniform float uImageTransparency;

void main() {

    vec2 pp = vUv;    

    // map world point into sampler coordinates
    vec2 tc = cMul(uImageScale,(pp.xy - uImageCenter));
    vec2 tpnt = tc +  vec2(0.5,0.5);    
    tc = abs(tc);    
    float sdb = max(tc.x, tc.y)-0.5; // signed distance to the texture box 
    float blurWidth = 0.;//u_pixelSize*0.5;
    float mask = 1.-smoothstep(-blurWidth, blurWidth, sdb);

    vec4 bufValue = texture(uImage, tpnt);
    
    //vec4 bufValue = vec4((1. + cos(8.*PI*length(tpnt)))/2., 0.2, 0.3, 1)*0.9;
    vec4 color = vec4(bufValue.xyz*bufValue.w,bufValue.w);
      
    // writing output 
    outColor = color*mask * (1.-uImageTransparency);

}
`;