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
    if (activeDialog) {
        activeDialog.close();
    }

    const app = opt.app || null;
    const variant = opt.variant || null;
    const homeUrl = opt.homeUrl || '';
    const appTitle = app ? `SymmHub \u00B7 ${app.title}` : 'SymmHub';
    const variantLabel = variant && variant.label ? variant.label : (app && app.subtitle ? app.subtitle : '');
    const info = (host && typeof host.getRuntimeInfo === 'function') ? host.getRuntimeInfo() : null;

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

    closeX.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close();
    });
    window.addEventListener('keydown', onKeyDown, true);

    document.body.appendChild(backdrop);
    closeBtn.focus();

    activeDialog = { backdrop, close };
    return activeDialog;
}
