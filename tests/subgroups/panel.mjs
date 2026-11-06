/*
  test for lib/grouplib/Subgroups.js: the subgroups folder of a colour layer, without
  a page, on a small layer of real params, the presentations of Group_WP and the
  tables of SubgroupTables.js, which in Node are made in the page

    node tests/subgroups/panel.mjs

  1. a table comes by itself, the first row says how it stands
  2. a change of the group: while the table is calculated nothing is offered and the
     permutations stay
  3. a new table: the permutations stay when they fit, a catalogue name follows the
     group, there and back, a sublib id does not, what was typed is left alone
  4. a table comes back with its presentation, the max index only cuts it
  5. picking a subgroup writes the permutations, the colours and the offset's range
  6. typing: the chooser follows, the mark says what does not fit; useOrbit
  7. a document: nothing overwritten, whatever order things come in; values saved
  8. the cut of a table is said, no presentation, a failed table
  9. two layers on one table
 10. names which come late: ids stand in, a name selected stays, what needs it waits
*/

import {
    Subgroups, Group_WP, Group_KLM, makeGroupTables, subgroupTable, entryPermutations,
    checkPermutations, makeSubgroupNamer, presentationKey, MAX_MAX_INDEX,
} from '../../lib/grouplib/modules.js';
import { getWallpaperDomainShapes } from '../../lib/grouplib/WallpaperGroups.js';
import { ParamString, ParamInt, ParamBool, getParamValues } from '../../lib/uilib/uilib.js';

const quiet = console.log;
console.log = () => {};
const say = (...a) => quiet(...a);

let failures = 0;
function check(ok, msg) { if (!ok) { failures++; say('  FAIL:', msg); } return ok; }

const tick = () => new Promise(r => setTimeout(r, 0));

function wallpaper(type, shape) {
    return new Group_WP({ type, domainShape: shape }).getPresentation();
}

/** the renderer's part: the group drawn, its tables, the layers which hear of them */
function makeStage(pres, makeNamesWorker) {
    const stage = { pres, layers: [] };
    stage.tables = makeGroupTables({
        getPresentation: () => stage.pres,
        onChanged:       () => stage.layers.forEach(l => l.panel.onPresentationChanged()),
        makeNamesWorker,
    });
    // the order of the renderer's onGroupChanged
    stage.change = (next) => {
        stage.pres = next;
        stage.tables.update();
        stage.layers.forEach(l => l.panel.onGroupChanged());
    };
    stage.setGroup = async (next) => {
        stage.change(next);
        await tick();
    };
    return stage;
}

