export const render_fp = `
{
    //vec2 v = state(UV).xy;
    vec2 v = sample_biquadratic(state, UV).xy;
    vec2 uv = (v.xy + vec2(0.5,0.5));
    float aa = scaleFactor*4.*dot(v.xy, v.xy);
    float value = 0.;
    switch(visualComponent){
      default: 
      case 0: 
        value = scaleFactor*v.x;
        break;
      case 1: 
        value = scaleFactor*v.y;
        break;
      case 2: 
        value = scaleFactor*sqrt(dot(v,v));        
        break;
      case 3: 
        value = scaleFactor*dot(v,v);
        break;      
    }
    
    
    switch(drawStyle){
      default: 
      case 0: 
        FOut = scaleFactor*vec4(uv.x, 0., uv.y, 1.);
        break;
      case 1: 
        {
          FOut = vec4(vec3(aa), 1.);
        }
        break;
      case 2: 
        {
          //float a = scaleFactor*sqrt(aa);
          FOut = vec4(vec3(sqrt(aa)), 1.);
        }
        break;
      case 5: 
        {
          FOut = aa*vec4(uv.x, 0, uv.y, 1.);
        }
        break;
      case 6: 
        {
          float aa = triChecker(2.*v);      
          FOut = aa*vec4(uv.x, 0, uv.y, 1.);
        }
        break;        
      case 7: 
        {
          //float aa = checker(scaleFactor*v);  
          //FOut = aa*vec4(uv.x, 0, uv.y, 1.);
          FOut = c2rgb(scaleFactor*v, 1./isoScale);
        }
        break;        
        case 8: 
          FOut = getBumpColor(state);
          break;
        case 9: {
            float v = floor(50.*UV.x)/50.;
            FOut = vec4(v,v,v,1.);
            //FOut = vec4(encodeSRGB(vec3(v,v,v)),1.);
            break;
        }
        case 10: {
            
            FOut = c2rgb(2.*(UV-vec2(0.5,0.5)), 0.2);
            
            break;
        }
    }
        
    if(drawIsolines){
      FOut.rgb = mix(FOut.rgb, vec3(1,1,0.05), isolineF(isoScale*value));    
    } 
    if(drawOverlay){
      float r = length(state2screen(v)-touchPos)*20.0;
      float s = length(XY-touchPos)*20.0;
      FOut.g += exp(-r*r) + exp(-s*s);
    }
} 
`;
