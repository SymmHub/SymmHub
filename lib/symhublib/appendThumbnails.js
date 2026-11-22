import { APP_CATALOG } from './ui/AppCatalog.js';

const THEME_KEY = 'symmhub_theme';
const THEME_MODES = ['light', 'dark', 'system'];
const THEME_LABELS = {
    light:  { icon: '\u2600', text: 'Light',  title: 'Theme: Light (click for Dark)' },
    dark:   { icon: '\u263E', text: 'Dark',   title: 'Theme: Dark (click for System)' },
    system: { icon: '\u25D0', text: 'System', title: 'Theme: System (click for Light)' },
};

function readThemeMode() {
    try {
        const v = localStorage.getItem(THEME_KEY);
        return THEME_MODES.includes(v) ? v : 'light';
    } catch (e) {
        return 'light';
    }
}

function applyGalleryTheme(mode, btn) {
    if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = mode;
    }
    if (btn) {
        const info = THEME_LABELS[mode] || THEME_LABELS.light;
        btn.textContent = `${info.icon} ${info.text}`;
        btn.title = info.title;
        btn.setAttribute('aria-label', info.title);
    }
}

/**
 * Format a raw preset stem for card captions:
 * - Named presets like "symdraw-p6m-petals" or "wp-442" stay clean and readable
 * - Timestamp presets like "par-25-11-06-15-24-31-987" compact to "25-11-06 · 15:24"
 */
function formatPresetLabel(name) {
    const ts = /^par-(\d{2}-\d{2}-\d{2})-(\d{2})-(\d{2})(?:-\d{2})?(?:-\d+)?$/i.exec(name);
    if (ts) return `${ts[1]} · ${ts[2]}:${ts[3]}`;
    return name.replace(/^symdraw[-_]/i, '').replace(/[_-]+/g, ' ').trim() || name;
}

/** Match the current page URL against APP_CATALOG to locate its app and sibling variants. */
function findCatalogMatch(appPage) {
    const pathname = (globalThis.location?.pathname || '').replace(/\\/g, '/');
    for (const app of APP_CATALOG.apps) {
        const allGroups = [
            { list: app.variants || [], isDev: false },
            { list: app.devVariants || [], isDev: true },
        ];
        for (const { list, isDev } of allGroups) {
            for (const v of list) {
                const thumbFile = v.thumbPage ? v.thumbPage.split('/').pop() : null;
                const appFile = v.page ? v.page.split('/').pop() : null;
                if (
                    (v.thumbPage && pathname.endsWith('/' + v.thumbPage)) ||
                    (thumbFile && pathname.endsWith('/' + thumbFile) && (!appPage || appFile === appPage.split('/').pop())) ||
                    (appPage && appFile === appPage.split('/').pop() && pathname.includes(app.id))
                ) {
                    return { app, variant: v, siblings: list, isDev };
                }
            }
        }
    }
    return null;
}

/** Compute relative prefix from current directory to repo root (e.g. "../../" or "../../../"). */
function rootPrefixFor(repoPath) {
    const depth = Math.max(0, repoPath.split('/').length - 1);
    return '../'.repeat(depth);
}

