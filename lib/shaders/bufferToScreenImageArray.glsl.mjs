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

vec4 getTexArrayData(sampler2D samplers[MAX_IMAGES], int index, vec2 tpnt, int interpolation){
    
    switch(index){
        case 0: return getTexData(samplers[0], tpnt, interpolation);
        case 1: return getTexData(samplers[1], tpnt, interpolation);
        case 2: return getTexData(samplers[2], tpnt, interpolation);
        case 3: return getTexData(samplers[3], tpnt, interpolation);
        case 4: return getTexData(samplers[4], tpnt, interpolation);
        case 5: return getTexData(samplers[5], tpnt, interpolation);
        case 6: return getTexData(samplers[6], tpnt, interpolation);
        case 7: return getTexData(samplers[7], tpnt, interpolation);
        default: return getTexData(samplers[0], tpnt, interpolation);
    }    
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

    // Map world point into sampler coordinates.
    vec2 tc = cMul(uBufScale, (wpnt.xy - uBufCenter));
    vec2 tpnt = tc + vec2(0.5, 0.5);
    tc = abs(tc);
    float sdb = max(tc.x, tc.y) - 0.5;
    float blurWidth = u_pixelSize * 0.5;
    float mask = 1. - smoothstep(-blurWidth, blurWidth, sdb);

    vec4 color = vec4(0.0);
    for(int i = 0; i < uNumImages; i++) {
        color = overlayColor(color, getTexArrayData(uDataBufferArray, i, tpnt, uInterpolation));
    }
    outColor = color * mask * (1. - uTransparency);
}
`;
