/*
  test for lib/grouplib/SubgroupTables.js and SubgroupWorker.js: the table of the group
  drawn, its worker, its cache and the message 'Group Presentation Changed'

    node tests/subgroups/tables.mjs

  The worker here is the real SubgroupWorker.js run in this thread on a stand-in of self,
  its messages copied by structuredClone as a real worker's are, and answered when the
  test says so.

  1. nothing runs before the first current()
  2. a table from the worker is the table made in the page
  3. the same key: no job and no message
  4. a burst of changes: one job, one message
  5. one job at a time, of those waiting only the latest, a stale result goes to the cache
  6. the cache: a hit gives the message at once, the group going back during a job,
     the oldest table goes first
  7. no presentation, a failed job
  8. recalculate
  9. without a worker, a worker which fails, is slow to load, does not answer
*/

import {
    makeGroupTables, subgroupTable, presentationKey, MAX_CACHED_TABLES, MAX_MAX_INDEX, NO_TABLE,
} from '../../lib/grouplib/modules.js';

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
await import('../../lib/grouplib/SubgroupWorker.js');
const READY = sOutbox.shift();

/** SubgroupWorker.js behind the Worker interface: it answers when told to */
function makeFakeWorker(log) {
    const worker = {
        onmessage: null,
        onerror: null,
        jobs: [],
        terminated: false,
        postMessage(m) { log.push(presentationKeyOfRequest(m.request)); worker.jobs.push(structuredClone(m)); },
        terminate() { worker.terminated = true; },
        ready() { worker.onmessage({ data: READY }); },
        answer() {
            self.onmessage({ data: worker.jobs.shift() });
            worker.onmessage({ data: sOutbox.shift() });
        },
    };
    return worker;
}

const presentationKeyOfRequest = (r) => r.name || r.preset;

/** the tables of a stage with a worker: what the group is, the jobs and the messages */
function makeStage(pres = null, makeWorker) {
    const stage = { pres, jobs: [], messages: [], worker: null, made: 0 };
    stage.tables = makeGroupTables({
        getPresentation: () => stage.pres,
        onChanged:       (info) => stage.messages.push(info),
        makeWorker:      makeWorker || (() => {
            stage.made++;
            stage.worker = makeFakeWorker(stage.jobs);
            return stage.worker;
        }),
    });
    stage.setGroup = (next) => { stage.pres = next; stage.tables.update(); };
    return stage;
}

const P632 = { name: '632', label: '632', preset: 'wallpaper:632', family: 'wallpaper' };
const P442 = { name: '442', label: '442', preset: 'wallpaper:442', family: 'wallpaper' };
const P333 = { name: '333', label: '333', preset: 'wallpaper:333', family: 'wallpaper' };
const free = (n) => ({ name: 'F' + n, label: 'F' + n, gens: 'abcdefgh'.slice(0, n).split('').join(' '), relators: '' });

say('1. nothing before the first current()');
{
    const stage = makeStage(P632);
    stage.tables.update();
    await tick();
    check(stage.made === 0, 'no worker');
    check(stage.jobs.length === 0, 'no job');
    const info = stage.tables.current();
    check(info.state === 'calculating' && info.key === presentationKey(P632), 'calculating: ' + info.state);
    await tick();
    check(stage.made === 1, 'the worker is made');
    check(stage.jobs.length === 0, 'the job waits for its modules');
    stage.worker.ready();
    check(stage.jobs.length === 1, 'the job goes when it is ready');
}

say('2. a table from the worker');
{
    const stage = makeStage(P632);
    stage.tables.current();
    await tick();
    stage.worker.ready();
    check(stage.messages.length === 0, 'no message until the result');
    stage.worker.answer();
    await tick();
    check(stage.messages.length === 1, 'the message');
    const info = stage.messages[0];
    check(info === stage.tables.current(), 'the message has what current() gives');
    check(info.state === 'ready' && info.pres === P632 && info.key === presentationKey(P632), 'ready: ' + info.state);

    const here = subgroupTable(P632, { maxIndex: MAX_MAX_INDEX });
    check(JSON.stringify(info.data) === JSON.stringify(here), 'the table of the page');
    for (const name of ['presentation', 'generatorMode', 'geometry', 'dimension', 'family']) {
        check(JSON.stringify(info.data[name]) === JSON.stringify(here[name]), name + ' came with it');
        check(!Object.keys(info.data).includes(name), name + ' is hidden as it was');
    }
    check(info.data.stats && info.data.stats.aborted === false, 'and the stats');
    const entry = info.data.subgroups.find(s => s.index === 6);
    check(info.namer.nameOf(entry) === String(entry.subgroup), 'a table does not wait for names');
    await info.ensureNames(6);
    check(/^632\/.*\[6\]/.test(info.namer.nameOf(entry)), 'they come on request: ' + info.namer.nameOf(entry));
}

