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
// 0 = none, 1 = multiply image by cell color, 2 = 1-(cellColor*(1-imgColor))
uniform int uColoringType;

// Tilt: unit direction vector [cos(angle), sin(angle)] for depth-sort compositing.
uniform vec2 uTiltVector;
// When true, crown tiles are sorted by z = dot(uTiltVector, tc) before compositing.
uniform bool uUseTilt;
uniform bool uUseMipmap;

#ifndef MAX_CROWN_COUNT
#define MAX_CROWN_COUNT 20
#endif
uniform sampler2D uCrownData;
uniform uvec4 uCrownPermData[MAX_CROWN_COUNT];
// alpha factor per texture layer (0.0 = hidden, 1.0 = visible), padded with 1s.
uniform float uTexAlpha[MAX_COLORS_COUNT];

vec4 getImageComponentData(vec2 wpnt, highp sampler2DArray imageArray, vec2 imgScale,  vec2 imgCenter, uint componentIndex, float blurRadius, bool useMipmap, float scale){
    // Map world point into texture coordinates.
    vec2 tc = cMul(imgScale, (wpnt - imgCenter));
    // coordinates in [0,1] to feed to texture 
    vec2 tpnt = tc + vec2(0.5, 0.5); 
    tc = abs(tc);
    // signed distance to texture box, negative inside, zero at edge, positive outside 
    float sdb = max(tc.x, tc.y) - 0.5;
    // edge mask
    float mask = 1. - smoothstep(-blurRadius, blurRadius, sdb);
    if (useMipmap) {
        float texSize = float(textureSize(imageArray, 0).x);
        float lod = log2(texSize * u_pixelSize * scale * length(imgScale));
        if (lod > 0.0) {
            return textureLod(imageArray, vec3(tpnt, float(componentIndex)), lod) * mask;
        }
    }
    return textureLod(imageArray, vec3(tpnt, float(componentIndex)), 0.0) * mask;
}

//
// Applies the selected image-coloring mode (premultiplied alpha).
//   coloringType 0: no change
//   coloringType 1: multiply — white pixels become cellColor, black stays black
//   coloringType 2: screen blend — black pixels become cellColor, white stays white
//
//
vec4 applyColoring(vec4 imgColor, vec4 cellColor, int coloringType) {
    if(coloringType == 1) {
        // premult multiply: imgColor.xyz *= cell.xyz
        imgColor.xyz *= cellColor.xyz;
    } else if(coloringType == 2) {
        // premult screen blend: a*cell + imgColor.xyz*(1-cell)  (a = imgColor.w)
        imgColor.xyz = cellColor.xyz * imgColor.w + imgColor.xyz * (1.0 - cellColor.xyz);
    }
    return imgColor;
}

//
// Crown rendering — simple variant.
// For each crown tile maps the point into the adjacent FD copy,
// selects the permuted image, applies coloring, and overlays directly.
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
                        float blurWidth,
                        int coloringType,
                        vec4 cellColors[MAX_COLORS_COUNT],
                        bool useMipmap) {

    vec4 color = vec4(0.0);
    int transformsOffset = fetchInt(groupData, groupOffset + 1);
    int transformsCount  = fetchInt(groupData, transformsOffset);
    int loopCount = min(transformsCount, MAX_CROWN_COUNT);

    for (int g = 0; g < loopCount; g++) {
        vec3  v  = pnt;
        float ss = scale;

        int transformOffset        = fetchInt(groupData, transformsOffset + g + 1);
        int refCount               = fetchInt(groupData, transformOffset);
        int transformSplanesOffset = transformOffset + 1;

        for (int r = 0; r < refCount; r++) {
            iSPlane rsp = fetchSplane(groupData, transformSplanesOffset + r * 2);
            iReflect(rsp, v, ss);
        }
        uvec4 gperm = permData[g];
        uvec4 perm;
        if(leftCoset) {
            perm = compose_perms(gperm, currentPerm, permSize);
        } else {
            perm = compose_perms(currentPerm, gperm, permSize);
        }

        uint imgIdx = get_perm_val(perm, texIndex);
        if(texAlpha[imgIdx] > 0.0) {
            vec4 imgColor = texAlpha[imgIdx]*getImageComponentData(v.xy, imageArray, imgScale, imgCenter, imgIdx, blurWidth, useMipmap, ss);
            imgColor = applyColoring(imgColor, cellColors[imgIdx], coloringType);
            color = overlayColor(color, imgColor);
        }
    }

    return color;
}

