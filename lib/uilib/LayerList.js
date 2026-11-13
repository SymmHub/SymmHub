/**
 * LayerList.js
 *
 * A tree of layers and of what they hold, in an internal window, the top
 * first at every level. A layer's row has its visibility (an eye), its lock,
 * its name, what it is in grey (its kind, when given) and its opacity; under
 * it, while it is open (the triangle in front), come the rows of its items,
 * indented, and under an item holding others (a group, a shape with content)
 * theirs. An item's row has its visibility and its name (its id), what it is
 * in grey after the name. The lock and the opacity show only for the layers
 * that have them (locked a boolean, opacity a number).
 * A click on a layer's row makes it the active one; a click on an item's row
 * selects the item (Ctrl or Shift: adds it to the selection or takes it out).
 * A double click on a name renames it in place (Enter keeps, Escape drops), a
 * layer's row is dragged to move the layer with all it holds, and with
 * onMoveItem an item's row to move it among the items of the same parent.
 * The hamburger at the right end of a row (or a right click on it) opens its
 * menu. A layer's (the layer made the active one first): move up, down, to
 * the top, to the bottom; add above, below (with kinds: a menu of the kinds
 * first); duplicate; rename; the owner's commands on it (layerMenu); delete.
 * An item's (the item selected first): the owner's commands on it
 * (itemMenu), then rename and hide or show. Under the rows, for the active
 * layer (with itemTools, for the one selected item when there is one): add,
 * duplicate, remove, up, down, rename.
 * The rows of the selected items are marked; when the selection changes, the
 * rows holding them open and the first is scrolled into view.
 * With detail, the window has a lower part under the buttons (list.detail,
 * for the owner to fill), a divider between them sets the height of the rows
 * (remembered with the window's place).
 * The owner keeps the layers and answers the callbacks; refresh() shows them
 * again after the owner changed them (nothing is redrawn when nothing shown
 * changed, so it can be called on every change). The [x] of its header hides
 * the window (list.window.setVisible(true) shows it again; canClose: false,
 * no [x]).
 *
 * Usage:
 *   const list = createLayerList({
 *       title: 'layers', storageId: 'layers_window', left: '...', top: '...',
 *       // bottom to top at every level; children, kind, name, locked and opacity optional;
 *       // name: the text shown and renamed when it is not the id (then the id is only a key)
 *       getLayers:   () => [{ id, name, kind, visible, locked, opacity, active,
 *                             children: [{ id, name, kind, visible, selected, children }] }],
 *       onActivate:  (id) => { ... },
 *       onSelect:    (id, add) => { ... },        // an item's row clicked; add: Ctrl or Shift held
 *       onVisible:   (id, visible) => { ... },    // a layer's or an item's
 *       onLocked:    (id, locked) => { ... },
 *       toggles:     [{ key, on, off, titleOn, titleOff }],  // optional: more on/off buttons of
 *                                                 // the layers after the lock, node[key] a boolean
 *                                                 // (none when not); on, off: svg markup
 *       onToggle:    (id, key, value) => { ... },
 *       onOpacity:   (id, opacity) => { ... },
 *       onRename:    (id, name) => null,          // a layer's or an item's; or the reason the name is refused
 *       layerMenu:   (id, at) => [...],           // more commands on a layer (after Rename…)
 *       itemMenu:    (id, at) => [{ label, title, disabled, action } | { separator: true }],
 *                                                 // at: where the menu was, {anchor} or {x, y}
 *       kinds:       () => [{ name, label }],     // optional: what a new layer can be
 *       addItems:    (at) => [...],               // optional: the add button's menu, made by the owner
 *       addTitle:    '...',                       // optional: the add button's tooltip
 *       onAdd:       (where, kind) => { ... },    // 'above' or 'below' the active layer
 *       onDuplicate: (id) => { ... },             // a layer's, with itemTools an item's
 *       onRemove:    (id) => { ... },
 *       onMove:      (from, to) => { ... },       // indices bottom to top; to: after the move
 *       onMoveItem:  (parentId, from, to) => { ... },  // optional: an item among its parent's items
 *       itemTools:   false,       // the buttons act on the one selected item, when there is one
 *       minLayers:   1,           // the layers that cannot be removed
 *       detail:      false,       // a lower part for the owner (list.detail)
 *   });
 *   list.refresh();
 */

