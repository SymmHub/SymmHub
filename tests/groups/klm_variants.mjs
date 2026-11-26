/*
  tests for KLM (3 variants) and KLMN (4 variants) union fundamental domains
  (the `type` parameter on Group_KLM and Group_KLMN).

    node tests/groups/klm_variants.mjs

  1. parameter defaults, ParamChoice metadata, serialization and legacy presets
  2. union geometry: each type joins the base *KLM triangle or *KLMN quad with its
     reflection across a distinct side (type '0' keeps the original join)
  3. group equivalence: all 3 KLM types and all 4 KLMN types generate the exact same
     orientation-preserving group (in UHP, disk, bent, and twisted where applicable)
  4. presentations & colour-fold consistency: every relator holds on the side transforms
     and every subgroup of small index folds with no colour seams (with/without useOrbit)
  5. handles, generator elements, and tiles work across all variants
*/

import {
    Group_KLM,
    Group_KLMN,
    groupPresentation,
    subgroupTable,
    entryPermutations,
    checkPermutations,
    presentationSpec,
} from '../../lib/grouplib/modules.js';
import { sideDistance } from '../../lib/grouplib/GroupHandles.js';
import { generatorElements } from '../../lib/grouplib/GeneratorElements.js';
import { composePerms, strToPermutations, sidePermutations } from '../../lib/grouplib/Permutations.js';
import { tileFromDomain } from '../../lib/drawlib/Tiles.js';
import { getParamValues, setParamValues } from '../../lib/uilib/uilib.js';
import { ITransform, iPoint, iReflectU4, U4 } from '../../lib/invlib/invlib.js';
import { makePresentation } from '../../lib/sublib/src/sublib.js';

const quiet = console.log;
console.log = () => {};
console.warn = () => {};
const say = (...a) => quiet(...a);

let failures = 0, checks = 0;
function check(ok, msg) { checks++; if (!ok) { failures++; say('  FAIL:', msg); } return ok; }

const POINTS = [iPoint([0.12345, 0.06789, 0, 0]), iPoint([-0.07211, 0.16183, 0, 0])];
const GRID = 1e6;
const keyOf = (points) => points.map(p => [0, 1, 2].map(i => Math.round(p.v[i] * GRID)).join(',')).join(';');
const ptKey = (p) => [0, 1, 2].map(i => Math.round(p.v[i] * 1e5)).join(',');
const idMap = { map: (x, y) => [x, y], inverse: { map: (x, y) => [x, y] } };

function isStrictlyInside(splanes, p, eps = 1e-6) {
    return splanes.every(s => U4.sigDistanceSP(s, p) < -eps);
}

function isStrictlyOutside(splanes, p, eps = 1e-6) {
    return splanes.some(s => U4.sigDistanceSP(s, p) > eps);
}

function orbit(group, start, limit = 200) {
    const gens = group.getTransforms().map((t, i) => new ITransform(t.slice(), 'g' + i));
    const seen = new Map([[ptKey(start), start]]);
    const q = [start];
    for (let i = 0; i < q.length && seen.size < limit; i++) {
        for (const g of gens) {
            const np = g.transform(q[i]);
            const k = ptKey(np);
            if (!seen.has(k)) {
                seen.set(k, np);
                q.push(np);
                if (seen.size >= limit) break;
            }
        }
    }
    return seen;
}

function sameGroup(g0, gk, label) {
    const p0 = POINTS[0];
    const orb0 = orbit(g0, p0, 250);
    const orbK = orbit(gk, p0, 250);
    const gens0 = g0.getTransforms().map((t, i) => new ITransform(t.slice(), 'a' + i));
    const gensK = gk.getTransforms().map((t, i) => new ITransform(t.slice(), 'b' + i));
    const fwd = gensK.every(g => orb0.has(ptKey(g.transform(p0))));
    const bwd = gens0.every(g => orbK.has(ptKey(g.transform(p0))));
    check(fwd && bwd, `${label}: generates the same group as type '0'`);
}