//
// Crown rendering — depth-sorted variant.
// Collects visible crown contributions, insertion-sorts them by
//   z = dot(tiltVector, cMul(imgScale, v.xy - imgCenter))
// then composites back-to-front with overlayColor().
//
vec4 getImageArrayCrownSorted(vec3 pnt, 
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
                              float blurWidth,
                              int coloringType,
                              vec4 cellColors[MAX_COLORS_COUNT],
                              vec2 tiltVector,
                              bool useMipmap) {

    int transformsOffset = fetchInt(groupData, groupOffset + 1);
    int transformsCount  = fetchInt(groupData, transformsOffset);
    int loopCount = min(transformsCount, MAX_CROWN_COUNT);

    // Fixed-size accumulation buffers.
    vec4  colorBuf[MAX_CROWN_COUNT];
    float zBuf[MAX_CROWN_COUNT];
    int   count = 0;

    // Collect phase.
    for (int g = 0; g < loopCount; g++) {
        vec3  v  = pnt;
        float ss = scale;

        int transformOffset        = fetchInt(groupData, transformsOffset + g + 1);
        int refCount               = fetchInt(groupData, transformOffset);
        int transformSplanesOffset = transformOffset + 1;

        for (int r = 0; r < refCount; r++) {
            iSPlane rsp = fetchSplane(groupData, transformSplanesOffset + r * 2);
            iReflect(rsp, v, ss);
        }
        uvec4 gperm = permData[g];
        uvec4 perm;
        if(leftCoset) {
            perm = compose_perms(gperm, currentPerm, permSize);
        } else {
            perm = compose_perms(currentPerm, gperm, permSize);
        }

        uint imgIdx = get_perm_val(perm, texIndex);
        if(texAlpha[imgIdx] > 0.0) {
            vec4 imgColor = texAlpha[imgIdx]*getImageComponentData(v.xy, imageArray, imgScale, imgCenter, imgIdx, blurWidth, useMipmap, ss);
            imgColor = applyColoring(imgColor, cellColors[imgIdx], coloringType);
            if(imgColor.w > 0.0 && count < MAX_CROWN_COUNT) {
                vec2  tc = cMul(imgScale, v.xy - imgCenter);
                colorBuf[count] = imgColor;
                zBuf[count]     = dot(tiltVector, tc);
                count++;
            }
        }
    }

    // Insertion sort by z (ascending = back-most first).
    for (int i = 1; i < MAX_CROWN_COUNT; i++) {
        if (i >= count) break;
        vec4  keyColor = colorBuf[i];
        float keyZ     = zBuf[i];
        int j = i - 1;
        for (int k = 0; k < MAX_CROWN_COUNT; k++) {
            if (j < 0 || zBuf[j] <= keyZ) break;
            colorBuf[j + 1] = colorBuf[j];
            zBuf[j + 1]     = zBuf[j];
            j--;
        }
        colorBuf[j + 1] = keyColor;
        zBuf[j + 1]     = keyZ;
    }

    // Composite in z-order (back to front).
    vec4 color = vec4(0.0);
    for (int i = 0; i < MAX_CROWN_COUNT; i++) {
        if (i >= count) break;
        color = overlayColor(color, colorBuf[i]);
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
        vec4 crownColor;
        if(uUseTilt) {
            crownColor = getImageArrayCrownSorted(wpnt, uImageArray, uTexAlpha, uBufScale, uBufCenter, uCrownData, groupOffset, scale, uCrownPermData, uPermSize, currentPerm, uLeftCoset, uTexPermIndex, blurWidth, uColoringType, uCellColors, uTiltVector, uUseMipmap);
        } else {
            crownColor = getImageArrayCrown(wpnt, uImageArray, uTexAlpha, uBufScale, uBufCenter, uCrownData, groupOffset, scale, uCrownPermData, uPermSize, currentPerm, uLeftCoset, uTexPermIndex, blurWidth, uColoringType, uCellColors, uUseMipmap);
        }
        color = overlayColor(color, crownColor);
    } else {
        // Main tile: single image selected via currentPerm + uTexPermIndex.
        uint imageIndex = get_perm_val(currentPerm, uTexPermIndex);

        if(uTexAlpha[imageIndex] > 0.0) {
            vec4 layer = uTexAlpha[imageIndex]*getImageComponentData(wpnt.xy, uImageArray, uBufScale, uBufCenter, imageIndex, blurWidth, uUseMipmap, scale);
            vec4 cellColor = uCellColors[get_perm_val(currentPerm, uCellColorPermIndex)];
            layer = applyColoring(layer, cellColor, uColoringType);
            color = overlayColor(color, layer);
        }
    }
    outColor = color * (1. - uTransparency);
    //outColor = vec4(1.,0,0,1.)*mask;
    
}
`;

