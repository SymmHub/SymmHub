/*
  tests of the box of a fundamental domain (lib/grouplib/GeneratorElements.js
  domainBox), the frame of the group transform's handles in the Symmetry tool
  (docs/symmetry_tool_plan.md section 15, outside the repository)

    node tests/groups/domain_box.mjs

  1. the wallpaper groups: the box of the domain's polygon (domainPolygon's corners),
     exactly; the trivial group and no sides: null
  2. the domains whose polygon closes with curved sides (spherical, KLM, the
     orbifold): the box of the polygon with its arcs, to the sampling
  3. for every maker: points of the model folded into the domain lie in the box; the
     hyperbolic domains of the Poincare disk stay in the disk, those of the upper half
     plane above the axis (the region inside the sides has a mirror copy across the
     absolute, which the box leaves out)
  4. the unbounded domains are cut by the window: the friezes at |y| = 1, the
     spherical lunes (through infinity, the antipode) at the square of side 2, the
     cyclic group's annulus whole
*/

import {
    Group_WP, Group_Frieze, Group_Spherical, Group_KLM, Group_KLMN, Group_KLx,
    Group_5splanes, Group_6splanes, Group_Cyclic, Group_ON, Group_s22222, Group_22222, Group_s222222,
    domainPolygon, domainBox,
} from '../../lib/grouplib/grouplib.js';
import { Group_Orbifold } from '../../lib/orbilib/orbilib.js';
import { iPoint, SPLANE_PLANE } from '../../lib/invlib/invlib.js';

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
}
const fmt = (b) => b ? `[${b.map(x => x.toFixed(4)).join(', ')}]` : 'null';

// the makers print as they build: quiet
function quiet(fn) {
    const log = console.log, warn = console.warn;
    console.log = () => {}; console.warn = () => {};
    try { return fn(); } finally { console.log = log; console.warn = warn; }
}
const withParams = (make, values) => () => { const m = make(); Object.assign(m.params, values); if (m.onParamChanged) m.onParamChanged(); return m; };
const domainOf = (make) => quiet(() => make().getGroup());

// a deterministic sequence in [0, 1)
let seed = 12345;
const rnd = () => { seed = (seed*1103515245 + 12345) % 2147483648; return seed/2147483648; };

function addTo(box, p) {
    box[0] = Math.min(box[0], p[0]); box[1] = Math.min(box[1], p[1]);
    box[2] = Math.max(box[2], p[0]); box[3] = Math.max(box[3], p[1]);
}

/** the box of the domain's polygon, its arcs sampled finely (null when the polygon does not close) */
function polygonBox(fd) {
    const poly = domainPolygon(fd);
    if (!poly) return null;
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    poly.sides.forEach((s, k) => {
        const sp = fd[s.side];
        const a = poly.corners[s.from], b = poly.corners[s.to], m = poly.mids[k];
        addTo(box, a); addTo(box, b);
        if (sp.type === SPLANE_PLANE) return;
        const [cx, cy, , r] = sp.v;
        const R = Math.abs(r);
        const ang = (p) => Math.atan2(p[1] - cy, p[0] - cx);
        const norm = (d) => { while (d < 0) d += 2*Math.PI; while (d >= 2*Math.PI) d -= 2*Math.PI; return d; };
        const ta = ang(a);
        let span = norm(ang(b) - ta);
        if (norm(ang(m) - ta) > span) span -= 2*Math.PI;
        for (let i = 1; i < 2000; i++) {
            const t = ta + span*i/2000;
            addTo(box, [cx + R*Math.cos(t), cy + R*Math.sin(t)]);
        }
    });
    return box;
}

const sameBox = (a, b, eps) => !!a && !!b && a.every((x, i) => Math.abs(x - b[i]) <= eps);

// 1 ───────────────────────────────────────────────────────────────────────────

