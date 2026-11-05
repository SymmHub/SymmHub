/*
  test for lib/grouplib/Subgroups.js: the subgroups folder of a colour layer, without
  a page, on a small layer of real params and the presentations of Group_WP

    node tests/subgroups/panel.mjs

  1. a table comes on request only, the first row says how it stands
  2. a change of the group never touches the permutations
  3. Recalculate, its three outcomes: the permutations are in the table, the name is,
     neither is
  4. a table comes back with its presentation and its max index
  5. picking a subgroup writes the permutations, the colours and the offset's range
  6. typing: the chooser follows, the mark says what does not fit
  7. a document: nothing calculated, nothing overwritten, values saved
  8. the cut of a table is said, a group with no presentation has no table
*/

import {
    Subgroups, Group_WP, subgroupTable, entryPermutations, checkPermutations,
    makeSubgroupNamer, presentationKey,
} from '../../lib/grouplib/modules.js';
import { getWallpaperDomainShapes } from '../../lib/grouplib/WallpaperGroups.js';
import { ParamString, ParamInt, ParamBool, getParamValues } from '../../lib/uilib/uilib.js';

const quiet = console.log;
console.log = () => {};
const say = (...a) => quiet(...a);

let failures = 0;
function check(ok, msg) { if (!ok) { failures++; say('  FAIL:', msg); } return ok; }

function wallpaper(type, shape) {
    return new Group_WP({ type, domainShape: shape }).getPresentation();
}

/** a layer: the params the folder is given, and how often they were written */
function makeLayer(pres, permutations = '') {
    const cf = { permutations, permIndex: 0, useOrbit: false, count: 6 };
    const state = { pres, writes: 0, repaints: 0 };
    let params = null;
    const panel = Subgroups({
        getPresentation: () => state.pres,
        getLayerParams:  () => params,
        onChange:        () => { state.repaints++; },
    });
    params = {
        permutations: ParamString({ obj: cf, key: 'permutations', onChange: () => {
            state.writes++;
            panel.onPermutationsChanged();
        } }),
        permIndex: ParamInt({ obj: cf, key: 'permIndex', min: 0, max: 23 }),
        useOrbit:  ParamBool({ obj: cf, key: 'useOrbit', onChange: () => panel.updateCheck() }),
        count:     ParamInt({ obj: cf, key: 'count', min: 1, max: 64 }),
    };
    panel.getParams();
    return {
        cf, state, panel, params,
        setGroup: (next) => { state.pres = next; panel.onGroupChanged(); },
        type:     (text) => params.permutations.setValue(text),
        status:   () => panel.getStatus(),
        choices:  () => panel.getChoices(),
        mark:     () => params.permutations.getMark(),
    };
}

/** the subgroups of a table by name */
function tableOf(pres, maxIndex = 8) {
    const data = subgroupTable(pres, { maxIndex });
    const namer = makeSubgroupNamer({ data, presentation: pres, family: pres.family });
    return { data, namer, entries: data.subgroups, nameOf: (e) => namer.nameOf(e) };
}

const [SHAPE_A, SHAPE_B] = getWallpaperDomainShapes('632');
const A = wallpaper('632', SHAPE_A);
const B = wallpaper('632', SHAPE_B);
check(!!SHAPE_B && presentationKey(A) !== presentationKey(B), 'the group has two domains of different presentations');
const TABLE_A = tableOf(A);
const ENTRY = TABLE_A.entries.find(e => Number(e.index) === 7);
const PERMS = entryPermutations(A, ENTRY);
const NAME = TABLE_A.nameOf(ENTRY);
const REPAINTED = (layer) => layer.state.repaints > 0;

say('1. on request');
{
    const layer = makeLayer(A, PERMS);
    check(layer.panel.getTable() === null, 'no table at the start');
    check(layer.status().state === 'empty', 'the row says no table: ' + layer.status().text);
    check(layer.choices().indices.length === 1, 'nothing to choose from');
    layer.panel.recalculate();
    check(layer.panel.getTable() !== null, 'Recalculate makes the table');
    check(layer.status().state === 'fits', 'the row says the table fits: ' + layer.status().text);
    check(layer.status().text.startsWith('632 · '), 'the row names the group: ' + layer.status().text);
    check(layer.choices().indices.length > 1, 'the indices are listed');
    check(REPAINTED(layer), 'the layer is told');
}

say('2. a change of the group');
{
    const layer = makeLayer(A, PERMS);
    layer.panel.recalculate();
    const table = layer.panel.getTable();
    const writes = layer.state.writes;
    layer.setGroup(B);
    check(layer.cf.permutations === PERMS, 'the permutations stay');
    check(layer.state.writes === writes, 'nothing was written to them');
    check(layer.panel.getTable() === table, 'nothing was calculated');
    check(layer.status().state === 'changed' && layer.status().text === 'group changed', 'the row says so: ' + layer.status().text);
    check(layer.choices().indices.length === 1, 'the subgroups of the old table are not offered');
    check(layer.choices().subgroup === NAME, 'the name stays selected: ' + layer.choices().subgroup);
    check(layer.mark() !== null, 'the mark says they do not fit: ' + layer.mark());
    layer.panel.setSubgroup(NAME);
    check(layer.cf.permutations === PERMS, 'the name of a table which does not fit applies nothing');
}

