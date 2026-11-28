// WebGL2 shaders for Color Transitions Lab.
// Supports 18 transition modes across Color/Blend, Dots/Procedural,
// Geometric/Symmetry Wipes, and Tile-Aware Fundamental-Domain transitions.

export const VERTEX_SHADER_SRC = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2( 3.0, -1.0),
  vec2(-1.0,  3.0)
);
out vec2 vUv;
void main() {
  vec2 p = POS[gl_VertexID];
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER_SRC = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform sampler2D uTileData;   // R: bfsDist, G: tileRand, B: localDist (0=edge,1=center), A: tileAngle
uniform sampler2D uTileMeta;   // R: centroidX, G: centroidY, B: colorClassOrder, A: changedFlag (1=changed,0=same)

uniform int   uMode;
uniform float uT;              // Eased progress [0..1]
uniform float uRawT;           // Linear progress [0..1]
uniform float uSoftness;       // Edge softness [0.002..0.45]
uniform float uScale;          // Density / grid scale
uniform float uSymmetry;       // Fold count n (1..12)
uniform float uAngle;          // Angle in radians
uniform vec2  uOrigin;         // Focus / seed UV [0..1]
uniform int   uColorSpace;     // 0=sRGB, 1=OKLab, 2=OKLCH shortest, 3=OKLCH spin
uniform int   uDiffOnly;       // 0=off, 1=preserve unchanged pixels/tiles
uniform float uEdgeGlow;       // Frontier glow intensity [0..1]
uniform vec3  uEdgeColor;      // Frontier accent color
uniform int   uReverse;        // 0=normal, 1=reversed
uniform float uHasTiling;      // 1.0 if tiling map available
uniform float uDiskRadius;     // Detected Poincaré disk radius in UV (default 0.47)
uniform vec2  uResolution;

const float PI  = 3.14159265359;
const float TAU = 6.28318530718;

// ---------------------------------------------------------------------------
// Color space conversions: sRGB <-> Linear <-> OKLab <-> OKLCH
// ---------------------------------------------------------------------------
vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 linearToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 linearToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  float l_ = pow(max(l, 0.0), 1.0 / 3.0);
  float m_ = pow(max(m, 0.0), 1.0 / 3.0);
  float s_ = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  );
}

vec3 oklabToLinear(vec3 lab) {
  float l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;
  return vec3(
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 mixColors(vec3 a, vec3 b, float t, int space, float hueTwist) {
  t = clamp(t, 0.0, 1.0);
  if (space == 0) {
    return mix(a, b, t);
  }
  vec3 labA = linearToOklab(srgbToLinear(a));
  vec3 labB = linearToOklab(srgbToLinear(b));
  if (space == 1) {
    vec3 lab = mix(labA, labB, t);
    return clamp(linearToSrgb(oklabToLinear(lab)), 0.0, 1.0);
  }
  // OKLCH interpolation (2 = shortest arc, 3 = forced wheel spin)
  float cA = length(labA.yz);
  float cB = length(labB.yz);
  float hA = atan(labA.z, labA.y);
  float hB = atan(labB.z, labB.y);

  // If either endpoint is near-achromatic, fall back smoothly to OKLab
  float chromaGate = smoothstep(0.005, 0.025, min(cA, cB));
  float dh = hB - hA;
  if (dh >  PI) dh -= TAU;
  if (dh < -PI) dh += TAU;

  if (space == 3) {
    // Force consistent directional hue spin (great for visualizing color permutations)
    float dir = (hueTwist >= 0.0) ? 1.0 : -1.0;
    if (abs(dh) < 0.05) {
      dh = dir * TAU * 0.5;
    } else if (dir > 0.0 && dh < 0.0) {
      dh += TAU;
    } else if (dir < 0.0 && dh > 0.0) {
      dh -= TAU;
    }
  }

  float h = hA + dh * t;
  float L = mix(labA.x, labB.x, t);
  float C = mix(cA, cB, t);
  vec3 lchLab = vec3(L, C * cos(h), C * sin(h));
  vec3 linLab = mix(labA, labB, t);
  vec3 finalLab = mix(linLab, lchLab, chromaGate);
  return clamp(linearToSrgb(oklabToLinear(finalLab)), 0.0, 1.0);
}

// ---------------------------------------------------------------------------
// Hashing & Procedural Noise
// ---------------------------------------------------------------------------
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * valueNoise(p);
    p = rot * p * 2.03 + vec2(17.1, 31.7);
    a *= 0.5;
  }
  return v;
}

