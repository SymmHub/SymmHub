/*
  DirichletSearch.js — the automatic choice of the sides of a Dirichlet domain
  (selectDirichletSides of DirichletDomain.js) in a module worker, so that a long
  search does not block the page.

  The search takes milliseconds for most groups and seconds for a group that is
  barely discrete, or not discrete at all (a bending pushed too far): its words grow
  to hundreds of letters and its candidates to thousands, and the time grows further
  with the fold iterations. In the page's own thread that froze the page. Here:

    - the group goes to the worker as plain data (groupToData / groupFromData: the
      sides, the reverse transforms with their words and the generator names, from
      which Group builds the same group, as Group.clone() does);
    - the search gets a deadline, timeLimit seconds after its start, at which it
      stops looking for candidates and answers with the sides found so far
      (result.timedOut);
    - a worker that does not answer within STOP_GRACE ms after the deadline is
      terminated (result.stopped = 'time'), and cancel() terminates it at once
      (result.stopped = 'cancelled'); the deadline counts from the start of the
      search in the worker, after its modules are loaded;
    - the worker is kept between searches: it loads its modules once (the
      aggregators bring some 140 modules, 2 MB, which took 7.5 s on the slow
      preview server), it says 'ready' when they are loaded, and only a stopped
      search terminates it. A worker that fails to load, or is not ready within
      START_LIMIT ms, is not waited for: the search runs in the page then, with
      its own deadline (a slow worker goes on loading for the next search);
    - without Worker (Node, tests) the search runs in place, with the same deadline.

  startDirichletSearch(group, {base, depth, minScale, maxIterations, timeLimit,
  onProgress, onStage}) returns {promise, cancel}; onStage(stage) tells 'loading'
  (waiting for the worker's modules), 'search' (in the worker) or 'page' (in the
  page); the promise resolves to {words, candidates, unpaired, nearIdentity,
  timedOut, where, ms} or {stopped, ms} or {error, ms}, never rejects.
  prepareDirichletSearch() starts loading the worker ahead of a search.
*/

import {
    Group,
    iSplane,
    iPoint,
    selectDirichletSides,
} from './modules.js';

const MYNAME = 'DirichletSearch';

export const DEFAULT_SEARCH_SECONDS = 10;
// how long after its deadline a worker may take to answer before it is terminated
const STOP_GRACE = 3000;
// how long a search waits for the worker to load its modules before it runs in the page
const START_LIMIT = 10000;

// ---- the group as data ---------------------------------------------------------------

function splaneToData(s) {
    return { v: Array.from(s.v), type: s.type };
}

function splaneFromData(d) {
    return new iSplane({ v: d.v.slice(), type: d.type });
}

/** the group as structured-clonable data: sides, reverse transforms with their words, generator names */
export function groupToData(group) {
    return {
        s: group.getFundDomain().map(splaneToData),
        t: group.getReverseTransforms().map(tr => ({ word: tr.word, refs: tr.map(splaneToData) })),
        genNames: group.getGenNames().slice(),
    };
}

/** the group of groupToData's data */
export function groupFromData(data) {
    const t = data.t.map(tr => {
        const refs = tr.refs.map(splaneFromData);
        if (tr.word !== undefined) refs.word = tr.word;
        return refs;
    });
    return new Group({ s: data.s.map(splaneFromData), t, genNames: data.genNames.slice() });
}

// ---- the search ------------------------------------------------------------------------

function searchOptions(opt) {
    return { depth: opt.depth, minScale: opt.minScale, maxIterations: opt.maxIterations };
}

function summary(res, t0, where) {
    return {
        words: res.words,
        candidates: res.candidates,
        unpaired: res.unpaired,
        nearIdentity: res.nearIdentity,
        timedOut: res.timedOut,
        where,
        ms: Date.now() - t0,
    };
}

/** the search in this thread, with a deadline timeLimit seconds from now; ms counts from t0 */
function searchHere(group, opt, t0) {
    try {
        const res = selectDirichletSides(group, {
            ...searchOptions(opt),
            base: opt.base,
            deadline: Date.now() + 1000 * opt.timeLimit,
            log: opt.onProgress,
        });
        return summary(res, t0, 'page');
    } catch (e) {
        return { error: String((e && e.message) || e), ms: Date.now() - t0 };
    }
}

function makeWorker() {
    if (typeof Worker === 'undefined') return null;
    try {
        return new Worker(new URL('./DirichletWorker.js', import.meta.url), { type: 'module' });
    } catch (e) {
        console.warn(`${MYNAME}: no worker (${e.message}), the search runs in the page`);
        return null;
    }
}

