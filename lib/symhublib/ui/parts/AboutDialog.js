//
//  AboutDialog.js: lightweight modal "About" dialog for StudioUI.
//  Shows the application / symmetry variant, the build Release ID (yy-mm-dd-hh-mm-ss)
//  with one-click copy, credits/links, and live runtime diagnostics (render size,
//  render quality, detected GPU tier) plus a shortcut to Global Options.
//

import {
    RELEASE_ID,
} from '../../modules.js';

const ICON_BRAND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">' +
    '<polygon points="12,2.5 20.5,7.5 20.5,16.5 12,21.5 3.5,16.5 3.5,7.5"/>' +
    '<path d="M12 2.5 V21.5 M3.5 7.5 L20.5 16.5 M20.5 7.5 L3.5 16.5" stroke-width="1.2" opacity="0.65"/>' +
    '<circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/></svg>';

const ABOUT_STYLE_ID = 'studio-about-inline-css';
const ABOUT_INLINE_CSS = `
.studio-btn--about { font-weight: 700; font-size: 13px; min-width: 26px; padding: 0 7px; touch-action: manipulation; }
.studio-about-backdrop {
  position: fixed; inset: 0; z-index: 10050;
  display: flex; align-items: center; justify-content: center; padding: 16px;
  background: rgba(12, 15, 22, 0.56); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
}
.studio-about {
  width: min(400px, calc(100vw - 24px)); max-height: calc(100dvh - 32px);
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
.studio-about__body { padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
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
`;

function ensureAboutStyles() {
    if (typeof document === 'undefined' || !document.head) return;
    if (document.getElementById(ABOUT_STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = ABOUT_STYLE_ID;
    st.textContent = ABOUT_INLINE_CSS;
    document.head.appendChild(st);
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
    if (info.adaptiveScale && info.adaptiveScale < 0.995) {
        return `${mode} (adaptive ${Math.round(info.adaptiveScale * 100)}%)`;
    }
    return mode;
}

function formatGpu(info) {
    const tier = info.tier || 'unknown';
    const renderer = (info.renderer || '').trim();
    if (!renderer) return tier;
    return `${tier} \u2014 ${renderer}`;
}

let activeDialog = null;

/**
 * Show (or refresh) the About modal dialog.
 * @param {object} host          SymRenderer host
 * @param {object} [opt]
 * @param {object} [opt.app]     APP_CATALOG app entry
 * @param {object} [opt.variant] APP_CATALOG variant entry
 * @param {string} [opt.homeUrl] Resolved URL back to SymmHub/Catalog home
 */
export function showAboutDialog(host, opt = {}) {
    ensureAboutStyles();
    if (activeDialog) {
        activeDialog.close();
    }

    const app = opt.app || null;
    const variant = opt.variant || null;
    const homeUrl = opt.homeUrl || '';
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

    // Prominent Release ID card
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
    copyBtn.textContent = 'Copy';
    copyBtn.title = 'Copy Release ID to clipboard';
    let copyTimer = null;
    copyBtn.addEventListener('click', () => {
        copyText(RELEASE_ID).then(() => {
            copyBtn.textContent = 'Copied';
            if (copyTimer) clearTimeout(copyTimer);
            copyTimer = setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
        });
    });

    relRow.append(relLabel, relCode, copyBtn);
    body.appendChild(relRow);

    // Runtime diagnostics (canvas size, render quality, GPU tier)
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
