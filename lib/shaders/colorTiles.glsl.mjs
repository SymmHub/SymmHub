export const colorTiles =
/*glsl*/`
in vec2 vUv;

layout(location = 0) out vec4 outColor;

uniform float u_pixelSize;
uniform sampler2D uGroupData;
uniform int uIterations;
uniform bool uSymmetry;
uniform float uTransparency;

// permutation data
uniform uvec4 uPermData[MAX_PERM_COUNT];
uniform uint uPermSize;

// cell fill
uniform bool uFillCells;
uniform vec4 uCellColors[MAX_COLORS_COUNT];
uniform uint uCellColorPermIndex;
uniform bool uUseOrbit;

void main() {

    int groupOffset = 0;
    int inDomain = 0;
    int refcount = 0;

    vec2 screenWorldP = vUv;
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

    vec2 projWorldP = pp;
    float projScale = scale;
    float clipLine = 0.0;
    float clipMask = evalWorldClip(screenWorldP, projWorldP, u_pixelSize * 1.15, u_pixelSize * projScale * 1.15, clipLine);
    if (clipMask <= 0.001 && clipLine <= 0.001) {
        outColor = vec4(0.0);
        return;
    }

    vec3 wpnt = vec3(pp, 0.);
    // the fold starts from the view anchor's permutation (inversiveSampler: applyAnchor)
    uvec4 currentPerm = (uSymmetry && uAnchorEnabled) ? uAnchorPerm : perm_identity(uPermSize);

    if(uSymmetry){
        applyAnchor(wpnt, scale);
        iToFundamentalDomainSamplerPerm24(wpnt, uGroupData, groupOffset, uPermData, uPermSize, currentPerm, uUseOrbit, inDomain, refcount, scale, uIterations);
    }
    if(uSymmetry && inDomain == 0) {
        outColor = vec4(0,0,0,0);
        return;
    }

    vec4 color = vec4(0.0);
    if(uFillCells) {
        if (uMixEnabled) {
            vec3 mixP = (uMixSpace == 0) ? vec3(screenWorldP, 0.0)
                      : ((uMixSpace == 1) ? vec3(projWorldP, 0.0) : wpnt);
            float aaMix = (uMixSpace == 0) ? (u_pixelSize * 1.15)
                        : ((uMixSpace == 1) ? (u_pixelSize * projScale * 1.15) : (u_pixelSize * scale * 1.15));
            float mixLine = 0.0;
            float m = evalPlacementMix(mixP, aaMix, mixLine);
            if (m <= 0.001) {
                color = uCellColors[get_perm_val(currentPerm, uCellColorPermIndex)];
            } else if (m >= 0.999) {
                color = uCellColors[get_perm_val(currentPerm, uMixPlacement2)];
            } else {
                vec4 c1 = uCellColors[get_perm_val(currentPerm, uCellColorPermIndex)];
                vec4 c2 = uCellColors[get_perm_val(currentPerm, uMixPlacement2)];
                color = mix(c1, c2, m);
            }
            color = applyCutLine(color, mixLine);
        } else {
            color = uCellColors[get_perm_val(currentPerm, uCellColorPermIndex)];
        }
    }
    color *= clipMask;
    color = applyCutLine(color, clipLine);
    outColor = color * (1. - uTransparency);
}
`;