function foldPlaces(steps, maxPlaces) {
    const places = [{ parent: -1, side: -1, points: POINTS, ref: [] }];
    const byKey = new Map([[keyOf(POINTS), [0]]]);
    const loops = [];
    const sameIso = (ref1, ref2) => {
        const diff = new ITransform(ref1.concat(ref2.slice().reverse()), '');
        return POINTS.every(p => {
            const q = diff.transform(p);
            return Math.hypot(q.v[0] - p.v[0], q.v[1] - p.v[1], q.v[2] - p.v[2]) < 1e-5;
        });
    };
    for (let at = 0; at < places.length; at++) {
        for (let side = 0; side < steps.length; side++) {
            const points = places[at].points.map(p => steps[side].transform(p));
            const ref = places[at].ref.concat(steps[side].ref);
            const key = keyOf(points);
            const bucket = byKey.get(key);
            const known = bucket ? bucket.find(idx => sameIso(ref, places[idx].ref)) : undefined;
            if (known !== undefined) {
                loops.push({ from: at, side, to: known });
            } else if (places.length < maxPlaces) {
                if (bucket) bucket.push(places.length);
                else byKey.set(key, [places.length]);
                places.push({ parent: at, side, points, ref });
            }
        }
    }
    return { places, loops };
}

function colourSeam(fold, perms, useOrbit) {
    const size = perms[0].length;
    const step = (current, side) => useOrbit ? composePerms(perms[side], current) : composePerms(current, perms[side]);
    const at = new Array(fold.places.length);
    at[0] = Array.from({ length: size }, (_, i) => i);
    for (let i = 1; i < fold.places.length; i++) at[i] = step(at[fold.places[i].parent], fold.places[i].side);
    return fold.loops.find(({ from, side, to }) => step(at[from], side).join() !== at[to].join()) || null;
}

function checkPresentationAndSeams(maker, label, { maxIndex = 5, maxPlaces = 150, tolerance = 1e-6 } = {}) {
    const pres = maker.getPresentation();
    if (!check(!!pres, `${label}: has presentation`)) return null;
    const group = maker.getGroup();
    const steps = group.getReverseITransforms();
    const spec = presentationSpec(pres);
    const parsed = makePresentation(spec.gens, spec.relators);
    check(parsed.gens.length === group.getFundDomain().length, `${label}: ${parsed.gens.length} gens for ${group.getFundDomain().length} sides`);

    const names = group.getGenNames();
    const sides = group.getTransforms().map((t, i) => new ITransform(t.slice(), names[i]));
    for (let r = 0; r < parsed.relators.length; r++) {
        let t = new ITransform([], '');
        for (const x of parsed.relators[r]) {
            const g = sides[Math.abs(x) - 1];
            t = t.concat(x > 0 ? g : g.getInverse());
        }
        check(POINTS.every(p => {
            const q = t.transform(p);
            return Math.hypot(q.v[0] - p.v[0], q.v[1] - p.v[1], q.v[2] - p.v[2]) < tolerance;
        }), `${label}: relator ${parsed.relStrings[r]}`);
    }

    const fold = foldPlaces(steps, maxPlaces);
    const table = subgroupTable(pres, { maxIndex });
    for (const entry of table.subgroups) {
        for (const useOrbit of [false, true]) {
            const str = entryPermutations(pres, entry, useOrbit);
            check(checkPermutations(pres, str, useOrbit).ok, `${label} ${entry.subgroup}: fits (useOrbit ${useOrbit})`);
            const perms = sidePermutations(group, strToPermutations(str), useOrbit);
            const seam = colourSeam(fold, perms, useOrbit);
            check(!seam, `${label} ${entry.subgroup}: no colour seam (useOrbit ${useOrbit})`);
        }
    }
    return table;
}

function centroidOfCorners(maker) {
    const pts = maker.getHandles().filter(h => h.kind === 'order').map(h => h.at()).filter(Boolean);
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return iPoint([cx, cy, 0, 0]);
}

