/**
 * ParamPanel.js
 *
 * The params of one object at a time in a dat.gui panel inside an element
 * (the lower part of a list window, say): a title line, a note, then the
 * panel. The panel of an object is made the first time it is shown or
 * prepared and kept while the object lives, so its folders stay open or
 * closed and its controls stay the ones the params update (a param keeps
 * one control: an object's params get their UI here once, and nowhere else).
 * The panel's width follows the element's.
 *
 * Usage:
 *   const panel = createParamPanel({ element });
 *   panel.show(obj, () => obj.getParams(), { title: 'drawing · Color Images', note: '' });
 *   panel.prepare(obj, () => params);   // made now, shown later
 *   panel.forget(obj);                  // its panel dropped (the object is gone or replaced)
 *   panel.clear({ note: 'nothing selected' });
 *   panel.shown();                      // the object shown, or null
 */

import {
    DatGUI,
    createParamUI,
} from './modules.js';

const STYLE_ID = 'param-panel-style';

const CSS = `
.param-panel { display: flex; flex-direction: column; min-height: 100%; box-sizing: border-box;
               background: var(--background-color, #f9f9f9); }
.param-panel__head { padding: 3px 6px; font: 12px Verdana, sans-serif; color: #303030;
                     white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.param-panel__head .param-panel__kind { color: #909090; margin-left: 6px; }
.param-panel__note { padding: 2px 6px 4px; font: 11px Verdana, sans-serif; color: #707070; }
.param-panel__body { flex: 1 1 auto; }
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
 * @param {HTMLElement} arg.element  where the panel goes (it scrolls the panel)
 */
export function createParamPanel(arg = {}) {
    ensureStyle();
    const element = arg.element;
    const root = document.createElement('div');
    root.className = 'param-panel';
    const head = document.createElement('div');
    head.className = 'param-panel__head';
    const note = document.createElement('div');
    note.className = 'param-panel__note';
    const body = document.createElement('div');
    body.className = 'param-panel__body';
    root.append(head, note, body);
    element.appendChild(root);

    const mGuis = new WeakMap();    // object -> its dat.gui
    let mShownObj = null;
    let mShownGui = null;

    function width(){
        return Math.max(120, body.clientWidth || element.clientWidth || 280);
    }

    function fit(){
        if (mShownGui) mShownGui.width = width();
    }

    function guiOf(obj, getParams){
        let gui = mGuis.get(obj);
        if (!gui) {
            gui = new DatGUI({ autoPlace: false, width: width() });
            gui.domElement.classList.add('gui-window-panel');
            createParamUI(gui, getParams());
            mGuis.set(obj, gui);
        }
        return gui;
    }

    function setText(opt = {}){
        head.replaceChildren();
        if (opt.title) {
            head.append(opt.title);
            if (opt.kind) {
                const k = document.createElement('span');
                k.className = 'param-panel__kind';
                k.textContent = opt.kind;
                head.append(k);
            }
        }
        head.hidden = !opt.title;
        note.textContent = opt.note || '';
        note.hidden = !opt.note;
    }

    /** the panel of obj shown (made from getParams() the first time); opt: {title, kind, note} */
    function show(obj, getParams, opt = {}){
        setText(opt);
        const gui = guiOf(obj, getParams);
        if (gui !== mShownGui) {
            body.replaceChildren(gui.domElement);
            mShownGui = gui;
        }
        mShownObj = obj;
        fit();
    }

    /** the panel of obj made, not shown */
    function prepare(obj, getParams){
        guiOf(obj, getParams);
    }

    /** nothing shown; opt: {title, note} */
    function clear(opt = {}){
        setText(opt);
        body.replaceChildren();
        mShownObj = null;
        mShownGui = null;
    }

    /** the panel of obj dropped */
    function forget(obj){
        const gui = mGuis.get(obj);
        if (!gui) return;
        if (gui === mShownGui) clear();
        // not gui.destroy(): it unbinds dat.gui's one keydown handler of the page
        window.removeEventListener('resize', gui.__resizeHandler);
        gui.domElement.remove();
        mGuis.delete(obj);
    }

    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(element);

    return {
        show,
        prepare,
        clear,
        forget,
        has:   (obj) => mGuis.has(obj),
        shown: () => mShownObj,
    };
}
