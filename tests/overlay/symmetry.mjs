/*
  test for the symmetry of overlay items (lib/symhublib/overlays/OverlaySymmetry.js)

    node tests/overlay/symmetry.mjs

  An item drawn from group data may use a subgroup H of the renderer's group G
  instead of G, given by its coset table.  Without GL the sampler is never made,
  so the checks stop at the domain of H the item builds (rebuild/getDomain); packing
  it into the sampler and the uniform are what the browser adds.

  1. the group using kinds serialize a symmetry block, the others do not
  2. with the catalogue presentation of 632 (default domain) the table of
     subgroups is computed by sublib; choosing index 3 sets the cosets of the
     first index 3 subgroup and H has index 3
  3. a restored document selects its subgroup in the choices again; the
     serialization round trips
  4. a presentation change (the kite domain of 632, generators and relators
     derived from the domain) recomputes the table; H of index 3 is built from
     the kite group
  5. unusable cosets leave the item on the renderer's group, without throwing
  6. every wallpaper group of grouplib names a sublib preset
  7. the overlay forwards group changes to its items
*/

import { OverlayTiling, OverlayFundDomain, OverlayIsolines, OverlayBuffer, OverlayWorldGrid, VisualizationOverlay } from '../../lib/symhublib/symhublib.js';
import { getParamValues, setParamValues } from '../../lib/uilib/param.js';
import { iWallpaperGroup, getWallpaperDomainShapes, WallpaperDomainShapes, WallpaperGroupNames } from '../../lib/grouplib/WallpaperGroups.js';
import { Group } from '../../lib/invlib/invlib.js';
import { groupPresentation } from '../../lib/grouplib/GroupPresentation.js';
import { getPreset, WALLPAPER_NAMES } from '../../lib/sublib/src/sublib.js';

const quiet = { log: console.log, warn: console.warn };
console.log = () => {};
const say = (...a) => quiet.log(...a);

let failures = 0;
function check(ok, msg) { if (!ok) { failures++; say('  FAIL:', msg); } return ok; }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const GEO = { a: 0.5, b: 0.5, c: 0.038 };
const G632 = new Group(iWallpaperGroup({ name: '632', ...GEO }));
const KITE = '6-2-3-2 kite';
const G632kite = new Group(iWallpaperGroup({ name: '632', ...GEO, domainShape: KITE }));

// presentations as Group_WP.getPresentation() gives them
const catalogue632 = { name: '632', domainShape: getWallpaperDomainShapes('632')[0], label: '632', preset: 'wallpaper:632' };
const kitePres = (() => {
    const p = groupPresentation(G632kite);
    return { name: '632', domainShape: KITE, label: '632 [' + KITE + ']', gens: p.gens, relators: p.relators };
})();

// init arguments as the renderer passes them, without GL
let repaints = 0;
const initPar = (pres) => ({ glCtx: null, onChange: () => { repaints++; }, getGroupPresentation: () => pres });

const SYM_DEFAULT = { type: 'renderer', maxIndex: 8, cosets: '' };

// ── 1. serialized shape ───────────────────────────────────────────────────────
say('1. serialized shape');
{
    for (const [ctor, name] of [[OverlayTiling, 'tiling'], [OverlayFundDomain, 'fundDomain'], [OverlayIsolines, 'isolines']]) {
        const v = getParamValues(ctor({ id: name }).getParams());
        check(same(v.symmetry, SYM_DEFAULT), `${name} serializes the default symmetry: ${JSON.stringify(v.symmetry)}`);
        check(Object.keys(v).at(-1) === 'symmetry', `${name}: symmetry comes last`);
    }
    for (const [ctor, name] of [[OverlayBuffer, 'buffer'], [OverlayWorldGrid, 'worldGrid']]) {
        const v = getParamValues(ctor({ id: name }).getParams());
        check(!('symmetry' in v), `${name} has no symmetry`);
    }
    const t = OverlayTiling({ id: 't', config: { symmetry: { type: 'subgroup', cosets: 'a b c' } } });
    check(t.getConfig().symmetry.type === 'subgroup' && t.getConfig().symmetry.cosets === 'a b c' && t.getConfig().symmetry.maxIndex === 8,
          'config overrides merge into the symmetry block');
}

