export const bufferToScreenImageArray = 
/*glsl*/`
in vec2 vUv;

layout(location = 0) out vec4 outColor;

uniform float u_pixelSize;

#ifndef MAX_IMAGES
#define MAX_IMAGES 8
#endif

uniform sampler2D uDataBufferArray[MAX_IMAGES];
uniform int uNumImages;

uniform vec2 uBufCenter;
uniform vec2 uBufScale;
uniform int uDataSource;

uniform sampler2D uGroupData;
uniform int uIterations;
uniform bool uSymmetry;
uniform int uInterpolation;
uniform float uTransparency;

void main() {

    int groupOffset = 0;
    int inDomain = 0;
    int refcount = 0;

    vec2 pp = vUv;

    float scale = 1.;

    #ifdef HAS_SPHERICAL_PROJECTION
    if(u_sphericalProjectionEnabled){
        float sdist = makeSphericalProjection(pp, scale);
        if(sdist > 0.) {
            outColor = vec4(0,0,0,0);
            return;
        }
    }
    #endif

    #ifdef HAS_PROJECTION
    makeProjection(pp, scale);
    #endif

    vec3 wpnt = vec3(pp, 0.);

    if(uSymmetry){
        iToFundamentalDomainSampler(wpnt, uGroupData, groupOffset, inDomain, refcount, scale, uIterations);
    }
    if(uSymmetry && inDomain == 0) {
        outColor = vec4(0,0,0,0);
        return;
    }

    // Map world point into sampler coordinates.
    vec2 tc = cMul(uBufScale, (wpnt.xy - uBufCenter));
    vec2 tpnt = tc + vec2(0.5, 0.5);
    tc = abs(tc);
    float sdb = max(tc.x, tc.y) - 0.5;
    float blurWidth = u_pixelSize * 0.5;
    float mask = 1. - smoothstep(-blurWidth, blurWidth, sdb);

    // Composite all layers using Porter-Duff "over" (premultiplied).
    // Sampler arrays require constant-expression indices in GLSL ES, so the
    // loop is manually unrolled.  Add more blocks if MAX_IMAGES grows beyond 8.
    vec4 color = vec4(0.0);
    if (uNumImages > 0) { color = overlayColor(color, getTexData(uDataBufferArray[0], tpnt, uInterpolation)); }
    if (uNumImages > 1) { color = overlayColor(color, getTexData(uDataBufferArray[1], tpnt, uInterpolation)); }
    if (uNumImages > 2) { color = overlayColor(color, getTexData(uDataBufferArray[2], tpnt, uInterpolation)); }
    if (uNumImages > 3) { color = overlayColor(color, getTexData(uDataBufferArray[3], tpnt, uInterpolation)); }
    if (uNumImages > 4) { color = overlayColor(color, getTexData(uDataBufferArray[4], tpnt, uInterpolation)); }
    if (uNumImages > 5) { color = overlayColor(color, getTexData(uDataBufferArray[5], tpnt, uInterpolation)); }
    if (uNumImages > 6) { color = overlayColor(color, getTexData(uDataBufferArray[6], tpnt, uInterpolation)); }
    if (uNumImages > 7) { color = overlayColor(color, getTexData(uDataBufferArray[7], tpnt, uInterpolation)); }

    outColor = color * mask * (1. - uTransparency);
}
/*glsl*/`;
