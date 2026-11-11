/*
  tests of the moves of the navigator's inversive mode
  (lib/symhublib/InversiveMoves.js, docs/navigation_tool_plan.md section 3,
  outside the repository)

    node tests/symhublib/inversive_moves.mjs

  1. invertSplane: points of a mirror go onto its image (lines, circles,
     lines and circles through the centre)
  2. drag: p0 goes to p1, the pole stays; without a pole every point moves
     by p1 - p0
  3. dilation: p and the pole stay, the multiplier at p is f (at the pole
     1/f); without a pole the dilation about p
  4. turn: p and the pole stay, a direction at p turns by a counterclockwise
  5. no move: a point at the pole, f = 1, a = 0, p0 = p1
*/

import { iPoint, iTransformU4, iReflectU4 } from '../../lib/invlib/invlib.js';
import { inversiveDrag, inversiveDilation, inversiveTurn, invertPoint, invertSplane }
    from '../../lib/symhublib/InversiveMoves.js';
import { iPlane, iSphere, SPLANE_SPHERE } from '../../lib/invlib/invlib.js';

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
}
const near = (a, b, eps) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= eps;
const apply = (m, q) => iTransformU4(m, iPoint([q[0], q[1], 0, 0])).v.slice(0, 2);
const reflect = (s, q) => iReflectU4(s, iPoint([q[0], q[1], 0, 0])).v.slice(0, 2);

// 1 ───────────────────────────────────────────────────────────────────────────

{
    const o = [0.3, -0.4], rho = 0.7;
    const mirrors = [
        iPlane([1, 0, 0, 1.2]),                         // a line
        iPlane([0.6, 0.8, 0, 0.6*0.3 + 0.8*-0.4]),      // a line through o
        iSphere([1, 1, 0, 0.5]),                        // a circle
        iSphere([0.3 + 0.6, -0.4 + 0.8, 0, 1]),         // a circle through o
    ];
    for (const m of mirrors) {
        const img = invertSplane(m, o, rho);
        // points of m: around a circle, along a line (n.x = d)
        const pts = [];
        for (let t = 0.1; t < 6; t += 0.7) {
            if (m.type === SPLANE_SPHERE) pts.push([m.v[0] + m.v[3]*Math.cos(t), m.v[1] + m.v[3]*Math.sin(t)]);
            else { const n = [m.v[0], m.v[1]], d = m.v[3]; pts.push([n[0]*d - n[1]*(t - 3), n[1]*d + n[0]*(t - 3)]); }
        }
        check(pts.length > 5, 'points to test');
        const ok = pts.every(q => {
            const j = invertPoint(q, o, rho);
            if (!j || Math.hypot(j[0], j[1]) > 1e6) return true;
            // a point of a mirror is its own reflection
            return near(reflect(img, j), j, 1e-9*(1 + Math.hypot(j[0], j[1])));
        });
        check(ok, `invertSplane: the image of ${JSON.stringify(m.v)} holds the images of its points`);
    }
}

// 2 ───────────────────────────────────────────────────────────────────────────

{
    const p0 = [0.2, 0.1], p1 = [0.35, -0.05];
    const T = inversiveDrag(p0, p1, null);
    check(near(apply(T, p0), p1, 1e-12), 'drag without pole: p0 to p1');
    check(near(apply(T, [-3, 2]), [-3 + 0.15, 2 - 0.15], 1e-12), 'drag without pole: a translation');
    const O = [1.1, 0.7];
    const P = inversiveDrag(p0, p1, O);
    check(near(apply(P, p0), p1, 1e-12), 'drag about a pole: p0 to p1');
    check(near(apply(P, O), O, 1e-12), 'drag about a pole: the pole stays');
    // parabolic: no other fixed point, a point near O moves less than one far off
    const q = [-0.5, -0.8], fq = apply(P, q);
    check(!near(fq, q, 1e-6), 'drag about a pole: another point moves');
}

// 3 ───────────────────────────────────────────────────────────────────────────

{
    const p = [0.1, -0.2], f = 1.3, O = [-0.6, 0.5], e = 1e-6;
    const D = inversiveDilation(p, f, O);
    check(near(apply(D, p), p, 1e-12) && near(apply(D, O), O, 1e-12), 'dilation: p and the pole stay');
    const dp = apply(D, [p[0] + e, p[1]]);
    check(Math.abs(Math.hypot(dp[0] - p[0], dp[1] - p[1])/e - f) < 1e-5, 'dilation: multiplier f at p');
    const dO = apply(D, [O[0] + e, O[1]]);
    check(Math.abs(Math.hypot(dO[0] - O[0], dO[1] - O[1])/e - 1/f) < 1e-5, 'dilation: multiplier 1/f at the pole');
    const D0 = inversiveDilation(p, f, null);
    check(near(apply(D0, [p[0] + 0.5, p[1] + 0.2]), [p[0] + 0.5*f, p[1] + 0.2*f], 1e-12), 'dilation without pole: about p');
}

// 4 ───────────────────────────────────────────────────────────────────────────

for (const O of [null, [0.9, -0.3]]) {
    const p = [-0.2, 0.25], a = 0.4, e = 1e-6;
    const R = inversiveTurn(p, a, O);
    check(near(apply(R, p), p, 1e-12), `turn (pole ${O}): p stays`);
    if (O) check(near(apply(R, O), O, 1e-12), 'turn: the pole stays');
    const q = apply(R, [p[0] + e, p[1]]);
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    check(Math.abs(ang - a) < 1e-5, `turn (pole ${O}): by a counterclockwise at p (got ${ang})`);
}

// 5 ───────────────────────────────────────────────────────────────────────────

{
    const O = [0.5, 0.5];
    check(inversiveDrag(O, [0, 0], O) === null, 'no drag from the pole');
    check(inversiveDrag([0.1, 0.1], [0.1, 0.1], O) === null, 'no drag without a step');
    check(inversiveDilation([0, 0], 1, O) === null && inversiveDilation(O, 2, O) === null, 'no dilation by 1 or at the pole');
    check(inversiveTurn([0, 0], 0, O) === null && inversiveTurn(O, 1, O) === null, 'no turn by 0 or at the pole');
}

console.log(failed ? `${failed} FAILED` : 'all passed');
if (failed) process.exitCode = 1;
