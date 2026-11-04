export const bufferToScreenImageArray =
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

// the crown (VisualizationImage, 2026-11-04, as the Color Images layer has it):
// the images are seen through the tiles around the pattern box, the transforms
// of uCrownData mapping the domain onto the tiles, farthest first, each over
// the ones before; with the depth sort the tiles are ordered by their depth
// along uTiltVector instead
uniform bool uUseCrown;
uniform sampler2D uCrownData;
uniform bool uUseTilt;
uniform vec2 uTiltVector;
// the mipmaps of the image array (the layer generates them), the level by the
// size of a pixel in the image
uniform bool uUseMipmap;

#ifndef MAX_CROWN_COUNT
#define MAX_CROWN_COUNT 20
#endif

//
//  the images composited at a world point (Porter-Duff "over", premultiplied),
//  masked by the pattern box
//
vec4 getImagesColor(vec2 wpnt, float scale, float blurWidth){

    // the world point in the sampler's coordinates
    vec2 tc = cMul(uBufScale, (wpnt - uBufCenter));
    vec2 tpnt = tc + vec2(0.5, 0.5);
    tc = abs(tc);
    float sdb = max(tc.x, tc.y) - 0.5;
    float mask = 1. - smoothstep(-blurWidth, blurWidth, sdb);
    if(mask <= 0.) return vec4(0.0);

    float lod = 0.;
    if(uUseMipmap){
        float texSize = float(textureSize(uImageArray, 0).x);
        lod = max(0., log2(texSize * u_pixelSize * scale * length(uBufScale)));
    }
    vec4 color = vec4(0.0);
    for (int i = 0; i < uNumImages; i++) {
        vec4 layer = textureLod(uImageArray, vec3(tpnt, float(i)), lod);
        color = overlayColor(color, layer);
    }
    return color * mask;
}

//
//  the images seen through the crown tiles: the point of the domain is mapped
//  into each tile and the images sampled there
//
vec4 getCrownColor(vec3 pnt, float scale, float blurWidth){

    int transformsOffset = fetchInt(uCrownData, 1);
    int transformsCount  = fetchInt(uCrownData, transformsOffset);
    int loopCount = min(transformsCount, MAX_CROWN_COUNT);

    vec4  colorBuf[MAX_CROWN_COUNT];
    float zBuf[MAX_CROWN_COUNT];
    int   count = 0;
    vec4 color = vec4(0.0);

    for (int g = 0; g < loopCount; g++) {
        vec3  v  = pnt;
        float ss = scale;
        int transformOffset = fetchInt(uCrownData, transformsOffset + g + 1);
        int refCount        = fetchInt(uCrownData, transformOffset);
        for (int r = 0; r < refCount; r++) {
            iSPlane rsp = fetchSplane(uCrownData, transformOffset + 1 + r * 2);
            iReflect(rsp, v, ss);
        }
        vec4 c = getImagesColor(v.xy, ss, blurWidth);
        if(!uUseTilt){
            color = overlayColor(color, c);
        } else if(c.w > 0.0 && count < MAX_CROWN_COUNT){
            colorBuf[count] = c;
            zBuf[count]     = dot(uTiltVector, cMul(uBufScale, v.xy - uBufCenter));
            count++;
        }
    }
    if(!uUseTilt) return color;

    // the depth sort: insertion sort by depth, the smallest (the back) first
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

    if(uSymmetry){
        iToFundamentalDomainSampler(wpnt, uGroupData, groupOffset, inDomain, refcount, scale, uIterations);
    }
    if(uSymmetry && inDomain == 0) {
        outColor = vec4(0,0,0,0);
        return;
    }

    float blurWidth = u_pixelSize * 0.5;
    vec4 color = uUseCrown ? getCrownColor(wpnt, scale, blurWidth) : getImagesColor(wpnt.xy, scale, blurWidth);

    outColor = color * (1. - uTransparency);
}
`;
