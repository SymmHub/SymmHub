/*
  test for lib/grouplib/SubgroupNameJobs.js, SubgroupNamesWorker.js and the outside namer
  of SubgroupNames.js: the catalogue names of a table, an index at a time, in a worker

    node tests/subgroups/names.mjs

  The worker here is the real SubgroupNamesWorker.js run in this thread on a stand-in of
  self, its messages copied by structuredClone as a real worker's are, and answered when
  the test says so.

  1. an outside namer: ids until the names come, what it answers then
  2. names from the worker are the names made in the page, over domains and groups
  3. nothing to do: no catalogue, names which are there
  4. one promise per index, one job at a time, one table per switch, the group drawn first
  5. without a worker, a worker which fails, is slow to load, does not answer
  6. through the tables of SubgroupTables.js
*/

import {
    makeNameJobs, makeGroupTables, makeSubgroupNamer, subgroupTable, tableHidden, restoreHidden,
    Group_WP, MAX_MAX_INDEX,
} from '../../lib/grouplib/modules.js';
import { getWallpaperDomainShapes } from '../../lib/grouplib/WallpaperGroups.js';

const quiet = console.log;
console.log = () => {};
const warnings = [];
console.warn = (...a) => { warnings.push(a.join(' ')); };
const say = (...a) => quiet(...a);

let failures = 0;
function check(ok, msg) { if (!ok) { failures++; say('  FAIL:', msg); } return ok; }

const tick = () => new Promise(r => setTimeout(r, 0));

// ---- the worker -------------------------------------------------------------------------

let sOutbox = [];
Object.defineProperty(globalThis, 'self', {
    configurable: true,
    value: { postMessage: (m) => sOutbox.push(structuredClone(m)), onmessage: null },
});
await import('../../lib/grouplib/SubgroupNamesWorker.js');
const READY = sOutbox.shift();

/** SubgroupNamesWorker.js behind the Worker interface: it answers when told to */
function makeFakeWorker() {
    const worker = {
        onmessage: null,
        onerror: null,
        inbox: [],
        terminated: false,
        postMessage(m) { worker.inbox.push(structuredClone(m)); },
        terminate() { worker.terminated = true; },
        ready() { worker.onmessage({ data: READY }); },
        pending: () => worker.inbox.filter(m => m.type === 'names').length,
        tables: () => worker.inbox.filter(m => m.type === 'table').length,
        answer() {
            for (let m = worker.inbox.shift(); m; m = worker.inbox.shift()) {
                self.onmessage({ data: m });
                if (m.type === 'names') break;
            }
            worker.onmessage({ data: sOutbox.shift() });
        },
    };
    return worker;
}

function makeTable(pres, maxIndex = 12) {
    const data = subgroupTable(pres, { maxIndex });
    const namer = makeSubgroupNamer({ data, presentation: pres, family: pres.family, outside: true });
    return { data, pres, namer };
}

const pageNames = (table, index) =>
    makeSubgroupNamer({ data: table.data, presentation: table.pres, family: table.pres.family }).namesOfIndex(index);

const wallpaper = (type, domainShape) => new Group_WP({ type, domainShape }).getPresentation();

const P632 = wallpaper('632');
const P442 = wallpaper('442');

say('1. an outside namer');
{
    const table = makeTable(P632);
    const { namer, data } = table;
    const entry = data.subgroups.find(s => s.index === 7);
    check(namer.isCatalogue, 'a catalogue table');
    check(!namer.hasNames(7), 'no names yet');
    check(namer.nameOf(entry) === String(entry.subgroup), 'the sublib id stands in: ' + namer.nameOf(entry));
    const info = namer.infoOf(entry);
    check(info.type === null && info.key === null, 'and there is no type yet');
    check(namer.entryByName(String(entry.subgroup)) === entry, 'found by its id');

    const names = pageNames(table, 7);
    const name = names.find(n => n.subgroup === entry.subgroup).name;
    check(namer.indexOfName(name) === 7, 'the index in a name: ' + name);
    check(namer.indexOfName('442/442[7]') === null, 'not in a name of another group');
    check(namer.indexOfName(String(entry.subgroup)) === null, 'not in an id');
    check(namer.indexOfName('[select]') === null, 'not in anything else');
    check(namer.entryByName(name) === null, 'a name is unknown until it has come');

    namer.addNames(7, names);
    check(namer.hasNames(7) && !namer.hasNames(6), 'the names of that index');
    check(namer.nameOf(entry) === name, 'its name: ' + namer.nameOf(entry));
    check(namer.entryByName(name) === entry, 'found by its name');
    check(namer.entryByName(String(entry.subgroup)) === entry, 'and by its id still');
    check(namer.infoOf(entry).type !== null, 'with its type');

    namer.addNames(6, []);
    check(namer.hasNames(6), 'none will come: nothing waits');
    const six = data.subgroups.find(s => s.index === 6);
    check(namer.nameOf(six) === String(six.subgroup), 'the id stays');
}

