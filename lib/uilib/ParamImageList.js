/**
 * ParamImageList.js
 *
 * A dat.gui row for a colour layer's images list (ImageList.js): one chip per
 * entry, each with the swatches of the cosets it is seen in and the names it
 * shows; a click on a chip opens a menu of the names the pattern has, as check
 * items. The value stays the list's text, so what is saved does not change.
 *
 *   ParamImageList({
 *       obj, key, name: 'images', onChange,   // as ParamString: obj[key] is the text
 *       names: false,          // true: one entry of names with spaces between them
 *                              // (an Image layer's imageId), no cosets and no swatches
 *       getCosets: () => [{ color: '#rrggbb', shown: true }],   // per coset its colour,
 *                              // shown false when it is masked out; their number is
 *                              // the number of cosets
 *       getTree: () => [{ id, kind, children }] | null,          // the names the pattern
 *                              // has, bottom first as drawn (the menu shows the top
 *                              // first); null: the pattern has none, the row is a text field
 *       getSelectedIds: () => ['p3', ...],     // what is selected in the pattern
 *       tooltip: 'what the row is',
 *   })
 *
 * The chips: entry j is seen in coset j, the last entry also in the cosets after
 * it, an entry past the cosets in none (its chip faded); an empty list is one
 * chip "everything". A name the pattern does not have is red: it shows nothing.
 * A chip's menu: Nothing, Everything (the list emptied), the selection, the
 * names (toggled, the menu stays open), names of the entry the pattern does not
 * have, Remove this entry, Same as the next. A + after the chips adds an entry
 * (the last one again), the pencil shows the list as text to type.
 *
 * The owner calls updateDisplay() when the colours or the pattern's names
 * change; setValue() changes the text, updates the row and calls onChange.
 */

import {
    showPopupMenu,
    parseImageList,
    formatImageList,
    imageListEntryCosets,
    setImageListEntry,
    toggleImageListName,
    addImageListEntry,
    removeImageListEntry,
    copyNextImageListEntry,
} from './modules.js';

const STYLE_ID = 'param-image-list-style';

const CSS = `
/* dat.gui collapses a closed folder with height:0 on its rows, an inline
   height would block that rule (as .param-color-strip-row) */
.dg ul:not(.closed) > li.param-image-list-row--chips { height: auto; }
.dg li.param-image-list-row > div { display: flex; align-items: flex-start; }
.dg li.param-image-list-row .property-name { float: none; flex: 0 0 40%; }
/* with chips the label is as wide as its word: the chips get the rest of the row */
.dg li.param-image-list-row--chips .property-name { flex: 0 0 auto; width: auto; min-width: 3em; padding-right: 6px; }
.dg li.param-image-list-row .c { float: none; flex: 1 1 0; width: auto; min-width: 0; line-height: normal; }
.param-image-list-chips {
    display: flex; flex-wrap: wrap; align-items: center; gap: 3px; padding: 4px 0;
}
.param-image-chip, .param-image-list-button {
    height: 19px; box-sizing: border-box; margin: 0;
    font: inherit; font-size: 11px; line-height: 17px;
    color: var(--ui-button-color, #606060);
    background: var(--ui-button-background-color, #fff);
    border: 1px solid var(--ui-button-border-color, rgba(0, 0, 0, 0.4));
    cursor: pointer;
}
.param-image-chip {
    display: inline-flex; align-items: center; gap: 4px; max-width: 100%;
    padding: 0 6px 0 4px; border-radius: 9px; color: var(--text-color, #222);
}
.param-image-list-button {
    width: 19px; padding: 0; border-radius: 3px;
    display: inline-flex; align-items: center; justify-content: center;
}
.param-image-list-button svg { width: 12px; height: 12px; display: block; }
.param-image-chip:hover, .param-image-chip[aria-expanded="true"],
.param-image-list-button:hover, .param-image-list-button[aria-pressed="true"] {
    color: var(--ui-button-hover-color, #000);
    background: var(--hover-background-color, #f0f0f0);
}
.param-image-chip:disabled, .param-image-list-button:disabled { opacity: 0.4; cursor: default; }
.param-image-chip__swatches { display: inline-flex; gap: 1px; flex: 0 0 auto; }
.param-image-chip__swatch {
    width: 9px; height: 9px; box-sizing: border-box;
    border: 1px solid rgba(0, 0, 0, 0.35); border-radius: 2px;
}
.param-image-chip__swatch--hidden { opacity: 0.25; }
.param-image-chip__more { font-size: 9px; color: var(--ui-hint-color, #888); }
.param-image-chip__names { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.param-image-chip__unknown { color: var(--ui-error-color, #d03030); }
.param-image-chip--unseen { opacity: 0.5; border-style: dashed; }
.param-image-chip--all .param-image-chip__names { font-style: italic; }
.dg li.param-image-list-row--chips .c input.param-image-list-text { width: 100%; box-sizing: border-box; margin: 0 0 4px 0; }
`;

