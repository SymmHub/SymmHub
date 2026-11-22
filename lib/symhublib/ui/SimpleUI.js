//
//  SimpleUI.js: a UI builder of SymRenderer (docs/symrenderer_refactor_plan.md
//  section 4.2 and phase 4) for a page that is mostly its picture: the canvas on the
//  page, the toolbox over it, the settings hidden at the start (the toolbox's first
//  button shows them) and the samples window made only when asked for. Put together
//  from the parts in ui/parts/, as ClassicUI.
//
//  uiOptions:
//    skin          entries laid over DEFAULT_SKIN (ui/SymRendererSkin.js)
//    panels        the page's panels, e.g. [DataPlotPanel] (the timing panel is always there)
//    menuBuilder   (gui, params) => void: the app's own layout of the settings panel
//
import {
    DEFAULT_SKIN,
    mergeSkin,
    getHashParams,
    createSettingsWindow,
    createGlobalOptionsWindow,
    createToolboxPart,
    createDocumentWindows,
    addOwnTools,
    addPanels,
    windowsMenuItems,
    listenContextMenu,
} from '../modules.js';

function create(host, uiOptions = {}) {

    // the skin: the page's entries (its address, #{"skin":{...}}) over the app's
    const skin = mergeSkin(DEFAULT_SKIN, uiOptions.skin, getHashParams().skin);
    let settings = null;

    addOwnTools(host, { skin });
    // the timing window, and the panels the page asks for (uiOptions.panels)
    addPanels(host, uiOptions);
    createGlobalOptionsWindow(host);
    // the samples window only when asked for (the param 'Samples...', the windows menu)
    const documents = createDocumentWindows(host, { samples: false });
    listenContextMenu(host);
    host.addEventListener('settingsToggleRequested', () => { if (settings) settings.toggle(); });

    host.addEventListener('start', () => {
        settings = createSettingsWindow(host, {
            storageId:   'symrenderer_settings_window',
            menuBuilder: uiOptions.menuBuilder,
        });
        // the toolbox's row over the canvas, in no window
        const toolbox = createToolboxPart(host, {
            skin,
            settings,
            inWindow:    false,
            toolButtons: true,
            windowsMenu: () => windowsMenuItems(host, [], { documents, omit: [settings.window] }),
        });
        host.canvas.container.appendChild(toolbox.container);
    });

    host.addEventListener('ready', () => {
        settings.setVisible(false);
    });

    return {
        // the canvas on the page
        canvasHost: () => null,
    };
}

export const SimpleUI = { create };
