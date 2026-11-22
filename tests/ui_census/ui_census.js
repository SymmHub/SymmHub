//
//  The UI census of a SymRenderer page: what its UI shows, as text lines that
//  another version of the code can be compared with, line by line.
//  Phase 0 of docs/symrenderer_refactor_plan.md (the workspace's docs folder).
//
//  It lists:
//  - the windows (title, role, shown, closable; their places on a line of
//    their own, "rect", which a comparison may leave out);
//  - the toolbox's buttons (title, image, the "on" look);
//  - the tool palette's tools;
//  - the menus of the toolbox's menu buttons (windows, files, export);
//  - per tool, after taking it up: the canvas cursor, the tool bar's
//    controls, the bar's menus and popovers, the bar's help (hashed);
//  - the settings panels (every dat.GUI): folders and controllers.
//
//  Numbers inside labels are masked (#): the view's fields change with the
//  window. A hidden group of a tool bar (shown with a selection) is one line
//  with the count and a fingerprint of its contents; uiCensus({expand: true})
//  lists them. Order is kept everywhere but in the windows, which are sorted by
//  title (the order they are made in is not seen).
//
//  Use, in the browser pane (preview_start "symmhub"), one page at a time:
//  1. a page from clean storage: navigate to
//       /tests/ui_census/fresh.html?next=<the page's path>
//     It keeps the origin's localStorage in sessionStorage (once, so the
//     first kept state is the user's), clears it and opens the page.
//  2. after the page has loaded (~20 s):
//       const c = await import('/tests/ui_census/ui_census.js');
//       await c.waitStable();
//       const text = await c.uiCensus();
//     and keep `text` as tests/ui_census/baseline/<name>.txt, or compare:
//       await c.compareWithBaseline('<name>')  -> the differing lines
//     The baselines of 2026-11-21 were written through the catalog-save
//     server (launch config "catalog-save", port 8125, which serves this
//     repository too): `fetch('/save?path=<tmp folder>/<name>.txt',
//     {method: 'POST', body: text})` writes into the colorsym catalog
//     folder, from where the files were moved here. That server sends no
//     no-cache headers: import this module with a fresh `?v=` after an edit.
//  3. when done with all pages: navigate to
//       /tests/ui_census/fresh.html?restore=1
//     which puts the kept localStorage back.
//  Keep the viewport the same for every run (resize_window 1280 x 800).
//
//  Run it once per fresh load: taking up the tools changes the page
//  (symdraw's Tile tool adds a tile, the Symmetry tool opens its window), so
//  a second run in the same page differs from the first.
//

const KEPT = 'uiCensus.keptLocalStorage';

const pause = (ms) => new Promise(r => setTimeout(r, ms));

// a short, stable fingerprint of a string
function hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

const mask  = (s) => s.replace(/-?\d+(\.\d+)?(e-?\d+)?/g, '#');
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const quote = (s) => JSON.stringify(clean(s));
// a title, long ones cut with a fingerprint of the whole
const qtitle = (s) => { const t = clean(s); return t.length > 60 ? JSON.stringify(t.slice(0, 48) + '…') + '#' + hash(t) : JSON.stringify(t); };

