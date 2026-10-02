//
//  Palettes of ColorTiles.
//
//  A palette is a recipe:
//
//    { a: [r, g, b], b: [r, g, b], c: [r, g, b], d: [r, g, b],    // cosine palette
//      adjust: { hueShift, satMult, lightOffset, contrastMult },   // OKLCH adjustments
//      edited: { "3": "#rrggbb" },                                 // colors set by hand, by slot
//      alphas: { "3": 0.5 } }                                      // alpha (opacity) by slot
//
//  The color of slot i of n is  a + b * cos(2π (c * i/n + d))  per channel, then
//  adjusted, unless the slot is in `edited`. Its alpha is 1 unless the slot is in
//  `alphas`. The number of slots is not part of a palette: it follows the group
//  (see ColorTiles).
//
//  There are built-in palettes and user palettes. User palettes are saved in the
//  browser's localStorage, so every layer and document in this browser sees them.
//  Users of the store pass an object with onPalettesChanged() to subscribe(); it is
//  held weakly, a layer that is gone drops out by itself.
//

const CUSTOM = 'custom';   // name shown when the colors are no palette

const NEUTRAL_ADJUST = Object.freeze({ hueShift: 0, satMult: 1, lightOffset: 0, contrastMult: 1 });

// built-in palettes: the cosine part only, the rest is neutral. The first three
// are the ones documents refer to by name, keep them.
const BUILTIN = {
    pastel:       { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.00, 0.33, 0.67] },
    sunset:       { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.30, 0.20, 0.20] },
    highContrast: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.00, 0.10, 0.20] },

    soft:         { a: [0.75, 0.75, 0.75], b: [0.25, 0.25, 0.25], c: [1.0, 1.0, 1.0], d: [0.00, 0.33, 0.67] },
    candy:        { a: [0.70, 0.55, 0.70], b: [0.30, 0.35, 0.30], c: [1.0, 1.0, 1.0], d: [0.00, 0.20, 0.50] },
    warm:         { a: [0.80, 0.45, 0.30], b: [0.20, 0.40, 0.25], c: [1.0, 1.0, 1.0], d: [0.00, 0.10, 0.20] },
    cool:         { a: [0.30, 0.50, 0.65], b: [0.25, 0.30, 0.30], c: [1.0, 1.0, 1.0], d: [0.55, 0.40, 0.30] },
    ocean:        { a: [0.20, 0.50, 0.60], b: [0.20, 0.30, 0.30], c: [1.0, 1.0, 1.0], d: [0.50, 0.30, 0.20] },
    ember:        { a: [0.50, 0.50, 0.50], b: [0.50, 0.50, 0.50], c: [1.0, 0.7, 0.4], d: [0.00, 0.15, 0.20] },
    forest:       { a: [0.35, 0.50, 0.35], b: [0.25, 0.35, 0.25], c: [1.0, 1.0, 1.0], d: [0.30, 0.10, 0.50] },
    grayscale:    { a: [0.5, 0.5, 0.5],    b: [0.5, 0.5, 0.5],    c: [1.0, 1.0, 1.0], d: [0.00, 0.00, 0.00] },
    duotone:      { a: [0.5, 0.5, 0.5],    b: [0.5, 0.5, 0.5],    c: [1.0, 1.0, 1.0], d: [0.00, 0.50, 0.50] },
};

const BUILTIN_NAMES = Object.keys(BUILTIN);

const STORAGE_KEY = 'sympix.userPalettes';
const MAX_NAME_LENGTH = 40;

const EPS = 1e-6;


// ── recipes ──────────────────────────────────────────────────────────────────

/**
 * A full copy of the recipe, with the defaults filled in (neutral adjust, no
 * edited colors, alpha 1), or null when it is no recipe.
 */
function normalizeRecipe(r) {
    const vec = (v) => (Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)) ? v.slice() : null;
    const a = vec(r?.a), b = vec(r?.b), c = vec(r?.c), d = vec(r?.d);
    if (!a || !b || !c || !d) return null;

    const adjust = { ...NEUTRAL_ADJUST };
    for (const key of Object.keys(adjust)) {
        if (Number.isFinite(r.adjust?.[key])) adjust[key] = r.adjust[key];
    }

    const edited = {};
    for (const key in (r.edited || {})) {
        if (/^\d+$/.test(key) && /^#[0-9a-f]{6}$/i.test(r.edited[key])) edited[key] = r.edited[key].toLowerCase();
    }

    // only the alphas that differ from 1 are kept
    const alphas = {};
    for (const key in (r.alphas || {})) {
        const v = r.alphas[key];
        if (!/^\d+$/.test(key) || !Number.isFinite(v)) continue;
        const alpha = Math.min(1, Math.max(0, v));
        if (alpha !== 1) alphas[key] = alpha;
    }
    return { a, b, c, d, adjust, edited, alphas };
}

