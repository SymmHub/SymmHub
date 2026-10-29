/*
  DirichletWorker.js — the module worker of DirichletSearch.js: rebuilds the group
  from its data, runs selectDirichletSides with the deadline and answers with the
  words of the sides. Messages to the page: {type: 'started'} when the search begins
  (the modules are loaded), {type: 'progress', text} per round, {type: 'done', result}
  or {type: 'error', message}.
*/

import {
    iPoint,
    selectDirichletSides,
    groupFromData,
} from './modules.js';

self.onmessage = (e) => {
    const { group, base, options, timeLimit } = e.data;
    const t0 = Date.now();
    // the modules are loaded: the page's hard stop counts from here
    self.postMessage({ type: 'started' });
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
