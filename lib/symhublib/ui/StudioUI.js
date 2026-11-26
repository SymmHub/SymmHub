//
//  StudioUI.js: docked full-viewport workspace UI builder for SymRenderer.
//
//  Layout (via uilib DockShell):
//   - Row 1: TopBarPart (SymmHub switcher, document title, Files/Windows, playback, Record, Export, Theme, Fullscreen, Inspector toggle)
//   - Row 2: Full-width contextual PropertyBar (no hint line — hints move to StatusBarPart)
//   - Row 3: Left vertical ToolPalette rail | Full-bleed unobstructed Canvas stage | Resizable Right Inspector Dock (tabs, Top/Bottom Split, Undock-to-float)
//   - Row 4: Smart collapsible Bottom Samples Drawer (open on bare app pages, collapsed when opened with #preset/#params)
//   - Row 5: Bottom StatusBarPart (full-width tool hint, symmetry symbol, view width w, world (x, y), FPS, Samples toggle)
//
//  uiOptions:
//    skin                  entries laid over DEFAULT_SKIN
//    tools                 renderer tool names shown in left rail (after pattern tools)
//    startTool             initial active tool name
//    visualizationWindow   dock Visualization Layers as its own inspector tab
//    symmetryWindow        dock Symmetry as its own inspector tab
//    transformsWindow      dock Conformal Transformations as its own inspector tab
//    patternPanel          optional (host) => { id, label, title?, window } for app-specific tab
//    defaultTab            initial primary right-dock tab id (e.g. 'layers', 'symmetry', 'settings')
//    defaultSplitTab       optional initial secondary split tab id (e.g. 'style')
//    panels                extra floating panels (e.g. [DataPlotPanel]); TimingPanel is always added
//    menuBuilder           (gui, params) => void for Settings tab
//    leaveOut              extra top-level param keys to omit from Settings tab
//

import {
    DEFAULT_SKIN,
    mergeSkin,
    getHashParams,
    scaleByPixelRatio,
    initTheme,
    createDockShell,
    createToolPalette,
    createPropertyBar,
    createSettingsWindow,
    createGlobalOptionsWindow,
    createDocumentWindows,
    createToolWindows,
    createTopBarPart,
    createStatusBarPart,
    addOwnTools,
    addPanels,
    listenContextMenu,
} from '../modules.js';

const DEFAULT_STUDIO_TOOLS = ['move', 'patternTransform', 'symmetry'];

const NOT_TYPED_INPUTS = /^(button|image|submit|reset|checkbox|radio|color|file)$/;

function isTypingTarget(t) {
    if (!t) return false;
    if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
    return t.tagName === 'INPUT' && !NOT_TYPED_INPUTS.test(t.type);
}

