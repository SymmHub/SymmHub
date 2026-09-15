/**
 * ImagePlacement.js
 *
 * Geometry for placing one texture image in the hyperbolic, spherical or
 * Euclidean plane, shared by the drag handler, the overlay renderer and the
 * image's own shader so that all three agree about where the image is.
 *
 * ── the model ────────────────────────────────────────────────────────────────
 *
 * An image is stored, as it always has been, as {centerX, centerY, scale, angle}
 * in pattern/buffer coordinates. From that we build
 *
 *     Tw = transformFromCenterToPoint(centreInWorld, [cos a, sin a], k)
 *
 * a motion of the plane of curvature k: rotate about the origin by the angle,
 * then carry the origin to the centre — a hyperbolic translation, a Euclidean
 * one, or a rotation of the sphere, per k. Tw carries no scale;
 * transformFromCenterToPoint divides the magnitude out. So the source image
 * really is a rectangle — half-side s about the origin — and everything curved
 * about its placement is in Tw:
 *
 *     p is inside   <=>   max(|q.x|, |q.y|) <= s,  q = Tw^-1(p)
 *     its outline   =     Tw applied to the square's four bounding lines,
 *                         which come back as lines or circles — a splane
 *                         either way, which is all iDistance needs
 *
 * ── world vs pattern coordinates ─────────────────────────────────────────────
 *
 * The geometry has to be done in *world* coordinates. That is where the group
 * lives and, in the hyperbolic case, where the model is the unit disk — which
 * is what transformFromCenterToPoint assumes. Pattern/buffer space is the world
 * pushed through the pattern transform, a Euclidean similarity, so a hyperbolic
 * model lands there as some other disk and none of the disk-preserving
 * constructions would apply.
 *
 * So every placement here is built in world coordinates and converted at the
 * edges. The similarity is exact and cheap, and it is only a rotation, a scale
 * and a translation:
 *
 *     angle:  world = pattern + patternTransform.angle
 *     scale:  world = pattern * patternTransform.scale
 *     point:  world = scale * R(angle) * pattern + centre
 *
 * For the shader, which samples in buffer coordinates, buildT() returns
 * Tw followed by world->pattern, so one word takes image coordinates all the
 * way to the buffer.
 *
 * Note this does change what a stored `scale` means: it is now a half-side in
 * the geometry, not in the flat picture, so an image far from the centre of a
 * hyperbolic model draws smaller than one at the centre. That is the point of
 * the exercise, but it does mean an old preset renders at its geometric size
 * rather than its former Euclidean one.
 *
 * ── composition order ────────────────────────────────────────────────────────
 *
 * A transform here is a plain array of splanes (reflections), and iTransformU4
 * applies them left to right. So `A.concat(B)` means "A first, then B" — the
 * opposite of the usual ∘ notation. Every comment below says which it means.
 */

import {
    iSplane,
    iPlane,
    iPoint,
    ITransform,
    SPLANE_POINT,
    SPLANE_PLANE,
    SPLANE_SPHERE,
    iTransformU4,
    iGetInverseTransform,
    iGetFactorizationU4,
    iDistanceU4,
    transformFromCenterToPoint,
    TORADIANS,
    TODEGREE,
    normalizeAngle,
    cos,
    sin,
} from './modules.js';

const ORIGIN = new iSplane({ v: [0, 0, 0, 0], type: SPLANE_POINT });

//  [x,y] -> point splane
function pt(p) {
    return new iSplane({ v: [p[0], p[1], 0, 0], type: SPLANE_POINT });
}

//  apply a splane word to a plain [x,y]
function applyWord(w, p) {
    if (!w || w.length === 0) return [p[0], p[1]];
    const v = iTransformU4(w, pt(p)).v;
    return [v[0], v[1]];
}

