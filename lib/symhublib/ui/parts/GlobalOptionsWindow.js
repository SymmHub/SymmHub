//
//  GlobalOptionsWindow.js: the renderer's options kept in the browser
//  (SymRendererConfig: its params) in a window made when it is first asked for
//  (files > Global Options..., the host's 'globalOptionsRequested'); later asks
//  show and hide it. A part of the UI builders (docs/symrenderer_refactor_plan.md
//  phase 4)
//
import {
    DatGUI,
    createParamUI,
    createInternalWindow,
} from '../../modules.js';

export function createGlobalOptionsWindow(host) {

    let win = null;
    let gui = null;

    function fitPanel() {
        if (gui && win && win.interior) gui.width = win.interior.clientWidth;
    }

    function showOrToggle(e) {
        const forceOpen = !!(e && e.open);
        if (win) {
            const visible = win.wnd.style.visibility !== 'hidden';
            const next = forceOpen ? true : !visible;
            win.setVisible(next);
            if (next) {
                fitPanel();
                if (win.raise) win.raise();
            }
            return;
        }
        const config = host.getRendererConfig();
        win = createInternalWindow({
            title:     'Global Options',
            width:     '280px',
            height:    '230px',
            left:      'calc(100% - 620px)',
            top:       '4px',
            canClose:  true,
            canResize: true,
            storageId: config.storageKey + '_ui',
            onResize:  fitPanel,
        });
        const interior = win.interior;
        interior.classList.add('gui-window-interior');
        gui = new DatGUI({ autoPlace: false, width: 280 });
        gui.domElement.classList.add('gui-window-panel');
        interior.appendChild(gui.domElement);
        createParamUI(gui, config.params);
        // Always show when explicitly requested, even if localStorage remembered it closed.
        win.setVisible(true);
        fitPanel();
        if (win.raise) win.raise();
    }

    host.addEventListener('globalOptionsRequested', showOrToggle);

    return { toggle: () => showOrToggle(), show: () => showOrToggle({ open: true }) };
}
