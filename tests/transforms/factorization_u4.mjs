/*
  tests of the factorization in U4 (lib/invlib/FactorizationU4.js)

    node tests/transforms/factorization_u4.mjs

  1. iReflectSplaneU4 agrees with iReflectU4 (through H4) on splanes of moderate size,
     spheres, planes and points reflected in spheres and planes, orientation included
  2. iBisectorU4(t, e) takes t to e
  3. random transforms of 3 to 5 reflections in space: iFactorizeU4 gives at most 5
     reflections with the same action on points (the hyperbolic distance), and how far
     iGetFactorizationU4 is
  3b. random planar transforms of 2 to 13 reflections against the exact map (the Moebius
     matrix of the list)
  4. planar transforms near the identity (translations, turns, hyperbolic moves by
     1e-3 ... 1e-12): both against the exact map of the Moebius matrix
  5. long planar words (the reflections of the hyperbolic group 237 out to
     distance 20): both against the exact map
*/

import fs from 'node:fs';

const realLog = console.log; console.log = () => {};
const invlib = await import('../../lib/invlib/invlib.js');
const grouplib = await import('../../lib/grouplib/grouplib.js');
console.log = realLog;

const { iSphere, iPlane, iPoint, iReflectU4, iGetFactorizationU4, iReflectSplaneU4, iTransformSplaneU4, iBisectorU4, iFactorizeU4,
        SPLANE_SPHERE, SPLANE_PLANE, SPLANE_POINT } = invlib;
const { mirrorsToMap } = grouplib;
const { viewAnchorMath } = await import('../../lib/grouplib/modules.js');
const { applyMap } = viewAnchorMath;

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}

let seed = 11;
const rnd = () => { seed = (seed*16807) % 2147483647; return seed/2147483647; };
const between = (a, b) => a + (b - a)*rnd();

function randomSplane(planar){
    const z = planar ? 0 : between(-1, 1);
    if (rnd() < 0.6) return iSphere([between(-2, 2), between(-2, 2), z, (rnd() < 0.5 ? -1 : 1)*between(0.2, 2.5)]);
    const t = 2*Math.PI*rnd(), u = planar ? 0 : between(-1, 1);
    const l = Math.hypot(Math.cos(t), Math.sin(t), u);
    return iPlane([Math.cos(t)/l, Math.sin(t)/l, u/l, between(-1, 1)]);
}

// splanes apart: the centres (or normals) and radii (distances), relative to their size
function apart(a, b){
    if (a.type !== b.type) return Infinity;
    const s = Math.max(1, ...a.v.map(Math.abs));
    return Math.max(...a.v.map((x, i) => Math.abs(x - b.v[i])))/s;
}

// 1 ───────────────────────────────────────────────────────────────────────────

realLog('1. reflections in U4 against the reflections through H4');
{
    let worst = 0, n = 0;
    for (let k = 0; k < 3000; k++) {
        const p = randomSplane(false);
        const kind = k % 3;
        const x = kind === 0 ? iPoint([between(-2, 2), between(-2, 2), between(-2, 2), between(0.1, 2)]) : randomSplane(false);
        const a = iReflectSplaneU4(p, x);
        const b = iReflectU4(p, x);
        // the H4 path makes near planes of spheres larger than 1e8, skip those
        if (b.type === SPLANE_SPHERE && Math.abs(b.v[3]) > 1e6) continue;
        worst = Math.max(worst, apart(a, b));
        n++;
    }
    realLog(`  ${n} reflections: apart at most ${worst.toExponential(1)}`);
    check(worst < 1e-9, 'iReflectSplaneU4 is iReflectU4');
}

// 2 ───────────────────────────────────────────────────────────────────────────