const WP_TYPES = ['O', '2222', '*2222', '2*22', '22*', '**', '*X', '22X', 'XX', '333', '*333', '3*3', '442', '*442', '4*2', '632', '*632'];
for (const type of WP_TYPES) {
    const fd = domainOf(() => new Group_WP({ type })).getFundDomain();
    const poly = domainPolygon(fd);
    const pb = [Infinity, Infinity, -Infinity, -Infinity];
    poly.corners.forEach(c => addTo(pb, c));
    const box = domainBox(fd);
    check(sameBox(box, pb, 1e-9), `WP ${type}: the box of the polygon (${fmt(box)}, ${fmt(pb)})`);
}
check(domainBox(domainOf(() => new Group_WP({ type: 'trivial' })).getFundDomain()) === null, 'the trivial group has no box');
check(domainBox([]) === null && domainBox(null) === null, 'no sides, no box');

// 2 ───────────────────────────────────────────────────────────────────────────

const CURVED = [
    ['spherical n*', () => new Group_Spherical({ type: 'n*', n: 5 })],
    ['spherical *22n', () => new Group_Spherical({ type: '*22n', n: 5 })],
    ['spherical 2*n', () => new Group_Spherical({ type: '2*n', n: 5 })],
    ['spherical 22n', () => new Group_Spherical({ type: '22n', n: 5 })],
    ['spherical *332', () => new Group_Spherical({ type: '*332' })],
    ['spherical 3*2', () => new Group_Spherical({ type: '3*2' })],
    ['spherical *432', () => new Group_Spherical({ type: '*432' })],
    ['spherical *532', () => new Group_Spherical({ type: '*532' })],
    ['spherical 532', () => new Group_Spherical({ type: '532' })],
    ['KLM 343', withParams(() => new Group_KLM(), { K: 3, L: 4, M: 3 })],
    ['KLM *237', withParams(() => new Group_KLM(), { K: 2, L: 3, M: 7, s: true })],
    ['KLM 3∞3', withParams(() => new Group_KLM(), { K: 3, L: 0, M: 3 })],
    ['orbifold', () => new Group_Orbifold()],
];
for (const [name, make] of CURVED) {
    const fd = domainOf(make).getFundDomain();
    const pb = polygonBox(fd);
    const box = domainBox(fd);
    check(!!pb, `${name}: the polygon closes`);
    if (pb) check(sameBox(box, pb, 1e-3), `${name}: the box of the polygon with its arcs (${fmt(box)}, ${fmt(pb)})`);
}

// 3 ───────────────────────────────────────────────────────────────────────────

// the models: the plane, the Poincare disk, the upper half plane
const PLANE = { name: 'plane', sample: () => [-3 + 6*rnd(), -3 + 6*rnd()], keep: () => true };
const DISK = { name: 'disk', sample: () => { const r = 0.98*Math.sqrt(rnd()), a = 2*Math.PI*rnd(); return [r*Math.cos(a), r*Math.sin(a)]; },
               keep: (b) => [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].every(p => Math.hypot(p[0], p[1]) <= 1 + 1e-9) };
const UHP = { name: 'upper half plane', sample: () => [-2 + 4*rnd(), 0.02 + 2.5*rnd()], keep: (b) => b[1] >= -1e-9 };
const STRIP = { name: 'strip', sample: () => [-3 + 6*rnd(), -1 + 2*rnd()], keep: (b) => b[1] >= -1 - 1e-9 && b[3] <= 1 + 1e-9 };

