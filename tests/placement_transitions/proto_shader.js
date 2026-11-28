import { ShaderFragments as SF } from '../../lib/shaders/modules.js';

export const MAX_CROWN_COUNT = 28;
export const MAX_COLORS = 24;

export const VERTEX_SRC = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2( 3.0, -1.0),
  vec2(-1.0,  3.0)
);
out vec2 vNdc;
void main() {
  vec2 p = POS[gl_VertexID];
  vNdc = p;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

export const FRAGMENT_SRC = `#version 300 es
precision highp float;

#define MAX_CROWN_COUNT ${MAX_CROWN_COUNT}

in vec2 vNdc;
out vec4 fragColor;

${SF.isplane}
${SF.inversiveSampler}
${SF.permutations24}

// Camera / world mapping
uniform vec2  uViewCenter;
uniform float uViewScale;     // world units per half-height
uniform vec2  uResolution;
uniform int   uIterations;

// Geometry indicator (mask exterior of Poincare disk if hyperbolic)
uniform bool  uIsHyperbolic;
uniform vec2  uDiskCenter;
uniform float uDiskRadius;

// Group & Layer A color permutations
uniform sampler2D uGroupData;
uniform uvec4 uPermDataA[MAX_PERM_COUNT];
uniform uint  uPermSizeA;
uniform bool  uUseOrbitA;
uniform uint  uPlacement1;
uniform uint  uPlacement2;

// Layer B color permutations (for 2-layer Curtain Split: e.g. cosets vs orbits or subgroup A vs B)
uniform bool  uDualLayer;
uniform uvec4 uPermDataB[MAX_PERM_COUNT];
uniform uint  uPermSizeB;
uniform bool  uUseOrbitB;
uniform uint  uPlacementB;

// Crown transforms for moving/overlapping motifs
uniform sampler2D uCrownData;
uniform uvec4 uCrownPermDataA[MAX_CROWN_COUNT];
uniform uvec4 uCrownPermDataB[MAX_CROWN_COUNT];
uniform int   uCrownCount;

// Palette & appearance
uniform vec4  uPalette[MAX_COLORS_COUNT];
uniform vec3  uBgColor;
uniform bool  uShowTiles;
uniform float uTileOpacity;
uniform bool  uShowGrid;
uniform float uGridOpacity;
uniform bool  uShowMotif;
uniform int   uMotifType;     // 0=circle, 1=ring, 2=star, 3=comma, 4=arrow
uniform vec2  uMotifCenter;   // world center (FD-space in S1/Curtain; moving gamma(t) in S2)
uniform float uMotifRadius;   // world radius at current pose
uniform float uMotifAngle;    // motif local rotation (radians)
uniform int   uMotifColorMode;// 0=colored motif on neutral/tinted bg, 1=dark ink motif on colored tiles

// Transition mode:
//   0 = World Curtain Split (single layer p1|p2 or dual layer A|B)
//   1 = Solution 1: Domain SPlane Mix (FD space)
//   2 = Solution 1: Shape-Local SPlane Mix (motif local space)
//   3 = Solution 2: Continuous Shape Trajectory (crown motion)
//   4 = Hybrid: Solution 1 Tiles + Solution 2 Shapes
uniform int   uMode;

// SPlane control for Curtain Split & Solution 1
uniform int   uMixSplaneType; // 0=identity(all outside), 1=sphere, 2=plane
uniform vec4  uMixSplaneData; // sphere:(cx,cy,0,r), plane:(nx,ny,0,dist)
uniform float uMixBlur;       // world/local softness (0 = crisp pixel AA)
uniform bool  uMixInvert;     // flip inside/outside
uniform bool  uShowCutLine;   // subtle hairline along splane boundary
uniform vec3  uCutLineColor;

// ---------------------------------------------------------------------------
// Procedural Motif SDFs in normalized local motif coordinates q (unit radius = 1)
// Returns (signedDist, accentMask) where signedDist < 0 is inside motif.
// ---------------------------------------------------------------------------
vec2 evalMotifSDF(vec2 q, int kind) {
  if (kind == 0) {
    // Crisp colored disk with subtle specular ring
    float d = length(q) - 0.88;
    float rim = smoothstep(0.68, 0.84, length(q)) * (1.0 - smoothstep(0.84, 0.90, length(q)));
    return vec2(d, rim * 0.22);
  }
  if (kind == 1) {
    // Thick concentric ring / donut (reveals overlaps beautifully)
    float r = length(q);
    float d = abs(r - 0.62) - 0.25;
    return vec2(d, 0.0);
  }
  if (kind == 2) {
    // 5-pointed mirror-symmetric star (symmetric across x-axis)
    float a = atan(q.y, q.x);
    float r = length(q);
    float starR = 0.62 + 0.28 * cos(5.0 * a);
    return vec2(r - starR, 0.0);
  }
  if (kind == 3) {
    // Asymmetric catalog-style comma / paisley (clearly reveals chirality & rotation)
    // Head circle at (-0.18, 0.22), curved tail sweeping to (+0.38, -0.35)
    float dHead = length(q - vec2(-0.18, 0.20)) - 0.36;
    // Crescent tail: difference of two circles
    float cOuter = length(q - vec2(-0.08, -0.10)) - 0.62;
    float cInner = length(q - vec2(-0.34, -0.26)) - 0.44;
    float dTail = max(cOuter, -cInner);
    // Clip tail to lower-right sector
    float cutPlane = dot(q - vec2(-0.18, 0.20), normalize(vec2(-0.65, 0.75))) - 0.16;
    dTail = max(dTail, cutPlane);
    // Smooth union of head and tail
    float k = 0.12;
    float h = clamp(0.5 + 0.5 * (dTail - dHead) / k, 0.0, 1.0);
    float d = mix(dTail, dHead, h) - k * h * (1.0 - h);
    return vec2(d, 0.0);
  }
  // kind == 4: Crisp asymmetric kite / pointer arrow (maximal rotation & chirality legibility)
  // Points along +X with an off-center notch on +Y side
  vec2 p = q;
  float body = max(abs(p.y) - (0.58 - 0.62 * p.x), -p.x - 0.55);
  body = max(body, p.x - 0.88);
  // Asymmetric fin notch on bottom-left
  float notch = length(p - vec2(-0.22, -0.42)) - 0.28;
  float d = max(body, -notch);
  return vec2(d, 0.0);
}

// Compute signed distance to active mix iSPlane at point p3
float evalMixDist(vec3 p3) {
  iSPlane sp = iGeneralSplane(uMixSplaneData, uMixSplaneType);
  float d = iDistance(sp, p3);
  return uMixInvert ? -d : d;
}

// Returns mix factor m in [0, 1]: 0 = outside (placement 1 / Layer A at t=0),
// 1 = inside the sweeping/growing splane (placement 2 / Layer B at t=1).
float evalMixFactor(float d, float aaPx) {
  float w = max(uMixBlur, aaPx);
  return 1.0 - smoothstep(-w, w, d);
}

// Evaluate one layer's folded color + crown motif at world point pp.
// When useMix == true, blends placement1 (inside) and placement2 (outside) according to uMode.
vec4 renderLayer(
  vec2 pp,
  float pixelWorld,
  uvec4 permData[MAX_PERM_COUNT],
  uint permSize,
  bool useOrbit,
  uint place1,
  uint place2,
  uvec4 crownPerms[MAX_CROWN_COUNT],
  bool useMix,
  int mixMode
) {
  vec3 wpnt = vec3(pp, 0.0);
  float scale = 1.0;
  int inDomain = 0;
  int refcount = 0;
  uvec4 currentPerm = perm_identity(permSize);

  iToFundamentalDomainSamplerPerm24(
    wpnt, uGroupData, 0,
    permData, permSize, currentPerm, useOrbit,
    inDomain, refcount, scale, uIterations
  );
  if (inDomain == 0) {
    return vec4(uBgColor, 1.0);
  }

  float aaDomain = pixelWorld * scale * 1.15;
  vec3 col = uBgColor;

  // 1. Background Color Tiles (if enabled)
  if (uShowTiles) {
    uint ci1 = (permSize > 0u) ? get_perm_val(currentPerm, place1) : 0u;
    vec3 tileCol = uPalette[ci1].rgb;
    if (useMix && (mixMode == 1 || mixMode == 4)) {
      float dDom = evalMixDist(wpnt);
      float mDom = evalMixFactor(dDom, aaDomain);
      if (mDom > 0.001) {
        uint ci2 = (permSize > 0u) ? get_perm_val(currentPerm, place2) : 0u;
        tileCol = mix(tileCol, uPalette[ci2].rgb, mDom);
      }
      if (uShowCutLine && uMixSplaneType != SPLANE_IDENTITY) {
        float lineM = 1.0 - smoothstep(0.0, aaDomain * 1.6, abs(dDom));
        tileCol = mix(tileCol, uCutLineColor, lineM * 0.72);
      }
    }
    col = mix(uBgColor, tileCol, uTileOpacity);
  }

  // 2. Fundamental-Domain Tiling Grid Lines
  if (uShowGrid) {
    float fdDist = abs(iGetFundDomainDistanceSampler(wpnt, uGroupData, 0));
    float gridLine = 1.0 - smoothstep(0.0, aaDomain * 1.35, fdDist);
    vec3 gridCol = uShowTiles ? vec3(0.08, 0.07, 0.06) : vec3(0.32, 0.37, 0.48);
    col = mix(col, gridCol, gridLine * uGridOpacity);
  }

  // 3. Foreground Crown Motif / Shapes (colored by tile placement, bisected by nearest center)
  if (uShowMotif && uCrownCount > 0) {
    int transformsOffset = fetchInt(uCrownData, 1);
    int transformsCount  = fetchInt(uCrownData, transformsOffset);
    int loopCount = min(min(transformsCount, uCrownCount), MAX_CROWN_COUNT);

    float cAng = cos(-uMotifAngle);
    float sAng = sin(-uMotifAngle);
    mat2 invRot = mat2(cAng, -sAng, sAng, cAng);

    // Track nearest-center overlapping hits (like colorImageSprites) so moving circles bisect cleanly
    const int MAX_HITS = 8;
    vec4  hitCol[MAX_HITS];
    float hitZ[MAX_HITS];
    int   hitCount = 0;

    for (int g = 0; g < MAX_CROWN_COUNT; g++) {
      if (g >= loopCount) break;
      vec3  v  = wpnt;
      float ss = scale;

      int transformOffset = fetchInt(uCrownData, transformsOffset + g + 1);
      int rCount          = fetchInt(uCrownData, transformOffset);
      int spOffset        = transformOffset + 1;
      for (int r = 0; r < rCount; r++) {
        iSPlane rsp = fetchSplane(uCrownData, spOffset + r * 2);
        iReflect(rsp, v, ss);
      }

      vec2 rel = v.xy - uMotifCenter;
      vec2 localP = invRot * (rel / max(uMotifRadius, 1e-5));
      if (dot(localP, localP) > 1.35) continue;

      vec2 sdfRes = evalMotifSDF(localP, uMotifType);
      float aaLocal = (pixelWorld * ss / max(uMotifRadius, 1e-5)) * 1.25;
      float shapeAlpha = 1.0 - smoothstep(-aaLocal, aaLocal, sdfRes.x);
      if (shapeAlpha <= 0.002) continue;

      // Subtle dark outline around colored motif for crisp contrast
      float strokeBand = (1.0 - smoothstep(0.0, aaLocal * 2.2 + 0.045, abs(sdfRes.x))) * shapeAlpha;

      uvec4 gperm = crownPerms[g];
      uvec4 perm = useOrbit
        ? compose_perms(gperm, currentPerm, permSize)
        : compose_perms(currentPerm, gperm, permSize);

      uint ci1 = (permSize > 0u) ? get_perm_val(perm, place1) : 0u;
      vec3 fillCol = (uMotifColorMode == 0) ? uPalette[ci1].rgb : vec3(0.06, 0.05, 0.05);

      if (useMix && (mixMode == 1 || mixMode == 2) && uMotifColorMode == 0) {
        float dMix = (mixMode == 1)
          ? evalMixDist(v)                        // Domain SPlane in FD/crown coordinates
          : evalMixDist(vec3(localP, 0.0));       // Shape-local SPlane inside each motif!
        float aaMix = (mixMode == 1) ? (pixelWorld * ss * 1.15) : aaLocal;
        float mMix = evalMixFactor(dMix, aaMix);
        if (mMix > 0.001) {
          uint ci2 = (permSize > 0u) ? get_perm_val(perm, place2) : 0u;
          fillCol = mix(fillCol, uPalette[ci2].rgb, mMix);
        }
        if (uShowCutLine && uMixSplaneType != SPLANE_IDENTITY) {
          float cutM = 1.0 - smoothstep(0.0, aaMix * 1.7, abs(dMix));
          fillCol = mix(fillCol, uCutLineColor, cutM * 0.85);
        }
      }

      if (uMotifColorMode == 0) {
        fillCol = mix(fillCol, vec3(1.0), sdfRes.y);
        fillCol = mix(fillCol, vec3(0.06, 0.06, 0.07), strokeBand * 0.58);
      }

      // Depth by negative squared distance to copy center -> clean Voronoi bisector on overlaps
      float z = -dot(localP, localP);
      if (hitCount < MAX_HITS) {
        hitCol[hitCount] = vec4(fillCol, shapeAlpha);
        hitZ[hitCount]   = z;
        hitCount++;
      } else {
        int worst = 0;
        for (int b = 1; b < MAX_HITS; b++) {
          if (hitZ[b] < hitZ[worst]) worst = b;
        }
        if (z > hitZ[worst]) {
          hitCol[worst] = vec4(fillCol, shapeAlpha);
          hitZ[worst]   = z;
        }
      }
    }

    // Insertion sort back-to-front by hitZ
    for (int i = 1; i < MAX_HITS; i++) {
      if (i >= hitCount) break;
      vec4 kc = hitCol[i];
      float kz = hitZ[i];
      int j = i - 1;
      for (int k = 0; k < MAX_HITS; k++) {
        if (j < 0 || hitZ[j] <= kz) break;
        hitCol[j + 1] = hitCol[j];
        hitZ[j + 1]   = hitZ[j];
        j--;
      }
      hitCol[j + 1] = kc;
      hitZ[j + 1]   = kz;
    }

    for (int i = 0; i < MAX_HITS; i++) {
      if (i >= hitCount) break;
      col = mix(col, hitCol[i].rgb, hitCol[i].a);
    }
  }

  return vec4(col, 1.0);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 pp = uViewCenter + vec2(vNdc.x * aspect, vNdc.y) * uViewScale;
  float pixelWorld = (2.0 * uViewScale) / max(uResolution.y, 1.0);

  // Clean outer mask for hyperbolic Poincare disk
  float diskAlpha = 1.0;
  if (uIsHyperbolic) {
    float dr = length(pp - uDiskCenter) - uDiskRadius;
    diskAlpha = 1.0 - smoothstep(-pixelWorld * 1.5, pixelWorld * 1.5, dr);
    if (diskAlpha <= 0.001) {
      fragColor = vec4(uBgColor, 1.0);
      return;
    }
  }

  vec3 outCol;
  if (uMode == 0) {
    // Mode 0: World Curtain Split (either Placement 1 vs 2 OR Dual Layer A vs Layer B)
    float dWorld = evalMixDist(vec3(pp, 0.0));
    float mWorld = evalMixFactor(dWorld, pixelWorld * 1.15);

    vec4 colA = vec4(0.0);
    vec4 colB = vec4(0.0);
    if (mWorld < 0.999) {
      colA = renderLayer(pp, pixelWorld, uPermDataA, uPermSizeA, uUseOrbitA, uPlacement1, uPlacement1, uCrownPermDataA, false, 0);
    }
    if (mWorld > 0.001) {
      if (uDualLayer) {
        colB = renderLayer(pp, pixelWorld, uPermDataB, uPermSizeB, uUseOrbitB, uPlacementB, uPlacementB, uCrownPermDataB, false, 0);
      } else {
        colB = renderLayer(pp, pixelWorld, uPermDataA, uPermSizeA, uUseOrbitA, uPlacement2, uPlacement2, uCrownPermDataA, false, 0);
      }
    }
    outCol = mix(colA.rgb, colB.rgb, mWorld);

    if (uShowCutLine && uMixSplaneType != SPLANE_IDENTITY) {
      float lineM = 1.0 - smoothstep(0.0, pixelWorld * 2.2, abs(dWorld));
      outCol = mix(outCol, uCutLineColor, lineM * 0.90);
    }
  } else {
    bool useMix = (uMode == 1 || uMode == 2 || uMode == 4);
    vec4 c = renderLayer(pp, pixelWorld, uPermDataA, uPermSizeA, uUseOrbitA, uPlacement1, uPlacement2, uCrownPermDataA, useMix, uMode);
    outCol = c.rgb;
  }

  if (uIsHyperbolic) {
    float dr = abs(length(pp - uDiskCenter) - uDiskRadius);
    float rim = 1.0 - smoothstep(0.0, pixelWorld * 2.0, dr);
    outCol = mix(uBgColor, outCol, diskAlpha);
    outCol = mix(outCol, vec3(0.32, 0.36, 0.45), rim * 0.65);
  }

  fragColor = vec4(outCol, 1.0);
}
`;
