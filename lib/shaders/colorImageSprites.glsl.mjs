//
//  Color Images of sprites: every item of a drawing in a buffer of its own
//  (lib/drawlib/Sprites.js), shown at its own place and in every copy.
//
//  For a pixel: fold it into the domain with its colour permutation (as
//  colorImageArray does), then map the folded point into every tile the
//  sprites are seen through (uTileData: the tiles' maps from the domain,
//  nearest first, with their permutations). A sprite contributes where one of
//  its tiles sends the point inside its box: the sprite is sampled there and
//  coloured by the cell colour of the tile's permuted slot. The contributions
//  overlay in sprite order, the copies of a sprite meeting at the pixel with
//  the copy whose centre (its box's) is nearest on top: two overlapping copies
//  cut each other along their bisector, whatever tiles their parts lie in (in
//  the order of the tiles they were cut along the tiles' sides, and the cuts
//  changed as the sprite moved across the tiling). With depth sort on they are
//  sorted by the tilt depth of their place - the domain's own tile like any
//  other - plus the
//  sprite's own depth (uSpriteDepth; the sort is on while any is set, with
//  a zero tilt when depth sort is off), plus the height of its picture
//  there (uSpriteHeightArray, the sprites' layout, times uSpriteHeightScale;
//  0: none, not sampled).
//

