//
//  TopBarPart.js: compact top command bar for StudioUI.
//  Mounts into DockShell.topBar and provides:
//   - SymmHub brand & cross-app / symmetry-family switcher (APP_CATALOG)
//   - live document title
//   - Files ▾ and Windows ▾ menus (with panel toggle, Split toggle, Samples drawer, Reset Layout)
//   - pattern commands (Undo/Redo/...), animation playback (Run/Stop, Restart, Init), Record, Export
//   - Theme toggle (Light / Dark / System), Fullscreen, and Inspector sidebar toggle
//

import {
    APP_CATALOG,
    showPopupMenu,
    windowMenuItems,
    showCommandMenu,
    fileMenuItems,
    exportMenuItems,
    getTheme,
    cycleTheme,
    onThemeChange,
    themeLabel,
} from '../../modules.js';

// Resolve repo root from lib/symhublib/ui/parts/TopBarPart.js so links work at any mount path
const REPO_ROOT = new URL('../../../../', import.meta.url);

const ICON_BRAND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">' +
    '<polygon points="12,2.5 20.5,7.5 20.5,16.5 12,21.5 3.5,16.5 3.5,7.5"/>' +
    '<path d="M12 2.5 V21.5 M3.5 7.5 L20.5 16.5 M20.5 7.5 L3.5 16.5" stroke-width="1.2" opacity="0.65"/>' +
    '<circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/></svg>';

const ICON_INSPECTOR =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">' +
    '<rect x="3" y="4" width="18" height="16" rx="2"/>' +
    '<path d="M15 4 V20"/></svg>';

const ICON_FLOAT_CANVAS =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">' +
    '<rect x="2.5" y="3.5" width="19" height="17" rx="2" stroke-dasharray="2.5 2" opacity="0.55"/>' +
    '<rect x="5.5" y="6.5" width="12" height="10.5" rx="1.3"/>' +
    '<path d="M5.5 9.5 H17.5"/></svg>';

function resolveRepoUrl(relPath) {
    return new URL(relPath, REPO_ROOT).href;
}

function samePath(relPath) {
    try {
        return new URL(relPath, REPO_ROOT).pathname === window.location.pathname;
    } catch (e) {
        return false;
    }
}

function findCurrentApp() {
    for (const app of APP_CATALOG.apps) {
        const variants = [...(app.variants || []), ...(app.devVariants || [])];
        for (const v of variants) {
            if ((v.page && samePath(v.page)) || (v.thumbPage && samePath(v.thumbPage))) {
                return { app, variant: v };
            }
        }
        if (app.index && samePath(app.index)) {
            return { app, variant: null };
        }
    }
    return { app: null, variant: null };
}

function setIconContent(el, icon) {
    if (!icon) return;
    if (typeof icon === 'string' && icon.trim().startsWith('<svg')) {
        el.insertAdjacentHTML('beforeend', icon);
    } else if (typeof icon === 'string') {
        const img = document.createElement('img');
        img.src = icon;
        img.alt = '';
        el.appendChild(img);
    }
}

function makeButton({ text, icon, title, ariaLabel, hasPopup, className = 'studio-btn', onClick }) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    if (title) btn.title = title;
    if (ariaLabel || title) btn.setAttribute('aria-label', ariaLabel || title);
    if (hasPopup) btn.setAttribute('aria-haspopup', 'menu');
    setIconContent(btn, icon);
    if (text) {
        const span = document.createElement('span');
        span.textContent = text;
        btn.appendChild(span);
    }
    // Keep keyboard focus on the canvas/tools when clicking toolbar actions with mouse
    btn.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') e.preventDefault(); });
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
}

function makeSep() {
    const sep = document.createElement('span');
    sep.className = 'studio-topbar__sep';
    sep.setAttribute('role', 'separator');
    return sep;
}

/**
 * @param {object} host
 * @param {object} opt
 * @param {object} opt.shell         DockShell instance
 * @param {object} opt.skin          merged SymRendererSkin
 * @param {object} opt.documents     DocumentWindows instance
 * @param {Function} opt.onResetLayout
 */
