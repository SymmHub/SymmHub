export const colormap = 
`
//
//  converts value into interpolated color from the colormap 
// colormap format: [vec4 colorRGBA, vec4(value, 0, 0, 0)]
//
vec4 getColormapColor(float value, sampler2D colormap){
          
    int count = (textureSize(colormap, 0).x);
    // init first color
    vec4 c0  = texelFetch(colormap, ivec2(0,0),0);
    float v0 = texelFetch(colormap, ivec2(1,0),0).x;
    if(value <= v0) 
        return c0;
    for(int i = 2; i < count; i += 2){
      // color
      vec4 c1  = texelFetch(colormap, ivec2(i,0),0);
      // value 
      float v1 = texelFetch(colormap, ivec2(i+1,0),0).x;
      if(value < v1){
        float a = (value - v0)/(v1 - v0);
        return mix(c0, c1, a);
      } 
      c0 = c1;
      v0 = v1;
    }
    // return last color 
    return c0;
    
}
`;

