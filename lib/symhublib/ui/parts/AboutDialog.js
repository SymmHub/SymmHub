//
//  AboutDialog.js: lightweight modal "About" dialog for StudioUI & SimpleUI (Explore).
//  Shows the application / symmetry variant, build Release ID (yy-mm-dd-hh-mm-ss),
//  live runtime & WebGL diagnostics, one-click "Copy Info" (full problem-reporting
//  clipboard block with Release ID, browser, WebGL version/renderer/limits, GPU tier,
//  canvas resolution, and frame timing), links, and a shortcut to Global Options.
//

import {
    APP_CATALOG,
    RELEASE_ID,
} from '../../modules.js';

// Resolve repo root from lib/symhublib/ui/parts/AboutDialog.js so links work at any mount path
const REPO_ROOT = new URL('../../../../', import.meta.url);

const ICON_BRAND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">' +
    '<polygon points="12,2.5 20.5,7.5 20.5,16.5 12,21.5 3.5,16.5 3.5,7.5"/>' +
    '<path d="M12 2.5 V21.5 M3.5 7.5 L20.5 16.5 M20.5 7.5 L3.5 16.5" stroke-width="1.2" opacity="0.65"/>' +
    '<circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/></svg>';

const ABOUT_STYLE_ID = 'studio-about-inline-css';
const ABOUT_INLINE_CSS = `
.studio-btn--about { font-weight: 700; font-size: 13px; min-width: 26px; padding: 0 7px; touch-action: manipulation; }
.simple-about-btn {
  position: absolute; top: 8px; right: 8px; z-index: 20;
  width: 32px; height: 32px; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 8px;
  border: 1px solid var(--border-strong, rgba(24,28,34,0.26));
  background: var(--bg-nav, rgba(245,246,248,0.88));
  color: var(--text-primary, #181c22);
  font: 700 15px/1 var(--font-sans, system-ui, sans-serif);
  cursor: pointer; touch-action: manipulation;
  box-shadow: 0 2px 6px rgba(0,0,0,0.16);
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
}
.simple-about-btn:hover {
  background: var(--bg-hover, #e8ecf1);
  border-color: var(--accent, #0969da);
  color: var(--accent, #0969da);
}
@media (pointer: coarse) {
  .simple-about-btn { width: 38px; height: 38px; font-size: 16px; }
}
.studio-about-backdrop {
  position: fixed; inset: 0; z-index: 10050;
  display: flex; align-items: center; justify-content: center; padding: 16px;
  background: rgba(12, 15, 22, 0.56); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
}
.studio-about {
  width: min(430px, calc(100vw - 24px)); max-height: calc(100dvh - 32px);
  display: flex; flex-direction: column;
  background: var(--bg-panel, #f9f9f9); color: var(--text-primary, #181c22);
  border: 1px solid var(--border-strong, rgba(24,28,34,0.26));
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-popup, 0 6px 20px rgba(0,0,0,0.22));
  overflow: hidden; font-family: var(--font-sans, system-ui, sans-serif);
}
.studio-about__head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 12px 14px; background: var(--bg-elevated, #ffffff);
  border-bottom: 1px solid var(--border-subtle, rgba(24,28,34,0.12));
}
.studio-about__title-wrap { display: flex; align-items: center; gap: 10px; min-width: 0; }
.studio-about__title-wrap svg { width: 22px; height: 22px; color: var(--accent, #0969da); flex-shrink: 0; }
.studio-about__title { margin: 0; font-size: 14.5px; font-weight: 700; line-height: 1.25; color: var(--text-primary, #181c22); }
.studio-about__sub { font-size: 11.5px; color: var(--text-muted, #687280); line-height: 1.3; }
.studio-about__close {
  width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid transparent; border-radius: var(--radius-sm, 4px);
  background: transparent; color: var(--text-secondary, #4a525e);
  font-size: 19px; line-height: 1; cursor: pointer; flex-shrink: 0; touch-action: manipulation;
}
.studio-about__close:hover { background: var(--bg-hover, #e8ecf1); color: var(--text-primary, #181c22); }
.studio-about__body { padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 11px; }
.studio-about__desc { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--text-secondary, #4a525e); }
.studio-about__release {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  background: var(--bg-elevated, #ffffff);
  border: 1px solid var(--border-subtle, rgba(24,28,34,0.12));
  border-radius: var(--radius-md, 8px);
}
.studio-about__release-lbl {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-muted, #687280); white-space: nowrap;
}
.studio-about__release-id {
  flex: 1 1 auto; min-width: 0; font-family: var(--font-mono, monospace);
  font-size: 13px; font-weight: 600; color: var(--text-primary, #181c22);
  user-select: all; overflow-wrap: anywhere;
}
.studio-about__copy-hint {
  margin: -5px 0 0; font-size: 11px; color: var(--text-muted, #687280);
}
.studio-about__meta { margin: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; font-size: 11.5px; line-height: 1.4; }
.studio-about__meta dt { color: var(--text-muted, #687280); font-weight: 600; white-space: nowrap; }
.studio-about__meta dd { margin: 0; color: var(--text-secondary, #4a525e); font-family: var(--font-mono, monospace); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.studio-about__links { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; }
.studio-about__links a { color: var(--accent, #0969da); text-decoration: none; }
.studio-about__links a:hover { color: var(--accent-hover, #0550ae); text-decoration: underline; }
.studio-about__foot {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 10px 14px;
  background: var(--bg-input, #eceef2);
  border-top: 1px solid var(--border-subtle, rgba(24,28,34,0.12));
}
.studio-about .studio-panel-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  height: 28px; padding: 0 10px;
  border: 1px solid var(--border-strong, rgba(24,28,34,0.26));
  border-radius: var(--radius-sm, 4px);
  background: var(--bg-elevated, #ffffff); color: var(--text-primary, #181c22);
  font: 600 11.5px/1 var(--font-sans, system-ui, sans-serif);
  cursor: pointer; white-space: nowrap; touch-action: manipulation;
}
.studio-about .studio-panel-btn--primary {
  background: var(--accent, #0969da); border-color: var(--accent, #0969da);
  color: var(--text-inverse, #ffffff);
}
`;