// ── 2. the table and H from the catalogue presentation ────────────────────────
say('2. subgroup from the catalogue presentation');
let cosets3 = null;
{
    const it = OverlayTiling({ id: 'tiling' });
    it.init(initPar(catalogue632));
    const sym = it.getSymmetry();
    check(sym && !sym.usesSubgroup && sym.getTable() === null, 'renderer symmetry: no table yet');

    repaints = 0;
    setParamValues(it.getParams(), { symmetry: { type: 'subgroup' } });
    check(sym.usesSubgroup && repaints > 0, 'switching to subgroup asks for a repaint');
    const table = sym.getTable();
    check(table && table.name === '632' && table.maxIndex === 8, `table computed: ${table && table.subgroups.length} subgroups`);
    const ch = sym.getChoices();
    check(same(ch.indices.slice(0, 4), ['[select]', '1(1)', '2(1)', '3(2)']), `index choices: ${ch.indices}`);
    check(ch.index === '[select]' && ch.subgroup === '[select]', 'nothing selected without cosets');

    sym.setIndex('3(2)');
    const ch3 = sym.getChoices();
    check(same(ch3.subgroups, ['[select]', '632.3.1', '632.3.2']) && ch3.subgroup === '632.3.1', `subgroup choices of index 3: ${ch3.subgroups}`);
    cosets3 = it.getConfig().symmetry.cosets;
    check(cosets3 === table.subgroups.find(s => s.subgroup === '632.3.1').cosets && cosets3.split(' ').length === 3,
          `cosets of the first index 3 subgroup: '${cosets3}'`);

    sym.rebuild(G632);
    const H = sym.getDomain();
    check(H && H.n === 3 && H.pairings.length >= 3,
          `H has index 3 with ${H && H.pairings.length} pairings`);
    check(same(sym.getUniforms({ group: G632 }), { uSubEnabled: false }), 'no sampler without GL: no uniform');

    sym.setSubgroup('632.3.2');
    check(it.getConfig().symmetry.cosets !== cosets3, 'the other index 3 subgroup has other cosets');
    sym.rebuild(G632);
    check(sym.getDomain() && sym.getDomain().n === 3, 'H of the other subgroup');

    // back to the renderer's group
    setParamValues(it.getParams(), { symmetry: { type: 'renderer' } });
    check(same(sym.getUniforms({ group: G632 }), { uSubEnabled: false }), 'renderer symmetry: no uniform');
}

// ── 3. restore ────────────────────────────────────────────────────────────────
say('3. restore of a document');
{
    const it = OverlayFundDomain({ id: 'fundDomain' });
    it.init(initPar(catalogue632));
    setParamValues(it.getParams(), { symmetry: { type: 'subgroup', maxIndex: 8, cosets: cosets3 } });
    const sym = it.getSymmetry();
    const ch = sym.getChoices();
    check(ch.index === '3(2)' && ch.subgroup === '632.3.1', `restored cosets select their subgroup: ${ch.index} ${ch.subgroup}`);
    const v = getParamValues(it.getParams());
    check(same(v.symmetry, { type: 'subgroup', maxIndex: 8, cosets: cosets3 }), 'serialization round trip');
    sym.rebuild(G632);
    check(sym.getDomain() && sym.getDomain().n === 3, 'H rebuilt after the restore');

    // a fresh item restored before the group is known builds on the first frame
    const it2 = OverlayTiling({ id: 't2' });
    it2.init(initPar(catalogue632));
    setParamValues(it2.getParams(), { symmetry: { type: 'subgroup', cosets: cosets3 } });
    it2.getSymmetry().getUniforms({ group: G632 });
    check(it2.getSymmetry().getDomain() && it2.getSymmetry().getDomain().n === 3, 'getUniforms builds H on demand');
}

