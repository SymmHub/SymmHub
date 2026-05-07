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
uniform bool uUseCrown;


//
// Crown rendering for image arrays with color permutations.
// For each pairing transform g of the fundamental domain, maps the screen point
// into the adjacent copy, then blends all images cycling through permuted indices.
// permData[g] gives the color permutation for that reflected copy.
//
vec4 getColorArrayCrown(vec3 pnt, 
                        sampler2D groupData, 
                        int groupOffset, 
                        float scale, 
                        uvec4 permData[MAX_GEN_COUNT], 
                        uint permSize, 
                        uvec4 currentPerm, 
                        uint texIndex) { 

    vec4 color = vec4(0.0);

    int domainOffset     = fetchInt(groupData, groupOffset);
    int domainSize       = fetchInt(groupData, domainOffset);
    int transformsOffset = fetchInt(groupData, groupOffset + 1);

    for (int g = 0; g < domainSize; g++) {

        vec3  v  = pnt;
        float ss = scale;

        int transformOffset        = fetchInt(groupData, transformsOffset + g + 1);
        int refCount               = fetchInt(groupData, transformOffset);
        int transformSplanesOffset = transformOffset + 1;

        // Apply inverse pairing transform: maps crown cell back into FD.
        for (int r = 0; r < refCount; r++) {
            iSPlane rsp = fetchSplane(uGroupData, transformSplanesOffset + r * 2);
            iReflect(rsp, v, ss);
        }

        // Buffer coordinates for the transformed point.
        vec2 tc2   = cMul(uBufScale, v.xy - uBufCenter);
        vec2 tpnt2 = tc2 + vec2(0.5);
        float sdb2 = max(abs(tc2.x), abs(tc2.y)) - 0.5;
        float msk  = 1.0 - smoothstep(-0.001, 0.001, sdb2);
        if (msk <= 0.0) continue;
        uvec4 gperm = permData[g];
        // Blend all images using generator g's permutation row.
        uvec4 perm = compose_perms(currentPerm, gperm, permSize);
        uint imgIdx = get_perm_val(perm, texIndex);
        vec4 cellColor = texture(uImageArray, vec3(tpnt2, float(imgIdx)));        
        color = overlayColor(color, cellColor * msk);
    }

    return color;
}

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

    // Crown: accumulate neighbour-cell contributions.
    vec4 color = vec4(0.0);
    if(uUseCrown){
        // append images from neighbours
        color = getColorArrayCrown(wpnt, uGroupData, groupOffset, scale, uPermData, uPermSize, currentPerm, uTexPermIndex); 
    }

    // Main tile: single image selected via currentPerm + uTexPermIndex.
    uint imageIndex = get_perm_val(currentPerm, uTexPermIndex);
    vec4 layer = texture(uImageArray, vec3(tpnt, float(imageIndex)));
    color = overlayColor(color, layer * mask);

    outColor = color * (1. - uTransparency);
    //outColor = vec4(1.,0,0,1.)*mask;
}
`;

