/*
  test for the presentations of the group makers (getPresentation), against the group
  drawn. Phase 1: Group_WP and Group_KLM.

    node tests/groups/presentations.mjs

  1. a generator per side of the fundamental domain
  2. every relator is the identity on the transforms of the sides
  3. consistency: points are folded across the sides the way the shaders do, and two
     ways to the same place have the same colour permutation, for every subgroup of
     small index, read as the layer takes it, with and without useOrbit

  The relators alone cannot prove a presentation complete: without a relator of the
  group a table has subgroups which are not subgroups of it, and those show here the
  way they show on the screen, as a seam between colours.
*/

import {
    Group_WP, Group_KLM, subgroupTable, entryPermutations, checkPermutations, presentationSpec,
} from '../../lib/grouplib/modules.js';
import { WallpaperGroupNames, getWallpaperDomainShapes } from '../../lib/grouplib/WallpaperGroups.js';
import { composePerms, strToPermutations } from '../../lib/grouplib/Permutations.js';
import { ITransform, iPoint } from '../../lib/invlib/invlib.js';
import { makePresentation } from '../../lib/sublib/src/sublib.js';

const quiet = console.log;
console.log = () => {};
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
function foldPlaces(steps) {
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
            } else if (places.length < MAX_PLACES) {
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

function checkMaker(maker, label) {
    const pres = maker.getPresentation();
    if (!check(!!pres, `${label}: a presentation`)) return;
    const group = maker.getGroup();
    const steps = group.getReverseITransforms();
    const spec = presentationSpec(pres);
    const parsed = makePresentation(spec.gens, spec.relators);
    tally.groups++;

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
        check(POINTS.every(p => { const q = t.transform(p); return Math.hypot(q.v[0] - p.v[0], q.v[1] - p.v[1]) < 1e-6; }),
              `${label}: the relator ${parsed.relStrings[r]}`);
    }

    const fold = foldPlaces(steps);
    tally.loops += fold.loops.length;
    const table = subgroupTable(pres, { maxIndex: MAX_INDEX });
    for (const entry of table.subgroups) {
        tally.entries++;
        for (const useOrbit of [false, true]) {
            const str = entryPermutations(pres, entry, useOrbit);
            check(checkPermutations(pres, str, useOrbit).ok, `${label} ${entry.subgroup}: fits, useOrbit ${useOrbit}`);
            const seam = colourSeam(fold, strToPermutations(str), useOrbit);
            check(!seam, `${label} ${entry.subgroup}: a seam, useOrbit ${useOrbit}, side ${seam && seam.side} from place ${seam && seam.from}`);
        }
    }
}

say('Group_WP');
for (const type of WallpaperGroupNames) {
    if (type === 'trivial') continue;
    for (const domainShape of getWallpaperDomainShapes(type)) {
        checkMaker(new Group_WP({ type, domainShape }), `${type} [${domainShape}]`);
    }
}
say(`  ${tally.groups} domains, ${tally.entries} subgroups, ${tally.loops} loops closed`);

say('Group_KLM');
tally = { groups: 0, entries: 0, loops: 0 };
const KLM = [[2, 3, 7], [2, 4, 5], [3, 3, 4], [2, 3, 6], [2, 4, 4], [3, 3, 3], [2, 3, 5], [2, 3, 12], [3, 5, 7], [2, 4, 20], [2, 3, 0], [2, 2, 5], [2, 3, 3]];
for (const [K, L, M] of KLM) {
    for (const s of [false, true]) {
        const maker = new Group_KLM({});
        Object.assign(maker.params, { K, L, M, s, hasR: false });
        checkMaker(maker, `${s ? '*' : ''}${K}${L}${M}`);
    }
}
say(`  ${tally.groups} groups, ${tally.entries} subgroups, ${tally.loops} loops closed`);

say(failures ? `\n${failures} FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
