/*
  test for lib/grouplib/SubgroupTable.js and the presentations of the group makers

    node tests/subgroups/table.mjs

  1. presentations: a preset and gens with relators read alike, none is none, the key
     follows the presentation
  2. a table to the catalogue's depth is the one sublib gives
  3. the budget and the clock cut a table which would not end
  4. checkPermutations: size, count, relators
  5. every entry of every wallpaper table, of every domain shape, fits as the layer
     takes it (entryPermutations), with and without useOrbit
  6. Group_KLM: the generators are the sides, the relators hold on its transforms,
     a corner at infinity has no relator, the table is the catalogue's
*/

import {
    subgroupTable, checkPermutations, entryPermutations, presentationKey, presentationSpec,
    presentationText, clampMaxIndex, TABLE_MAX_SUBGROUPS,
    Group_WP, Group_KLM, Group_KLMN, tableUpTo,
} from '../../lib/grouplib/modules.js';
import { WallpaperGroupNames, getWallpaperDomainShapes } from '../../lib/grouplib/WallpaperGroups.js';
import { ITransform, iPoint } from '../../lib/invlib/invlib.js';
import { makePresentation, subgroupsData } from '../../lib/sublib/src/sublib.js';

const quiet = console.log;
console.log = () => {};
const say = (...a) => quiet(...a);

let failures = 0;
function check(ok, msg) { if (!ok) { failures++; say('  FAIL:', msg); } return ok; }

const P632 = { name: '632', label: '632', preset: 'wallpaper:632' };
const STAR22222 = { name: '*22222', label: '*22222', gens: 'a b c d e',
                    relators: 'a^2, b^2, c^2, d^2, e^2, (a*b)^2, (b*c)^2, (c*d)^2, (d*e)^2, (e*a)^2' };
const FREE2 = { name: 'F2', label: 'F2', gens: 'a b', relators: '' };

say('1. presentations');
{
    check(presentationSpec(null) === null, 'no presentation');
    check(presentationSpec({ name: 'trivial' }) === null, 'neither gens nor preset');
    check(presentationKey(null) === null, 'no key without a presentation');
    check(presentationSpec(P632).gens === 'a b c', 'a preset reads as gens');
    check(presentationText(P632).startsWith('<a b c | '), 'a presentation in words: ' + presentationText(P632));
    check(presentationSpec(FREE2).relators === '', 'a free group has no relators');
    check(presentationKey(FREE2) !== null, 'a free group has a key');
    check(presentationKey(P632) === presentationKey({ ...P632 }), 'the key is of the content');
    check(presentationKey(P632) !== presentationKey({ ...P632, label: '632 [kite]' }), 'another domain, another key');
    check(clampMaxIndex(0) === 24 && clampMaxIndex(100) === 24 && clampMaxIndex(6) === 6, 'max index clamped');
}

say('2. tables of the catalogue');
{
    const t = subgroupTable(P632, { maxIndex: 24 });
    const d = subgroupsData({ preset: 'wallpaper:632', maxIndex: 24 });
    check(t.subgroups.length === d.subgroups.length, 'as many subgroups as sublib gives');
    check(t.subgroups.every((s, i) => s.cosets === d.subgroups[i].cosets && s.invcos === d.subgroups[i].invcos), 'the same subgroups');
    check(t.maxIndex === 24 && t.nextIndex === null, 'all the way to the index asked');
    check(subgroupTable(null) === null, 'no table without a presentation');
}

