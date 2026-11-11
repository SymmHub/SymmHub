//
//  InversiveMoves - the moves of the navigator's inversive mode
//  (docs/navigation_tool_plan.md section 3, outside the repository)
//
//  The moves are Moebius maps of the view plane with a pole O in the part of
//  infinity: a Euclidean move S (a translation, a dilation, a turn) fixing
//  infinity, conjugated by the inversion J in a circle about O, is J S J and
//  fixes O. S is two mirrors, so J S J is the two mirrors J(m0), J(m1)
//  (J m1 J J m0 J = J m1 m0 J). With O at infinity (null) the moves are S.
//
//  J's radius is the distance of the move's point p from O, so J fixes p
//  and the numbers stay of the size of the view. J reverses orientation: a
//  turn by a at J(p) = p is a turn by -a after the conjugation, so S turns
//  by -a. A dilation by f at p is one by f after it (by 1/f at O).
//
//    inversiveDrag(p0, p1, pole)   the parabolic map fixing O taking p0 to p1
//                                  (the translation p0 -> p1 for O at infinity)
//    inversiveDilation(p, f, pole) the hyperbolic map with the fixed points p
//                                  and O, multiplier f at p
//    inversiveTurn(p, a, pole)     the elliptic map with the fixed points p
//                                  and O, turning by a (counterclockwise) at p
//
//  Each returns [m0, m1] (the first acts first) or null for no move: a
//  point at the pole, no step.
//

import {
    iPlane,
    iSphere,
    SPLANE_SPHERE,
} from './modules.js';

const EPS = 1.e-12;

//
//  the inversion of the point q in the circle about o of the radius rho
//
export function invertPoint(q, o, rho){
    const dx = q[0] - o[0], dy = q[1] - o[1];
    const dd = dx*dx + dy*dy;
    if (!(dd > 0)) return null;
    const f = rho*rho/dd;
    return [o[0] + f*dx, o[1] + f*dy];
}

//
//  the image of the mirror s (an iPlane or an iSphere of the plane z = 0) in
//  the inversion about o of the radius rho
//
export function invertSplane(s, o, rho){
    const v = s.v, r2 = rho*rho;
    if (s.type === SPLANE_SPHERE) {
        const cx = v[0] - o[0], cy = v[1] - o[1], r = v[3];
        const cc = cx*cx + cy*cy;
        const delta = cc - r*r;
        if (Math.abs(delta) <= EPS*Math.max(cc, r*r)) {
            // a circle through o: the line across its diameter from o, at r2/2r
            const c = Math.sqrt(cc);
            const u = [cx/c, cy/c];
            return iPlane([u[0], u[1], 0, u[0]*o[0] + u[1]*o[1] + r2/(2*r)]);
        }
        const f = r2/delta;
        return iSphere([o[0] + f*cx, o[1] + f*cy, 0, Math.abs(f)*r]);
    }
    // a line n.x = d: through o itself, or the circle through o and the image of its point nearest o
    const n = [v[0], v[1]];
    const delta = v[3] - (n[0]*o[0] + n[1]*o[1]);
    if (Math.abs(delta) <= EPS*rho) return iPlane([n[0], n[1], 0, v[3]]);
    const h = r2/(2*delta);
    return iSphere([o[0] + h*n[0], o[1] + h*n[1], 0, Math.abs(h)]);
}

// the line through q with the unit normal n
function lineThrough(q, n){
    return iPlane([n[0], n[1], 0, n[0]*q[0] + n[1]*q[1]]);
}

// the line through q along the direction angle phi
function lineAt(q, phi){
    return lineThrough(q, [-Math.sin(phi), Math.cos(phi)]);
}

// the two mirrors of S carried through J (about o, the radius rho); o null: S itself
function conjugate(mirrors, o, rho){
    if (!mirrors) return null;
    if (!o) return mirrors;
    return mirrors.map(m => invertSplane(m, o, rho));
}

function distance(a, b){
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

//
//  the parabolic map fixing the pole taking p0 to p1: J T J with T the
//  translation from p0 (= J(p0)) to J(p1)
//
export function inversiveDrag(p0, p1, pole){
    let a = p0, b = p1, rho = 0;
    if (pole) {
        rho = distance(p0, pole);
        if (!(rho > 0) || !(distance(p1, pole) > 0)) return null;
        b = invertPoint(p1, pole, rho);
    }
    const t = [b[0] - a[0], b[1] - a[1]];
    const len = Math.hypot(t[0], t[1]);
    if (!(len > EPS*Math.max(1, rho))) return null;
    const n = [t[0]/len, t[1]/len];
    // the mirror through a, then the one through the middle: a goes to b
    const T = [lineThrough(a, n), lineThrough([(a[0] + b[0])/2, (a[1] + b[1])/2], n)];
    return conjugate(T, pole, rho);
}

//
//  the hyperbolic map with the fixed points p and the pole, the multiplier f
//  at p: J D J with D the dilation by f about p (= J(p)), two circles about p
//  of the radii r and r sqrt(f), both inside the distance to the pole
//
export function inversiveDilation(p, f, pole){
    if (!(f > 0) || f === 1) return null;
    let rho = 0, r0 = 1;
    if (pole) {
        rho = distance(p, pole);
        if (!(rho > 0)) return null;
        r0 = 0.5*rho/Math.max(1, Math.sqrt(f));
    }
    const D = [iSphere([p[0], p[1], 0, r0]), iSphere([p[0], p[1], 0, r0*Math.sqrt(f)])];
    return conjugate(D, pole, rho);
}

//
//  the elliptic map with the fixed points p and the pole, turning by a at p:
//  J R J with R the turn by -a about p, two lines through p; the first goes
//  through the pole and stays a line
//
export function inversiveTurn(p, a, pole){
    if (!a) return null;
    let rho = 0, phi = 0, b = a;
    if (pole) {
        rho = distance(p, pole);
        if (!(rho > 0)) return null;
        phi = Math.atan2(pole[1] - p[1], pole[0] - p[0]);
        b = -a;
    }
    const R = [lineAt(p, phi), lineAt(p, phi + b/2)];
    return conjugate(R, pole, rho);
}
