/**
 * DockShell.js
 *
 * Full-viewport docked workspace container for StudioUI:
 *  - topBar, propertyBar, leftRail, central stage (canvasHost),
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

/**
 * @param {object}   arg
 * @param {HTMLElement} [arg.parent]            where to append shell (default document.body)
 * @param {string}   [arg.storagePrefix]        per-app localStorage prefix (e.g. host.storageKey('studio'))
 * @param {string}   [arg.defaultTab]           initial primary tab id
 * @param {string}   [arg.defaultSplitTab]      initial secondary split tab id (enables split by default when set)
 * @param {boolean}  [arg.defaultDrawerOpen]    initial bottom drawer visibility when no saved state exists
 * @param {Function} [arg.onStageResize]        called when central stage changes size
 * @param {Function} [arg.onLayoutChange]       called when dock/drawer open state or tabs change
 */
export function createDockShell(arg = {}) {
    const parent = arg.parent || document.body;
    const storageKey = arg.storagePrefix ? arg.storagePrefix + '_layout' : null;
    const saved = readJson(storageKey);

    const defaults = {
        rightOpen:    true,
        rightWidth:   DEFAULT_RIGHT_WIDTH,
        activeTab:    arg.defaultTab || null,
        splitOpen:    !!arg.defaultSplitTab,
        splitTab:     arg.defaultSplitTab || null,
        splitRatio:   0.52,
        drawerOpen:   !!arg.defaultDrawerOpen,
        drawerHeight: DEFAULT_DRAWER_HEIGHT,
        undocked:     [],
    };

    const mState = {
        ...defaults,
        ...(saved && typeof saved === 'object' ? saved : {}),
        undocked: Array.isArray(saved?.undocked) ? [...saved.undocked] : [],
    };

    // Registered panels: Map<id, { id, label, title, window, storageId, docked, onShow }>
    const mPanels = new Map();
    const mPanelOrder = [];
    let mDrawerWindow = null;
    let mNarrow = false;
    let mHasDrawer = false;
    let mUserTouched = saved != null;

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

    middle.append(leftRail, stage, rightWrap);

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
            rightOpen:    mState.rightOpen,
            rightWidth:   mState.rightWidth,
            activeTab:    mState.activeTab,
            splitOpen:    mState.splitOpen,
            splitTab:     mState.splitTab,
            splitRatio:   mState.splitRatio,
            drawerOpen:   mState.drawerOpen,
            drawerHeight: mState.drawerHeight,
            undocked:     mState.undocked,
        });
    }

    function notifyLayout() {
        if (arg.onLayoutChange) arg.onLayoutChange();
    }

    function notifyStage() {
        if (arg.onStageResize) arg.onStageResize();
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
                notifyStage();
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
                notifyStage();
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
        if (mState.rightOpen !== wasRightOpen) notifyStage();
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
        notifyStage();
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
        notifyStage();
    }

    function setRightOpen(open) {
        mUserTouched = true;
        mState.rightOpen = !!open;
        syncDockUI();
        save();
        notifyStage();
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
        notifyStage();
    }

    function toggleDrawer() {
        setDrawerOpen(!mState.drawerOpen);
    }

    /**
     * Non-destructive layout reset: clears persisted dock/window geometry for
     * this app, redocks every floating panel, and restores clean defaults
     * without touching document folders, IndexedDB, or theme.
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
            rightOpen:  !mNarrow,
            drawerOpen: !!arg.defaultDrawerOpen && !mNarrow,
            undocked:   [],
        });

        for (const p of mPanels.values()) {
            if (!p.docked) dockPanelInternal(p);
        }
        syncDockUI();
        notifyStage();
    }

    // ── Drag Sashes & Button Wiring ──────────────────────────────────────────

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

    dragSash(rightSash, 'x', () => mState.rightWidth, (startW, dx) => {
        mState.rightWidth = Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, startW - dx));
        rightDock.style.width = mState.rightWidth + 'px';
        for (const p of mPanels.values()) if (p.docked) p.window.notifyResized();
        notifyStage();
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
        notifyStage();
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
            syncDockUI();
        }
    }

    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect?.width ?? globalThis.innerWidth ?? 1280;
            updateNarrow(w);
        }).observe(root);

        new ResizeObserver(() => {
            notifyStage();
        }).observe(stage);
    } else if (typeof globalThis.innerWidth === 'number') {
        updateNarrow(globalThis.innerWidth);
    }

    syncDockUI();

    return {
        root,
        topBar,
        propertyBar,
        leftRail,
        stage,
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
        isNarrow:     () => mNarrow,
        getPanels:    () => mPanelOrder.map(id => mPanels.get(id)),
        getState:     () => ({ ...mState, undocked: [...mState.undocked] }),
        resetLayout,
    };
}
