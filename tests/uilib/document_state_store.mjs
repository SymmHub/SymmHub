/*
  tests of the per-document store in the browser (lib/uilib/DocumentStateStore.js;
  docs/document_view_plan.md 3.3, outside the repository)

    node tests/uilib/document_state_store.mjs

  1. set and get by id, a value per document, null for an unknown one
  2. the most recently set first; past the cap the oldest dropped
  3. remove; an empty store removes its storage item
  4. a full storage: the older half dropped, the new value kept
  5. broken or missing storage: empty, no throw
*/

import { createDocumentStateStore } from '../../lib/uilib/DocumentStateStore.js';

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
}

function fakeStorage(limit = Infinity){
    const items = new Map();
    return {
        items,
        getItem: (k) => items.has(k) ? items.get(k) : null,
        setItem: (k, v) => { if (String(v).length > limit) throw new Error('QuotaExceededError'); items.set(k, String(v)); },
        removeItem: (k) => { items.delete(k); },
    };
}

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const storage = fakeStorage();
    const store = createDocumentStateStore({ storageKey: 'k', storage });
    check(store.get('a') === null, 'unknown id');
    store.set('a', { x: 1 });
    store.set('b', { x: 2 });
    check(store.get('a').x === 1 && store.get('b').x === 2, 'values per id');
    store.set('a', { x: 3 });
    check(store.get('a').x === 3, 'a value replaced');
    check(store.ids().join() === 'a,b', 'the most recent first');
    // a second store on the same storage sees the values (another page load)
    const again = createDocumentStateStore({ storageKey: 'k', storage });
    check(again.get('b').x === 2, 'kept in the storage');
    check(!store.set('', 1) && store.ids().length === 2, 'an empty id refused');
}

// 2 ───────────────────────────────────────────────────────────────────────────
{
    const store = createDocumentStateStore({ storageKey: 'k', cap: 3, storage: fakeStorage() });
    for (const id of ['a', 'b', 'c', 'd']) store.set(id, id);
    check(store.ids().join() === 'd,c,b', 'the oldest dropped past the cap');
    store.set('b', 'b2');
    store.set('e', 'e');
    check(store.ids().join() === 'e,b,d', 'a set makes it the most recent');
}

// 3 ───────────────────────────────────────────────────────────────────────────
{
    const storage = fakeStorage();
    const store = createDocumentStateStore({ storageKey: 'k', storage });
    store.set('a', 1); store.set('b', 2);
    store.remove('a');
    check(store.get('a') === null && store.get('b') === 2, 'removed');
    store.remove('b');
    check(!storage.items.has('k'), 'the empty store leaves no item');
    check(store.remove('zzz') === true, 'removing an unknown id');
}

// 4 ───────────────────────────────────────────────────────────────────────────
{
    const storage = fakeStorage(400);
    const store = createDocumentStateStore({ storageKey: 'k', storage });
    for (let i = 0; i < 12; i++) store.set('doc' + i, 'x'.repeat(30));
    const ids = store.ids();
    check(ids[0] === 'doc11', 'the newest kept when the storage is full');
    check(ids.length < 12 && storage.items.get('k').length <= 400, 'older ones dropped to fit');
}

// 5 ───────────────────────────────────────────────────────────────────────────
{
    const broken = fakeStorage();
    broken.items.set('k', '{not json');
    const store = createDocumentStateStore({ storageKey: 'k', storage: broken });
    check(store.get('a') === null && store.ids().length === 0, 'broken item read as empty');
    store.set('a', 1);
    check(store.get('a') === 1, 'a broken item replaced');
    const refusing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => {} };
    const none = createDocumentStateStore({ storageKey: 'k', storage: refusing });
    check(none.get('a') === null && none.set('a', 1) === false, 'refused storage: empty, no throw');
    // no storage at all (node has no window)
    const nowhere = createDocumentStateStore({ storageKey: 'k' });
    check(nowhere.get('a') === null && nowhere.set('a', 1) === false, 'no storage: empty, no throw');
}

if (failed) {
    console.log(`document_state_store: ${failed} FAILED`);
    process.exit(1);
}
console.log('document_state_store: all passed');
