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
//  browser's localStorage, so every layer and document in this browser sees them;
//  for the long term all of them can go to a palette file and come back from it
//  (see "palette files" below). Users of the store pass an object with
//  onPalettesChanged() to subscribe(); it is held weakly, a layer that is gone drops
//  out by itself.
//
//  A recipe also travels as text, to another document or to a text editor: toText()
//  writes it as JSON, a key to a line, fromText() reads that back. Besides the
//  arrays above, a, b, c and d may be { R, G, B } objects, the way documents store
//  them, so the colors block of a document can be pasted as it is.
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
    // [r, g, b], or { R, G, B } as the documents store it
    const vec = (v) => {
        if (v && typeof v === 'object' && !Array.isArray(v)) v = [v.R, v.G, v.B];
        return (Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)) ? v.slice() : null;
    };
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


// ── text ─────────────────────────────────────────────────────────────────────

// The lines "key": value of a (normalized) recipe, in the order of its text.
// Numbers are rounded to 6 decimals, which sameRecipe does not tell from the originals.
function recipeLines(r) {
    const num = (v) => JSON.stringify(Math.round(v * 1e6) / 1e6);
    const vec = (v) => '[' + v.map(num).join(', ') + ']';
    const obj = (o, format) => '{' + Object.keys(o).map(k => `${JSON.stringify(k)}: ${format(o[k])}`).join(', ') + '}';
    return [
        `"a": ${vec(r.a)}`,
        `"b": ${vec(r.b)}`,
        `"c": ${vec(r.c)}`,
        `"d": ${vec(r.d)}`,
        `"adjust": ${obj(r.adjust, num)}`,
        `"edited": ${obj(r.edited, (hex) => JSON.stringify(hex))}`,
        `"alphas": ${obj(r.alphas, num)}`,
    ];
}

/**
 * The recipe as JSON text for the clipboard, a key to a line so that it reads and
 * edits well in a text editor.
 */
function recipeToText(recipe) {
    const r = normalizeRecipe(recipe);
    if (!r) return '';
    return '{\n' + recipeLines(r).map(line => '  ' + line).join(',\n') + '\n}';
}

/**
 * The recipe in the text: { recipe } with the defaults filled in, or { error }
 * with the reason it is no palette.
 */
