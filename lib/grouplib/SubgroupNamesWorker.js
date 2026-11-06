/*
  SubgroupNamesWorker.js — the module worker of SubgroupNameJobs.js: makes the catalogue
  names of one index of a table. The names need the geometry of the group, so this one
  loads grouplib, which is why it is not SubgroupWorker.js: a table never waits for it.

  It keeps the table of the last names asked for. Messages from the page:
  {type: 'table', presentation, family, data, hidden}, then per job
  {type: 'names', id, index}. Messages to the page: {type: 'ready'} once its modules are
  loaded, then per job {type: 'done', id, names} or {type: 'error', id, message}.
*/

import {
    makeSubgroupNamer,
    restoreHidden,
} from './modules.js';

let mNamer = null;

self.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'table') {
        mNamer = makeSubgroupNamer({
            data:         restoreHidden(m.data, m.hidden),
            presentation: m.presentation,
            family:       m.family,
        });
    } else if (m.type === 'names') {
        try {
            self.postMessage({ type: 'done', id: m.id, names: mNamer.namesOfIndex(m.index) });
        } catch (err) {
            self.postMessage({ type: 'error', id: m.id, message: String((err && err.message) || err) });
        }
    }
};

// the modules are loaded: the page may send jobs
self.postMessage({ type: 'ready' });
