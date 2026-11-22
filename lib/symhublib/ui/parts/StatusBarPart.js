//
//  StatusBarPart.js: slim bottom status bar for StudioUI.
//  Mounts into DockShell.statusBar and shows:
//   - Left: full-width active tool hint (never clipped to a narrow floating box)
//   - Right: live symmetry symbol pill, view width w, cursor world (x, y),
//            live FPS / simulation status while animating, and Samples drawer toggle
//

function toolHint(tool) {
    if (!tool) return '';
    return tool.getHint ? tool.getHint() : (tool.help || tool.title || '');
}

function formatNum(x, digits = 3) {
    if (!Number.isFinite(x)) return '';
    const ax = Math.abs(x);
    if (ax > 0 && (ax < 1e-3 || ax >= 1e5)) return x.toExponential(2);
    return x.toFixed(digits);
}

function formatWidth(w) {
    if (!Number.isFinite(w) || w <= 0) return '';
    if (w < 0.001 || w >= 10000) return `w ${w.toExponential(2)}`;
    if (w >= 100) return `w ${w.toFixed(1)}`;
    if (w >= 10)  return `w ${w.toFixed(2)}`;
    return `w ${w.toFixed(3)}`;
}

function readSymmetryLabel(host) {
    const sym = host.getSymmetryParams ? host.getSymmetryParams() : null;
    if (!sym) return '';
    const family = sym.groupType?.getValue ? sym.groupType.getValue() : '';
    let val = null;
    try {
        val = sym.group?.getValue ? sym.group.getValue() : null;
    } catch (e) {
        val = null;
    }
    const p = (val && val.params && typeof val.params === 'object') ? val.params : val;
    if (p && typeof p === 'object') {
        if (typeof p.type === 'string' && p.type) {
            return family ? `${family} · ${p.type}` : p.type;
        }
        if ('K' in p && 'L' in p && 'M' in p) {
            const star = p.s ? '*' : '';
            const tuple = ('N' in p)
                ? `${p.K},${p.L},${p.M},${p.N}`
                : `${p.K},${p.L},${p.M}`;
            return family ? `${family} · ${star}${tuple}` : `${star}${tuple}`;
        }
        if ('order' in p) {
            return family ? `${family} · ${p.order}` : String(p.order);
        }
    }
    return family || '';
}

/**
 * @param {object} host
 * @param {object} opt
 * @param {object} opt.shell   DockShell instance
 */