// ---------------------------------------------------------------------------
// Unified Threshold Helper: exact 0 at t=0, exact 1 at t=1 for any m in [0,1]
// ---------------------------------------------------------------------------
float thresholdMask(float m, float t, float w) {
  float mc = clamp(m, 0.0, 1.0);
  if (uReverse == 1) mc = 1.0 - mc;
  float ww = max(w, 0.0015);
  float tAdj = t * (1.0 + 2.0 * ww) - ww;
  return smoothstep(mc - ww, mc + ww, tAdj);
}

// ---------------------------------------------------------------------------
// Hexagonal lattice helper: returns (distToCenter, cellId)
// ---------------------------------------------------------------------------
vec3 hexCoords(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hC.xy * s, p - (hC.zw + 0.5) * s);
  bool useA = dot(h.xy, h.xy) < dot(h.zw, h.zw);
  vec2 local = useA ? h.xy : h.zw;
  vec2 id    = useA ? hC.xy : hC.zw + 0.5;
  return vec3(length(local), id);
}

// ---------------------------------------------------------------------------
// Densifying Blue-Noise Stipple Dots (R2 low-discrepancy rank on jittered grid)
// ---------------------------------------------------------------------------
float densifyingDotsAlpha(vec2 uv, float t, float scale, float softness) {
  if (t <= 0.0001) return 0.0;
  if (t >= 0.9999) return 1.0;

  vec2 p = uv * scale;
  vec2 ip = floor(p);
  float pxW = max(scale / max(min(uResolution.x, uResolution.y), 1.0), 0.015);
  float aa = max(pxW * 1.4, softness * 0.55);

  float coverage = 0.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 cell = ip + vec2(float(dx), float(dy));
      // Jittered dot center inside cell for organic Poisson-like spacing
      vec2 j = (hash22(cell) - 0.5) * 0.64;
      vec2 center = cell + 0.5 + j;
      float d = length(p - center);

      // R2 golden-ratio quasirandom sequence: evenly distributed birth times
      float rank = fract(0.7548776662 * cell.x + 0.5698402910 * cell.y + 0.13 * hash21(cell));
      if (uReverse == 1) rank = 1.0 - rank;

      // Dots appear progressively up to t=0.72, then expand to guarantee 100% fill
      float birth = rank * 0.68;
      float localAge = clamp((t - birth) / 0.16, 0.0, 1.0);
      float baseRadius = 0.30 * smoothstep(0.0, 1.0, localAge);
      float mergeBoost = 1.18 * smoothstep(0.45, 1.0, t);
      float radius = baseRadius + mergeBoost * step(0.001, localAge);
      // Ensure every cell merges smoothly by t=1 even for highest rank
      radius = max(radius, 1.45 * smoothstep(0.76, 1.0, t));

      float dotAlpha = 1.0 - smoothstep(radius - aa, radius + aa, d);
      coverage = max(coverage, dotAlpha);
    }
  }
  return clamp(coverage, 0.0, 1.0);
}

// ---------------------------------------------------------------------------
// Voronoi Cellular Growth: returns (cellMask, edgeDist)
// ---------------------------------------------------------------------------
vec2 voronoiField(vec2 p, float jitter) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float md1 = 8.0;
  float md2 = 8.0;
  vec2 bestId = vec2(0.0);

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g) * jitter + (1.0 - jitter) * 0.5;
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md1) {
        md2 = md1;
        md1 = d;
        bestId = n + g;
      } else if (d < md2) {
        md2 = d;
      }
    }
  }
  float d1 = sqrt(md1);
  float d2 = sqrt(md2);
  float cellRand = hash21(bestId);
  // Combine cell birth time + crystal growth from seed outward
  float val = clamp(cellRand * 0.58 + d1 * 0.42, 0.0, 1.0);
  float border = d2 - d1;
  return vec2(val, border);
}