// -----------------------------------------------------------------------------
say('1. parameters, defaults, and serialization');
{
    const klm = new Group_KLM();
    check(klm.params.type === '0', 'Group_KLM default type is "0"');
    check(typeof klm.getParams().type?.getValue === 'function', 'Group_KLM exposes type param');
    check(getParamValues(klm.getParams()).type === '0', 'Group_KLM serializes default type "0"');
    setParamValues(klm.getParams(), { K: 2, L: 3, M: 7, type: '2' });
    check(klm.params.type === '2' && getParamValues(klm.getParams()).type === '2', 'Group_KLM setParamValues/getParamValues round-trip');
    // numeric value accepted safely
    klm.params.type = 1;
    check(klm.getPresentation().label === '237 [1]', 'Group_KLM handles numeric type value');
    // legacy preset without type keeps default '0'
    const klmLegacy = new Group_KLM();
    setParamValues(klmLegacy.getParams(), { K: 2, L: 3, M: 7, s: false, hasR: false });
    check(klmLegacy.params.type === '0' && klmLegacy.getPresentation().label === '237', 'Group_KLM legacy preset defaults to type "0"');

    const klmn = new Group_KLMN();
    check(klmn.params.type === '0', 'Group_KLMN default type is "0"');
    check(typeof klmn.getParams().type?.getValue === 'function', 'Group_KLMN exposes type param');
    check(getParamValues(klmn.getParams()).type === '0', 'Group_KLMN serializes default type "0"');
    setParamValues(klmn.getParams(), { K: 2, L: 3, M: 4, N: 5, type: '3' });
    check(klmn.params.type === '3' && getParamValues(klmn.getParams()).type === '3', 'Group_KLMN setParamValues/getParamValues round-trip');
    klmn.params.type = 2;
    check(klmn.getPresentation().label === '2345 [2]', 'Group_KLMN handles numeric type value');
    const klmnLegacy = new Group_KLMN();
    setParamValues(klmnLegacy.getParams(), { K: 3, L: 2, M: 2, N: 2, s: false });
    check(klmnLegacy.params.type === '0' && klmnLegacy.getPresentation().label === '3222', 'Group_KLMN legacy preset defaults to type "0"');

    // *KLM and *KLMN (s: true) are unaffected by type
    const sklm0 = new Group_KLM({ K: 2, L: 3, M: 7, s: true, type: '0' });
    const sklm2 = new Group_KLM({ K: 2, L: 3, M: 7, s: true, type: '2' });
    check(JSON.stringify(sklm0.getGroup().getFundDomain()) === JSON.stringify(sklm2.getGroup().getFundDomain()), '*KLM domain independent of type');
    check(sklm0.getPresentation().label === sklm2.getPresentation().label, '*KLM presentation label independent of type');

    const sklmn0 = new Group_KLMN({ K: 2, L: 3, M: 4, N: 5, s: true, type: '0' });
    const sklmn3 = new Group_KLMN({ K: 2, L: 3, M: 4, N: 5, s: true, type: '3' });
    check(JSON.stringify(sklmn0.getGroup().getFundDomain()) === JSON.stringify(sklmn3.getGroup().getFundDomain()), '*KLMN domain independent of type');
    check(sklmn0.getPresentation().label === sklmn3.getPresentation().label, '*KLMN presentation label independent of type');
}

