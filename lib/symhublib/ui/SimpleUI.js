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
    initTheme,
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
    initTheme();
    // the skin: the page's entries (its address, #{"skin":{...}}) over the app's
    const skin = mergeSkin(DEFAULT_SKIN, uiOptions.skin, getHashParams().skin);
    let noToolbar = uiOptions.toolbar === false;
    try {
        if (new URLSearchParams(globalThis.location?.search || '').get('toolbar') === '0') noToolbar = true;
    } catch (e) { /* no location */ }

    addOwnTools(host, { skin });
    if (noToolbar) {
        return { canvasHost: () => null };
    }

    let settings = null;
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
        const minimal = !!uiOptions.simpleMinimal;
        const toolbox = createToolboxPart(host, {
            skin,
            settings,
            inWindow:    false,
            toolButtons: !minimal,
            recording:   uiOptions.recording,
            windowsMenu: minimal ? null : () => windowsMenuItems(host, [], { documents, omit: [settings.window] }),
        });
        host.canvas.container.appendChild(toolbox.container);
    });

    host.addEventListener('ready', () => {
        if (settings) settings.setVisible(false);
    });

    return {
        // the canvas on the page
        canvasHost: () => null,
    };
}

export const SimpleUI = { create };