say('2. names from the worker');
{
    const worker = makeFakeWorker();
    const jobs = makeNameJobs({ makeWorker: () => worker });
    const cases = [P632, P442, wallpaper('*2222'), wallpaper('22*'), wallpaper('3*3'), wallpaper('XX')];
    for (const type of ['632', '333', '442']) {
        for (const shape of getWallpaperDomainShapes(type)) cases.push(wallpaper(type, shape));
    }
    let ready = false;
    for (const pres of cases) {
        const table = makeTable(pres);
        const indices = [...new Set(table.data.subgroups.map(s => s.index))].filter(i => i <= 9);
        for (const index of indices) {
            const done = jobs.ensure(table, index);
            await tick();
            if (!ready) { worker.ready(); ready = true; }
            worker.answer();
            await done;
            const here = pageNames(table, index);
            for (const n of here) {
                const entry = table.data.subgroups.find(s => s.subgroup === n.subgroup);
                check(table.namer.nameOf(entry) === n.name, `${pres.label || pres.name} ${n.subgroup}: ${table.namer.nameOf(entry)} and ${n.name}`);
                const info = table.namer.infoOf(entry);
                check(info.type === n.type && info.key === n.key, `${n.subgroup}: type and key`);
            }
        }
    }
    check(warnings.length === 0, 'without a warning: ' + warnings.join(' | '));
}

say('3. nothing to do');
{
    const made = [];
    const jobs = makeNameJobs({ makeWorker: () => { made.push(1); return makeFakeWorker(); } });
    const pres = { name: 'F2', label: 'F2', gens: 'a b', relators: '' };
    const data = subgroupTable(pres, { maxIndex: 4 });
    const namer = makeSubgroupNamer({ data, presentation: pres, outside: true });
    const table = { data, pres, namer };
    check(!namer.isCatalogue && namer.hasNames(3), 'no catalogue: the ids are the names');
    await jobs.ensure(table, 3);
    check(made.length === 0, 'no worker for it');

    const named = makeTable(P632);
    named.namer.addNames(3, pageNames(named, 3));
    await jobs.ensure(named, 3);
    check(made.length === 0, 'and none for names which are there');
}

say('4. the jobs');
{
    const worker = makeFakeWorker();
    let drawn = null;
    const jobs = makeNameJobs({ makeWorker: () => worker, isDrawn: (table) => table === drawn });
    const A = makeTable(P632);
    const B = makeTable(P442);

    const p1 = jobs.ensure(A, 6);
    check(jobs.ensure(A, 6) === p1, 'one promise for an index, while it is on its way');
    await tick();
    check(worker.inbox.length === 0, 'the job waits for the modules');
    worker.ready();
    check(worker.tables() === 1 && worker.pending() === 1, 'the table, then the job');

    const p2 = jobs.ensure(A, 4);
    const p3 = jobs.ensure(B, 8);
    const p4 = jobs.ensure(B, 2);
    drawn = B;
    const p5 = jobs.ensure(A, 3);
    await tick();
    check(jobs.ensure(A, 6) === p1, 'the running one too');
    check(worker.pending() === 1, 'one job at a time: ' + worker.pending());

    worker.answer();
    await p1;
    check(A.namer.hasNames(6), 'the names of the first job');
    await tick();
    check(worker.inbox.filter(m => m.type === 'names')[0].index === 8, 'the group drawn first');
    check(worker.tables() === 1, 'with its table');
    worker.answer();
    await p3;
    await tick();
    check(worker.inbox.filter(m => m.type === 'names')[0].index === 2, 'in the order asked');
    check(worker.tables() === 0, 'the table is there');
    worker.answer();
    await p4;
    drawn = null;
    await tick();
    check(worker.inbox.filter(m => m.type === 'names')[0].index === 4, 'then the other tables');
    check(worker.tables() === 1, 'whose table goes again');
    worker.answer();
    await p2;
    await tick();
    check(worker.inbox.filter(m => m.type === 'names')[0].index === 3, 'all of them run');
    worker.answer();
    await p5;
    check(A.namer.hasNames(3) && A.namer.hasNames(4) && B.namer.hasNames(2) && B.namer.hasNames(8), 'all the names');

    // the worker's table is the table
    const here = makeTable(P632);
    const copy = structuredClone(here.data);
    check(copy.presentation === undefined, 'a clone loses what is hidden');
    restoreHidden(copy, structuredClone(tableHidden(here.data)));
    check(JSON.stringify(copy.presentation) === JSON.stringify(here.data.presentation), 'it comes back');
    check(!Object.keys(copy).includes('presentation') && copy.stats.aborted === false, 'hidden as it was');

    // an error in the worker: the ids stay
    const failing = makeTable(P632);
    const warned = warnings.length;
    const p6 = jobs.ensure(failing, 6);
    await tick();
    worker.onmessage({ data: { type: 'error', id: worker.inbox.at(-1).id, message: 'broken' } });
    await p6;
    worker.inbox.length = 0;
    check(failing.namer.hasNames(6) && warnings.length === warned + 1, 'an error ends the job, with a warning');
}