export function ensureAboutStyles() {
    if (typeof document === 'undefined' || !document.head) return;
    if (document.getElementById(ABOUT_STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = ABOUT_STYLE_ID;
    st.textContent = ABOUT_INLINE_CSS;
    document.head.appendChild(st);
}

function samePath(relPath) {
    try {
        return new URL(relPath, REPO_ROOT).pathname === window.location.pathname;
    } catch (_) {
        return false;
    }
}

export function resolveAppInfo() {
    let app = null;
    let variant = null;
    if (APP_CATALOG && Array.isArray(APP_CATALOG.apps)) {
        for (const a of APP_CATALOG.apps) {
            const variants = [...(a.variants || []), ...(a.devVariants || [])];
            for (const v of variants) {
                if ((v.page && samePath(v.page)) || (v.thumbPage && samePath(v.thumbPage))) {
                    app = a;
                    variant = v;
                    break;
                }
            }
            if (app) break;
            if (a.index && samePath(a.index)) {
                app = a;
                break;
            }
        }
    }
    let homeUrl = '';
    try {
        if (APP_CATALOG && APP_CATALOG.home) homeUrl = new URL(APP_CATALOG.home, REPO_ROOT).href;
    } catch (_) { /* ignore */ }
    return { app, variant, homeUrl };
}

function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
    } catch (_) { /* ignore */ }
}

function formatQuality(info) {
    const mode = info.renderQuality || 'auto';
    const parts = [mode];
    if (info.liveScale && info.liveScale < 0.995) {
        parts.push(`scale ${Math.round(info.liveScale * 100)}%`);
    }
    if (info.adaptiveScale && info.adaptiveScale < 0.995) {
        parts.push(`adaptive ${Math.round(info.adaptiveScale * 100)}%`);
    }
    if (info.avgFrameMs > 0) {
        parts.push(`~${Math.round(info.estFps)} FPS (${Math.round(info.avgFrameMs)} ms)`);
    }
    return parts.join(' \u00B7 ');
}

function formatGpu(info) {
    const tier = info.tier || 'unknown';
    const renderer = (info.renderer || '').trim();
    if (!renderer) return `${tier} (${info.reason || 'masked'})`;
    return `${tier} \u2014 ${renderer}`;
}

