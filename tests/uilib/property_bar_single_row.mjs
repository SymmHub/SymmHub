/*
  Unit tests for lib/uilib/PropertyBar.js singleRow mode, separator cleanup,
  compact picture buttons, and automatic overflow tray:
    node tests/uilib/property_bar_single_row.mjs
*/

function makeClassList(el) {
    const set = new Set();
    const syncToClassName = () => { el._className = [...set].join(' '); };
    return {
        _syncFrom(str) {
            set.clear();
            for (const tok of String(str || '').split(/\s+/).filter(Boolean)) set.add(tok);
        },
        add: (...names) => { names.forEach(n => set.add(n)); syncToClassName(); },
        remove: (...names) => { names.forEach(n => set.delete(n)); syncToClassName(); },
        toggle: (n, force) => {
            if (force === undefined) {
                if (set.has(n)) { set.delete(n); syncToClassName(); return false; }
                set.add(n); syncToClassName(); return true;
            }
            if (force) set.add(n); else set.delete(n);
            syncToClassName();
            return !!force;
        },
        contains: (n) => set.has(n),
    };
}

function makeElement(tag = 'div') {
    const children = [];
    const attrs = new Map();
    const listeners = new Map();
    const style = {};
    const el = {
        tagName: tag.toUpperCase(),
        children,
        parentElement: null,
        style,
        _className: '',
        textContent: '',
        title: '',
        value: '',
        disabled: false,
        offsetWidth: 0,
        offsetHeight: 28,
        clientWidth: 0,
        clientHeight: 28,
        get className() { return this._className; },
        set className(v) {
            this._className = String(v || '');
            this.classList._syncFrom(this._className);
        },
        setAttribute(k, v) { attrs.set(k, String(v)); },
        getAttribute(k) { return attrs.get(k) ?? null; },
        removeAttribute(k) { attrs.delete(k); },
        contains(target) {
            let cur = target;
            while (cur) {
                if (cur === el) return true;
                cur = cur.parentElement;
            }
            return false;
        },
        closest() { return null; },
        appendChild(child) {
            if (child.parentElement) {
                const idx = child.parentElement.children.indexOf(child);
                if (idx >= 0) child.parentElement.children.splice(idx, 1);
            }
            children.push(child);
            child.parentElement = el;
            return child;
        },
        remove() {
            if (!el.parentElement) return;
            const idx = el.parentElement.children.indexOf(el);
            if (idx >= 0) el.parentElement.children.splice(idx, 1);
            el.parentElement = null;
        },
        replaceChildren(...nodes) {
            for (const c of children) c.parentElement = null;
            children.length = 0;
            nodes.forEach(n => el.appendChild(n));
        },
        insertAdjacentHTML(_pos, html) {
            const span = makeElement('svg');
            span.textContent = html;
            el.appendChild(span);
        },
        querySelectorAll(sel) {
            const out = [];
            const walk = (node) => {
                for (const ch of node.children) {
                    if (sel === 'button' && ch.tagName === 'BUTTON') out.push(ch);
                    walk(ch);
                }
            };
            walk(el);
            return out;
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
            for (const fn of (listeners.get('click') || [])) fn({ preventDefault() {}, stopPropagation() {} });
        },
        // Return width 0 so PropertyBar falls back to offsetWidth accumulation in headless tests
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 32, width: 0, height: 28 }),
    };
    el.classList = makeClassList(el);
    return el;
}

const head = makeElement('head');
const body = makeElement('body');
const docListeners = new Map();
const winListeners = new Map();
const resizeObservers = [];

function addMapListener(map, type, fn) {
    if (!map.has(type)) map.set(type, []);
    map.get(type).push(fn);
}
function removeMapListener(map, type, fn) {
    const arr = map.get(type);
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
}
function fireMapEvent(map, type, ev) {
    for (const fn of [...(map.get(type) || [])]) fn(ev);
}