// ── 4. a presentation change ──────────────────────────────────────────────────
say('4. presentation change: the kite domain of 632');
{
    let pres = catalogue632;
    const it = OverlayTiling({ id: 'tiling' });
    it.init({ glCtx: null, onChange: () => {}, getGroupPresentation: () => pres });
    setParamValues(it.getParams(), { symmetry: { type: 'subgroup', cosets: cosets3 } });
    const sym = it.getSymmetry();
    const tableA = sym.getTable();

    pres = kitePres;
    sym.onGroupChanged(G632kite);
    const tableB = sym.getTable();
    check(tableB && tableB !== tableA, 'the table is recomputed for the new presentation');
    check(tableB.subgroups.filter(s => s.index === 3).length === 2, `the kite presentation has 2 subgroups of index 3: ${tableB.countPerIndex.map(c => c.index + ':' + c.count)}`);
    const chB = sym.getChoices();
    check(chB.indices.includes('3(2)'), `kite index choices: ${chB.indices}`);

    sym.setIndex('3(2)');
    const cosetsKite = it.getConfig().symmetry.cosets;
    check(cosetsKite.split(' ').length === (kitePres.gens.split(/\s+/).length), `cosets have one permutation per generator: '${cosetsKite}' for gens '${kitePres.gens}'`);
    sym.rebuild(G632kite);
    const H = sym.getDomain();
    check(H && H.n === 3, `H of index 3 from the kite group with ${H && H.pairings.length} pairings`);

    // back to the default domain: the table follows, the kite cosets no longer match a choice
    pres = catalogue632;
    sym.onGroupChanged(G632);
    check(sym.getTable() !== tableB, 'table recomputed again');
}

// ── 5. unusable cosets ────────────────────────────────────────────────────────
say('5. unusable cosets');
{
    const it = OverlayTiling({ id: 'tiling' });
    it.init(initPar(catalogue632));
    let warned = 0; console.warn = () => { warned++; };
    setParamValues(it.getParams(), { symmetry: { type: 'subgroup', cosets: 'xyz' } });
    let threw = false;
    try { it.getSymmetry().rebuild(G632); } catch (e) { threw = true; }
    console.warn = quiet.warn;
    check(!threw && it.getSymmetry().getDomain() === null && warned > 0, 'bad cosets: no group, a warning, no throw');
    check(same(it.getSymmetry().getUniforms({ group: G632 }), { uSubEnabled: false }), 'bad cosets: the renderer group stays in use');
    check(it.getSymmetry().getChoices().subgroup === '[select]', 'bad cosets select nothing');
}

// ── 6. every wallpaper group names a sublib preset ────────────────────────────
say('6. wallpaper groups and sublib presets');
{
    // Group_WP.getPresentation() names 'wallpaper:' + type for a default domain (not for the trivial group)
    const noPreset = WallpaperGroupNames.filter(name => { try { getPreset('wallpaper:' + name); return false; } catch (e) { return true; } });
    check(same(noPreset, ['trivial']), `every grouplib wallpaper group but the trivial one has a sublib preset, missing: ${noPreset}`);
    check(WALLPAPER_NAMES.every(n => WallpaperGroupNames.some(g => g.toLowerCase() === n.toLowerCase())), 'every sublib wallpaper group is a grouplib group');
    const shaped = Object.keys(WallpaperDomainShapes || {});
    check(shaped.every(n => WallpaperGroupNames.includes(n)), `groups with domain shapes are grouplib names: ${shaped}`);
}

// ── 7. the overlay forwards group changes ─────────────────────────────────────
say('7. group changes through the overlay');
{
    const ov = VisualizationOverlay({ id: 'overlay' });
    ov.init(initPar(catalogue632));
    setParamValues(ov.getParams(), { overlays: { tiling: { enabled: true, symmetry: { type: 'subgroup', cosets: cosets3 } } } });
    let threw = false;
    try { ov.onGroupChanged(G632); } catch (e) { threw = true; }
    check(!threw, 'onGroupChanged forwarded to the items');
    const sym = ov.getItem('tiling').getSymmetry();
    sym.rebuild(G632);
    check(sym.getDomain() && sym.getDomain().n === 3, 'the tiling item of the overlay builds H');
    const saved = getParamValues(ov.getParams());
    const tiling = saved.overlays.params.children[0].params;
    check(tiling.symmetry.type === 'subgroup' && tiling.symmetry.cosets === cosets3, 'the overlay saves the item symmetry');
}

console.log = quiet.log;
if (failures) { console.log(`\n${failures} check(s) FAILED`); process.exit(1); }
console.log('\nall checks passed');
