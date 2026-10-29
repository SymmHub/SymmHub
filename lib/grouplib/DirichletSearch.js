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
      search in the worker, after its modules are loaded, which LOAD_LIMIT bounds;
    - without Worker (Node, tests) the search runs in place, with the same deadline.

  startDirichletSearch(group, {base, depth, minScale, maxIterations, timeLimit,
  onProgress}) returns {promise, cancel}; the promise resolves to {words, candidates,
  unpaired, nearIdentity, timedOut, ms} or {stopped, ms} or {error, ms}, never rejects.
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
// how long the worker may take to load its modules and start
const LOAD_LIMIT = 30000;

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

function summary(res, t0) {
    return {
        words: res.words,
        candidates: res.candidates,
        unpaired: res.unpaired,
        nearIdentity: res.nearIdentity,
        timedOut: res.timedOut,
        ms: Date.now() - t0,
    };
}

/** the search in this thread, with the deadline (no worker available) */
function searchHere(group, opt, t0) {
    try {
        const res = selectDirichletSides(group, {
            ...searchOptions(opt),
            base: opt.base,
            deadline: t0 + 1000 * opt.timeLimit,
            log: opt.onProgress,
        });
        return summary(res, t0);
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

/**
 * starts the automatic choice of the sides of the Dirichlet domain of the base
 *
 * @param {Group} group
 * @param {object} opt  {base (iPoint), depth, minScale, maxIterations, timeLimit
 *                      (seconds), onProgress (text) => void}
 * @returns {{promise: Promise<object>, cancel: () => void}}
 */
export function startDirichletSearch(group, opt = {}) {
    const t0 = Date.now();
    const options = { timeLimit: DEFAULT_SEARCH_SECONDS, ...opt };
    const worker = makeWorker();
    if (!worker) {
        const result = searchHere(group, options, t0);
        return { promise: Promise.resolve(result), cancel: () => {} };
    }
    let finish = null;
    let timer = null;
    const promise = new Promise(resolve => { finish = resolve; });
    const end = (result) => {
        if (!finish) return;
        const f = finish;
        finish = null;
        clearTimeout(timer);
        worker.terminate();
        f(result);
    };
    const stopAfter = (ms) => {
        clearTimeout(timer);
        timer = setTimeout(() => end({ stopped: 'time', ms: Date.now() - t0 }), ms);
    };
    worker.onmessage = (e) => {
        const m = e.data || {};
        if (m.type === 'started') stopAfter(1000 * options.timeLimit + STOP_GRACE);
        else if (m.type === 'progress') { if (options.onProgress) options.onProgress(m.text); }
        else if (m.type === 'done') end({ ...m.result, ms: Date.now() - t0 });
        else if (m.type === 'error') end({ error: m.message, ms: Date.now() - t0 });
    };
    worker.onerror = (e) => {
        if (e.preventDefault) e.preventDefault();
        end({ error: (e && e.message) || 'the worker failed', ms: Date.now() - t0 });
    };
    stopAfter(LOAD_LIMIT + 1000 * options.timeLimit + STOP_GRACE);
    worker.postMessage({
        group: groupToData(group),
        base: Array.from(options.base.v),
        options: searchOptions(options),
        timeLimit: options.timeLimit,
    });
    return { promise, cancel: () => end({ stopped: 'cancelled', ms: Date.now() - t0 }) };
}
