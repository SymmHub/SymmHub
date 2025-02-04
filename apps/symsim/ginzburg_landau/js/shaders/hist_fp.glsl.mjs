export const hist_fp = `  
  //FOut = vec4(0.01-dot(XY,XY));
  FOut = vec4(exp(-dot(XY,XY)*40000.0));
`;
