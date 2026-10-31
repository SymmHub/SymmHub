/**
 * LayerList.js
 *
 * A list of layers in an internal window, the top layer first: a row per
 * layer with its visibility (an eye), its lock, its name and its opacity. A
 * click on a row makes its layer the active one, a double click on the name
 * renames it in place (Enter keeps, Escape drops), a drag moves the row.
 * Under the rows: add, duplicate, remove, up and down, for the active layer.
 * The owner keeps the layers and answers the callbacks; refresh() shows them
 * again after the owner changed them.
 *
 * Usage:
 *   const list = createLayerList({
 *       title: 'layers', storageId: 'layers_window', left: '...', top: '...',
 *       getLayers:   () => [{ id, visible, locked, opacity, active }],   // bottom to top
 *       onActivate:  (id) => { ... },
 *       onVisible:   (id, visible) => { ... },
 *       onLocked:    (id, locked) => { ... },
 *       onOpacity:   (id, opacity) => { ... },
 *       onRename:    (id, name) => null,      // or the reason the name is refused
 *       onAdd:       () => { ... },
 *       onDuplicate: (id) => { ... },
 *       onRemove:    (id) => { ... },
 *       onMove:      (from, to) => { ... },   // indices bottom to top; to: after the move
 *   });
 *   list.refresh();
 */

import {
    createInternalWindow,
    makeDragReorder,
} from './modules.js';

const STYLE_ID = 'layer-list-style';