globalThis.innerWidth = 1280;
globalThis.innerHeight = 800;
globalThis.document = {
    head,
    body,
    documentElement: { dataset: {} },
    activeElement: body,
    createElement: (tag) => makeElement(tag),
    createTextNode: (t) => ({ nodeValue: String(t), parentElement: null }),
    getElementsByTagName: (tag) => (tag === 'head' ? [head] : tag === 'body' ? [body] : []),
    getElementById: () => null,
    querySelector: () => null,
    addEventListener: (t, fn) => addMapListener(docListeners, t, fn),
    removeEventListener: (t, fn) => removeMapListener(docListeners, t, fn),
};
globalThis.window = {
    localStorage: { getItem: () => null, setItem() {} },
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: (t, fn) => addMapListener(winListeners, t, fn),
    removeEventListener: (t, fn) => removeMapListener(winListeners, t, fn),
};
globalThis.ResizeObserver = class {
    constructor(cb) {
        this._cb = cb;
        this._targets = [];
        resizeObservers.push(this);
    }
    observe(target) { this._targets.push(target); }
    disconnect() { this._targets.length = 0; }
    trigger() { this._cb([]); }
};

const { createPropertyBar } = await import('../../lib/uilib/PropertyBar.js');

let failed = 0, checks = 0;
function check(ok, msg) {
    checks++;
    if (!ok) { failed++; console.log('FAILED:', msg); }
}

// ── 1. Default multi-row mode preserves break & imageSize ────────────────────
const multiHost = makeElement('div');
const multiBar = createPropertyBar({ container: multiHost, hint: false });
multiBar.setControls([
    { kind: 'button', text: 'A', action: () => {} },
    { kind: 'break' },
    { kind: 'button', text: 'Pic', image: () => 'data:image/png;base64,AAA', imageSize: [128, 128], action: () => {} },
]);
const multiRow = multiBar.container.children[0];
check(!multiBar.container.classList.contains('property-bar--single-row'), '1: default mode lacks single-row class');
check(multiBar.overflowBtn === null && multiBar.overflowTray === null, '1: default mode has no overflow UI');
check(multiRow.children[1].classList.contains('property-bar__break'), '1: default mode break keeps property-bar__break');
const multiPicBtn = multiRow.children[2];
const multiPicImg = multiPicBtn.children.find(c => c.tagName === 'IMG');
check(multiPicBtn.style.height === 'auto', '1: default mode applies height:auto for imageSize');
check(multiPicImg.style.width === '128px' && multiPicImg.style.height === '128px', '1: default mode applies 128x128 inline imageSize');

// ── 2. Single-row mode converts break -> sep & keeps picture compact ─────────
const host = makeElement('div');
const bar = createPropertyBar({ container: host, hint: false, singleRow: true });
bar.container.clientWidth = 800;

let showMiddle = false;
let showTail = true;
bar.setControls([
    { kind: 'break' }, // leading break -> must be hidden
    { kind: 'button', text: 'A', action: () => {} },
    { kind: 'break' },
    { kind: 'group', title: 'mid', visible: () => showMiddle, controls: [
        { kind: 'button', text: 'M', action: () => {} },
    ] },
    { kind: 'break' },
    { kind: 'button', text: 'Pic', visible: () => showTail, image: () => 'data:image/png;base64,BBB', imageSize: [128, 128], action: () => {} },
    { kind: 'separator' }, // trailing sep -> must be hidden
]);

const row = bar.container.children[0];
check(bar.container.classList.contains('property-bar--single-row'), '2: singleRow adds property-bar--single-row class');
check(row.children[0].classList.contains('property-bar__sep') && row.children[0].classList.contains('property-bar__sep--from-break'),
      '2: break becomes vertical separator in singleRow mode');
check(!row.children[0].classList.contains('property-bar__break'), '2: break does not get property-bar__break in singleRow');

const singlePicBtn = row.children[5];
const singlePicImg = singlePicBtn.children.find(c => c.tagName === 'IMG');
check(!singlePicBtn.style.height, '2: singleRow does not apply inline height:auto on imageSize button');
check(!singlePicImg.style.width && !singlePicImg.style.height, '2: singleRow omits inline 128x128 size on picture img');

// ── 3. Separator cleanup (leading, consecutive, trailing, dynamic restore) ───
check(row.children[0].classList.contains('property-bar__sep--hidden'), '3: leading break separator hidden');
check(!row.children[2].classList.contains('property-bar__sep--hidden'), '3: first separator between A and Pic visible');
check(row.children[4].classList.contains('property-bar__sep--hidden'), '3: consecutive separator hidden when middle group hidden');
check(row.children[6].classList.contains('property-bar__sep--hidden'), '3: trailing separator hidden');