say('3. the budget and the clock');
{
    const t0 = Date.now();
    const t = subgroupTable(STAR22222, { maxIndex: 24 });
    check(t.subgroups.length <= TABLE_MAX_SUBGROUPS, `within the budget: ${t.subgroups.length}`);
    check(t.maxIndex === 6 && t.nextIndex === 7, `to index 6, more at 7: ${t.maxIndex} ${t.nextIndex}`);
    const f = subgroupTable(FREE2, { maxIndex: 24 });
    check(f.subgroups.length <= TABLE_MAX_SUBGROUPS && f.maxIndex >= 5, `a free group: ${f.subgroups.length} to index ${f.maxIndex}`);
    check(Date.now() - t0 < 5000, 'quickly');
    const c = subgroupTable(STAR22222, { maxIndex: 24, maxSubgroups: 1e9, deadlineMs: 50 });
    check(c.stats.aborted === true, 'the clock stops it');
}

say('4. checkPermutations');
{
    const reason = (str, orbit) => checkPermutations(P632, str, orbit).reason;
    check(checkPermutations(P632, '').ok, 'no permutations are fine');
    check(checkPermutations(P632, '   ').ok, 'nor are blanks a problem');
    check(reason('abc ab abc').includes('has 2 letters'), 'different sizes');
    check(reason('aab abc abc').includes('not a permutation'), 'a repeated letter');
    check(reason('abd abc abc').includes('not a permutation'), 'a letter out of range');
    check(reason('abc abc').includes('2 permutations for 3 generators'), 'too few');
    check(reason('abc abc abc abc').includes('4 permutations for 3 generators'), 'too many');
    check(reason('bca abc abc').includes('a^2'), 'a relator named: ' + reason('bca abc abc'));
    check(checkPermutations(P632, 'abc abc abc').ok, 'the identity always fits');
    check(checkPermutations(null, 'bca abc abc').ok, 'no presentation, nothing to fail');
    check(!checkPermutations(null, 'aab abc').ok, 'but it stays no permutation');
    const t = subgroupTable(P632, { maxIndex: 12 });
    check(t.subgroups.every(s => checkPermutations(P632, s.invcos, false).ok), 'a table of 632 fits');
}

say('5. every wallpaper table, as the layers take it');
{
    let entries = 0, needed = 0;
    for (const name of WallpaperGroupNames) {
        for (const shape of getWallpaperDomainShapes(name)) {
            const pres = new Group_WP({ type: name, domainShape: shape }).getPresentation();
            if (!presentationSpec(pres)) continue;
            for (const s of subgroupTable(pres, { maxIndex: 8 }).subgroups) {
                entries++;
                if (entryPermutations(pres, s, false) !== s.invcos) needed++;
                check(checkPermutations(pres, entryPermutations(pres, s, false), false).ok, `${name} [${shape}] ${s.subgroup} without useOrbit`);
                check(checkPermutations(pres, entryPermutations(pres, s, true), true).ok, `${name} [${shape}] ${s.subgroup} with useOrbit`);
                check(entryPermutations(pres, s, true) === s.invcos, `${name} [${shape}] ${s.subgroup}: invcos with useOrbit`);
            }
        }
    }
    say(`   ${entries} entries, ${needed} of them take cosets`);
    check(entries > 1000, 'all of them seen');
    check(needed > 0, 'the 4*2 square and the 3*3 kite need cosets');
}