export function createTopBarPart(host, opt = {}) {
    const shell = opt.shell;
    const skin = opt.skin;
    const images = skin.images;
    const labels = skin.labels;
    const documents = opt.documents;
    const pattern = host.getPattern();
    const container = shell.topBar;
    container.replaceChildren();

    const { app: currentApp } = findCurrentApp();

    // ── Left group: Brand Switcher + Document Title + Files / Windows ────────

    const leftGroup = document.createElement('div');
    leftGroup.className = 'studio-topbar__group';

    const brandBtn = document.createElement('button');
    brandBtn.type = 'button';
    brandBtn.className = 'studio-topbar__brand';
    brandBtn.title = 'Switch SymmHub app or symmetry family';
    brandBtn.setAttribute('aria-label', 'SymmHub app switcher');
    brandBtn.setAttribute('aria-haspopup', 'menu');
    setIconContent(brandBtn, ICON_BRAND);
    const brandText = document.createElement('span');
    brandText.textContent = currentApp ? `SymmHub · ${currentApp.title}` : 'SymmHub';
    const brandCaret = document.createElement('span');
    brandCaret.className = 'studio-topbar__caret';
    brandCaret.textContent = '\u25BE';
    brandBtn.append(brandText, brandCaret);
    brandBtn.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') e.preventDefault(); });
    brandBtn.addEventListener('click', () => {
        showPopupMenu({ anchor: brandBtn, items: buildAppSwitcherItems() });
    });

    const docTitleEl = document.createElement('span');
    docTitleEl.className = 'studio-doc-title';
    docTitleEl.title = 'Current document';

    const filesBtn = makeButton({
        text: 'Files \u25BE',
        title: labels.fileMenu || 'Files and saved documents',
        hasPopup: true,
        onClick: () => showCommandMenu(host, { anchor: filesBtn }, fileMenuItems(host, documents)),
    });

    const windowsBtn = makeButton({
        text: 'Windows \u25BE',
        title: labels.windows || 'Panels, inspector layout, and floating windows',
        hasPopup: true,
        onClick: () => showPopupMenu({ anchor: windowsBtn, items: buildWindowsItems() }),
    });

    leftGroup.append(brandBtn, docTitleEl, makeSep(), filesBtn, windowsBtn);

    // ── Center group: Pattern commands, Playback, Record, Export ─────────────

    const actionGroup = document.createElement('div');
    actionGroup.className = 'studio-topbar__group';

    const commands = pattern.getToolboxCommands ? pattern.getToolboxCommands() : [];
    const cmdButtons = new Map();
    if (commands.length) {
        actionGroup.appendChild(makeSep());
        for (const cmd of commands) {
            const btn = makeButton({
                icon: cmd.icon,
                text: cmd.icon ? '' : cmd.name,
                title: cmd.title || cmd.name,
                hasPopup: !!cmd.items,
                onClick: () => {
                    if (cmd.items) {
                        showCommandMenu(host, { anchor: btn }, cmd.items());
                        return;
                    }
                    cmd.action();
                    host.refreshToolUI();
                    host.scheduleRepaint();
                },
            });
            cmdButtons.set(cmd.name, { btn, cmd });
            actionGroup.appendChild(btn);
        }
    }

    // Playback buttons (present for animated apps or added dynamically on canAnimateChanged)
    const playbackGroup = document.createElement('div');
    playbackGroup.className = 'studio-topbar__group';
    let runBtn = null;
    let restartBtn = null;

    function ensurePlaybackButtons() {
        if (runBtn || !host.canAnimate()) return;
        playbackGroup.appendChild(makeSep());
        runBtn = makeButton({
            icon: host.isRunning() ? images.stop : images.run,
            title: host.isRunning() ? labels.stop : labels.run,
            ariaLabel: labels.run,
            onClick: () => host.toggleRun(),
        });
        restartBtn = makeButton({
            icon: images.restart,
            title: labels.restart,
            ariaLabel: labels.restart,
            onClick: () => host.restart(),
        });
        playbackGroup.append(runBtn, restartBtn);
    }

    ensurePlaybackButtons();

    if (pattern.initSimulation) {
        if (!runBtn) playbackGroup.appendChild(makeSep());
        const initBtn = makeButton({
            icon: images.initialize,
            title: labels.initialize,
            ariaLabel: labels.initialize,
            onClick: () => host.initSimulation(),
        });
        playbackGroup.appendChild(initBtn);
    }

    const mediaGroup = document.createElement('div');
    mediaGroup.className = 'studio-topbar__group';
    mediaGroup.appendChild(makeSep());

    const showRecording = opt.recording !== false;
    const recordBtn = showRecording ? makeButton({
        icon: images.recordStart,
        title: labels.recording,
        ariaLabel: labels.recording,
        onClick: () => host.toggleRecording(),
    }) : null;

    const hasExportMenu = !!pattern.getExportItems;
    const exportBtn = makeButton({
        icon: images.download,
        text: hasExportMenu ? 'Export \u25BE' : 'Export',
        title: hasExportMenu ? labels.exportMenu : labels.exportImage,
        hasPopup: hasExportMenu,
        onClick: () => {
            if (hasExportMenu) showCommandMenu(host, { anchor: exportBtn }, exportMenuItems(host));
            else host.exportImage();
        },
    });

    if (recordBtn) mediaGroup.appendChild(recordBtn);
    mediaGroup.appendChild(exportBtn);

    // ── Spacer & Right utility group: Theme, Fullscreen, Inspector toggle ────

    const spacer = document.createElement('div');
    spacer.className = 'studio-topbar__spacer';

    const rightGroup = document.createElement('div');
    rightGroup.className = 'studio-topbar__group';

    const initialTheme = themeLabel(getTheme());
    const themeBtn = makeButton({
        title: initialTheme.title,
        ariaLabel: 'Switch color theme',
        className: 'studio-btn studio-btn--theme',
        onClick: () => cycleTheme(),
    });
    const themeIco = document.createElement('span');
    themeIco.className = 'studio-btn__ico';
    themeIco.textContent = initialTheme.icon;
    const themeLbl = document.createElement('span');
    themeLbl.className = 'studio-btn__lbl';
    themeLbl.textContent = initialTheme.label;
    themeBtn.append(themeIco, themeLbl);

    const fullscreenBtn = makeButton({
        icon: images.fullScreen,
        title: labels.fullScreen,
        ariaLabel: labels.fullScreen,
        onClick: () => host.fullscreen(),
    });

    const canvasFloatBtn = makeButton({
        icon: ICON_FLOAT_CANVAS,
        title: 'Float canvas in a movable, resizable window',
        ariaLabel: 'Toggle floating canvas mode',
        className: 'studio-btn studio-btn--float-canvas',
        onClick: () => shell.toggleCanvasFloating(),
    });

    const dockToggleBtn = makeButton({
        icon: ICON_INSPECTOR,
        title: 'Show or hide right inspector sidebar',
        ariaLabel: 'Toggle inspector sidebar',
        onClick: () => shell.toggleRight(),
    });

    rightGroup.append(themeBtn, fullscreenBtn, canvasFloatBtn, dockToggleBtn);

    container.append(leftGroup, actionGroup, playbackGroup, mediaGroup, spacer, rightGroup);

    // ── Menu Builders ────────────────────────────────────────────────────────

    function buildAppSwitcherItems() {
        const items = [
            { label: 'SymmHub Home', title: 'Main SymmHub portal',
              action: () => { window.location.href = resolveRepoUrl(APP_CATALOG.home); } },
        ];
        if (currentApp && currentApp.index && !samePath(currentApp.index)) {
            items.push({
                label: `${currentApp.title} Gallery`,
                title: `Open ${currentApp.title} presets gallery`,
                action: () => { window.location.href = resolveRepoUrl(currentApp.index); },
            });
        }
        if (currentApp && currentApp.variants && currentApp.variants.length > 1) {
            items.push({ separator: true });
            items.push({ label: `${currentApp.title} Symmetry Families`, disabled: true });
            for (const v of currentApp.variants) {
                items.push({
                    label: v.label,
                    checked: samePath(v.page),
                    action: () => { window.location.href = resolveRepoUrl(v.page); },
                });
            }
        }
        items.push({ separator: true });
        items.push({ label: 'Applications', disabled: true });
        for (const app of APP_CATALOG.apps) {
            if (currentApp && app.id === currentApp.id) continue;
            items.push({
                label: app.title,
                title: app.subtitle,
                action: () => { window.location.href = resolveRepoUrl(app.index); },
            });
        }
        if (APP_CATALOG.docs && APP_CATALOG.docs.length) {
            items.push({ separator: true });
            for (const doc of APP_CATALOG.docs) {
                items.push({
                    label: doc.title,
                    action: () => { window.location.href = resolveRepoUrl(doc.path); },
                });
            }
        }
        return items;
    }

    function buildWindowsItems() {
        const panels = shell.getPanels();
        const state = shell.getState();
        const items = [];
        const dockedPanelWindows = [];

        for (const p of panels) {
            dockedPanelWindows.push(p.window);
            const active = p.docked
                ? (shell.isRightOpen() && (state.activeTab === p.id || (state.splitOpen && state.splitTab === p.id)))
                : p.window.isVisible();
            items.push({
                label: p.docked ? p.label : `${p.label} (floating)`,
                title: p.title || p.label,
                checked: active,
                action: () => {
                    if (!p.docked) {
                        if (p.window.isVisible()) p.window.setVisible(false);
                        else { p.window.setVisible(true); p.window.raise(); }
                    } else if (active && !state.splitOpen) {
                        shell.setRightOpen(false);
                    } else {
                        shell.activateTab(p.id);
                    }
                },
            });
        }

        const dockedCount = panels.filter(p => p.docked).length;
        items.push({ separator: true });
        items.push({
            label: 'Floating Canvas',
            title: 'Place the canvas in a movable, resizable window to adjust height/width or arrange beside floating panels',
            checked: shell.isCanvasFloating(),
            action: () => shell.toggleCanvasFloating(),
        });
        items.push({
            label: 'Inspector Sidebar',
            checked: shell.isRightOpen(),
            disabled: dockedCount === 0,
            action: () => shell.toggleRight(),
        });
        items.push({
            label: 'Split Inspector (Top / Bottom)',
            checked: shell.isSplitOpen(),
            disabled: dockedCount < 2,
            action: () => shell.setSplitOpen(!shell.isSplitOpen()),
        });

        if (shell.hasDrawer()) {
            items.push({
                label: 'Samples Drawer',
                checked: shell.isDrawerOpen(),
                action: () => shell.toggleDrawer(),
            });
        }

        const filesWin = documents.filesWindow();
        const samplesWin = documents.samplesWindow();
        if (filesWin) {
            items.push({
                label: 'Files',
                title: 'Documents saved in a folder',
                checked: filesWin.isVisible(),
                action: () => filesWin.setVisible(!filesWin.isVisible()),
            });
        }

        // Any other floating windows (e.g. Timing, Data Plot, Global Options)
        const extras = windowMenuItems([], {
            omit: [...dockedPanelWindows, filesWin, samplesWin].filter(Boolean),
        });
        if (extras.length) {
            items.push({ separator: true });
            items.push(...extras);
        }

        items.push({ separator: true });
        items.push({
            label: 'Reset Window Layout',
            title: 'Restore default inspector tabs, drawer, and window positions without deleting saved documents',
            action: () => { if (opt.onResetLayout) opt.onResetLayout(); },
        });
        return items;
    }

    // ── Sync & Event Wiring ──────────────────────────────────────────────────

    function syncCommands() {
        for (const { btn, cmd } of cmdButtons.values()) {
            if (cmd.enabled) btn.disabled = !cmd.enabled();
        }
    }

    function syncRun(running) {
        if (!runBtn) return;
        const img = runBtn.querySelector('img');
        if (img) img.src = running ? images.stop : images.run;
        runBtn.title = running ? labels.stop : labels.run;
        runBtn.setAttribute('aria-label', running ? labels.stop : labels.run);
        runBtn.classList.toggle('studio-btn--active', !!running);
    }

    function syncRecording(recording) {
        if (!recordBtn) return;
        const img = recordBtn.querySelector('img');
        if (img) img.src = recording ? images.recordStop : images.recordStart;
        recordBtn.classList.toggle('studio-btn--recording', !!recording);
    }

    function refresh() {
        syncCommands();
        const floating = shell.isCanvasFloating();
        canvasFloatBtn.classList.toggle('studio-btn--active', floating);
        canvasFloatBtn.setAttribute('aria-pressed', floating ? 'true' : 'false');
        canvasFloatBtn.title = floating
            ? 'Dock canvas to fill workspace'
            : 'Float canvas in a movable, resizable window';
        dockToggleBtn.classList.toggle('studio-btn--active', shell.isRightOpen());
        dockToggleBtn.setAttribute('aria-pressed', shell.isRightOpen() ? 'true' : 'false');
    }

    onThemeChange((pref) => {
        const info = themeLabel(pref);
        themeIco.textContent = info.icon;
        themeLbl.textContent = info.label;
        themeBtn.title = info.title;
    });

    host.addEventListener('titleChanged', (e) => {
        const title = e?.title || '';
        docTitleEl.textContent = title;
        docTitleEl.title = title;
    });
    host.addEventListener('toolStateChanged', syncCommands);
    host.addEventListener('runChanged', (e) => syncRun(!!e?.running));
    host.addEventListener('recordingChanged', (e) => syncRecording(!!e?.recording));
    host.addEventListener('canAnimateChanged', ensurePlaybackButtons);

    refresh();

    return {
        refresh,
    };
}
