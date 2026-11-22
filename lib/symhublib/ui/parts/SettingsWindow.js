//
//  SettingsWindow.js: the settings panel in a window of its own, at the right edge;
//  the panel is built from the host's params (createParamUI, or the app's own layout:
//  opt.menuBuilder(gui, params)), its folder 'scripting' given to the scripts' params.
//  A part of the UI builders (docs/symrenderer_refactor_plan.md phase 4)
//
//  opt.storageId     the window's place and whether it shows, kept under this id
//  opt.startHidden   hidden until it was opened once (a page that draws with a palette
//                    needs no settings to start)
//  opt.menuBuilder   (gui, params) => void, in place of createParamUI(gui, params)
//  opt.leaveOut      names of params the panel leaves out: their UI is elsewhere (a
//                    window of their own); the params stay as they are
//
import {
    DatGUI,
    createParamUI,
    createInternalWindow,
} from '../../modules.js';

export function createSettingsWindow(host, opt = {}) {

    const storageId = opt.storageId || 'symrenderer_settings_window';
    let shown = null;
    try { shown = window.localStorage.getItem(storageId + '_visible'); } catch (e) { /* no storage */ }

    // told when the window was shown or hidden (the toolbox's settings button)
    const listeners = [];
    const changed = () => listeners.forEach(fn => fn());

    let gui = null;
    let win = null;
    win = createInternalWindow({
        title:     'settings',
        width:     '320px',
        height:    '520px',
        left:      'calc(100% - 340px)',
        top:       '10px',
        canClose:  true,
        canResize: true,
        storageId,
        onClose:   changed,
        onResize:  () => { if (gui && win && win.interior) gui.width = Math.max(160, win.interior.clientWidth || 300); },
    });

    const interior = win.interior;
    interior.classList.add('gui-window-interior');

    gui = new DatGUI({ autoPlace: false, width: 300 });
    gui.domElement.classList.add('gui-window-panel');
    gui.domElement.id = 'rightGUI';
    interior.appendChild(gui.domElement);

    // the params the panel shows: those left out have a UI of nothing here
    const params = host.getParams();
    const leaveOut = opt.leaveOut || [];
    const panelParams = leaveOut.length
        ? Object.fromEntries(Object.entries(params).map(([key, param]) =>
            [key, leaveOut.includes(key) ? { ...param, createUI: () => {} } : param]))
        : params;
    if (opt.menuBuilder) opt.menuBuilder(gui, panelParams);
    else createParamUI(gui, panelParams);

    // the 'script params' folder goes into the folder 'scripting', made just now
    host.attachScriptFolder(gui.__folders?.['scripting']);

    gui.width = Math.max(160, interior.clientWidth || 300);
    if (opt.startHidden && shown === null) win.setVisible(false);

    function isVisible() {
        return win.isVisible();
    }

    function setVisible(visible) {
        win.setVisible(!!visible);
        changed();
    }

    return {
        window:   win,
        gui,
        isVisible,
        setVisible,
        toggle:   () => setVisible(!isVisible()),
        onChange: (fn) => { listeners.push(fn); },
    };
}
