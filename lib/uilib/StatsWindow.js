/**
 * StatsWindow.js
 *
 * A small floating window (an internal window) that shows a few "name value"
 * lines and a table of numbers, meant to be refreshed often, e.g. on every
 * frame. Optional checkboxes and buttons go in a row at the top.
 *
 *   const win = createStatsWindow({
 *       title:     'timing',
 *       storageId: 'my_timing_window',      // keeps position, size and visibility
 *       options:   [ { label: 'continuous', title: 'a tooltip', checked: false, onChange: (on) => { ... } } ],
 *       buttons:   [ { label: 'benchmark', title: 'a tooltip', onClick: () => { ... } } ],
 *       onClose:   (visible) => { ... },     // every visibility change
 *   });
 *   win.show();
 *   win.update({
 *       lines:   [ ['canvas', '1920 x 1080'], ['fps', '60'] ],
 *       columns: ['', 'GPU ms', 'CPU ms'],
 *       rows:    [ ['layer 1', '1.23', '0.05'], ... ],
 *       footer:  [ 'total', '2.10', '0.12' ],    // optional, a row in bold
 *       note:    'a line of small text under the table',   // optional
 *   });
 *   win.isVisible(); win.hide();
 *
 * Numbers are right aligned; update() rebuilds the content only when it changed.
 */

import {
    createInternalWindow,
} from './modules.js';

const STYLE_ID = 'stats-window-style';

const CSS = `
.stats-window { padding: 4px 6px; font: 12px/1.35 ui-monospace, Consolas, monospace;
    color: var(--text-color, #111); background: var(--background-color, #f9f9f9);
    box-sizing: border-box; height: 100%; overflow: auto; }
.stats-window__options { display: flex; flex-wrap: wrap; gap: 2px 10px; margin-bottom: 4px;
    font-family: inherit; }
.stats-window__options label { display: inline-flex; align-items: center; gap: 3px; cursor: pointer; }
.stats-window__button { font: inherit; padding: 0 6px; cursor: pointer; }
.stats-window__lines, .stats-window__table { border-collapse: collapse; width: 100%; }
.stats-window__lines td { padding: 0 4px 0 0; }
.stats-window__lines td:first-child { color: var(--soft-text-color, #777); width: 1%; white-space: nowrap; }
.stats-window__table { margin-top: 4px; }
.stats-window__table th { font-weight: normal; color: var(--soft-text-color, #777); text-align: right;
    border-bottom: 1px solid var(--tile-border-color, rgba(27, 31, 36, 0.15)); padding: 0 0 0 8px; }
.stats-window__table td { text-align: right; padding: 0 0 0 8px; white-space: nowrap; }
.stats-window__table th:first-child, .stats-window__table td:first-child { text-align: left; padding-left: 0;
    overflow: hidden; text-overflow: ellipsis; max-width: 12em; }
.stats-window__table tr.stats-window__footer td { font-weight: bold;
    border-top: 1px solid var(--tile-border-color, rgba(27, 31, 36, 0.15)); }
.stats-window__note { margin-top: 4px; color: var(--soft-text-color, #777); font-size: 11px; }
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function createStatsWindow(opt = {}) {

    ensureStyle();

    const mWindow = createInternalWindow({
        title:     opt.title || 'stats',
        width:     opt.width || '300px',
        height:    opt.height || '260px',
        left:      opt.left || '10px',
        top:       opt.top || '60px',
        canClose:  true,
        canResize: true,
        storageId: opt.storageId,
        onClose:   (win, visible) => { if (opt.onClose) opt.onClose(visible); },
    });

    const root = document.createElement('div');
    root.className = 'stats-window';
    mWindow.interior.appendChild(root);

    if ((opt.options && opt.options.length) || (opt.buttons && opt.buttons.length)) {
        const row = document.createElement('div');
        row.className = 'stats-window__options';
        for (const b of (opt.buttons || [])) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'stats-window__button';
            button.textContent = b.label;
            if (b.title) button.title = b.title;
            button.addEventListener('click', () => { if (b.onClick) b.onClick(); });
            row.appendChild(button);
        }
        for (const o of (opt.options || [])) {
            const label = document.createElement('label');
            if (o.title) label.title = o.title;
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.checked = !!o.checked;
            box.addEventListener('change', () => { if (o.onChange) o.onChange(box.checked); });
            label.append(box, document.createTextNode(o.label));
            row.appendChild(label);
        }
        root.appendChild(row);
    }

    const content = document.createElement('div');
    root.appendChild(content);
    let mLastHtml = '';

    function update(data = {}) {
        let html = '';
        if (data.lines && data.lines.length) {
            html += '<table class="stats-window__lines">';
            for (const [k, v] of data.lines) html += `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`;
            html += '</table>';
        }
        if (data.rows) {
            html += '<table class="stats-window__table">';
            if (data.columns) html += '<tr>' + data.columns.map(c => `<th>${esc(c)}</th>`).join('') + '</tr>';
            for (const r of data.rows) html += '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>';
            if (data.footer) html += '<tr class="stats-window__footer">' + data.footer.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>';
            html += '</table>';
        }
        if (data.note) html += `<div class="stats-window__note">${esc(data.note)}</div>`;
        if (html !== mLastHtml) {
            content.innerHTML = html;
            mLastHtml = html;
        }
    }

    return {
        show:      () => mWindow.setVisible(true),
        hide:      () => mWindow.setVisible(false),
        isVisible: () => mWindow.isVisible(),
        update,
        window:    mWindow,
    };
}
