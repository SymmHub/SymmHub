/*
  VisualizationLayersWindow.js — the visualization layers in a window of their
  own, as the drawing layers are (uilib LayerList.js), with the settings of the
  selected layer under the list (uilib ParamPanel.js).

  The list shows the layers top first (the last drawn at the top): eye (the
  layer's enabled), name (its id, renamed in place), kind in grey, opacity
  and a menu; an overlay's items are rows under it (eye, name, kind, menu),
  dragged among themselves. A click on a row selects it and shows its
  settings: a layer's params without id, enabled and opacity (the row has
  them), an overlay without its items (they are rows), an item's without id
  and enabled. Every layer and item gets its panel when it first shows in the
  list, so a param's one control is there and nowhere else: the settings
  panel of a page with this window leaves the visualization out
  (SymRenderer's option visualizationWindow).

  The edits go through the lists' ParamObjArray, as the panel's menus did
  (addChild, duplicateChild, removeChildAt, moveChildTo, setChildId), so what
  a document saves is the same. The window follows the manager's changes
  (addListener): values set elsewhere, a document loaded.

  With arg.pushUndo (symdraw: the drawing's undo stack) the user's edits of
  the layers and items, in this window or by a script, are undo steps
  (uilib ParamListUndo.js): a layer or item added, removed, moved or
  renamed; values changed (a drag or typing in a field one step). Not the
  manager's own changes (a document loaded, the group, a name of the
  drawing). An undo or a redo selects the layer or item it changed.

  Usage:
    const w = createVisualizationLayersWindow({ manager, storageId, left, top, pushUndo });
    w.window      the internal window (for the windows menu)
    w.refresh()
*/

import {
    createLayerList,
    createParamPanel,
    createParamListUndo,
    showPopupMenu,
} from './modules.js';

// what the rows show and edit, left out of the settings under the list
const LAYER_ROW_KEYS = ['id', 'enabled', 'opacity'];
const ITEM_ROW_KEYS = ['id', 'enabled'];

/** a kind's label: the factory's, else the class name without its prefix */
function kindLabel(name, label){
    if (label && label !== name) return label;
    return name.replace(/^Visualization/, '').replace(/^Overlay/, '');
}

/** the value of a param of an object, undefined when it has none */
function paramValue(obj, key){
    const p = obj.getParams ? obj.getParams()[key] : null;
    return p && p.getValue ? p.getValue() : undefined;
}

/**
 * @param {object} arg
 * @param {object} arg.manager    the VisualizationManager
 * @param {string} [arg.storageId] the window's place, size and visibility
 * @param {function} [arg.pushUndo] (entry) puts an undo step on the page's stack
 */
