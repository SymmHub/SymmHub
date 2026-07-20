/**
 * maskShader.glsl.mjs
 *
 * Fragment shader for MaskWorker.
 *
 * Reads uSource (RG32F buffer), tests each texel's position (in world space
 * [-1, 1]) against a geometric mask and:
 *   — inside the mask : outputs the original value unchanged
 *   — outside the mask: outputs uMaskValue (a vec2 constant)
 *
 * Mask types (uMaskType):
 *   0 = rectangle  — centre uCenter, half-extents uExtents  (world [-1,1])
 *   1 = circle     — centre uCenter, radius uRadius         (world [-1,1])
 */

export const maskShader =
/*glsl*/`
in  vec2  vUv;
out vec4  outColor;

uniform sampler2D uSource;

uniform int   uMaskType;   // 0=rectangle, 1=circle

// shared params — all in world space [-1, 1]
uniform vec2  uCenter;     // mask centre
uniform vec2  uMaskValue;  // RG value written outside the mask

// rectangle
uniform vec2  uExtents;    // half-width, half-height

// circle
uniform float uRadius;

// outside-mask pattern
uniform vec2  uFrequency;  // spatial frequency of the sine pattern applied outside the mask

void main() {
    //vUv is in world coordinates 
    vec2 wld = vUv;
    vec2 wldinv = -wld;
    // point in tex coordinates 
    vec2 tpnt = 0.5*wld + vec2(0.5,0.5);    
    vec2 tpntinv = 0.5*wldinv + vec2(0.5,0.5);    
    vec2 src = texture(uSource, tpnt).rg;
    vec2 srcinv = texture(uSource, tpntinv).rg;

    bool inside = false;

    if (uMaskType == 0) {
        // axis-aligned rectangle
        vec2 d = abs(wld - uCenter);
        inside = (d.x <= uExtents.x) && (d.y <= uExtents.y);
    } else {
        // circle
        vec2 d = wld - uCenter;
        inside = dot(d, d) <= uRadius * uRadius;
    }
    vec2 sval = uMaskValue * sin(wld.x * uFrequency.x) * sin(wld.y * uFrequency.y);
    vec2 result = inside ? src : sval;
    outColor = vec4(result, 0.0, 1.0);
}
/*glsl*/`;


