import {
    MAX_MAX_INDEX,
    presentationKey,
    tableRequest,
    subgroupsData,
    restoreHidden,
    makeSubgroupNamer,
    makeNameJobs,
} from './modules.js';

const MYNAME = 'SubgroupTables';

/*
  SubgroupTables.js — the table of subgroups of the group drawn, one for everybody who
  wants it: the colour layers, the overlay items, scripts.

  makeGroupTables({getPresentation, onChanged}) is made by the renderer, which calls
  update() on every change of the group. The presentation decides (a group maker's
  getPresentation(), see SubgroupTable.js): while its key stays the same nothing happens,
  so a drag of a, b or a twist costs a string compare. A new key gets its table, and
  onChanged(info) is the message 'Group Presentation Changed', sent when the result is
  ready. current() gives the same info at any time.

    info = {key, pres, state, data, namer, error}, and ensureNames(index) when it is ready

    state 'ready'        data is the table to MAX_MAX_INDEX as far as the budget goes. A
                         layer's max index only cuts it (tableUpTo), see
                         tests/subgroups/table.mjs. namer has its names, made once and
                         shared, but only of the indices asked for: ensureNames(index) is
                         a promise of those of an index, shared by whoever asks, and until
                         then a name is the sublib id (SubgroupNameJobs.js). A table does
                         not wait for names: the message goes without them
          'calculating'  until the result comes; no message says this one, the layers
                         read it on their onGroupChanged()
          'none'         no presentation (NO_TABLE)
          'failed'       error says why

  - A job starts a moment later (a microtask, which a hidden window does not throttle),
    so that a document, whose load is many changes of the group in one go, gives one job
    for the group it ends at.
  - One job at a time, and of those waiting only the latest. A job ends by itself, its
    budget has a clock, so no worker is terminated for being stale; a stale result still
    goes to the cache, but only the group drawn gets a message.
  - The cache keeps the MAX_CACHED_TABLES tables used last, in the page, by key. A hit
    gives the message at once. A failed job is not kept: going back to the group tries
    again.
  - The job runs in a module worker (SubgroupWorker.js), kept between jobs, which says
    'ready' when its modules are loaded. Without Worker (Node, tests), or when it fails,
    or is not ready within START_LIMIT ms, the job runs in the page, where the budget
    bounds it, as DirichletSearch.js does it.
  - Nothing is calculated until someone first calls current(): a page with no colour
    layer and no overlay item never starts a worker.
*/

/** how many tables stay */
export const MAX_CACHED_TABLES = 8;

// how long a job waits for the worker to load its modules before it runs in the page
const START_LIMIT = 10000;
// a job ends by its budget; a worker silent for this long has got stuck
const ANSWER_LIMIT = 30000;

/** the info of a group with no presentation */
export const NO_TABLE = Object.freeze({
    key: null, pres: null, state: 'none', data: null, namer: null, error: null,
});

function makeTableWorker() {
    if (typeof Worker === 'undefined') return null;
    try {
        return new Worker(new URL('./SubgroupWorker.js', import.meta.url), { type: 'module' });
    } catch (e) {
        console.warn(`${MYNAME}: no worker (${e.message}), tables are made in the page`);
        return null;
    }
}

/**
 * @param {object}   options
 * @param {function} options.getPresentation  the presentation of the group drawn, or null
 * @param {function} [options.onChanged]      (info) => void, the message
 * @param {function} [options.makeWorker]     () => a Worker or null, for the tests
 * @param {function} [options.makeNamesWorker] the same for the names
 * @returns {{update: function, current: function, recalculate: function}}
 */
