export const hist_vp = `
  vec2 v = state(ID.xy).xy;
  VOut.xy = state2screen(v) + XY*0.5;
  //VOut.xy = state2screen(v) + 8.*XY;
`;