import {
    createInternalWindow,
    createNumberField,
    makeDragReorder,
    showPopupMenu,
} from './modules.js';

const STYLE_ID = 'layer-list-style';

// the indent of a level of the tree, px
const INDENT = 14;
// the height of the rows' part over a lower part, px: at first, and the least
const SPLIT = 150;
const MIN_ROWS = 40;
const MIN_DETAIL = 60;

const CSS = `
.layer-list { display: flex; flex-direction: column; height: 100%; box-sizing: border-box; cursor: default;
              background: var(--background-color, #f9f9f9); font: 12px Verdana, sans-serif; color: #303030; user-select: none; }
.layer-list__rows { flex: 1 1 auto; overflow-y: auto; padding: 2px; }
.layer-list--detail .layer-list__rows { flex: 0 0 auto; }
.layer-list__row { display: flex; align-items: center; gap: 2px; height: 26px; padding: 0 2px;
                   border: 1px solid transparent; border-radius: 3px; }
.layer-list__row:hover { background: var(--hover-background-color, #ececec); }
.layer-list__row--active, .layer-list__row--active:hover { background: #bae6fd; border-color: #0284c7; }
.layer-list__row--item { height: 22px; }
.layer-list__row--selected, .layer-list__row--selected:hover { background: #e0f2fe; border-color: #7dd3fc; }
.layer-list__row--hidden .layer-list__name { color: #909090; }
.layer-list__name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 3px; }
.layer-list__name input { width: 100%; box-sizing: border-box; font: inherit; padding: 0 2px; }
.layer-list__name input.layer-list__bad { outline: 2px solid #d02020; }
.layer-list__kind { color: #909090; font-size: 11px; margin-left: 5px; }
.layer-list__row .layer-list__opacity { height: 20px; }
.layer-list__button { width: 24px; height: 24px; padding: 2px; margin: 0; box-sizing: border-box; flex: 0 0 auto;
                      display: inline-flex; align-items: center; justify-content: center;
                      background: transparent; border: 1px solid transparent; border-radius: 3px; cursor: pointer; }
.layer-list__button:hover { background: var(--hover-background-color, #e0e0e0); }
.layer-list__button:disabled { opacity: 0.35; cursor: default; background: transparent; }
.layer-list__button svg { width: 18px; height: 18px; pointer-events: none; }
.layer-list__row--item .layer-list__button { width: 20px; height: 20px; padding: 1px; }
.layer-list__row--item .layer-list__button svg { width: 16px; height: 16px; }
.layer-list__toggle, .layer-list__row--item .layer-list__toggle { width: 14px; height: 20px; flex: 0 0 14px; padding: 0; }
.layer-list__toggle svg, .layer-list__row--item .layer-list__toggle svg { width: 12px; height: 12px; }
.layer-list__tools { display: flex; gap: 2px; padding: 2px; border-top: 1px solid rgba(0, 0, 0, 0.15); flex: 0 0 auto; }
.layer-list__divider { flex: 0 0 6px; cursor: row-resize; border-top: 1px solid rgba(0, 0, 0, 0.15);
                       background: var(--hover-background-color, #ececec); }
.layer-list__divider:hover { background: #cfe8f7; }
.layer-list__detail { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; }
`;