say('6. Group_KLM');
{
    const points = [[0.12345, 0.06789], [-0.07211, 0.16183], [0.31, -0.2]].map(([x, y]) => iPoint([x, y, 0, 0]));
    const holds = (group, pres) => {
        const direct = group.getTransforms().map(t => new ITransform(t.slice(), 'x'));
        return makePresentation(pres.gens, pres.relators).relators.every(word => {
            let t = new ITransform([], '');
            for (const x of word) { const g = direct[Math.abs(x) - 1]; t = t.concat(x > 0 ? g : g.getInverse()); }
            return points.every(p => { const q = t.transform(p); return Math.hypot(q.v[0] - p.v[0], q.v[1] - p.v[1]) < 1e-7; });
        });
    };
    const make = (K, L, M, s, hasR = false) => {
        const m = new Group_KLM({});
        Object.assign(m.params, { K, L, M, s, hasR });
        return m;
    };
    const cases = [[2, 3, 7], [2, 4, 5], [3, 3, 4], [2, 3, 6], [2, 3, 5], [2, 3, 12], [3, 5, 7], [2, 4, 20], [2, 3, 0]];
    for (const [K, L, M] of cases) {
        for (const s of [false, true]) {
            const m = make(K, L, M, s);
            const pres = m.getPresentation();
            const group = m.getGroup();
            check(pres.gens.split(' ').length === group.getFundDomain().length, `${pres.name}: a generator per side`);
            check(holds(group, pres), `${pres.name}: the relators hold on the sides: ${presentationText(pres)}`);
            check(!pres.relators.includes('^0'), `${pres.name}: no empty relator`);
        }
    }
    check(!make(2, 4, 20, true).getPresentation().relators.includes('^20'), 'a corner at infinity has no relator');
    check(make(2, 3, 7, false, true).getPresentation() === null, 'has R: no presentation yet');

    const own = subgroupTable(make(2, 3, 7, false).getPresentation(), { maxIndex: 24 });
    const catalogue = subgroupsData({ preset: 'klm:237', maxIndex: 24 });
    check(own.subgroups.every((s, i) => s.subgroup === catalogue.subgroups[i].subgroup && s.cosets === catalogue.subgroups[i].cosets),
          'klm 237: the table and the ids of the catalogue');
    const star = subgroupTable(make(2, 3, 7, true).getPresentation(), { maxIndex: 24 });
    const starCat = subgroupsData({ preset: 'sklm:*237', maxIndex: 24 });
    check(star.subgroups.every((s, i) => s.subgroup === starCat.subgroups[i].subgroup && s.cosets === starCat.subgroups[i].cosets),
          '*klm *237: the table and the ids of the catalogue');
}

say('the table of a group cut at a lower index is the table to that index');
{
    const same = (a, b) => a.subgroups.length === b.subgroups.length &&
        a.subgroups.every((s, i) => s === b.subgroups[i] ||
                                    (s.subgroup === b.subgroups[i].subgroup && s.cosets === b.subgroups[i].cosets));
    const make = (Maker, values) => { const m = new Maker({}); Object.assign(m.params, values); return m.getPresentation(); };
    const cases = [
        ...WallpaperGroupNames.filter(type => type !== 'trivial').map(type => new Group_WP({ type }).getPresentation()),
        make(Group_KLM, { K: 2, L: 3, M: 7, s: false, hasR: false }),
        make(Group_KLM, { K: 3, L: 3, M: 4, s: false, hasR: false }),
        make(Group_KLM, { K: 2, L: 4, M: 5, s: true, hasR: false }),
        make(Group_KLMN, {}),
    ];
    for (const pres of cases) {
        if (!check(!!pres, 'a presentation')) continue;
        const table = subgroupTable(pres, { maxIndex: 24 });
        for (const maxIndex of [6, 12]) {
            if (table.maxIndex <= maxIndex) continue;
            const cut = tableUpTo(table, maxIndex);
            const direct = subgroupTable(pres, { maxIndex });
            check(same(cut, direct), `${pres.name} at ${maxIndex}: ${cut.subgroups.length} and ${direct.subgroups.length}`);
            check(cut.maxIndex === maxIndex && cut.totalCount === direct.totalCount, `${pres.name} at ${maxIndex}: the counts`);
            check(JSON.stringify(cut.countPerIndex) === JSON.stringify(direct.countPerIndex), `${pres.name} at ${maxIndex}: per index`);
            check(cut.nextIndex === null && cut.nextIndexCount === null, `${pres.name} at ${maxIndex}: nothing beyond`);
            check(cut.stats === table.stats, `${pres.name}: the stats stay`);
        }
        check(tableUpTo(table, 24) === table, `${pres.name}: the table itself when it does not reach further`);
    }
}

say(failures ? `${failures} FAILED` : 'ALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
