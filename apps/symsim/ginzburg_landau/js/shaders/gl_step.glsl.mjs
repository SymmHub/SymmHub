export const GL_step = `

in vec2 vUv;
out vec4 outValue;

uniform sampler2D tSource;
uniform float 
    alpha, 
    beta, 
   // alphaRe,
   // betaRe,
    alphaGradient, 
    betaGradient,
    Da, 
    Db,
    timestep;
uniform bool useHMetric;


void main(){  

    #define Src(ipnt) texelFetch(tSource, ipnt,0) 
    #define S(x,y) Src(ivec2(x,y)).xy            
    #define cmul(a,b) vec2((a.x*b.x - a.y*b.y), a.x*b.y + a.y*b.x)
    
    
    // vUv in [0,1]
    // pnt in  [-1,1]
    vec2 pnt = vUv*2. - vec2(1.,1.); 
    float aa = alpha + pnt.x * alphaGradient;
    float bb = beta + pnt.y * betaGradient;
  
    float factor = 1.;
    if(useHMetric){
      vec2 pp = pnt;
      float r2 = dot(pp,pp);
      float ff = max((1. - r2),0.);
      factor = ff*ff;
    }
  
    
    ivec2 I = ivec2(gl_FragCoord.xy);

    vec2 v = Src(I).xy;
    
    ivec2 D = textureSize(tSource, 0);
    int w = D.x, h = D.y;
    int 
    x = I.x, 
    y = I.y, 
    l = (x - 1 + w) % w, 
    r = (x + 1) % w, 
    u = (y - 1 + h) % h, 
    d = (y + 1) % h;

    vec2 v_p0 = S(l, y) + S(r, y) + S(x,d) + S(x,u);
    vec2 v_pp = S(r, u) + S(l, d) + S(r,d) + S(l, u);
    // nine points laplasian 
    vec2 lapl = (0.8*v_p0 + 0.2*v_pp - 4.0*v);      
        
    vec2 ba = vec2(v.y,-v.x);
    vec2 Dab = vec2(Da,Db)*factor;

    vec2 ca = vec2(1., aa); 
    vec2 cb = vec2(1., -bb);    // parameters from wikipedia 
    //vec2 ca = vec2(alphaRe, aa);    becomes unstable for alphaRe, betaRe near 0.
    //vec2 cb = vec2(betaRe, -bb); 
    
    outValue.xy = v + timestep*(v + cmul(ca, (lapl*Dab)) - cmul(cb, v)*dot(v,v));
    
    //vec2 cb1 = vec2(bb, -1.);  // equation from Hugues Chat´e and Paul Manneville 
    //outValue.xy = v + timestep*(v + cmul(ca, (lapl*Dab)) - cmul(cb1, v)*dot(v,v));
 
}
`;

  /*  
  if(btn == 1.) { 
    vec2 pnt = XY-touchPos;
    float s = length(pnt)/brushSize;
    //FOut.xy = mix(FOut.xy, vec2(-0.25,0.25), exp(-s));
    //FOut.xy = mix(FOut.xy, vec2(-0.25,0.25), max(1.-s,0.));
    //FOut.xy = mix(FOut.xy, vec2(0.,0.), max(1.-s,0.));
    //FOut.xy = mix(FOut.xy, vec2(0.0,0.0), exp(-s));
    float a = brushTwist*atan(pnt.y, pnt.x);    
    float angle = a - brushWave*s;
    FOut.xy = 0.3*(1.-exp(-s))*vec2(cos(angle), sin(angle));
  }
  */

