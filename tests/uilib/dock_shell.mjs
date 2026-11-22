/*
  Unit tests for lib/uilib/DockShell.js + InternalWindow dock/undock & resetLayout:
    node tests/uilib/dock_shell.mjs
*/

function makeStorage() {
    const m = new Map();
    return {
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => { m.set(k, String(v)); },
        removeItem: (k) => { m.delete(k); },
        clear: () => m.clear(),
        keys: () => [...m.keys()],
    };
}

function makeClassList(el) {
    const set = new Set();
    return {
        add: (...names) => names.forEach(n => set.add(n)),
        remove: (...names) => names.forEach(n => set.delete(n)),
        toggle: (n, force) => {
            if (force === undefined) {
                if (set.has(n)) { set.delete(n); return false; }
                set.add(n); return true;
            }
            if (force) set.add(n); else set.delete(n);
            return !!force;
        },
        contains: (n) => set.has(n),
    };
}

function makeElement(tag = 'div') {
    const children = [];
    const attrs = new Map();
    const listeners = new Map();
    const style = {
        setProperty(k, v) { this[k] = v; },
    };
    const el = {
        tagName: tag.toUpperCase(),
        children,
        parentElement: null,
        style,
        classList: makeClassList(),
        textContent: '',
        title: '',
        value: '',
        disabled: false,
        offsetWidth: 320,
        offsetHeight: 240,
        clientWidth: 320,
        clientHeight: 240,
        setAttribute(k, v) { attrs.set(k, String(v)); },
        getAttribute(k) { return attrs.get(k) ?? null; },
        appendChild(child) {
            if (child.parentElement && child.parentElement !== el) {
                const idx = child.parentElement.children.indexOf(child);
                if (idx >= 0) child.parentElement.children.splice(idx, 1);
            }
            if (!children.includes(child)) children.push(child);
            child.parentElement = el;
            return child;
        },
        insertBefore(child, ref) {
            if (child.parentElement) {
                const idx = child.parentElement.children.indexOf(child);
                if (idx >= 0) child.parentElement.children.splice(idx, 1);
            }
            const refIdx = children.indexOf(ref);
            if (refIdx >= 0) children.splice(refIdx, 0, child);
            else children.push(child);
            child.parentElement = el;
            return child;
        },
        append(...nodes) { nodes.forEach(n => el.appendChild(n)); },
        replaceChildren(...nodes) {
            for (const c of children) c.parentElement = null;
            children.length = 0;
            nodes.forEach(n => el.appendChild(n));
        },
        addEventListener(type, fn) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(fn);
        },
        removeEventListener(type, fn) {
            const arr = listeners.get(type);
            if (!arr) return;
            const i = arr.indexOf(fn);
            if (i >= 0) arr.splice(i, 1);
        },
        click() {
            if (el.onclick) el.onclick({ preventDefault() {}, stopPropagation() {} });
            for (const fn of (listeners.get('click') || [])) fn({ preventDefault() {}, stopPropagation() {} });
        },
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 320, bottom: 240, width: 320, height: 240 }),
    };
    return el;
}

const storage = makeStorage();
const head = makeElement('head');
const body = makeElement('body');
globalThis.localStorage = storage;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 800;
globalThis.document = {
    head,
    body,
    documentElement: { dataset: {} },
    createElement: (tag) => makeElement(tag),
    createTextNode: (t) => ({ nodeValue: String(t), parentElement: null }),
    getElementsByTagName: (tag) => (tag === 'head' ? [head] : tag === 'body' ? [body] : []),
    getElementById: () => null,
    querySelector: () => null,
};
globalThis.window = {
    localStorage: storage,
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener() {},
    getComputedStyle: (el) => ({
        left: el.style.left || '0px',
        top: el.style.top || '0px',
        width: el.style.width || '320px',
        height: el.style.height || '240px',
        boxSizing: 'content-box',
    }),
};
globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
};

const {
    createInternalWindow,
    createDockShell,
} = await import('../../lib/uilib/uilib.js');

let failed = 0, checks = 0;
function check(ok, msg) {
    checks++;
    if (!ok) { failed++; console.log('FAILED:', msg); }
}

// Seed unrelated document-folder storage keys to verify resetLayout never touches them
storage.setItem('symdraw_doc_folder_config', JSON.stringify({ exportWidth: 2048 }));
storage.setItem('symdraw_doc_folder_docFileDialog_visible', 'true');
storage.setItem('symmhub_theme', 'dark');