function recipeFromText(text) {
    const s = String(text ?? '').trim();
    if (!s) return { error: 'The text is empty.' };
    let value;
    try {
        value = JSON.parse(s);
    } catch (e) {
        return { error: `The text is not JSON (${e.message}).` };
    }
    const recipe = normalizeRecipe(value);
    if (!recipe) return { error: 'The text is JSON, but no palette: a, b, c and d need three numbers each.' };
    return { recipe };
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


// ── palette files ────────────────────────────────────────────────────────────
//
//  All the user palettes in one JSON file, to keep them for good (the browser's
//  storage is no safe place) and to move them to another browser:
//
//    { "format": "sympix-palettes", "version": 1,
//      "palettes": [ { "name": "my teal", "a": [..], "b": [..], "c": [..], "d": [..],
//                      "adjust": {..}, "edited": {..}, "alphas": {..} }, ... ] }
//
//  An entry may also be { name, recipe }, and the file may be the bare list of that
//  kind kept in the browser's storage.

const FILE_FORMAT  = 'sympix-palettes';
const FILE_VERSION = 1;

/** The text of the palette file with all the user palettes. */
function libraryToText() {
    loadUser();
    const blocks = userNames().map((name) => {
        const lines = [`"name": ${JSON.stringify(name)}`, ...recipeLines(mUser.get(name))];
        return '    {\n' + lines.map(line => '      ' + line).join(',\n') + '\n    }';
    });
    const list = blocks.length ? '[\n' + blocks.join(',\n') + '\n  ]' : '[]';
    return `{\n  "format": "${FILE_FORMAT}",\n  "version": ${FILE_VERSION},\n  "palettes": ${list}\n}\n`;
}

/**
 * The palettes in the text of a palette file: { entries: [{ name, recipe }], skipped:
 * [{ name, reason }] } (skipped: entries that are no palette or have a name that
 * can not be used, the reason is a sentence of its own), or { error } with the reason
 * the text is no palette file.
 */
function libraryFromText(text) {
    const s = String(text ?? '').trim();
    if (!s) return { error: 'The file is empty.' };
    let value;
    try {
        value = JSON.parse(s);
    } catch (e) {
        return { error: `The file is not JSON (${e.message}).` };
    }
    if (!Array.isArray(value) && value?.format !== undefined && value.format !== FILE_FORMAT) {
        return { error: `The file is no palette file (its format is ${JSON.stringify(value.format)}).` };
    }
    const list = Array.isArray(value) ? value : value?.palettes;
    if (!Array.isArray(list)) return { error: 'The file holds no list of palettes.' };
    if (list.length === 0) return { error: 'The file holds no palettes.' };

    const entries = [], skipped = [];
    for (const item of list) {
        const name   = (typeof item?.name === 'string') ? item.name.trim() : '';
        const recipe = normalizeRecipe(item?.recipe ?? item);
        const reason = recipe ? Palettes.validateName(name)
            : `${name ? JSON.stringify(name) : 'An entry'} is no palette: a, b, c and d need three numbers each.`;
        if (reason) skipped.push({ name, reason });
        else entries.push({ name, recipe });
    }
    return { entries, skipped };
}

// A saved "name (2)" with the colors of the entry: an earlier import kept it there.
function hasRenamedCopy(name, recipe) {
    for (const [saved, savedRecipe] of mUser) {
        const m = /^(.*) \(\d+\)$/.exec(saved);
        if (m && name.startsWith(m[1]) && sameRecipe(savedRecipe, recipe)) return true;
    }
    return false;
}

/** The names of the entries that are saved already, with other colors. */
function libraryConflicts(entries) {
    loadUser();
    return entries
        .filter(({ name, recipe }) => mUser.has(name) && !sameRecipe(mUser.get(name), recipe)
                                      && !hasRenamedCopy(name, recipe))
        .map(({ name }) => name);
}

// "name (2)", "name (3)", ... the first that is free, within the length of a name
function freeName(name) {
    for (let i = 2; ; i++) {
        const suffix = ` (${i})`;
        const candidate = name.slice(0, MAX_NAME_LENGTH - suffix.length).trimEnd() + suffix;
        if (!mUser.has(candidate)) return candidate;
    }
}

/**
 * Adds the entries of libraryFromText() to the user palettes, never deleting one.
 * A name saved already with the same colors is left as it is. With other colors the
 * saved palette is replaced when `replace`, else the entry is added under a free
 * name, "name (2)" (once: an import again finds that copy and leaves it). The
 * palettes are stored, and the subscribers told, once.
 * @returns {{ added: string[], replaced: string[], renamed: {from, to}[], same: string[] }}
 */
function libraryMerge(entries, { replace = false } = {}) {
    loadUser();
    const done = { added: [], replaced: [], renamed: [], same: [] };
    for (const { name, recipe } of entries) {
        const saved = mUser.get(name);
        if (!saved) {
            mUser.set(name, recipe);
            done.added.push(name);
        } else if (sameRecipe(saved, recipe)) {
            done.same.push(name);
        } else if (replace) {
            mUser.set(name, recipe);
            done.replaced.push(name);
        } else if (hasRenamedCopy(name, recipe)) {
            done.same.push(name);
        } else {
            const to = freeName(name);
            mUser.set(to, recipe);
            done.renamed.push({ from: name, to });
        }
    }
    if (done.added.length || done.replaced.length || done.renamed.length) {
        persistUser();
        notify();
    }
    return done;
}


const Palettes = {

    CUSTOM,
    NEUTRAL_ADJUST,
    normalize: normalizeRecipe,
    same:      sameRecipe,
    toText:    recipeToText,
    fromText:  recipeFromText,

    /** Names of the built-in palettes, then of the user palettes sorted. */
    names:        () => [...BUILTIN_NAMES, ...userNames()],
    builtinNames: () => [...BUILTIN_NAMES],
    userNames,

    // the palette file with all the user palettes
    libraryToText,
    libraryFromText,
    conflicts: libraryConflicts,
    merge:     libraryMerge,

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
