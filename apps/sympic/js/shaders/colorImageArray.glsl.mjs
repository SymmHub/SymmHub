export const colorImageArray = 
/*glsl*/`
in vec2 vUv;

layout(location = 0) out vec4 outColor;

uniform float u_pixelSize;

uniform highp sampler2DArray uImageArray;
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

// 
uniform bool uFillCells;
uniform vec4 uCellColors[MAX_COLORS_COUNT];
uniform uint uCellColorPermIndex;
uniform uint uTexPermIndex;
uniform bool uUseCrown;
uniform bool uLeftCoset;

#ifndef MAX_CROWN_COUNT
#define MAX_CROWN_COUNT 20
#endif
uniform sampler2D uCrownData;
uniform uvec4 uCrownPermData[MAX_CROWN_COUNT];
// alpha factor per texture layer (0.0 = hidden, 1.0 = visible), padded with 1s.
uniform float uTexAlpha[MAX_COLORS_COUNT];

vec4 getImageComponentData(vec2 wpnt, highp sampler2DArray imageArray, vec2 imgScale,  vec2 imgCenter, uint componentIndex, float blurRadius){
    // Map world point into texture coordinates.
    vec2 tc = cMul(imgScale, (wpnt - imgCenter));
    // coordinates in [0,1] to feed to texture 
    vec2 tpnt = tc + vec2(0.5, 0.5); 
    tc = abs(tc);
    // signed distance to texture box, negative inside, zero at edge, positive outside 
    float sdb = max(tc.x, tc.y) - 0.5;
    // edge mask
    float mask = 1. - smoothstep(-blurRadius, blurRadius, sdb);
    return texture(imageArray, vec3(tpnt, float(componentIndex))) * mask;
}

//
//
// Crown rendering for image arrays with color permutations.
// For each pairing transform g of the fundamental domain, maps the screen point
// into the adjacent copy, then blends all images cycling through permuted indices.
// permData[g] gives the color permutation which needs to be pre-composed with currentPerm for that reflected copy.
//
vec4 getImageArrayCrown(vec3 pnt, 
                        highp sampler2DArray imageArray,
                        float texAlpha[MAX_COLORS_COUNT],
                        vec2 imgScale, 
                        vec2 imgCenter,     
                        sampler2D groupData, 
                        int groupOffset, 
                        float scale, 
                        uvec4 permData[MAX_CROWN_COUNT], 
                        uint permSize, 
                        uvec4 currentPerm, 
                        bool leftCoset,
                        uint texIndex, 
                        float blurWidth) { 

    vec4 color = vec4(0.0);

    int domainOffset     = fetchInt(groupData, groupOffset);
    int transformsOffset = fetchInt(groupData, groupOffset + 1);
    int transformsCount  = fetchInt(groupData, transformsOffset);

    int loopCount = min(transformsCount, MAX_CROWN_COUNT);

    for (int g = 0; g < loopCount; g++) {

        vec3  v  = pnt;
        float ss = scale;

        int transformOffset        = fetchInt(groupData, transformsOffset + g + 1);
        int refCount               = fetchInt(groupData, transformOffset);
        int transformSplanesOffset = transformOffset + 1;

        // Apply inverse pairing transform: maps crown cell back into FD.
        for (int r = 0; r < refCount; r++) {
            iSPlane rsp = fetchSplane(groupData, transformSplanesOffset + r * 2);
            iReflect(rsp, v, ss);
        }
        uvec4 gperm = permData[g];
        // Blend all images using generator g's permutation row.
        uvec4 perm;
        if(leftCoset) {
            perm = compose_perms(gperm, currentPerm, permSize);
            //perm = compose_perms(currentPerm, gperm, permSize);
        } else {
            perm = compose_perms(currentPerm, gperm, permSize);
            //perm = compose_perms(gperm, currentPerm, permSize);
        }

        uint imgIdx = get_perm_val(perm, texIndex);
        if(texAlpha[imgIdx] > 0.0) {
            vec4 cellColor = texAlpha[imgIdx]*getImageComponentData(v.xy, imageArray, imgScale, imgCenter, imgIdx, blurWidth);      
            color = overlayColor(color, cellColor);
        }
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
        iToFundamentalDomainSamplerPerm24(wpnt, uGroupData, groupOffset, uPermData, uPermSize, currentPerm, uLeftCoset, inDomain, refcount, scale, uIterations);

    }
    if(uSymmetry && inDomain == 0) {
        outColor = vec4(0,0,0,0);
        return;
    }


    vec4 color = vec4(0.0);
    if(uFillCells) {
        color = uCellColors[get_perm_val(currentPerm, uCellColorPermIndex)];
    }
    float blurWidth = u_pixelSize * 0.5;
    if(uUseCrown){
        // Crown: accumulate neighbour-cell contributions.
        // append images from neighbours
        vec4 crownColor = getImageArrayCrown(wpnt, uImageArray, uTexAlpha, uBufScale, uBufCenter, uCrownData, groupOffset, scale, uCrownPermData, uPermSize, currentPerm, uLeftCoset, uTexPermIndex, blurWidth); 
        color = overlayColor(color, crownColor);
    } else {
        // Main tile: single image selected via currentPerm + uTexPermIndex.
        uint imageIndex = get_perm_val(currentPerm, uTexPermIndex);

        if(uTexAlpha[imageIndex] > 0.0) {
            vec4 layer = uTexAlpha[imageIndex]*getImageComponentData(wpnt.xy, uImageArray, uBufScale, uBufCenter, imageIndex, blurWidth);
            color = overlayColor(color, layer);
        }
    }
    outColor = color * (1. - uTransparency);
    //outColor = vec4(1.,0,0,1.)*mask;
    
}
`;