export function createStatusBarPart(host, opt = {}) {
    const shell = opt.shell;
    const container = shell.statusBar;
    container.replaceChildren();

    const hintEl = document.createElement('span');
    hintEl.className = 'studio-status__hint';

    const metricsEl = document.createElement('div');
    metricsEl.className = 'studio-status__metrics';

    const symBtn = document.createElement('button');
    symBtn.type = 'button';
    symBtn.className = 'studio-status__pill';
    symBtn.style.border = '0';
    symBtn.style.cursor = 'pointer';
    symBtn.title = 'Active symmetry group (click to open Symmetry tab)';
    symBtn.addEventListener('pointerdown', (e) => e.preventDefault());
    symBtn.addEventListener('click', () => {
        if (shell.getPanels().some(p => p.id === 'symmetry')) {
            shell.activateTab('symmetry');
        }
    });

    const zoomEl = document.createElement('span');
    zoomEl.className = 'studio-status__zoom';
    zoomEl.title = 'View width in world units (2 / zoom)';

    const coordsEl = document.createElement('span');
    coordsEl.className = 'studio-status__coords';
    coordsEl.title = 'Pointer world coordinates (x, y)';

    const fpsEl = document.createElement('span');
    fpsEl.className = 'studio-status__pill studio-status__fps';
    fpsEl.style.display = 'none';

    const samplesBtn = document.createElement('button');
    samplesBtn.type = 'button';
    samplesBtn.className = 'studio-status__btn';
    samplesBtn.title = 'Show or hide bottom Samples drawer';
    samplesBtn.addEventListener('pointerdown', (e) => e.preventDefault());
    samplesBtn.addEventListener('click', () => shell.toggleDrawer());

    metricsEl.append(symBtn, zoomEl, coordsEl, fpsEl, samplesBtn);
    container.append(hintEl, metricsEl);

    // ── Updaters ─────────────────────────────────────────────────────────────

    function updateHint() {
        const text = toolHint(host.getActiveTool());
        hintEl.textContent = text;
        hintEl.title = text;
    }

    let lastSymText = null;
    function updateSymmetry() {
        const text = readSymmetryLabel(host);
        if (text === lastSymText) return;
        lastSymText = text;
        symBtn.textContent = text;
        symBtn.style.display = text ? '' : 'none';
    }

    function updateZoom() {
        const nav = host.getNavigator ? host.getNavigator() : null;
        const zoom = nav && nav.getZoom ? nav.getZoom() : NaN;
        const text = (Number.isFinite(zoom) && zoom > 0) ? formatWidth(2 / zoom) : '';
        zoomEl.textContent = text;
        zoomEl.style.display = text ? '' : 'none';
    }

    function updateSamplesButton() {
        const has = shell.hasDrawer();
        samplesBtn.style.display = has ? '' : 'none';
        if (!has) return;
        const open = shell.isDrawerOpen();
        samplesBtn.textContent = open ? 'Samples \u25BE' : 'Samples \u25B4';
        samplesBtn.classList.toggle('studio-status__btn--on', open);
        samplesBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
    }

    // ── Pointer World Coordinates (rAF throttled) ────────────────────────────

    const overlay = host.canvas && host.canvas.overlay;
    let pendingMove = null;
    let rafId = 0;

    function flushCoords() {
        rafId = 0;
        if (!pendingMove || !overlay) return;
        const ev = pendingMove;
        pendingMove = null;
        const rect = overlay.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const [cw, ch] = host.view.canvasSize();
        const cx = (ev.clientX - rect.left) * (cw / rect.width);
        const cy = (ev.clientY - rect.top) * (ch / rect.height);
        try {
            const res = host.view.toWorld([cx, cy]);
            const p = res && res.pnt;
            if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
                coordsEl.textContent = `(${formatNum(p[0], 3)}, ${formatNum(p[1], 3)})`;
                return;
            }
        } catch (e) { /* view not ready */ }
        coordsEl.textContent = '';
    }

    if (overlay) {
        overlay.addEventListener('pointermove', (ev) => {
            pendingMove = ev;
            if (!rafId) rafId = requestAnimationFrame(flushCoords);
        });
        overlay.addEventListener('pointerleave', () => {
            pendingMove = null;
            if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
            coordsEl.textContent = '';
        });
    }

    // ── Throttled View Width & Live FPS / Symmetry Tracking ──────────────────

    let viewTimer = 0;
    host.addEventListener('viewChanged', () => {
        if (viewTimer) return;
        viewTimer = setTimeout(() => {
            viewTimer = 0;
            updateZoom();
        }, 100);
    });

    let fpsFrames = 0;
    let fpsStamp = performance.now();
    let lastSymCheck = 0;

    function updateFpsBadge(fpsText) {
        const pattern = host.getPattern ? host.getPattern() : null;
        const extra = (pattern && pattern.getStatusText) ? pattern.getStatusText() : '';
        const parts = [fpsText, extra].filter(Boolean);
        if (parts.length) {
            fpsEl.textContent = parts.join(' · ');
            fpsEl.style.display = '';
        } else {
            fpsEl.style.display = 'none';
        }
    }

    host.addEventListener('frameRendered', () => {
        const now = performance.now();
        if (now - lastSymCheck > 400) {
            lastSymCheck = now;
            updateSymmetry();
        }
        if (!host.isRunning()) return;
        fpsFrames++;
        const dt = now - fpsStamp;
        if (dt >= 500) {
            const fps = Math.round((fpsFrames * 1000) / dt);
            fpsFrames = 0;
            fpsStamp = now;
            updateFpsBadge(`${fps} fps`);
        }
    });

    host.addEventListener('runChanged', (e) => {
        fpsFrames = 0;
        fpsStamp = performance.now();
        if (!e?.running) updateFpsBadge('');
    });

    host.addEventListener('toolChanged', () => { updateHint(); updateSymmetry(); });
    host.addEventListener('toolHintChanged', updateHint);
    host.addEventListener('toolStateChanged', updateSymmetry);
    host.addEventListener('toolBarRefresh', updateSymmetry);
    host.addEventListener('titleChanged', () => { updateSymmetry(); updateZoom(); });

    function refresh() {
        updateHint();
        updateSymmetry();
        updateZoom();
        updateSamplesButton();
        if (!host.isRunning()) updateFpsBadge('');
    }

    refresh();

    return {
        refresh,
    };
}
