/*
  DocumentStateStore.js — a value per document, kept in the browser
  (localStorage): the state of a document that does not belong in its file,
  such as the view you were working in (docs/document_view_plan.md 3.3).

  The values live in one storage item, the most recently set first; past `cap`
  documents the oldest are dropped. A document is named by an id string the
  app makes (its folder path and name, its URL). Values are JSON. Storage that
  is missing, full or refused leaves the store empty, never throws.

    const store = createDocumentStateStore({ storageKey, cap = 100, storage = window.localStorage });
    store.get(id)          the value, or null
    store.set(id, value)   the value of the document, now the most recent
    store.remove(id)
    store.ids()            the ids, the most recent first
*/

export function createDocumentStateStore({ storageKey, cap = 100, storage } = {}) {

    function getStorage() {
        if (storage) return storage;
        try { return window.localStorage; } catch (e) { return null; }
    }

    // [[id, value], ...], the most recent first
    function read() {
        const s = getStorage();
        if (!s || !storageKey) return [];
        try {
            const data = JSON.parse(s.getItem(storageKey) || '[]');
            return Array.isArray(data) ? data.filter(e => Array.isArray(e) && typeof e[0] === 'string') : [];
        } catch (e) {
            return [];
        }
    }

    // writes the entries; when the storage is full, again with the older half dropped
    function write(entries) {
        const s = getStorage();
        if (!s || !storageKey) return false;
        let list = entries.slice(0, Math.max(1, cap));
        for (;;) {
            try {
                if (list.length) s.setItem(storageKey, JSON.stringify(list));
                else s.removeItem(storageKey);
                return true;
            } catch (e) {
                if (list.length <= 1) return false;
                list = list.slice(0, Math.ceil(list.length/2));
            }
        }
    }

    function get(id) {
        const e = read().find(e => e[0] === id);
        return e ? e[1] : null;
    }

    function set(id, value) {
        if (typeof id !== 'string' || !id) return false;
        const entries = read().filter(e => e[0] !== id);
        entries.unshift([id, value]);
        return write(entries);
    }

    function remove(id) {
        const entries = read();
        const rest = entries.filter(e => e[0] !== id);
        return (rest.length === entries.length) ? true : write(rest);
    }

    function ids() {
        return read().map(e => e[0]);
    }

    return { get, set, remove, ids };
}