say('3. Recalculate');
{
    // the permutations are in the table: they stay and the chooser finds them
    const inTable = makeLayer(A, PERMS);
    inTable.panel.recalculate();
    check(inTable.cf.permutations === PERMS, '1: the permutations stay');
    check(inTable.state.writes === 0, '1: nothing was written');
    check(inTable.choices().subgroup === NAME, '1: their subgroup is selected: ' + inTable.choices().subgroup);
    check(parseInt(inTable.choices().index, 10) === 7, '1: and its index: ' + inTable.choices().index);

    // up to the numbering of the colours as well
    const renumbered = PERMS.split(' ').map(p => {
        // conjugate by the swap of colours 0 and 1
        const v = [...p].map(c => c.charCodeAt(0) - 97);
        const s = (i) => (i < 2 ? 1 - i : i);
        return v.map((_, i) => String.fromCharCode(97 + s(v[s(i)]))).join('');
    }).join(' ');
    check(renumbered !== PERMS, 'the colours are renumbered');
    const conjugate = makeLayer(A, renumbered);
    conjugate.panel.recalculate();
    check(conjugate.cf.permutations === renumbered, '1: conjugate permutations stay');
    check(conjugate.choices().subgroup !== '[select]', '1: their class is selected');

    // the name is, the permutations are not: the same colour group on the new domain
    const named = makeLayer(A, PERMS);
    named.panel.recalculate();
    named.setGroup(B);
    named.panel.recalculate();
    const tableB = tableOf(B);
    const entryB = tableB.namer.entryByName(NAME);
    check(!!entryB, 'the name is in the table of the other domain');
    check(named.cf.permutations === entryPermutations(B, entryB), '2: the permutations of the name are written');
    check(named.choices().subgroup === NAME, '2: the same name');
    check(named.cf.count === 7, '2: the colours follow');
    check(named.mark() === null, '2: they fit: ' + named.mark());

    // neither: typed permutations are not overwritten
    const typed = 'abc bca';
    const neither = makeLayer(B, typed);
    neither.panel.recalculate();
    check(neither.cf.permutations === typed, '3: the permutations stay');
    check(neither.state.writes === 0, '3: nothing was written');
    check(neither.choices().subgroup === '[select]', '3: nothing is selected');
}

say('4. a table comes back');
{
    const layer = makeLayer(A, PERMS);
    layer.panel.recalculate();
    const table = layer.panel.getTable();
    layer.setGroup(B);
    layer.setGroup(A);
    check(layer.panel.getTable() === table, 'the same table');
    check(layer.status().state === 'fits', 'it fits again');
    check(layer.choices().indices.length > 1, 'its subgroups are offered again');
    check(layer.choices().subgroup === NAME, 'the subgroup is selected again');

    layer.panel.getParams().maxIndex.setValue(12);
    check(layer.status().state === 'changed' && layer.status().text === 'max index changed', 'another max index: ' + layer.status().text);
    check(layer.panel.getTable() === table, 'nothing was calculated');
    check(layer.choices().indices.length === 1, 'the table is not offered');
    layer.panel.getParams().maxIndex.setValue(24);
    check(layer.status().state === 'fits', 'the max index comes back');
    check(layer.cf.permutations === PERMS, 'the permutations stayed all along');

    layer.panel.getParams().maxIndex.setValue(6);
    layer.panel.recalculate();
    check(layer.cf.permutations === PERMS, 'a table too small for the subgroup leaves the permutations');
    check(layer.choices().subgroup === '[select]', 'and selects nothing');
    check(layer.panel.getTable().subgroups.every(s => Number(s.index) <= 6), 'the table stops at the max index');
}

say('5. picking');
{
    const layer = makeLayer(A);
    layer.panel.recalculate();
    const choice = layer.choices().indices.find(c => parseInt(c, 10) === 7);
    layer.panel.setIndex(choice);
    const picked = layer.choices();
    check(picked.subgroup !== '[select]', 'the index selects its first subgroup');
    check(layer.cf.permutations !== '', 'whose permutations are written');
    check(layer.cf.count === 7, 'the colours follow');
    layer.cf.permIndex = 20;
    layer.panel.setIndex(choice);
    check(layer.cf.permIndex === 6, 'and the offset stays among them');
    const other = picked.subgroups.filter(s => s !== '[select]').find(s => s !== picked.subgroup);
    if (other) {
        layer.panel.setSubgroup(other);
        check(layer.choices().subgroup === other, 'another subgroup of the index');
    }
    const entry = TABLE_A.namer.entryByName(layer.choices().subgroup);
    check(layer.cf.permutations === entryPermutations(A, entry), 'the permutations of the entry');
    check(layer.mark() === null, 'they fit');
}

