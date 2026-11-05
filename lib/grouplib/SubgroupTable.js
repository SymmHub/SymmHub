import {
    subgroupsData,
    getPreset,
    makePresentation,
    strToPermutations,
    invertPerm,
} from './modules.js';

//
//  The table of subgroups of a group given by its presentation, as the colour
//  layers (Subgroups.js) and the overlay items (OverlaySymmetry.js) use it.
//
//  A presentation is what a group maker's getPresentation() returns:
//
//    { name, label, family, domainShape, gens, relators }  or
//    { name, label, domainShape, preset }
//
//  gens are single lowercase letters, the k-th one goes with side k of the group
//  (the sides of the carrier for a group given by generators); preset is the sublib
//  key of a catalogue group. Words act left to right, see GroupPresentation.js.
//  null, or neither gens nor preset, means there is no presentation.
//
//  The number of subgroups grows steeply with the index once a group is not a
//  crystallographic one: 16 519 classes to index 8 for a right angled pentagon, half
//  a million to index 6 for a free group on 3 generators. So a table is cut at
//  TABLE_MAX_SUBGROUPS (at the last index which fits) and at TABLE_DEADLINE_MS.
//

export const DEFAULT_MAX_INDEX = 24;
export const MAX_MAX_INDEX = 24;
export const TABLE_MAX_SUBGROUPS = 2000;
export const TABLE_DEADLINE_MS = 3000;

/** a max index a table can be made for */
export function clampMaxIndex(value) {
    const n = Math.floor(Number(value));
    return Math.min(Math.max(1, Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_INDEX), MAX_MAX_INDEX);
}

/** the {gens, relators} strings of a presentation, null when it has none */
export function presentationSpec(pres) {
    if (!pres) return null;
    if (pres.gens) return { gens: pres.gens, relators: pres.relators || '' };
    if (pres.preset) {
        const preset = getPreset(pres.preset);
        return { gens: preset.gens, relators: preset.relators };
    }
    return null;
}

/** identifies a presentation: equal keys give equal tables; null when there is none */
export function presentationKey(pres) {
    const spec = presentationSpec(pres);
    return spec ? `${pres.label || pres.name || ''} | ${spec.gens} | ${spec.relators}` : null;
}

/** the presentation in words: <a b c | a^2, b*c>, '' when there is none */
export function presentationText(pres) {
    const spec = presentationSpec(pres);
    return spec ? `<${spec.gens} | ${spec.relators}>` : '';
}

/**
 * the table of subgroups of index up to maxIndex, cut as said above
 *
 * @param {object} pres    a presentation
 * @param {object} [opt]   {maxIndex, maxSubgroups, deadlineMs}
 * @returns {object|null}  the subgroupsData() result, null without a presentation. Its
 *                         maxIndex is the index reached; nextIndex, nextIndexCount tell
 *                         what the budget left out, stats.aborted that the clock stopped it
 */
export function subgroupTable(pres, opt = {}) {
    if (!presentationSpec(pres)) return null;
    const limits = {
        maxIndex:     clampMaxIndex(opt.maxIndex),
        maxSubgroups: opt.maxSubgroups ?? TABLE_MAX_SUBGROUPS,
        deadlineMs:   opt.deadlineMs ?? TABLE_DEADLINE_MS,
        generators:   'none',
    };
    return pres.gens
        ? subgroupsData({ name: pres.name, gens: pres.gens, relators: pres.relators || '', ...limits })
        : subgroupsData({ preset: pres.preset, ...limits });
}

/**
 * do the permutations fit the group? They are one per generator, the same size, and
 * the relators hold for them the way the layers compose them: a fold across sides
 * s1, s2, ... accumulates p(s1) p(s2) ... (the last one acts first) without useOrbit
 * and ... p(s2) p(s1) with it (wordToPerm).
 *
 * This is a question and not a rule: typed permutations are legitimate either way, and
 * what does not fit shows as seams between the colours.
 *
 * @param {object}  pres      a presentation or null: the check stops at the permutations
 * @param {string}  str       the layer's permutations
 * @param {boolean} [useOrbit]
 * @returns {{ok: boolean, reason: string}}
 */
export function checkPermutations(pres, str, useOrbit = false) {
    const perms = strToPermutations(str);
    if (perms.length === 0) return { ok: true, reason: '' };

    const size = perms[0].length;
    for (let k = 0; k < perms.length; k++) {
        if (perms[k].length !== size) {
            return { ok: false, reason: `permutation ${k + 1} has ${perms[k].length} letters, the first has ${size}` };
        }
        if (new Set(perms[k]).size !== size || perms[k].some(v => v < 0 || v >= size)) {
            return { ok: false, reason: `permutation ${k + 1} is not a permutation of ${size} letters` };
        }
    }

    const spec = presentationSpec(pres);
    if (!spec) return { ok: true, reason: '' };
    const parsed = makePresentation(spec.gens, spec.relators);
    if (perms.length !== parsed.gens.length) {
        return { ok: false, reason: `${perms.length} permutations for ${parsed.gens.length} generators` };
    }

    // a relator read left to right, in the order the layers compose the steps of a fold
    const inverse = perms.map(invertPerm);
    const forward  = useOrbit ? inverse : perms;
    const backward = useOrbit ? perms : inverse;
    for (let r = 0; r < parsed.relators.length; r++) {
        for (let start = 0; start < size; start++) {
            let c = start;
            for (const x of parsed.relators[r]) c = (x > 0 ? forward[x - 1] : backward[-x - 1])[c];
            if (c !== start) return { ok: false, reason: `the relator ${parsed.relStrings[r]} does not hold` };
        }
    }
    return { ok: true, reason: '' };
}

/**
 * the permutations a layer takes from an entry of a table: invcos, the form documents
 * have always had, and cosets where invcos does not fit. The relators of a table hold
 * for cosets read left to right, so invcos fits with useOrbit; without it invcos needs
 * the relators to hold reversed as well, which most presentations do, but not those of
 * the 4*2 square and the 3*3 kite, and there the cosets fit.
 */
export function entryPermutations(pres, entry, useOrbit = false) {
    return checkPermutations(pres, entry.invcos, useOrbit).ok ? entry.invcos : entry.cosets;
}