const STROKE = 'fill="none" stroke="#303030" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
const svg = (body) => `<svg viewBox="0 0 24 24">${body}</svg>`;
const ICONS = {
    shown:     svg(`<path d="M2 12 C6 5 18 5 22 12 C18 19 6 19 2 12 Z" ${STROKE}/><circle cx="12" cy="12" r="3" fill="#303030"/>`),
    hidden:    svg(`<path d="M2 12 C6 5 18 5 22 12 C18 19 6 19 2 12 Z" fill="none" stroke="#a0a0a0" stroke-width="1.5"/><path d="M4 20 L20 4" ${STROKE}/>`),
    locked:    svg(`<rect x="5" y="11" width="14" height="10" rx="1.5" fill="#303030"/><path d="M8 11 V8 A4 4 0 0 1 16 8 V11" ${STROKE}/>`),
    unlocked:  svg(`<rect x="5" y="11" width="14" height="10" rx="1.5" fill="none" stroke="#a0a0a0" stroke-width="1.5"/><path d="M8 11 V8 A4 4 0 0 1 16 7" fill="none" stroke="#a0a0a0" stroke-width="1.5" stroke-linecap="round"/>`),
    add:       svg(`<path d="M12 4 V20 M4 12 H20" ${STROKE}/>`),
    duplicate: svg(`<rect x="3" y="3" width="12" height="12" rx="1" ${STROKE}/><rect x="9" y="9" width="12" height="12" rx="1" fill="#fff" stroke="#303030" stroke-width="1.7"/>`),
    remove:    svg(`<path d="M4 7 H20 M9 7 V4 H15 V7 M6 7 L7 21 H17 L18 7" ${STROKE}/>`),
    up:        svg(`<path d="M12 20 V4 M6 10 L12 4 L18 10" ${STROKE}/>`),
    down:      svg(`<path d="M12 4 V20 M6 14 L12 20 L18 14" ${STROKE}/>`),
    rename:    svg(`<path d="M4 20 L5 15 L16 4 L20 8 L9 19 Z M13.5 6.5 L17.5 10.5" ${STROKE}/>`),
    menu:      svg(`<path d="M4 7 H20 M4 12 H20 M4 17 H20" ${STROKE}/>`),
    open:      svg(`<path d="M5 8 L19 8 L12 18 Z" fill="#505050"/>`),
    closed:    svg(`<path d="M8 5 L18 12 L8 19 Z" fill="#505050"/>`),
};

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

function makeButton(icon, title, action){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layer-list__button';
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.innerHTML = icon;
    // the button takes no focus: the keys stay with the canvas and its tools
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => { e.stopPropagation(); action(e); });
    return btn;
}

/** a button's tooltip changed (and what a screen reader says) */
function setTitle(btn, title){
    btn.title = title;
    btn.setAttribute('aria-label', title);
}

const hasChildren = (node) => !!(node.children && node.children.length);
// the text a row shows and a rename starts from
const label = (node) => node.name ?? node.id;

/** the ids of the selected nodes under the nodes, in the tree's order */
function selectedIds(nodes){
    const out = [];
    const walk = list => { for (const n of list) { if (n.selected) out.push(n.id); if (n.children) walk(n.children); } };
    walk(nodes);
    return out;
}

/** the nodes from the top of the tree down to the one with the id, it last; [] when it is not there */
function pathTo(nodes, id){
    for (const n of nodes) {
        if (n.id === id) return [n];
        if (n.children) {
            const below = pathTo(n.children, id);
            if (below.length) return [n, ...below];
        }
    }
    return [];
}

function storedNumber(key){
    try {
        const v = Number(window.localStorage.getItem(key));
        return Number.isFinite(v) && v > 0 ? v : null;
    } catch (e) { return null; }
}

function storeNumber(key, value){
    try { window.localStorage.setItem(key, String(Math.round(value))); } catch (e) { /* no storage */ }
}

/**
 * @param {object} arg  see the usage above
 */
