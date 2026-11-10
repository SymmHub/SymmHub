/*
  test for the presentations of the group makers (getPresentation), against the group
  drawn: every maker, its discrete parameters, and the groups of the shipped documents.

    node tests/groups/presentations.mjs

  1. a generator per side of the fundamental domain
  2. every relator is the identity on the transforms of the sides
  3. consistency: points are folded across the sides the way the shaders do, and two
     ways to the same place have the same colour permutation, for every subgroup of
     small index, read as the layer takes it, with and without useOrbit

  The relators alone cannot prove a presentation complete: without a relator of the
  group a table has subgroups which are not subgroups of it, and those show here the
  way they show on the screen, as a seam between colours.

  A Dirichlet domain has the sides of the words of its generators, and the permutations
  go to them through sidePermutations; 1 and 2 are for the carrier group there.
*/

import fs from 'node:fs';
import path from 'node:path';

import {
    Group_WP, Group_KLM, GroupMakerFactory, groupPresentation, subgroupTable, entryPermutations,
    checkPermutations, presentationSpec,
} from '../../lib/grouplib/modules.js';
import { WallpaperGroupNames, getWallpaperDomainShapes } from '../../lib/grouplib/WallpaperGroups.js';
import { composePerms, strToPermutations, sidePermutations } from '../../lib/grouplib/Permutations.js';
import { setParamValues } from '../../lib/uilib/uilib.js';
import { ITransform, iPoint } from '../../lib/invlib/invlib.js';
import { makePresentation } from '../../lib/sublib/src/sublib.js';

const quiet = console.log;
console.log = () => {};
console.warn = () => {};
const say = (...a) => quiet(...a);

const MAX_INDEX = 6;            // the subgroups checked
const MAX_PLACES = 400;         // the places a test point is folded to
const GRID = 1e6;               // two places are the same when they round alike

let failures = 0;
function check(ok, msg) { if (!ok) { failures++; say('  FAIL:', msg); } return ok; }

const POINTS = [iPoint([0.12345, 0.06789, 0, 0]), iPoint([-0.07211, 0.16183, 0, 0])];

const keyOf = (points) => points.map(p => [0, 1, 2].map(i => Math.round(p.v[i] * GRID)).join(',')).join(';');

/**
 * the test points folded across the sides as far as MAX_PLACES: a spanning tree of
 * the places, {parent, side} for each, and the steps which close a loop
 */
function foldPlaces(steps, maxPlaces) {
    const places = [{ parent: -1, side: -1, points: POINTS }];
    const byKey = new Map([[keyOf(POINTS), 0]]);
    const loops = [];
    for (let at = 0; at < places.length; at++) {
        for (let side = 0; side < steps.length; side++) {
            const points = places[at].points.map(p => steps[side].transform(p));
            const key = keyOf(points);
            const known = byKey.get(key);
            if (known !== undefined) {
                loops.push({ from: at, side, to: known });
            } else if (places.length < maxPlaces) {
                byKey.set(key, places.length);
                places.push({ parent: at, side, points });
            }
        }
    }
    return { places, loops };
}

/** what a fold accumulates along the tree, and whether every loop closes */
function colourSeam(fold, perms, useOrbit) {
    const size = perms[0].length;
    const step = (current, side) => useOrbit ? composePerms(perms[side], current) : composePerms(current, perms[side]);
    const at = new Array(fold.places.length);
    at[0] = Array.from({ length: size }, (_, i) => i);
    for (let i = 1; i < fold.places.length; i++) at[i] = step(at[fold.places[i].parent], fold.places[i].side);
    return fold.loops.find(({ from, side, to }) => step(at[from], side).join() !== at[to].join()) || null;
}

let tally = { groups: 0, entries: 0, loops: 0 };

