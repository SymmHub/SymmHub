/**
 * ThemeManager.js
 *
 * Shared Light / Dark / System theme controller for SymmHub apps and panels.
 * Persists preference globally under 'symmhub_theme' in localStorage and sets
 * document.documentElement.dataset.theme ('light' | 'dark' | 'system').
 * Default is 'light'.
 */

export const THEME_STORAGE_KEY = 'symmhub_theme';
export const THEME_MODES = ['light', 'dark', 'system'];

const mListeners = new Set();
let mMode = 'light';
let mInitialized = false;

function normalizeMode(mode) {
    return THEME_MODES.includes(mode) ? mode : 'light';
}

function readStoredMode() {
    try {
        const stored = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
        return normalizeMode(stored);
    } catch (e) {
        return 'light';
    }
}

function writeStoredMode(mode) {
    try {
        globalThis.localStorage?.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) { /* storage unavailable */ }
}

function applyToDocument(mode) {
    const root = globalThis.document?.documentElement;
    if (!root) return;
    if (root.dataset) root.dataset.theme = mode;
    else if (root.setAttribute) root.setAttribute('data-theme', mode);
}

function systemPrefersDark() {
    try {
        return !!globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    } catch (e) {
        return false;
    }
}

/** Read persisted theme (default 'light') and apply it to <html>. */
export function initTheme() {
    mMode = readStoredMode();
    mInitialized = true;
    applyToDocument(mMode);
    return mMode;
}

/** Current theme setting: 'light' | 'dark' | 'system'. */
export function getTheme() {
    if (!mInitialized) initTheme();
    return mMode;
}

/** Resolved effective palette: 'light' | 'dark'. */
export function getResolvedTheme() {
    const mode = getTheme();
    if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
    return mode;
}

/** Set theme mode ('light' | 'dark' | 'system'), persist it, and notify listeners. */
export function setTheme(mode) {
    const next = normalizeMode(mode);
    const changed = !mInitialized || next !== mMode;
    mMode = next;
    mInitialized = true;
    writeStoredMode(next);
    applyToDocument(next);
    if (changed) {
        for (const fn of [...mListeners]) fn(mMode, getResolvedTheme());
    }
    return mMode;
}

/** Cycle Light -> Dark -> System -> Light. */
export function cycleTheme() {
    const cur = getTheme();
    const idx = THEME_MODES.indexOf(cur);
    return setTheme(THEME_MODES[(idx + 1) % THEME_MODES.length]);
}

/** Subscribe to theme changes: fn(mode, resolved). Returns an unsubscribe function. */
export function onThemeChange(fn) {
    mListeners.add(fn);
    return () => mListeners.delete(fn);
}

/** Human-readable label & short icon text for a theme mode. */
export function themeLabel(mode = getTheme()) {
    switch (mode) {
        case 'dark':   return { icon: '☾', label: 'Dark',   title: 'Theme: Dark (click to switch to System)' };
        case 'system': return { icon: '◐', label: 'System', title: 'Theme: System (click to switch to Light)' };
        default:       return { icon: '☀', label: 'Light',  title: 'Theme: Light (click to switch to Dark)' };
    }
}

// Sync when another tab changes the theme
if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('storage', (e) => {
        if (e && e.key === THEME_STORAGE_KEY) {
            const next = normalizeMode(e.newValue);
            if (next !== mMode) {
                mMode = next;
                mInitialized = true;
                applyToDocument(next);
                for (const fn of [...mListeners]) fn(mMode, getResolvedTheme());
            }
        }
    });
}