function panelIdFromLabel(label) {
    return String(label || 'panel').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function create(host, uiOptions = {}) {
    initTheme();
    const hash = getHashParams() || {};
    const skin = mergeSkin(DEFAULT_SKIN, uiOptions.skin, hash.skin);
    const hasInitialDoc = !!(hash.preset || hash.params);

    host.configure({ startTool: uiOptions.startTool, toolBar: true, spacePan: true });

    let topBar = null;
    let statusBar = null;
    let settings = null;
    let windows = null;
    let symPanelAdded = false;
    let started = false;

    function formatCanvasSize(cssW, cssH) {
        const display = started ? host.getParams?.()?.display : null;
        const mode = display?.canvasSize?.getValue ? display.canvasSize.getValue() : null;
        if (mode && mode !== 'Fit To Window') {
            const [cw, ch] = host.view.canvasSize();
            if (cw > 0 && ch > 0) {
                return {
                    text:  `${cw} \u00D7 ${ch}`,
                    title: `Canvas size: ${cw} \u00D7 ${ch} px (window ${cssW} \u00D7 ${cssH} CSS px)`,
                };
            }
        }
        const mult = display?.sizeMultiplier?.getValue ? (display.sizeMultiplier.getValue() || 1) : 1;
        const pxW = Math.max(1, mult * scaleByPixelRatio(cssW));
        const pxH = Math.max(1, mult * scaleByPixelRatio(cssH));
        const same = pxW === cssW && pxH === cssH;
        return {
            text:  `${pxW} \u00D7 ${pxH}`,
            title: same
                ? `Canvas size: ${pxW} \u00D7 ${pxH} px`
                : `Canvas render size: ${pxW} \u00D7 ${pxH} px (${cssW} \u00D7 ${cssH} CSS px)`,
        };
    }

    const shell = createDockShell({
        storagePrefix:     host.storageKey('studio'),
        defaultTab:        uiOptions.defaultTab || null,
        defaultSplitTab:   uiOptions.defaultSplitTab || null,
        defaultDrawerOpen: !hasInitialDoc,
        formatCanvasSize,
        onStageResize:     () => host.canvasResized(),
        onLayoutChange:    () => {
            if (topBar) topBar.refresh();
            if (statusBar) statusBar.refresh();
        },
    });

    addOwnTools(host, {
        skin,
        canShowTransforms:  () => !!(windows && windows.hasTransforms()),
        showTransforms:     () => { if (windows && windows.hasTransforms()) shell.activateTab('transforms'); },
        openSymmetryWindow: () => {
            if (symPanelAdded) shell.activateTab('symmetry', { open: false });
            else if (windows) windows.openSymmetry();
        },
    });

    addPanels(host, uiOptions);
    createGlobalOptionsWindow(host);
    // StudioUI mounts samples into the collapsible bottom drawer on 'ready'
    const documents = createDocumentWindows(host, { samples: false });
    listenContextMenu(host);
    host.addEventListener('settingsToggleRequested', () => {
        if (!settings) return;
        const p = shell.getPanels().find(x => x.id === 'settings');
        if (p && p.docked) {
            if (shell.isRightOpen() && shell.getState().activeTab === 'settings') {
                shell.setRightOpen(false);
            } else {
                shell.activateTab('settings');
            }
        } else {
            settings.toggle();
        }
    });

    const nav = host.getNavigator();
    const transformsWindow = !!(uiOptions.transformsWindow && nav.getProjection && nav.getProjection()
                                && nav.getProjection().getMaps);
    if (transformsWindow) nav.getParams().projection.createUI = () => {};

    host.addEventListener('start', () => {
        started = true;
        const pattern = host.getPattern();
        const visWindow = !!(uiOptions.visualizationWindow && host.getVisualization().addListener);
        const symWindow = !!uiOptions.symmetryWindow;

        // ── Left vertical ToolPalette rail ───────────────────────────────────
        const allTools = host.getTools();
        const tools = [];
        const patternTools = allTools.filter(t => t.owner === 'pattern').map(({ name, tool }) => ({
            name,
            label: tool.label || tool.name,
            key:   tool.key,
            icon:  tool.icon || skin.images.draw,
            group: tool.group || 'pattern',
        }));
        tools.push(...patternTools);

        const wantedTools = uiOptions.tools || DEFAULT_STUDIO_TOOLS;
        for (const name of wantedTools) {
            const entry = allTools.find(t => t.name === name && t.owner === 'renderer');
            if (!entry) continue;
            const t = entry.tool;
            tools.push({ name, label: t.label, key: t.key, icon: t.icon, group: t.group || 'view' });
        }

        const palette = tools.length
            ? createToolPalette({
                container: shell.leftRail,
                tools,
                onSelect:  (name) => host.setTool(name, true),
            })
            : null;

        // ── Full-width contextual PropertyBar (Row 2) ────────────────────────
        const toolBadge = document.createElement('span');
        toolBadge.className = 'studio-propbar__tool';
        shell.propertyBar.appendChild(toolBadge);

        const bar = createPropertyBar({
            container: shell.propertyBar,
            hint:      false,
            singleRow: true,
        });

        // Pattern's own tool UI (e.g. SymDraw SwatchPair + Style & Layers windows)
        const toolUI = pattern.createToolUI
            ? pattern.createToolUI({ paletteBottom: palette ? palette.bottom : null })
            : null;

        // Tool windows (Visualization, Symmetry, Transformations)
        windows = createToolWindows(host, {
            visualization: visWindow,
            symmetry:      symWindow,
            transforms:    transformsWindow,
        });

        // Optional app-specific pattern panel (e.g. Simulation / Attractor tab in Phase 4)
        const patternPanel = typeof uiOptions.patternPanel === 'function'
            ? uiOptions.patternPanel(host)
            : uiOptions.patternPanel || null;

        // Settings window (always available as the 'Settings' tab)
        const leaveOut = [
            ...(uiOptions.leaveOut || []),
            ...(visWindow ? ['visualization'] : []),
            ...(symWindow ? ['symmetry'] : []),
        ];
        settings = createSettingsWindow(host, {
            storageId:   host.storageKey('settings_window'),
            startHidden: false,
            menuBuilder: uiOptions.menuBuilder,
            leaveOut,
        });

        // ── Dock inspector panels into the right sidebar ─────────────────────
        // Pattern windows first (put Layers before Style when both exist)
        const patternWins = [...(toolUI?.windows || [])];
        patternWins.sort((a, b) => {
            const rank = (x) => (panelIdFromLabel(x.label) === 'layers' ? 0 : 1);
            return rank(a) - rank(b);
        });
        for (const entry of patternWins) {
            if (!entry.window) continue;
            shell.addPanel({
                id:     panelIdFromLabel(entry.label),
                label:  entry.label,
                title:  entry.title || entry.label,
                window: entry.window,
            });
        }

        if (patternPanel && patternPanel.window) {
            shell.addPanel({
                id:     patternPanel.id || panelIdFromLabel(patternPanel.label),
                label:  patternPanel.label,
                title:  patternPanel.title || patternPanel.label,
                window: patternPanel.window,
            });
        }

        const toolEntries = windows.entries();
        const visEntry = toolEntries.find(e => e.label === 'Visualization' && e.window);
        const symEntry = toolEntries.find(e => e.label === 'Symmetry' && e.window);
        const xfmEntry = toolEntries.find(e => e.label === 'Transformations' && e.window);

        if (visEntry) {
            shell.addPanel({ id: 'visualization', label: 'Visual', title: visEntry.title, window: visEntry.window });
        }
        if (symEntry) {
            symPanelAdded = true;
            shell.addPanel({ id: 'symmetry', label: 'Symmetry', title: symEntry.title, window: symEntry.window });
        }
        if (xfmEntry) {
            shell.addPanel({ id: 'transforms', label: 'Transforms', title: xfmEntry.title, window: xfmEntry.window });
        }

        shell.addPanel({
            id:     'settings',
            label:  'Settings',
            title:  'All renderer and pattern parameters',
            window: settings.window,
        });

        // ── Wire Tool Events & Single-Key Shortcuts ──────────────────────────
        host.addEventListener('toolChanged', (e) => {
            if (palette) palette.setActive(e.name);
            const tool = host.getTool(e.name);
            toolBadge.textContent = tool ? (tool.label || tool.name) : e.name;
            bar.setControls(tool && tool.getProperties ? tool.getProperties() : []);
        });
        host.addEventListener('toolBarRefresh', () => bar.refresh());
        host.addEventListener('toolStateChanged', () => {
            bar.refresh();
            if (toolUI && toolUI.refresh) toolUI.refresh();
        });

        if (palette) {
            window.addEventListener('keydown', (e) => {
                if (isTypingTarget(e.target) || e.isConsumed || e.repeat) return;
                if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey) return;
                const name = palette.toolForKey(e);
                if (!name) return;
                if (name !== host.getToolName()) host.setTool(name, true);
                e.isConsumed = true;
                e.preventDefault();
                host.refreshToolUI();
            });
        }

        // ── Top Bar & Bottom Status Bar ──────────────────────────────────────
        topBar = createTopBarPart(host, {
            shell,
            skin,
            documents,
            recording:     uiOptions.recording,
            onResetLayout: () => shell.resetLayout(),
        });

        statusBar = createStatusBarPart(host, { shell });
        host.refreshToolUI();
    });

    host.addEventListener('titleChanged', (e) => {
        shell.setCanvasTitle(e?.title || 'Canvas');
    });

    let lastBadgeW = 0;
    let lastBadgeH = 0;
    let lastBadgeCssW = 0;
    let lastBadgeCssH = 0;
    host.addEventListener('frameRendered', () => {
        if (!shell.isCanvasFloating()) {
            lastBadgeW = 0;
            return;
        }
        const [cw, ch] = host.view.canvasSize();
        const cssW = Math.round(shell.canvasHost.clientWidth || 0);
        const cssH = Math.round(shell.canvasHost.clientHeight || 0);
        if (cw === lastBadgeW && ch === lastBadgeH && cssW === lastBadgeCssW && cssH === lastBadgeCssH) return;
        lastBadgeW = cw;
        lastBadgeH = ch;
        lastBadgeCssW = cssW;
        lastBadgeCssH = cssH;
        const same = cw === cssW && ch === cssH;
        shell.setCanvasSizeLabel(
            `${cw} \u00D7 ${ch}`,
            same
                ? `Canvas size: ${cw} \u00D7 ${ch} px`
                : `Canvas render size: ${cw} \u00D7 ${ch} px (${cssW} \u00D7 ${cssH} CSS px)`
        );
    });

    host.addEventListener('ready', () => {
        const samplesWin = documents.ensureSamplesWindow();
        if (samplesWin) {
            shell.setBottomDrawer(samplesWin, {
                title:     'Samples',
                startOpen: !hasInitialDoc,
            });
        }
        if (topBar) topBar.refresh();
        if (statusBar) statusBar.refresh();
        host.canvasResized();
    });

    return {
        canvasHost: () => shell.canvasHost,
    };
}

export const StudioUI = { create };
