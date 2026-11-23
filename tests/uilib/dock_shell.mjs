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
        dispatch(type, ev = {}) {
            const event = {
                target: el,
                button: 0,
                pointerId: 1,
                preventDefault() {},
                stopPropagation() {},
                ...ev,
            };
            for (const fn of [...(listeners.get(type) || [])]) fn(event);
        },
        closest(sel) {
            if (sel === 'button' && el.tagName === 'BUTTON') return el;
            return el.parentElement?.closest ? el.parentElement.closest(sel) : null;
        },
        setPointerCapture() {},
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

// 2. Switching primary tab + swapping with split tab + open:false respects collapsed dock
shell.activateTab('symmetry');
check(shell.getState().activeTab === 'symmetry', '2: activateTab switches to symmetry');
check(wSym.isVisible() === true && wLayers.isVisible() === false, '2: symmetry visible, layers hidden');
shell.activateTab('style');
check(shell.getState().activeTab === 'style' && shell.getState().splitTab === 'symmetry', '2: activating splitTab swaps upper/lower panes');

shell.setRightOpen(false);
const resizesBeforeSilentTab = stageResizes;
shell.activateTab('layers', { open: false });
check(shell.isRightOpen() === false, '2: activateTab({ open: false }) keeps collapsed right dock closed');
check(shell.getState().activeTab === 'layers', '2: activateTab({ open: false }) preselects requested tab');
check(stageResizes === resizesBeforeSilentTab, '2: activateTab({ open: false }) does not fire onStageResize');
shell.setRightOpen(true);

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

// 5. Floating canvas mode: toggle, resize handles, move without rerender, clamping, persistence, reset
shell.stage.clientWidth = 1000;
shell.stage.clientHeight = 700;

check(shell.isCanvasFloating() === false, '5: canvas starts docked by default');
check(shell.canvasHost.parentElement === shell.canvasWindow, '5: canvasHost lives inside canvasWindow');
check(shell.canvasWindow.parentElement === shell.stage, '5: canvasWindow lives inside stage');

const resizesBeforeFloat = stageResizes;
shell.setCanvasFloating(true);
check(shell.isCanvasFloating() === true, '5: setCanvasFloating(true) enables floating mode');
check(shell.stage.classList.contains('studio-stage--floating'), '5: stage gets floating class');
check(shell.canvasWindow.classList.contains('studio-canvas-win--floating'), '5: canvasWindow gets floating class');
check(stageResizes === resizesBeforeFloat + 1, '5: entering floating mode fires onStageResize once');

const initRect = shell.getCanvasRect();
check(initRect && initRect.width >= 180 && initRect.height >= 140, '5: floating mode initializes valid rect');
check(initRect.width < 1000 && initRect.height < 700, '5: default floating rect is smaller than stage');

// Explicit size and position via setCanvasRect
const resizesBeforeSet = stageResizes;
shell.setCanvasRect({ left: 20, top: 20, width: 500, height: 400 });
check(stageResizes === resizesBeforeSet + 1, '5: setCanvasRect fires onStageResize when size changes');
check(shell.getCanvasRect().width === 500 && shell.getCanvasRect().height === 400, '5: canvas rect matches set size');

// Moving without changing size must NOT trigger onStageResize (avoids heavy canvas rerender)
const resizesBeforeMove = stageResizes;
shell.setCanvasRect({ left: 100, top: 80, width: 500, height: 400 });
check(stageResizes === resizesBeforeMove, '5: moving canvas without size change does not fire onStageResize');
check(shell.getCanvasRect().left === 100 && shell.getCanvasRect().top === 80, '5: canvas moved cleanly');

// Toggling right dock & drawer while floating canvas still fits must NOT trigger onStageResize
const resizesBeforeChromeToggle = stageResizes;
shell.setRightOpen(false);
shell.setDrawerOpen(false);
shell.setRightOpen(true);
check(stageResizes === resizesBeforeChromeToggle, '5: toggling dock/drawer in floating mode avoids redundant canvas resize when canvas still fits');

// Dragging header moves floating canvas without triggering onStageResize
const canvasHeader = shell.canvasWindow.children.find(c => c.className === 'studio-canvas-win__header');
const resizesBeforeDrag = stageResizes;
canvasHeader.dispatch('pointerdown', { clientX: 200, clientY: 100 });
canvasHeader.dispatch('pointermove', { clientX: 260, clientY: 140 });
canvasHeader.dispatch('pointerup',   { clientX: 260, clientY: 140 });
check(stageResizes === resizesBeforeDrag, '5: dragging floating canvas header does not fire onStageResize');
check(shell.getCanvasRect().left === 160 && shell.getCanvasRect().top === 120, '5: dragging header updates position');

// Dragging bottom edge ('s') adjusts height only and fires onStageResize
const southHandle = shell.canvasWindow.children.find(c => c.className.includes('studio-canvas-win__resize--s'));
const resizesBeforeSouth = stageResizes;
southHandle.dispatch('pointerdown', { clientX: 250, clientY: 520 });
southHandle.dispatch('pointermove', { clientX: 300, clientY: 420 });
southHandle.dispatch('pointerup',   { clientX: 300, clientY: 420 });
check(stageResizes === resizesBeforeSouth + 1, '5: dragging bottom edge fires onStageResize');
check(shell.getCanvasRect().width === 500 && shell.getCanvasRect().height === 300, '5: bottom edge adjusts height only');