say('6. typing');
{
    const layer = makeLayer(A);
    layer.panel.recalculate();
    layer.type(PERMS);
    check(layer.choices().subgroup === NAME, 'the chooser finds typed permutations');
    check(parseInt(layer.choices().index, 10) === 7, 'and their index');

    layer.type('abc bca');
    check(layer.choices().subgroup === '[select]', 'nothing is selected for others');
    check(layer.cf.permutations === 'abc bca', 'they stay as typed');
    check(/permutations for/.test(layer.mark()), 'the mark says what is wrong: ' + layer.mark());

    layer.type('abc abc');
    check(layer.cf.permutations === 'abc abc', 'whatever is typed stays');
    layer.type('');
    check(layer.mark() === null, 'no permutations, no mark');

    // with no table the name goes: Recalculate would write over what was typed
    const noTable = makeLayer(A, PERMS);
    noTable.panel.setParamsMap({ subgroup: NAME }, true);
    noTable.type('abc bca');
    check(noTable.choices().subgroup === '[select]', 'typing clears the name');
    noTable.panel.recalculate();
    check(noTable.cf.permutations === 'abc bca', 'and Recalculate leaves what was typed');

    // what fits depends on the way the layer composes
    const pres = wallpaper('4*2', '4-*-*2-* square');
    const entries = subgroupTable(pres, { maxIndex: 8 }).subgroups;
    const bad = entries.find(e => !checkPermutations(pres, e.invcos, false).ok);
    check(!!bad, 'permutations which fit with useOrbit only');
    const orbit = makeLayer(pres, bad.invcos);
    const off = orbit.mark();
    orbit.params.useOrbit.setValue(true);
    const on = orbit.mark();
    check(off !== null && on === null, `useOrbit changes the mark: off ${off}, on ${on}`);

    // Recalculate mends what is in the table and does not fit
    orbit.params.useOrbit.setValue(false);
    orbit.panel.recalculate();
    check(orbit.cf.permutations === bad.cosets, 'the reading which fits is written');
    check(orbit.mark() === null, 'and the mark goes: ' + orbit.mark());
}

say('7. a document');
{
    const layer = makeLayer(A, PERMS);
    layer.panel.recalculate();
    layer.panel.getParams().maxIndex.setValue(24);
    const saved = getParamValues(layer.panel.getParams());
    check(saved.maxIndex === 24 && saved.subgroup === NAME, 'the max index and the name are saved: ' + JSON.stringify(saved));
    check(!('index' in saved) && !('status' in saved), 'the rest is not: ' + JSON.stringify(saved));

    const writes = layer.state.writes;
    layer.panel.setParamsMap({ maxIndex: 16, subgroup: NAME }, true);
    check(layer.panel.getTable() === null, 'a document starts without a table');
    check(layer.status().state === 'empty', 'the row says so');
    check(layer.state.writes === writes && layer.cf.permutations === PERMS, 'the permutations stay');
    check(layer.choices().subgroup === NAME, 'the name is shown');
    check(getParamValues(layer.panel.getParams()).maxIndex === 16, 'the max index is read');
    layer.panel.recalculate();
    check(layer.cf.permutations === PERMS && layer.choices().subgroup === NAME, 'and Recalculate finds them');

    // the same with the group of the document coming after its layers
    const late = makeLayer(B, '');
    late.panel.setParamsMap({ subgroup: NAME }, true);
    late.setGroup(A);
    check(late.panel.getTable() === null, 'a group coming later calculates nothing');
    check(late.choices().subgroup === NAME, 'and keeps the name');

    // the keys of older documents are not read
    const older = makeLayer(A, PERMS);
    older.panel.setParamsMap({ groupType: 'wp', groupName: '632', fileName: 'x.json', index: '7(2)', subgroup: 'old.7.1' }, true);
    check(older.panel.getTable() === null, 'an older document opens');
    check(older.choices().subgroup === 'old.7.1', 'with its name');
    older.panel.recalculate();
    check(older.cf.permutations === PERMS, 'the permutations stay');
    check(older.choices().subgroup === NAME, 'and the table names them');

    older.panel.setParamsMap({ maxIndex: 500 }, false);
    check(getParamValues(older.panel.getParams()).maxIndex === 24, 'the max index is clamped');
}

say('8. cuts and no presentation');
{
    const free = makeLayer({ name: 'F2', label: 'F2', gens: 'a b', relators: '' });
    free.panel.recalculate();
    check(/more at \d+/.test(free.status().text), 'a cut is said: ' + free.status().text);

    const none = makeLayer(null, PERMS);
    check(none.status().state === 'none' && none.status().text === 'no presentation', 'no presentation: ' + none.status().text);
    none.panel.recalculate();
    check(none.panel.getTable() === null, 'no table');
    check(none.cf.permutations === PERMS && none.mark() === null, 'the permutations are left alone');
    none.setGroup(A);
    check(none.status().state === 'empty', 'a presentation comes: ' + none.status().text);
}

say(failures ? `\n${failures} FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
