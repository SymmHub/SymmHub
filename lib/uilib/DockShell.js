/**
 * DockShell.js
 *
 * Full-viewport docked workspace container for StudioUI:
 *  - topBar, propertyBar, leftRail, central stage (docked or floating canvasHost),
 *  - resizable right inspector dock with tabs, Top/Bottom Split, and Undock-to-float,
 *  - collapsible bottom Samples drawer,
 *  - bottom statusBar,
 *  - responsive <960px slide-over drawer behavior,
 *  - per-app layout persistence and non-destructive resetLayout().
 */

import {
    resetWindowLayouts,
} from './modules.js';

const DEFAULT_RIGHT_WIDTH = 340;
const MIN_RIGHT_WIDTH = 240;
const MAX_RIGHT_WIDTH = 540;

const DEFAULT_DRAWER_HEIGHT = 206;
const MIN_DRAWER_HEIGHT = 136;
const MAX_DRAWER_HEIGHT = 360;

const MIN_CANVAS_WIDTH = 180;
const MIN_CANVAS_HEIGHT = 140;
const CANVAS_HEADER_HEIGHT = 24;

const CANVAS_GRIP_SVG =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<path d="M14 6L6 14M14 10l-4 4" fill="none" stroke="currentColor"' +
    ' stroke-width="1.5" stroke-linecap="round"/></svg>';

const NARROW_BREAKPOINT = 960;