function checkMaker(maker, label, { maxIndex = MAX_INDEX, maxPlaces = MAX_PLACES, tolerance = 1e-6 } = {}) {
    const pres = maker.getPresentation();
    if (!check(!!pres, `${label}: a presentation`)) return;
    const group = maker.getGroup();
    const steps = group.getReverseITransforms();
    const spec = presentationSpec(pres);
    const parsed = makePresentation(spec.gens, spec.relators);
    tally.groups++;

    if (!group.dirichletWords) {
        check(parsed.gens.length === group.getFundDomain().length, `${label}: ${parsed.gens.length} generators for ${group.getFundDomain().length} sides`);
        if (parsed.gens.length !== steps.length) return;

        const names = group.getGenNames();
        const sides = group.getTransforms().map((t, i) => new ITransform(t.slice(), names[i]));
        for (let r = 0; r < parsed.relators.length; r++) {
            let t = new ITransform([], '');
            for (const x of parsed.relators[r]) {
                const g = sides[Math.abs(x) - 1];
                t = t.concat(x > 0 ? g : g.getInverse());
            }
            check(POINTS.every(p => { const q = t.transform(p); return Math.hypot(q.v[0] - p.v[0], q.v[1] - p.v[1], q.v[2] - p.v[2]) < tolerance; }),
                  `${label}: the relator ${parsed.relStrings[r]}`);
        }
    }

    const fold = foldPlaces(steps, maxPlaces);
    tally.loops += fold.loops.length;
    const table = subgroupTable(pres, { maxIndex });
    for (const entry of table.subgroups) {
        tally.entries++;
        for (const useOrbit of [false, true]) {
            const str = entryPermutations(pres, entry, useOrbit);
            check(checkPermutations(pres, str, useOrbit).ok, `${label} ${entry.subgroup}: fits, useOrbit ${useOrbit}`);
            const perms = sidePermutations(group, strToPermutations(str), useOrbit);
            const seam = colourSeam(fold, perms, useOrbit);
            check(!seam, `${label} ${entry.subgroup}: a seam, useOrbit ${useOrbit}, side ${seam && seam.side} from place ${seam && seam.from}`);
        }
    }
}

const section = (title, body) => {
    say(title);
    tally = { groups: 0, entries: 0, loops: 0 };
    body();
    say(`  ${tally.groups} groups, ${tally.entries} subgroups, ${tally.loops} loops closed`);
};

say('Group_WP');
for (const type of WallpaperGroupNames) {
    if (type === 'trivial') continue;
    for (const domainShape of getWallpaperDomainShapes(type)) {
        checkMaker(new Group_WP({ type, domainShape }), `${type} [${domainShape}]`);
    }
}
say(`  ${tally.groups} domains, ${tally.entries} subgroups, ${tally.loops} loops closed`);

const KLM = [[2, 3, 7], [2, 4, 5], [3, 3, 4], [2, 3, 6], [2, 4, 4], [3, 3, 3], [2, 3, 5], [2, 3, 12], [3, 5, 7], [2, 4, 20], [2, 3, 0], [2, 2, 5], [2, 3, 3]];
const factory = GroupMakerFactory();
const makerOf = (name, params = {}) => {
    const maker = factory.getObject(name);
    Object.assign(maker.params || maker.mConfig, params);
    return maker;
};

section('Group_KLM', () => {
    for (const [K, L, M] of KLM) {
        for (const s of [false, true]) {
            const maker = new Group_KLM({});
            Object.assign(maker.params, { K, L, M, s, hasR: false });
            checkMaker(maker, `${s ? '*' : ''}${K}${L}${M}`);
            // the domain gives the group of the catalogue
            const derived = groupPresentation(maker.getGroup());
            const count = (pres) => subgroupTable(pres, { maxIndex: 5 }).subgroups.map(e => e.index).join();
            check(count(derived) === count(maker.getPresentation()), `${K}${L}${M}: the subgroups of the domain's presentation`);
        }
        checkMaker(makerOf('KLM', { K, L, M, s: true, hasR: true }), `*${K}${L}${M} with R`, { maxIndex: 4 });
    }
    check(makerOf('KLM', { hasR: true }).getPresentation() === null, 'KLM with R: no presentation');
});

