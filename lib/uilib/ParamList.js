/**
 * ParamList.js
 *
 * A list in a dat.gui panel: one thin line per item, a colour, a name, a text, a note
 * and a button that removes the item. A long list scrolls in the room of maxRows lines.
 * It has nothing to save, the owner gives it the items.
 *
 * Usage:
 *   const list = ParamList({
 *       maxRows:  8,
 *       onHover:  (index) => { ... },     // the pointer is on item index, -1 when it left
 *       onRemove: (index) => { ... },
 *       removeTooltip: 'remove',
 *   });
 *   list.setItems([
 *       { color: '#D01010', name: 'a', text: '(af)11', note: 'b',
 *         title: 'a tooltip', attention: false, dim: false },
 *   ]);
 *   list.setHighlight(2);                 // -1: none; a highlighted item is scrolled into view
 *
 * An empty list takes no room.
 */

const STYLE_ID = 'param-list-style';
const ROW_HEIGHT = 19;

const CSS = `
/* dat.gui collapses a closed folder with height:0 on its rows, an inline
   height would block that rule (same trick as .param-image-row) */
.dg ul:not(.closed) > li.param-list-row { height: auto; }
.dg li.param-list-row { line-height: normal; }
.param-list { overflow-y: auto; margin: 2px 0 3px 0; }
.param-list__item {
    display: flex; align-items: center; gap: 5px; height: ${ROW_HEIGHT}px; padding: 0 2px;
    box-sizing: border-box; border-radius: 2px;
}
.param-list__item--highlight { background: var(--hover-background-color, #f0f0f0); }
.param-list__item--dim { opacity: 0.55; }
.param-list__item--attention .param-list__text,
.param-list__item--attention .param-list__note { color: var(--ui-attention-color, #d9730d); }
.param-list__swatch {
    flex: 0 0 auto; width: 10px; height: 10px; box-sizing: border-box; border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.45);
}
.param-list__name { flex: 0 0 auto; min-width: 1em; font-weight: bold; }
.param-list__text { flex: 1 1 auto; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.param-list__note { flex: 0 0 auto; opacity: 0.75; }
.param-list__remove {
    flex: 0 0 auto; width: 16px; height: 16px; padding: 0; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center; visibility: hidden;
    font: inherit; font-size: 13px; line-height: 1;
    color: var(--ui-button-color, #606060); background: none;
    border: 1px solid transparent; border-radius: 3px; cursor: pointer;
}
.param-list__item:hover .param-list__remove,
.param-list__remove:focus-visible { visibility: visible; }
.param-list__remove:hover {
    color: var(--ui-button-hover-color, #000);
    border-color: var(--ui-button-border-color, rgba(0, 0, 0, 0.4));
}
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

/**
 * @param {object}   [arg]
 * @param {number}   [arg.maxRows]        the lines shown before the list scrolls, default 8
 * @param {(index:number) => void} [arg.onHover]
 * @param {(index:number) => void} [arg.onRemove]
 * @param {string}   [arg.removeTooltip]
 */
export function ParamList(arg = {}) {

    let mLi = null;
    let mBox = null;
    let mItems = [];
    let mShown = null;       // the text of the items in the list, not to rebuild it for nothing
    let mHighlight = -1;

    function showHighlight() {
        if (!mBox) return;
        [...mBox.children].forEach((el, i) => {
            const on = i === mHighlight;
            el.classList.toggle('param-list__item--highlight', on);
            if (on) el.scrollIntoView({ block: 'nearest' });
        });
    }

    function makeItem(item, index) {
        const el = document.createElement('div');
        el.className = 'param-list__item';
        if (item.attention) el.classList.add('param-list__item--attention');
        if (item.dim) el.classList.add('param-list__item--dim');
        if (item.title) el.title = item.title;
        const span = (cls, text) => {
            const s = document.createElement('span');
            s.className = cls;
            if (text !== undefined) s.textContent = text;
            el.appendChild(s);
            return s;
        };
        const swatch = span('param-list__swatch');
        swatch.style.background = item.color ?? 'none';
        span('param-list__name', item.name ?? '');
        span('param-list__text', item.text ?? '');
        if (item.note) span('param-list__note', item.note);
        if (arg.onRemove) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'param-list__remove';
            b.textContent = '×';
            const tip = arg.removeTooltip ?? 'remove';
            b.title = tip;
            b.setAttribute('aria-label', `${tip} ${item.name ?? ''}`.trim());
            b.addEventListener('click', () => arg.onRemove(index));
            el.appendChild(b);
        }
        if (arg.onHover) el.addEventListener('mouseenter', () => arg.onHover(index));
        return el;
    }

    function showItems() {
        if (!mBox) return;
        const text = JSON.stringify(mItems);
        if (text === mShown) return;
        mShown = text;
        const top = mBox.scrollTop;
        mBox.replaceChildren(...mItems.map(makeItem));
        mBox.scrollTop = top;
        mLi.style.display = mItems.length ? '' : 'none';
        showHighlight();
    }

    function createUI(gui) {
        ensureStyle();
        mLi = document.createElement('li');
        mLi.className = 'cr param-list-row';
        mBox = document.createElement('div');
        mBox.className = 'param-list';
        mBox.style.maxHeight = `${(arg.maxRows ?? 8) * ROW_HEIGHT}px`;
        if (arg.onHover) mBox.addEventListener('mouseleave', () => arg.onHover(-1));
        mLi.appendChild(mBox);
        const ul = gui.__ul ?? gui.domElement?.querySelector?.('ul') ?? gui.domElement;
        ul.appendChild(mLi);
        mShown = null;
        showItems();
    }

    return {
        createUI,
        setItems:     (items) => { mItems = items ?? []; showItems(); },
        setHighlight: (index) => { if (index !== mHighlight) { mHighlight = index; showHighlight(); } },
        serializable: false,
    };

} // ParamList