// the worker kept between searches: {worker, state: 'loading' | 'ready' | 'failed',
// ready: a promise of its modules loaded (true) or failed (false), busy, error, loadMs}
let mShared = null;

/** a new worker loading its modules; null without Worker */
function newEntry() {
    const worker = makeWorker();
    if (!worker) return null;
    const t0 = Date.now();
    const entry = { worker, state: 'loading', busy: false, error: null, loadMs: 0 };
    entry.ready = new Promise(resolve => {
        worker.onmessage = (e) => {
            if (e.data && e.data.type === 'ready') {
                entry.state = 'ready';
                entry.loadMs = Date.now() - t0;
                resolve(true);
            }
        };
        worker.onerror = (e) => {
            if (e.preventDefault) e.preventDefault();
            entry.state = 'failed';
            entry.error = (e && e.message) || 'it failed to load its modules';
            resolve(false);
        };
    });
    return entry;
}

function dropEntry(entry) {
    entry.worker.terminate();
    if (mShared === entry) mShared = null;
}

/** the shared worker, a new one when there is none or it failed, a separate one when it is busy */
function takeEntry() {
    if (!mShared || mShared.state === 'failed') mShared = newEntry();
    if (!mShared) return null;
    return mShared.busy ? newEntry() : mShared;
}

/** starts loading the search worker, so that the first search does not wait for its modules */
export function prepareDirichletSearch() {
    if (!mShared) mShared = newEntry();
}

/**
 * starts the automatic choice of the sides of the Dirichlet domain of the base
 *
 * @param {Group} group
 * @param {object} opt  {base (iPoint), depth, minScale, maxIterations, timeLimit
 *                      (seconds), onProgress (text) => void, onStage (stage) => void}
 * @returns {{promise: Promise<object>, cancel: () => void}}
 */
export function startDirichletSearch(group, opt = {}) {
    const t0 = Date.now();
    const options = { timeLimit: DEFAULT_SEARCH_SECONDS, ...opt };
    // a microtask later: the caller has its handle of the search by then
    const stage = s => { if (options.onStage) Promise.resolve().then(() => options.onStage(s)); };
    const entry = takeEntry();
    if (!entry) {
        const result = searchHere(group, options, t0);
        return { promise: Promise.resolve(result), cancel: () => {} };
    }
    entry.busy = true;
    let finish = null;
    let timer = null;
    let running = false;      // the search was posted to the worker
    const promise = new Promise(resolve => { finish = resolve; });
    // keep: the worker is left for the next search (it answered, or never got this one)
    const end = (result, keep) => {
        if (!finish) return;
        const f = finish;
        finish = null;
        clearTimeout(timer);
        if (keep && entry === mShared && entry.state !== 'failed') entry.busy = false;
        else dropEntry(entry);
        f({ ...result, ms: Date.now() - t0 });
    };
    const inPage = (reason) => {
        console.warn(`${MYNAME}: the search worker ${reason}; the search runs in the page`);
        stage('page');
        // a moment later, so that the page shows the stage before it is busy
        timer = setTimeout(() => {
            if (!finish) return;
            const res = searchHere(group, options, t0);
            end(res, true);
        }, 30);
    };
    const run = () => {
        if (!finish) return;
        if (entry.state === 'failed') { inPage(`failed (${entry.error})`); return; }
        running = true;
        stage('search');
        const worker = entry.worker;
        worker.onmessage = (e) => {
            const m = e.data || {};
            if (m.type === 'progress') { if (options.onProgress) options.onProgress(m.text); }
            else if (m.type === 'done') end({ ...m.result, where: 'worker', loadMs: entry.loadMs }, true);
            else if (m.type === 'error') end({ error: m.message }, true);
        };
        worker.onerror = (e) => {
            if (e.preventDefault) e.preventDefault();
            end({ error: (e && e.message) || 'the worker failed' }, false);
        };
        clearTimeout(timer);
        timer = setTimeout(() => end({ stopped: 'time' }, false), 1000 * options.timeLimit + STOP_GRACE);
        worker.postMessage({
            group: groupToData(group),
            base: Array.from(options.base.v),
            options: searchOptions(options),
            timeLimit: options.timeLimit,
        });
    };
    if (entry.state === 'ready') {
        run();
    } else {
        stage('loading');
        timer = setTimeout(() => {
            // not waited for any longer; a slow worker goes on loading for the next search
            if (finish && !running) inPage(`did not load its modules within ${START_LIMIT / 1000} s`);
        }, START_LIMIT);
        entry.ready.then(() => { if (finish && !running && entry.state !== 'loading') { clearTimeout(timer); run(); } });
    }
    // a search not yet posted leaves the worker loading for the next one
    return { promise, cancel: () => end({ stopped: 'cancelled' }, !running) };
}