export function createVisualizationLayersWindow(arg) {

    const manager = arg.manager;

    // stable keys of the layers and items while they live: two overlays may
    // hold items of the same id, and a key does not change with a rename
    const mKeys = new WeakMap();
    let mNextKey = 1;
    const keyOf = (obj) => {
        let k = mKeys.get(obj);
        if (!k) { k = 'v' + (mNextKey++); mKeys.set(obj, k); }
        return k;
    };

    // the selected row: its key, and the ids to find it again when a
    // document put other objects in the list
    let mSelected = null;
    let mSelectedIds = null;
    // the objects shown last, for their panels to go with them
    let mKnown = new Set();

    const layersParam = () => manager.getParams().layers;
    const layers = () => manager.getLayers();
    const isOverlay = (layer) => !!(layer.getItems && layer.getParams().overlays);
    const itemsOf = (layer) => (isOverlay(layer) ? layer.getItems() : []);
    const itemsParam = (layer) => layer.getParams().overlays;

    /** the layer or item of a key: {layer, index, item, itemIndex}, item null for a layer */
    function find(key){
        if (!key) return null;
        const list = layers();
        for (let i = 0; i < list.length; i++) {
            const layer = list[i];
            if (keyOf(layer) === key) return { layer, index: i, item: null, itemIndex: -1 };
            const items = itemsOf(layer);
            for (let j = 0; j < items.length; j++) {
                if (keyOf(items[j]) === key) return { layer, index: i, item: items[j], itemIndex: j };
            }
        }
        return null;
    }

    const layerKinds = () => manager.getLayerKinds().map(k => ({ name: k.name, label: kindLabel(k.name, k.label) }));
    function layerKind(layer){
        const cls = layer.getClassName ? layer.getClassName() : '';
        const k = manager.getLayerKinds().find(x => x.name === cls);
        return kindLabel(cls, k && k.label);
    }
    const itemKinds = (layer) => (layer.getItemKinds ? layer.getItemKinds() : []).map(k => ({ name: k.name, label: kindLabel(k.name, k.label) }));
    function itemKind(layer, item){
        const cls = item.getClassName ? item.getClassName() : '';
        const k = itemKinds(layer).find(x => x.name === cls);
        return k ? k.label : kindLabel(cls);
    }

    const enabledOf = (obj) => {
        const v = paramValue(obj, 'enabled');
        return v === undefined ? !!obj.enabled : !!v;
    };
    const setParam = (obj, key, value) => {
        const p = obj.getParams()[key];
        if (p && p.setValue) p.setValue(value);
    };

    // ── the tree the list shows ───────────────────────────────────────────────

    function nodes(){
        return layers().map(layer => {
            const opacity = paramValue(layer, 'opacity');
            const node = {
                id: keyOf(layer), name: layer.getId(), kind: layerKind(layer),
                visible: enabledOf(layer), active: keyOf(layer) === mSelected,
                ...(typeof opacity === 'number' ? { opacity } : {}),
            };
            if (isOverlay(layer)) {
                node.children = itemsOf(layer).map(item => ({
                    id: keyOf(item), name: item.getId(), kind: itemKind(layer, item),
                    visible: enabledOf(item), selected: keyOf(item) === mSelected,
                }));
            }
            return node;
        });
    }

    // ── selection ─────────────────────────────────────────────────────────────

    function select(key){
        const at = find(key);
        if (!at) return;
        mSelected = key;
        mSelectedIds = at.item ? [at.layer.getId(), at.item.getId()] : [at.layer.getId()];
        showSettings();
    }

    /** the selection made good after the list changed: the same object, else
     *  one of the same ids, else the layer at its place, else the top one */
    function keepSelection(lastIndex = -1){
        if (find(mSelected)) return;
        const list = layers();
        let pick = null;
        if (mSelectedIds) {
            const layer = list.find(l => l.getId() === mSelectedIds[0]);
            if (layer) {
                const item = mSelectedIds[1] !== undefined ? itemsOf(layer).find(it => it.getId() === mSelectedIds[1]) : null;
                pick = item || layer;
            }
        }
        if (!pick && lastIndex >= 0 && list.length) pick = list[Math.max(0, Math.min(lastIndex, list.length - 1))];
        if (!pick && list.length) pick = list[list.length - 1];
        mSelected = pick ? keyOf(pick) : null;
        const at = find(mSelected);
        mSelectedIds = !at ? null : at.item ? [at.layer.getId(), at.item.getId()] : [at.layer.getId()];
    }

    // ── the settings under the list ───────────────────────────────────────────

    /** the params shown for a layer or an item: those the rows do not show */
    function settingsParams(obj, isItem){
        // the order and rows of the layer's panel, when it has them
        const params = obj.getPanelParams ? obj.getPanelParams() : obj.getParams();
        const leave = isItem ? ITEM_ROW_KEYS : LAYER_ROW_KEYS;
        const out = {};
        for (const key of Object.keys(params)) {
            if (leave.includes(key)) continue;
            if (!isItem && key === 'overlays' && isOverlay(obj)) continue;
            out[key] = params[key];
        }
        return out;
    }

    function showSettings(){
        const at = find(mSelected);
        if (!at) { mPanel.clear({ note: layers().length ? 'select a layer' : 'no layers: + adds one' }); return; }
        if (at.item) {
            mPanel.show(at.item, () => settingsParams(at.item, true),
                        { title: at.item.getId(), kind: itemKind(at.layer, at.item) + ' in ' + at.layer.getId() });
            return;
        }
        const layer = at.layer;
        const n = itemsOf(layer).length;
        const note = isOverlay(layer)
            ? (n ? `${n} item${n > 1 ? 's' : ''}, each a row under it` : 'no items') + ': the + button or the menu of the layer adds one'
            : '';
        mPanel.show(layer, () => settingsParams(layer, false), { title: layer.getId(), kind: layerKind(layer), note });
    }

    /** every layer and item has its panel; the panels of those gone go */
    function syncPanels(){
        const now = new Set();
        for (const layer of layers()) {
            now.add(layer);
            if (!mPanel.has(layer)) mPanel.prepare(layer, () => settingsParams(layer, false));
            for (const item of itemsOf(layer)) {
                now.add(item);
                if (!mPanel.has(item)) mPanel.prepare(item, () => settingsParams(item, true));
            }
        }
        for (const obj of mKnown) if (!now.has(obj)) mPanel.forget(obj);
        mKnown = now;
    }

    // ── the commands ──────────────────────────────────────────────────────────

    function addLayer(kind, index){
        const layer = layersParam().addChild(kind, index);
        if (layer) select(keyOf(layer));
    }

    /** a new layer above ('above') or below the selected one (the top without one) */
    function onAdd(where, kind){
        const at = find(mSelected);
        const n = layers().length;
        const index = at ? (where === 'below' ? at.index : at.index + 1) : n;
        addLayer(kind || manager.getLayerKinds()[0]?.name, index);
    }

    function addItem(layer, kind, index){
        const item = itemsParam(layer).addChild(kind, index);
        if (item) select(keyOf(item));
    }

    /** a menu of an overlay's item kinds at (an anchor or a point); pick(kind) adds one */
    function itemKindsMenu(layer, at, title, pick){
        showPopupMenu({ ...at, title, items: itemKinds(layer).map(k => ({ label: k.label, action: () => { pick(k.name); refresh(); } })) });
    }

    function onDuplicate(key){
        const at = find(key);
        if (!at) return;
        const copy = at.item ? itemsParam(at.layer).duplicateChild(at.itemIndex) : layersParam().duplicateChild(at.index);
        if (copy) select(keyOf(copy));
    }

    function onRemove(key){
        const at = find(key);
        if (!at) return;
        if (at.item) {
            itemsParam(at.layer).removeChildAt(at.itemIndex);
            const items = itemsOf(at.layer);
            // the item below, or the one above, or the overlay
            const next = items[Math.max(0, at.itemIndex - 1)] || null;
            select(keyOf(next || at.layer));
        } else {
            layersParam().removeChildAt(at.index);
            // the layer below, or the one that was above the bottom one
            mSelected = null;
            mSelectedIds = null;
            keepSelection(Math.max(0, at.index - 1));
        }
        refresh();
    }

    function onRename(key, name){
        const at = find(key);
        if (!at) return null;
        if (!name) return 'the name is empty';
        if (/\s/.test(name)) return 'a name has no spaces';
        const obj = at.item || at.layer;
        const siblings = at.item ? itemsOf(at.layer) : layers();
        if (siblings.some(o => o !== obj && o.getId() === name)) return `"${name}" is taken`;
        if (obj.getId() === name) return null;
        // through the list: its change is told (the undo step)
        if (at.item) itemsParam(at.layer).setChildId(at.itemIndex, name);
        else layersParam().setChildId(at.index, name);
        mSelectedIds = at.item ? [at.layer.getId(), name] : [name];
        showSettings();
        return null;
    }

    /** a layer's own commands, after the list's: an overlay adds items */
    function layerMenu(key, at){
        const found = find(key);
        if (!found || !isOverlay(found.layer)) return [];
        const layer = found.layer;
        return [
            { label: 'Add item…', title: 'a new item at the top of the overlay',
              action: () => itemKindsMenu(layer, at, 'Add item', (kind) => addItem(layer, kind, itemsOf(layer).length)) },
        ];
    }

    /** an item's commands (the list adds Rename… and Hide or Show) */
    function itemMenu(key, at){
        const found = find(key);
        if (!found || !found.item) return [];
        const { layer, itemIndex: i } = found;
        const last = itemsOf(layer).length - 1;
        const moveTo = (j) => () => itemsParam(layer).moveChildTo(i, j);
        return [
            { label: 'Move up', disabled: i >= last, action: moveTo(i + 1) },
            { label: 'Move down', disabled: i <= 0, action: moveTo(i - 1) },
            { label: 'Move to top', disabled: i >= last, action: moveTo(last) },
            { label: 'Move to bottom', disabled: i <= 0, action: moveTo(0) },
            { separator: true },
            { label: 'Add item above…', action: () => itemKindsMenu(layer, at, 'Add above', (kind) => addItem(layer, kind, i + 1)) },
            { label: 'Add item below…', action: () => itemKindsMenu(layer, at, 'Add below', (kind) => addItem(layer, kind, i)) },
            { label: 'Duplicate', action: () => onDuplicate(key) },
            { separator: true },
            { label: 'Delete', action: () => onRemove(key) },
        ];
    }

    /** the add button's menu: the layer kinds; with an overlay or one of its
     *  items selected, then the item kinds */
    function addItems(at){
        const found = find(mSelected);
        const items = layerKinds().map(k => ({ label: k.label, title: 'a new layer above the selected one', action: () => onAdd('above', k.name) }));
        if (found && isOverlay(found.layer)) {
            const layer = found.layer;
            const index = found.item ? found.itemIndex + 1 : itemsOf(layer).length;
            items.push({ separator: true });
            items.push({ label: `items of ${layer.getId()}:`, disabled: true });
            for (const k of itemKinds(layer)) {
                items.push({ label: k.label, title: found.item ? 'a new item above the selected one' : 'a new item at the top of the overlay',
                             action: () => addItem(layer, k.name, index) });
            }
        }
        return items;
    }

    // ── the window ────────────────────────────────────────────────────────────

    const mList = createLayerList({
        title:       'visualization',
        storageId:   arg.storageId || 'vis_layers',
        left:        arg.left || 'calc(100% - 300px)',
        top:         arg.top || '120px',
        width:       arg.width || '290px',
        height:      arg.height || '440px',
        detail:      true,
        itemTools:   true,
        minLayers:   0,
        getLayers:   nodes,
        onActivate:  select,
        onSelect:    (key) => select(key),
        onVisible:   (key, v) => { const at = find(key); if (at) setParam(at.item || at.layer, 'enabled', v); },
        onOpacity:   (key, v) => { const at = find(key); if (at) setParam(at.layer, 'opacity', v); },
        onRename,
        kinds:       layerKinds,
        addItems,
        addTitle:    'a new layer above the selected one, or an item of the selected overlay',
        onAdd,
        onDuplicate,
        onRemove,
        onMove:      (from, to) => layersParam().moveChildTo(from, to),
        onMoveItem:  (parentKey, from, to) => { const at = find(parentKey); if (at && !at.item) itemsParam(at.layer).moveChildTo(from, to); },
        layerMenu,
        itemMenu,
    });
    const mPanel = createParamPanel({ element: mList.detail });

    function refresh(){
        syncPanels();
        keepSelection();
        mList.refresh();
        showSettings();
    }

    // the manager's changes come many in a row (a slider's drag, a document
    // being loaded): the window follows once they are done
    let mPending = false;
    function schedule(){
        if (mPending) return;
        mPending = true;
        queueMicrotask(() => { mPending = false; refresh(); });
    }
    manager.addListener(schedule);

    // the undo steps, compared after the window followed a change (its
    // panels made for a new layer are in the values compared)
    if (arg.pushUndo) {
        const undo = createParamListUndo({
            param:     layersParam,
            push:      arg.pushUndo,
            label:     'visualization',
            onApplied: (obj) => { if (find(keyOf(obj))) select(keyOf(obj)); },
            // the selected layer or item: a swap of two neighbours is its move
            prefer:    () => { const at = find(mSelected); return at ? (at.item || at.layer).getId() : null; },
        });
        manager.addListener((info) => undo.changed(!!(info && info.system), !!(info && info.load)));
    }

    refresh();

    return {
        window: mList.window,
        refresh,
    };
}