function basename(url) {
    const s = String(url || '');
    if (s.startsWith('data:')) return 'data#' + hash(s);
    return s.split(/[?#]/)[0].split('/').pop();
}

function shown(el) {
    if (!el || !el.isConnected) return false;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
}

// what an element shows as its picture
function iconOf(el) {
    if (el.tagName === 'INPUT' && el.type === 'image') return basename(el.getAttribute('src'));
    const img = el.querySelector('img');
    if (img) return basename(img.getAttribute('src'));
    const svg = el.querySelector('svg');
    if (svg) return 'svg#' + hash(svg.outerHTML);
    const bg = el.style.backgroundImage;
    if (bg && bg !== 'none') return basename(bg.replace(/^url\(["']?|["']?\)$/g, ''));
    return '';
}

function titleOf(el) {
    return el.getAttribute('title') || el.getAttribute('aria-label') || '';
}

function flags(el) {
    const f = [];
    if (el.classList.contains('pressed')) f.push('pressed');
    if (el.getAttribute('aria-pressed') === 'true') f.push('pressed');
    if (el.getAttribute('aria-checked') === 'true') f.push('checked');
    if (el.classList.contains('tool-palette__button--active')) f.push('active');
    if (el.classList.contains('property-bar__button--on')) f.push('on');
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') f.push('disabled');
    if (el.getAttribute('aria-haspopup')) f.push('popup=' + el.getAttribute('aria-haspopup'));
    if (el.style && el.style.backgroundColor) f.push('bg=' + el.style.backgroundColor.replace(/\s+/g, ''));
    if (!shown(el)) f.push('hidden');
    return [...new Set(f)];
}

function line(indent, ...parts) {
    return '  '.repeat(indent) + parts.filter(p => p !== '' && p != null).join(' ');
}

//
//  windows
//
function allWindows() {
    return [...document.querySelectorAll('.drag-style')];
}

function windowLabel(win) {
    return win.getAttribute('aria-label') || win.querySelector('.header-style')?.textContent || '';
}

function censusWindows(out) {
    out.push('## windows');
    const wins = allWindows().map(w => ({ w, label: clean(windowLabel(w)) }))
                             .sort((a, b) => a.label.localeCompare(b.label));
    for (const { w, label } of wins) {
        const close = w.querySelector('.close-button-style');
        out.push(line(0, 'window', quote(label), w.getAttribute('role') || '',
                      shown(w) ? 'shown' : 'hidden', close && shown(close) ? 'closable' : ''));
        const r = w.getBoundingClientRect();
        out.push(line(1, 'rect', `${Math.round(r.left)},${Math.round(r.top)}`,
                      `${Math.round(r.width)}x${Math.round(r.height)}`));
    }
}

//
//  the toolbox
//
function toolboxWindow() {
    return allWindows().find(w => clean(windowLabel(w)) === 'toolbox') || null;
}

// the toolbox window's buttons; without that window (the simple UI) the
// image buttons outside every window
function toolboxButtons() {
    const win = toolboxWindow();
    if (win) return [...win.querySelectorAll('input.imgbutton, button')];
    return [...document.querySelectorAll('input.imgbutton')].filter(b => !b.closest('.drag-style'));
}

function censusToolbox(out) {
    out.push('## toolbox');
    const buttons = toolboxButtons();
    if (!buttons.length) { out.push('none'); return; }
    for (const b of buttons) {
        if (b.classList.contains('vbar-separator')) { out.push('separator'); continue; }
        out.push(line(0, 'button', qtitle(titleOf(b)), iconOf(b), ...flags(b)));
    }
}

//
//  the tool palette
//
function paletteButtons() {
    return [...document.querySelectorAll('.tool-palette__button')];
}

function censusPalette(out) {
    out.push('## palette');
    const palette = document.querySelector('.tool-palette');
    if (!palette) { out.push('none'); return; }
    const walk = (el, indent) => {
        for (const c of el.children) {
            if (c.classList.contains('tool-palette__button')) {
                out.push(line(indent, 'tool', qtitle(titleOf(c)), iconOf(c), ...flags(c)));
            } else if (c.classList.contains('tool-palette__rule')) {
                out.push(line(indent, 'rule'));
            } else if (c.classList.contains('tool-palette__group')) {
                out.push(line(indent, 'group'));
                walk(c, indent + 1);
            } else if (c.classList.contains('tool-palette__bottom')) {
                out.push(line(indent, 'bottom'));
                walk(c, indent + 1);
            } else if (c.children.length) {
                walk(c, indent);
            }
        }
    };
    walk(palette, 0);
}

//
//  popup menus
//
function openPopup() {
    const all = [...document.querySelectorAll('.gui-popup')];
    return all.length ? all[all.length - 1] : null;
}

function censusPopup(menu, out, indent) {
    for (const el of menu.querySelectorAll('.gui-popup__title, .gui-popup__separator, .gui-popup__item')) {
        if (el.classList.contains('gui-popup__title')) {
            out.push(line(indent, 'title', quote(el.textContent)));
        } else if (el.classList.contains('gui-popup__separator')) {
            out.push(line(indent, 'separator'));
        } else {
            const label = el.querySelector('.gui-popup__label')?.textContent ?? el.textContent;
            const hint = el.querySelector('.gui-popup__hint')?.textContent;
            const f = [];
            if (el.getAttribute('aria-checked') === 'true') f.push('checked');
            if (el.getAttribute('aria-disabled') === 'true') f.push('disabled');
            if (el.getAttribute('aria-haspopup')) f.push('submenu');
            out.push(line(indent, 'item', quote(mask(label)), hint ? 'hint=' + quote(hint) : '', ...f));
        }
    }
}

function pressOutside() {
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, isPrimary: true }));
}

// clicks a button that opens a menu or a popover, lists what opened, closes it
async function censusOpener(btn, out, indent) {
    const before = new Set(document.querySelectorAll('.gui-popup, .property-bar__popover'));
    btn.click();
    await pause(30);
    const opened = [...document.querySelectorAll('.gui-popup, .property-bar__popover')]
        .filter(el => !before.has(el));
    if (!opened.length) { out.push(line(indent, '(nothing opened)')); return; }
    for (const el of opened) {
        if (el.classList.contains('gui-popup')) censusPopup(el, out, indent);
        else censusBarRow(el, out, indent);
    }
    pressOutside();
    await pause(30);
    if (opened.some(el => el.isConnected && shown(el))) {
        btn.click();                       // a popover that toggles on its anchor
        await pause(30);
    }
}

// the toolbox buttons that open menus; the others run commands and are not pressed
const MENU_BUTTON = /^(windows|files|export:)/;

async function censusMenus(out) {
    out.push('## menus');
    for (const b of toolboxButtons()) {
        const title = titleOf(b);
        if (!MENU_BUTTON.test(title)) continue;
        out.push(line(0, 'menu', qtitle(title)));
        await censusOpener(b, out, 1);
    }
}

//
//  the tool bar
//
function propertyBar() {
    return [...document.querySelectorAll('.property-bar')]
        .find(el => !el.classList.contains('property-bar__popover')) || null;
}

const BAR_PREFIX = 'property-bar__';

function barKind(el) {
    const c = [...el.classList].find(k => k.startsWith(BAR_PREFIX) && !k.includes('--'));
    if (c) return c.slice(BAR_PREFIX.length);
    return el.tagName.toLowerCase();
}

// the controls of a bar's row (or of a popover), in order; wrappers with no
// class of the bar's are left out (their contents are listed), and so are a
// number field's step arrows
const STEP_ARROW = /^step (up|down)$/;
let expandHidden = false;

function censusBarRow(row, out, indent) {
    for (const el of row.children) {
        const kind = barKind(el);
        if (kind === 'hint' || kind === 'row') continue;
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
            out.push(line(indent, 'input', el.type || el.tagName.toLowerCase(), qtitle(titleOf(el)), ...flags(el)));
            continue;
        }
        if (['label', 'text'].includes(kind)) {
            out.push(line(indent, kind, quote(mask(el.textContent)), el.title ? 'title=' + qtitle(el.title) : ''));
            continue;
        }
        if (['sep', 'spacer', 'break'].includes(kind)) {
            out.push(line(indent, kind));
            continue;
        }
        if (el.tagName === 'BUTTON' || kind === 'button') {
            if (STEP_ARROW.test(titleOf(el))) continue;
            out.push(line(indent, 'button', qtitle(titleOf(el) || mask(el.textContent)), iconOf(el), ...flags(el)));
            continue;
        }
        if (!el.className.toString().includes(BAR_PREFIX) && !titleOf(el)) {
            if (el.children.length) censusBarRow(el, out, indent);
            else if (clean(el.textContent)) out.push(line(indent, 'text', quote(mask(el.textContent))));
            continue;
        }
        // a hidden group: one line, its contents counted and fingerprinted
        if (!shown(el) && !expandHidden) {
            const inner = [];
            censusBarRow(el, inner, 0);
            out.push(line(indent, kind, qtitle(titleOf(el)), ...flags(el),
                          `(${inner.length} inside #${hash(inner.join('|'))})`));
            continue;
        }
        out.push(line(indent, kind, qtitle(titleOf(el)), ...flags(el)));
        censusBarRow(el, out, indent + 1);
    }
}

async function censusBar(out, indent) {
    const bar = propertyBar();
    if (!bar) { out.push(line(indent, 'bar: none')); return; }
    const row = bar.querySelector('.property-bar__row') || bar;
    out.push(line(indent, 'bar'));
    censusBarRow(row, out, indent + 1);
    const hint = bar.querySelector('.property-bar__hint');
    if (hint) {
        const text = clean(hint.textContent);
        out.push(line(indent + 1, 'hint', text ? `#${hash(text)} ${quote(text.slice(0, 60))}` : '(empty)',
                      shown(hint) ? '' : 'hidden'));
    }
    // the bar's menus and popovers
    for (const b of row.querySelectorAll('[aria-haspopup]')) {
        if (!shown(b)) continue;
        out.push(line(indent + 1, 'opens', qtitle(titleOf(b) || mask(b.textContent))));
        await censusOpener(b, out, indent + 2);
    }
}

//
//  the tools: each taken up in turn
//
function overlayCanvas() {
    const all = document.querySelectorAll('canvas.layeredCanvas');
    return all.length ? all[all.length - 1] : null;
}

function cursorNow() {
    const c = overlayCanvas();
    if (!c) return '(no canvas)';
    const cur = c.style.cursor || getComputedStyle(c).cursor;
    return cur.replace(/url\(["']?([^"')]+)["']?\)/g, (m, u) => basename(u));
}

// the classic toolbox's tool buttons: those after its separator
function classicToolButtons() {
    const buttons = toolboxButtons();
    const i = buttons.findIndex(b => b.classList.contains('vbar-separator'));
    return i < 0 ? [] : buttons.slice(i + 1);
}

function looksOn(b) {
    return b.classList.contains('pressed') || /^rgba?\(80,\s*80,\s*80/.test(b.style.backgroundColor);
}

async function censusTools(out) {
    out.push('## tools');
    const palette = paletteButtons();
    const classic = classicToolButtons();
    const buttons = palette.length ? palette : classic;
    if (!buttons.length) { out.push('none'); return; }
    const first = palette.length
        ? palette.find(b => b.getAttribute('aria-checked') === 'true')
        : classic.find(looksOn);
    for (const b of buttons) {
        b.click();
        await pause(60);
        out.push(line(0, 'tool', qtitle(titleOf(b))));
        out.push(line(1, 'cursor', cursorNow()));
        if (!palette.length) {
            out.push(line(1, 'on', ...classic.filter(looksOn).map(x => qtitle(titleOf(x)))));
        }
        await censusBar(out, 1);
    }
    if (first) { first.click(); await pause(60); }
}

//
//  the settings panels
//
function censusGuiList(ul, out, indent) {
    for (const li of ul.children) {
        if (li.tagName !== 'LI') continue;
        if (li.classList.contains('title')) continue;
        if (li.classList.contains('folder')) {
            const inner = li.querySelector(':scope > .dg > ul, :scope > div > ul');
            const title = inner?.querySelector(':scope > li.title')?.textContent;
            out.push(line(indent, 'folder', quote(title), shown(li) ? '' : 'hidden'));
            if (inner) censusGuiList(inner, out, indent + 1);
            continue;
        }
        const kinds = [...li.classList].filter(k => k !== 'cr');
        const name = li.querySelector('.property-name')?.textContent ?? li.textContent.slice(0, 40);
        out.push(line(indent, li.classList.contains('cr') ? 'cr' : 'li', kinds.join('.') || '-',
                      quote(mask(name)), shown(li) ? '' : 'hidden'));
    }
}

function censusGui(out) {
    out.push('## settings');
    const roots = [...document.querySelectorAll('.dg.main')];
    if (!roots.length) { out.push('none'); return; }
    const items = roots.map(root => ({ root, where: clean(windowLabel(root.closest('.drag-style') || document.body)) || 'page' }))
                       .sort((a, b) => a.where.localeCompare(b.where));
    for (const { root, where } of items) {
        out.push(line(0, 'gui in', quote(where), shown(root) ? 'shown' : 'hidden'));
        const ul = root.querySelector(':scope > ul');
        if (ul) censusGuiList(ul, out, 1);
    }
}

//
//  the census
//

// waits until the page stops adding elements (the same count for `quiet` ms)
export async function waitStable({ quiet = 3000, step = 500, limit = 40000 } = {}) {
    const t0 = performance.now();
    let last = -1, since = performance.now();
    while (performance.now() - t0 < limit) {
        const n = document.getElementsByTagName('*').length;
        if (n !== last) { last = n; since = performance.now(); }
        else if (performance.now() - since >= quiet) return true;
        await pause(step);
    }
    return false;
}

export async function uiCensus({ tools = true, menus = true, settings = true, expand = false } = {}) {
    expandHidden = expand;              // list the contents of the bar's hidden groups too
    const out = [];
    out.push(`# ui census ${location.pathname} viewport ${innerWidth}x${innerHeight}`);
    censusWindows(out);
    censusToolbox(out);
    censusPalette(out);
    if (menus) await censusMenus(out);
    if (tools) await censusTools(out);
    if (settings) censusGui(out);
    return out.join('\n') + '\n';
}

// the lines of two texts that differ: '- ' only in a, '+ ' only in b
export function diffLines(a, b, { ignore = [] } = {}) {
    const keep = (l) => !ignore.some(re => re.test(l));
    const A = a.split('\n').filter(keep), B = b.split('\n').filter(keep);
    const n = A.length, m = B.length;
    const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
        for (let j = m - 1; j >= 0; j--)
            L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = [];
    let i = 0, j = 0;
    while (i < n || j < m) {
        if (i < n && j < m && A[i] === B[j]) { i++; j++; }
        else if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) out.push('+ ' + B[j++]);
        else out.push('- ' + A[i++]);
    }
    return out;
}

// the census of this page against tests/ui_census/baseline/<name>.txt
export async function compareWithBaseline(name, { ignoreRects = false, text = null } = {}) {
    const url = new URL(`./baseline/${name}.txt`, import.meta.url);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`no baseline ${url.pathname}`);
    const now = text ?? await uiCensus();
    return diffLines(await res.text(), now, { ignore: ignoreRects ? [/^\s*rect /] : [] });
}

export { KEPT };
