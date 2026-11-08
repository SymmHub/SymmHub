import {
    ITransform,
    mobiusApply,
    mobiusInverse,
    mobiusToSplanes,
    cMul,
    cDiv,
    cAdd,
    cSub,
    TORADIANS,
    TODEGREE,
} from './modules.js';

//
//  PatternPose - the placement of the pattern box in the world as a Möbius map
//  (docs/shape_motions_plan.md, outside the repository)
//
//  The pattern transform (SymRenderer's patternTransConfig: centerX, centerY, scale,
//  angle in degrees, pivotX, pivotY) places the pattern box [-1, 1]^2 in the world. It
//  was the similarity w = c + d p, d = scale e^{i angle}; with the bend k = bendX + i bendY
//  it is the Möbius map
//
//      P(p) = c + d p / (1 - k p),        P^-1(w) = (w - c) / (d + k (w - c)),
//
//  the similarity itself for k = 0, so every saved transform reads as before. c is
//  still the image of the box's centre and d the scale and turn there; 1/k is the
//  point of the box that goes to infinity. As a matrix, P = [[d - c k, c], [-k, 1]].
//
//  The pose lets the pattern transform tool move an image pattern by the motions of
//  the group's geometry (a hyperbolic translation bends the picture): the tool
//  composes the pose with a Möbius map and reads the six numbers back (poseConfig).
//  The shaders sample the pattern buffer at P^-1 (bufferPose.glsl.mjs; in the texture
//  box [-0.5, 0.5]^2 the bend is 2k, poseBendUniform) and the group is carried into the
//  box's coordinates by P^-1 as a chain of reflections (poseInverseTransform).
//

const ONE = [1, 0], ZERO = [0, 0];

/** the complex scale and turn d of the config */
function scaleTurn(ptc){
    const a = (ptc.angle || 0)*TORADIANS, s = (ptc.scale !== undefined) ? ptc.scale : 1;
    return [s*Math.cos(a), s*Math.sin(a)];
}

/** the bend k of the config, [kx, ky] */
export function poseBend(ptc){
    return [ptc.bendX || 0, ptc.bendY || 0];
}

/** is the pose a plain similarity */
export function poseIsSimilarity(ptc){
    return !(ptc.bendX || ptc.bendY);
}

/** the Möbius matrix of the pose: the box's coordinates to the world */
export function poseMatrix(ptc){
    const c = [ptc.centerX || 0, ptc.centerY || 0], d = scaleTurn(ptc), k = poseBend(ptc);
    return [[cSub(d, cMul(c, k)), c], [[-k[0], -k[1]], ONE]];
}

/**
 * the config of a pose matrix: centerX, centerY (the image of the box's centre),
 * scale and angle (degrees, the derivative there), bendX, bendY; the other entries
 * of ptc (the pivot) are kept. Null for a matrix sending the box's centre to infinity
 */
export function poseConfig(m, ptc = {}){
    const [[a, b], [cc, dd]] = m;
    if (!(Math.hypot(dd[0], dd[1]) > 1.e-300)) return null;
    const c = cDiv(b, dd), k = cDiv([-cc[0], -cc[1]], dd);
    const d = cAdd(cDiv(a, dd), cMul(c, k));
    const out = { ...ptc, centerX: c[0], centerY: c[1], scale: Math.hypot(d[0], d[1]), angle: Math.atan2(d[1], d[0])*TODEGREE, bendX: k[0], bendY: k[1] };
    return Object.values(out).every(v => typeof v !== 'number' || Number.isFinite(v)) ? out : null;
}

/** the world point of a point of the box */
export function poseToWorld(ptc, p){
    return mobiusApply(poseMatrix(ptc), p);
}

/** the point of the box of a world point */
export function poseToPattern(ptc, w){
    return mobiusApply(mobiusInverse(poseMatrix(ptc)), w);
}

/** the bend for the shaders: in the texture box [-0.5, 0.5]^2 the bend is 2k */
export function poseBendUniform(ptc){
    const k = poseBend(ptc);
    return [2*k[0], 2*k[1]];
}

/** the numbers of the pose as one string, for the caches keyed by the transform */
export function poseKey(ptc){
    return [ptc.centerX, ptc.centerY, ptc.scale, ptc.angle, ptc.bendX || 0, ptc.bendY || 0].join(' ');
}

/**
 * the pose's inverse as a chain of reflections, world to the box's coordinates (the
 * group carried into the box, SymRenderer.updateTransGroup): the similarity's inverse
 * as a translation, a turn and a scaling, then the bend's inverse q -> q/(1 + k q)
 */
export function poseInverseTransform(ptc){
    const scale = (ptc.scale !== undefined) ? ptc.scale : 1;
    const tr = ITransform.getTranslation([-(ptc.centerX || 0), -(ptc.centerY || 0)])
        .concat(ITransform.getRotation([0, 0, 1], -TORADIANS*(ptc.angle || 0)))
        .concat(ITransform.getScale(1/scale));
    const k = poseBend(ptc);
    if (k[0] || k[1]) {
        const splanes = mobiusToSplanes([[ONE, ZERO], [k, ONE]]);
        if (splanes && splanes.length) tr.concat(new ITransform(splanes, ''));
    }
    return tr;
}

/**
 * the outline of the box in the world: `perEdge` points along each edge from the
 * corner (-1, 1) round through (1, 1), (1, -1) and (-1, -1), bent as the pose bends
 * the box; the corners are the points 0, perEdge, 2 perEdge and 3 perEdge
 */
export function poseBoxOutline(ptc, perEdge = 12){
    const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
    const m = poseMatrix(ptc);
    const out = [];
    for (let e = 0; e < 4; e++) {
        const a = corners[e], b = corners[(e + 1) % 4];
        for (let i = 0; i < perEdge; i++) {
            const t = i/perEdge;
            out.push(mobiusApply(m, [a[0] + t*(b[0] - a[0]), a[1] + t*(b[1] - a[1])]));
        }
    }
    return out;
}