// -----------------------------------------------------------------------------
say('2. union geometry: distinct joins across each side');
{
    // KLM: 345 triangle has interior point p; type i joins across tri[i]
    const baseKlm = new Group_KLM({ K: 3, L: 4, M: 5, s: true });
    const tri = baseKlm.getFD();
    const pTri = centroidOfCorners(baseKlm);
    check(isStrictlyInside(tri, pTri), 'KLM 345 centroid is inside base triangle');
    const refTri = tri.map(side => iReflectU4(side, pTri));
    for (let i = 0; i < 3; i++) {
        const g = new Group_KLM({ K: 3, L: 4, M: 5, s: false, type: String(i) }).getGroup();
        const fd = g.getFundDomain();
        check(isStrictlyInside(fd, pTri), `KLM 345 type ${i}: contains base triangle`);
        for (let j = 0; j < 3; j++) {
            if (j === i) {
                check(isStrictlyInside(fd, refTri[j]), `KLM 345 type ${i}: contains reflection across side ${j}`);
            } else {
                check(isStrictlyOutside(fd, refTri[j]), `KLM 345 type ${i}: excludes reflection across side ${j}`);
            }
        }
    }

    // KLMN: 3456 quad has interior point p; type 0 -> S2 (s[1]), 1 -> S1 (s[0]), 2 -> S3 (s[2]), 3 -> S4 (s[3])
    const baseKlmn = new Group_KLMN({ K: 3, L: 4, M: 5, N: 6, s: true });
    const quad = baseKlmn.getFD_sKLMN().s;
    const pQuad = iPoint([0, 0.75, 0, 0]);
    check(isStrictlyInside(quad, pQuad), 'KLMN 3456 interior point is inside base quad');
    const refQuad = quad.map(side => iReflectU4(side, pQuad));
    const joinSideIndex = [1, 0, 2, 3]; // type '0' -> S2 (index 1), '1' -> S1 (0), '2' -> S3 (2), '3' -> S4 (3)
    for (let i = 0; i < 4; i++) {
        const g = new Group_KLMN({ K: 3, L: 4, M: 5, N: 6, s: false, type: String(i) }).getGroup();
        const fd = g.getFundDomain();
        check(isStrictlyInside(fd, pQuad), `KLMN 3456 type ${i}: contains base quad`);
        for (let j = 0; j < 4; j++) {
            if (j === joinSideIndex[i]) {
                check(isStrictlyInside(fd, refQuad[j]), `KLMN 3456 type ${i}: contains reflection across quad side ${j}`);
            } else {
                check(isStrictlyOutside(fd, refQuad[j]), `KLMN 3456 type ${i}: excludes reflection across quad side ${j}`);
            }
        }
    }
}

// -----------------------------------------------------------------------------
say('3. Group_KLM: group equivalence, presentations, and colour-fold seams');
{
    const cases = [
        [2, 3, 7], [3, 4, 5], [2, 4, 5],
        [2, 3, 6], [2, 4, 4], [3, 3, 3], // Euclidean
        [2, 3, 5], [2, 3, 3], [2, 2, 5], // Spherical
        [2, 3, 0], [2, 4, 20], [0, 3, 4], // Ideal
    ];
    for (const [K, L, M] of cases) {
        const g0 = new Group_KLM({ K, L, M, s: false, type: '0' }).getGroup();
        let refCounts = null;
        for (const type of ['0', '1', '2']) {
            const m = new Group_KLM({ K, L, M, s: false, type });
            const label = `KLM ${K}${L}${M} [${type}]`;
            sameGroup(g0, m.getGroup(), label);
            const table = checkPresentationAndSeams(m, label, { maxIndex: 5, maxPlaces: 150 });
            const derived = groupPresentation(m.getGroup());
            const counts = table.subgroups.map(e => e.index).join();
            const dCounts = subgroupTable(derived, { maxIndex: 5 }).subgroups.map(e => e.index).join();
            check(counts === dCounts, `${label}: matches derived presentation subgroup counts`);
            if (refCounts === null) refCounts = counts;
            else check(counts === refCounts, `${label}: same subgroup counts as type '0'`);
        }
    }
}