const vec3 STAGE_BG = vec3(0.04, 0.05, 0.07);

vec3 samplePremul(sampler2D tex, vec2 uv) {
  vec4 p = texture(tex, uv);
  return p.rgb + STAGE_BG * (1.0 - p.a);
}

void main() {
  // Flip V so UV (0,0) is top-left matching canvas & tile analyzer coordinates
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 pCentered = (uv - uOrigin) * aspect;

  vec4 rawA = texture(uTexA, uv);
  vec4 rawB = texture(uTexB, uv);
  vec3 colA = rawA.rgb + STAGE_BG * (1.0 - rawA.a);
  vec3 colB = rawB.rgb + STAGE_BG * (1.0 - rawB.a);
  float shapeMask = max(rawA.a, rawB.a);

  vec4 tileData = texture(uTileData, uv);
  vec4 tileMeta = texture(uTileMeta, uv);

  float t = clamp(uT, 0.0, 1.0);
  float alpha = t;
  float customFrontier = 0.0;
  float shadeMod = 1.0;
  int activeSpace = uColorSpace;
  float hueTwist = (uReverse == 1) ? -1.0 : 1.0;

  // -------------------------------------------------------------------------
  // Transition Modes
  // -------------------------------------------------------------------------
  if (uMode == 0) {
    // 0: Linear / Perceptual Cross-Fade
    alpha = t;

  } else if (uMode == 1) {
    // 1: OKLCH Hue-Wheel Morph (spins around color wheel for permutations)
    alpha = t;
    activeSpace = 3;

  } else if (uMode == 2) {
    // 2: A/B Double-Take Pulse (A -> B -> peek A -> B)
    float s = uRawT;
    if (s <= 0.001) alpha = 0.0;
    else if (s >= 0.999) alpha = 1.0;
    else {
      // Smooth envelope: rises to 1 at 0.30, dips to 0.08 at 0.55, rises to 1 at 0.85
      float p1 = smoothstep(0.02, 0.28, s);
      float dip = 0.92 * exp(-pow((s - 0.54) / 0.11, 2.0));
      alpha = clamp(p1 - dip * smoothstep(0.25, 0.42, s) * (1.0 - smoothstep(0.68, 0.88, s)), 0.0, 1.0);
    }

  } else if (uMode == 3) {
    // 3: Densifying Dots (Blue-Noise Stipple)
    alpha = densifyingDotsAlpha(uv * aspect, t, uScale, uSoftness);

  } else if (uMode == 4) {
    // 4: Growing Hex Halftone Lattice (uniform growth across plane)
    vec3 hx = hexCoords(uv * aspect * uScale);
    // Max distance in unit hex is 1/sqrt(3) = 0.5774
    float m = clamp(hx.x / 0.585, 0.0, 1.0);
    alpha = thresholdMask(m, t, uSoftness * 0.45);

  } else if (uMode == 5) {
    // 5: Swept Halftone Wave (directional wave of growing hex dots)
    vec3 hx = hexCoords(uv * aspect * uScale);
    vec2 dir = vec2(cos(uAngle), sin(uAngle));
    float sweep = clamp(dot(uv - 0.5, dir) * 0.72 + 0.5, 0.0, 1.0);
    float dotR = clamp(hx.x / 0.585, 0.0, 1.0);
    float m = clamp(sweep * 0.68 + dotR * 0.32, 0.0, 1.0);
    alpha = thresholdMask(m, t, uSoftness * 0.25);

  } else if (uMode == 6) {
    // 6: Watercolor / Ink-Soak Blobs (multi-octave FBM noise)
    float n1 = fbm(uv * aspect * (uScale * 0.18));
    float n2 = fbm(uv * aspect * (uScale * 0.36) + vec2(4.2, -3.1));
    float rad = clamp(length(pCentered) * 0.72, 0.0, 1.0);
    float m = clamp(n1 * 0.65 + n2 * 0.20 + rad * 0.22 - 0.03, 0.0, 1.0);
    alpha = thresholdMask(m, t, uSoftness * 0.35);

  } else if (uMode == 7) {
    // 7: Voronoi Cellular Crystal Growth
    vec2 vf = voronoiField(uv * aspect * (uScale * 0.35), 0.85);
    float m = vf.x;
    alpha = thresholdMask(m, t, uSoftness * 0.22);
    // Highlight crystal borders near active transition zone
    float activeZone = 4.0 * alpha * (1.0 - alpha);
    customFrontier = max(customFrontier, activeZone * (1.0 - smoothstep(0.0, 0.08, vf.y)));

  } else if (uMode == 8) {
    // 8: n-Fold Pinwheel / Windmill Wipe
    float n = max(1.0, floor(uSymmetry + 0.5));
    float ang = atan(pCentered.y, pCentered.x) - uAngle;
    float sector = fract((ang / TAU) * n);
    alpha = thresholdMask(sector, t, uSoftness * 0.28);

  } else if (uMode == 9) {
    // 9: n-Petal Flower / Radial Iris
    float n = max(1.0, floor(uSymmetry + 0.5));
    float r = length(pCentered);
    float maxR = max(
      max(length((vec2(0.0, 0.0) - uOrigin) * aspect), length((vec2(1.0, 0.0) - uOrigin) * aspect)),
      max(length((vec2(0.0, 1.0) - uOrigin) * aspect), length((vec2(1.0, 1.0) - uOrigin) * aspect))
    );
    float ang = atan(pCentered.y, pCentered.x) - uAngle;
    float petal = (n > 1.5) ? (0.14 * cos(n * ang)) : 0.0;
    float m = clamp((r / max(maxR, 0.001) + petal + 0.14) / 1.28, 0.0, 1.0);
    alpha = thresholdMask(m, t, uSoftness * 0.35);

  } else if (uMode == 10) {
    // 10: Straight Curtain Wipe (Talk Comparison Split)
    vec2 dir = vec2(cos(uAngle), sin(uAngle));
    float proj = dot(uv - 0.5, dir);
    float extent = abs(dir.x) * 0.5 + abs(dir.y) * 0.5;
    float m = clamp((proj / max(extent, 0.001)) * 0.5 + 0.5, 0.0, 1.0);
    alpha = thresholdMask(m, t, uSoftness * 0.12);

  } else if (uMode == 11) {
    // 11: Hyperbolic Geodesic Sweep (exact Poincaré disk orthogonal circular arc!)
    vec2 diskP = (uv - 0.5) / max(uDiskRadius, 0.15);
    float c = cos(-uAngle);
    float s = sin(-uAngle);
    vec2 rp = vec2(c * diskP.x - s * diskP.y, s * diskP.x + c * diskP.y);
    // Exact Poincaré pencil of geodesics orthogonal to the unit disk boundary:
    // Level sets of u / (1 + u^2 + v^2) are exact circular arcs orthogonal to |z|=1.
    float denom = 1.0 + dot(rp, rp);
    float geo = 0.5 + rp.x / denom;
    // Slightly widen sweep for corners outside the unit disk
    float outside = smoothstep(1.0, 1.45, length(rp));
    float lin = clamp(rp.x * 0.35 + 0.5, 0.0, 1.0);
    float m = clamp(mix(geo, lin, outside * 0.65), 0.0, 1.0);
    alpha = thresholdMask(m, t, uSoftness * 0.20);

  } else if (uMode == 12) {
    // 12: Magic Loupe Lens (glides across showing B inside, then expands to full frame)
    if (t <= 0.001) {
      alpha = 0.0;
    } else if (t >= 0.999) {
      alpha = 1.0;
    } else {
      // Phase 1 (0..0.18): lens grows at left/start
      // Phase 2 (0.18..0.72): lens sweeps smoothly across pattern through uOrigin
      // Phase 3 (0.72..1.0): lens expands to cover entire canvas
      vec2 dir = vec2(cos(uAngle), sin(uAngle));
      float sweepP = smoothstep(0.14, 0.74, t);
      float expandP = smoothstep(0.70, 1.0, t);
      vec2 startPos = mix(vec2(0.5) - dir * 0.28, uOrigin, 0.25);
      vec2 endPos   = mix(vec2(0.5) + dir * 0.28, uOrigin, 0.25);
      vec2 center = mix(startPos, endPos, sweepP);
      center = mix(center, vec2(0.5), expandP);
      float baseR = 0.24 * smoothstep(0.0, 0.18, t);
      float radius = baseR + 1.15 * expandP * expandP;
      float dist = length((uv - center) * aspect);
      float aa = max(0.004, uSoftness * 0.08);
      alpha = 1.0 - smoothstep(radius - aa, radius + aa, dist);
      // Crisp optical ring along lens rim while loupe is active
      float ring = exp(-pow((dist - radius) / 0.0055, 2.0)) * (1.0 - expandP) * smoothstep(0.0, 0.08, t);
      customFrontier = ring;
    }

  } else if (uMode == 13) {
    // 13: Motif Luminance / Contour Bleed
    float lumA = dot(colA, vec3(0.299, 0.587, 0.114));
    float lumB = dot(colB, vec3(0.299, 0.587, 0.114));
    // Local edge energy from Image A
    vec2 px = 1.5 / max(uResolution, vec2(1.0));
    float lx = length(samplePremul(uTexA, uv + vec2(px.x, 0.0)) - samplePremul(uTexA, uv - vec2(px.x, 0.0)));
    float ly = length(samplePremul(uTexA, uv + vec2(0.0, px.y)) - samplePremul(uTexA, uv - vec2(0.0, px.y)));
    float edge = clamp(length(vec2(lx, ly)) * 1.4, 0.0, 1.0);
    float m = clamp(0.62 * lumA + 0.23 * lumB + 0.15 * (1.0 - edge), 0.0, 1.0);
    alpha = thresholdMask(m, t, uSoftness * 0.40);

  } else if (uMode == 14) {
    // 14: Tile BFS Wave (Exact Fundamental-Domain Word-Length Cascade)
    float m = (uHasTiling > 0.5)
      ? tileData.r
      : clamp(length(pCentered) * 1.1, 0.0, 1.0);
    alpha = thresholdMask(m, t, uSoftness * 0.28);

  } else if (uMode == 15) {
    // 15: Tile Shuffled Mosaic (Each fundamental domain transitions as a unit)
    float m = (uHasTiling > 0.5)
      ? tileData.g
      : hash21(floor(uv * uScale));
    alpha = thresholdMask(m, t, uSoftness * 0.24);

  } else if (uMode == 16) {
    // 16: Tile 3D Card Flip (Each fundamental domain flips around its centroid)
    float order = (uHasTiling > 0.5)
      ? mix(tileData.r, tileData.g, 0.35)
      : hash21(floor(uv * uScale));
    if (uReverse == 1) order = 1.0 - order;

    float changed = (uHasTiling > 0.5) ? tileMeta.a : 1.0;
    bool skipTile = (uDiffOnly == 1) && (changed < 0.35);

    if (skipTile || uHasTiling < 0.5) {
      alpha = skipTile ? t : thresholdMask(order, t, uSoftness * 0.22);
    } else {
      float span = max(0.18, uSoftness * 0.9);
      float tAdj = t * (1.0 + span) - order;
      float localT = clamp(tAdj / span, 0.0, 1.0);

      // Rotate UV around this tile's centroid along axis uAngle
      vec2 cent = tileMeta.rg;
      vec2 rel = uv - cent;
      float ca = cos(uAngle);
      float sa = sin(uAngle);
      vec2 axis = vec2(ca, sa);
      vec2 perp = vec2(-sa, ca);
      float along = dot(rel, axis);
      float across = dot(rel, perp);

      float cosFlip = cos(localT * PI);
      float scaleFlip = max(abs(cosFlip), 0.06);
      vec2 sampleUv = cent + axis * (along / scaleFlip) + perp * across;

      // Check whether stretched lookup stays inside the same tile (by centroid match)
      vec2 sampleCent = texture(uTileMeta, clamp(sampleUv, 0.0, 1.0)).rg;
      bool inTile = length(sampleCent - cent) < 0.012;

      if (localT <= 0.001) {
        alpha = 0.0;
      } else if (localT >= 0.999) {
        alpha = 1.0;
      } else {
        if (inTile) {
          colA = samplePremul(uTexA, sampleUv);
          colB = samplePremul(uTexB, sampleUv);
          alpha = (localT < 0.5) ? 0.0 : 1.0;
          // Subtle lighting curve as tile turns edge-on
          shadeMod = 0.62 + 0.38 * abs(cosFlip);
        } else {
          // Reveal the underlying opposite coloring behind the flipping card
          alpha = (localT < 0.5) ? 1.0 : 0.0;
          shadeMod = 0.78 + 0.22 * abs(cosFlip);
        }
      }
    }

  } else if (uMode == 17) {
    // 17: Per-Tile Local Bloom (Simultaneous reveal inside EVERY fundamental domain)
    // tileData.b: 0 = mirror wall, 1 = tile interior center.
    // Default (reverse=0): blooms from tile center outward to mirror walls!
    float localM = (uHasTiling > 0.5)
      ? (1.0 - tileData.b)
      : clamp(hexCoords(uv * aspect * uScale).x / 0.585, 0.0, 1.0);
    alpha = thresholdMask(localM, t, uSoftness * 0.30);

  } else if (uMode == 18) {
    // 18: Coset / Color-Class-by-Color-Class Reveal
    float m = (uHasTiling > 0.5)
      ? tileMeta.b
      : clamp(dot(colB, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    // Add tiny per-tile micro-stagger so boundaries read crisply
    float micro = (uHasTiling > 0.5) ? (tileData.r * 0.06) : 0.0;
    alpha = thresholdMask(clamp(m * 0.94 + micro, 0.0, 1.0), t, uSoftness * 0.25);
  }

  // -------------------------------------------------------------------------
  // Diff-Only Preservation (keep unchanged tiles & black motif ink crisp!)
  // -------------------------------------------------------------------------
  float pixelDiff = length(colA - colB);
  float diffMask = 1.0;
  if (uDiffOnly == 1) {
    float tileChanged = (uHasTiling > 0.5) ? smoothstep(0.25, 0.75, tileMeta.a) : 1.0;
    float pixChanged  = smoothstep(0.03, 0.12, pixelDiff);
    // Keep unchanged regions rock-solid while letting changed tiles animate
    diffMask = max(pixChanged, tileChanged * smoothstep(0.015, 0.06, pixelDiff));
    // Also suppress frontier glow on unchanged areas
    alpha = alpha * diffMask + t * (1.0 - diffMask);
  }

  vec3 blended = mixColors(colA, colB, alpha, activeSpace, hueTwist) * shadeMod;

  // Optional Frontier Accent / Glow along moving boundary
  float frontier = max(4.0 * alpha * (1.0 - alpha), customFrontier);
  if (uDiffOnly == 1) {
    frontier *= diffMask;
  }
  // Suppress global frontier glow on pure uniform cross-fades (modes 0, 1, 2)
  if (uMode <= 2) {
    frontier = 0.0;
  }
  float glowAmt = pow(clamp(frontier, 0.0, 1.0), 1.6) * uEdgeGlow * smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.96, 1.0, t));
  if (uMode == 12) {
    // Keep loupe rim visible even with uEdgeGlow=0 (subtle), boosted by uEdgeGlow
    glowAmt = max(glowAmt, customFrontier * (0.45 + 0.55 * uEdgeGlow));
  }
  glowAmt *= shapeMask;
  blended = mix(blended, uEdgeColor, clamp(glowAmt, 0.0, 0.92));

  fragColor = vec4(blended, 1.0);
}
`;