section('Group_KLMN', () => {
    const orders = [0, 2, 3, 5];
    for (const s of [false, true]) for (const K of orders) for (const L of orders) for (const M of orders) for (const N of orders) {
        if (K === 2 && L === 2) continue;      // S3, S4 are on one line: no domain
        checkMaker(makerOf('KLMN', { K, L, M, N, s }), `${s ? '*' : ''}${[K, L, M, N]}`, { maxIndex: 3, maxPlaces: 100 });
    }
    checkMaker(makerOf('KLMN', { K: 3, L: 2, M: 2, N: 2, twist: 0.3, bend: 20, aspect: 0.7 }), 'KLMN deformed', { maxIndex: 4 });
    check(makerOf('KLMN', { K: 2, L: 2, M: 3, N: 2, twist: 0.1 }).getPresentation() === null, 'KLMN: a twist away from right angles is another group');
    check(makerOf('KLMN', { K: 2, L: 2, M: 2, N: 2 }).getPresentation() === null, 'KLMN 2222: no domain');
});

section('Group_KLx', () => {
    const orders = [0, 2, 3, 5];
    for (const s of [false, true]) for (const K of orders) for (const L of orders) {
        if (K === 2 && L === 2) continue;      // S3, S4 are on one line: no domain
        checkMaker(makerOf('KLx', { K, L, s }), `${s ? '*' : ''}${K}${L}x`, { maxIndex: 3, maxPlaces: 100 });
        checkMaker(makerOf('KLx', { K, L, s, s1: false, s2: false }), `${s ? '*' : ''}${K}${L}x sides 3 4`, { maxIndex: 3, maxPlaces: 10 });
    }
    check(makerOf('KLx', { s5: true }).getPresentation() === null, 'KLx: the fifth side is no side of the domain');
});

section('Group_ON', () => {
    for (let N = 2; N <= 8; N++) {
        checkMaker(makerOf('oN', { N }), `o${N}`, { maxIndex: 4, maxPlaces: 100 });
        checkMaker(makerOf('oN', { N, twist: 0.4, bend1: 10 }), `o${N} twisted`, { maxIndex: 3, maxPlaces: 100 });
        checkMaker(makerOf('oN', { N, bend1: 20, bend2: 30 }), `o${N} bent`, { maxIndex: 3, maxPlaces: 100 });
    }
    check(makerOf('oN', { bend3: 25 }).getPresentation() === null, 'oN: bend3 is another group');
    check(makerOf('oN', { twist: 0.1, bend2: 3 }).getPresentation() === null, 'oN: a twist with bend2 is another group');
});

section('the pentagons and hexagons', () => {
    checkMaker(makerOf('22222'), '22222', { maxIndex: 4, maxPlaces: 100 });
    checkMaker(makerOf('22222', { T0: 0.3, T1: -0.2, A2: 10 }), '22222 deformed', { maxIndex: 3, maxPlaces: 100 });
    checkMaker(makerOf('*22222'), '*22222', { maxIndex: 4, maxPlaces: 100 });
    checkMaker(makerOf('*222222'), '*222222', { maxIndex: 4, maxPlaces: 100 });
});

section('the mirrors of 5 and 6 splanes', () => {
    for (const n of [2, 3, 4, 7]) {
        checkMaker(makerOf('5 Splanes', { n13: n, n24: n }), `5 splanes ${n}`, { maxIndex: 3, maxPlaces: 100 });
        const six = makerOf('6 Splanes', { n13: n, n24: n, s5: true, s6: true });
        checkMaker(six, `6 splanes ${n}`, { maxIndex: 3, maxPlaces: 100 });
    }
});

section('Group_Frieze', () => {
    for (const type of ['*22∞', '22∞', '2*∞', '∞*', '*∞∞', '∞x', '∞∞']) {
        checkMaker(makerOf('Frieze', { type }), type);
    }
});

section('Group_Spherical', () => {
    for (const type of ['*nn', 'nn', 'nx', 'n*', '*22n', '2*n', '22n']) {
        for (const n of [2, 3, 4, 5, 6]) {
            for (const centered of [false, true]) checkMaker(makerOf('Spherical', { type, n, centered }), `${type} ${n}`);
        }
    }
    for (const type of ['*532', '532', '*432', '432', '*332', '332', '3*2']) {
        for (const subtype of [0, 1, 2]) checkMaker(makerOf('Spherical', { type, subtype }), `${type} ${subtype}`, { maxIndex: 4 });
    }
});

