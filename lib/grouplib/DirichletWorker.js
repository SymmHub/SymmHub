/*
  DirichletWorker.js — the module worker of DirichletSearch.js: rebuilds the group
  from its data, runs selectDirichletSides with the deadline and answers with the
  words of the sides. It serves one search after another. Messages to the page:
  {type: 'ready'} once its modules are loaded, then per search {type: 'progress',
  text} per round and {type: 'done', result} or {type: 'error', message}.
*/

import {
    iPoint,
    selectDirichletSides,
    groupFromData,
} from './modules.js';

self.onmessage = (e) => {
    const { group, base, options, timeLimit } = e.data;
    const t0 = Date.now();
    try {
        const res = selectDirichletSides(groupFromData(group), {
            ...options,
            base: iPoint(base),
            deadline: t0 + 1000 * timeLimit,
            log: text => self.postMessage({ type: 'progress', text }),
        });
        self.postMessage({
            type: 'done',
            result: {
                words: res.words,
                candidates: res.candidates,
                unpaired: res.unpaired,
                nearIdentity: res.nearIdentity,
                timedOut: res.timedOut,
            },
        });
    } catch (err) {
        self.postMessage({ type: 'error', message: String((err && err.message) || err) });
    }
};

// the modules are loaded: the page may send searches
self.postMessage({ type: 'ready' });
