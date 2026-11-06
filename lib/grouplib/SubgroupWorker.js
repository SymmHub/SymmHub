/*
  SubgroupWorker.js — the module worker of SubgroupTables.js: takes the arguments of
  subgroupsData and answers with the table, one job after another. sublib has no DOM and
  nothing else is imported, so the worker loads 5 files and not the 144 of grouplib.

  Messages to the page: {type: 'ready'} once its modules are loaded, then per job
  {type: 'done', id, data, hidden} or {type: 'error', id, message}. hidden has the
  properties of the table which are not enumerable, and so do not travel with it: the
  page puts them back, and a table from here is the same as one made in the page.
*/

import { subgroupsData } from '../sublib/src/sublib.js';

const HIDDEN = ['stats', 'presentation', 'generatorMode', 'geometry', 'dimension', 'family'];

self.onmessage = (e) => {
    const { id, request } = e.data;
    try {
        const data = subgroupsData(request);
        const hidden = {};
        for (const name of HIDDEN) if (data[name] != null) hidden[name] = data[name];
        self.postMessage({ type: 'done', id, data, hidden });
    } catch (err) {
        self.postMessage({ type: 'error', id, message: String((err && err.message) || err) });
    }
};

// the modules are loaded: the page may send jobs
self.postMessage({ type: 'ready' });