function cleanPageUrl() {
    try {
        const u = new URL(window.location.href);
        return u.origin + u.pathname + u.search;
    } catch (_) {
        return '';
    }
}

/**
 * Build a multi-line plain-text diagnostic block suitable for pasting into bug reports.
 */
export function formatDiagnosticsReport(host, opt = {}) {
    const app = opt.app || null;
    const variant = opt.variant || null;
    const appTitle = app ? `SymmHub · ${app.title}` : 'SymmHub';
    const variantLabel = variant && variant.label ? ` (${variant.label})` : '';
    const uiMode = opt.uiMode || (() => {
        try { return new URLSearchParams(window.location.search).get('ui') || 'studio'; } catch (_) { return 'unknown'; }
    })();

    let info = null;
    try {
        if (host && typeof host.getRuntimeInfo === 'function') info = host.getRuntimeInfo();
    } catch (_) {
        info = null;
    }

    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const scr = typeof screen !== 'undefined' ? screen : {};
    const coarse = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ? 'coarse' : 'fine';
    const cores = nav.hardwareConcurrency ? String(nav.hardwareConcurrency) : 'n/a';
    const mem = nav.deviceMemory ? `${nav.deviceMemory} GB` : 'n/a';
    const touch = typeof nav.maxTouchPoints === 'number' ? String(nav.maxTouchPoints) : 'n/a';
    const dpr = (info && info.dpr) || (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;

    const lines = [
        '=== SymmHub / SymDraw Diagnostics ===',
        `App:              ${appTitle}${variantLabel}`,
        `UI Mode:          ${uiMode}`,
        `Release ID:       ${RELEASE_ID}`,
        `Timestamp:        ${new Date().toISOString()}`,
        `Page URL:         ${cleanPageUrl()}`,
        `Browser UA:       ${nav.userAgent || 'n/a'}`,
        `Platform:         ${nav.platform || 'n/a'} | Cores: ${cores} | Memory: ${mem} | Touch: ${touch} | Pointer: ${coarse}`,
        `Screen / View:    ${scr.width || '?'}x${scr.height || '?'} | Viewport: ${window.innerWidth || '?'}x${window.innerHeight || '?'} | DPR: ${Number(dpr).toFixed(2).replace(/\.00$/, '')}`,
    ];

    if (info) {
        const livePct = Math.round((info.liveScale || 1) * 100);
        const adapPct = Math.round((info.adaptiveScale || 1) * 100);
        lines.push(`Canvas Render:    ${info.canvasWidth}x${info.canvasHeight} px (${info.cssWidth}x${info.cssHeight} CSS) | Live scale: ${livePct}% | Adaptive: ${adapPct}%`);
        lines.push(`Render Quality:   ${info.renderQuality || 'auto'} | Tier: ${info.tier || 'unknown'} (${info.reason || 'n/a'})`);
        if (info.avgFrameMs > 0) {
            lines.push(`Frame Timing:     ${info.avgFrameMs.toFixed(1)} ms avg (~${info.estFps.toFixed(1)} FPS) | Last: ${info.lastFrameMs.toFixed(1)} ms | Frames: ${info.renderedFrames || 0}`);
        } else {
            lines.push(`Frame Timing:     n/a (Frames rendered: ${info.renderedFrames || 0})`);
        }
        const gl = info.webgl || {};
        lines.push(`WebGL Context:    ${gl.webglVersion || 'unavailable'}${gl.version ? ' (' + gl.version + ')' : ''}`);
        if (gl.shadingLanguageVersion) lines.push(`GLSL Version:     ${gl.shadingLanguageVersion}`);
        lines.push(`GL Vendor:        ${gl.vendor || 'n/a'}`);
        lines.push(`GL Renderer:      ${gl.renderer || 'n/a'}`);
        lines.push(`Unmasked Vendor:  ${gl.unmaskedVendor || '(masked / unavailable)'}`);
        lines.push(`Unmasked GPU:     ${gl.unmaskedRenderer || '(masked / unavailable)'}`);
        const vp = Array.isArray(gl.maxViewportDims) ? `${gl.maxViewportDims[0]}x${gl.maxViewportDims[1]}` : 'n/a';
        lines.push(`GL Limits:        MAX_TEXTURE_SIZE=${gl.maxTextureSize || 'n/a'} | MAX_VIEWPORT=${vp} | MAX_RB=${gl.maxRenderbufferSize || 'n/a'}`);
    }

    return lines.join('\n');
}

let activeDialog = null;

/**
 * Show (or refresh) the About modal dialog.
 * @param {object} host          SymRenderer host
 * @param {object} [opt]
 * @param {object} [opt.app]     APP_CATALOG app entry
 * @param {object} [opt.variant] APP_CATALOG variant entry
 * @param {string} [opt.homeUrl] Resolved URL back to SymmHub/Catalog home
 * @param {string} [opt.uiMode]  'studio' | 'simple' | ...
 */
export function showAboutDialog(host, opt = {}) {
    ensureAboutStyles();
    if (activeDialog) {
        activeDialog.close();
    }

    const fallbackInfo = (!opt.app && !opt.homeUrl) ? resolveAppInfo() : {};
    const app = opt.app || fallbackInfo.app || null;
    const variant = opt.variant || fallbackInfo.variant || null;
    const homeUrl = opt.homeUrl || fallbackInfo.homeUrl || '';
    const appTitle = app ? `SymmHub \u00B7 ${app.title}` : 'SymmHub';
    const variantLabel = variant && variant.label ? variant.label : (app && app.subtitle ? app.subtitle : '');
    let info = null;
    try {
        if (host && typeof host.getRuntimeInfo === 'function') info = host.getRuntimeInfo();
    } catch (_) {
        info = null;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'studio-about-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'studio-about-title');

    const card = document.createElement('div');
    card.className = 'studio-about';

    // ── Header ───────────────────────────────────────────────────────────────
    const head = document.createElement('div');
    head.className = 'studio-about__head';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'studio-about__title-wrap';
    titleWrap.insertAdjacentHTML('beforeend', ICON_BRAND);

    const titleBox = document.createElement('div');
    const titleEl = document.createElement('h2');
    titleEl.id = 'studio-about-title';
    titleEl.className = 'studio-about__title';
    titleEl.textContent = appTitle;
    titleBox.appendChild(titleEl);
    if (variantLabel) {
        const subEl = document.createElement('div');
        subEl.className = 'studio-about__sub';
        subEl.textContent = variantLabel;
        titleBox.appendChild(subEl);
    }
    titleWrap.appendChild(titleBox);

    const closeX = document.createElement('button');
    closeX.type = 'button';
    closeX.className = 'studio-about__close';
    closeX.title = 'Close (Esc)';
    closeX.setAttribute('aria-label', 'Close About dialog');
    closeX.textContent = '\u00D7';

    head.append(titleWrap, closeX);

    // ── Body ─────────────────────────────────────────────────────────────────
    const body = document.createElement('div');
    body.className = 'studio-about__body';

    const desc = document.createElement('p');
    desc.className = 'studio-about__desc';
    desc.textContent = 'Interactive symmetry drawing and pattern visualization studio by Vladimir Bulatov.';
    body.appendChild(desc);

    // Prominent Release ID card + full diagnostic Copy Info button
    const relRow = document.createElement('div');
    relRow.className = 'studio-about__release';

    const relLabel = document.createElement('span');
    relLabel.className = 'studio-about__release-lbl';
    relLabel.textContent = 'Release ID';

    const relCode = document.createElement('code');
    relCode.className = 'studio-about__release-id';
    relCode.dataset.releaseId = RELEASE_ID;
    relCode.textContent = RELEASE_ID;

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'studio-panel-btn';
    copyBtn.textContent = 'Copy Info';
    copyBtn.title = 'Copy Release ID, browser, WebGL, GPU, and render diagnostics to clipboard';

    const copyHint = document.createElement('div');
    copyHint.className = 'studio-about__copy-hint';
    copyHint.textContent = 'Copy Info puts Release ID, browser, WebGL, GPU & render stats on clipboard.';

    let copyTimer = null;
    copyBtn.addEventListener('click', () => {
        const report = formatDiagnosticsReport(host, { app, variant, uiMode: opt.uiMode });
        copyText(report).then(() => {
            copyBtn.textContent = 'Copied!';
            copyHint.textContent = 'Full diagnostics copied to clipboard \u2014 paste into a bug report.';
            if (copyTimer) clearTimeout(copyTimer);
            copyTimer = setTimeout(() => {
                copyBtn.textContent = 'Copy Info';
                copyHint.textContent = 'Copy Info puts Release ID, browser, WebGL, GPU & render stats on clipboard.';
            }, 2200);
        });
    });

    relRow.append(relLabel, relCode, copyBtn);
    body.append(relRow, copyHint);

    // Runtime diagnostics (canvas size, render quality, GPU tier, WebGL)
    if (info) {
        const dl = document.createElement('dl');
        dl.className = 'studio-about__meta';

        const addRow = (k, v, title) => {
            const dt = document.createElement('dt');
            dt.textContent = k;
            const dd = document.createElement('dd');
            dd.textContent = v;
            if (title) dd.title = title;
            dl.append(dt, dd);
        };

        const dprText = info.dpr ? ` \u00B7 DPR ${Number(info.dpr).toFixed(2).replace(/\.00$/, '')}` : '';
        const cssText = (info.cssWidth && info.cssHeight) ? ` (${info.cssWidth}\u00D7${info.cssHeight} CSS)` : '';
        addRow('Render', `${info.canvasWidth}\u00D7${info.canvasHeight} px${cssText}${dprText}`);
        addRow('Quality', formatQuality(info));
        const gpuText = formatGpu(info);
        addRow('GPU', gpuText, info.renderer || gpuText);
        if (info.webgl && info.webgl.webglVersion) {
            const glSummary = info.webgl.maxTextureSize
                ? `${info.webgl.webglVersion} \u00B7 max tex ${info.webgl.maxTextureSize}`
                : info.webgl.webglVersion;
            addRow('WebGL', glSummary, info.webgl.version || glSummary);
        }

        body.appendChild(dl);
    }

    // Links
    const links = document.createElement('div');
    links.className = 'studio-about__links';
    if (homeUrl) {
        const homeLink = document.createElement('a');
        homeLink.href = homeUrl;
        homeLink.textContent = 'Home / Catalog';
        links.appendChild(homeLink);
    }
    const ghLink = document.createElement('a');
    ghLink.href = 'https://github.com/vbulatov2011/SymmHub';
    ghLink.target = '_blank';
    ghLink.rel = 'noopener noreferrer';
    ghLink.textContent = 'GitHub (SymmHub)';
    links.appendChild(ghLink);
    body.appendChild(links);

    // ── Footer ───────────────────────────────────────────────────────────────
    const foot = document.createElement('div');
    foot.className = 'studio-about__foot';

    if (host && typeof host.openGlobalOptions === 'function') {
        const optsBtn = document.createElement('button');
        optsBtn.type = 'button';
        optsBtn.className = 'studio-panel-btn';
        optsBtn.textContent = 'Global Options\u2026';
        optsBtn.title = 'Open Global Options (Render Quality, export settings)';
        optsBtn.addEventListener('click', () => {
            close();
            host.openGlobalOptions();
        });
        foot.appendChild(optsBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'studio-panel-btn studio-panel-btn--primary';
    closeBtn.textContent = 'Close';
    foot.appendChild(closeBtn);

    card.append(head, body, foot);
    backdrop.appendChild(card);

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            close();
        }
    }

    function close() {
        if (copyTimer) clearTimeout(copyTimer);
        window.removeEventListener('keydown', onKeyDown, true);
        backdrop.remove();
        if (activeDialog && activeDialog.backdrop === backdrop) {
            activeDialog = null;
        }
    }

    let downInsideCard = false;
    closeX.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('pointerdown', (e) => { downInsideCard = (e.target !== backdrop); });
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop && !downInsideCard) close();
        downInsideCard = false;
    });
    window.addEventListener('keydown', onKeyDown, true);

    document.body.appendChild(backdrop);
    try { closeBtn.focus({ preventScroll: true }); } catch (_) {}

    activeDialog = { backdrop, close };
    return activeDialog;
}