const FOLDED = [
    ...WP_TYPES.map(type => [`WP ${type}`, () => new Group_WP({ type }), PLANE]),
    ...['*22∞', '22∞', '2*∞', '∞*', '*∞∞', '∞x', '∞∞'].map(type => [`frieze ${type}`, () => new Group_Frieze({ type }), STRIP]),
    // (the lunes *nn, nn, nx run to the antipode, infinity: section 4)
    ...['n*', '*22n', '2*n', '22n', '*332', '332', '3*2', '*432', '432', '*532', '532']
        .map(type => [`spherical ${type}`, () => new Group_Spherical({ type, n: 5 }), PLANE]),
    ['KLM 343', withParams(() => new Group_KLM(), { K: 3, L: 4, M: 3 }), DISK],
    ['KLM 237', withParams(() => new Group_KLM(), { K: 2, L: 3, M: 7 }), DISK],
    ['KLM *237', withParams(() => new Group_KLM(), { K: 2, L: 3, M: 7, s: true }), DISK],
    ['KLMN', () => new Group_KLMN(), UHP],
    ['KLMN disk', withParams(() => new Group_KLMN(), { uhp: false }), DISK],
    ['KLx', () => new Group_KLx(), UHP],
    ['KLx disk', withParams(() => new Group_KLx(), { uhp: false }), DISK],
    ['5 splanes', () => new Group_5splanes(), UHP],
    ['6 splanes', () => new Group_6splanes(), UHP],
    ['cyclic', () => new Group_Cyclic(), PLANE],
    ['oN', () => new Group_ON(), DISK],
    ['s22222', () => new Group_s22222(), UHP],
    ['22222', () => new Group_22222(), UHP],
    ['s222222', () => new Group_s222222(), UHP],
];
const FOLD_POINTS = 200;
for (const [name, make, model] of FOLDED) {
    const group = domainOf(make);
    const fd = group.getFundDomain();
    const box = domainBox(fd);
    check(!!box, `${name}: a box`);
    if (!box) continue;
    check(model.keep(box), `${name}: the box keeps to the ${model.name} (${fmt(box)})`);
    const size = Math.max(1, box[2] - box[0], box[3] - box[1]);
    const tol = 2e-3*size;
    let inside = 0, out = null;
    for (let i = 0; i < FOLD_POINTS; i++) {
        const p = model.sample();
        const res = group.toFundDomain({ pnt: iPoint([p[0], p[1], 0, 0]), maxIterations: 1000 });
        if (!res || !res.inDomain || !res.pnt) continue;
        const q = [res.pnt.v[0], res.pnt.v[1]];
        if (!isFinite(q[0]) || !isFinite(q[1])) continue;
        inside++;
        if (q[0] < box[0] - tol || q[0] > box[2] + tol || q[1] < box[1] - tol || q[1] > box[3] + tol) { out = q; break; }
    }
    check(inside >= FOLD_POINTS/2, `${name}: points fold into the domain (${inside} of ${FOLD_POINTS})`);
    check(!out, `${name}: the folded points lie in the box ${fmt(box)}${out ? ', not ' + fmt(out) : ''}`);
}

// 4 ───────────────────────────────────────────────────────────────────────────

{
    const frieze = domainBox(domainOf(() => new Group_Frieze({ type: '22∞' })).getFundDomain());
    check(sameBox(frieze, [0, -1, 0.5, 1], 1e-6), `a frieze's strip is cut at |y| = 1 (${fmt(frieze)})`);
    const lune = domainBox(domainOf(() => new Group_Spherical({ type: '*nn', n: 5 })).getFundDomain());
    check(sameBox(lune, [0, 0, 1, Math.tan(Math.PI/5)], 1e-6), `a lune is cut by the window (${fmt(lune)})`);
    const cyclic = domainBox(domainOf(() => new Group_Cyclic()).getFundDomain());
    check(!!cyclic && Math.abs(cyclic[0] + cyclic[2]) < 1e-6 && Math.abs(cyclic[1] + cyclic[3]) < 1e-6 && cyclic[2] > 1,
          `the cyclic group's annulus whole, about the origin (${fmt(cyclic)})`);
    const klm = domainBox(domainOf(withParams(() => new Group_KLM(), { K: 2, L: 3, M: 7 })).getFundDomain());
    check(sameBox(klm, [0, -0.266, 0.141, 0.266], 1e-3), `KLM 237 in the disk (${fmt(klm)})`);
    // the window given
    const fd = domainOf(() => new Group_Frieze({ type: '22∞' })).getFundDomain();
    const wide = domainBox(fd, { window: 3 });
    check(sameBox(wide, [0, -3, 0.5, 3], 1e-6), `a window given cuts there (${fmt(wide)})`);
}

console.log(failed ? `${failed} FAILED` : 'all passed');
if (failed) process.exitCode = 1;