//  flip a splane's solid side if `inside` is not already on it
function orientInward(sp, inside) {
    if (iDistanceU4(sp, inside) <= 0) return sp;
    if (sp.type === SPLANE_PLANE)
        return new iSplane({ v: sp.v.map(x => -x), type: SPLANE_PLANE });
    if (sp.type === SPLANE_SPHERE)
        return new iSplane({ v: [sp.v[0], sp.v[1], sp.v[2], -sp.v[3]], type: SPLANE_SPHERE });
    return sp;
}

//
//  A placement calculator bound to one curvature and one pattern transform.
//  Points passed in and out are in pattern/buffer coordinates unless a name
//  says World; angles are degrees and scales are half-sides, both in the
//  pattern convention, so callers go on reading and writing exactly the
//  {centerX, centerY, scale, angle} they always did.
//
export function makePlacement({ curvature = -1, patternTransform = null } = {}) {

    const k = curvature;

    // pattern -> world similarity
    const pScale = (patternTransform && patternTransform.scale !== undefined)
                    ? patternTransform.scale : 1;
    const pAngle = (patternTransform && patternTransform.angle) || 0;   // degrees
    const pCx    = (patternTransform && patternTransform.centerX) || 0;
    const pCy    = (patternTransform && patternTransform.centerY) || 0;

    const identityFrame = Math.abs(pScale - 1) < 1e-12 && Math.abs(pAngle) < 1e-12
                       && Math.abs(pCx) < 1e-12 && Math.abs(pCy) < 1e-12;

    const pa = pAngle * TORADIANS, pca = cos(pa), psa = sin(pa);

    function toWorld(p) {
        if (identityFrame) return [p[0], p[1]];
        return [pScale * (pca * p[0] - psa * p[1]) + pCx,
                pScale * (psa * p[0] + pca * p[1]) + pCy];
    }

    function toPattern(w) {
        if (identityFrame) return [w[0], w[1]];
        const s = pScale === 0 ? 0 : 1 / pScale;
        const x = w[0] - pCx, y = w[1] - pCy;
        return [s * ( pca * x + psa * y),
                s * (-psa * x + pca * y)];
    }

    //  world -> pattern as a splane word, so it can be composed with Tw for the
    //  shader. Null when the frame is the identity.
    const worldToPatternWord = identityFrame ? null : (() => {
        const t = ITransform.getTranslation([-pCx, -pCy])
                    .concat(ITransform.getRotation([0, 0, 1], -pa))
                    .concat(ITransform.getScale(pScale === 0 ? 1 : 1 / pScale));
        return t.getRef();
    })();

    //  D_w: the motion carrying the world origin to the world point w with no
    //  rotation of its own. This is the frame convention angles are measured
    //  against, here and in readBack.
    function D(w) {
        return transformFromCenterToPoint([w[0], w[1]], [1, 0], k);
    }

    function invD(w) {
        return iGetInverseTransform(D(w));
    }

    // ── building ─────────────────────────────────────────────────────────────

    //  Tw: image coordinates -> world. Rotation about the origin, then the
    //  translation carrying the origin to the centre.
    function buildTWorld(cfg) {
        const a = ((cfg.angle || 0) + pAngle) * TORADIANS;
        const c = toWorld([cfg.centerX || 0, cfg.centerY || 0]);
        return transformFromCenterToPoint(c, [cos(a), sin(a)], k);
    }

    //  image coordinates -> pattern/buffer, which is what the shader samples in
    function buildT(cfg) {
        const Tw = buildTWorld(cfg);
        return worldToPatternWord
            ? iGetFactorizationU4(Tw.concat(worldToPatternWord))
            : Tw;
    }

    //  half-side in world units
    function worldScale(s) {
        return (s === undefined ? 1 : s) * pScale;
    }

    // ── reading ──────────────────────────────────────────────────────────────

    function centerWorld(Tw) {
        const v = iTransformU4(Tw, ORIGIN).v;
        return [v[0], v[1]];
    }

    //
    //  Read a world transform back into storable pattern-space placement.
    //
    //  Slide the centre back to the world origin along the D convention and see
    //  where that leaves a probe on the positive x-axis: if Tw = D_c . R_theta
    //  the round trip is just R_theta, so atan2 returns the angle exactly. The
    //  scale is never touched — it is not in Tw.
    //
    function readBack(Tw) {
        const c = centerWorld(Tw);
        const q = applyWord(Tw.concat(invD(c)), [1, 0]);
        const p = toPattern(c);
        return {
            centerX: p[0],
            centerY: p[1],
            angle: TODEGREE * normalizeAngle(Math.atan2(q[1], q[0]) - pa),
        };
    }

    // ── shape ────────────────────────────────────────────────────────────────

    //  corners in cyclic order, matching UNIT_CORNERS elsewhere
    const CORNER_UNITS = [[-1, 1], [1, 1], [1, -1], [-1, -1]];

    function cornersWorld(Tw, s) {
        const w = worldScale(s);
        return CORNER_UNITS.map(([x, y]) => applyWord(Tw, [x * w, y * w]));
    }

    function cornersPattern(Tw, s) {
        return cornersWorld(Tw, s).map(toPattern);
    }

    //
    //  The four bounding splanes of the image in world coordinates, oriented so
    //  the interior is each one's negative (solid) side — the convention
    //  iDistanceU4 and the box shader both use. A Mobius map does not preserve
    //  that orientation, so it is re-derived by testing the centre rather than
    //  assumed.
    //
    function boxSplanesWorld(Tw, s) {
        const w = worldScale(s);
        const inside = pt(centerWorld(Tw));
        return [
            iPlane([ 1,  0, 0, w]),   //  x <=  w
            iPlane([ 0,  1, 0, w]),   //  y <=  w
            iPlane([-1,  0, 0, w]),   //  x >= -w
            iPlane([ 0, -1, 0, w]),   //  y >= -w
        ].map(sp => orientInward(iTransformU4(Tw, sp), inside));
    }

    //  is the pattern-space point p inside the image?
    function containsPoint(Tw, s, p) {
        const q = applyWord(iGetInverseTransform(Tw), toWorld(p));
        const w = worldScale(s);
        return Math.max(Math.abs(q[0]), Math.abs(q[1])) <= w;
    }

    //  the image coordinates of a pattern-space point — the canonical position
    //  of a grabbed point, the thing a drag holds fixed
    function pullBack(Tw, p) {
        return applyWord(iGetInverseTransform(Tw), toWorld(p));
    }

    // ── gestures ─────────────────────────────────────────────────────────────

    //
    //  Continuous drag. With q = pullBack(Twdown, pdown), the returned transform
    //  satisfies Tw(q) = the world image of p, to machine precision, for any q —
    //  not just the centre. So whichever point of the image was grabbed is the
    //  point that stays under the cursor.
    //
    //      Tw = Twdown then D_pdown^-1 then D_p        (left-to-right)
    //
    //  Built from the pointerdown state every move rather than accumulated, so a
    //  long drag picks up no drift. The one remaining degree of freedom, a
    //  rotation about the cursor, is fixed by the D convention — the same one
    //  readBack measures against, so the values written back round-trip through
    //  buildTWorld exactly.
    //
    function dragTo(Twdown, pdown, p) {
        const a = toWorld(pdown), b = toWorld(p);
        return iGetFactorizationU4(Twdown.concat(invD(a)).concat(D(b)));
    }

    //
    //  Release snap: carry the image into the fundamental domain.
    //
    //  g is the group element taking the centre home, so Tw then g has its
    //  centre in the FD. Composing with a group element cannot change the
    //  symmetric picture — every copy is permuted, none moves — and the
    //  corrected angle simply falls out of reading the result back, with no
    //  separate holonomy term to track through the drag.
    //
    function snapToFD(Tw, group, maxIterations = 200) {
        if (!group) return null;
        const res = group.toFundDomain({ pnt: iPoint(centerWorld(Tw)), maxIterations });
        const g = res && res.transform ? res.transform.getRef() : null;
        if (!g || g.length === 0) return null;
        const T2 = iGetFactorizationU4(Tw.concat(g));
        return { transform: T2, ...readBack(T2) };
    }

    //
    //  Option-drag: move the image from one copy of the fundamental domain to
    //  the copy the cursor is in, without changing the symmetric picture.
    //
    //      g takes the current centre into the FD
    //      h takes the cursor into the FD
    //      Tw' = Tw then g then h^-1              (left-to-right)
    //
    //  so Tw'(origin) sits in the same copy as the cursor. `copyKey` names that
    //  copy (h's word), so a caller can tell a hop from a move that stays put.
    //
    //  This is the mechanism of orbilib's resetTransformfromPtAndTransform, with
    //  its two defects fixed: it refused to work outside |w|^2 > 0.9 with a bare
    //  console.log, and it returned the probe image in place of the centre.
    //
    function hopToCopy(Tw, p, group, maxIterations = 200) {
        if (!group) return null;
        const w = toWorld(p);

        const gRes = group.toFundDomain({ pnt: iPoint(centerWorld(Tw)), maxIterations });
        const hRes = group.toFundDomain({ pnt: iPoint(w), maxIterations });
        if (!gRes || !hRes || !gRes.transform || !hRes.transform) return null;

        const g = gRes.transform.getRef();
        const h = hRes.transform.getRef();

        const T2 = iGetFactorizationU4(Tw.concat(g).concat(iGetInverseTransform(h)));
        return { transform: T2, copyKey: hRes.word || '', ...readBack(T2) };
    }

    //
    //  Corner drag. The pointer angle is measured after sliding the image's
    //  centre back to the origin, which is what makes it right in a curved
    //  plane: a Euclidean atan2 about the centre is only correct when the centre
    //  is already at the origin. `corner` is 0..3 in the cornersWorld order and
    //  contributes the quarter turn that keeps the grabbed corner under the
    //  cursor. Returns pattern-convention {angle, scale}.
    //
    function turnTo(Tw, p, corner) {
        const c = centerWorld(Tw);
        const q = applyWord(invD(c), toWorld(p));
        const r = Math.hypot(q[0], q[1]);
        if (!(r > 1e-9)) return null;

        // corner k of cornersWorld sits at 135, 45, -45, -135 degrees
        const cornerAngle = [135, 45, -45, -135][corner & 3] * TORADIANS;
        return {
            angle: TODEGREE * normalizeAngle(Math.atan2(q[1], q[0]) - cornerAngle - pa),
            scale: r / Math.SQRT2 / (pScale || 1),
        };
    }

    //
    //  Keep a pattern-space point inside the model. Hyperbolic points must stay
    //  well clear of the bounding circle or the crown words explode; spherical
    //  points just must not run off to infinity. Euclidean is unbounded. The
    //  limit is on the world radius, since that is where the model is the unit
    //  disk.
    //
    function clampToModel(p) {
        const lim = k < 0 ? 0.95 : (k > 0 ? 0.999 : 0);
        if (!lim) return p;
        const w = toWorld(p);
        const r = Math.hypot(w[0], w[1]);
        if (r <= lim || r === 0) return p;
        return toPattern([w[0] / r * lim, w[1] / r * lim]);
    }

    return {
        curvature: k,
        identityFrame,
        toWorld,
        toPattern,
        buildT,
        buildTWorld,
        worldScale,
        centerWorld,
        readBack,
        cornersWorld,
        cornersPattern,
        boxSplanesWorld,
        containsPoint,
        pullBack,
        dragTo,
        snapToFD,
        hopToCopy,
        turnTo,
        clampToModel,
    };
}