// a plus: one more entry
const ADD_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

// a pencil: the list as text
const TEXT_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/></svg>';

// swatches a chip shows, then "…"
const MAX_SWATCHES = 4;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

/** the names of a tree, every node's id */
function treeNames(tree) {
    const out = new Set();
    const walk = (nodes) => { for (const n of nodes || []) { out.add(n.id); walk(n.children); } };
    walk(tree);
    return out;
}

/** "coset 2", "cosets 2 to 5", "cosets 2 and 3" */
function cosetsText(cosets) {
    if (cosets.length === 1) return `coset ${cosets[0]}`;
    if (cosets.length === 2) return `cosets ${cosets[0]} and ${cosets[1]}`;
    return `cosets ${cosets[0]} to ${cosets[cosets.length - 1]}`;
}

/**
 * @param {object}   arg
 * @param {object}   arg.obj
 * @param {string}   arg.key
 * @param {string}   [arg.name]
 * @param {function} [arg.onChange]
 * @param {boolean}  [arg.names]          one entry of names with spaces between them
 * @param {function} [arg.getCosets]      () => [{color, shown}]
 * @param {function} [arg.getTree]        () => [{id, kind, children}] | null
 * @param {function} [arg.getSelectedIds] () => [ids]
 * @param {string}   [arg.tooltip]
 */