realLog('2. the bisector takes one splane to the other');
{
    let worst = 0;
    for (let k = 0; k < 2000; k++) {
        let t, e;
        if (k % 2) {
            t = iPoint([between(-2, 2), between(-2, 2), between(-2, 2), between(0.1, 2)]);
            e = iPoint([0, 0, 0, 1]);
        } else {
            // hyperplanes through the point above the origin: spheres with |c|^2 + 1 = r^2, planes through 0
            const one = () => {
                if (rnd() < 0.5) { const c = [between(-2, 2), between(-2, 2), between(-2, 2)]; return iSphere([...c, (rnd() < 0.5 ? -1 : 1)*Math.sqrt(1 + c[0]*c[0] + c[1]*c[1] + c[2]*c[2])]); }
                const n = [between(-1, 1), between(-1, 1), between(-1, 1)], l = Math.hypot(...n);
                return iPlane([n[0]/l, n[1]/l, n[2]/l, 0]);
            };
            t = one(); e = one();
        }
        const b = iBisectorU4(t, e);
        if (!b) { worst = Infinity; continue; }
        worst = Math.max(worst, apart(iReflectSplaneU4(b, t), e));
    }
    realLog(`  2000 pairs: the image apart at most ${worst.toExponential(1)}`);
    check(worst < 1e-9, 'iBisectorU4 takes t to e');
}

// points of space to compare transforms by: in the upper half space and on the boundary
const probes = planar => Array.from({ length: 16 }, (_, k) => iPoint([between(-1.5, 1.5), between(-1.5, 1.5), planar ? 0 : between(-1.5, 1.5), k < 8 ? between(0.2, 1.5) : 0]));
function actionApart(A, B, pts){
    let w = 0;
    for (const p of pts) {
        const a = iTransformSplaneU4(A, p), b = iTransformSplaneU4(B, p);
        const s = 1 + Math.hypot(...a.v);
        w = Math.max(w, Math.hypot(a.v[0] - b.v[0], a.v[1] - b.v[1], a.v[2] - b.v[2], a.v[3] - b.v[3])/s);
    }
    return w;
}

// 3 ───────────────────────────────────────────────────────────────────────────

realLog('3. random transforms in space, 3 to 5 reflections');
{
    // apart in the hyperbolic metric of the upper half space (cosh d - 1 = |a - b|^2/(2 wa wb)):
    // longer random lists squash space so that the transform's own chains differ (U4 and H4)
    const hd = (a, b) => Math.sqrt(a.v.reduce((s, x, i) => s + (x - b.v[i])**2, 0)/(2*a.v[3]*b.v[3]));
    let worstNew = 0, worstOld = 0, most = 0;
    for (let k = 0; k < 600; k++) {
        const n = 3 + (k % 3);
        const T = Array.from({ length: n }, () => randomSplane(false));
        const f = iFactorizeU4(T), g = iGetFactorizationU4(T);
        most = Math.max(most, f.length);
        for (const p of probes(false).slice(0, 8)) {
            const a = iTransformSplaneU4(T, p);
            worstNew = Math.max(worstNew, hd(a, iTransformSplaneU4(f, p)));
            worstOld = Math.max(worstOld, hd(a, iTransformSplaneU4(g, p)));
        }
    }
    realLog(`  600 transforms: iFactorizeU4 at most ${most} reflections, apart at most ${worstNew.toExponential(1)}; iGetFactorizationU4 ${worstOld.toExponential(1)}`);
    check(most <= 5 && worstNew < 1e-8, 'iFactorizeU4 keeps the action in at most 5 reflections');
}

// the exact planar action: the Moebius matrix of the list
function planarApart(T, f){
    const M = mirrorsToMap(T), F = mirrorsToMap(f);
    let w = 0;
    for (const p of [[0, 0], [0.3, -0.2], [-0.6, 0.5], [0.9, 0.1], [-0.2, -0.8], [1.7, 1.1]]) {
        const a = applyMap(M, p), b = applyMap(F, p);
        w = Math.max(w, Math.hypot(a[0] - b[0], a[1] - b[1])/(1 + Math.hypot(a[0], a[1])));
    }
    return w;
}

// 3b ──────────────────────────────────────────────────────────────────────────

