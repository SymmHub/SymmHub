export const canvasVertexShader = 
/*glsl*/`
precision highp float;

in vec2 position;
out vec2 vUv;
// the offset from the view's centre alone (viewOffset.glsl.mjs): small, exact in float
out vec2 vViewOffset;

uniform float u_aspect;
uniform float u_scale;
uniform vec2 u_center;
// the turn of the view (CanvasTransform angle, radians); a pass that never
// sets it reads 0, the identity
uniform float u_rotation;

void main () {
    
    // position.xy in range [-1,1] 
    // the world vector from the center along the screen's axes, turned back by the view's angle
    vec2 v = u_scale*position.xy*vec2(1.,u_aspect);
    float c = cos(u_rotation), s = sin(u_rotation);
    vViewOffset = vec2(c*v.x + s*v.y, -s*v.x + c*v.y);
	  vUv = u_center + vViewOffset;

    gl_Position = vec4(position, 0, 1.);
    
}
/*glsl*/`;