// Dragging left edge ('w') adjusts left & width while keeping right edge fixed
const westHandle = shell.canvasWindow.children.find(c => c.className.includes('studio-canvas-win__resize--w'));
const rightBeforeWest = shell.getCanvasRect().left + shell.getCanvasRect().width;
westHandle.dispatch('pointerdown', { clientX: 160, clientY: 200 });
westHandle.dispatch('pointermove', { clientX: 210, clientY: 200 });
westHandle.dispatch('pointerup',   { clientX: 210, clientY: 200 });
check(shell.getCanvasRect().left === 210 && shell.getCanvasRect().width === 450, '5: left edge adjusts left and width');
check(shell.getCanvasRect().left + shell.getCanvasRect().width === rightBeforeWest, '5: left edge keeps right edge anchored');

// Stage narrowing: shifts left to keep canvas inside stage without resizing if width still fits
shell.stage.clientWidth = 500;
const resizesBeforeNarrowShift = stageResizes;
shell.setRightOpen(false); // triggers onStageBoundsChanged
check(stageResizes === resizesBeforeNarrowShift, '5: shifting floating canvas inside narrower stage avoids resize when width fits');
check(shell.getCanvasRect().left === 50 && shell.getCanvasRect().width === 450, '5: floating canvas shifted to stay inside stage');

// Stage shrinking smaller than canvas width clamps width and fires onStageResize, then restores when stage grows
shell.stage.clientWidth = 360;
const resizesBeforeClamp = stageResizes;
shell.setRightOpen(true); // triggers onStageBoundsChanged
check(stageResizes === resizesBeforeClamp + 1, '5: clamping floating canvas width fires onStageResize');
check(shell.getCanvasRect().width === 360 && shell.getCanvasRect().left === 0, '5: floating canvas clamped to stage width');
shell.stage.clientWidth = 1000;
shell.setRightOpen(false);
check(shell.getCanvasRect().width === 450, '5: preferred floating canvas width restores when stage expands');

// Clicking floating canvas header Dock button docks canvas back and preserves saved rect
const canvasDockBtn = canvasHeader.children.find(c => c.className === 'studio-canvas-win__dock-btn');
const resizesBeforeRedock = stageResizes;
canvasDockBtn.click();
check(shell.isCanvasFloating() === false, '5: clicking canvas header Dock button docks canvas');
check(!shell.stage.classList.contains('studio-stage--floating'), '5: floating stage class removed');
check(stageResizes === resizesBeforeRedock + 1, '5: docking canvas fires onStageResize');
check(shell.getState().canvasRect?.width === 450 && shell.getState().canvasRect?.height === 300, '5: saved floating rect preserved while docked');

// Re-floating restores saved floating rect, and persists across reload
shell.toggleCanvasFloating();
check(shell.isCanvasFloating() === true, '5: toggleCanvasFloating re-enables floating mode');
check(shell.getCanvasRect().width === 450 && shell.getCanvasRect().height === 300, '5: re-floating restores saved dimensions');

const reloaded = createDockShell({ storagePrefix: 'symdraw_doc_folder_studio' });
check(reloaded.isCanvasFloating() === true, '5: persisted floating canvas mode survives reload');
check(reloaded.getState().canvasRect?.width === 450 && reloaded.getState().canvasRect?.height === 300,
      '5: persisted preferred floating rect survives reload');
check(reloaded.getCanvasRect().width === 320 && reloaded.getCanvasRect().height === 240,
      '5: rendered floating rect clamps cleanly to smaller initial stage');
reloaded.stage.clientWidth = 1000;
reloaded.stage.clientHeight = 700;
reloaded.setRightOpen(true);
check(reloaded.getCanvasRect().width === 450 && reloaded.getCanvasRect().height === 300,
      '5: rendered floating rect expands back to persisted size once stage lays out');

// Corrupted / tiny persisted canvasRect is safely ignored
storage.setItem('corrupt_canvas_studio_layout', JSON.stringify({
    canvasFloating: true,
    canvasRect: { left: 10, top: 10, width: 12, height: 8 },
}));
const safeShell = createDockShell({ storagePrefix: 'corrupt_canvas_studio' });
check(safeShell.isCanvasFloating() === true, '5: floating flag preserved when rect is corrupt');
check(safeShell.getCanvasRect().width >= 180 && safeShell.getCanvasRect().height >= 140, '5: corrupt tiny canvasRect rejected in favor of safe default');

// resetLayout restores docked mode and clears saved canvasRect
shell.resetLayout();
check(shell.isCanvasFloating() === false, '5: resetLayout restores docked canvas mode');
check(shell.getState().canvasRect === null, '5: resetLayout clears saved floating canvas rect');

console.log(`${checks - failed} of ${checks} checks passed`);
if (failed) process.exit(1);