function readJson(key) {
    if (!key) return null;
    try {
        const raw = globalThis.localStorage?.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function writeJson(key, val) {
    if (!key) return;
    try {
        globalThis.localStorage?.setItem(key, JSON.stringify(val));
    } catch (e) { /* storage unavailable */ }
}

function removeKey(key) {
    if (!key) return;
    try {
        globalThis.localStorage?.removeItem(key);
    } catch (e) { /* storage unavailable */ }
}

function sanitizeCanvasRect(rect) {
    if (!rect || typeof rect !== 'object') return null;
    const left = Number(rect.left);
    const top = Number(rect.top);
    const width = Number(rect.width);
    const height = Number(rect.height);
    if (!Number.isFinite(left) || !Number.isFinite(top)
        || !Number.isFinite(width) || !Number.isFinite(height)) return null;
    if (width < MIN_CANVAS_WIDTH || height < MIN_CANVAS_HEIGHT) return null;
    return {
        left:   Math.max(0, Math.round(left)),
        top:    Math.max(0, Math.round(top)),
        width:  Math.round(width),
        height: Math.round(height),
    };
}

/**
 * @param {object}   arg
 * @param {HTMLElement} [arg.parent]              where to append shell (default document.body)
 * @param {string}   [arg.storagePrefix]          per-app localStorage prefix (e.g. host.storageKey('studio'))
 * @param {string}   [arg.defaultTab]             initial primary tab id
 * @param {string}   [arg.defaultSplitTab]        initial secondary split tab id (enables split by default when set)
 * @param {boolean}  [arg.defaultDrawerOpen]      initial bottom drawer visibility when no saved state exists
 * @param {boolean}  [arg.defaultCanvasFloating]  initial floating canvas mode when no saved state exists
 * @param {Function} [arg.formatCanvasSize]       optional (cssW, cssH) => string | { text, title } for floating header badge
 * @param {Function} [arg.onStageResize]          called when canvas host dimensions change
 * @param {Function} [arg.onLayoutChange]         called when dock/drawer/canvas mode or tabs change
 */
export function createDockShell(arg = {}) {
    const parent = arg.parent || document.body;
    const storageKey = arg.storagePrefix ? arg.storagePrefix + '_layout' : null;
    const saved = readJson(storageKey);

    const defaults = {
        rightOpen:      true,
        rightWidth:     DEFAULT_RIGHT_WIDTH,
        activeTab:      arg.defaultTab || null,
        splitOpen:      !!arg.defaultSplitTab,
        splitTab:       arg.defaultSplitTab || null,
        splitRatio:     0.52,
        drawerOpen:     !!arg.defaultDrawerOpen,
        drawerHeight:   DEFAULT_DRAWER_HEIGHT,
        undocked:       [],
        canvasFloating: !!arg.defaultCanvasFloating,
        canvasRect:     null,
    };

    const mState = {
        ...defaults,
        ...(saved && typeof saved === 'object' ? saved : {}),
        undocked:       Array.isArray(saved?.undocked) ? [...saved.undocked] : [],
        canvasFloating: saved && typeof saved.canvasFloating === 'boolean'
            ? saved.canvasFloating : defaults.canvasFloating,
        canvasRect:     sanitizeCanvasRect(saved?.canvasRect),
    };

    // Registered panels: Map<id, { id, label, title, window, storageId, docked, onShow }>
    const mPanels = new Map();
    const mPanelOrder = [];
    let mDrawerWindow = null;
    let mNarrow = false;
    let mHasDrawer = false;
    let mUserTouched = saved != null;
    let mRenderedCanvasRect = null;

    // ── DOM structure ────────────────────────────────────────────────────────

    const root = document.createElement('div');
    root.className = 'studio-shell';

    const topBar = document.createElement('div');
    topBar.className = 'studio-topbar';
    topBar.setAttribute('role', 'toolbar');
    topBar.setAttribute('aria-label', 'Application toolbar');

    const propertyBar = document.createElement('div');
    propertyBar.className = 'studio-propbar';

    const middle = document.createElement('div');
    middle.className = 'studio-middle';

    const leftRail = document.createElement('div');
    leftRail.className = 'studio-left';

    const stage = document.createElement('div');
    stage.className = 'studio-stage';

    const canvasWin = document.createElement('div');
    canvasWin.className = 'studio-canvas-win';

    const canvasHeader = document.createElement('div');
    canvasHeader.className = 'studio-canvas-win__header';

    const canvasTitle = document.createElement('span');
    canvasTitle.className = 'studio-canvas-win__title';
    canvasTitle.textContent = 'Canvas';

    const canvasSizeEl = document.createElement('span');
    canvasSizeEl.className = 'studio-canvas-win__size';

    const canvasDockBtn = document.createElement('button');
    canvasDockBtn.type = 'button';
    canvasDockBtn.className = 'studio-canvas-win__dock-btn';
    canvasDockBtn.textContent = '\u2199';
    canvasDockBtn.title = 'Dock canvas to fill workspace';
    canvasDockBtn.setAttribute('aria-label', 'Dock canvas to fill workspace');

    canvasHeader.append(canvasTitle, canvasSizeEl, canvasDockBtn);

    const canvasHost = document.createElement('div');
    canvasHost.className = 'studio-canvas-win__body';

    canvasWin.append(canvasHeader, canvasHost);

    const canvasResizeHandles = {};
    for (const dir of ['n', 's', 'e', 'w', 'sw', 'se']) {
        const handle = document.createElement('div');
        handle.className = `studio-canvas-win__resize studio-canvas-win__resize--${dir}`;
        if (dir === 'se') {
            handle.innerHTML = CANVAS_GRIP_SVG;
            handle.title = 'Drag to resize canvas';
        } else if (dir === 'n' || dir === 's') {
            handle.title = 'Drag to adjust canvas height';
        } else if (dir === 'e' || dir === 'w') {
            handle.title = 'Drag to adjust canvas width';
        } else {
            handle.title = 'Drag to resize canvas';
        }
        canvasWin.appendChild(handle);
        canvasResizeHandles[dir] = handle;
    }

    stage.appendChild(canvasWin);

    const rightWrap = document.createElement('div');
    rightWrap.className = 'studio-right-wrap';

    const rightSash = document.createElement('div');
    rightSash.className = 'studio-sash-v';
    rightSash.title = 'Drag to resize inspector sidebar';

    const rightDock = document.createElement('aside');
    rightDock.className = 'studio-right';
    rightDock.setAttribute('aria-label', 'Inspector');

    const rightHead = document.createElement('div');
    rightHead.className = 'studio-right__head';

    const tabStrip = document.createElement('div');
    tabStrip.className = 'studio-tabs';
    tabStrip.setAttribute('role', 'tablist');

    const dockActions = document.createElement('div');
    dockActions.className = 'studio-dock-actions';

    const splitBtn = document.createElement('button');
    splitBtn.type = 'button';
    splitBtn.className = 'studio-icon-btn';
    splitBtn.textContent = '\u229F';
    splitBtn.title = 'Toggle top/bottom split view';
    splitBtn.setAttribute('aria-label', 'Toggle top/bottom split view');

    const undockBtn = document.createElement('button');
    undockBtn.type = 'button';
    undockBtn.className = 'studio-icon-btn';
    undockBtn.textContent = '\u2197';
    undockBtn.title = 'Undock active panel into a floating window';
    undockBtn.setAttribute('aria-label', 'Undock active panel');

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'studio-icon-btn';
    collapseBtn.textContent = '\u203A';
    collapseBtn.title = 'Hide inspector sidebar';
    collapseBtn.setAttribute('aria-label', 'Hide inspector sidebar');

    dockActions.append(splitBtn, undockBtn, collapseBtn);
    rightHead.append(tabStrip, dockActions);

    const rightBody = document.createElement('div');
    rightBody.className = 'studio-right__body';

    const primaryPane = document.createElement('div');
    primaryPane.className = 'studio-pane studio-pane--primary';
    const primarySlot = document.createElement('div');
    primarySlot.className = 'studio-pane__slot';
    primaryPane.appendChild(primarySlot);

    const splitSash = document.createElement('div');
    splitSash.className = 'studio-split-sash';
    splitSash.title = 'Drag to resize split panes';

    const secondaryPane = document.createElement('div');
    secondaryPane.className = 'studio-pane studio-pane--secondary';
    const splitHead = document.createElement('div');
    splitHead.className = 'studio-split-head';
    const splitSelect = document.createElement('select');
    splitSelect.className = 'studio-split-select';
    splitSelect.setAttribute('aria-label', 'Lower inspector panel');

    const splitUndockBtn = document.createElement('button');
    splitUndockBtn.type = 'button';
    splitUndockBtn.className = 'studio-icon-btn';
    splitUndockBtn.textContent = '\u2197';
    splitUndockBtn.title = 'Undock lower panel';
    splitUndockBtn.setAttribute('aria-label', 'Undock lower panel');

    const splitCloseBtn = document.createElement('button');
    splitCloseBtn.type = 'button';
    splitCloseBtn.className = 'studio-icon-btn';
    splitCloseBtn.textContent = '\u00D7';
    splitCloseBtn.title = 'Close split view';
    splitCloseBtn.setAttribute('aria-label', 'Close split view');

    splitHead.append(splitSelect, splitUndockBtn, splitCloseBtn);
    const secondarySlot = document.createElement('div');
    secondarySlot.className = 'studio-pane__slot';
    secondaryPane.append(splitHead, secondarySlot);

    rightBody.append(primaryPane, splitSash, secondaryPane);
    rightDock.append(rightHead, rightBody);
    rightWrap.append(rightSash, rightDock);

    const scrim = document.createElement('div');
    scrim.className = 'studio-scrim studio-hidden';
    scrim.setAttribute('aria-hidden', 'true');
    scrim.addEventListener('click', () => setRightOpen(false));

    middle.append(leftRail, stage, scrim, rightWrap);

    // Bottom Samples Drawer
    const drawer = document.createElement('div');
    drawer.className = 'studio-drawer studio-hidden';
    const drawerSash = document.createElement('div');
    drawerSash.className = 'studio-drawer__sash';
    drawerSash.title = 'Drag to resize samples drawer';
    const drawerHead = document.createElement('div');
    drawerHead.className = 'studio-drawer__head';
    const drawerTitle = document.createElement('span');
    drawerTitle.textContent = 'Samples';
    const drawerCloseBtn = document.createElement('button');
    drawerCloseBtn.type = 'button';
    drawerCloseBtn.className = 'studio-icon-btn';
    drawerCloseBtn.textContent = '\u00D7';
    drawerCloseBtn.title = 'Hide samples drawer';
    drawerCloseBtn.setAttribute('aria-label', 'Hide samples drawer');
    drawerHead.append(drawerTitle, drawerCloseBtn);
    const drawerBody = document.createElement('div');
    drawerBody.className = 'studio-drawer__body';
    drawer.append(drawerSash, drawerHead, drawerBody);

    // Bottom Status Bar
    const statusBar = document.createElement('div');
    statusBar.className = 'studio-statusbar';
    statusBar.setAttribute('role', 'status');

    root.append(topBar, propertyBar, middle, drawer, statusBar);
    parent.appendChild(root);

    // ── Helpers ──────────────────────────────────────────────────────────────

    function save() {
        writeJson(storageKey, {
            rightOpen:      mState.rightOpen,
            rightWidth:     mState.rightWidth,
            activeTab:      mState.activeTab,
            splitOpen:      mState.splitOpen,
            splitTab:       mState.splitTab,
            splitRatio:     mState.splitRatio,
            drawerOpen:     mState.drawerOpen,
            drawerHeight:   mState.drawerHeight,
            undocked:       mState.undocked,
            canvasFloating: mState.canvasFloating,
            canvasRect:     mState.canvasRect,
        });
    }

    function notifyLayout() {
        if (arg.onLayoutChange) arg.onLayoutChange();
    }

    function notifyStage() {
        if (arg.onStageResize) arg.onStageResize();
    }

    // ── Floating Canvas Geometry & Mode ──────────────────────────────────────

    function stageSize() {
        return {
            w: stage.clientWidth || 0,
            h: stage.clientHeight || 0,
        };
    }

    function computeDefaultCanvasRect() {
        const { w: sw, h: sh } = stageSize();
        const availW = sw > 0 ? sw : Math.max(640, (globalThis.innerWidth || 1280) - (mState.rightOpen ? mState.rightWidth : 0) - 44);
        const availH = sh > 0 ? sh : Math.max(480, (globalThis.innerHeight || 800) - 120);
        const margin = 16;
        const minW = Math.min(MIN_CANVAS_WIDTH, availW);
        const minH = Math.min(MIN_CANVAS_HEIGHT, availH);
        const maxW = Math.max(minW, availW - margin * 2);
        const maxH = Math.max(minH, availH - margin * 2);
        const width = Math.max(minW, Math.min(maxW, Math.round(availW * 0.75)));
        const height = Math.max(minH, Math.min(maxH, Math.round(availH * 0.75)));
        const left = Math.max(0, Math.round((availW - width) / 2));
        const top = Math.max(0, Math.round((availH - height) / 2));
        return { left, top, width, height };
    }

    function clampCanvasRect(rect) {
        const { w: sw, h: sh } = stageSize();
        let left = Math.round(rect.left);
        let top = Math.round(rect.top);
        let width = Math.round(rect.width);
        let height = Math.round(rect.height);

        if (sw > 0) {
            const minW = Math.min(MIN_CANVAS_WIDTH, sw);
            width = Math.max(minW, Math.min(sw, width));
            left = Math.max(0, Math.min(sw - width, left));
        } else {
            width = Math.max(MIN_CANVAS_WIDTH, width);
            left = Math.max(0, left);
        }
        if (sh > 0) {
            const minH = Math.min(MIN_CANVAS_HEIGHT, sh);
            height = Math.max(minH, Math.min(sh, height));
            top = Math.max(0, Math.min(sh - height, top));
        } else {
            height = Math.max(MIN_CANVAS_HEIGHT, height);
            top = Math.max(0, top);
        }
        return { left, top, width, height };
    }

    function updateCanvasSizeBadge(rect) {
        if (!rect) return;
        const bodyW = Math.max(1, Math.round(rect.width - 2));
        const bodyH = Math.max(1, Math.round(rect.height - CANVAS_HEADER_HEIGHT - 2));
        if (typeof arg.formatCanvasSize === 'function') {
            const formatted = arg.formatCanvasSize(bodyW, bodyH);
            if (formatted && typeof formatted === 'object') {
                canvasSizeEl.textContent = formatted.text || '';
                canvasSizeEl.title = formatted.title || '';
                return;
            }
            if (typeof formatted === 'string') {
                canvasSizeEl.textContent = formatted;
                return;
            }
        }
        canvasSizeEl.textContent = `${bodyW} \u00D7 ${bodyH}`;
        canvasSizeEl.title = `Canvas size: ${bodyW} \u00D7 ${bodyH} px`;
    }

    function applyCanvasRect() {
        if (!mState.canvasFloating) {
            mRenderedCanvasRect = null;
            return false;
        }
        if (!mState.canvasRect) {
            mState.canvasRect = computeDefaultCanvasRect();
        }
        const clamped = clampCanvasRect(mState.canvasRect);
        const prev = mRenderedCanvasRect;
        const sizeChanged = !prev || prev.width !== clamped.width || prev.height !== clamped.height;
        mRenderedCanvasRect = clamped;

        canvasWin.style.left = clamped.left + 'px';
        canvasWin.style.top = clamped.top + 'px';
        canvasWin.style.width = clamped.width + 'px';
        canvasWin.style.height = clamped.height + 'px';
        updateCanvasSizeBadge(clamped);
        return sizeChanged;
    }

    function syncCanvasMode() {
        const floating = !!mState.canvasFloating;
        stage.classList.toggle('studio-stage--floating', floating);
        canvasWin.classList.toggle('studio-canvas-win--floating', floating);
        if (floating) {
            applyCanvasRect();
        } else {
            mRenderedCanvasRect = null;
            canvasWin.style.left = '';
            canvasWin.style.top = '';
            canvasWin.style.width = '';
            canvasWin.style.height = '';
        }
    }

    function onStageBoundsChanged() {
        if (mState.canvasFloating) {
            if (applyCanvasRect()) notifyStage();
        } else {
            notifyStage();
        }
    }

    function setCanvasFloating(floating) {
        const next = !!floating;
        if (next === mState.canvasFloating) return;
        mUserTouched = true;
        mState.canvasFloating = next;
        syncCanvasMode();
        syncDockUI();
        save();
        notifyStage();
    }

    function toggleCanvasFloating() {
        setCanvasFloating(!mState.canvasFloating);
    }

    function setCanvasRect(rect) {
        const next = sanitizeCanvasRect(rect);
        if (!next) return;
        mUserTouched = true;
        mState.canvasRect = next;
        if (mState.canvasFloating) {
            const sizeChanged = applyCanvasRect();
            save();
            if (sizeChanged) notifyStage();
        } else {
            save();
        }
    }

    function setCanvasTitle(title) {
        const text = title || 'Canvas';
        canvasTitle.textContent = text;
        canvasTitle.title = text;
    }

    function setCanvasSizeLabel(text, tooltip) {
        canvasSizeEl.textContent = text || '';
        if (tooltip !== undefined) canvasSizeEl.title = tooltip || '';
    }

    function dockedIds() {
        return mPanelOrder.filter(id => mPanels.get(id)?.docked);
    }

    function ensureValidTabs() {
        const ids = dockedIds();
        if (!ids.length) {
            mState.activeTab = null;
            mState.splitTab = null;
            return;
        }
        if (!mUserTouched && arg.defaultTab && ids.includes(arg.defaultTab)) {
            mState.activeTab = arg.defaultTab;
        } else if (!mState.activeTab || !ids.includes(mState.activeTab)) {
            mState.activeTab = (arg.defaultTab && ids.includes(arg.defaultTab)) ? arg.defaultTab : ids[0];
        }
        if (mState.splitOpen) {
            const others = ids.filter(id => id !== mState.activeTab);
            if (!others.length) {
                mState.splitTab = null;
            } else if (!mUserTouched && arg.defaultSplitTab && others.includes(arg.defaultSplitTab)) {
                mState.splitTab = arg.defaultSplitTab;
            } else if (!mState.splitTab || !others.includes(mState.splitTab)) {
                mState.splitTab = (arg.defaultSplitTab && others.includes(arg.defaultSplitTab))
                    ? arg.defaultSplitTab : others[0];
            }
        }
    }

    function mountInterior(panel, slot, shown) {
        const el = panel.window.interior;
        if (el.parentElement !== slot) slot.appendChild(el);
        el.classList.toggle('studio-slot-hidden', !shown);
        if (shown) panel.window.notifyResized();
    }

    function syncDockUI() {
        ensureValidTabs();
        const ids = dockedIds();
        const hasDocked = ids.length > 0;
        const showRight = mState.rightOpen && hasDocked;

        rightWrap.classList.toggle('studio-hidden', !showRight);
        scrim.classList.toggle('studio-hidden', !(mNarrow && showRight));
        rightDock.style.width = Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, mState.rightWidth)) + 'px';

        // Render tab strip
        tabStrip.replaceChildren();
        for (const id of ids) {
            const p = mPanels.get(id);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'studio-tab' + (id === mState.activeTab ? ' studio-tab--active' : '');
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', id === mState.activeTab ? 'true' : 'false');
            btn.textContent = p.label;
            if (p.title) btn.title = p.title;
            btn.addEventListener('click', () => activateTab(id));
            tabStrip.appendChild(btn);
        }

        const canSplit = ids.length >= 2;
        const splitActive = mState.splitOpen && canSplit && !!mState.splitTab;
        splitBtn.disabled = !canSplit;
        splitBtn.classList.toggle('studio-icon-btn--on', splitActive);
        undockBtn.disabled = !mState.activeTab;

        // Primary & secondary split pane visibility & proportions
        if (splitActive) {
            const ratio = Math.max(0.2, Math.min(0.8, mState.splitRatio || 0.52));
            primaryPane.style.flex = `${ratio} 1 0`;
            secondaryPane.style.flex = `${1 - ratio} 1 0`;
            splitSash.style.display = '';
            secondaryPane.style.display = '';
        } else {
            primaryPane.style.flex = '1 1 0';
            splitSash.style.display = 'none';
            secondaryPane.style.display = 'none';
        }

        // Populate secondary pane selector
        splitSelect.replaceChildren();
        for (const id of ids) {
            if (id === mState.activeTab) continue;
            const p = mPanels.get(id);
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = p.label;
            if (id === mState.splitTab) opt.selected = true;
            splitSelect.appendChild(opt);
        }

        // Place each docked panel's interior in the right slot and toggle visibility
        for (const id of ids) {
            const p = mPanels.get(id);
            if (splitActive && id === mState.splitTab) {
                mountInterior(p, secondarySlot, showRight);
            } else {
                mountInterior(p, primarySlot, showRight && id === mState.activeTab);
            }
        }

        // Bottom Samples drawer
        const showDrawer = mHasDrawer && mState.drawerOpen;
        drawer.classList.toggle('studio-hidden', !showDrawer);
        drawer.style.height = Math.max(MIN_DRAWER_HEIGHT, Math.min(MAX_DRAWER_HEIGHT, mState.drawerHeight)) + 'px';
        if (showDrawer && mDrawerWindow) mDrawerWindow.notifyResized();

        notifyLayout();
    }

    // ── Panel Registration & Dock/Undock ─────────────────────────────────────

    function dockPanelInternal(panel) {
        panel.docked = true;
        mState.undocked = mState.undocked.filter(x => x !== panel.id);
        panel.window.dockInto(primarySlot, {
            isVisible: () => mState.rightOpen && (mState.activeTab === panel.id || (mState.splitOpen && mState.splitTab === panel.id)),
            onShow: () => {
                mState.rightOpen = true;
                if (!(mState.splitOpen && mState.splitTab === panel.id)) {
                    mState.activeTab = panel.id;
                }
                syncDockUI();
                save();
                onStageBoundsChanged();
            },
            onHide: () => {
                // Hiding the only active panel collapses the sidebar
                if (mState.splitOpen && mState.splitTab === panel.id) {
                    mState.splitOpen = false;
                    mState.splitTab = null;
                } else if (mState.activeTab === panel.id) {
                    mState.rightOpen = false;
                }
                syncDockUI();
                save();
                onStageBoundsChanged();
            },
            onRedock: () => redockPanel(panel.id),
            onTitleChange: () => syncDockUI(),
        });
    }

    /**
     * Register a panel backed by an InternalWindow into the right inspector dock.
     * @param {{ id: string, label: string, title?: string, window: object }} spec
     */
    function addPanel(spec) {
        if (!spec || !spec.id || !spec.window) return;
        const panel = {
            id:        spec.id,
            label:     spec.label || spec.id,
            title:     spec.title || '',
            window:    spec.window,
            storageId: spec.window.storageId || null,
            docked:    true,
        };
        mPanels.set(panel.id, panel);
        if (!mPanelOrder.includes(panel.id)) mPanelOrder.push(panel.id);

        if (mState.undocked.includes(panel.id)) {
            // Keep it floating with a Dock button wired back to this shell
            dockPanelInternal(panel);
            panel.docked = false;
            panel.window.undock();
        } else {
            dockPanelInternal(panel);
        }
        syncDockUI();
    }

    function activateTab(id, { open = true } = {}) {
        const p = mPanels.get(id);
        if (!p) return;
        mUserTouched = true;
        if (!p.docked) {
            if (open) {
                p.window.setVisible(true);
                p.window.raise();
            }
            return;
        }
        const wasRightOpen = mState.rightOpen;
        if (open) mState.rightOpen = true;
        if (mState.splitOpen && mState.splitTab === id) {
            // Swap upper & lower panes cleanly
            const prev = mState.activeTab;
            mState.activeTab = id;
            mState.splitTab = prev;
        } else {
            mState.activeTab = id;
        }
        syncDockUI();
        save();
        if (mState.rightOpen !== wasRightOpen) onStageBoundsChanged();
    }

    function undockPanel(id) {
        const p = mPanels.get(id);
        if (!p || !p.docked) return;
        mUserTouched = true;
        p.docked = false;
        if (!mState.undocked.includes(id)) mState.undocked.push(id);
        const w = Math.min(340, Math.max(240, (globalThis.innerWidth || 1280) - 40));
        const left = Math.max(16, (globalThis.innerWidth || 1280) - (mState.rightOpen ? mState.rightWidth : 0) - w - 16);
        p.window.undock({ left: left + 'px', top: '76px', width: w + 'px', height: '420px' });
        syncDockUI();
        save();
        onStageBoundsChanged();
    }

    function redockPanel(id) {
        const p = mPanels.get(id);
        if (!p || p.docked) return;
        mUserTouched = true;
        dockPanelInternal(p);
        mState.rightOpen = true;
        mState.activeTab = id;
        syncDockUI();
        save();
        onStageBoundsChanged();
    }

    function setRightOpen(open) {
        mUserTouched = true;
        mState.rightOpen = !!open;
        syncDockUI();
        save();
        onStageBoundsChanged();
    }

    function toggleRight() {
        setRightOpen(!mState.rightOpen);
    }

    function setSplitOpen(open) {
        mUserTouched = true;
        const ids = dockedIds();
        mState.splitOpen = !!open && ids.length >= 2;
        if (mState.splitOpen && (!mState.splitTab || mState.splitTab === mState.activeTab)) {
            mState.splitTab = ids.find(id => id !== mState.activeTab) || null;
        }
        syncDockUI();
        save();
    }

    function setSplitTab(id) {
        if (!mPanels.get(id)?.docked || id === mState.activeTab) return;
        mUserTouched = true;
        mState.splitTab = id;
        mState.splitOpen = true;
        syncDockUI();
        save();
    }

    /** Dock a Samples ImageSelector InternalWindow into the bottom collapsible drawer. */
    function setBottomDrawer(win, { title = 'Samples', startOpen } = {}) {
        if (!win) return;
        mDrawerWindow = win;
        mHasDrawer = true;
        drawerTitle.textContent = title;
        if (saved == null && startOpen !== undefined) {
            mState.drawerOpen = !!startOpen && !mNarrow;
        }
        win.dockInto(drawerBody, {
            isVisible: () => mHasDrawer && mState.drawerOpen,
            onShow: () => setDrawerOpen(true),
            onHide: () => setDrawerOpen(false),
            onTitleChange: (t) => { drawerTitle.textContent = t; },
        });
        syncDockUI();
    }

    function setDrawerOpen(open) {
        if (!mHasDrawer) return;
        mState.drawerOpen = !!open;
        syncDockUI();
        save();
        onStageBoundsChanged();
    }

    function toggleDrawer() {
        setDrawerOpen(!mState.drawerOpen);
    }

    /**
     * Non-destructive layout reset: clears persisted dock/window geometry for
     * this app, redocks every floating panel and the canvas, and restores clean
     * defaults without touching document folders, IndexedDB, or theme.
     */
    function resetLayout(extraStorageIds = []) {
        removeKey(storageKey);
        const ids = [...extraStorageIds];
        for (const p of mPanels.values()) {
            if (p.storageId) ids.push(p.storageId);
        }
        if (mDrawerWindow?.storageId) ids.push(mDrawerWindow.storageId);
        resetWindowLayouts(ids);

        mUserTouched = false;
        Object.assign(mState, {
            ...defaults,
            rightOpen:      !mNarrow,
            drawerOpen:     !!arg.defaultDrawerOpen && !mNarrow,
            undocked:       [],
            canvasFloating: !!arg.defaultCanvasFloating,
            canvasRect:     null,
        });

        for (const p of mPanels.values()) {
            if (!p.docked) dockPanelInternal(p);
        }
        syncCanvasMode();
        syncDockUI();
        notifyStage();
    }

    // ── Drag Sashes, Floating Canvas Drag/Resize & Button Wiring ─────────────

    function dragSash(el, axis, startFn, moveFn, endFn) {
        el.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            const origin = axis === 'x' ? e.clientX : e.clientY;
            const startVal = startFn();
            el.classList.add(axis === 'x' ? 'studio-sash-v--dragging' :
                             el === splitSash ? 'studio-split-sash--dragging' : 'studio-drawer__sash--dragging');
            const onMove = (ev) => {
                const delta = (axis === 'x' ? ev.clientX : ev.clientY) - origin;
                moveFn(startVal, delta);
            };
            const onUp = () => {
                el.removeEventListener('pointermove', onMove);
                el.removeEventListener('pointerup', onUp);
                el.removeEventListener('pointercancel', onUp);
                el.classList.remove('studio-sash-v--dragging', 'studio-split-sash--dragging', 'studio-drawer__sash--dragging');
                if (endFn) endFn();
                save();
            };
            el.addEventListener('pointermove', onMove);
            el.addEventListener('pointerup', onUp);
            el.addEventListener('pointercancel', onUp);
            try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            e.preventDefault();
        });
    }

    function pointerDragCanvas(el, onDrag, ignoreSelector) {
        el.addEventListener('pointerdown', (e) => {
            if (!mState.canvasFloating) return;
            if (e.button !== undefined && e.button !== 0) return;
            if (ignoreSelector && e.target !== el && e.target.closest?.(ignoreSelector)) return;
            const x0 = e.clientX;
            const y0 = e.clientY;
            if (!mRenderedCanvasRect) applyCanvasRect();
            const start = mRenderedCanvasRect ? { ...mRenderedCanvasRect } : computeDefaultCanvasRect();
            canvasWin.classList.add('studio-canvas-win--dragging');
            const onMove = (ev) => {
                onDrag(start, ev.clientX - x0, ev.clientY - y0);
            };
            const onUp = () => {
                el.removeEventListener('pointermove', onMove);
                el.removeEventListener('pointerup', onUp);
                el.removeEventListener('pointercancel', onUp);
                canvasWin.classList.remove('studio-canvas-win--dragging');
                save();
            };
            el.addEventListener('pointermove', onMove);
            el.addEventListener('pointerup', onUp);
            el.addEventListener('pointercancel', onUp);
            try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            e.preventDefault();
        });
    }

    pointerDragCanvas(canvasHeader, (start, dx, dy) => {
        const { w: sw, h: sh } = stageSize();
        const maxLeft = sw > 0 ? Math.max(0, sw - start.width) : Infinity;
        const maxTop = sh > 0 ? Math.max(0, sh - start.height) : Infinity;
        const nextLeft = Math.round(Math.max(0, Math.min(maxLeft, start.left + dx)));
        const nextTop = Math.round(Math.max(0, Math.min(maxTop, start.top + dy)));
        mUserTouched = true;
        mState.canvasRect = {
            left:   nextLeft,
            top:    nextTop,
            width:  start.width,
            height: start.height,
        };
        applyCanvasRect();
    }, 'button');

    for (const [dir, handle] of Object.entries(canvasResizeHandles)) {
        pointerDragCanvas(handle, (start, dx, dy) => {
            const { w: sw, h: sh } = stageSize();
            const minW = sw > 0 ? Math.min(MIN_CANVAS_WIDTH, sw) : MIN_CANVAS_WIDTH;
            const minH = sh > 0 ? Math.min(MIN_CANVAS_HEIGHT, sh) : MIN_CANVAS_HEIGHT;
            const next = { ...start };
            if (dir.includes('e')) {
                const maxW = sw > 0 ? Math.max(minW, sw - start.left) : Infinity;
                next.width = Math.round(Math.max(minW, Math.min(maxW, start.width + dx)));
            }
            if (dir.includes('w')) {
                const right = start.left + start.width;
                const newLeft = Math.round(Math.max(0, Math.min(right - minW, start.left + dx)));
                next.left = newLeft;
                next.width = right - newLeft;
            }
            if (dir.includes('s')) {
                const maxH = sh > 0 ? Math.max(minH, sh - start.top) : Infinity;
                next.height = Math.round(Math.max(minH, Math.min(maxH, start.height + dy)));
            }
            if (dir.includes('n')) {
                const bottom = start.top + start.height;
                const newTop = Math.round(Math.max(0, Math.min(bottom - minH, start.top + dy)));
                next.top = newTop;
                next.height = bottom - newTop;
            }
            mUserTouched = true;
            mState.canvasRect = next;
            if (applyCanvasRect()) notifyStage();
        });
    }

    canvasDockBtn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
    });
    canvasDockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setCanvasFloating(false);
    });
    canvasHeader.addEventListener('dblclick', (e) => {
        if (!mState.canvasFloating) return;
        if (e.target.closest?.('button')) return;
        setCanvasFloating(false);
    });

    dragSash(rightSash, 'x', () => mState.rightWidth, (startW, dx) => {
        mState.rightWidth = Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, startW - dx));
        rightDock.style.width = mState.rightWidth + 'px';
        for (const p of mPanels.values()) if (p.docked) p.window.notifyResized();
        onStageBoundsChanged();
    });

    dragSash(splitSash, 'y', () => mState.splitRatio, (startR, dy) => {
        const h = rightBody.clientHeight || 400;
        mState.splitRatio = Math.max(0.2, Math.min(0.8, startR + dy / h));
        primaryPane.style.flex = `${mState.splitRatio} 1 0`;
        secondaryPane.style.flex = `${1 - mState.splitRatio} 1 0`;
        for (const p of mPanels.values()) if (p.docked) p.window.notifyResized();
    });

    dragSash(drawerSash, 'y', () => mState.drawerHeight, (startH, dy) => {
        mState.drawerHeight = Math.max(MIN_DRAWER_HEIGHT, Math.min(MAX_DRAWER_HEIGHT, startH - dy));
        drawer.style.height = mState.drawerHeight + 'px';
        onStageBoundsChanged();
    });

    splitBtn.addEventListener('click', () => setSplitOpen(!mState.splitOpen));
    undockBtn.addEventListener('click', () => { if (mState.activeTab) undockPanel(mState.activeTab); });
    collapseBtn.addEventListener('click', () => setRightOpen(false));
    splitSelect.addEventListener('change', () => setSplitTab(splitSelect.value));
    splitUndockBtn.addEventListener('click', () => { if (mState.splitTab) undockPanel(mState.splitTab); });
    splitCloseBtn.addEventListener('click', () => setSplitOpen(false));
    drawerCloseBtn.addEventListener('click', () => setDrawerOpen(false));

    // ── Responsive & Stage Resize Observers ──────────────────────────────────

    function updateNarrow(width) {
        const next = width > 0 && width < NARROW_BREAKPOINT;
        if (next === mNarrow) return;
        mNarrow = next;
        root.classList.toggle('studio-shell--narrow', mNarrow);
        if (mNarrow) {
            mState.rightOpen = false;
            mState.drawerOpen = false;
            // On phones / short viewports, use single-tab inspector instead of cramped top/bottom split
            if (width < 640 || (globalThis.innerHeight || 800) < 640) {
                mState.splitOpen = false;
            }
            syncDockUI();
            onStageBoundsChanged();
        } else {
            syncDockUI();
        }
    }

    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect?.width ?? globalThis.innerWidth ?? 1280;
            updateNarrow(w);
        }).observe(root);

        new ResizeObserver(() => {
            onStageBoundsChanged();
        }).observe(stage);
    }
    if (typeof globalThis.innerWidth === 'number') {
        updateNarrow(globalThis.innerWidth);
    }

    syncCanvasMode();
    syncDockUI();

    return {
        root,
        topBar,
        propertyBar,
        leftRail,
        stage,
        canvasHost,
        canvasWindow: canvasWin,
        statusBar,
        addPanel,
        activateTab,
        undockPanel,
        redockPanel,
        setRightOpen,
        toggleRight,
        isRightOpen:  () => mState.rightOpen && dockedIds().length > 0,
        setSplitOpen,
        isSplitOpen:  () => mState.splitOpen && dockedIds().length >= 2,
        setSplitTab,
        setBottomDrawer,
        setDrawerOpen,
        toggleDrawer,
        hasDrawer:    () => mHasDrawer,
        isDrawerOpen: () => mHasDrawer && mState.drawerOpen,
        setCanvasFloating,
        toggleCanvasFloating,
        isCanvasFloating: () => !!mState.canvasFloating,
        setCanvasRect,
        getCanvasRect: () => {
            const r = mState.canvasFloating ? (mRenderedCanvasRect || mState.canvasRect) : mState.canvasRect;
            return r ? { ...r } : null;
        },
        setCanvasTitle,
        setCanvasSizeLabel,
        isNarrow:     () => mNarrow,
        getPanels:    () => mPanelOrder.map(id => mPanels.get(id)),
        getState:     () => ({
            ...mState,
            undocked:   [...mState.undocked],
            canvasRect: mState.canvasRect ? { ...mState.canvasRect } : null,
        }),
        resetLayout,
    };
}