export const colorImageSprites =
/*glsl*/`
in vec2 vUv;

layout(location = 0) out vec4 outColor;

uniform float u_pixelSize;

uniform sampler2D uGroupData;
uniform int uIterations;
uniform bool uSymmetry;
uniform float uTransparency;

uniform uvec4 uPermData[MAX_PERM_COUNT];
uniform uint uPermSize;
uniform bool uUseOrbit;

uniform bool uFillCells;
uniform vec4 uCellColors[MAX_COLORS_COUNT];
uniform uint uCellColorPermIndex;
// 0 = none, 1 = multiply image by cell color, 2 = 1-(cellColor*(1-imgColor)), 3 = hue shift
uniform int uColoringType;
// alpha factor per colour (0.0 = hidden, 1.0 = visible), padded with 1s.
uniform float uTexAlpha[MAX_COLORS_COUNT];

// Tilt: unit direction vector [cos(angle), sin(angle)] for depth-sort compositing.
uniform vec2 uTiltVector;
uniform bool uUseTilt;
uniform bool uUseMipmap;

// the bounds of VisualizationColorSym's sprite path
#define MAX_SPRITES 32
#define MAX_TILES 64
// ivec4s of tile indices: 4 each
#define MAX_SPRITE_TILES 64
#define MAX_HITS 16

uniform highp sampler2DArray uSpriteArray;
uniform float uSpriteTexSize;
uniform int uSpriteCount;
// centre x, y, half size (world units), opacity
uniform vec4 uSpriteBox[MAX_SPRITES];
// added to the depth of every copy of the sprite (world units)
uniform float uSpriteDepth[MAX_SPRITES];
// the heights of the sprites' pictures (red, 0 to 1), the layers as uSpriteArray's
uniform highp sampler2DArray uSpriteHeightArray;
// how far a height of 1 moves the sprite's copies (world units), 0 without heights
uniform float uSpriteHeightScale[MAX_SPRITES];
// first tile index, tile count, slot (bits 0-7) with the cosets whose tiles
// show the sprite above it (bit 8 + k: coset k), layer of the texture array
uniform ivec4 uSpriteInfo[MAX_SPRITES];
// a permutation of the colour index after the tile's, per sprite: a sprite
// carried by a symmetry, coloured by orbits (identity otherwise)
uniform uvec4 uSpritePermData[MAX_SPRITES];
uniform ivec4 uTileIndex[MAX_SPRITE_TILES];
// the tiles' maps from the domain, packed as a group (DataPacking)
uniform sampler2D uTileData;
uniform int uTileCount;
uniform uvec4 uTilePermData[MAX_TILES];

// the first n contributions by depth, back-most first (insertion sort; of equal
// depths the earlier first, as the later is on top)
void sortHits(inout vec4 colorBuf[MAX_HITS], inout float zBuf[MAX_HITS], int n){
    for (int i = 1; i < MAX_HITS; i++) {
        if (i >= n) break;
        vec4  keyColor = colorBuf[i];
        float keyZ     = zBuf[i];
        int j = i - 1;
        for (int k = 0; k < MAX_HITS; k++) {
            if (j < 0 || zBuf[j] <= keyZ) break;
            colorBuf[j + 1] = colorBuf[j];
            zBuf[j + 1]     = zBuf[j];
            j--;
        }
        colorBuf[j + 1] = keyColor;
        zBuf[j + 1]     = keyZ;
    }
}

int tileIndexAt(int n){
    ivec4 v = uTileIndex[n >> 2];
    int k = n & 3;
    return (k == 0) ? v.x : ((k == 1) ? v.y : ((k == 2) ? v.z : v.w));
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

    // the folded point in every tile, with the scale and the permutation there
    vec3  tpos[MAX_TILES];
    float tscale[MAX_TILES];
    uvec4 tperm[MAX_TILES];
    int transformsOffset = fetchInt(uTileData, groupOffset + 1);
    int tileCount = min(min(fetchInt(uTileData, transformsOffset), uTileCount), MAX_TILES);
    for (int j = 0; j < MAX_TILES; j++) {
        if (j >= tileCount) break;
        vec3  v  = wpnt;
        float ss = scale;
        int transformOffset = fetchInt(uTileData, transformsOffset + j + 1);
        int refCount        = fetchInt(uTileData, transformOffset);
        int splanesOffset   = transformOffset + 1;
        for (int r = 0; r < refCount; r++) {
            iSPlane rsp = fetchSplane(uTileData, splanesOffset + r * 2);
            iReflect(rsp, v, ss);
        }
        tpos[j]   = v;
        tscale[j] = ss;
        if (uUseOrbit) {
            tperm[j] = compose_perms(uTilePermData[j], currentPerm, uPermSize);
        } else {
            tperm[j] = compose_perms(currentPerm, uTilePermData[j], uPermSize);
        }
    }

    vec4 color = vec4(0.0);
    if(uFillCells) {
        color = uCellColors[get_perm_val(currentPerm, uCellColorPermIndex)];
    }

    // the contributions waiting to be overlaid, by depth (sortHits)
    vec4  colorBuf[MAX_HITS];
    float zBuf[MAX_HITS];
    int hits = 0;

    for (int i = 0; i < MAX_SPRITES; i++) {
        if (i >= uSpriteCount) break;
        vec4  box  = uSpriteBox[i];
        ivec4 info = uSpriteInfo[i];
        for (int k = 0; k < MAX_TILES; k++) {
            if (k >= info.y) break;
            int j = tileIndexAt(info.x + k);
            vec2 d = (tpos[j].xy - box.xy) / box.z;
            if (max(abs(d.x), abs(d.y)) > 1.0) continue;
            vec2 tc = d * 0.5 + 0.5;
            vec4 c;
            if (uUseMipmap) {
                // texels per screen pixel at this copy
                float lod = log2(uSpriteTexSize * u_pixelSize * tscale[j] / (2.0 * box.z));
                c = (lod > 0.0) ? textureLod(uSpriteArray, vec3(tc, float(info.w)), lod)
                                : texture(uSpriteArray, vec3(tc, float(info.w)));
            } else {
                c = texture(uSpriteArray, vec3(tc, float(info.w)));
            }
            uint ci = get_perm_val(uSpritePermData[i], get_perm_val(tperm[j], uint(info.z & 255)));
            // seen in the tiles of the cosets its layer is listed for alone
            if (((info.z >> (8 + int(ci))) & 1) == 0) continue;
            c *= uTexAlpha[ci] * box.w;
            c = applyColoring(c, uCellColors[ci], uColoringType);
            if (c.a <= 0.0) continue;
            float z;
            if (uUseTilt) {
                z = dot(uTiltVector, tpos[j].xy) + uSpriteDepth[i];
                if (uSpriteHeightScale[i] > 0.0) {
                    z += uSpriteHeightScale[i] * textureLod(uSpriteHeightArray, vec3(tc, float(info.w)), 0.0).r;
                }
            } else {
                // the copy whose centre is nearest the pixel on top: the point of
                // the sprite seen here is that far from its centre
                vec2 dc = tpos[j].xy - box.xy;
                z = -dot(dc, dc);
            }
            if (hits < MAX_HITS) {
                colorBuf[hits] = c;
                zBuf[hits]     = z;
                hits++;
                continue;
            }
            // full: the back-most hit goes under the rest unsorted, never one
            // in front; of equal depths the earliest, as the later is on top
            int back = 0;
            for (int b = 1; b < MAX_HITS; b++) {
                if (zBuf[b] < zBuf[back]) back = b;
            }
            if (z < zBuf[back]) {
                color = overlayColor(color, c);
                continue;
            }
            color = overlayColor(color, colorBuf[back]);
            for (int b = back; b < MAX_HITS - 1; b++) {
                colorBuf[b] = colorBuf[b + 1];
                zBuf[b]     = zBuf[b + 1];
            }
            colorBuf[MAX_HITS - 1] = c;
            zBuf[MAX_HITS - 1]     = z;
        }
        // without depth sort the sprites overlay in their order, each with its
        // copies sorted
        if (!uUseTilt) {
            sortHits(colorBuf, zBuf, hits);
            for (int h = 0; h < MAX_HITS; h++) {
                if (h >= hits) break;
                color = overlayColor(color, colorBuf[h]);
            }
            hits = 0;
        }
    }

    if (uUseTilt) {
        sortHits(colorBuf, zBuf, hits);
        for (int i = 0; i < MAX_HITS; i++) {
            if (i >= hits) break;
            color = overlayColor(color, colorBuf[i]);
        }
    }

    outColor = color * (1. - uTransparency);
}
`;