const CSS = `
.layer-list { display: flex; flex-direction: column; height: 100%; box-sizing: border-box; cursor: default;
              background: var(--background-color, #f9f9f9); font: 12px Verdana, sans-serif; color: #303030; user-select: none; }
.layer-list__rows { flex: 1 1 auto; overflow-y: auto; padding: 2px; }
.layer-list__row { display: flex; align-items: center; gap: 2px; height: 26px; padding: 0 2px;
                   border: 1px solid transparent; border-radius: 3px; }
.layer-list__row:hover { background: var(--hover-background-color, #ececec); }
.layer-list__row--active, .layer-list__row--active:hover { background: #bae6fd; border-color: #0284c7; }
.layer-list__row--hidden .layer-list__name { color: #909090; }
.layer-list__name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 3px; }
.layer-list__name input { width: 100%; box-sizing: border-box; font: inherit; padding: 0 2px; }
.layer-list__name input.layer-list__bad { outline: 2px solid #d02020; }
.layer-list__opacity { width: 46px; height: 20px; box-sizing: border-box; font: inherit; padding: 0 2px; }
.layer-list__button { width: 24px; height: 24px; padding: 2px; margin: 0; box-sizing: border-box; flex: 0 0 auto;
                      display: inline-flex; align-items: center; justify-content: center;
                      background: transparent; border: 1px solid transparent; border-radius: 3px; cursor: pointer; }
.layer-list__button:hover { background: var(--hover-background-color, #e0e0e0); }
.layer-list__button:disabled { opacity: 0.35; cursor: default; background: transparent; }
.layer-list__button svg { width: 18px; height: 18px; pointer-events: none; }
.layer-list__tools { display: flex; gap: 2px; padding: 2px; border-top: 1px solid rgba(0, 0, 0, 0.15); }
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
    btn.addEventListener('click', (e) => { e.stopPropagation(); action(); });
    return btn;
}

/**
 * @param {object} arg  see the usage above
 */
export function createLayerList(arg) {
    ensureStyle();
    const call = (name, ...a) => (arg[name] ? arg[name](...a) : undefined);

    const win = createInternalWindow({
        title:         arg.title ?? 'layers',
        left:          arg.left || 'calc(100% - 250px)',
        top:           arg.top || '120px',
        width:         arg.width || '230px',
        height:        arg.height || '170px',
        canClose:      false,
        canResize:     true,
        alwaysOnTop:   true,
        alwaysVisible: true,
        storageId:     arg.storageId,
    });
    win.interior.style.overflow = 'hidden';

    const content = document.createElement('div');
    content.className = 'layer-list';
    const rowsEl = document.createElement('div');
    rowsEl.className = 'layer-list__rows';
    rowsEl.setAttribute('role', 'listbox');
    rowsEl.setAttribute('aria-label', arg.title ?? 'layers');
    const tools = document.createElement('div');
    tools.className = 'layer-list__tools';
    content.appendChild(rowsEl);
    content.appendChild(tools);
    win.interior.appendChild(content);

    let mLayers = [];       // bottom to top, as getLayers() gives them
    let mRows = [];         // the rows shown, top first: {el, id}
    let mEditing = null;    // the id being renamed

    const active = () => mLayers.find(l => l.active) || null;
    const indexOf = (id) => mLayers.findIndex(l => l.id === id);

    const btnAdd = makeButton(ICONS.add, 'a new layer above the active one', () => { call('onAdd'); refresh(); });
    const btnDup = makeButton(ICONS.duplicate, 'a copy of the active layer', () => { const a = active(); if (a) call('onDuplicate', a.id); refresh(); });
    const btnRemove = makeButton(ICONS.remove, 'remove the active layer and its shapes', () => { const a = active(); if (a) call('onRemove', a.id); refresh(); });
    const btnUp = makeButton(ICONS.up, 'move the active layer up', () => move(+1));
    const btnDown = makeButton(ICONS.down, 'move the active layer down', () => move(-1));
    [btnAdd, btnDup, btnRemove, btnUp, btnDown].forEach(b => tools.appendChild(b));

    function move(delta){
        const a = active();
        if (!a) return;
        const i = indexOf(a.id), j = i + delta;
        if (j < 0 || j >= mLayers.length) return;
        call('onMove', i, j);
        refresh();
    }

    // rows are dragged to a new place; the list shows the top first
    const drag = makeDragReorder({
        getRows: () => mRows.map(r => ({ handle: r.el, block: r.el })),
        onMove:  (from, to) => {
            const n = mLayers.length;
            call('onMove', n - 1 - from, n - 1 - to);
            refresh();
        },
    });

    function startRename(nameEl, layer){
        mEditing = layer.id;
        const input = document.createElement('input');
        input.value = layer.id;
        nameEl.replaceChildren(input);
        input.focus();
        input.select();
        let done = false;
        const finish = (keep) => {
            if (done) return;
            if (keep && input.value !== layer.id) {
                const refused = call('onRename', layer.id, input.value.trim());
                if (refused) {
                    input.classList.add('layer-list__bad');
                    input.title = refused;
                    input.focus();
                    return;
                }
            }
            done = true;
            mEditing = null;
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
    }

    function makeRow(layer){
        const row = document.createElement('div');
        row.className = 'layer-list__row' + (layer.active ? ' layer-list__row--active' : '') + (layer.visible ? '' : ' layer-list__row--hidden');
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', layer.active ? 'true' : 'false');
        row.appendChild(makeButton(layer.visible ? ICONS.shown : ICONS.hidden, layer.visible ? 'visible (a click hides it)' : 'hidden (a click shows it)',
                                   () => { call('onVisible', layer.id, !layer.visible); refresh(); }));
        row.appendChild(makeButton(layer.locked ? ICONS.locked : ICONS.unlocked, layer.locked ? 'locked: its shapes cannot be picked' : 'unlocked',
                                   () => { call('onLocked', layer.id, !layer.locked); refresh(); }));
        const name = document.createElement('span');
        name.className = 'layer-list__name';
        name.textContent = layer.id;
        name.title = layer.id + ' (a double click renames it)';
        name.addEventListener('dblclick', () => startRename(name, layer));
        row.appendChild(name);
        const opacity = document.createElement('input');
        opacity.type = 'number';
        opacity.className = 'layer-list__opacity';
        opacity.min = '0'; opacity.max = '1'; opacity.step = '0.05';
        opacity.value = String(Math.round(layer.opacity*100)/100);
        opacity.title = 'opacity of the layer';
        opacity.addEventListener('input', () => {
            const v = Number(opacity.value);
            if (Number.isFinite(v)) call('onOpacity', layer.id, Math.max(0, Math.min(1, v)));
        });
        opacity.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') { opacity.blur(); e.preventDefault(); } });
        opacity.addEventListener('pointerdown', (e) => e.stopPropagation());
        row.appendChild(opacity);
        row.addEventListener('click', () => { if (!layer.active) { call('onActivate', layer.id); refresh(); } });
        drag.attach(row);
        return { el: row, id: layer.id };
    }

    function refresh(){
        if (mEditing) return;
        mLayers = (arg.getLayers ? arg.getLayers() : []) || [];
        rowsEl.replaceChildren();
        mRows = [...mLayers].reverse().map(makeRow);
        mRows.forEach(r => rowsEl.appendChild(r.el));
        const a = active();
        const i = a ? indexOf(a.id) : -1;
        btnDup.disabled = !a;
        btnRemove.disabled = !a || mLayers.length < 2;
        btnUp.disabled = !a || i >= mLayers.length - 1;
        btnDown.disabled = !a || i <= 0;
    }

    refresh();

    return { window: win, refresh };
}
