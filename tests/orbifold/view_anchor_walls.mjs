/*
  The view anchor (lib/grouplib/ViewAnchor.js) with an orbifold's bounded walls.

    node tests/orbifold/view_anchor_walls.mjs

  An orbifold with a handle or a second crosscap has sides sharing one splane,
  told apart by bounds; with a twist its domain is not convex. The anchor folds
  the view's centre (and the view's disk) with its own loop over the sides, so
  it must cross a side only within its stretch, as Group.toFundDomain and the
  shaders' fold do.

  1. groupSides carries the bounds of the walls, [] for a group without them
  2. a far centre: the anchor maps it into the walled domain, and every pixel of
     a view round it folds from the anchor to the point its own fold reaches
     (Group.toFundDomain, which the shaders' fold agrees with:
     tests/orbifold/gpu_fold.html), for the centre alone and for the view's disk
  3. control: the same groups without their walls leave anchors short of the
     walled domain, or the test above proves nothing
*/

const realLog = console.log; console.log = () => {};
const grouplib = await import('../../lib/grouplib/grouplib.js');
const { Group_Orbifold } = await import('../../lib/orbilib/orbilib.js');
const { Group, iPoint } = await import('../../lib/invlib/invlib.js');
const { U4 } = await import('../../lib/invlib/U4.js');
console.log = realLog;

const { viewAnchorMath } = await import('../../lib/grouplib/modules.js');
const { makeViewAnchor } = grouplib;

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('  FAIL:', what);
}

const EPS = 1e-7;
const ITER = 200;

// the relaxation starts at random; about 1 in 100 twisted handles comes out with a
// pairing whose mirror has a zero normal (an open task in TASKS.md): built again
const brokenMirror = (group) => [...group.getTransforms(), ...group.getReverseTransforms()].some(t => t.some(s => s.v.every(x => x === 0)));

function makeGroup(name, twist){
    console.log = () => {};
    try {
        for (let attempt = 0; ; attempt++) {
            const maker = new Group_Orbifold({ orbifold: name });
            if (twist !== 0) {
                const p = { ...maker.getParamsMap() };
                Object.keys(p).filter(k => k.endsWith('_t')).forEach(k => p[k] = twist);
                maker.setParamsMap(p);
            }
            const group = maker.getGroup();
            if (!brokenMirror(group) || attempt === 5) return group;
        }
    } finally { console.log = realLog; }
}

// the group without its walls: every side its whole splane (the anchor before the bounds)
const flatGroup = g => new Group({ s: g.getFundDomain(), t: g.getReverseTransforms() });

// in the walled domain: no side is crossed (outside it, within its stretch)
function inWalledF(group, p){
    const pnt = iPoint([p[0], p[1]]);
    return group.getFundDomainWalls().every(w =>
        !(U4.sigDistanceSP(w[0], pnt) > EPS && Group.withinWallBounds(w, pnt)));
}

function foldCPU(group, p){
    const r = group.toFundDomain({ pnt: iPoint([p[0], p[1]]), maxIterations: ITER });
    return { inDomain: r.inDomain, p: [r.pnt.v[0], r.pnt.v[1]], steps: r.word.length };
}

// the shaders' applyAnchor (inversiveSampler.glsl.mjs), in double
function applyAnchorUniforms(U, p){
    let w = [p[0] - U.uAnchorCQ[0], p[1] - U.uAnchorCQ[1]];
    if (U.uAnchorAnti) w = [w[0], -w[1]];
    const A = [U.uAnchorAB[0], U.uAnchorAB[1]], B = [U.uAnchorAB[2], U.uAnchorAB[3]];
    const den = [A[0] + B[0]*w[0] - B[1]*w[1], A[1] + B[0]*w[1] + B[1]*w[0]];
    const dd = den[0]*den[0] + den[1]*den[1];
    return [U.uAnchorCQ[2] + (w[0]*den[0] + w[1]*den[1])/dd, U.uAnchorCQ[3] + (w[1]*den[0] - w[0]*den[1])/dd];
}

// a point at hyperbolic distance d from 0, and the Euclidean radius of a disk of
// hyperbolic radius h there (small h)
const diskPoint = (d, t) => { const r = Math.tanh(d/2); return [r*Math.cos(t), r*Math.sin(t)]; };
const euclidRadius = (c, h) => h*(1 - (c[0]*c[0] + c[1]*c[1]))/2;

const CASES = [['o33', 0.5], ['oo', 0.25], ['2xo', 0.25], ['234oo', 0.25], ['33333o', 0.25]];

