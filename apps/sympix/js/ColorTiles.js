import {
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamChoice,
    ParamString,
    ParamGroup,
    ParamFunc,
    ParamColorStrip,
    ParamFloatVector,
    ParamUiFolder,
    createPromptDialog,
    writeClipboardText,
    readClipboardText,
    openFile,
    saveTextFileAs,
    MAX_COLORS_COUNT,
} from './modules.js';

import { adjustColorRGB, adjustColorRGB_OKLCH, rgbToHex, hexToRgb } from './color_uitils.js';
import { Palettes } from './Palettes.js';


const MYNAME = 'ColorTiles';

const DEBUG = false;

const TWO_PI = 2.0 * Math.PI;

const CUSTOM = Palettes.CUSTOM;

// one prompt dialog for the names of all the palettes of all the layers
let sPrompt = null;
function getPrompt() {
    if (!sPrompt) sPrompt = createPromptDialog();
    return sPrompt;
}

//
//  ColorTiles — generates a flat Float32Array of RGBA colors using the
//  cosine palette formula:  color = a + b * cos(2π * (c*t + d))
//
//  Compatible with the ParamObj API: exposes getParams().
//  Call getPremultColors() each frame to obtain the current premultiplied Float32Array for
//  uploading to the GPU as uniform vec4 uCellColors[MAX_COLORS_COUNT].
//
function ColorTiles(options = {}) {

    let mOnChange = options.onChange || null;

    let mConfig = {
        count:     6,
        palette:   Palettes.builtinNames()[0],
        permIndex: 0,
        alpha:     1.0,
        colorMask: '',
        // cosine palette channels (editable independently)
        aR: 0.5, aG: 0.5, aB: 0.5,
        bR: 0.5, bG: 0.5, bB: 0.5,
        cR: 1.0, cG: 1.0, cB: 1.0,
        dR: 0.0, dG: 0.33, dB: 0.67,
        // HSL adjustments (neutral defaults = no effect)
        adjHueShift:     0,
        adjSatMult:      1.0,
        adjLightOffset:  0,
        adjContrastMult: 1.0,
    };

    // Getters for parameters that can be optionally moved to the host layer
    const getAlpha = options.getAlpha || (() => mConfig.alpha);
    const getColorMask = options.getColorMask || (() => mConfig.colorMask);
    const getPermIndexVal = options.getPermIndex || (() => mConfig.permIndex);


    // Pre-allocated buffers, zeroed on init.
    // mColors        — straight (non-premultiplied) RGBA, layout [r, g, b, a] per slot.
    // mPremultColors — premultiplied RGBA, safe to upload directly as uCellColors.
    const mColors        = new Float32Array(MAX_COLORS_COUNT * 4);
    const mPremultColors = new Float32Array(MAX_COLORS_COUNT * 4);

    // Colors set by hand ('#rrggbb', null = follows the palette), by slot index.
    // They are final: the adjustments and Randomize do not touch them, and they
    // stay when the color count changes. A palette picked in the choice replaces
    // them (a palette is the whole look, see Palettes.js).
    const mEdited = new Array(MAX_COLORS_COUNT).fill(null);

    // Alpha (opacity) of each color, by slot index, 1 = opaque. It multiplies the
    // alpha the host layer gives (its mask, 0 or 1) and stays with the slot like
    // the colors set by hand.
    const mAlpha = new Array(MAX_COLORS_COUNT).fill(1);

    _updateColors();

    // ------------------------------------------------------------------ //
    //  Internal helpers
    // ------------------------------------------------------------------ //

    function _clamp(v) { return Math.max(0, Math.min(1, v)); }

    function _updateColors() {
        const { count: n } = mConfig;
        const a = [mConfig.aR, mConfig.aG, mConfig.aB];
        const b = [mConfig.bR, mConfig.bG, mConfig.bB];
        const c = [mConfig.cR, mConfig.cG, mConfig.cB];
        const d = [mConfig.dR, mConfig.dG, mConfig.dB];

        // Parse colorMask: string of '0'/'1' chars, one per color slot.
        // Missing positions default to 1 (fully visible).
        const mask = getColorMask() || '';
        const maskFactors = Array.from({ length: n }, (_, i) =>
            i < mask.length ? (mask[i] === '0' ? 0 : 1) : 1
        );

        const alphaVal = getAlpha();
        const adj = {
            hueShift:     mConfig.adjHueShift,
            satMult:      mConfig.adjSatMult,
            lightOffset:  mConfig.adjLightOffset,
            contrastMult: mConfig.adjContrastMult,
        };
        for (let i = 0; i < n; i++) {
            const t     = i / n;
            const idx   = i * 4;
            const alpha = alphaVal * maskFactors[i] * mAlpha[i];

            let rgb = mEdited[i] ? hexToRgb(mEdited[i]) : null;
            if (!rgb) {
                // Cosine palette: compute raw RGB, then apply HSL adjustments
                let r  = _clamp(a[0] + b[0] * Math.cos(TWO_PI * (c[0] * t + d[0])));
                let g  = _clamp(a[1] + b[1] * Math.cos(TWO_PI * (c[1] * t + d[1])));
                let bv = _clamp(a[2] + b[2] * Math.cos(TWO_PI * (c[2] * t + d[2])));
                //rgb = adjustColorRGB(r, g, bv, adj);
                rgb = adjustColorRGB_OKLCH(r, g, bv, adj);
            }

            mColors[idx + 0] = rgb.r;
            mColors[idx + 1] = rgb.g;
            mColors[idx + 2] = rgb.b;
            mColors[idx + 3] = alpha;

            mPremultColors[idx + 0] = rgb.r * alpha;
            mPremultColors[idx + 1] = rgb.g * alpha;
            mPremultColors[idx + 2] = rgb.b * alpha;
            mPremultColors[idx + 3] = alpha;
        }

        // Zero out unused slots so the GPU always receives a valid array.
        for (let i = n; i < MAX_COLORS_COUNT; i++) {
            mColors[i * 4 + 0] = 0;
            mColors[i * 4 + 1] = 0;
            mColors[i * 4 + 2] = 0;
            mColors[i * 4 + 3] = 0;
            mPremultColors[i * 4 + 0] = 0;
            mPremultColors[i * 4 + 1] = 0;
            mPremultColors[i * 4 + 2] = 0;
            mPremultColors[i * 4 + 3] = 0;
        }

        if(DEBUG) {
            // Debug: log each generated color as [r, g, b] rounded to 3 dp.
            const entries = Array.from({ length: n }, (_, i) => {
                const base = i * 4;
                return `[${mColors[base].toFixed(3)}, ${mColors[base+1].toFixed(3)}, ${mColors[base+2].toFixed(3)}]`;
            });
            console.log(`ColorTiles._updateColors() count=${n}:\n  ${entries.join('\n  ')}`);
        }
    }


    // Swatches of the color strip, from the straight (non-premultiplied) RGBA in mColors.
    // opacity is what the color comes out as (a color masked out by the host is
    // transparent), alpha is the value of the color's own alpha bar.
    function _stripItems() {
        const items = [];
        for (let i = 0; i < mConfig.count; i++) {
            const idx = i * 4;
            items.push({
                color:   rgbToHex(mColors[idx], mColors[idx + 1], mColors[idx + 2]),
                opacity: mColors[idx + 3],
                alpha:   mAlpha[i],
                marked:  !!mEdited[i],
            });
        }
        return items;
    }

    // colors set by hand or alphas other than 1
    function _hasEdited() { return mEdited.some(Boolean) || mAlpha.some(a => a !== 1); }

    function _updateStrip() {
        if (!mParams) return;
        mParams.strip.updateDisplay();
    }

    function _onChange() {
        _updateColors();
        _syncPaletteName();
        _updateStrip();
        if (mOnChange) mOnChange();
    }

    function _onPickColor(index, hex) {
        if (index < 0 || index >= MAX_COLORS_COUNT) return;
        mEdited[index] = hex;
        _onChange();
    }

    function _onResetColor(index) {
        mEdited[index] = null;
        _onChange();
    }

    function _onPickAlpha(index, alpha) {
        if (index < 0 || index >= MAX_COLORS_COUNT || !Number.isFinite(alpha)) return;
        mAlpha[index] = _clamp(alpha);
        _onChange();
    }

    function _onResetAlpha(index) {
        mAlpha[index] = 1;
        _onChange();
    }

    // gives all the colors edited by hand and all the alphas back
    function _resetEdited() {
        if (!_hasEdited()) return;
        _pushUndo();
        mEdited.fill(null);
        mAlpha.fill(1);
        _onChange();
    }

    // The colors set by hand, { "3": "#ff0000" }.
    function _getEdited() {
        const out = {};
        mEdited.forEach((hex, i) => { if (hex) out[i] = hex; });
        return out;
    }

    // The alphas other than 1, { "3": 0.5 }.
    function _getAlphas() {
        const out = {};
        mAlpha.forEach((a, i) => { if (a !== 1) out[i] = a; });
        return out;
    }

    // Serialization of the hand-set colors. It is saved even when empty: a
    // document then replaces the colors of the palette it names completely.
    const mEditedParam = {
        getValue: _getEdited,
        setValue: (value) => {
            mEdited.fill(null);
            for (const key in (value || {})) {
                const i = parseInt(key, 10);
                if (i >= 0 && i < MAX_COLORS_COUNT && hexToRgb(value[key])) mEdited[i] = value[key];
            }
            _onChange();
        },
        // a document replaces the colors, the history belongs to the one before
        init: () => { mEdited.fill(null); _clearHistory(); _updateColors(); },
        serializable: true,
    };

    // Serialization of the alphas, saved even when empty for the same reason.
    const mAlphasParam = {
        getValue: _getAlphas,
        setValue: (value) => {
            mAlpha.fill(1);
            for (const key in (value || {})) {
                const i = parseInt(key, 10);
                const a = Number(value[key]);
                if (i >= 0 && i < MAX_COLORS_COUNT && Number.isFinite(a)) mAlpha[i] = _clamp(a);
            }
            _onChange();
        },
        init: () => { mAlpha.fill(1); _updateColors(); },
        serializable: true,
    };

    // Which parts of the cosine palette Randomize changes (not saved). The
    // colors set by hand stay, and so do the alphas and the adjustments.
    const mVary = { a: true, b: true, c: false, d: true };

    function _canRandomize() { return mVary.a || mVary.b || mVary.c || mVary.d; }

    function _randomize() {
        if (!_canRandomize()) return;
        _pushUndo();

        const r3 = (lo, hi) => Math.round((lo + Math.random() * (hi - lo)) * 1000) / 1000;
        const frac = (v) => ((v % 1) + 1) % 1; // positive modulo 1
        const pick = (list) => list[Math.floor(Math.random() * list.length)];

        if (mVary.b) {
            // b: amplitude → controls contrast. Allow some per-channel variation for tint.
            const bBase = r3(0.35, 0.5);
            mConfig.bR = Math.min(0.5, bBase + r3(-0.08, 0.08));
            mConfig.bG = Math.min(0.5, bBase + r3(-0.08, 0.08));
            mConfig.bB = Math.min(0.5, bBase + r3(-0.08, 0.08));
        }

        if (mVary.a) {
            // a: DC offset. Per-channel variation introduces warm/cool cast.
            const aBase = r3(0.3, 0.5);
            mConfig.aR = Math.min(1, aBase + r3(-0.1, 0.1));
            mConfig.aG = Math.min(1, aBase + r3(-0.1, 0.1));
            mConfig.aB = Math.min(1, aBase + r3(-0.1, 0.1));
        }

        if (mVary.c) {
            // c: how many times a channel cycles over the colors. Whole cycles close
            // the loop (the last color comes round to the first), the others open it.
            const cycles = [0.5, 1, 1, 1, 1.5, 2];
            mConfig.cR = pick(cycles);
            mConfig.cG = pick(cycles);
            mConfig.cB = pick(cycles);
        }

        if (mVary.d) {
            // d: phase spread between channels controls saturation:
            //   spread ≈ 0      → near-monochrome (highContrast style)
            //   spread ≈ 0.1    → warm/tinted (sunset style)
            //   spread ≈ 0.33   → full rainbow saturation (pastel style)
            // Full range [0, 0.45] gives equal chance of each style.
            const base   = Math.random();
            const spread = r3(0, 0.45);
            const sign   = Math.random() < 0.5 ? 1 : -1;

            mConfig.dR = Math.round(frac(base)                    * 1000) / 1000;
            mConfig.dG = Math.round(frac(base + sign * spread)     * 1000) / 1000;
            mConfig.dB = Math.round(frac(base + sign * spread * 2) * 1000) / 1000;
        }

        // Refresh the UI of the changed parts.
        if (mParams) {
            ['a', 'b', 'c', 'd'].filter(k => mVary[k]).forEach(k => mParams[k].updateDisplay());
        }

        _onChange();
    }

    // Reset adjust: no hue shift, saturation and contrast as they come, no offset.
    function _resetAdjust() {
        const n = Palettes.NEUTRAL_ADJUST;
        if (mConfig.adjHueShift === n.hueShift && mConfig.adjSatMult === n.satMult &&
            mConfig.adjLightOffset === n.lightOffset && mConfig.adjContrastMult === n.contrastMult) return;
        _pushUndo();
        mConfig.adjHueShift     = n.hueShift;
        mConfig.adjSatMult      = n.satMult;
        mConfig.adjLightOffset  = n.lightOffset;
        mConfig.adjContrastMult = n.contrastMult;
        if (mParams) mParams.adjust.updateDisplay();
        _onChange();
    }

    // ------------------------------------------------------------------ //
    //  Undo / redo of the big steps: Randomize, a palette picked in the
    //  choice or pasted, the two resets. Each step keeps the palette recipe
    //  from before.
    // ------------------------------------------------------------------ //

    const MAX_HISTORY = 50;
    const mUndo = [];
    const mRedo = [];

    // call it before the step changes the colors
    function _pushUndo() {
        mUndo.push(_getRecipe());
        if (mUndo.length > MAX_HISTORY) mUndo.shift();
        mRedo.length = 0;
    }

    function _clearHistory() {
        mUndo.length = 0;
        mRedo.length = 0;
    }

    function _undo() {
        if (!mUndo.length) return;
        mRedo.push(_getRecipe());
        _applyRecipe(mUndo.pop());
    }

    function _redo() {
        if (!mRedo.length) return;
        mUndo.push(_getRecipe());
        _applyRecipe(mRedo.pop());
    }

    // ------------------------------------------------------------------ //
    //  Palettes (see Palettes.js)
    // ------------------------------------------------------------------ //

    // The colors of this layer as a palette recipe.
    function _getRecipe() {
        return {
            a: [mConfig.aR, mConfig.aG, mConfig.aB],
            b: [mConfig.bR, mConfig.bG, mConfig.bB],
            c: [mConfig.cR, mConfig.cG, mConfig.cB],
            d: [mConfig.dR, mConfig.dG, mConfig.dB],
            adjust: {
                hueShift:     mConfig.adjHueShift,
                satMult:      mConfig.adjSatMult,
                lightOffset:  mConfig.adjLightOffset,
                contrastMult: mConfig.adjContrastMult,
            },
            edited: _getEdited(),
            alphas: _getAlphas(),
        };
    }

    // Replaces all the colors of this layer by the palette recipe.
    function _applyRecipe(recipe) {
        const r = Palettes.normalize(recipe);
        if (!r) return;
        [mConfig.aR, mConfig.aG, mConfig.aB] = r.a;
        [mConfig.bR, mConfig.bG, mConfig.bB] = r.b;
        [mConfig.cR, mConfig.cG, mConfig.cB] = r.c;
        [mConfig.dR, mConfig.dG, mConfig.dB] = r.d;
        mConfig.adjHueShift     = r.adjust.hueShift;
        mConfig.adjSatMult      = r.adjust.satMult;
        mConfig.adjLightOffset  = r.adjust.lightOffset;
        mConfig.adjContrastMult = r.adjust.contrastMult;
        mEdited.fill(null);
        for (const key in r.edited) {
            if (+key < MAX_COLORS_COUNT) mEdited[+key] = r.edited[key];
        }
        mAlpha.fill(1);
        for (const key in r.alphas) {
            if (+key < MAX_COLORS_COUNT) mAlpha[+key] = r.alphas[key];
        }
        // Refresh the UI widgets so that they show the new values.
        if (mParams) {
            ['a', 'b', 'c', 'd', 'adjust'].forEach(k => mParams[k].updateDisplay());
        }
        _onChange();
    }

    // The palette choice shows the palette that makes exactly the colors of this
    // layer, or 'custom' when there is none (the colors were edited).
    function _syncPaletteName() {
        const recipe = _getRecipe();
        const matches = (name) => {
            const p = Palettes.get(name);
            return !!p && Palettes.same(p, recipe);
        };
        let name = mConfig.palette;
        if (!matches(name)) name = Palettes.names().find(matches) ?? CUSTOM;
        if (name !== mConfig.palette) {
            mConfig.palette = name;
            if (mParams) mParams.palette.updateDisplay();
        }
    }

    // The palette choice changed. `picked` is the new value when the user picked
    // it in the choice (dat.gui passes it on), a document or a script sets the
    // choice without arguments: no undo step for those.
    function _onPaletteChanged(picked) {
        const recipe = Palettes.get(mConfig.palette);
        if (recipe) {
            if (picked !== undefined) _pushUndo();
            _applyRecipe(recipe);
        } else if (mConfig.palette !== CUSTOM) {
            _syncPaletteName();    // a name this browser does not know
        }
        // 'custom' keeps the colors as they are
    }

    async function _savePalette() {
        const dialog  = getPrompt();
        const current = mConfig.palette;
        const name = await dialog.prompt({
            title:    'Save palette',
            label:    'Name:',
            value:    Palettes.isUser(current) ? current : '',
            okLabel:  'Save',
            message:  'Keeps these colors, the adjustments, the colors set by hand and the alphas in this browser, for all layers and documents.',
            validate: async (v) => Palettes.validateName(v),
        });
        if (name === null) return;

        const recipe = _getRecipe();
        if (Palettes.isUser(name) && !Palettes.same(Palettes.get(name), recipe)) {
            const replace = await dialog.confirm({
                title: 'Save palette', message: `Replace the palette "${name}"?`, okLabel: 'Replace',
            });
            if (!replace) return;
        }
        mConfig.palette = name;               // these colors are the palette now
        Palettes.saveUser(name, recipe);      // every layer refreshes its list
    }

    async function _deletePalette() {
        const name = mConfig.palette;
        if (!Palettes.isUser(name)) return;
        const yes = await getPrompt().confirm({
            title: 'Delete palette', message: `Delete the palette "${name}"?`, okLabel: 'Delete',
        });
        if (yes) Palettes.removeUser(name);
    }

    // The palette as text on the clipboard: it goes to another document, or to a
    // text editor and back (JSON, see Palettes.toText).
    async function _copyPalette() {
        const text = Palettes.toText(_getRecipe());
        if (await writeClipboardText(text)) {
            mParams?.strip.flash();
            return;
        }
        // this page may not use the clipboard: show the text selected, to copy by hand
        await getPrompt().prompt({
            title:   'Copy palette',
            label:   'Palette:',
            value:   text,
            okLabel: 'Close',
            message: 'The browser did not let this page use the clipboard. Press Ctrl+C to copy the text of the palette.',
        });
    }

    // Replaces all the colors of this layer by the palette on the clipboard, one undo
    // step. When the clipboard can not be read or holds no palette, the text is asked
    // for in the prompt dialog (Ctrl+V), which refuses text that is no palette.
    async function _pastePalette() {
        let text  = await readClipboardText();
        let found = (text === null) ? null : Palettes.fromText(text);
        if (!found?.recipe) {
            const why = (text === null)
                ? 'The browser did not let this page read the clipboard.'
                : `The clipboard holds no palette. ${found.error}`;
            text = await getPrompt().prompt({
                title:    'Paste palette',
                label:    'Palette:',
                value:    text ?? '',
                okLabel:  'Paste',
                message:  `${why} Paste the text of a palette here (Ctrl+V):`,
                validate: async (v) => Palettes.fromText(v).error,
            });
            if (text === null) return;
            found = Palettes.fromText(text);
        }
        if (!Palettes.same(found.recipe, _getRecipe())) {
            _pushUndo();
            _applyRecipe(found.recipe);
        }
        mParams?.strip.flash();
    }

    // All the palettes saved in this browser to a file the user keeps: the browser's
    // storage is no place for the long term.
    async function _exportPalettes() {
        const result = await saveTextFileAs('sympix-palettes.json', Palettes.libraryToText(), 'application/json');
        if (result?.success) mParams?.strip.flash();
    }

    // The palettes of a palette file are added to the saved ones, none is deleted.
    // When a saved palette has the name of one in the file but other colors, the user
    // chooses once: keep both (the imported one gets a new name) or replace.
    async function _importPalettes() {
        const file = await openFile([{ description: 'Palette files', accept: { 'application/json': ['.json'] } }]);
        if (!file) return;
        const dialog  = getPrompt();
        const title   = 'Import palettes';
        const library = Palettes.libraryFromText(await file.text());
        if (library.error) {
            await dialog.alert({ title, message: `${file.name}\n\n${library.error}` });
            return;
        }
        let replace = false;
        const conflicts = Palettes.conflicts(library.entries);
        if (conflicts.length) {
            const how = await dialog.choose({
                title,
                message:  `Saved palettes with these names have other colors than the ones in the file: ` +
                          `${_quoted(conflicts)}.\n\nKeep both, the imported ones under a new name, ` +
                          `or replace the saved ones?`,
                okLabel:  'Keep both',
                altLabel: 'Replace',
            });
            if (how === null) return;
            replace = (how === 'alt');
        }
        const done = Palettes.merge(library.entries, { replace });
        await dialog.alert({ title, message: `${file.name}\n\n${_importSummary(done, library.skipped)}` });
    }

    // "a", "b", "c" and 2 more
    function _quoted(names) {
        const shown = names.slice(0, 3).map(name => `"${name}"`).join(', ');
        return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown;
    }

    // what an import did, in words
    function _importSummary(done, skipped) {
        const lines = [];
        if (done.added.length)    lines.push(`Added ${done.added.length}: ${_quoted(done.added)}.`);
        if (done.replaced.length) lines.push(`Replaced ${done.replaced.length}: ${_quoted(done.replaced)}.`);
        if (done.renamed.length)  lines.push(`Kept both, the imported under a new name: ${_quoted(done.renamed.map(r => r.to))}.`);
        if (done.same.length)     lines.push(`Left alone, saved already with the same colors: ${done.same.length}.`);
        for (const s of skipped.slice(0, 3)) lines.push(`Skipped: ${s.reason}`);
        if (skipped.length > 3)   lines.push(`${skipped.length - 3} more skipped.`);
        return lines.join('\n');
    }

    // The commands of the palette, in the menu button of the strip: the editing,
    // this palette, the saved palettes. The items are asked each time the menu
    // opens, what does not apply is dimmed.
    function _stripMenu() {
        const saved = Palettes.userNames().length;
        const own   = Palettes.isUser(mConfig.palette);
        return [
            {label: 'Randomize', disabled: !_canRandomize(), action: _randomize,
             title: _canRandomize()
                 ? 'A random palette. Only the parts ticked under "randomize parameters" change; the colors edited by hand, the alphas and the adjustments stay'
                 : 'Tick at least one part under "randomize parameters" first'},
            {label: 'Undo', disabled: mUndo.length === 0, action: _undo,
             title: 'Undo the last randomize, palette pick, paste or reset'},
            {label: 'Redo', disabled: mRedo.length === 0, action: _redo,
             title: 'Redo what was undone'},
            {separator: true},
            {label: 'Reset colors', disabled: !_hasEdited(), action: _resetEdited,
             title: 'Give all the colors edited by hand and all the alphas set in the strip their palette values back'},
            {label: 'Copy palette', action: _copyPalette,
             title: 'Copy the palette to the clipboard as text: the colors, the adjustments, the colors edited by hand and the alphas'},
            {label: 'Paste palette', action: _pastePalette,
             title: 'Replace all the colors of this layer by the palette on the clipboard, copied here, in another document or from a text editor'},
            {separator: true},
            {label: 'Save palette…', action: _savePalette,
             title: 'Keep these colors as a palette with a name, in this browser; Export palettes… keeps all the saved palettes in a file'},
            {label: 'Delete palette', disabled: !own, action: _deletePalette,
             title: own ? `Delete the saved palette "${mConfig.palette}"`
                        : 'Only a palette you saved can be deleted: pick one in the palette choice first'},
            {label: 'Export palettes…', disabled: saved === 0, action: _exportPalettes,
             title: saved ? 'Save all the palettes saved in this browser to a file, to keep them for good or to use them in another browser'
                          : 'There are no saved palettes to export: use Save palette… to save one'},
            {label: 'Import palettes…', action: _importPalettes,
             title: 'Add the palettes of a file written by Export palettes… to the ones saved in this browser; none is deleted'},
        ];
    }

    // a user palette was saved or deleted, here or in another layer
    function onPalettesChanged() {
        if (!mParams) return;
        mParams.palette.updateChoices([CUSTOM, ...Palettes.names()]);
        _syncPaletteName();
    }


    // ------------------------------------------------------------------ //
    //  Params
    // ------------------------------------------------------------------ //

    let mParams = null;

    function makeParams() {
        const oc = _onChange;
        const cf = mConfig;
        // the folder of a, b, c and d: only their UI goes into it, the saved values
        // stay a, b, c and d of the params, where documents have them
        const paletteFolder = ParamUiFolder({name: 'palette parameters'});
        const row = (name, range, tooltip) => paletteFolder.contain(ParamFloatVector({
            name, obj: cf, keys: [name + 'R', name + 'G', name + 'B'], labels: ['R', 'G', 'B'],
            ...range, step: 0.001, onChange: oc, tooltip,
        }));
        return {
            count:     ParamInt   ({obj: cf, key: 'count',     min: 1, max: MAX_COLORS_COUNT, step: 1, onChange: oc}),
            strip:     ParamColorStrip({getItems: _stripItems, onPick: _onPickColor, onReset: _onResetColor,
                                        onAlpha: _onPickAlpha, onAlphaReset: _onResetAlpha,
                                        menu: _stripMenu,
                                        menuTooltip: 'Palette menu: randomize, undo, reset, copy, paste, save, delete, export, import'}),
            palette:   ParamChoice({obj: cf, key: 'palette',   choice: [CUSTOM, ...Palettes.names()], onChange: _onPaletteChanged}),

            // the cosine palette  a + b * cos(2π (c * t + d))  per channel, one row each
            paletteFolder,
            a: row('a', {min: 0, max: 1}, 'a: the middle of each channel (R, G, B) of the palette'),
            b: row('b', {min: 0, max: 1}, 'b: how far each channel swings around its middle (contrast)'),
            c: row('c', {},               'c: how many times each channel cycles over the colors'),
            d: row('d', {min: 0, max: 1}, 'd: where each channel starts its cycle; the shifts between R, G and B make the hues'),

            vary: ParamGroup({
                name: 'randomize parameters',
                serializable: false,
                params: {
                    a: ParamBool({obj: mVary, key: 'a', name: 'a: offset',   serializable: false}),
                    b: ParamBool({obj: mVary, key: 'b', name: 'b: contrast', serializable: false}),
                    c: ParamBool({obj: mVary, key: 'c', name: 'c: cycles',   serializable: false}),
                    d: ParamBool({obj: mVary, key: 'd', name: 'd: phase',    serializable: false}),
                }
            }),

            adjust: ParamGroup({
                name: 'adjust',
                params: {
                    hueShift:     ParamFloat({obj: cf, key: 'adjHueShift',     name: 'hueShift',     min: -1, max: 1, step: 0.005, onChange: oc}),
                    satMult:      ParamFloat({obj: cf, key: 'adjSatMult',      name: 'satMult',      min: 0,    max: 4,   step: 0.01, onChange: oc}),
                    lightOffset:  ParamFloat({obj: cf, key: 'adjLightOffset',  name: 'lightOffset',  min: -1,   max: 1,   step: 0.01, onChange: oc}),
                    contrastMult: ParamFloat({obj: cf, key: 'adjContrastMult', name: 'contrastMult', min: 0,    max: 4,   step: 0.01, onChange: oc}),
                    reset:        ParamFunc({name: 'Reset adjust', func: _resetAdjust,
                                             tooltip: 'No hue shift, saturation and contrast as they are, no offset'}),
                }
            }),

            // no UI, only the saved form of the colors edited by hand and of the alphas
            edited: mEditedParam,
            alphas: mAlphasParam,
        };
    }

    function getParams() {
        if (!mParams) {
            mParams = makeParams();
            _syncPaletteName();
            _updateStrip();
        }
        return mParams;
    }

    // ------------------------------------------------------------------ //
    //  Public API
    // ------------------------------------------------------------------ //

    function setOnChange(fn) { mOnChange = fn; }

    /** Float32Array(MAX_COLORS_COUNT * 4) — premultiplied RGBA, upload as uCellColors each frame. */
    function getPremultColors() { return mPremultColors; }

    /** Float32Array(MAX_COLORS_COUNT * 4) — straight (non-premultiplied) RGBA. */
    function getColors() { return mColors; }

    /** Number of active color slots (== mConfig.count). */
    function getCount() { return mConfig.count; }

    /** Index into the permutation used to look up the active cell color. */
    function getPermIndex() { return getPermIndexVal(); }

    const self = {
        getParams,
        getColors,
        getPremultColors,
        getCount,
        getPermIndex,
        setOnChange,
        update:          _onChange,
        onPalettesChanged,
        getClassName:    () => MYNAME,
        get enabled() { return true; },
    };

    Palettes.subscribe(self);

    return self;


} // ColorTiles

export { ColorTiles };