export function createLayerList(arg) {
    ensureStyle();
    const call = (name, ...a) => (arg[name] ? arg[name](...a) : undefined);
    const minLayers = arg.minLayers ?? 1;

    // its [x] hides it, and whether it shows is remembered with its place
    const closable = arg.canClose !== false;
    const win = createInternalWindow({
        title:         arg.title ?? 'layers',
        left:          arg.left || 'calc(100% - 250px)',
        top:           arg.top || '120px',
        width:         arg.width || '250px',
        height:        arg.height || '170px',
        canClose:      closable,
        canResize:     true,
        alwaysVisible: !closable,
        storageId:     arg.storageId,
    });
    win.interior.style.overflow = 'hidden';

    const content = document.createElement('div');
    content.className = 'layer-list' + (arg.detail ? ' layer-list--detail' : '');
    const rowsEl = document.createElement('div');
    rowsEl.className = 'layer-list__rows';
    rowsEl.setAttribute('role', 'tree');
    rowsEl.setAttribute('aria-label', arg.title ?? 'layers');
    const tools = document.createElement('div');
    tools.className = 'layer-list__tools';
    content.appendChild(rowsEl);
    content.appendChild(tools);
    win.interior.appendChild(content);

    // the lower part for the owner, under a divider that sets the rows' height
    let detail = null;
    if (arg.detail) {
        const splitKey = arg.storageId ? arg.storageId + '_split' : null;
        rowsEl.style.height = ((splitKey && storedNumber(splitKey)) || SPLIT) + 'px';
        const divider = document.createElement('div');
        divider.className = 'layer-list__divider';
        divider.title = 'drag: more room for the list or for the settings under it';
        detail = document.createElement('div');
        detail.className = 'layer-list__detail';
        content.appendChild(divider);
        content.appendChild(detail);
        divider.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            divider.setPointerCapture(e.pointerId);
            const startY = e.clientY, startH = rowsEl.offsetHeight;
            const most = () => content.clientHeight - tools.offsetHeight - divider.offsetHeight - MIN_DETAIL;
            const onMove = (ev) => {
                const h = Math.max(MIN_ROWS, Math.min(most(), startH + ev.clientY - startY));
                rowsEl.style.height = h + 'px';
            };
            const onUp = () => {
                divider.removeEventListener('pointermove', onMove);
                divider.removeEventListener('pointerup', onUp);
                divider.removeEventListener('pointercancel', onUp);
                if (splitKey) storeNumber(splitKey, rowsEl.offsetHeight);
            };
            divider.addEventListener('pointermove', onMove);
            divider.addEventListener('pointerup', onUp);
            divider.addEventListener('pointercancel', onUp);
        });
    }

    let mLayers = [];       // bottom to top, as getLayers() gives them
    let mRows = [];         // the rows shown, top first: {el, id, node, menu}
    let mBlocks = [];       // the layers' rows with all under them, top first: {handle, block}
    let mEditing = null;    // the id being renamed
    let mShown = null;      // what the rows show (signature), null: to be drawn
    let mPending = false;   // a refresh waits for the input being edited
    let mOpacityFields = [];  // the rows' opacity fields (NumberField)
    let mSelected = '';     // the selected items as last shown
    // id -> open; a layer is open and an item closed until toggled
    const mOpen = new Map();

    const isOpen = (node, depth) => (mOpen.has(node.id) ? mOpen.get(node.id) : depth === 0);
    const active = () => mLayers.find(l => l.active) || null;
    const indexOf = (id) => mLayers.findIndex(l => l.id === id);
    const signature = () => JSON.stringify(mLayers) + '|' + JSON.stringify([...mOpen]);
    const kinds = () => (typeof arg.kinds === 'function' ? arg.kinds() : arg.kinds) || null;

    /** what the buttons under the rows act on: with itemTools the one selected
     *  item, {node, parent, siblings}; else the active layer, {node, layer: true}; or null */
    function target(){
        if (arg.itemTools) {
            const ids = selectedIds(mLayers.flatMap(l => l.children || []));
            if (ids.length === 1) {
                const path = pathTo(mLayers, ids[0]);
                if (path.length > 1) {
                    const parent = path[path.length - 2];
                    return { node: path[path.length - 1], parent, siblings: parent.children };
                }
            }
        }
        const a = active();
        return a ? { node: a, layer: true } : null;
    }

    /** a new layer at where ('above' or 'below') the active one; with kinds,
     *  its kind picked first from a menu at (an anchor or a point) */
    function addLayer(where, at){
        const list = kinds();
        if (!list || !list.length) { call('onAdd', where); refresh(); return; }
        if (list.length === 1) { call('onAdd', where, list[0].name); refresh(); return; }
        showPopupMenu({
            ...at,
            title: where === 'below' ? 'Add below' : 'Add above',
            items: list.map(k => ({ label: k.label ?? k.name, title: k.title, action: () => { call('onAdd', where, k.name); refresh(); } })),
        });
    }

    const btnAdd = makeButton(ICONS.add, arg.addTitle || 'a new layer above the active one', () => {
        if (arg.addItems) showPopupMenu({ anchor: btnAdd, items: arg.addItems({ anchor: btnAdd }).map(withRefresh) });
        else addLayer('above', { anchor: btnAdd });
    });
    const btnDup = makeButton(ICONS.duplicate, 'a copy of the active layer', () => { const t = target(); if (t) call('onDuplicate', t.node.id); refresh(); });
    const btnRemove = makeButton(ICONS.remove, 'remove the active layer and all it holds', () => { const t = target(); if (t) call('onRemove', t.node.id); refresh(); });
    const btnUp = makeButton(ICONS.up, 'move the active layer up', () => moveTarget(+1));
    const btnDown = makeButton(ICONS.down, 'move the active layer down', () => moveTarget(-1));
    const btnRename = makeButton(ICONS.rename, 'rename the active layer (or double click its name)', () => { const t = target(); if (t) rename(t.node.id); });
    [btnAdd, btnDup, btnRemove, btnUp, btnDown, btnRename].forEach(b => tools.appendChild(b));

    /** an owner's menu item made to show the list again after its action */
    function withRefresh(it){
        return it.action ? { ...it, action: () => { it.action(); refresh(); } } : it;
    }

    /** the active layer moved by delta places (+1: up), or to the top or the bottom ('top', 'bottom') */
    function move(delta){
        const a = active();
        if (!a) return;
        const i = indexOf(a.id), last = mLayers.length - 1;
        const j = delta === 'top' ? last : delta === 'bottom' ? 0 : i + delta;
        if (j === i || j < 0 || j > last) return;
        call('onMove', i, j);
        refresh();
    }

    /** what the buttons act on moved by delta places (+1: up) */
    function moveTarget(delta){
        const t = target();
        if (!t) return;
        if (t.layer) { move(delta); return; }
        const i = t.siblings.indexOf(t.node), j = i + delta;
        if (j < 0 || j >= t.siblings.length) return;
        call('onMoveItem', t.parent.id, i, j);
        refresh();
    }

    /** the name of a layer or an item edited in its row */
    function rename(id){
        const row = mRows.find(r => r.id === id);
        if (row) startRename(row.el.querySelector('.layer-list__name'), row.node);
    }

    /** a layer's menu, the layer made the active one first; anchored to its
     *  row's hamburger, or at a point of the page */
    function openMenu(id, at = null){
        const l = mLayers.find(x => x.id === id);
        if (!l) return;
        if (!l.active) { call('onActivate', id); refresh(); }
        const a = active();
        const row = mRows.find(r => r.id === id);
        if (!a) return;
        const where = at ? { x: at.x, y: at.y } : row ? { anchor: row.menu } : null;
        if (where) showPopupMenu({ ...where, items: layerMenu(a, where) });
    }

    /** the commands on a layer, as the old layers list's menu had them; the layer is the active one */
    function layerMenu(layer, at){
        const i = indexOf(layer.id), last = mLayers.length - 1;
        const then = (fn) => () => { fn(); refresh(); };
        const more = (arg.layerMenu ? arg.layerMenu(layer.id, at) : null) || [];
        const some = kinds() && kinds().length > 1 ? '…' : '';
        return [
            { label: 'Move up', disabled: i >= last, action: () => move(+1) },
            { label: 'Move down', disabled: i <= 0, action: () => move(-1) },
            { label: 'Move to top', disabled: i >= last, action: () => move('top') },
            { label: 'Move to bottom', disabled: i <= 0, action: () => move('bottom') },
            { separator: true },
            { label: 'Add above' + some, action: () => addLayer('above', at) },
            { label: 'Add below' + some, action: () => addLayer('below', at) },
            { label: 'Duplicate', action: then(() => call('onDuplicate', layer.id)) },
            { label: 'Rename…', action: () => rename(layer.id) },
            ...(more.length ? [{ separator: true }, ...more.map(withRefresh)] : []),
            { separator: true },
            { label: 'Delete', title: 'the layer and all it holds', disabled: mLayers.length <= minLayers, action: then(() => call('onRemove', layer.id)) },
        ];
    }

    /** an item's menu, the item selected first; anchored to its row's
     *  hamburger, or at a point of the page */
    function openItemMenu(id, at = null){
        let node = pathTo(mLayers, id).pop();
        if (!node) return;
        if (!node.selected) { call('onSelect', id, false); refresh(); }
        node = pathTo(mLayers, id).pop() || node;
        const row = mRows.find(r => r.id === id);
        const where = at ? { x: at.x, y: at.y } : row ? { anchor: row.menu } : null;
        if (!where) return;
        const own = (arg.itemMenu ? arg.itemMenu(id, where) : null) || [];
        const items = [
            ...own.map(withRefresh),
            ...(own.length ? [{ separator: true }] : []),
            { label: 'Rename…', action: () => rename(id) },
            { label: node.visible ? 'Hide' : 'Show', action: () => { call('onVisible', id, !node.visible); refresh(); } },
        ];
        showPopupMenu({ ...where, items });
    }

    // the layers' rows are dragged to a new place, with all under them; the list shows the top first
    const drag = makeDragReorder({
        getRows: () => mBlocks,
        onMove:  (from, to) => {
            const n = mLayers.length;
            call('onMove', n - 1 - from, n - 1 - to);
            refresh();
        },
    });

    function startRename(nameEl, node){
        if (!nameEl || !node) return;
        mEditing = node.id;
        const input = document.createElement('input');
        input.value = label(node);
        nameEl.replaceChildren(input);
        input.focus();
        input.select();
        let done = false;
        const finish = (keep) => {
            if (done) return;
            const name = input.value.trim();
            if (keep && name !== label(node)) {
                const refused = call('onRename', node.id, name);
                if (refused) {
                    input.classList.add('layer-list__bad');
                    input.title = refused;
                    input.focus();
                    return;
                }
                // the row stays open or closed under its new name (a key apart from the name stays)
                if (node.name === undefined && mOpen.has(node.id)) { mOpen.set(name, mOpen.get(node.id)); mOpen.delete(node.id); }
            }
            done = true;
            mEditing = null;
            // the input goes even when nothing changed
            mShown = null;
            refresh();
        };
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        input.addEventListener('input', () => { input.classList.remove('layer-list__bad'); input.title = ''; });
        input.addEventListener('blur', () => finish(true));
        input.addEventListener('pointerdown', (e) => e.stopPropagation());
        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('dblclick', (e) => e.stopPropagation());
    }

    /** the triangle that opens and closes a row holding others, else a space as wide */
    function makeToggle(node, depth){
        if (!hasChildren(node)) {
            const space = document.createElement('span');
            space.className = 'layer-list__toggle';
            return space;
        }
        const open = isOpen(node, depth);
        const btn = makeButton(open ? ICONS.open : ICONS.closed, open ? 'close (hide what it holds)' : 'open (show what it holds)',
                               () => { mOpen.set(node.id, !open); render(); });
        btn.classList.add('layer-list__toggle');
        return btn;
    }

    function makeEye(node){
        return makeButton(node.visible ? ICONS.shown : ICONS.hidden, node.visible ? 'visible (a click hides it)' : 'hidden (a click shows it)',
                          () => { call('onVisible', node.id, !node.visible); refresh(); });
    }

    function makeName(node, kind = ''){
        const name = document.createElement('span');
        name.className = 'layer-list__name';
        name.textContent = label(node);
        if (kind) {
            const k = document.createElement('span');
            k.className = 'layer-list__kind';
            k.textContent = kind;
            name.appendChild(k);
        }
        name.title = label(node) + (kind ? ', ' + kind : '') + ' (a double click renames it)';
        name.addEventListener('dblclick', (e) => { e.stopPropagation(); startRename(name, node); });
        return name;
    }

    function treeRow(row, node, depth, selected){
        row.setAttribute('role', 'treeitem');
        row.setAttribute('aria-level', String(depth + 1));
        row.setAttribute('aria-selected', selected ? 'true' : 'false');
        if (hasChildren(node)) row.setAttribute('aria-expanded', isOpen(node, depth) ? 'true' : 'false');
    }

    function makeLayerRow(layer){
        const row = document.createElement('div');
        row.className = 'layer-list__row' + (layer.active ? ' layer-list__row--active' : '') + (layer.visible ? '' : ' layer-list__row--hidden');
        treeRow(row, layer, 0, layer.active);
        row.appendChild(makeToggle(layer, 0));
        row.appendChild(makeEye(layer));
        if (typeof layer.locked === 'boolean') {
            row.appendChild(makeButton(layer.locked ? ICONS.locked : ICONS.unlocked, layer.locked ? 'locked: its shapes cannot be picked' : 'unlocked',
                                       () => { call('onLocked', layer.id, !layer.locked); refresh(); }));
        }
        for (const t of arg.toggles || []) {
            if (typeof layer[t.key] !== 'boolean') continue;
            const on = layer[t.key];
            row.appendChild(makeButton(on ? t.on : t.off, on ? t.titleOn : t.titleOff,
                                       () => { call('onToggle', layer.id, t.key, !on); refresh(); }));
        }
        row.appendChild(makeName(layer, layer.kind || ''));
        if (typeof layer.opacity === 'number') {
            // the wheel, Up / Down and the arrows step the digit after the caret (NumberField.js)
            let value = layer.opacity;
            const opacity = createNumberField({
                get: () => value,
                set: (v) => { value = v; call('onOpacity', layer.id, v); },
                min: 0, max: 1, step: 0.05, digits: 2, title: 'opacity of the layer',
                // the rows are drawn again once the value is left, or the arrow let go
                onCommit: () => { if (mPending && !opacity.busy()) setTimeout(refresh, 0); },
            });
            opacity.el.classList.add('layer-list__opacity');
            opacity.el.addEventListener('pointerdown', (e) => e.stopPropagation());
            mOpacityFields.push(opacity);
            row.appendChild(opacity.el);
        }
        // the layer's menu: its hamburger, or a right click on the row
        const menu = makeButton(ICONS.menu, 'move, add, duplicate, rename, delete', () => openMenu(layer.id));
        menu.setAttribute('aria-haspopup', 'menu');
        row.appendChild(menu);
        row.addEventListener('contextmenu', (e) => { e.preventDefault(); openMenu(layer.id, { x: e.clientX, y: e.clientY }); });
        row.addEventListener('click', () => { if (!layer.active) { call('onActivate', layer.id); refresh(); } });
        drag.attach(row);
        return { el: row, id: layer.id, node: layer, menu };
    }

    /** an item's row; dim: a layer or an item holding it is hidden */
    function makeItemRow(node, depth, dim){
        const row = document.createElement('div');
        row.className = 'layer-list__row layer-list__row--item' + (node.selected ? ' layer-list__row--selected' : '') +
                        ((dim || !node.visible) ? ' layer-list__row--hidden' : '');
        row.style.paddingLeft = (2 + depth*INDENT) + 'px';
        treeRow(row, node, depth, node.selected);
        row.appendChild(makeToggle(node, depth));
        row.appendChild(makeEye(node));
        row.appendChild(makeName(node, node.kind || ''));
        const menu = makeButton(ICONS.menu, 'the commands on the item', () => openItemMenu(node.id));
        menu.setAttribute('aria-haspopup', 'menu');
        row.appendChild(menu);
        row.addEventListener('contextmenu', (e) => { e.preventDefault(); openItemMenu(node.id, { x: e.clientX, y: e.clientY }); });
        row.addEventListener('click', (e) => { call('onSelect', node.id, e.ctrlKey || e.shiftKey || e.metaKey); refresh(); });
        return { el: row, id: node.id, node, menu };
    }

    /** the rows of the items of parent, top first, each in a block with the
     *  rows under it; with onMoveItem they are dragged among themselves */
    function addItemRows(into, parent, depth, dim){
        const nodes = parent.children;
        const blocks = [];
        for (const node of [...nodes].reverse()) {
            const block = document.createElement('div');
            const row = makeItemRow(node, depth, dim);
            block.appendChild(row.el);
            into.appendChild(block);
            mRows.push(row);
            blocks.push({ handle: row.el, block });
            if (hasChildren(node) && isOpen(node, depth)) addItemRows(block, node, depth + 1, dim || !node.visible);
        }
        if (arg.onMoveItem && blocks.length > 1) {
            const n = nodes.length;
            const itemDrag = makeDragReorder({
                getRows: () => blocks,
                onMove:  (from, to) => { call('onMoveItem', parent.id, n - 1 - from, n - 1 - to); refresh(); },
            });
            blocks.forEach(b => itemDrag.attach(b.handle));
        }
    }

    /** the rows drawn again from the tree as last read */
    function render(){
        const scroll = rowsEl.scrollTop;
        rowsEl.replaceChildren();
        mRows = [];
        mBlocks = [];
        mOpacityFields = [];
        for (const layer of [...mLayers].reverse()) {
            const block = document.createElement('div');
            block.className = 'layer-list__block';
            const row = makeLayerRow(layer);
            block.appendChild(row.el);
            mRows.push(row);
            if (hasChildren(layer) && isOpen(layer, 0)) addItemRows(block, layer, 1, !layer.visible);
            rowsEl.appendChild(block);
            mBlocks.push({ handle: row.el, block });
        }
        rowsEl.scrollTop = scroll;
        mShown = signature();
        const t = target();
        if (t && !t.layer) {
            const i = t.siblings.indexOf(t.node), last = t.siblings.length - 1;
            btnDup.disabled = false;
            btnRemove.disabled = false;
            btnUp.disabled = i >= last;
            btnDown.disabled = i <= 0;
            btnRename.disabled = false;
            setTitle(btnDup, 'a copy of the selected item');
            setTitle(btnRemove, 'remove the selected item');
            setTitle(btnUp, 'move the selected item up');
            setTitle(btnDown, 'move the selected item down');
            setTitle(btnRename, 'rename the selected item (or double click its name)');
        } else {
            const a = t ? t.node : null;
            const i = a ? indexOf(a.id) : -1;
            btnDup.disabled = !a;
            btnRemove.disabled = !a || mLayers.length <= minLayers;
            btnUp.disabled = !a || i >= mLayers.length - 1;
            btnDown.disabled = !a || i <= 0;
            btnRename.disabled = !a;
            setTitle(btnDup, 'a copy of the active layer');
            setTitle(btnRemove, 'remove the active layer and all it holds');
            setTitle(btnUp, 'move the active layer up');
            setTitle(btnDown, 'move the active layer down');
            setTitle(btnRename, 'rename the active layer (or double click its name)');
        }
    }

    /** the row with the id scrolled into the list's view */
    function scrollToRow(id){
        const row = mRows.find(r => r.id === id);
        if (!row) return;
        const r = row.el.getBoundingClientRect(), c = rowsEl.getBoundingClientRect();
        if (r.top < c.top) rowsEl.scrollTop -= c.top - r.top;
        else if (r.bottom > c.bottom) rowsEl.scrollTop += r.bottom - c.bottom;
    }

    function refresh(){
        if (mEditing) return;
        // not while an opacity is typed or stepped by a held arrow: once it is left
        if (mOpacityFields.some(f => f.busy())) { mPending = true; return; }
        mPending = false;
        mLayers = (arg.getLayers ? arg.getLayers() : []) || [];
        // a selection made elsewhere is shown: the rows holding it open
        const selected = selectedIds(mLayers);
        const key = selected.join(' ');
        const reveal = key !== mSelected && selected.length > 0;
        mSelected = key;
        if (reveal) for (const id of selected) pathTo(mLayers, id).slice(0, -1).forEach(n => mOpen.set(n.id, true));
        if (signature() !== mShown) render();
        if (reveal) scrollToRow(selected[0]);
    }

    refresh();

    return { window: win, refresh, detail };
}
