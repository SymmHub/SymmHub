/**
 * ParamButtons.js
 *
 * A dat.gui row with several buttons side by side, for actions that belong
 * together (a ParamFunc takes a whole row each). It has nothing to save, so it
 * is not serializable.
 *
 * Usage:
 *   const row = ParamButtons({
 *       buttons: [
 *           { key: 'save',   name: 'Save...', func: () => { ... }, tooltip: 'Keep it' },
 *           { key: 'delete', name: 'Delete',  func: () => { ... } },
 *       ],
 *   });
 *   row.setEnabled('delete', false);   // a disabled button is dimmed
 *   row.setName('save', 'Save as...');
 */

const STYLE_ID = 'param-buttons-style';

const CSS = `
/* dat.gui collapses a closed folder with height:0 on its rows, an inline
   height would block that rule (same trick as .param-image-row) */
.dg ul:not(.closed) > li.param-buttons-row { height: auto; }
.param-buttons { display: flex; gap: 4px; padding: 3px 0; }
.param-buttons button {
    flex: 1 1 0; min-width: 0; height: 22px; padding: 0 4px; box-sizing: border-box;
    font: inherit; font-size: 12px; line-height: 20px; text-shadow: none;
    color: var(--ui-button-color, #606060);
    background: var(--ui-button-background-color, #fff);
    border: 1px solid var(--ui-button-border-color, rgba(0, 0, 0, 0.4)); border-radius: 3px;
    cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.param-buttons button:hover:not(:disabled) {
    color: var(--ui-button-hover-color, #000);
    background: var(--hover-background-color, #f0f0f0);
}
.param-buttons button:disabled { opacity: 0.45; cursor: default; }
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

/**
 * @param {object} arg
 * @param {Array}  arg.buttons  [{ key, name, func, tooltip }]
 */
export function ParamButtons(arg) {

    const mItems   = arg.buttons || [];
    const mButtons = new Map();     // key -> <button>
    const mEnabled = new Map();     // key -> boolean, kept until the UI exists

    function createUI(gui) {
        ensureStyle();

        const li = document.createElement('li');
        li.className = 'cr param-buttons-row';

        const row = document.createElement('div');
        row.className = 'param-buttons';

        for (const item of mItems) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = item.name;
            if (item.tooltip) button.title = item.tooltip;
            button.disabled = mEnabled.get(item.key) === false;
            button.addEventListener('click', () => item.func?.());
            mButtons.set(item.key, button);
            row.appendChild(button);
        }

        li.appendChild(row);
        const ul = gui.__ul ?? gui.domElement?.querySelector?.('ul') ?? gui.domElement;
        ul.appendChild(li);
    }

    return {
        createUI,
        setEnabled(key, enabled) {
            mEnabled.set(key, !!enabled);
            const button = mButtons.get(key);
            if (button) button.disabled = !enabled;
        },
        setName(key, name) {
            const button = mButtons.get(key);
            if (button) button.textContent = name;
        },
        serializable: false,
    };

} // ParamButtons
