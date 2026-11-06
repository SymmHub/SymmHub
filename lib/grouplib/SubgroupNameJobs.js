import {
    makeSubgroupNamer,
    tableHidden,
} from './modules.js';

const MYNAME = 'SubgroupNameJobs';

/*
  SubgroupNameJobs.js — the catalogue names of the tables of SubgroupTables.js, made in a
  worker: an index can take seconds, which the page cannot spare (SubgroupNames.js).

  ensure(table, index) is a promise of the names of an index of a table, shared by
  whoever asks. It resolves when they are in table.namer, and also when they will not
  come: then the sublib ids stay the names. A table is {data, pres, namer}.

  - Names are made per index and on demand: naming a whole group takes up to 30 s, and a
    chooser shows one index.
  - One job at a time: those of the group drawn first, the others in the order asked. All
    of them run, a layer may wait for a name of the group it left.
  - The job runs in a module worker (SubgroupNamesWorker.js), kept between jobs, made when
    first needed, which says 'ready' when its modules are loaded. grouplib is 2 MB, so
    that can take seconds, and a layer goes on with sublib ids meanwhile. Without Worker
    (Node, tests), or when it fails, or is not ready within START_LIMIT ms, the job runs
    in the page.
*/

// how long a job waits for the worker to load its modules before it runs in the page
const START_LIMIT = 30000;
// the longest index takes 9 s here: a worker silent for this long has got stuck
const ANSWER_LIMIT = 120000;

function makeNamesWorker() {
    if (typeof Worker === 'undefined') return null;
    try {
        return new Worker(new URL('./SubgroupNamesWorker.js', import.meta.url), { type: 'module' });
    } catch (e) {
        console.warn(`${MYNAME}: no worker (${e.message}), names are made in the page`);
        return null;
    }
}

/**
 * @param {object}   [options]
 * @param {function} [options.isDrawn]     (table) => is it the table of the group drawn?
 * @param {function} [options.makeWorker]  () => a Worker or null, for the tests
 * @returns {{ensure: function}}
 */
export function makeNameJobs(options = {}) {

    const makeWorker = options.makeWorker || makeNamesWorker;
    const isDrawn = options.isDrawn || (() => false);

    const mQueue = [];              // the jobs waiting, in the order asked
    const mNamers = new WeakMap();  // table -> the namer which makes its names in the page
    let mRunning = null;            // {id, table, index, promise, resolve, posted, timer}
    let mScheduled = false;
    let mWorker = null;             // {worker, state: 'loading' | 'ready' | 'failed', sent}
    let mLastId = 0;

    function ensure(table, index) {
        if (table.namer.hasNames(index)) return Promise.resolve();
        const same = (job) => job && job.table === table && job.index === index;
        const running = same(mRunning) ? mRunning : mQueue.find(same);
        if (running) return running.promise;
        const job = { id: ++mLastId, table, index, posted: false, timer: null };
        job.promise = new Promise(resolve => { job.resolve = resolve; });
        mQueue.push(job);
        schedule();
        return job.promise;
    }

    function schedule() {
        if (mScheduled) return;
        mScheduled = true;
        queueMicrotask(next);
    }

    function next() {
        mScheduled = false;
        if (mRunning || mQueue.length === 0) return;
        const drawn = mQueue.findIndex(job => isDrawn(job.table));
        mRunning = mQueue.splice(Math.max(drawn, 0), 1)[0];
        start(mRunning);
    }

    function start(job) {
        if (!mWorker) mWorker = connect();
        if (!mWorker || mWorker.state === 'failed') {
            runInPage(job);
        } else if (mWorker.state === 'ready') {
            post(job);
        } else {
            // a slow worker goes on loading for the next job
            job.timer = setTimeout(() => {
                console.warn(`${MYNAME}: the worker did not load its modules within ${START_LIMIT / 1000} s, names are made in the page`);
                runInPage(job);
            }, START_LIMIT);
        }
    }

    function finish(job, names) {
        clearTimeout(job.timer);
        if (mRunning !== job) return;
        mRunning = null;
        job.table.namer.addNames(job.index, names);
        job.resolve();
        schedule();
    }

    function runInPage(job) {
        const { table, index } = job;
        if (!mNamers.has(table)) {
            const { data, pres } = table;
            mNamers.set(table, makeSubgroupNamer({ data, presentation: pres, family: pres.family }));
        }
        let names = [];
        try {
            names = mNamers.get(table).namesOfIndex(index);
        } catch (e) {
            console.warn(`${MYNAME}: no names for index ${index}: ${e.message}`);
        }
        finish(job, names);
    }

    // ---- the worker ------------------------------------------------------------------

    function connect() {
        const worker = makeWorker();
        if (!worker) return null;
        const entry = { worker, state: 'loading', sent: null };
        worker.onmessage = (e) => onWorkerMessage(entry, e.data || {});
        worker.onerror = (e) => {
            if (e.preventDefault) e.preventDefault();
            entry.state = 'failed';
            console.warn(`${MYNAME}: the worker failed (${(e && e.message) || 'it failed'}), names are made in the page`);
            if (mRunning) runInPage(mRunning);
        };
        return entry;
    }

    function onWorkerMessage(entry, m) {
        if (m.type === 'ready') {
            entry.state = 'ready';
            if (mRunning && !mRunning.posted) post(mRunning);
        } else if (mRunning && m.id === mRunning.id) {
            if (m.type === 'error') console.warn(`${MYNAME}: no names for index ${mRunning.index}: ${m.message}`);
            finish(mRunning, m.names || []);
        }
    }

    function post(job) {
        const entry = mWorker;
        const { table, index, id } = job;
        job.posted = true;
        clearTimeout(job.timer);
        job.timer = setTimeout(() => {
            console.warn(`${MYNAME}: the worker did not answer, index ${index} keeps its sublib ids`);
            entry.worker.terminate();
            if (mWorker === entry) mWorker = null;
            finish(job, []);
        }, ANSWER_LIMIT);
        if (entry.sent !== table) {
            entry.sent = table;
            const { name, domainShape, preset, family } = table.pres;
            entry.worker.postMessage({
                type: 'table', presentation: { name, domainShape, preset }, family,
                data: table.data, hidden: tableHidden(table.data),
            });
        }
        entry.worker.postMessage({ type: 'names', id, index });
    }

    return { ensure };
}
