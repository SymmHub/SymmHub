export const hist_fp = /*glsl*/`  
  //FOut = vec4(0.01-dot(XY,XY));
  FOut = vec4(exp(-dot(XY,XY)*40000.0));
`;