/** a layer: the params the folder is given, and how often they were written */
function addLayer(stage, permutations = '') {
    const cf = { permutations, permIndex: 0, useOrbit: false, count: 6 };
    const state = { writes: 0, repaints: 0 };
    let params = null;
    const panel = Subgroups({
        getGroupTables: () => stage.tables,
        getLayerParams: () => params,
        onChange:       () => { state.repaints++; },
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
    const layer = {
        cf, state, panel, params, stage,
        setGroup: stage.setGroup,
        type:     (text) => params.permutations.setValue(text),
        status:   () => panel.getStatus(),
        choices:  () => panel.getChoices(),
        mark:     () => params.permutations.getMark(),
        maxIndex: (value) => panel.getParams().maxIndex.setValue(value),
    };
    stage.layers.push(layer);
    panel.getParams();
    return layer;
}

/** a layer on a group of its own, its first table in */
async function makeLayer(pres, permutations) {
    const layer = addLayer(makeStage(pres), permutations);
    await tick();
    return layer;
}

/** the subgroups of a table by name */
function tableOf(pres, maxIndex = MAX_MAX_INDEX) {
    const data = subgroupTable(pres, { maxIndex });
    const namer = makeSubgroupNamer({ data, presentation: pres, family: pres.family });
    return { data, namer, entries: data.subgroups, nameOf: (e) => namer.nameOf(e) };
}

const [SHAPE_A, SHAPE_B] = getWallpaperDomainShapes('632');
const A = wallpaper('632', SHAPE_A);
const B = wallpaper('632', SHAPE_B);
const C = wallpaper('442', getWallpaperDomainShapes('442')[0]);
check(!!SHAPE_B && presentationKey(A) !== presentationKey(B), 'the group has two domains of different presentations');
const TABLE_A = tableOf(A);
const ENTRY = TABLE_A.entries.find(e => Number(e.index) === 7);
const PERMS = entryPermutations(A, ENTRY);
const NAME = TABLE_A.nameOf(ENTRY);
const TABLE_B = tableOf(B);
const ENTRY_B = TABLE_B.namer.entryByName(NAME);
const PERMS_B = entryPermutations(B, ENTRY_B);
check(!!ENTRY_B && PERMS_B !== PERMS, 'the name is in the table of the other domain, with other permutations');

say('1. a table by itself');
{
    const layer = addLayer(makeStage(A), PERMS);
    check(layer.panel.getTable() === null, 'not at once');
    check(layer.status().state === 'calculating' && layer.status().text === 'calculating…', 'the row says so: ' + layer.status().text);
    check(layer.choices().indices.length === 1, 'nothing to choose from');
    await tick();
    check(layer.panel.getTable() !== null, 'the table is here');
    check(layer.status().state === 'ready', 'the row says so: ' + layer.status().text);
    check(layer.status().text.startsWith('632 · '), 'the row names the group: ' + layer.status().text);
    check(layer.choices().indices.length > 1, 'the indices are listed');
    check(layer.cf.permutations === PERMS && layer.state.writes === 0, 'the permutations stay');
    check(layer.choices().subgroup === NAME, 'their subgroup is selected: ' + layer.choices().subgroup);
    check(parseInt(layer.choices().index, 10) === 7, 'and its index: ' + layer.choices().index);
}

say('2. a change of the group');
{
    const layer = await makeLayer(A, PERMS);
    const writes = layer.state.writes;
    layer.stage.change(B);
    check(layer.cf.permutations === PERMS && layer.state.writes === writes, 'the permutations stay');
    check(layer.status().state === 'calculating', 'the row says it is on its way: ' + layer.status().text);
    check(layer.panel.getTable() === null, 'the old table goes');
    check(layer.choices().indices.length === 1, 'the subgroups of the old table are not offered');
    check(layer.choices().subgroup === NAME, 'the name stays selected: ' + layer.choices().subgroup);
    check(layer.mark() !== null, 'the mark says they do not fit: ' + layer.mark());
    layer.panel.setSubgroup(NAME);
    check(layer.cf.permutations === PERMS, 'the name with no table applies nothing');
    await tick();
    check(layer.status().state === 'ready', 'the table comes: ' + layer.status().text);
}

say('3. a new table');
{
    // the permutations are in the table, up to the numbering of the colours as well
    const renumbered = PERMS.split(' ').map(p => {
        // conjugate by the swap of colours 0 and 1
        const v = [...p].map(c => c.charCodeAt(0) - 97);
        const s = (i) => (i < 2 ? 1 - i : i);
        return v.map((_, i) => String.fromCharCode(97 + s(v[s(i)]))).join('');
    }).join(' ');
    check(renumbered !== PERMS, 'the colours are renumbered');
    const conjugate = await makeLayer(A, renumbered);
    check(conjugate.cf.permutations === renumbered, 'conjugate permutations stay');
    check(conjugate.choices().subgroup !== '[select]', 'their class is selected');

    // the name is there, the permutations are not: the same colour group on the new domain
    const named = await makeLayer(A, PERMS);
    await named.setGroup(B);
    check(named.cf.permutations === PERMS_B, 'the permutations of the name are written');
    check(named.choices().subgroup === NAME, 'the same name');
    check(named.cf.count === 7, 'the colours follow');
    check(named.mark() === null, 'they fit: ' + named.mark());

    // there and back: the same subgroups, also when what is written on the way fits
    // the first domain as another subgroup, which happens in 333
    const [SHAPE_P, SHAPE_Q] = getWallpaperDomainShapes('333');
    const P333 = wallpaper('333', SHAPE_P);
    const Q333 = wallpaper('333', SHAPE_Q);
    const round = await makeLayer(P333);
    let taken = 0, overlaps = 0;
    for (const choice of round.choices().indices.filter(c => parseInt(c, 10) <= 9)) {
        round.panel.setIndex(choice);
        await tick();
        for (const name of round.choices().subgroups.filter(s => s !== '[select]')) {
            round.panel.setSubgroup(name);
            const perms = round.cf.permutations;
            await round.setGroup(Q333);
            check(round.choices().subgroup === name, `${name}: the same name on the other domain`);
            if (checkPermutations(P333, round.cf.permutations).ok && round.cf.permutations !== perms) overlaps++;
            await round.setGroup(P333);
            check(round.choices().subgroup === name, `${name}: and back: ${round.choices().subgroup}`);
            check(round.cf.permutations === perms, `${name}: its permutations are back`);
            taken++;
        }
    }
    check(taken > 5 && overlaps > 0, `there and back over ${taken} subgroups, ${overlaps} of them on permutations which fit both`);

    // another group: nothing of that name
    const other = await makeLayer(A, PERMS);
    await other.setGroup(C);
    check(other.cf.permutations === PERMS, 'another group: the permutations stay');
    check(other.choices().subgroup === '[select]', 'nothing is selected');
    check(other.mark() !== null, 'the mark says so');

    // permutations which fit are not replaced, whatever name is selected
    const fits = await makeLayer(A, PERMS);
    const another = TABLE_A.entries.find(e => e !== ENTRY && Number(e.index) === 7) ||
                    TABLE_A.entries.find(e => e !== ENTRY && Number(e.index) === 6);
    await fits.setGroup(C);
    await fits.setGroup(A);
    check(fits.cf.permutations === PERMS && fits.state.writes === 0, 'what fits stays');
    check(fits.choices().subgroup === NAME, 'and the chooser finds it again: ' + fits.choices().subgroup);
    check(!!another, 'another subgroup to test with');

    // a sublib id is no name to follow: in another group it is another subgroup
    const klm = (K, L, M) => { const maker = new Group_KLM(); Object.assign(maker.params, { K, L, M }); return maker.getPresentation(); };
    const P = klm(3, 4, 3);
    const Q = { ...klm(3, 5, 3), name: P.name };
    const tableP = tableOf(P, 8);
    const tableQ = tableOf(Q, 8);
    const id = tableP.entries.find(e => tableQ.namer.entryByName(e.subgroup) && e.index > 1);
    check(!!id, 'one id in both tables: ' + (id && id.subgroup));
    const sublib = await makeLayer(P, entryPermutations(P, id));
    check(sublib.choices().subgroup === id.subgroup, 'a sublib id is selected: ' + sublib.choices().subgroup);
    await sublib.setGroup(Q);
    check(sublib.cf.permutations === entryPermutations(P, id), 'and it does not follow the group');

    // neither: typed permutations are not overwritten
    const typed = 'abc bca';
    const neither = await makeLayer(B, typed);
    check(neither.cf.permutations === typed && neither.state.writes === 0, 'what was typed stays');
    check(neither.choices().subgroup === '[select]', 'nothing is selected');

    // typed, even when it is a subgroup's: it waits for a table first
    const late = await makeLayer(A, '');
    late.type(PERMS);
    await tick();
    check(late.choices().subgroup === NAME, 'the chooser finds it');
    await late.setGroup(B);
    check(late.cf.permutations === PERMS, 'typed permutations do not follow the group');
    await late.setGroup(A);
    await late.setGroup(B);
    check(late.cf.permutations === PERMS_B, 'once a table of their group came they do');
}

say('4. a table comes back, the max index');
{
    const layer = await makeLayer(A, PERMS);
    const table = layer.panel.getTable();
    await layer.setGroup(C);
    await layer.setGroup(A);
    check(layer.panel.getTable() === table, 'the same table');
    check(layer.status().state === 'ready', 'it is ready at once');
    check(layer.choices().indices.length > 1, 'its subgroups are offered again');
    check(layer.choices().subgroup === NAME, 'the subgroup is selected again');

    layer.maxIndex(12);
    check(layer.status().text === `632 · ${layer.panel.getTable().subgroups.length} to index 12`, 'the max index is said: ' + layer.status().text);
    check(layer.panel.getTable().subgroups.every(s => Number(s.index) <= 12), 'the table is cut there');
    check(layer.panel.getTable().subgroups[0] === table.subgroups[0], 'the same entries');
    check(layer.choices().subgroup === NAME, 'the subgroup is still in it');
    layer.maxIndex(24);
    check(layer.panel.getTable() === table, 'the whole table comes back');

    layer.maxIndex(6);
    check(layer.cf.permutations === PERMS, 'a table too small for the subgroup leaves the permutations');
    check(layer.choices().subgroup === '[select]', 'and selects nothing');
    check(!layer.choices().indices.some(c => parseInt(c, 10) > 6), 'the indices stop at the max index');
    layer.panel.setIndex(layer.choices().indices[layer.choices().indices.length - 1]);
    check(layer.cf.permutations !== PERMS, 'what is listed can be picked');
    layer.type(PERMS);
    check(layer.choices().subgroup === '[select]', 'typing finds nothing above the max index');
    layer.maxIndex(24);
    await tick();
    check(layer.choices().subgroup === NAME, 'and with the max index up it is found');
    check(layer.cf.permutations === PERMS, 'the permutations stayed all along');
}

say('5. picking');
{
    const layer = await makeLayer(A);
    const choice = layer.choices().indices.find(c => parseInt(c, 10) === 7);
    layer.panel.setIndex(choice);
    await tick();
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

    // what was picked goes with the group: a layer added late follows it as well
    const stage = makeStage(A);
    await (async () => { stage.tables.current(); await tick(); })();
    const added = addLayer(stage);
    added.panel.onGroupChanged();
    added.panel.setSubgroup(TABLE_A.entries.indexOf(ENTRY) >= 0 ? ENTRY.subgroup : NAME);
    await tick();
    check(added.choices().subgroup === NAME, 'picked under its id, then it has its name');
    await added.setGroup(B);
    check(added.cf.permutations === PERMS_B, 'a picked subgroup follows the group');
}

say('6. typing');
{
    const layer = await makeLayer(A);
    layer.type(PERMS);
    await tick();
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

    // typed with no table the name goes: it must not write over what was typed
    const noTable = await makeLayer(A, PERMS);
    noTable.panel.setParamsMap({ subgroup: NAME }, true);
    noTable.type('abc bca');
    check(noTable.choices().subgroup === '[select]', 'typing clears the name');
    await tick();
    check(noTable.cf.permutations === 'abc bca', 'and the table leaves what was typed');

    // what fits depends on the way the layer composes
    const pres = wallpaper('4*2', '4-*-*2-* square');
    const entries = subgroupTable(pres, { maxIndex: 8 }).subgroups;
    const bad = entries.find(e => !checkPermutations(pres, e.invcos, false).ok);
    check(!!bad, 'permutations which fit with useOrbit only');
    const orbit = await makeLayer(pres, bad.invcos);
    check(orbit.cf.permutations === bad.invcos, 'the first table writes nothing, even on what does not fit');
    const off = orbit.mark();
    orbit.params.useOrbit.setValue(true);
    const on = orbit.mark();
    check(off !== null && on === null, `useOrbit changes the mark: off ${off}, on ${on}`);
    await tick();
    check(orbit.cf.permutations === bad.invcos, 'what fits stays');

    // the other reading of the subgroup, when useOrbit is changed
    orbit.params.useOrbit.setValue(false);
    await tick();
    check(orbit.cf.permutations === bad.cosets, 'the reading which fits is written');
    check(orbit.mark() === null, 'and the mark goes: ' + orbit.mark());
    orbit.params.useOrbit.setValue(true);
    await tick();
    check(orbit.cf.permutations === bad.invcos, 'and back');

    // what is not in the table: there is nothing to write
    const lost = await makeLayer(pres, 'abc bca');
    lost.params.useOrbit.setValue(true);
    await tick();
    check(lost.cf.permutations === 'abc bca', 'useOrbit on what is not in the table');
}

/** a document coming in, in the order of a load: the layer, then the group */
function load(layer, { permutations, useOrbit, subgroups, group }) {
    if (permutations !== undefined) layer.params.permutations.setValue(permutations);
    if (useOrbit !== undefined) layer.params.useOrbit.setValue(useOrbit);
    if (subgroups !== undefined) layer.panel.setParamsMap(subgroups, true);
    if (group !== undefined) layer.stage.change(group);
}

say('7. a document');
{
    const layer = await makeLayer(A, PERMS);
    layer.maxIndex(24);
    const saved = getParamValues(layer.panel.getParams());
    check(saved.maxIndex === 24 && saved.subgroup === NAME, 'the max index and the name are saved: ' + JSON.stringify(saved));
    check(!('index' in saved) && !('status' in saved), 'the rest is not: ' + JSON.stringify(saved));

    // the same group, so no message comes
    const writes = layer.state.writes;
    load(layer, { subgroups: { maxIndex: 16, subgroup: NAME } });
    check(layer.panel.getTable() === null, 'the table waits for the document');
    check(layer.choices().subgroup === NAME, 'the name is shown');
    check(getParamValues(layer.panel.getParams()).maxIndex === 16, 'the max index is read');
    await tick();
    check(layer.panel.getTable() !== null, 'the table is there when the document is');
    check(layer.status().state === 'ready', 'the row says so: ' + layer.status().text);
    check(layer.state.writes === writes && layer.cf.permutations === PERMS, 'the permutations stay');
    check(layer.choices().subgroup === NAME, 'and its subgroup is selected');

    // the group of the document comes after its layers, and the table there is another group's
    const moved = await makeLayer(C, '');
    load(moved, { permutations: PERMS, subgroups: { subgroup: NAME }, group: A });
    check(moved.choices().subgroup === NAME, 'the name is kept while the table comes');
    await tick();
    check(moved.cf.permutations === PERMS && moved.choices().subgroup === NAME, 'the document comes out right');

    // and it may be a hit
    const hit = await makeLayer(A, '');
    await hit.setGroup(C);
    load(hit, { permutations: PERMS, subgroups: { subgroup: NAME }, group: A });
    await tick();
    check(hit.cf.permutations === PERMS && hit.choices().subgroup === NAME, 'with the table of its group in the cache');

    // a document's permutations are not replaced, even when they do not fit and the name is there
    const stale = await makeLayer(A, PERMS);
    await tick();
    const count = stale.state.writes;
    load(stale, { permutations: PERMS, subgroups: { subgroup: NAME }, group: B });
    await tick();
    check(stale.cf.permutations === PERMS, 'permutations of another domain stay in a document');
    check(stale.state.writes === count + 1, 'written once, by the document');
    check(stale.mark() !== null, 'with the mark');
    check(stale.choices().subgroup === NAME, 'its name is selected');
    await stale.setGroup(A);
    check(stale.cf.permutations === PERMS, 'they fit when the group comes');
    await stale.setGroup(B);
    check(stale.cf.permutations === PERMS_B, 'and only a change of the group after that follows');

    // without the folder in the document
    const partial = await makeLayer(A, PERMS);
    load(partial, { permutations: PERMS, group: B });
    await tick();
    check(partial.cf.permutations === PERMS, 'a document with no subgroups folder: nothing written');

    // useOrbit of a document is not mended
    const pres = wallpaper('4*2', '4-*-*2-* square');
    const bad = subgroupTable(pres, { maxIndex: 8 }).subgroups.find(e => !checkPermutations(pres, e.invcos, false).ok);
    const orbit = await makeLayer(pres, bad.cosets);
    load(orbit, { permutations: bad.cosets, useOrbit: true, subgroups: {} });
    await tick();
    check(orbit.cf.permutations === bad.cosets, 'useOrbit in a document leaves its permutations');

    // the keys of older documents are not read
    const older = await makeLayer(A, PERMS);
    load(older, { subgroups: { groupType: 'wp', groupName: '632', fileName: 'x.json', index: '7(2)', subgroup: 'old.7.1' } });
    check(older.choices().subgroup === 'old.7.1', 'an older document opens with its name');
    await tick();
    check(older.cf.permutations === PERMS, 'the permutations stay');
    check(older.choices().subgroup === NAME, 'and the table names them');

    older.panel.setParamsMap({ maxIndex: 500 }, false);
    check(getParamValues(older.panel.getParams()).maxIndex === 24, 'the max index is clamped');
}

say('8. cuts, no presentation, a failed table');
{
    const free = await makeLayer({ name: 'F2', label: 'F2', gens: 'a b', relators: '' });
    check(/more at \d+/.test(free.status().text), 'a cut is said: ' + free.status().text);
    free.maxIndex(3);
    check(!/more at/.test(free.status().text) && /to index 3/.test(free.status().text), 'not one of the max index: ' + free.status().text);

    const none = await makeLayer(null, PERMS);
    check(none.status().state === 'none' && none.status().text === 'no presentation', 'no presentation: ' + none.status().text);
    check(none.panel.getTable() === null, 'no table');
    check(none.cf.permutations === PERMS && none.mark() === null, 'the permutations are left alone');
    await none.setGroup(A);
    check(none.status().state === 'ready', 'a presentation comes: ' + none.status().text);
    check(none.choices().subgroup === NAME, 'and the table finds the permutations');
    await none.setGroup(null);
    check(none.status().state === 'none', 'it goes');
    check(none.panel.getTable() === null, 'and so does the table');
    check(none.cf.permutations === PERMS, 'the permutations stay');

    const warn = console.warn;
    console.warn = () => {};
    const failed = await makeLayer({ name: 'bad', label: 'bad', gens: 'a b', relators: 'a*(' }, PERMS);
    console.warn = warn;
    check(failed.status().state === 'failed' && failed.status().text === 'no table', 'a failed table: ' + failed.status().text);
    check(failed.panel.getTable() === null && failed.cf.permutations === PERMS, 'nothing changes');
}

say('9. two layers on one table');
{
    const stage = makeStage(A);
    const one = addLayer(stage, PERMS);
    const two = addLayer(stage, '');
    await tick();
    check(one.panel.getTable() === two.panel.getTable(), 'one table');
    check(one.status().state === 'ready' && two.status().state === 'ready', 'both are told');
    two.maxIndex(4);
    check(one.panel.getTable().maxIndex === 24 && two.panel.getTable().maxIndex === 4, 'each with its max index');
    two.panel.setSubgroup(two.choices().subgroups[0]);
    two.panel.setIndex(two.choices().indices[two.choices().indices.length - 1]);
    await tick();
    const perms = two.cf.permutations;
    check(perms !== '', 'the second picks its own');
    await stage.setGroup(B);
    check(one.cf.permutations === PERMS_B, 'the first follows the group');
    check(one.status().state === 'ready' && two.status().state === 'ready', 'both have the new table, nobody asked');
    check(two.cf.permutations !== perms && two.mark() === null, 'and so does the second');
}

say('10. names which come late');
{
    // names made here, and handed over when the test says so
    function makeStageOfNames(pres) {
        const stage = makeStage(pres, () => {
            const worker = { onmessage: null, onerror: null, table: null, jobs: [], tables: 0,
                             terminate() {},
                             postMessage(m) {
                                 if (m.type === 'table') { worker.tables++; worker.table = m; }
                                 else worker.jobs.push({ ...m, table: worker.table });
                             } };
            stage.namesWorker = worker;
            queueMicrotask(() => worker.onmessage({ data: { type: 'ready' } }));
            return worker;
        });
        stage.answer = async () => {
            const worker = stage.namesWorker;
            const job = worker.jobs.shift();
            const namer = makeSubgroupNamer({ data: job.table.data, presentation: job.table.presentation, family: job.table.family });
            worker.onmessage({ data: { type: 'done', id: job.id, names: namer.namesOfIndex(job.index) } });
            await tick();
        };
        stage.answerAll = async () => {
            while (stage.namesWorker && stage.namesWorker.jobs.length) await stage.answer();
        };
        return stage;
    }
    const idOf = (entry) => String(entry.subgroup);

    // permutations of a document: found at once, under the id, then under the name
    {
        const stage = makeStageOfNames(A);
        const layer = addLayer(stage, PERMS);
        await tick();
        check(layer.choices().subgroup === idOf(ENTRY), 'the id stands in: ' + layer.choices().subgroup);
        check(parseInt(layer.choices().index, 10) === 7, 'its index is selected');
        check(layer.choices().subgroups.includes(idOf(ENTRY)), 'the list has ids');
        check(/, naming…$/.test(layer.status().text), 'the row says so: ' + layer.status().text);
        check(layer.state.writes === 0, 'nothing written');
        await stage.answerAll();
        check(layer.choices().subgroup === NAME, 'then the name: ' + layer.choices().subgroup);
        check(layer.choices().subgroups.includes(NAME) && !layer.choices().subgroups.includes(idOf(ENTRY)), 'and the list has names');
        check(!/naming/.test(layer.status().text), 'the row is done: ' + layer.status().text);
        check(layer.state.writes === 0 && layer.cf.permutations === PERMS, 'still nothing written');
    }

    // a document's name, no permutations of that subgroup: the name stays selected
    {
        const stage = makeStageOfNames(A);
        const layer = addLayer(stage, '');
        await tick();
        layer.panel.setParamsMap({ subgroup: NAME }, true);
        await tick();
        check(layer.choices().subgroup === NAME, 'a name of an index not named stays: ' + layer.choices().subgroup);
        check(parseInt(layer.choices().index, 10) === 7, 'its index is read off it: ' + layer.choices().index);
        await stage.answerAll();
        check(layer.choices().subgroup === NAME, 'and it is found');
        check(layer.cf.permutations === '', 'nothing written');
        const saved = getParamValues(layer.panel.getParams());
        check(saved.subgroup === NAME, 'it is saved');
    }

    // a name of another group is not looked for
    {
        const stage = makeStageOfNames(C);
        const layer = addLayer(stage, '');
        await tick();
        layer.panel.setParamsMap({ subgroup: NAME }, true);
        await tick();
        check(!stage.namesWorker, 'no names for it: no worker');
        check(layer.choices().subgroup === '[select]', 'and it goes');
    }

    // picking while the names of the index are coming
    {
        const stage = makeStageOfNames(A);
        const layer = addLayer(stage, '');
        await tick();
        const choice = layer.choices().indices.find(c => parseInt(c, 10) === 7);
        const row = layer.panel.getParams().status;
        const setName = row.setName;
        let shown = '';
        row.setName = (text) => { shown = text; setName(text); };
        layer.panel.setIndex(choice);
        check(/, naming…$/.test(shown), 'the row says so at once: ' + shown);
        await tick();
        const first = layer.choices().subgroup;
        check(TABLE_A.data.subgroups.some(s => idOf(s) === first), 'picked under an id: ' + first);
        check(layer.cf.permutations !== '', 'written at once');
        check(layer.cf.count === 7, 'with its colours');
        const perms = layer.cf.permutations;
        await stage.answerAll();
        const named = layer.choices().subgroup;
        check(!/naming/.test(shown), 'the row is done: ' + shown);
        check(/^632\//.test(named), 'then it has its name: ' + named);
        check(TABLE_A.namer.nameOf(TABLE_A.data.subgroups.find(s => idOf(s) === first)) === named, 'the name of that subgroup');
        check(layer.cf.permutations === perms, 'the permutations stay');
    }

    // the group changes: the name is needed in the new table
    {
        const stage = makeStageOfNames(A);
        const layer = addLayer(stage, PERMS);
        await tick();
        await stage.answerAll();
        const writes = layer.state.writes;
        await stage.setGroup(B);
        check(layer.status().state === 'ready', 'the table is here');
        check(layer.choices().subgroup === NAME, 'the name stays while its index is named: ' + layer.choices().subgroup);
        check(layer.cf.permutations === PERMS && layer.state.writes === writes, 'nothing written yet');
        check(layer.mark() !== null, 'with the mark');
        check(stage.namesWorker.tables === 2, 'the worker got the new table: ' + stage.namesWorker.tables);
        await stage.answerAll();
        check(layer.cf.permutations === PERMS_B, 'then the group is followed');
        check(layer.choices().subgroup === NAME && layer.mark() === null, 'under the same name');
        check(layer.cf.count === 7, 'with its colours');
        check(layer.state.repaints > 0, 'and the layer is told');
    }

    // the group changes before the names of the subgroup came: an id means nothing there
    {
        const stage = makeStageOfNames(A);
        const layer = addLayer(stage, '');
        await tick();
        layer.panel.setSubgroup(idOf(ENTRY));
        await tick();
        check(layer.choices().subgroup === idOf(ENTRY), 'picked under the id');
        await stage.setGroup(B);
        check(layer.choices().subgroup === idOf(ENTRY), 'it stays: ' + layer.choices().subgroup);
        check(layer.cf.permutations === PERMS, 'nothing written yet');
        await stage.answerAll();
        check(layer.cf.permutations === PERMS_B, 'the name came, the group is followed: ' + layer.cf.permutations);
        check(layer.choices().subgroup === NAME, 'under its name: ' + layer.choices().subgroup);
    }

    // a document and the group changes before the names came: the first table was its own
    {
        const stage = makeStageOfNames(A);
        const layer = addLayer(stage, PERMS);
        await tick();
        layer.panel.setParamsMap({ subgroup: NAME }, true);
        await tick();
        await stage.setGroup(B);
        await stage.answerAll();
        check(layer.cf.permutations === PERMS_B, 'it follows as if the names had been there');
    }

    // names which come after typing change nothing about what was typed: it does not
    // follow the group, the same as when they had been there
    {
        const stage = makeStageOfNames(A);
        const layer = addLayer(stage, '');
        await tick();
        layer.type(PERMS);
        await tick();
        await stage.answerAll();
        check(layer.choices().subgroup === NAME, 'the chooser finds it');
        await stage.setGroup(B);
        await stage.answerAll();
        check(layer.cf.permutations === PERMS, 'typed permutations do not follow the group');
    }

    // typing while a name is coming: what was typed wins
    {
        const stage = makeStageOfNames(A);
        const layer = addLayer(stage, PERMS);
        await tick();
        await stage.answerAll();
        await stage.setGroup(B);
        layer.type('abc bca');
        await stage.answerAll();
        check(layer.cf.permutations === 'abc bca', 'typed stays');
        check(layer.choices().subgroup === '[select]', 'nothing is selected');
    }

    // a bad end: the names do not come, the ids stay and nothing hangs
    {
        const stage = makeStageOfNames(A);
        const layer = addLayer(stage, PERMS);
        await tick();
        const job = stage.namesWorker.jobs.shift();
        const warn = console.warn;
        console.warn = () => {};
        stage.namesWorker.onmessage({ data: { type: 'error', id: job.id, message: 'no' } });
        await tick();
        console.warn = warn;
        check(layer.choices().subgroup === idOf(ENTRY), 'the id stays: ' + layer.choices().subgroup);
        check(!/naming/.test(layer.status().text), 'no naming: ' + layer.status().text);
    }

    // not a wallpaper group: no names to wait for
    {
        const klm = new Group_KLM();
        Object.assign(klm.params, { K: 3, L: 4, M: 3 });
        const stage = makeStageOfNames(klm.getPresentation());
        const layer = addLayer(stage, '');
        await tick();
        layer.panel.setIndex(layer.choices().indices[2]);
        await tick();
        check(!stage.namesWorker, 'the ids are the names: no worker');
        check(!/naming/.test(layer.status().text), 'and no naming');
    }
}

say(failures ? `\n${failures} FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