section('Group_Orbifold', () => {
    for (const symbol of ['*442', '442', '4*2', '*632', '632', '*333', '333', '3*3', '*2222', '2222', '22*', '2*22', '**', '*x', 'xx', '22x',
                          '*237', '*245', '2*3', '3*22', '*2223', '237', '2223', 'o2', '2o']) {
        const maker = factory.getObject('Orbifold');
        maker._wg.guiParams.name = symbol;
        maker._compute();
        if (!maker.getGroup()) continue;
        checkMaker(maker, symbol, { maxIndex: 4, maxPlaces: 100 });
    }
    const orbifold = factory.getObject('Orbifold');
    check(!!orbifold.getCopy().getPresentation(), 'Orbifold: a copy of the maker has a presentation');
});

section('Group_Cyclic', () => {
    checkMaker(makerOf('Cyclic'), 'cyclic', { maxPlaces: 60 });
    checkMaker(makerOf('Cyclic', { AbsLambda: 1.5, ArgLambda: 30 }), 'loxodromic', { maxPlaces: 20 });
    checkMaker(makerOf('Cyclic', { AbsLambda: 1.1, ArgLambda: 45.8, finiteFP: true }), 'finite fixed points', { maxPlaces: 60 });
});

section('Group_Grandma and Group_Maskit2', () => {
    checkMaker(makerOf('Grandma'), 'Grandma', { maxIndex: 4, maxPlaces: 100 });
    checkMaker(makerOf('Grandma', { domain: 'isometric circles' }), 'Grandma, isometric circles', { maxIndex: 4, maxPlaces: 100 });
    checkMaker(makerOf('Grandma', { domain: 'isometric circles', ta_re: 1 }), 'Grandma, a of order 3', { maxIndex: 4, maxPlaces: 100, tolerance: 1e-4 });
    check(makerOf('Grandma', { ta_re: 1 }).getPresentation().relators === 'a*b, c*d, a^3', 'Grandma: the order of a');
    checkMaker(makerOf('Maskit 2-torus'), 'Maskit', { maxIndex: 3, maxPlaces: 100 });
});

// ---- the groups of the documents ------------------------------------------------------

/** the group makers' own way to take the parameters of a document */
function restore(maker, params) {
    if (maker.getClassName() === 'Group_6splanes') {
        Object.assign(maker.params, params);       // its setParamsMap goes through the UI
        maker.needRecalculate = true;
    } else if (maker.setParamsMap) {
        maker.setParamsMap(params);
    } else {
        setParamValues(maker.getParams(), params, false);
    }
}

/** the makers which do not make a group there */
function noGroup(className, p) {
    if (className === 'Group_KLMN') return !p.s && p.twist && !(p.M === 2 && p.N === 2);
    if (className === 'Group_KLx') return !!p.s5;
    return false;
}

section('the documents', () => {
    const files = [];
    (function walk(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, e.name);
            if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'thumbnails') walk(file); }
            else if (e.name.endsWith('.json')) files.push(file);
        }
    })('apps');

    const nameOf = {};
    for (const name of factory.getNames()) nameOf[factory.getObject(name).getClassName()] = name;
    const found = (o, out) => {
        if (Array.isArray(o)) o.forEach(x => found(x, out));
        else if (o && typeof o === 'object') {
            if (o.className && nameOf[o.className]) out.push(o);
            for (const k in o) found(o[k], out);
        }
        return out;
    };

    const seen = new Set();
    let none = 0;
    for (const file of files) {
        let doc;
        try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
        for (const { className, params } of found(doc, [])) {
            if (className === 'Group_WP') continue;          // every domain of it is above
            const id = className + JSON.stringify(params);
            if (seen.has(id)) continue;
            seen.add(id);
            const maker = factory.getObject(nameOf[className]);
            const label = `${path.basename(file)} ${className}`;
            try {
                restore(maker, params);
                if (noGroup(className, params)) { none++; check(maker.getPresentation() === null, `${label}: no presentation`); continue; }
                checkMaker(maker, label, { maxIndex: 3, maxPlaces: 60, tolerance: 1e-4 });
            } catch (e) {
                check(false, `${label}: ${e.message}`);
            }
        }
    }
    say(`  ${seen.size} groups in ${files.length} files, ${none} of them with no presentation`);
});

say(failures ? `\n${failures} FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