say('3. the same key');
{
    const stage = makeStage(P632);
    stage.tables.current();
    await tick();
    stage.worker.ready();
    stage.worker.answer();
    await tick();
    for (let i = 0; i < 5; i++) stage.setGroup({ ...P632 });
    await tick();
    check(stage.jobs.length === 1, 'no job: ' + stage.jobs.length);
    check(stage.messages.length === 1, 'no message: ' + stage.messages.length);
}

say('4. a burst');
{
    const stage = makeStage(P632);
    stage.tables.current();
    await tick();
    stage.worker.ready();
    stage.worker.answer();
    await tick();
    stage.setGroup(P442);
    stage.setGroup(free(2));
    stage.setGroup(P333);
    await tick();
    check(stage.jobs.length === 2, 'one job for the group it ends at: ' + stage.jobs.join());
    check(stage.jobs[1] === 'wallpaper:333', 'that group: ' + stage.jobs[1]);
    stage.worker.answer();
    await tick();
    check(stage.messages.length === 2 && stage.messages[1].pres === P333, 'one message');
}

say('5. one job at a time');
{
    const stage = makeStage(P632);
    stage.tables.current();
    await tick();
    stage.worker.ready();
    stage.setGroup(P442);
    await tick();
    stage.setGroup(P333);
    await tick();
    stage.setGroup(free(2));
    await tick();
    check(stage.jobs.length === 1, 'the first job runs, the others wait: ' + stage.jobs.join());

    stage.worker.answer();
    await tick();
    check(stage.messages.length === 0, 'a stale result gets no message');
    check(stage.jobs.length === 2 && stage.jobs[1] === 'F2', 'the latest goes next, not the one between: ' + stage.jobs.join());

    stage.worker.answer();
    await tick();
    check(stage.messages.length === 1 && stage.messages[0].pres.name === 'F2', 'the group drawn gets it');

    stage.setGroup(P632);
    await tick();
    check(stage.jobs.length === 2, 'the stale result was kept: no job for it');
    check(stage.messages.length === 2 && stage.messages[1].state === 'ready', 'and it gives the message');
}

say('6. the cache');
{
    const stage = makeStage(P632);
    stage.tables.current();
    await tick();
    stage.worker.ready();
    stage.worker.answer();
    await tick();
    const first = stage.messages[0];

    // going back during a job: the table was told, nothing is to be said
    stage.setGroup(P442);
    await tick();
    check(stage.tables.current().state === 'calculating', 'calculating');
    stage.setGroup(P632);
    check(stage.tables.current() === first, 'the group comes back with its table at once');
    stage.worker.answer();
    await tick();
    check(stage.messages.length === 1, 'and the job of the other one says nothing');

    // a hit
    stage.setGroup(P442);
    check(stage.tables.current().state === 'ready', 'a hit is ready at once');
    await tick();
    check(stage.jobs.length === 2, 'no job for a hit: ' + stage.jobs.join());
    check(stage.messages.length === 2 && stage.messages[1].pres === P442, 'the message of a hit');
    stage.setGroup(P632);
    await tick();
    check(stage.messages.length === 3 && stage.messages[2] === first, 'the same info again');

    // the oldest goes: P442 was used before P632, so it goes first
    for (let n = 1; n < MAX_CACHED_TABLES - 1 + 1; n++) {
        stage.setGroup(free(n));
        await tick();
        stage.worker.answer();
        await tick();
    }
    const jobs = stage.jobs.length;
    stage.setGroup(P632);
    await tick();
    check(stage.jobs.length === jobs, 'the table used last stays');
    stage.setGroup(P442);
    await tick();
    check(stage.jobs.length === jobs + 1, 'the oldest one has gone: ' + stage.jobs.slice(-1));
}

