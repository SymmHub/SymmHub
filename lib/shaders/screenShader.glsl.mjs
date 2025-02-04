export const screenShader = 

`
in vec2 vUv;
out vec4 outColor;

uniform sampler2D u_texture;

uniform float uPixelSize; 
uniform vec2 u_texCenter;
uniform vec2 u_texScale;
uniform float u_texAlpha;


/*
uniform vec4 color1;
uniform vec4 color2;
uniform vec4 color3;
uniform vec4 color4;
uniform vec4 color5;
*/

vec4 color1 = vec4(0, 0, 0.0, 0);
vec4 color2 = vec4(0, 1, 0, 0.2);
vec4 color3 = vec4(1, 1, 0, 0.201);
vec4 color4 = vec4(1, 0, 0, 0.4);
vec4 color5 = vec4(1, 1, 1, 0.6);


void main() {
  
    // map [-1,1] onto [0,1]
    //vec2 pnt = 0.5*vUv + vec2(0.5,0.5); 
    vec2 pnt = vUv;
    vec2 tc = cMul(u_texScale,(pnt-u_texCenter));
    vec2 tp = tc + vec2(0.5,0.5);
    //float halfTexel = 0.5/float(textureSize(u_texture,0).x);
    // half texel shift 
    //tp += vec2(halfTexel, halfTexel);
    
    float value = texture(u_texture, tp).g;
    //value = fmod(5.*value, 1.);
    tc = abs(tc);
    float sdb = max(tc.x, tc.y)-0.5; // signed distance to the texture box 
    float blurWidth = uPixelSize*0.5;
    float mask = 1.-smoothstep(-blurWidth, blurWidth, sdb);
    
    float a;
    vec3 col;
    
    if(value <= color1.a)
        col = color1.rgb;
    if(value > color1.a && value <= color2.a)
    {
        a = (value - color1.a)/(color2.a - color1.a);
        col = mix(color1.rgb, color2.rgb, a);
    }
    if(value > color2.a && value <= color3.a)
    {
        a = (value - color2.a)/(color3.a - color2.a);
        col = mix(color2.rgb, color3.rgb, a);
    }
    if(value > color3.a && value <= color4.a)
    {
        a = (value - color3.a)/(color4.a - color3.a);
        col = mix(color3.rgb, color4.rgb, a);
    }
    if(value > color4.a && value <= color5.a)
    {
        a = (value - color4.a)/(color5.a - color4.a);
        col = mix(color4.rgb, color5.rgb, a);
    }
    if(value > color5.a)
        col = color5.rgb;
    
  outColor = vec4(col.r, col.g, col.b, 1.)*mask;
}
`;