/** Inject sticky nav bar, breadcrumbs, Start Blank button, and sibling symmetry tabs once. */
function enhanceGalleryPage({ elem, appPage, count }) {
    if (typeof document === 'undefined' || document.body.dataset.galleryEnhanced) return;
    document.body.dataset.galleryEnhanced = '1';

    const mode = readThemeMode();
    applyGalleryTheme(mode, null);

    const match = findCatalogMatch(appPage);
    const oldHeader = document.querySelector('body > header');
    const headingText = oldHeader?.querySelector('h1')?.textContent?.trim() || document.title || 'Presets';
    const container = elem?.closest('.container') || document.querySelector('.container');

    // Relative path to repo root derived from matched catalog entry or existing footer link
    let toRoot = '../../';
    if (match?.variant?.thumbPage) {
        toRoot = rootPrefixFor(match.variant.thumbPage);
    } else {
        const homeFooter = document.querySelector('footer a[href$="index.html"]');
        if (homeFooter) {
            const href = homeFooter.getAttribute('href') || '';
            toRoot = href.replace(/index\.html$/, '');
        }
    }

    // 1. Sticky top navigation bar
    const nav = document.createElement('nav');
    nav.className = 'portal-nav';
    nav.setAttribute('aria-label', 'Gallery navigation');
    const navInner = document.createElement('div');
    navInner.className = 'portal-nav__inner';

    const crumb = document.createElement('div');
    crumb.className = 'portal-crumb';

    const brand = document.createElement('a');
    brand.className = 'portal-brand';
    brand.href = `${toRoot}index.html`;
    const logo = document.createElement('img');
    logo.src = `${toRoot}css/icon_symmhub.svg`;
    logo.alt = '';
    brand.append(logo, document.createTextNode('SymmHub'));
    crumb.appendChild(brand);

    const addSep = () => {
        const s = document.createElement('span');
        s.className = 'portal-crumb__sep';
        s.textContent = '›';
        s.setAttribute('aria-hidden', 'true');
        crumb.appendChild(s);
    };

    if (match) {
        if (match.app.parentIndex && match.app.parentTitle) {
            addSep();
            const pa = document.createElement('a');
            pa.href = toRoot + match.app.parentIndex;
            pa.textContent = match.app.parentTitle;
            crumb.appendChild(pa);
        }
        if (match.app.index && match.app.index !== match.variant.thumbPage) {
            addSep();
            const aa = document.createElement('a');
            aa.href = toRoot + match.app.index;
            aa.textContent = match.app.title;
            crumb.appendChild(aa);
        }
        addSep();
        const cur = document.createElement('span');
        cur.className = 'portal-crumb__current';
        cur.textContent = match.variant.label;
        crumb.appendChild(cur);
    } else {
        addSep();
        const cur = document.createElement('span');
        cur.className = 'portal-crumb__current';
        cur.textContent = headingText;
        crumb.appendChild(cur);
    }

    const actions = document.createElement('div');
    actions.className = 'portal-nav__actions';

    if (appPage) {
        const launch = document.createElement('a');
        launch.className = 'btn-primary';
        launch.href = appPage;
        launch.textContent = 'Start Blank \u2192';
        launch.title = `Open ${appPage} with default settings`;
        actions.appendChild(launch);
    }

    const themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.className = 'theme-btn';
    applyGalleryTheme(mode, themeBtn);
    themeBtn.addEventListener('click', () => {
        const cur = readThemeMode();
        const next = THEME_MODES[(THEME_MODES.indexOf(cur) + 1) % THEME_MODES.length];
        try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
        applyGalleryTheme(next, themeBtn);
    });
    window.addEventListener('storage', (e) => {
        if (e && e.key === THEME_KEY) applyGalleryTheme(readThemeMode(), themeBtn);
    });
    actions.appendChild(themeBtn);

    navInner.append(crumb, actions);
    nav.appendChild(navInner);
    document.body.prepend(nav);

    // Replace legacy dark header bar with a clean gallery toolbar inside .container
    if (oldHeader) oldHeader.remove();

    if (container) {
        const toolbar = document.createElement('div');
        toolbar.className = 'gallery-toolbar';
        const h1 = document.createElement('h1');
        h1.className = 'gallery-toolbar__title';
        h1.textContent = headingText;
        if (count > 0) {
            const meta = document.createElement('span');
            meta.className = 'gallery-toolbar__meta';
            meta.textContent = `${count} preset${count === 1 ? '' : 's'}`;
            h1.appendChild(meta);
        }
        toolbar.appendChild(h1);
        container.prepend(toolbar);

        // 2. Sibling symmetry-family tabs
        const tabsWithGallery = match ? match.siblings.filter(v => v.thumbPage) : [];
        if (tabsWithGallery.length > 1) {
            const tabBar = document.createElement('div');
            tabBar.className = 'sym-tabs';
            tabBar.setAttribute('role', 'navigation');
            tabBar.setAttribute('aria-label', 'Symmetry families');
            for (const v of tabsWithGallery) {
                const a = document.createElement('a');
                const isCurrent = v.thumbPage === match.variant.thumbPage;
                a.className = 'sym-tab' + (isCurrent ? ' sym-tab--active' : '');
                a.href = toRoot + v.thumbPage;
                a.textContent = v.label;
                if (isCurrent) a.setAttribute('aria-current', 'page');
                tabBar.appendChild(a);
            }
            toolbar.insertAdjacentElement('afterend', tabBar);
        }
    }
}

function appendCard(elem, appPage, folder, name, thumbClass) {
    const doc = document;
    const href = `${appPage}#{"preset":"${folder}${name}.json"}`;
    const label = formatPresetLabel(name);

    const a = doc.createElement('a');
    a.className = 'thumb-card';
    a.setAttribute('href', href);
    a.title = `${label} (${name})`;

    const media = doc.createElement('div');
    media.className = 'thumb-card__img-wrap';

    const img = doc.createElement('img');
    img.src = `${folder}${name}.json.png`;
    img.alt = `${label} preset preview`;
    img.loading = 'lazy';
    img.decoding = 'async';
    if (thumbClass && thumbClass !== 'thumbnail') img.className = thumbClass;
    media.appendChild(img);

    const caption = doc.createElement('div');
    caption.className = 'thumb-card__caption';
    caption.textContent = label;

    a.append(media, caption);
    elem.appendChild(a);
}

export function appendThumbnails(elem, appPage, presetsFolder, presets, thumb_class = 'thumbnail') {
    if (typeof presets === 'string') {
        presets = getPresetsArray(presets);
    }
    if (!(presets instanceof Array)) {
        throw new Error('presets should be array but got this: ' + presets);
    }
    enhanceGalleryPage({ elem, appPage, count: presets.length });
    for (let i = 0; i < presets.length; i++) {
        appendCard(elem, appPage, presetsFolder, presets[i], thumb_class);
    }
}

//
//  extended version of thumbnails generator
//
export function appendThumbnails2(options) {
    let elem = options.elem;
    if (!elem) elem = document.body;

    let presets = null;
    if (options.presetsString) {
        presets = getPresetsArray(options.presetsString);
    }
    if (!presets && options.presets) {
        presets = options.presets;
    }
    if (!(presets instanceof Array)) {
        throw new Error('presets should be array but got this: ' + presets);
    }

    const page = options.page || 'application.html';
    const folder = options.folder || '';

    enhanceGalleryPage({ elem, appPage: page, count: presets.length });
    for (let i = 0; i < presets.length; i++) {
        appendCard(elem, page, folder, presets[i], null);
    }
}

//
// convert directory list in template string into array of file names without extensions
//
function getPresetsArray(str) {
    const sa = str.split('\n');
    const pa = [];
    // remove empty strings
    sa.forEach((e) => { if (e.trim().length > 0) pa.push(e.trim().split('.')[0]); });
    return pa;
}

export function makeSamplesArray(preStr, folder = '') {
    const pa = getPresetsArray(preStr);

    function smp(name) {
        const preFile = folder + name + '.json';
        return {
            name: name,
            url: preFile + '.png',
            data: {
                jsonUrl: preFile, isSample: true,
            },
        };
    }

    const s = [];
    for (let i = 0; i < pa.length; i++) {
        s.push(smp(pa[i]));
    }
    return s;
}