say('7. no presentation, a failed job');
{
    const stage = makeStage(null);
    check(stage.tables.current() === NO_TABLE, 'no presentation at the start');
    await tick();
    check(stage.made === 0 && stage.messages.length === 0, 'nothing to do, nothing to say');

    stage.setGroup(P632);
    await tick();
    stage.worker.ready();
    stage.worker.answer();
    await tick();
    stage.setGroup(null);
    await tick();
    check(stage.messages.length === 2 && stage.messages[1] === NO_TABLE, 'the presentation went');
    check(NO_TABLE.state === 'none' && NO_TABLE.data === null, 'and there is no table');

    const bad = { name: 'bad', label: 'bad', gens: 'a b', relators: 'a*(' };
    stage.setGroup(bad);
    await tick();
    stage.worker.answer();
    await tick();
    const info = stage.messages[stage.messages.length - 1];
    check(info.state === 'failed' && info.pres === bad && info.error, 'a failed job says why: ' + info.error);
    check(stage.messages.length === 3, 'with a message');
    stage.setGroup(P632);
    await tick();
    const jobs = stage.jobs.length;
    stage.setGroup(bad);
    await tick();
    check(stage.jobs.length === jobs + 1, 'it is tried again when the group comes back');
}

say('8. recalculate');
{
    const stage = makeStage(P632);
    stage.tables.current();
    await tick();
    stage.worker.ready();
    stage.worker.answer();
    await tick();
    const first = stage.messages[0];
    stage.tables.recalculate();
    check(stage.tables.current().state === 'calculating', 'calculating again');
    await tick();
    check(stage.jobs.length === 2, 'a job');
    stage.worker.answer();
    await tick();
    check(stage.messages.length === 2 && stage.messages[1].data !== first.data, 'a new table, a message');

    const none = makeStage(null);
    none.tables.current();
    none.tables.recalculate();
    await tick();
    check(none.made === 0, 'no presentation, nothing to calculate');
}

say('9. without a worker');
{
    const stage = makeStage(P632, () => null);
    stage.tables.current();
    await tick();
    check(stage.messages.length === 1 && stage.messages[0].state === 'ready', 'no worker: the table is made in the page');
    check(stage.messages[0].data.stats.aborted === false, 'the same table');

    // Worker does not exist in Node: the default falls back by itself
    const plain = makeGroupTables({ getPresentation: () => P632, onChanged: () => { plain.told = true; } });
    plain.current();
    await tick();
    check(plain.told === true && plain.current().state === 'ready', 'no Worker');

    // a worker which fails to load: the job runs in the page, and the next too
    const failing = makeStage(P632);
    failing.tables.current();
    await tick();
    failing.worker.onerror({ message: 'failed to load' });
    await tick();
    check(failing.messages.length === 1 && failing.messages[0].state === 'ready', 'a worker which fails');
    failing.setGroup(P442);
    await tick();
    check(failing.made === 1 && failing.jobs.length === 0, 'it is not used again');
    check(failing.messages.length === 2, 'the next table comes as well');
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
        const slow = makeStage(P632);
        slow.tables.current();
        await tick();
        check(timers.length === 1, 'a job waiting for the modules has a limit');
        fire(0);
        await tick();
        check(slow.messages.length === 1 && slow.messages[0].state === 'ready', 'a worker slow to load: the table is made in the page');
        slow.worker.ready();
        check(slow.jobs.length === 0, 'and it stays for the next job');
        slow.setGroup(P442);
        await tick();
        check(slow.jobs.length === 1, 'which goes to it');

        timers.length = 0;
        const stuck = makeStage(P632);
        stuck.tables.current();
        await tick();
        stuck.worker.ready();
        fire(timers.length - 1);
        await tick();
        check(stuck.worker.terminated, 'a worker which does not answer goes');
        const info = stuck.messages[0];
        check(stuck.messages.length === 1 && info.state === 'failed' && /did not answer/.test(info.error), 'and the job failed: ' + info.error);
        const old = stuck.worker;
        stuck.setGroup(P442);
        await tick();
        check(stuck.made === 2 && stuck.worker !== old, 'the next job has a new worker');
    } finally {
        globalThis.setTimeout = realSetTimeout;
    }
}

say(failures ? `\n${failures} FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
