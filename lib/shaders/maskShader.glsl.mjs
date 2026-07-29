/**
 * maskShader.glsl.mjs
 *
 * Fragment shader for MaskWorker.
 *
 * uMaskType:
 *   0 = rectangle  — inside rect unchanged, outside → uMaskValue
 *   1 = circle     — inside circle unchanged, outside → uMaskValue
 *   2 = truchet    — folds neighbouring tiles via iSPlane reflections
 */

export const maskShader =
/*glsl*/`
in  vec2  vUv;
out vec4  outColor;

uniform sampler2D uSource;

uniform int   uMaskType;   // see defines below

// uMaskType values
#define MASK_RECTANGLE 0
#define MASK_CIRCLE    1
#define MASK_TRUCHET   2
#define MASK_HEXAGON   3
#define MASK_TRIANGLE  4

// shared params — all in world space [-1, 1]
uniform vec2  uCenter;     // mask centre
uniform vec2  uMaskValue;  // RG value written outside the mask (rect / circle)

// rectangle
uniform vec2  uExtents;    // half-width, half-height  (also used as tile half-size for truchet)

// circle
uniform float uRadius;

// truchet: transition blend-zone thickness
uniform float uTransition;
// truchet: fold type  0='2222'  1='O'  2='*2222'
uniform int   uFoldType;
// truchet: transition interpolation (see defines below)
uniform int   uTransType;
// truchet: averaging type (see defines below)
uniform int   uAvgType;
// truchet: domain shape (see defines below)
uniform int   uTruchetDomain;

// uTransType values
#define LINEAR        0
#define SMOOTH        1
#define BOX           2
#define SMOOTH_LINEAR 3

// uAvgType values
#define AVG_N  0   // C4 rotation average (4 samples)
#define AVG_SN 1   // C4v: C4 + x-reflection (8 samples)

// uTruchetDomain values
#define TRUCHET_SQUARE   0
#define TRUCHET_HEXAGON  1
#define TRUCHET_TRIANGLE 2

// Mathematical / geometric constants
#define PI    3.14159265358979
#define TWOPI 6.28318530717959   // 2 * PI
#define COS30 0.866025404        // cos(30°) = sin(60°) = √3/2
#define SIN30 0.5                // sin(30°) = cos(60°) = 1/2
#define TAN30 0.577350269        // tan(30°) = 1/√3
#define SQRT3 1.7320508075688772935274463415059 // √3 
// ── helpers ───────────────────────────────────────────────────────────────────

vec2 totex(vec2 wld) {
    return 0.5 * wld + vec2(0.5, 0.5);
}

float dist1(vec2 p, vec2 q) {
    vec2 d = abs(p - q);
    return max(d.x, d.y);
}

// Signed Chebyshev distance to an axis-aligned square.
// Returns < 0 when pnt is inside the square, 0 on its boundary, > 0 outside.
float squareDist(vec2 pnt, vec2 center, float size) {
    vec2 d = abs(pnt - center);
    return max(d.x, d.y) - size;
}

// Signed distance to a regular flat-top hexagon with given circumradius (vertex distance).
// Returns < 0 inside, 0 on boundary, > 0 outside.
float hexDist(vec2 pnt, vec2 center, float size) {
    float r = size * COS30;  // inradius = circumradius * cos(30°) = R * √3/2
    const vec3 k = vec3(-COS30, SIN30, TAN30);
    vec2 p = abs(pnt - center);
    p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
    p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
    return length(p) * sign(p.y);
}

// Signed distance to a right-pointing equilateral triangle (circumradius = size).
// Vertices at angles 0°, 120°, 240° from centre → first vertex at (center.x + size, center.y).
// Returns < 0 inside, 0 on boundary, > 0 outside.
float triDist(vec2 pnt, vec2 center, float size) {
    vec2 p = pnt - center;
    // For equilateral triangle with circumradius R: inradius r = R/2 = R * SIN30.
    float r = size * SIN30;
    // Edge normals at 180°, 60°, -60° from +x (pointing outward).
    // Left edge  (normal -x):              d0 = -p.x - r
    // Lower-right edge (normal at  60°):  d1 =  cos60 * p.x + sin60 * p.y - r
    // Upper-right edge (normal at -60°):  d2 =  cos60 * p.x - sin60 * p.y - r
    float d0 = -p.x - r;
    float d1 =  SIN30 * p.x + COS30 * p.y - r;  // cos60 = SIN30, sin60 = COS30
    float d2 =  SIN30 * p.x - COS30 * p.y - r;
    return max(max(d0, d1), d2);
}

vec2 reflect2(iSPlane s, vec2 p) {
    float scale = 1.0;
    vec3 p3 = vec3(p, 0.0);
    iReflect(s, p3, scale);
    return p3.xy;
}

// Returns the signed distance from a 2D point to an iSPlane.
float iDistance2(iSPlane s, vec2 p) {
    vec3 p3 = vec3(p, 0.0);
    return iDistance(s, p3);
}

// ── mask functions ────────────────────────────────────────────────────────────

vec2 maskRectangle(vec2 wld) {
    vec2 src = texture(uSource, totex(wld)).rg;
    vec2 d    = abs(wld - uCenter);
    bool inside = (d.x <= uExtents.x) && (d.y <= uExtents.y);
    return inside ? src : uMaskValue;
}

vec2 maskCircle(vec2 wld) {
    vec2 src = texture(uSource, totex(wld)).rg;
    vec2 d    = wld - uCenter;
    bool inside = dot(d, d) <= uRadius * uRadius;
    return inside ? src : uMaskValue;
}


// Folds a world-space point into the central Truchet tile — '2222' / p2 variant.
// Uses two iSPlane reflections per neighbour tile (creates 180° rotation symmetry).
// Returns true on success, false if p lies outside all tiles.
bool truchetFoldSquare2222(inout vec2 p, float bs) {
    float bs2 = 2.0 * bs;

    if (squareDist(p, vec2(bs2, 0.0), bs) < 0.0) {
        p = reflect2(iPlane(vec4(1.0, 0.0, 0.0, bs)),  p);
        p = reflect2(iPlane(vec4(0.0, 1.0, 0.0, 0.0)), p);

    } else if (squareDist(p, vec2(-bs2, 0.0), bs) < 0.0) {
        p = reflect2(iPlane(vec4(-1.0, 0.0, 0.0, bs)), p);
        p = reflect2(iPlane(vec4(0.0,  1.0, 0.0, 0.0)), p);

    } else if (squareDist(p, vec2(0.0, bs2), bs) < 0.0) {
        p = reflect2(iPlane(vec4(0.0,  1.0, 0.0, bs)), p);
        p = reflect2(iPlane(vec4(1.0,  0.0, 0.0, 0.0)), p);

    } else if (squareDist(p, vec2(0.0, -bs2), bs) < 0.0) {
        p = reflect2(iPlane(vec4(0.0, -1.0, 0.0, bs)), p);
        p = reflect2(iPlane(vec4(1.0,  0.0, 0.0, 0.0)), p);

    } else if (squareDist(p, vec2(bs2, bs2), bs) < 0.0) {
        p = reflect2(iPlane(vec4(1., 0, 0, bs)), p);
        p = reflect2(iPlane(vec4(0, 1., 0, bs)), p);

    } else if (squareDist(p, vec2(-bs2, -bs2), bs) < 0.0) {
        p = reflect2(iPlane(vec4(-1., 0, 0, bs)), p);
        p = reflect2(iPlane(vec4(0, -1., 0, bs)), p);

    } else if (squareDist(p, vec2(bs2, -bs2), bs) < 0.0) {
        p = reflect2(iPlane(vec4(1., 0, 0, bs)), p);
        p = reflect2(iPlane(vec4(0, -1., 0, bs)), p);

    } else if (squareDist(p, vec2(-bs2, bs2), bs) < 0.0) {
        p = reflect2(iPlane(vec4(-1., 0, 0, bs)), p);
        p = reflect2(iPlane(vec4(0,  1., 0, bs)), p);

    } else if (squareDist(p, vec2(0.0, 0.0), bs) < 0.0) {
        // central tile — already in the right place, no transform needed

    } else {
        return false;  // outside all known tiles
    }
    return true;
}

// Folds a world-space point into the central Truchet tile — 'O' / p1 variant.
// Uses pure translation (modular arithmetic): the tiling repeats with period 2*bs.
// Always succeeds — every point maps into the central square.
bool truchetFoldSquareO(inout vec2 p, float bs) {
    float d = 2.0 * bs;
    p.x = mod(p.x + bs, d) - bs;
    p.y = mod(p.y + bs, d) - bs;
    return true;
}

// Folds a world-space point into the central Truchet tile — '*2222' / pmm variant.
// Uses a single axis-aligned mirror reflection through each wall of the central
// square (x = ±bs, y = ±bs), creating mirror symmetry rather than rotation.
bool truchetFoldSquareS2222(inout vec2 p, float bs) {
    float bs2 = 2.0 * bs;

    if (squareDist(p, vec2(bs2, 0.0), bs) < 0.0) {
        // right neighbour — mirror through right wall (x = bs)
        p = reflect2(iPlane(vec4(1.0, 0.0, 0.0, bs)), p);

    } else if (squareDist(p, vec2(-bs2, 0.0), bs) < 0.0) {
        // left neighbour — mirror through left wall (x = -bs)
        p = reflect2(iPlane(vec4(-1.0, 0.0, 0.0, bs)), p);

    } else if (squareDist(p, vec2(0.0, bs2), bs) < 0.0) {
        // top neighbour — mirror through top wall (y = bs)
        p = reflect2(iPlane(vec4(0.0, 1.0, 0.0, bs)), p);

    } else if (squareDist(p, vec2(0.0, -bs2), bs) < 0.0) {
        // bottom neighbour — mirror through bottom wall (y = -bs)
        p = reflect2(iPlane(vec4(0.0, -1.0, 0.0, bs)), p);

    } else if (squareDist(p, vec2(bs2, bs2), bs) < 0.0) {
        // top-right corner — mirror through right wall then top wall
        p = reflect2(iPlane(vec4(1.0, 0.0, 0.0, bs)), p);
        p = reflect2(iPlane(vec4(0.0, 1.0, 0.0, bs)), p);

    } else if (squareDist(p, vec2(-bs2, -bs2), bs) < 0.0) {
        // bottom-left corner — mirror through left wall then bottom wall
        p = reflect2(iPlane(vec4(-1.0, 0.0, 0.0, bs)), p);
        p = reflect2(iPlane(vec4(0.0, -1.0, 0.0, bs)), p);

    } else if (squareDist(p, vec2(bs2, -bs2), bs) < 0.0) {
        // bottom-right corner — mirror through right wall then bottom wall
        p = reflect2(iPlane(vec4(1.0, 0.0, 0.0, bs)), p);
        p = reflect2(iPlane(vec4(0.0, -1.0, 0.0, bs)), p);

    } else if (squareDist(p, vec2(-bs2, bs2), bs) < 0.0) {
        // top-left corner — mirror through left wall then top wall
        p = reflect2(iPlane(vec4(-1.0, 0.0, 0.0, bs)), p);
        p = reflect2(iPlane(vec4(0.0,  1.0, 0.0, bs)), p);

    } else if (squareDist(p, vec2(0.0, 0.0), bs) < 0.0) {
        // central tile — no transform needed

    } else {
        return false;  // outside all known tiles
    }
    return true;
}

// Cn rotation average: samples at p and its (order-1) rotations by 2π/order.
// Uses a mat2 rotation matrix applied iteratively.
vec2 getAvgValueN(vec2 p, int order) {
    float angle = TWOPI / float(order);
    float c = cos(angle);
    float s = sin(angle);
    // GLSL mat2 is column-major: mat2(c, s, -s, c) → [[c,-s],[s,c]] (CCW rotation)
    mat2 rot = mat2(c, s, -s, c);

    vec2 acc = vec2(0.0);
    vec2 q = p;
    for (int i = 0; i < order; i++) {
        acc += texture(uSource, totex(q)).rg;
        q = rot * q;
    }
    return acc / float(order);
}

// Cnv (dihedral-n) average: average of Cn result at p and its x-reflection.
vec2 getAvgValueSN(vec2 p, int order) {
    return 0.5 * (getAvgValueN(p, order) + getAvgValueN(vec2(p.x, -p.y), order));
}

// Dispatches to the selected averaging function.
vec2 getAvgValue(vec2 p, int order) {
    switch (uAvgType) {
    case AVG_SN: return getAvgValueSN(p, order);
    default:     return getAvgValueN(p, order);   // AVG_N
    }
}

// Blends singleSample toward avgSample based on signed distance d to the tile boundary.
// d = 0 at boundary (full average), d = -uTransition at depth (pure single sample).
vec2 mixAvg(vec2 singleSample, vec2 avgSample, float d) {
    float t;
    switch (uTransType) {
    case SMOOTH:        t = smoothstep(-uTransition, 0.0, d);        break;  // S-curve
    case BOX:           t = step(-uTransition, d);                   break;  // hard switch
    case SMOOTH_LINEAR: t = smoothLinearStep(-uTransition, 0.0, d);  break;  // smooth start, linear end
    case LINEAR:
    default:            t = linearStep(-uTransition, 0.0, d);        break;  // LINEAR: ramp
    }
    return mix(singleSample, avgSample, t);
}

bool truchetFoldSquare(inout vec2 p, float s) {

    switch(uFoldType){
        case 2: return truchetFoldSquareS2222(p, s);
        case 1: return truchetFoldSquareO(p, s);
        default: 
        case 0: return truchetFoldSquare2222(p, s);
    }
}


vec2 maskTruchetSquare(vec2 wld) {
    vec2  p  = wld;
    float bs = uExtents.x;

    // Phase 1: fold p into the central square (dispatch on uFoldType).
    if (!truchetFoldSquare(p, bs)) return uMaskValue;

    // Phase 2: C4-average / mix blend inside the central square.
    // d ∈ (-bs, 0]: 0 at the square boundary, increasingly negative inside.
    float d = squareDist(p, vec2(0.0, 0.0), bs);

    vec2 avgSample    = getAvgValue(p, 4);
    vec2 singleSample = texture(uSource, totex(p)).rg;

    return mixAvg(singleSample, avgSample, d);
}

// ── Truchet domain stubs ──────────────────────────────────────────────────────
bool truchetFoldHexagon2222(inout vec2 p, float s) {

    if (hexDist(p, vec2(0, 0), s) <= 0.0) {
        // central tile, do nothing  
    } else if (hexDist(p, vec2(s*1.5, s*COS30), s) <= 0.0) {

        p = reflect2(iPlane(vec4(COS30, SIN30, 0.0, s*COS30)), p);
        p = reflect2(iPlane(vec4(-SIN30, COS30, 0.0, 0.0)), p);

    } else if (hexDist(p, vec2(-s*1.5, -s*COS30), s) <= 0.0) {
        
        p = reflect2(iPlane(vec4(-COS30, -SIN30, 0.0, s*COS30)), p);
        p = reflect2(iPlane(vec4(SIN30, -COS30, 0.0, 0.0)), p);

    } else if (hexDist(p, vec2(0, SQRT3*s), s) <= 0.0) {
        
        p = reflect2(iPlane(vec4(0, 1., 0.0, s*COS30)), p);
        p = reflect2(iPlane(vec4(-1., 0., 0.0, 0.0)), p);

    } else if (hexDist(p, vec2(0, -SQRT3*s), s) <= 0.0) {
        
        p = reflect2(iPlane(vec4(0, -1., 0.0, s*COS30)), p);
        p = reflect2(iPlane(vec4(1., 0., 0.0, 0.0)), p);

    } else if (hexDist(p, vec2(s*1.5, -s*COS30), s) <= 0.0) {

        p = reflect2(iPlane(vec4(COS30, -SIN30, 0.0, s*COS30)), p);
        p = reflect2(iPlane(vec4(SIN30, COS30, 0.0, 0.0)), p);

    } else if (hexDist(p, vec2(-s*1.5, s*COS30), s) <= 0.0) {

        p = reflect2(iPlane(vec4(-COS30, SIN30, 0.0, s*COS30)), p);
        p = reflect2(iPlane(vec4(-SIN30, -COS30, 0.0, 0.0)), p);

    } else {
        return false;  // outside all known tiles
    }
    return true;
}

bool truchetFoldHexagonS2222(inout vec2 p, float s) {

    if (hexDist(p, vec2(0, 0), s) <= 0.0) {
        // central tile, do nothing  
    } else if (hexDist(p, vec2(s*1.5, s*COS30), s) <= 0.0) {

        p = reflect2(iPlane(vec4(COS30, SIN30, 0.0, s*COS30)), p);

    } else if (hexDist(p, vec2(-s*1.5, -s*COS30), s) <= 0.0) {
        
        p = reflect2(iPlane(vec4(-COS30, -SIN30, 0.0, s*COS30)), p);

    } else if (hexDist(p, vec2(0, SQRT3*s), s) <= 0.0) {
        
        p = reflect2(iPlane(vec4(0, 1., 0.0, s*COS30)), p);

    } else if (hexDist(p, vec2(0, -SQRT3*s), s) <= 0.0) {
        
        p = reflect2(iPlane(vec4(0, -1., 0.0, s*COS30)), p);

    } else if (hexDist(p, vec2(s*1.5, -s*COS30), s) <= 0.0) {

        p = reflect2(iPlane(vec4(COS30, -SIN30, 0.0, s*COS30)), p);

    } else if (hexDist(p, vec2(-s*1.5, s*COS30), s) <= 0.0) {

        p = reflect2(iPlane(vec4(-COS30, SIN30, 0.0, s*COS30)), p);

    } else {
        return false;  // outside all known tiles
    }
    return true;
}

bool truchetFoldHexagonO(inout vec2 p, float s) {

    if (hexDist(p, vec2(0, 0), s) <= 0.0) {
        // central tile, do nothing  
    } else if (hexDist(p, vec2(s*1.5, s*COS30), s) <= 0.0) {

        p = reflect2(iPlane(vec4(COS30, SIN30, 0.0, s*COS30)), p);
        p = reflect2(iPlane(vec4(COS30, SIN30, 0.0, 0.0)), p);

    } else if (hexDist(p, vec2(-s*1.5, -s*COS30), s) <= 0.0) {
        
        p = reflect2(iPlane(vec4(-COS30, -SIN30, 0.0, s*COS30)), p);
        p = reflect2(iPlane(vec4(-COS30, -SIN30, 0.0, 0.0)), p);

    } else if (hexDist(p, vec2(0, SQRT3*s), s) <= 0.0) {
        
        p = reflect2(iPlane(vec4(0, 1., 0.0, s*COS30)), p);
        p = reflect2(iPlane(vec4(0, 1., 0.0, 0.0)), p);

    } else if (hexDist(p, vec2(0, -SQRT3*s), s) <= 0.0) {
        
        p = reflect2(iPlane(vec4(0, -1., 0.0, s*COS30)), p);
        p = reflect2(iPlane(vec4(0, -1., 0.0, 0.0)), p);

    } else if (hexDist(p, vec2(s*1.5, -s*COS30), s) <= 0.0) {

        p = reflect2(iPlane(vec4(COS30, -SIN30, 0.0, s*COS30)), p);
        p = reflect2(iPlane(vec4(COS30, -SIN30, 0.0, 0.0)), p);

    } else if (hexDist(p, vec2(-s*1.5, s*COS30), s) <= 0.0) {

        p = reflect2(iPlane(vec4(-COS30, SIN30, 0.0, s*COS30)), p);
        p = reflect2(iPlane(vec4(-COS30, SIN30, 0.0, 0.0)), p);

    } else {
        return false;  // outside all known tiles
    }
    return true;
}

bool truchetFoldHexagon(inout vec2 p, float s) {

    switch(uFoldType){
        case 2: return truchetFoldHexagonS2222(p, s);
        case 1: return truchetFoldHexagonO(p, s);
        default: 
        case 0: return truchetFoldHexagon2222(p, s);
    }

}

vec2 maskTruchetHexagon(vec2 wld) {
    vec2  p  = wld;
    float bs = uExtents.x;

    if (!truchetFoldHexagon(p, bs)) return uMaskValue;

    float d = hexDist(p, vec2(0.0, 0.0), bs);

    vec2 avgSample    = getAvgValue(p, 6);
    vec2 singleSample = texture(uSource, totex(p)).rg;

    return mixAvg(singleSample, avgSample, d);
}

// Stub fold: triangular Truchet tiling — folds p into the central triangle.
// TODO: implement proper triangular fold.
bool truchetFoldTriangle(inout vec2 p, float bs) {
    return true;  // not yet implemented
}

vec2 maskTruchetTriangle(vec2 wld) {
    vec2  p  = wld;
    float bs = uExtents.x;

    if (!truchetFoldTriangle(p, bs)) return uMaskValue;

    // Use hexDist as placeholder; replace with proper triangular SDF when available.
    float d = hexDist(p, vec2(0.0, 0.0), bs);

    vec2 avgSample    = getAvgValue(p, 3);
    vec2 singleSample = texture(uSource, totex(p)).rg;

    return mixAvg(singleSample, avgSample, d);
}

// Dispatches to the selected Truchet domain.
vec2 maskTruchet(vec2 wld) {
    switch (uTruchetDomain) {
    case TRUCHET_HEXAGON:  return maskTruchetHexagon(wld);
    case TRUCHET_TRIANGLE: return maskTruchetTriangle(wld);
    default:               return maskTruchetSquare(wld);   // TRUCHET_SQUARE
    }
}


vec2 maskHexagon(vec2 wld) {
    vec2 src    = texture(uSource, totex(wld)).rg;
    bool inside = hexDist(wld, uCenter, uRadius) < 0.0;
    return inside ? src : uMaskValue;
}


vec2 maskTriangle(vec2 wld) {
    vec2 src    = texture(uSource, totex(wld)).rg;
    bool inside = triDist(wld, uCenter, uRadius) < 0.0;
    return inside ? src : uMaskValue;
}

// ── main ─────────────────────────────────────────────────────────────────────────────

void main() {
    // vUv is in world coordinates [-1, 1]
    vec2 wld = vUv;
    vec2 result;

    switch (uMaskType) {
    case MASK_RECTANGLE: result = maskRectangle(wld);      break;
    case MASK_CIRCLE:    result = maskCircle(wld);         break;
    case MASK_TRUCHET:   result = maskTruchet(wld);         break;
    case MASK_HEXAGON:   result = maskHexagon(wld);         break;
    case MASK_TRIANGLE:  result = maskTriangle(wld);        break;
    default:             result = uMaskValue;               break;
    }

    outColor = vec4(result, 0.0, 1.0);
}
/*glsl*/`;
