/**
 * ToolPalette.js
 *
 * A palette of tools: an internal window with a column of icon buttons, one
 * of them active (a radio group), in groups parted by a thin rule. The
 * tooltip of a button is the tool's name and its key ("Pen (B)"). The owner
 * switches the tools and handles the keys; the palette shows which tool is
 * active and finds the tool of a key.
 *
 * Usage:
 *   const palette = createToolPalette({
 *       title:     'tools',
 *       storageId: 'tool_palette',        // remembers where the window was put
 *       left: '1px', top: '150px',        // its first place
 *       columns:   1,                     // buttons per row
 *       tools: [
 *           { name: 'select', label: 'Select', key: 'V', icon: 'res/btn_select.svg', group: 'edit' },
 *           { name: 'pen',    label: 'Pen',    key: 'B', icon: 'res/btn_pen.svg',    group: 'draw' },
 *       ],
 *       onSelect:  (name) => { ... },     // a button was pressed
 *   });
 *   palette.setActive('pen');             // show the active tool
 *   palette.toolForKey(e)                 // the tool of a keydown without modifiers, or null
 *   palette.bottom                        // an element under the buttons, for the owner's widgets
 */

import {
    createInternalWindow,
} from './modules.js';

const STYLE_ID = 'tool-palette-style';

const BUTTON_SIZE = 34;

const CSS = `
.tool-palette { display: inline-flex; flex-direction: column; align-items: center; padding: 3px; gap: 2px;
                background: var(--background-color, #f9f9f9); cursor: default; user-select: none; }
.tool-palette__group { display: grid; gap: 2px; }
.tool-palette__rule { align-self: stretch; height: 1px; margin: 2px 1px; background: rgba(0, 0, 0, 0.2); }
.tool-palette__button {
    width: ${BUTTON_SIZE}px; height: ${BUTTON_SIZE}px; padding: 4px; margin: 0; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center;
    background: transparent; border: 1px solid transparent; border-radius: 4px; cursor: pointer;
}
.tool-palette__button:hover { background: var(--hover-background-color, #e8e8e8); }
.tool-palette__button img { width: 100%; height: 100%; pointer-events: none; }
.tool-palette__button--active,
.tool-palette__button--active:hover {
    background-color: #bae6fd; border-color: #0284c7; box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.25);
}
.tool-palette__bottom:empty { display: none; }
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

/** "Pen (B)" */
function tooltip(tool){
    const name = tool.label || tool.name;
    return tool.key ? `${name} (${tool.key})` : name;
}

/**
 * @param {object}   arg
 * @param {Array}    arg.tools      [{ name, label, key, icon, group }]
 * @param {Function} arg.onSelect   (name) => void
 * @param {string}   [arg.title]
 * @param {string}   [arg.storageId]
 * @param {string}   [arg.left]
 * @param {string}   [arg.top]
 * @param {number}   [arg.columns]  buttons per row, 1 by default
 */
export function createToolPalette(arg = {}) {
    ensureStyle();
    const onSelect = arg.onSelect || (() => {});
    const columns = Math.max(1, arg.columns || 1);

    const win = createInternalWindow({
        title:         arg.title ?? 'tools',
        left:          arg.left || '1px',
        top:           arg.top || '70px',
        width:         '40px',
        height:        '100px',
        canClose:      false,
        canResize:     false,
        alwaysOnTop:   true,
        alwaysVisible: true,
        storageId:     arg.storageId,
    });
    win.interior.style.overflow = 'hidden';

    const content = document.createElement('div');
    content.className = 'tool-palette';
    content.setAttribute('role', 'radiogroup');
    if (arg.title) content.setAttribute('aria-label', arg.title);
    const bottom = document.createElement('div');
    bottom.className = 'tool-palette__bottom';
    win.interior.appendChild(content);

    let mTools = [];
    let mButtons = new Map();
    let mActive = null;

    function setTools(tools){
        mTools = (tools || []).filter(Boolean);
        mButtons = new Map();
        content.replaceChildren();
        let group = null, groupEl = null;
        for (const tool of mTools) {
            if (!groupEl || tool.group !== group) {
                if (groupEl) {
                    const rule = document.createElement('div');
                    rule.className = 'tool-palette__rule';
                    content.appendChild(rule);
                }
                group = tool.group;
                groupEl = document.createElement('div');
                groupEl.className = 'tool-palette__group';
                groupEl.style.gridTemplateColumns = `repeat(${columns}, ${BUTTON_SIZE}px)`;
                content.appendChild(groupEl);
            }
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tool-palette__button';
            btn.title = tooltip(tool);
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-label', tool.label || tool.name);
            btn.setAttribute('aria-checked', 'false');
            const img = document.createElement('img');
            img.src = tool.icon;
            img.alt = '';
            btn.appendChild(img);
            // the button takes no focus: the keys stay with the canvas and its tools
            btn.addEventListener('pointerdown', (e) => e.preventDefault());
            btn.addEventListener('click', () => onSelect(tool.name));
            groupEl.appendChild(btn);
            mButtons.set(tool.name, btn);
        }
        content.appendChild(bottom);
        setActive(mActive);
        fit();
    }

    /** the window around the buttons */
    function fit(){
        win.setInteriorSize(content.offsetWidth, content.offsetHeight);
        win.clamp();
    }

    function setActive(name){
        mActive = name;
        mButtons.forEach((btn, n) => {
            const on = n === name;
            btn.classList.toggle('tool-palette__button--active', on);
            btn.setAttribute('aria-checked', on ? 'true' : 'false');
        });
    }

    /** the tool of a keydown without Ctrl, Alt or Meta, or null */
    function toolForKey(e){
        if (e.ctrlKey || e.altKey || e.metaKey || !e.key) return null;
        const key = e.key.toLowerCase();
        const tool = mTools.find(t => t.key && t.key.toLowerCase() === key);
        return tool ? tool.name : null;
    }

    setTools(arg.tools);
    // the window is measured again once the icons are in
    new ResizeObserver(() => fit()).observe(content);

    return {
        window:    win,
        container: content,
        bottom,
        setTools,
        setActive,
        getActive: () => mActive,
        toolForKey,
        getButton: (name) => mButtons.get(name) || null,
        fit,
    };
}