// -----------------------------------------------------------------------------
say('4. Group_KLMN: group equivalence, presentations, twist, bend, disk, and seams');
{
    const cases = [
        { K: 3, L: 2, M: 2, N: 2, uhp: true, bend: 0 },
        { K: 3, L: 2, M: 2, N: 2, uhp: false, bend: 0 },
        { K: 3, L: 2, M: 2, N: 2, uhp: true, bend: 20 },
        { K: 2, L: 3, M: 4, N: 5, uhp: true, bend: 0 },
        { K: 2, L: 3, M: 4, N: 5, uhp: false, bend: 0 },
        { K: 3, L: 3, M: 3, N: 3, uhp: true, bend: 0 },
        { K: 0, L: 3, M: 2, N: 2, uhp: true, bend: 0 },
        { K: 2, L: 2, M: 3, N: 2, uhp: true, bend: 0 },
    ];
    for (const cfg of cases) {
        const g0 = new Group_KLMN({ ...cfg, s: false, type: '0' }).getGroup();
        let refCounts = null;
        for (const type of ['0', '1', '2', '3']) {
            const m = new Group_KLMN({ ...cfg, s: false, type });
            const label = `KLMN ${cfg.K}${cfg.L}${cfg.M}${cfg.N}${cfg.uhp ? '' : ' disk'}${cfg.bend ? ' bend' : ''} [${type}]`;
            sameGroup(g0, m.getGroup(), label);
            const table = checkPresentationAndSeams(m, label, { maxIndex: 3, maxPlaces: 120 });
            const counts = table.subgroups.map(e => e.index).join();
            if (refCounts === null) refCounts = counts;
            else check(counts === refCounts, `${label}: same subgroup counts as type '0'`);
        }
    }

    // Twisted KLMN: M=N=2 -> types 0, 1, 2 give the exact same twisted group
    for (const cfg of [
        { K: 3, L: 2, M: 2, N: 2, twist: 0.3, bend: 0, aspect: 0.5, uhp: true },
        { K: 3, L: 2, M: 2, N: 2, twist: 0.3, bend: 20, aspect: 0.7, uhp: true },
        { K: 3, L: 2, M: 2, N: 2, twist: 0.3, bend: 0, aspect: 0.5, uhp: false },
    ]) {
        const g0 = new Group_KLMN({ ...cfg, s: false, type: '0' }).getGroup();
        for (const type of ['0', '1', '2']) {
            const m = new Group_KLMN({ ...cfg, s: false, type });
            const label = `KLMN twisted${cfg.uhp ? '' : ' disk'}${cfg.bend ? ' bend' : ''} [${type}]`;
            sameGroup(g0, m.getGroup(), label);
            checkPresentationAndSeams(m, label, { maxIndex: 3, maxPlaces: 120 });
        }
        check(new Group_KLMN({ ...cfg, s: false, type: '3' }).getPresentation() === null,
              'KLMN twisted type 3 with K!=2 returns null presentation');
    }

    // Twisted KLMN type 3 with K=L=2
    const m3 = new Group_KLMN({ K: 2, L: 2, M: 3, N: 2, twist: 0.3, s: false, type: '3' });
    checkPresentationAndSeams(m3, 'KLMN 2232 twisted [3]', { maxIndex: 3, maxPlaces: 120 });
    for (const type of ['0', '1', '2']) {
        check(new Group_KLMN({ K: 2, L: 2, M: 3, N: 2, twist: 0.3, s: false, type }).getPresentation() === null,
              `KLMN 2232 twisted type ${type} with M!=2 returns null presentation`);
    }
}

// -----------------------------------------------------------------------------
say('5. handles, generator elements, and tiles');
{
    function checkHandlesOnDomain(maker, label) {
        const fd = maker.getGroup().getFundDomain();
        for (const h of maker.getHandles().filter(h => h.kind === 'order')) {
            const p = h.at();
            const d = fd.map(s => sideDistance(s, p));
            const tol = 1e-6 * (1 + Math.hypot(p[0], p[1]));
            const on = d.filter(x => Math.abs(x) <= tol).length;
            const out = d.filter(x => x > tol).length;
            check(on >= 2 && out === 0, `${label} handle ${h.id}: sits at a corner of the domain`);
        }
    }

    for (const [K, L, M] of [[2, 3, 7], [3, 4, 5], [2, 3, 6], [2, 3, 5]]) {
        for (const type of ['0', '1', '2']) {
            const m = new Group_KLM({ K, L, M, s: false, type });
            const label = `KLM ${K}${L}${M} [${type}]`;
            checkHandlesOnDomain(m, label);
            const g = m.getGroup();
            check(!!generatorElements({ group: g }), `${label}: generatorElements`);
            check(!!tileFromDomain(g, idMap), `${label}: tileFromDomain`);
        }
    }

    for (const uhp of [true, false]) {
        for (const type of ['0', '1', '2', '3']) {
            const m = new Group_KLMN({ K: 3, L: 2, M: 4, N: 5, aspect: 0.4, uhp, s: false, type });
            const label = `KLMN 3245${uhp ? '' : ' disk'} [${type}]`;
            checkHandlesOnDomain(m, label);
            const g = m.getGroup();
            check(!!generatorElements({ group: g }), `${label}: generatorElements`);
            check(!!tileFromDomain(g, idMap), `${label}: tileFromDomain`);
        }
    }
}

say(`\n${checks} checks: ${failures ? `${failures} FAILED` : 'ALL PASSED'}`);
process.exit(failures ? 1 : 0);