const wLayers = createInternalWindow({ title: 'layers', storageId: 'symdraw_layers', canClose: true, canResize: true });
const wStyle  = createInternalWindow({ title: 'style',  storageId: 'symdraw_style',  canClose: true, canResize: true });
const wSym    = createInternalWindow({ title: 'symmetry', storageId: 'symmetry_window', canClose: true, canResize: true });
const wSamples = createInternalWindow({ title: 'samples', storageId: 'samples', canClose: true, canResize: true });

let stageResizes = 0;
const shell = createDockShell({
    storagePrefix:     'symdraw_doc_folder_studio',
    defaultTab:        'layers',
    defaultSplitTab:   'style',
    defaultDrawerOpen: true,
    onStageResize:     () => { stageResizes++; },
});

shell.addPanel({ id: 'layers',   label: 'Layers',   window: wLayers });
shell.addPanel({ id: 'style',    label: 'Style',    window: wStyle });
shell.addPanel({ id: 'symmetry', label: 'Symmetry', window: wSym });
shell.setBottomDrawer(wSamples, { title: 'Samples', startOpen: true });

// 1. Default tab, split view, and drawer open
check(wLayers.isDocked() === true, '1: layers window is docked');
check(wStyle.isDocked() === true, '1: style window is docked');
check(wSym.isDocked() === true, '1: symmetry window is docked');
check(wSamples.isDocked() === true, '1: samples window is docked in drawer');
check(shell.isRightOpen() === true, '1: right dock starts open');
check(shell.getState().activeTab === 'layers', '1: default primary tab is layers');
check(shell.isSplitOpen() === true && shell.getState().splitTab === 'style', '1: default split tab is style');
check(wLayers.isVisible() === true, '1: primary tab reports visible');
check(wStyle.isVisible() === true, '1: secondary split tab reports visible');
check(wSym.isVisible() === false, '1: inactive tab reports not visible');
check(shell.isDrawerOpen() === true, '1: samples drawer starts open');

// 2. Switching primary tab + swapping with split tab
shell.activateTab('symmetry');
check(shell.getState().activeTab === 'symmetry', '2: activateTab switches to symmetry');
check(wSym.isVisible() === true && wLayers.isVisible() === false, '2: symmetry visible, layers hidden');
shell.activateTab('style');
check(shell.getState().activeTab === 'style' && shell.getState().splitTab === 'symmetry', '2: activating splitTab swaps upper/lower panes');

// 3. Undock -> floating -> redock round-trip
shell.undockPanel('style');
check(wStyle.isDocked() === false, '3: undockPanel makes window floating');
check(wStyle.wnd.style.display === '', '3: floating frame restored');
check(wStyle.interior.parentElement === wStyle.wnd, '3: interior returned to floating window');
check(shell.getState().undocked.includes('style'), '3: undocked state recorded');
check(wStyle.header.children.some(c => c.className === 'dock-button-style'), '3: floating header has Dock button');

// Clicking the floating header Dock button redocks it
const dockBtn = wStyle.header.children.find(c => c.className === 'dock-button-style');
dockBtn.click();
check(wStyle.isDocked() === true, '3: clicking header Dock button redocks window');
check(!shell.getState().undocked.includes('style'), '3: removed from undocked list');
check(shell.getState().activeTab === 'style', '3: redocked panel becomes active tab');

// 4. Persisted layout survives reload, and resetLayout clears layout keys non-destructively
shell.undockPanel('symmetry');
shell.setDrawerOpen(false);
check(storage.getItem('symdraw_doc_folder_studio_layout') !== null, '4: layout persisted in localStorage');
storage.setItem('symdraw_layers_params', '{"left":"50px"}');

shell.resetLayout();
check(storage.getItem('symdraw_doc_folder_studio_layout') === null, '4: resetLayout removed studio layout key');
check(storage.getItem('symdraw_layers_params') === null, '4: resetLayout cleared docked panel geometry key');
check(wSym.isDocked() === true, '4: resetLayout redocked floating symmetry panel');
check(shell.getState().activeTab === 'layers', '4: resetLayout restored default primary tab');
check(shell.getState().splitTab === 'style' && shell.isSplitOpen(), '4: resetLayout restored default split');
check(shell.isDrawerOpen() === true, '4: resetLayout restored default drawer open state');

// Non-destructive guarantee: unrelated app document-folder & theme keys untouched
check(storage.getItem('symdraw_doc_folder_config') === JSON.stringify({ exportWidth: 2048 }),
      '4: resetLayout did not touch app config');
check(storage.getItem('symdraw_doc_folder_docFileDialog_visible') === 'true',
      '4: resetLayout did not touch document folder dialog state');
check(storage.getItem('symmhub_theme') === 'dark',
      '4: resetLayout did not touch global theme preference');
check(stageResizes > 0, '4: onStageResize fired on layout changes');

console.log(`${checks - failed} of ${checks} checks passed`);
if (failed) process.exit(1);
