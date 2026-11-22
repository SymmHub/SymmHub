/*
  TransformsWindow.js — the list of conformal transformations in a window of its
  own (uilib LayerList.js), with the settings of the selected row under the list
  (uilib ParamPanel.js), as the visualization layers have theirs
  (VisualizationLayersWindow.js). docs/conformal_transforms_plan.md 5.1, outside
  the repository.

  The list is the navigator's ProjectionTransform (its param `maps`). The window
  shows its rows in the direct order, as the list holds them: the first row, at
  the top, acts on the pattern first; the last, at the bottom, is nearest the
  screen. Two captions say so: "pattern" over the rows and, under them, what acts
  after the list (the navigation's Moebius transform, the sphere view, the
  canvas). A row has its eye (the row's switch), its name (its id, renamed in
  place), its kind in grey and a menu. A click selects a row and shows its
  settings; the buttons under the rows act on the selected one. The eye at the
  right end of the buttons switches the whole list.

  The edits go through the list's ParamObjArray (addChild, duplicateChild,
  removeChildAt, moveChildTo, setChildId), as the settings panel's list does, so
  what a document saves is the same. The window follows the list's changes
  (addListener): values set elsewhere, a document loaded.

  Every row gets its panel when it first shows in the list, so a param's one
  control is here and nowhere else: the settings panel of a page with this
  window leaves the list out (WorkspaceUI's option transformsWindow).

  With arg.pushUndo (symdraw: the drawing's undo stack) the user's edits of
  the list, in this window or anywhere else, are undo steps (TransformsUndo.js):
  a row added, removed, moved or renamed, its values (a drag or typing in a
  field one step), the switch of the whole. Not the list's own changes (a
  document loaded, the points a row finds again from the group). An undo or a
  redo selects the row it changed.

  The selected row's own handles and marks are on the canvas while the window is
  open (TransformHandles.js; SymRenderer draws them and gives them the pointer):
  getHandlesRow() says whose, and the switch left of the whole's eye takes them
  off. arg.onChange() tells the owner when that row, the switch or the window's
  being open changed.

  Usage:
    const w = createTransformsWindow({ list, storageId, left, top, pushUndo, onChange });
    w.window      the internal window (for the windows menu)
    w.refresh()
    w.getSelectedRow()
    w.getHandlesRow()
*/

import {
    createLayerList,
    createParamPanel,
    createTransformsUndo,
} from './modules.js';

// what the rows show and edit, left out of the settings under the list
const ROW_KEYS = ['id', 'enabled'];

const HEADER = 'pattern';
const FOOTER = 'Moebius · sphere · canvas → screen';

// the switch of the whole list: an eye, crossed when off
const EYE_STROKE = 'fill="none" stroke="#303030" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
const WHOLE_TOGGLE = {
    on:  `<svg viewBox="0 0 24 24"><path d="M2 12 C6 5 18 5 22 12 C18 19 6 19 2 12 Z" ${EYE_STROKE}/><circle cx="12" cy="12" r="3" fill="#303030"/></svg>`,
    off: `<svg viewBox="0 0 24 24"><path d="M2 12 C6 5 18 5 22 12 C18 19 6 19 2 12 Z" fill="none" stroke="#a0a0a0" stroke-width="1.5"/><path d="M4 20 L20 4" ${EYE_STROKE}/></svg>`,
    titleOn:  'the transformations are on (a click switches them all off, to see the picture without them)',
    titleOff: 'the transformations are all off (a click switches the list on again)',
};

// the selected transformation's handles on the canvas: a point with its handle lines, grey when off
const HANDLES_TOGGLE = {
    on:  '<svg viewBox="0 0 24 24"><path d="M5 18 L12 7 L19 18" fill="none" stroke="#303030" stroke-width="1.4"/><circle cx="12" cy="7" r="3.2" fill="#dc6b0a" stroke="#303030" stroke-width="1.2"/><circle cx="5" cy="18" r="2.2" fill="#fff" stroke="#303030" stroke-width="1.2"/><circle cx="19" cy="18" r="2.2" fill="#fff" stroke="#303030" stroke-width="1.2"/></svg>',
    off: '<svg viewBox="0 0 24 24"><path d="M5 18 L12 7 L19 18" fill="none" stroke="#a0a0a0" stroke-width="1.4"/><circle cx="12" cy="7" r="3.2" fill="#fff" stroke="#a0a0a0" stroke-width="1.2"/><circle cx="5" cy="18" r="2.2" fill="#fff" stroke="#a0a0a0" stroke-width="1.2"/><circle cx="19" cy="18" r="2.2" fill="#fff" stroke="#a0a0a0" stroke-width="1.2"/></svg>',
    titleOn:  'the selected transformation\'s handles are on the canvas while this window is open: the points of a rational map, the cell of a periodic wrap, the fixed points (a click takes them off)',
    titleOff: 'the selected transformation\'s handles are off the canvas (a click shows them while this window is open)',
};