realLog('3b. random planar transforms, against the exact map');
{
    let worstNew = 0, worstOld = 0, most = 0;
    for (let k = 0; k < 600; k++) {
        const n = 2 + (k % 12);
        const T = Array.from({ length: n }, () => randomSplane(true));
        const f = iFactorizeU4(T);
        most = Math.max(most, f.length);
        worstNew = Math.max(worstNew, planarApart(T, f));
        worstOld = Math.max(worstOld, planarApart(T, iGetFactorizationU4(T)));
    }
    realLog(`  600 transforms of 2 to 13 reflections: iFactorizeU4 at most ${most} reflections, apart at most ${worstNew.toExponential(1)}; iGetFactorizationU4 ${worstOld.toExponential(1)}`);
    check(most <= 5 && worstNew < 1e-11, 'iFactorizeU4 keeps a planar map in at most 5 reflections');
}

// 4 ───────────────────────────────────────────────────────────────────────────

realLog('4. planar transforms near the identity, against the exact map');
{
    // the reflection in the hyperbolic line through p (|p| < 1) across the line 0p
    const disk = p => {
        const r = Math.hypot(p[0], p[1]);
        if (r === 0) return [];
        const s = Math.tanh(Math.atanh(r)/2), u = [p[0]/r, p[1]/r];
        const c = (1 + s*s)/(2*s), R = (1 - s*s)/(2*s);
        return [iPlane([u[0], u[1], 0, 0]), iSphere([c*u[0], c*u[1], 0, R])];
    };
    const rows = [];
    let worstNew = 0;
    for (const d of [1e-3, 1e-6, 1e-9, 1e-12]) {
        const moves = {
            translation: [iPlane([1, 0, 0, 0.3]), iPlane([1, 0, 0, 0.3 + d/2])],
            turn: [iPlane([1, 0, 0, 0.2]), iPlane([Math.cos(d/2), Math.sin(d/2), 0, 0.2*Math.cos(d/2) + 0.1*Math.sin(d/2)])],
            hyperbolic: [...disk([-0.2, 0.1]), ...disk([-0.2 + d, 0.1])],
            // a hyperbolic move after a fixed transform: the navigator's frame step
            framed: [...disk([0.4, 0.3]), ...disk([0.4 - d, 0.3]), iPlane([0.6, 0.8, 0, 0.1]), iSphere([1.2, -0.3, 0, 0.7])],
        };
        const row = [`d ${d.toExponential(0)}`];
        for (const [name, T] of Object.entries(moves)) {
            const a = planarApart(T, iFactorizeU4(T)), b = planarApart(T, iGetFactorizationU4(T));
            worstNew = Math.max(worstNew, a);
            row.push(`${name} ${a.toExponential(0)} (old ${b.toExponential(0)})`);
        }
        rows.push(row.join(', '));
    }
    for (const r of rows) realLog('  ' + r);
    check(worstNew < 1e-9, 'iFactorizeU4 near the identity');
}

// 5 ───────────────────────────────────────────────────────────────────────────

realLog('5. long planar words: the hyperbolic group 237 out to distance 20');
{
    console.log = () => {};
    const doc = JSON.parse(fs.readFileSync(new URL('../../apps/symdraw/presets/klm/symdraw-237-kites-7-colors.json', import.meta.url), 'utf8'));
    const sym = doc.params.symmetry;
    const maker = new grouplib[sym.group.className]();
    if (typeof maker.setParamsMap === 'function') maker.setParamsMap(sym.group.params);
    else Object.assign(maker.params, sym.group.params);
    const group = maker.getGroup();
    console.log = realLog;
    const sides = viewAnchorMath.groupSides(group);
    const rows = [];
    let worstNew = 0;
    for (const d of [5, 10, 20]) {
        const a = grouplib.makeViewAnchor();
        const r = Math.tanh(d/2);
        a.update({ group, refPoint: [0.6*r, 0.8*r], enabled: true, budgetMs: Infinity, maxSteps: 1e6 });
        // the reflections of the word's sides, word[0] applied first
        const T = [];
        for (const g of a.getWord()) T.push(...sides[g].refs);
        const nw = planarApart(T, iFactorizeU4(T)), od = planarApart(T, iGetFactorizationU4(T));
        worstNew = Math.max(worstNew, nw);
        rows.push(`distance ${d}: ${T.length} reflections, apart ${nw.toExponential(1)} (old ${od.toExponential(1)})`);
    }
    for (const r of rows) realLog('  ' + r);
    check(worstNew < 1e-9, 'iFactorizeU4 of long words');
}

realLog(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