showMiddle = true;
bar.refresh();
check(!row.children[2].classList.contains('property-bar__sep--hidden') && !row.children[4].classList.contains('property-bar__sep--hidden'),
      '3: both separators visible once middle group becomes visible');

showTail = false;
bar.refresh();
check(row.children[4].classList.contains('property-bar__sep--hidden'), '3: separator before hidden tail becomes hidden');
showTail = true;
bar.refresh();

// ── 4. Overflow detection, tray open/Escape close, focus guard, width restore ─
bar.setControls([
    { kind: 'group', title: 'g1', controls: [{ kind: 'button', text: 'G1', action: () => {} }] },
    { kind: 'break' },
    { kind: 'group', title: 'g2', controls: [{ kind: 'button', text: 'G2', action: () => {} }] },
    { kind: 'break' },
    { kind: 'group', title: 'g3', controls: [{ kind: 'button', text: 'G3', action: () => {} }] },
]);

const [g1, sep1, g2, sep2, g3] = row.children;
g1.offsetWidth = 200;
sep1.offsetWidth = 1;
g2.offsetWidth = 200;
sep2.offsetWidth = 1;
g3.offsetWidth = 200;
bar.overflowBtn.offsetWidth = 64;

// Fits cleanly at 700px (200 + 6 + 9 + 6 + 200 + 6 + 9 + 6 + 200 = 642px <= 700px)
bar.container.clientWidth = 700;
bar.layoutOverflow();
check(row.children.length === 5 && bar.overflowTray.children.length === 0, '4: all controls stay in row when width suffices');
check(bar.overflowBtn.style.display === 'none', '4: overflowBtn hidden when all controls fit');

// Narrow to 520px via ResizeObserver -> budget = 520 - 64 - 4 = 452px -> g1 + sep1 + g2 (421px) fit; sep2 + g3 move to tray
bar.container.clientWidth = 520;
const barRO = resizeObservers.find(o => o._targets.includes(bar.container));
check(!!barRO, '4: ResizeObserver attached to single-row content');
barRO.trigger();
check(bar.overflowBtn.style.display === '', '4: overflowBtn shown when trailing group overflows');
check(row.children.includes(g1) && row.children.includes(g2), '4: fitting groups stay in row');
check(bar.overflowTray.children.includes(g3), '4: overflowing group g3 moved intact into overflowTray');
check(!sep1.classList.contains('property-bar__sep--hidden'), '4: separator between g1 and g2 remains visible');
check(sep2.classList.contains('property-bar__sep--hidden'), '4: leading separator inside overflowTray hidden');

// Open tray -> appended to document.body; focus guard preserves tray during refresh
bar.overflowBtn.click();
check(bar.overflowTray.parentElement === body, '4: clicking More mounts overflowTray on document.body');
check(bar.overflowBtn.getAttribute('aria-expanded') === 'true', '4: overflowBtn aria-expanded true when open');

globalThis.document.activeElement = g3.children[0];
bar.container.clientWidth = 900; // wider, but focus is inside open tray
bar.refresh();
check(bar.overflowTray.children.includes(g3), '4: refresh does not yank focused control out of open overflowTray');

// Escape closes overflowTray
globalThis.document.activeElement = body;
fireMapEvent(winListeners, 'keydown', { key: 'Escape', preventDefault() {}, stopPropagation() {} });
check(bar.overflowTray.parentElement === null, '4: Escape detaches overflowTray');
check(bar.overflowBtn.getAttribute('aria-expanded') === 'false', '4: aria-expanded false after close');

// Widening via ResizeObserver restores all items to row in original order
bar.container.clientWidth = 900;
barRO.trigger();
check(row.children.length === 5 && bar.overflowTray.children.length === 0, '4: widening restores all items to row');
check(row.children[0] === g1 && row.children[2] === g2 && row.children[4] === g3, '4: restored items keep original order');
check(bar.overflowBtn.style.display === 'none', '4: overflowBtn hidden again after restore');

console.log(`${checks - failed} of ${checks} checks passed`);
if (failed) process.exit(1);