/**
 * the rows of a list of conformal transformations as the nodes a LayerList
 * shows (it takes them bottom first: the first row of the list, shown at the
 * top, is the last node)
 * @param {object}   list      the ProjectionTransform
 * @param {function} keyOf     (row) => its key in the window
 * @param {string}   selected  the key of the selected row
 */
export function transformsNodes(list, keyOf, selected) {
    const kinds = list.getMapKinds();
    const whole = !!list.getParams().enabled.getValue();
    const over = list.getOverLimit ? list.getOverLimit() : [];
    const nodes = list.getMaps().map(row => {
        const kind = kinds.find(k => k.name === row.getClassName());
        return {
            id:      keyOf(row),
            name:    row.getId(),
            kind:    (kind ? kind.label : row.getClassName()) + (over.includes(row) ? ' · no room, not applied' : ''),
            visible: !!row.enabled,
            active:  keyOf(row) === selected,
            ...(whole ? {} : { dimmed: true }),
        };
    });
    return nodes.reverse();
}

/** the index in the list of the row a LayerList has at its index i (bottom first) of n */
export function listIndex(n, i) {
    return n - 1 - i;
}

/**
 * @param {object} arg
 * @param {object} arg.list         the ProjectionTransform (the navigator's getProjection())
 * @param {string} [arg.storageId]  the window's place, size and visibility
 * @param {string} [arg.left]       CSS place and size of the window the first time
 * @param {string} [arg.top]
 * @param {string} [arg.width]
 * @param {string} [arg.height]
 * @param {function} [arg.pushUndo] (entry) puts an undo step on the page's stack
 */
