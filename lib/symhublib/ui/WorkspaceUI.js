//
//  WorkspaceUI.js: a UI builder of SymRenderer (docs/symrenderer_refactor_plan.md
//  section 4.2 and phase 4) for drawing (symdraw): the tools in a palette, the active
//  tool's settings and help in a property bar, the documents' commands in a files
//  menu, the pattern's own commands (undo, redo, ...) and exports in the toolbox, and
//  the panels the page asks for in windows of their own. Put together from the parts
//  in ui/parts/, as ClassicUI.
//
//  It tells the renderer (host.configure) the start tool, that the tools' settings are
//  in a bar (the pattern's tools put them there, the Symmetry tool's toggles leave the
//  settings panel), and that Space held down moves the view in every tool.
//
//  uiOptions:
//    skin                  entries laid over DEFAULT_SKIN (ui/SymRendererSkin.js)
//    tools                 the renderer's tools in the palette, by name (the pattern's
//                          come first); move, patternTransform, symmetry by default
//    startTool             the tool taken up at the start ('pattern.select')
//    visualizationWindow   the visualization layers in a window of their own
//    symmetryWindow        the symmetry in a window of its own, the Symmetry tool's panel
//    transformsWindow      the conformal transformations in a window of their own
//    panels                the page's panels, e.g. [DataPlotPanel] (the timing panel is always there)
//    menuBuilder           (gui, params) => void: the app's own layout of the settings panel
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
    createToolPaletteBar,
    createToolWindows,
    addOwnTools,
    addPanels,
    windowsMenuItems,
    listenContextMenu,
} from '../modules.js';

function create(host, uiOptions = {}) {
    initTheme();
    // the skin: the page's entries (its address, #{"skin":{...}}) over the app's
    const skin = mergeSkin(DEFAULT_SKIN, uiOptions.skin, getHashParams().skin);
    host.configure({ startTool: uiOptions.startTool, toolBar: true, spacePan: true });

    const canvasWindow = createCanvasWindow(host);
    let settings = null;
    let palette = null;
    let windows = null;

    addOwnTools(host, {
        skin,
        canShowTransforms:  () => !!(windows && windows.hasTransforms()),
        showTransforms:     () => { if (windows) windows.showTransforms(); },
        openSymmetryWindow: () => { if (windows) windows.openSymmetry(); },
    });
    // the timing window, and the panels the page asks for (uiOptions.panels)
    addPanels(host, uiOptions);
    createGlobalOptionsWindow(host);
    const documents = createDocumentWindows(host);
    listenContextMenu(host);
    host.addEventListener('settingsToggleRequested', () => { if (settings) settings.toggle(); });

    // the navigator's list of conformal transformations goes to its window: the settings
    // panel leaves it out (its param keeps one control, the window's)
    const nav = host.getNavigator();
    const transformsWindow = !!(uiOptions.transformsWindow && nav.getProjection && nav.getProjection()
                                && nav.getProjection().getMaps);
    if (transformsWindow) nav.getParams().projection.createUI = () => {};

    // the tool panels: the palette, the bar, the pattern's (symdraw: style, layers), the
    // visualization layers, the symmetry, the transformations
    function toolWindowEntries() {
        return [
            ...(palette ? palette.entries() : []),
            ...(windows ? windows.entries() : []),
        ];
    }

    host.addEventListener('start', () => {
        // a visualization that tells its changes can have its window
        const visWindow = !!(uiOptions.visualizationWindow && host.getVisualization().addListener);
        const symWindow = !!uiOptions.symmetryWindow;
        // the settings are not needed for drawing: the window is the app's own (not
        // shared with the other apps) and starts closed until it was opened once; the
        // panels with a window of their own are left out of it
        settings = createSettingsWindow(host, {
            storageId:   host.storageKey('settings_window'),
            startHidden: true,
            menuBuilder: uiOptions.menuBuilder,
            leaveOut:    [...(visWindow ? ['visualization'] : []), ...(symWindow ? ['symmetry'] : [])],
        });
        const toolbox = createToolboxPart(host, {
            skin,
            settings,
            fileMenu:    true,
            documents,
            commands:    true,
            exportMenu:  true,
            // with the files menu the samples and the files are opened there
            windowsMenu: () => windowsMenuItems(host, toolWindowEntries(),
                                                { documents, filesMenu: true, omit: [settings.window] }),
        });
        palette = createToolPaletteBar(host, { skin, tools: uiOptions.tools, toolbox });
        windows = createToolWindows(host, {
            visualization: visWindow,
            symmetry:      symWindow,
            transforms:    transformsWindow,
        });
    });

    host.addEventListener('ready', () => {
        // the tool panels start above the samples and the files
        toolWindowEntries().forEach(e => e.window?.raise());
    });

    return {
        // where the renderer puts its canvas: the window's interior
        canvasHost: () => canvasWindow.interior,
    };
}

export const WorkspaceUI = { create };
