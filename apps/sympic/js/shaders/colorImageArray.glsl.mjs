export const colorImageArray = 
/*glsl*/`
in vec2 vUv;

layout(location = 0) out vec4 outColor;

uniform float u_pixelSize;

uniform lowp sampler2DArray uImageArray;
uniform int uNumImages;

uniform vec2 uBufCenter;
uniform vec2 uBufScale;
uniform int uDataSource;

uniform sampler2D uGroupData;
uniform int uIterations;
uniform bool uSymmetry;
uniform int uInterpolation;
uniform float uTransparency;

// array of permutations, 
// each permutation may have up to 24 integer elements (0-23) 
// each of 4 components of uvec4 are packing 6 integers each (0-23)
// 5 bits are enough for each integer (2^5 = 32 > 24)
// 6 * 5 = 30 bits are packed into each uvec4 component
// 
uniform uvec4 uPermData[MAX_GEN_COUNT];
// size of permutation,  
uniform uint uPermSize;

uniform uint uTexPermIndex;

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
    uvec4 currentPerm = perm_identity(uPermSize);

    if(uSymmetry){
        iToFundamentalDomainSamplerPerm24(wpnt, uGroupData, groupOffset, uPermData, uPermSize, currentPerm, inDomain, refcount, scale, uIterations);
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

    // Composite layers using "over" blending (premultiplied).
    vec4 color = vec4(0.0);
    uint imageIndex = get_perm_val(currentPerm, uTexPermIndex);
    vec4 layer = texture(uImageArray, vec3(tpnt, float(imageIndex)));
    color = overlayColor(color, layer);
    

    outColor = color * mask * (1. - uTransparency);
    //outColor = vec4(1.,0,0,1.)*mask;
}
`;