export function createTransformsWindow(arg) {

    const list = arg.list;
    const storageId = arg.storageId || 'transforms_window';

    // stable keys of the rows while they live: a key does not change with a rename
    const mKeys = new WeakMap();
    let mNextKey = 1;
    const keyOf = (row) => {
        let k = mKeys.get(row);
        if (!k) { k = 't' + (mNextKey++); mKeys.set(row, k); }
        return k;
    };

    // the selected row: its key, and its id to find it again when a document
    // put other rows in the list
    let mSelected = null;
    let mSelectedId = null;
    // the rows shown last, for their panels to go with them
    let mKnown = new Set();

    const mapsParam = () => list.getParams().maps;
    const rows = () => list.getMaps();
    const kindLabel = (row) => {
        const k = list.getMapKinds().find(x => x.name === row.getClassName());
        return k ? k.label : row.getClassName();
    };

    /** the row of a key: {row, index}, or null */
    function find(key){
        if (!key) return null;
        const all = rows();
        const index = all.findIndex(r => keyOf(r) === key);
        return index < 0 ? null : { row: all[index], index };
    }

    // ── selection ─────────────────────────────────────────────────────────────

    function select(key){
        const at = find(key);
        if (!at) return;
        mSelected = key;
        mSelectedId = at.row.getId();
        showSettings();
        told();
    }

    // what the canvas shows for the window changed (the selected row, the handles'
    // switch, the window shown or closed): the owner draws again
    function told(){
        if (arg.onChange) arg.onChange();
    }

    // the selected row's handles on the canvas: the switch, kept with the window
    const handlesKey = storageId + '_handles';
    let mHandles = true;
    try { mHandles = window.localStorage.getItem(handlesKey) !== 'false'; } catch (e) { /* no storage */ }
    function setHandles(on){
        mHandles = !!on;
        try { window.localStorage.setItem(handlesKey, String(mHandles)); } catch (e) { /* no storage */ }
        told();
    }

    /** the selection made good after the list changed: the same row, else one of
     *  the same id, else the row at its place, else the first */
    function keepSelection(lastIndex = -1){
        if (find(mSelected)) return;
        const all = rows();
        let pick = mSelectedId ? all.find(r => r.getId() === mSelectedId) : null;
        if (!pick && lastIndex >= 0 && all.length) pick = all[Math.max(0, Math.min(lastIndex, all.length - 1))];
        if (!pick && all.length) pick = all[0];
        mSelected = pick ? keyOf(pick) : null;
        // an empty list keeps the id: the document that comes back has its row selected again
        if (pick) mSelectedId = pick.getId();
    }

    // ── the settings under the list ───────────────────────────────────────────

    /** the params shown for a row: those its row does not show */
    function settingsParams(row){
        const params = row.getPanelParams ? row.getPanelParams() : row.getParams();
        const out = {};
        for (const key of Object.keys(params)) if (!ROW_KEYS.includes(key)) out[key] = params[key];
        return out;
    }

    function showSettings(){
        const at = find(mSelected);
        if (!at) {
            mPanel.clear({ note: rows().length ? 'select a transformation' : 'no transformations: the + button adds one' });
            return;
        }
        const row = at.row;
        const note = Object.keys(settingsParams(row)).length ? '' : 'no settings';
        mPanel.show(row, () => settingsParams(row), { title: row.getId(), kind: kindLabel(row), note });
    }

    /** every row has its panel; the panels of those gone go */
    function syncPanels(){
        const now = new Set();
        for (const row of rows()) {
            now.add(row);
            if (!mPanel.has(row)) mPanel.prepare(row, () => settingsParams(row));
        }
        for (const row of mKnown) if (!now.has(row)) mPanel.forget(row);
        mKnown = now;
    }

    // ── the commands ──────────────────────────────────────────────────────────

    /** a new row above ('above': before it in the list) or below the selected one; at the end without one */
    function onAdd(where, kind){
        const at = find(mSelected);
        const index = at ? (where === 'above' ? at.index : at.index + 1) : rows().length;
        const row = mapsParam().addChild(kind || list.getMapKinds()[0]?.name, index);
        if (row) select(keyOf(row));
    }

    function onDuplicate(key){
        const at = find(key);
        if (!at) return;
        const copy = mapsParam().duplicateChild(at.index);
        if (copy) select(keyOf(copy));
    }

    function onRemove(key){
        const at = find(key);
        if (!at) return;
        mapsParam().removeChildAt(at.index);
        // the row that came to its place, or the last
        mSelected = null;
        mSelectedId = null;
        keepSelection(at.index);
        refresh();
    }

    function onRename(key, name){
        const at = find(key);
        if (!at) return null;
        if (!name) return 'the name is empty';
        if (/\s/.test(name)) return 'a name has no spaces';
        if (rows().some(r => r !== at.row && r.getId() === name)) return `"${name}" is taken`;
        if (at.row.getId() === name) return null;
        // through the list: its change is told
        mapsParam().setChildId(at.index, name);
        mSelectedId = name;
        showSettings();
        return null;
    }

    function onVisible(key, visible){
        const at = find(key);
        if (!at) return;
        const p = at.row.getParams().enabled;
        if (p && p.setValue) p.setValue(visible);
    }

    /** the add button's menu: a row of a kind under the selected one */
    function addItems(){
        return list.getMapKinds().map(k => ({
            label: k.label,
            title: 'a new transformation under the selected one (the next towards the screen)',
            action: () => onAdd('below', k.name),
        }));
    }

    // ── the window ────────────────────────────────────────────────────────────

    let firstTime = false;
    try { firstTime = window.localStorage.getItem(storageId + '_visible') === null; } catch (e) { /* no storage */ }

    const wholeParam = () => list.getParams().enabled;
    const mList = createLayerList({
        title:       'transformations',
        storageId,
        left:        arg.left || 'calc(100% - 900px)',
        top:         arg.top || '120px',
        width:       arg.width || '290px',
        height:      arg.height || '340px',
        detail:      true,
        minLayers:   0,
        noun:        'transformation',
        eyeTitles:   ['on (a click switches it off)', 'off (a click switches it on)'],
        header:      HEADER,
        footer:      FOOTER,
        toolToggles: [{ ...HANDLES_TOGGLE, get: () => mHandles, set: setHandles },
                      { ...WHOLE_TOGGLE, get: () => !!wholeParam().getValue(), set: (v) => wholeParam().setValue(!!v) }],
        onWindowVisible: () => told(),
        getLayers:   () => transformsNodes(list, keyOf, mSelected),
        onActivate:  select,
        onVisible,
        onRename,
        kinds:       () => list.getMapKinds(),
        addItems,
        addTitle:    'a new transformation under the selected one (the next towards the screen)',
        onAdd,
        onDuplicate,
        onRemove,
        // the list window has the first row at the top: its indices run the other way
        onMove:      (from, to) => { const n = rows().length; mapsParam().moveChildTo(listIndex(n, from), listIndex(n, to)); },
    });
    const mPanel = createParamPanel({ element: mList.detail });
    // a page opened for the first time leaves it closed: most documents have no transformations
    if (firstTime) mList.window.setVisible(false);

    function refresh(){
        syncPanels();
        keepSelection();
        mList.refresh();
        showSettings();
    }

    // the list's changes come many in a row (a slider's drag, a document being
    // loaded): the window follows once they are done
    let mPending = false;
    function schedule(){
        if (mPending) return;
        mPending = true;
        queueMicrotask(() => { mPending = false; refresh(); });
    }
    list.addListener(schedule);

    // the undo steps, compared after the window followed a change
    if (arg.pushUndo) {
        createTransformsUndo({
            list,
            push:      arg.pushUndo,
            onApplied: (row) => { if (row && find(keyOf(row))) select(keyOf(row)); },
            // the selected row: a swap of two neighbours is its move
            prefer:    () => { const at = find(mSelected); return at ? at.row.getId() : null; },
        });
    }

    refresh();

    return {
        window: mList.window,
        refresh,
        /** the selected row, or null */
        getSelectedRow: () => { const at = find(mSelected); return at ? at.row : null; },
        /** the row whose handles are on the canvas: the selected one while the window is open and the switch on */
        getHandlesRow:  () => {
            if (!mHandles || !mList.window.isVisible()) return null;
            const at = find(mSelected);
            return at ? at.row : null;
        },
    };
}