export function makeGroupTables(options = {}) {

    const { getPresentation, onChanged } = options;
    const makeWorker = options.makeWorker || makeTableWorker;
    const mNames = makeNameJobs({ makeWorker: options.makeNamesWorker, isDrawn: (info) => info === mCurrent });

    const mCache = new Map();   // key -> the info of a table, the one used last is the last
    let mCurrent = NO_TABLE;    // the info of the group drawn
    let mTold = NO_TABLE;       // the last info a message went out with
    let mInterest = false;      // someone has asked: until then nothing is calculated
    let mScheduled = false;
    let mWorker = null;         // {worker, state: 'loading' | 'ready' | 'failed', error}
    let mJob = null;            // the job running: {id, key, pres, request, posted, timer}
    let mLastId = 0;

    // ---- the cache -------------------------------------------------------------------

    function remember(info) {
        mCache.delete(info.key);
        mCache.set(info.key, info);
        while (mCache.size > MAX_CACHED_TABLES) mCache.delete(mCache.keys().next().value);
    }

    function cached(key) {
        const info = mCache.get(key);
        if (info) remember(info);
        return info || null;
    }

    // ---- the worker ------------------------------------------------------------------

    function connect() {
        const worker = makeWorker();
        if (!worker) return null;
        const entry = { worker, state: 'loading', error: null };
        worker.onmessage = (e) => onWorkerMessage(entry, e.data || {});
        worker.onerror = (e) => {
            if (e.preventDefault) e.preventDefault();
            entry.state = 'failed';
            entry.error = (e && e.message) || 'it failed';
            console.warn(`${MYNAME}: the worker failed (${entry.error}), tables are made in the page`);
            if (mJob) runInPage(mJob);
        };
        return entry;
    }

    function onWorkerMessage(entry, m) {
        if (m.type === 'ready') {
            entry.state = 'ready';
            if (mJob && !mJob.posted) post(mJob);
        } else if (mJob && m.id === mJob.id) {
            if (m.type === 'error') {
                finish(mJob, null, m.message);
            } else if (m.type === 'done') {
                finish(mJob, restoreHidden(m.data, m.hidden), null);
            }
        }
    }

    function post(job) {
        const entry = mWorker;
        job.posted = true;
        clearTimeout(job.timer);
        job.timer = setTimeout(() => {
            entry.worker.terminate();
            if (mWorker === entry) mWorker = null;
            finish(job, null, 'the worker did not answer');
        }, ANSWER_LIMIT);
        entry.worker.postMessage({ id: job.id, request: job.request });
    }

    // ---- the job ---------------------------------------------------------------------

    function startJob() {
        if (mJob) return;       // the end of that one comes back here
        const { key, pres } = mCurrent;
        const job = {
            id: ++mLastId, key, pres, posted: false, timer: null,
            request: tableRequest(pres, { maxIndex: MAX_MAX_INDEX }),
        };
        mJob = job;
        if (!mWorker) mWorker = connect();
        if (!mWorker || mWorker.state === 'failed') {
            runInPage(job);
        } else if (mWorker.state === 'ready') {
            post(job);
        } else {
            // a slow worker goes on loading for the next job
            job.timer = setTimeout(() => {
                console.warn(`${MYNAME}: the worker did not load its modules within ${START_LIMIT / 1000} s, the table is made in the page`);
                runInPage(job);
            }, START_LIMIT);
        }
    }

    function runInPage(job) {
        let data = null;
        let error = null;
        try {
            data = subgroupsData(job.request);
        } catch (e) {
            error = String((e && e.message) || e);
        }
        finish(job, data, error);
    }

    function finish(job, data, error) {
        clearTimeout(job.timer);
        if (mJob !== job) return;
        mJob = null;
        const { key, pres } = job;
        let info = { key, pres, state: 'failed', data: null, namer: null, error };
        if (data) {
            info = readyInfo(key, pres, data);
            remember(info);
        } else {
            console.warn(`${MYNAME}: no table for ${key}: ${error}`);
        }
        if (mCurrent.key === key && mCurrent.state === 'calculating') mCurrent = info;
        schedule();
    }

    function readyInfo(key, pres, data) {
        const namer = makeSubgroupNamer({ data, presentation: pres, family: pres.family, outside: true });
        const info = { key, pres, state: 'ready', data, namer, error: null,
                       ensureNames: (index) => mNames.ensure(info, index) };
        return info;
    }

    // ---- the group drawn -------------------------------------------------------------

    function calculating(pres, key) {
        return { key, pres, state: 'calculating', data: null, namer: null, error: null };
    }

    function schedule() {
        if (!mInterest || mScheduled) return;
        mScheduled = true;
        queueMicrotask(flush);
    }

    function flush() {
        mScheduled = false;
        if (mCurrent.state === 'calculating') {
            startJob();
        } else if (mCurrent !== mTold) {
            mTold = mCurrent;
            if (onChanged) onChanged(mCurrent);
        }
    }

    /** the group changed: has the presentation? */
    function update() {
        const pres = getPresentation ? getPresentation() : null;
        const key = presentationKey(pres);
        if (key === mCurrent.key) return;
        mCurrent = (key === null) ? NO_TABLE : (cached(key) || calculating(pres, key));
        schedule();
    }

    /** the info of the group drawn */
    function current() {
        update();
        if (!mInterest) {
            mInterest = true;
            schedule();
        }
        return mCurrent;
    }

    /** the table of the group drawn once more, for everybody */
    function recalculate() {
        const { key, pres } = mCurrent;
        if (key === null) return;
        mCache.delete(key);
        mCurrent = calculating(pres, key);
        schedule();
    }

    return { update, current, recalculate };
}