function sameNumbers(u, v) {
    return u.length === v.length && u.every((x, i) => Math.abs(x - v[i]) < EPS);
}

/** Do the two recipes make the same colors? */
function sameRecipe(r1, r2) {
    const p = normalizeRecipe(r1), q = normalizeRecipe(r2);
    if (!p || !q) return false;
    if (!(sameNumbers(p.a, q.a) && sameNumbers(p.b, q.b) && sameNumbers(p.c, q.c) && sameNumbers(p.d, q.d))) return false;
    const keys = Object.keys(NEUTRAL_ADJUST);
    if (!sameNumbers(keys.map(k => p.adjust[k]), keys.map(k => q.adjust[k]))) return false;
    const pk = Object.keys(p.edited), qk = Object.keys(q.edited);
    if (!(pk.length === qk.length && pk.every(k => p.edited[k] === q.edited[k]))) return false;
    const pa = Object.keys(p.alphas), qa = Object.keys(q.alphas);
    return pa.length === qa.length && pa.every(k => k in q.alphas && Math.abs(p.alphas[k] - q.alphas[k]) < EPS);
}


// ── user palettes ────────────────────────────────────────────────────────────

let mUser = null;                 // Map name -> recipe, loaded on first use
const mListeners = new Set();     // WeakRef of the subscribers

function loadUser() {
    if (mUser) return;
    mUser = new Map();
    try {
        const text = window.localStorage.getItem(STORAGE_KEY);
        for (const item of (text ? JSON.parse(text) : [])) {
            const recipe = normalizeRecipe(item?.recipe);
            if (recipe && typeof item.name === 'string') mUser.set(item.name, recipe);
        }
    } catch (e) {
        console.warn('Palettes: saved palettes can not be read', e);
    }
}

function persistUser() {
    try {
        const list = [...mUser].map(([name, recipe]) => ({ name, recipe }));
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
        console.warn('Palettes: palettes can not be saved in this browser, they last for this session', e);
    }
}

function notify() {
    for (const ref of [...mListeners]) {
        const subscriber = ref.deref();
        if (subscriber) subscriber.onPalettesChanged?.();
        else mListeners.delete(ref);
    }
}

// another tab of the same browser saved or deleted a palette
window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === null) {
        mUser = null;
        notify();
    }
});

function userNames() {
    loadUser();
    return [...mUser.keys()].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' }));
}


const Palettes = {

    CUSTOM,
    NEUTRAL_ADJUST,
    normalize: normalizeRecipe,
    same:      sameRecipe,

    /** Names of the built-in palettes, then of the user palettes sorted. */
    names:        () => [...BUILTIN_NAMES, ...userNames()],
    builtinNames: () => [...BUILTIN_NAMES],

    isBuiltin: (name) => Object.hasOwn(BUILTIN, name),
    isUser:    (name) => { loadUser(); return mUser.has(name); },
    has:       (name) => Palettes.isBuiltin(name) || Palettes.isUser(name),

    /** A full copy of the recipe of the named palette, or null. */
    get(name) {
        if (Palettes.isBuiltin(name)) return normalizeRecipe(BUILTIN[name]);
        loadUser();
        const recipe = mUser.get(name);
        return recipe ? normalizeRecipe(recipe) : null;
    },

    /** The reason a user palette can not have the name, or null when it can. */
    validateName(name) {
        const s = (name ?? '').trim();
        if (!s) return 'The name is empty.';
        if (s.length > MAX_NAME_LENGTH) return `The name is longer than ${MAX_NAME_LENGTH} characters.`;
        if (s === CUSTOM) return `"${CUSTOM}" is the name of colors that are no palette.`;
        if (Palettes.isBuiltin(s)) return `"${s}" is a built-in palette.`;
        return null;
    },

    /** Saves (or replaces) the user palette; false when the name is not valid. */
    saveUser(name, recipe) {
        const s = (name ?? '').trim();
        const normalized = normalizeRecipe(recipe);
        if (Palettes.validateName(s) || !normalized) return false;
        loadUser();
        mUser.set(s, normalized);
        persistUser();
        notify();
        return true;
    },

    removeUser(name) {
        loadUser();
        if (!mUser.delete(name)) return false;
        persistUser();
        notify();
        return true;
    },

    /** subscriber.onPalettesChanged() is called when a user palette is saved or deleted. */
    subscribe(subscriber) {
        mListeners.add(new WeakRef(subscriber));
    },
};

export { Palettes };
