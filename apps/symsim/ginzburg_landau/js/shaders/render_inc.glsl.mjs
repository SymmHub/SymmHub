//delta_a = D_a * laplacian_a + alpha*a - gamma*b + (-beta*a + delta*b)*(a*a+b*b);
//delta_b = D_b * laplacian_b + alpha*b + gamma*a + (-beta*b - delta*a)*(a*a+b*b);
//
// rendering include 
//
export const render_inc = `

  vec2 state2screen(vec2 v) {
      return 4.*vec2((v.x),(v.y));
      
  }

#ifdef FRAG
  
//#define sfract(x)      min( fract(x)/(1.-fwidth(x)), fract(-(x))/fwidth(x) ) 
  float sfract(float x){
    float w = 1.5*fwidth(x);
    //if(w > 1.) return 0.5;
    //return min(fract(x)/(1.-w), fract(-x)/w);
    // v is in [0,1]
    float v = (1. + w) * min(fract(x), fract(-x)/w);
    return mix(0.2, v, max(0., (1.-w*w)));
    
  }

  float isolineF(float v) {
        float distToInt = abs(v-round(v));
        float div = fwidth(v);
        //vec2 f = vec2(dFdx(v), dFdy(v));
        //float div = sqrt(dot(f, f));
        return smoothstep(max(div, 0.0001), 0.0, distToInt);
  }
  // return checkerboard coloring 
  float triWave(float x){
    return sfract(x);
  }
  float squareWave(float x){
    float wave = 4.*((abs(x-round(x)))-0.25);
    return smoothstep(wave, 0., 1.);
  }
  float triChecker(vec2 v){
      return triWave(2.*v.x)*triWave(2.*v.y);
  }
  
  float checker(vec2 v){    
    float result = mod(floor(v.x) + floor(v.y), 2.0);
    return sign(result);
  }
#endif     

  uniform bool drawIsolines;
  uniform bool drawHistogram;
  uniform int  drawStyle;
  uniform int  visualComponent;
  uniform bool drawModule;
  uniform bool drawOverlay;
  uniform float scaleFactor;
  uniform float isoScale;
  uniform float bumpHeight;
  uniform vec3 lightPos;
  uniform float edge;
  uniform float edgeWidth;
  
  //uniform sampler2D simState;
  
#ifdef FRAG
 ivec2 state_size(sampler2D data) {return textureSize(data, 0);}
 vec2  state_step(sampler2D data) {return 1.0/vec2(state_size(data));}
  const float GAMMA = 2.2;


  vec3 encodeSRGB(vec3 linearRGB)
  {
      vec3 a = 12.92 * linearRGB;
      vec3 b = 1.055 * pow(linearRGB, vec3(1.0 / 2.4)) - 0.055;
      vec3 c = step(vec3(0.0031308), linearRGB);
      return mix(a, b, c);
  } 
  vec4 getBumpColor(sampler2D data){
    
    vec2 step = vec2(1./256., 1./256.);//)state_step(data);
    
    #define S(p) texture(data,p).xy
    //#define S(p) vec2(texture(data,p).x, 0.)
    #define H(x, y) S(UV + vec2(x, y) * step)
    #define A(ix, iy) scale*H(ix,iy).x 
    //#define A(ix, iy) scale*scale*dot(H(ix,iy),H(ix,iy)) 
    //#define A(ix, iy) scale*length(H(ix,iy))
    
    #define ambient 0.1
    float scale = scaleFactor;
    float bump = bumpHeight;
    #define shininess 128.
    vec3 substance_color = vec3(0.3, 0.3, 0.7);
    vec3 background_color = vec3(0.9, 0.9, 0.5);
    vec3 specular_color = vec3(0.5,0.5, 0.5);
        
    vec3 normal = normalize(vec3((A(-1, 0) - A(1, 0)), (A(0, -1) - A(0, 1)), 2.0 / bump));    
    float h = A(0, 0);
    
    vec3 pos = vec3(UV, h * bump);
    vec3 light_dir = normalize(lightPos - pos);
    
    // Transition between background and foreground (substance)
    float foregroundness = smoothstep(edge, edge + edgeWidth, h);

    vec3 diffuse_color = mix(background_color, substance_color, foregroundness);
    //vec3 diffuse_color = substance_color;
    
    float cos_theta = dot(normal, light_dir);
    if(cos_theta < 0.0){
      
        //return vec4((ambient * diffuse_color), 1);
        return vec4(0,1,0,1);        
    } else {
      // View direction is always (0,0,1) due to orthographic projection
      float reflect_z = max(2.0 * cos_theta * normal.z - light_dir.z, 0.0);
      vec3 specular = pow(reflect_z, shininess) * foregroundness * specular_color;
      return vec4(((ambient + cos_theta) * diffuse_color + specular), 1);
    }
    
  }

  #ifndef saturate
  #define saturate(v) clamp(v,0.,1.)
  #endif
  vec3 hue2rgb(float hue){
    hue=fract(hue);
    return saturate(vec3(
      abs(hue*6.-3.)-1.,
      2.-abs(hue*6.-2.),
      2.-abs(hue*6.-4.)
    ));
  }
  
  vec3 hsl2rgb(vec3 hsl){
    if(hsl.y==0.){
      return vec3(hsl.z); //Luminance.
    }else{
      float b;
      if(hsl.z<.5){
        b=hsl.z*(1.+hsl.y);
      }else{
        b=hsl.z+hsl.y-hsl.y*hsl.z;
      }
      float a=2.*hsl.z-b;
      return a+hue2rgb(hsl.x)*(b-a);
      /*vec3(
        hueRamp(a,b,hsl.x+(1./3.)),
        hueRamp(a,b,hsl.x),
        hueRamp(a,b,hsl.x-(1./3.))
      );*/
    }
  }
  
  // complex to rgb 
  vec4 _c2rgb(vec2 pnt){
    
    //vec2 pnt = 2.*(uv -vec2(0.5, 0.5));
    float len = length(pnt);
    float lumCount = 8.;
    float lum = 0.2 + 0.5*fract(lumCount*len);
    float sat = 0.2;//floor(lumCount*len)/lumCount;  
    float hue = (atan(pnt.y, pnt.x)/(2.*PI));
    float g = 16.;
    hue = floor(g*hue)/g;
    vec3 rgb = hsl2rgb(vec3(hue,sat,lum));
    return vec4(rgb, 1.);
  }

  vec4 c2rgb(vec2 pnt, float step){
    
    float value = sqrt(dot(pnt, pnt));
    value = 2.*log2(value);
    value /= step;
    float aa = sfract(value);
    float lum = (0.5*aa + 0.1);
    float sat = 0.5;
    float hue = (atan(pnt.y, pnt.x)/(2.*PI));
    vec3 rgb = hsl2rgb(vec3(hue,sat,lum));
    return vec4(rgb, 1.);
  }
  // biquadratic sampling of texture 
  vec4 sample_biquadratic(sampler2D data, vec2 uv) {
    vec2 res = vec2(textureSize(data, 0));
    vec2 q = fract(uv * res);
    vec2 c = (q*(q - 1.0) + 0.5) / res;
    vec2 w0 = uv - c;
    vec2 w1 = uv + c;
    vec4 s = texture(data, vec2(w0.x, w0.y))
           + texture(data, vec2(w0.x, w1.y))
           + texture(data, vec2(w1.x, w1.y))
           + texture(data, vec2(w1.x, w0.y));
    return s / 4.0;
  }
  
#endif     
  
`; // const render_inc
