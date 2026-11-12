//
//  the pixel's offset from the view's centre, as canvasVertexShader gives it
//  (without u_center, so exact in float however far the view is). Only the
//  programs drawn with canvasVertexShader include it: applyAnchor()
//  (inversiveSampler) then takes the pixel's anchored world point from it
//  through the view map composed in double (ViewAnchor.js, step 1b of
//  docs/infinite_navigation_plan.md)
//
export const viewOffset =
/*glsl*/`
#define VIEW_OFFSET
in vec2 vViewOffset;
/*glsl*/`;
