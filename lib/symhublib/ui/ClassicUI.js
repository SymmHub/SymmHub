//
//  ClassicUI.js: a UI builder of SymRenderer (docs/symrenderer_refactor_plan.md
//  section 4.2 and phase 4), put together from the parts in ui/parts/:
//  - the canvas in its window ('visualization');
//  - the settings window, the Global Options window, the samples and the files;
//  - the toolbox: the commands, and a button per tool;
//  - the menus, the renderer's own tools.
//
//  ClassicUI.create(host, uiOptions) is called once, when the renderer makes its
//  canvas: it makes the canvas's place and the tools; the rest of the page is built
//  on the host's 'start' (the pattern and the params exist).
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
    createCanvasWindow,
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
    const canvasWindow = createCanvasWindow(host);
    let settings = null;

    addOwnTools(host, { skin });
    // the timing window, and the panels the page asks for (uiOptions.panels)
    addPanels(host, uiOptions);
    createGlobalOptionsWindow(host);
    const documents = createDocumentWindows(host);
    listenContextMenu(host);
    host.addEventListener('settingsToggleRequested', () => { if (settings) settings.toggle(); });

    host.addEventListener('start', () => {
        // the settings window, shared by the apps of this UI
        settings = createSettingsWindow(host, {
            storageId:   'symrenderer_settings_window',
            menuBuilder: uiOptions.menuBuilder,
        });
        createToolboxPart(host, {
            skin,
            settings,
            toolButtons: true,
            // the settings are the toolbox's first button, not in this menu
            windowsMenu: () => windowsMenuItems(host, [], { documents, omit: [settings.window] }),
        });
    });

    return {
        // where the renderer puts its canvas: the window's interior
        canvasHost: () => canvasWindow.interior,
    };
}

export const ClassicUI = { create };