say('5. without a worker');
{
    const table = makeTable(P632);
    const none = makeNameJobs({ makeWorker: () => null });
    await none.ensure(table, 6);
    const entry = table.data.subgroups.find(s => s.index === 6);
    const name = pageNames(table, 6).find(n => n.subgroup === entry.subgroup).name;
    check(table.namer.nameOf(entry) === name, 'no worker: made in the page: ' + table.namer.nameOf(entry));

    const plain = makeNameJobs();
    const t2 = makeTable(P632);
    await plain.ensure(t2, 6);
    check(t2.namer.hasNames(6), 'no Worker');

    // a worker which fails to load: the job runs in the page, and the next too
    let made = 0;
    let worker = null;
    const failing = makeNameJobs({ makeWorker: () => { made++; worker = makeFakeWorker(); return worker; } });
    const t3 = makeTable(P632);
    const p = failing.ensure(t3, 6);
    await tick();
    worker.onerror({ message: 'failed to load' });
    await p;
    check(t3.namer.nameOf(entry) === name, 'a worker which fails');
    await failing.ensure(t3, 7);
    check(made === 1 && worker.inbox.length === 0 && t3.namer.hasNames(7), 'it is not used again');
    check(warnings.some(w => /failed to load/.test(w)), 'with a warning');

    // the timers of what does not answer
    const realSetTimeout = globalThis.setTimeout;
    const timers = [];
    const fire = (i) => { const f = timers[i].f; timers[i].f = () => {}; f(); };
    globalThis.setTimeout = (f, ms, ...rest) => {
        if (ms) { timers.push({ f, ms }); return timers.length; }
        return realSetTimeout(f, ms, ...rest);
    };
    try {
        let w = null;
        const slow = makeNameJobs({ makeWorker: () => { w = makeFakeWorker(); return w; } });
        const t4 = makeTable(P632);
        const p4 = slow.ensure(t4, 6);
        await tick();
        check(timers.length === 1, 'a job waiting for the modules has a limit');
        fire(0);
        await p4;
        check(t4.namer.nameOf(entry) === name, 'a worker slow to load: made in the page');
        w.ready();
        check(w.inbox.length === 0, 'it stays for the next job');
        slow.ensure(t4, 7);
        await tick();
        check(w.pending() === 1, 'which goes to it');

        timers.length = 0;
        let count = 0;
        const stuck = makeNameJobs({ makeWorker: () => { count++; w = makeFakeWorker(); return w; } });
        const t5 = makeTable(P632);
        const p5 = stuck.ensure(t5, 6);
        await tick();
        w.ready();
        const old = w;
        fire(timers.length - 1);
        await p5;
        check(old.terminated, 'a worker which does not answer goes');
        check(t5.namer.hasNames(6) && t5.namer.nameOf(entry) === String(entry.subgroup), 'and the ids stay');
        stuck.ensure(t5, 7);
        await tick();
        check(count === 2 && w !== old, 'the next job has a new worker');
    } finally {
        globalThis.setTimeout = realSetTimeout;
    }
}

say('6. through the tables');
{
    let worker = null;
    const tables = makeGroupTables({
        getPresentation: () => P632,
        makeNamesWorker: () => { worker = makeFakeWorker(); return worker; },
    });
    tables.current();
    await tick();
    const info = tables.current();
    check(info.state === 'ready' && worker === null, 'a table does not start the worker of names');
    const entry = info.data.subgroups.find(s => s.index === MAX_MAX_INDEX);
    const asked = info.ensureNames(entry.index);
    check(info.ensureNames(entry.index) === asked, 'one promise for whoever asks');
    await tick();
    worker.ready();
    worker.answer();
    await asked;
    check(/^632\//.test(info.namer.nameOf(entry)), 'the names are in the shared namer: ' + info.namer.nameOf(entry));
}

say(failures ? `\n${failures} FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