console.log('1. the sides carry the bounds');
for (const [name, twist] of CASES) {
    const g = makeGroup(name, twist);
    const sides = viewAnchorMath.groupSides(g);
    const walls = g.getFundDomainWalls();
    check(!!sides, `${name}: the anchor can use the group`);
    if (!sides) continue;
    const bounded = sides.filter(s => s.bounds.length > 0).length;
    check(bounded === walls.filter(w => w.length > 1).length && bounded > 0, `${name}: ${bounded} sides with bounds`);
    check(sides.every((s, i) => s.bounds.length === walls[i].length - 1), `${name}: each side has its wall's bounds`);
    console.log(`  ${name.padEnd(7)} ${sides.length} sides, ${bounded} with bounds`);
}
{
    const g = makeGroup('*442', 0);
    const sides = viewAnchorMath.groupSides(g);
    check(sides && sides.every(s => s.bounds.length === 0), '*442: no bounds');
}

console.log('2. far centres: the anchor folds into the walled domain, pixels fold to the same points');
const N = 15;                      // pixels per row
const MAX_STEPS = 12;              // steps of an anchored pixel's fold (a view of radius 0.4)
for (const [name, twist] of CASES) {
    const group = makeGroup(name, twist);
    let maxSteps = 0;
    for (const d of [2, 4, 6]) {
        for (const t of [0.3, 2.1, 4.4]) {
            const c = diskPoint(d, t);
            const r = euclidRadius(c, 0.4);
            for (const useDisk of [false, true]) {
                const anchor = makeViewAnchor();
                anchor.update({ group, refPoint: c, viewDisk: useDisk ? { c, r } : null, enabled: true, maxSteps: 1e6, budgetMs: Infinity });
                const U = anchor.getUniforms();
                const tag = `${name} twist ${twist}, d ${d}, angle ${t}${useDisk ? ', disk' : ''}`;
                if (!useDisk) {
                    check(anchor.getWord().length > 0 || inWalledF(group, c), `${tag}: a centre outside the domain gives a word`);
                    check(inWalledF(group, anchor.mapPoint(c)), `${tag}: the anchor maps the centre into the walled domain`);
                }
                let worst = 0, count = 0, lost = 0, steps = 0;
                for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
                    const s = [2*i/(N - 1) - 1, 2*j/(N - 1) - 1];
                    if (s[0]*s[0] + s[1]*s[1] > 1) continue;
                    const p = [c[0] + r*s[0], c[1] + r*s[1]];
                    const direct = foldCPU(group, p);
                    const q = U.uAnchorEnabled ? applyAnchorUniforms(U, p) : p;
                    const anchored = foldCPU(group, q);
                    if (!direct.inDomain || !anchored.inDomain) { lost++; continue; }
                    count++;
                    steps = Math.max(steps, anchored.steps);
                    worst = Math.max(worst, Math.hypot(direct.p[0] - anchored.p[0], direct.p[1] - anchored.p[1]));
                }
                check(lost === 0, `${tag}: ${lost} pixels did not fold`);
                check(worst < 1e-6, `${tag}: pixels apart by ${worst}`);
                check(steps <= MAX_STEPS, `${tag}: anchored pixels take up to ${steps} steps`);
                maxSteps = Math.max(maxSteps, steps);
            }
        }
    }
    console.log(`  ${name.padEnd(7)} twist ${twist}: 9 centres at distances 2, 4, 6, alone and with the view's disk: anchored pixels fold to the same points, in up to ${maxSteps} steps`);
}

console.log('3. control: the groups without their walls');
{
    let short = 0, total = 0, slow = 0;
    for (const [name, twist] of CASES) {
        const group = makeGroup(name, twist);
        const flat = flatGroup(group);
        for (const d of [2, 4, 6]) for (const t of [0.3, 1.2, 2.1, 3.3, 4.4, 5.5]) {
            const c = diskPoint(d, t);
            const anchor = makeViewAnchor();
            anchor.update({ group: flat, refPoint: c, enabled: true, maxSteps: 2e4, budgetMs: Infinity });
            total++;
            const m = anchor.mapPoint(c);
            if (!m || !inWalledF(group, m)) short++;
            const U = anchor.getUniforms();
            const q = U.uAnchorEnabled ? applyAnchorUniforms(U, c) : c;
            const f = foldCPU(group, q);
            if (!f.inDomain || f.steps > MAX_STEPS) slow++;
        }
    }
    console.log(`  without the walls ${short}/${total} anchors leave the centre outside the walled domain, ${slow} more than ${MAX_STEPS} steps from it`);
    check(short > 0, 'the control bites');
}

console.log('');
if (failed) { console.log(`${failed} CHECKS FAILED`); process.exitCode = 1; }
else console.log('ALL CHECKS PASSED');