export function ParamImageList(arg) {

    const obj = arg.obj;
    const key = arg.key;
    const namesMode = !!arg.names;
    const getCosets = arg.getCosets || (() => []);
    const getTree = arg.getTree || (() => null);
    const getSelectedIds = arg.getSelectedIds || (() => []);
    const initial = obj[key];

    let mRow = null;      // the li
    let mChips = null;    // the chips' box
    let mAdd = null;      // + (cosets only)
    let mTextButton = null;
    let mText = null;     // the input of the list as text
    let mTextOn = false;  // the text shown under the chips
    const mChipEls = [];  // the chips, made once and kept (an open menu stays under its chip)

    // ── the value ────────────────────────────────────────────────────────────

    const text = () => obj[key] || '';

    // the entries: arrays of names; in names mode the one entry of the names ([] for everything)
    function entries() {
        if (!namesMode) return parseImageList(text());
        return [text().trim().split(/\s+/).filter(Boolean)];
    }

    function setValue(value) {
        obj[key] = value;
        updateDisplay();
        if (arg.onChange) arg.onChange();
    }

    function commit(value) {
        if (value !== text()) setValue(value);
    }

    // the edits of entry j
    function setEntry(j, names) {
        if (namesMode) commit([...new Set(names)].join(' '));
        else commit(setImageListEntry(text(), j, names));
    }
    function toggleName(j, name) {
        if (namesMode) {
            const now = entries()[0];
            setEntry(0, now.includes(name) ? now.filter(n => n !== name) : [...now, name]);
        } else {
            commit(toggleImageListName(text(), j, name));
        }
    }

    // ── the menu of a chip ───────────────────────────────────────────────────

    function menuItems(j) {
        const list = entries();
        const empty = namesMode ? list[0].length === 0 : list.length === 0;
        const entry = empty ? [] : list[j] || [];
        const tree = getTree() || [];
        const known = treeNames(tree);
        const selected = getSelectedIds() || [];
        const items = [];

        if (!namesMode) {
            items.push({ label: 'Nothing', hint: '-', checked: !empty && entry.length === 0, keepOpen: true,
                         title: empty ? 'every coset shows nothing' : 'this entry shows nothing',
                         action: () => setEntry(empty ? 0 : j, []) });
        }
        items.push({ label: 'Everything', hint: namesMode ? 'all of it' : 'every coset', checked: empty,
                     title: namesMode ? 'the whole pattern: no names' : 'everything in every coset: the list emptied',
                     action: () => commit('') });
        const shown = selected.slice(0, 3).join(', ') + (selected.length > 3 ? ', ...' : '');
        items.push({ label: 'The selection', hint: selected.length ? String(selected.length) : '', keepOpen: true,
                     disabled: selected.length === 0,
                     title: selected.length ? `shows what is selected now: ${shown}` : 'nothing is selected',
                     action: () => setEntry(empty ? 0 : j, selected) });

        // the names, the top first at every level, as the layers window shows them
        if (tree.length) items.push({ separator: true });
        const walk = (nodes, depth) => {
            for (const n of [...nodes].reverse()) {
                items.push({ label: n.id, hint: n.kind || '', indent: depth, checked: entry.includes(n.id),
                             keepOpen: true, action: () => toggleName(empty ? 0 : j, n.id) });
                if (n.children && n.children.length) walk(n.children, depth + 1);
            }
        };
        walk(tree, 0);
        // names of the entry the pattern does not have
        const unknown = entry.filter(n => !known.has(n));
        if (unknown.length) {
            items.push({ separator: true });
            for (const n of unknown) {
                items.push({ label: n, hint: 'not there', alert: true, checked: true, keepOpen: true,
                             title: `the pattern has nothing named "${n}": it shows nothing; click to take it out`,
                             action: () => toggleName(j, n) });
            }
        }

        if (!namesMode && !empty) {
            items.push({ separator: true });
            items.push({ label: 'Remove this entry',
                         title: list.length > 1 ? 'the cosets after it show what the entries after it name'
                                                : 'the list emptied: everything in every coset',
                         action: () => commit(removeImageListEntry(text(), j)) });
            items.push({ label: 'Same as the next', disabled: j + 1 >= list.length,
                         title: j + 1 >= list.length ? 'the last entry: there is no next one' : 'this entry names what the next one names',
                         action: () => commit(copyNextImageListEntry(text(), j)) });
        }
        return items;
    }

    // ── the row ──────────────────────────────────────────────────────────────

    function makeChip(j) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'param-image-chip';
        chip.setAttribute('aria-haspopup', 'menu');
        chip.setAttribute('aria-expanded', 'false');
        chip.addEventListener('click', () => {
            const cosets = imageListEntryCosets(entries(), getCosets().length)[j] || [];
            const title = namesMode ? 'what the layer shows' : (text() ? (cosets.length ? cosetsText(cosets) : `entry ${j}: no coset`) : 'every coset');
            showPopupMenu({ anchor: chip, title, items: () => menuItems(j) });
        });
        return chip;
    }

    function fillChip(chip, j, entry, cosets, colors, known, everything) {
        const swatches = document.createElement('span');
        swatches.className = 'param-image-chip__swatches';
        if (!namesMode) {
            for (const k of cosets.slice(0, MAX_SWATCHES)) {
                const sw = document.createElement('i');
                sw.className = 'param-image-chip__swatch' + (colors[k]?.shown === false ? ' param-image-chip__swatch--hidden' : '');
                sw.style.backgroundColor = colors[k]?.color || 'transparent';
                swatches.appendChild(sw);
            }
            if (cosets.length > MAX_SWATCHES) {
                const more = document.createElement('span');
                more.className = 'param-image-chip__more';
                more.textContent = '…';
                swatches.appendChild(more);
            }
        }
        const label = document.createElement('span');
        label.className = 'param-image-chip__names';
        const missing = [];
        if (everything) {
            label.textContent = 'everything';
        } else if (!entry.length) {
            label.textContent = '–';
        } else {
            entry.forEach((n, i) => {
                if (i) label.appendChild(document.createTextNode('+'));
                const span = document.createElement('span');
                span.textContent = n;
                if (known && !known.has(n)) { span.className = 'param-image-chip__unknown'; missing.push(n); }
                label.appendChild(span);
            });
        }
        chip.replaceChildren(...(swatches.childNodes.length ? [swatches] : []), label);
        chip.classList.toggle('param-image-chip--unseen', !namesMode && !everything && cosets.length === 0);
        chip.classList.toggle('param-image-chip--all', everything);

        const what = everything ? (namesMode ? 'the whole pattern' : 'everything')
                                : (entry.length ? entry.join(' + ') : 'nothing');
        const where = namesMode ? '' : (everything ? 'every coset' : (cosets.length ? cosetsText(cosets) : `entry ${j} (seen in no coset: the layer has ${colors.length} colours)`));
        const lost = missing.length ? `\n${missing.join(', ')}: not in the pattern, shows nothing` : '';
        chip.title = (where ? `${where}: ` : '') + what + lost + '\nclick to choose what it shows';
    }

    function updateDisplay() {
        if (!mRow) return;
        const tree = getTree();
        const hasTree = Array.isArray(tree);
        const known = hasTree ? treeNames(tree) : null;
        const colors = getCosets() || [];
        const list = entries();
        const everything = namesMode ? list[0].length === 0 : list.length === 0;
        const perChip = everything ? [[]] : list;
        const cosets = namesMode ? perChip.map(() => []) : imageListEntryCosets(everything ? [] : list, colors.length);

        // chips come and go at the end, before the buttons
        while (mChipEls.length < perChip.length) {
            const chip = makeChip(mChipEls.length);
            mChipEls.push(chip);
            mChips.insertBefore(chip, mAdd || mTextButton);
        }
        while (mChipEls.length > perChip.length) mChipEls.pop().remove();
        perChip.forEach((entry, j) => fillChip(mChipEls[j], j, entry, cosets[j] || [], colors, known, everything));

        // no names to pick: the text alone
        mRow.classList.toggle('param-image-list-row--chips', hasTree);
        mChips.style.display = hasTree ? '' : 'none';
        mText.style.display = (mTextOn || !hasTree) ? '' : 'none';
        mTextButton.setAttribute('aria-pressed', String(mTextOn));
        if (document.activeElement !== mText) mText.value = text();
        if (mAdd) {
            const full = list.length >= colors.length;
            mAdd.disabled = everything || full;
            mAdd.title = everything ? 'one more entry: pick what the list shows first (the chip\'s menu)'
                       : full ? `one more entry: every coset has its own already (${colors.length} colours)`
                       : 'one more entry: the last one again, so its cosets can show other things';
        }
    }

    function createUI(gui) {
        ensureStyle();

        mRow = document.createElement('li');
        mRow.className = 'cr string param-image-list-row';
        if (arg.tooltip) mRow.title = arg.tooltip;
        const div = document.createElement('div');
        const name = document.createElement('span');
        name.className = 'property-name';
        name.textContent = arg.name ?? key;
        const c = document.createElement('div');
        c.className = 'c';

        mChips = document.createElement('div');
        mChips.className = 'param-image-list-chips';
        if (!namesMode) {
            mAdd = document.createElement('button');
            mAdd.type = 'button';
            mAdd.className = 'param-image-list-button';
            mAdd.innerHTML = ADD_ICON;
            mAdd.addEventListener('click', () => commit(addImageListEntry(text())));
            mChips.appendChild(mAdd);
        }
        mTextButton = document.createElement('button');
        mTextButton.type = 'button';
        mTextButton.className = 'param-image-list-button';
        mTextButton.innerHTML = TEXT_ICON;
        mTextButton.title = namesMode ? 'the names as text: spaces between them'
                                      : 'the list as text: an entry per coset, spaces between them, + joins names, - is nothing';
        mTextButton.addEventListener('click', () => {
            mTextOn = !mTextOn;
            updateDisplay();
            if (mTextOn) mText.focus();
        });
        mChips.appendChild(mTextButton);

        mText = document.createElement('input');
        mText.type = 'text';
        mText.className = 'param-image-list-text';
        mText.spellcheck = false;
        mText.addEventListener('change', () => commit(namesMode ? mText.value.trim().split(/\s+/).filter(Boolean).join(' ')
                                                                : formatImageList(parseImageList(mText.value))));
        mText.addEventListener('keydown', (e) => {
            // the keys are the text's, not the page's shortcuts
            e.stopPropagation();
            if (e.key === 'Enter') mText.blur();
            if (e.key === 'Escape') { mText.value = text(); mText.blur(); }
        });

        c.appendChild(mChips);
        c.appendChild(mText);
        div.appendChild(name);
        div.appendChild(c);
        mRow.appendChild(div);
        const ul = gui.__ul ?? gui.domElement?.querySelector?.('ul') ?? gui.domElement;
        ul.appendChild(mRow);

        updateDisplay();
    }

    return {
        getValue: () => obj[key],
        setValue,
        createUI,
        updateDisplay,
        init: () => { obj[key] = initial; updateDisplay(); },
        serializable: true,
    };

} // ParamImageList
