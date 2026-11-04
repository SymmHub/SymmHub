const CHAR_a = 'a'.charCodeAt(0);

//
//  Color permutations of a group's words. Their packing for the shaders
//  (packPerm, transToPackedPerms) is in lib/symhublib/PermutationPacking.js.
//

export function composePerms(outer, inner) {
    const len = Math.max(outer.length, inner.length);
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
        result[i] = outer[inner[i]];
    }
    return result;
}

export function invertPerm(perm) {
    const inv = new Array(perm.length);
    for (let i = 0; i < perm.length; i++) {
        inv[perm[i]] = i;
    }
    return inv;
}

/**
 * Maps a word's letter to its color permutation:
 *   the name of side k                 →  invGeneratorPerms[k]
 *   that name in the other case        →  generatorPerms[k]
 *
 * generatorPerms[k] goes with the step of a fold across side k, the reverse transform
 * of the side (the shaders: iToFundamentalDomainSamplerPerm24), while a side's name
 * is the side's direct transform and the other case the reverse. The sides are named
 * a b c ... when no names are given, which is not so in every group: KLMN's are
 * a b B A C c, its c is the sixth side.
 */
function getGeneratorPerm(letter, generatorPerms, invGeneratorPerms, names) {
    const sideOf = x => names ? names.indexOf(x) : x.charCodeAt(0) - CHAR_a;
    const side = sideOf(letter);
    if (side >= 0) return invGeneratorPerms[side];
    const lower = letter.toLowerCase();
    const reversed = sideOf(letter === lower ? letter.toUpperCase() : lower);
    return reversed >= 0 ? generatorPerms[reversed] : null;
}

/**
 * the permutation of a word's transform, as a fold composes its steps (a word's letters
 * act in the order written)
 *
 * @param {Array<string>} [names]  the names of the sides the permutations go with, in
 *                                 their order (group.getGenNames()): a b c ... if left out
 */
export function wordToPerm(word, generatorPerms, invGeneratorPerms, useOrbit, names) {
    const size = (generatorPerms && generatorPerms[0]) ? generatorPerms[0].length : 0;
    let current = [];
    for (let i = 0; i < size; i++) {
        current.push(i);
    }

    for (let i = 0; i < word.length; i++) {
        const stepPerm = getGeneratorPerm(word[i], generatorPerms, invGeneratorPerms, names);
        if (stepPerm) {
            if (useOrbit) {
                current = composePerms(stepPerm, current);
            } else {
                current = composePerms(current, stepPerm);
            }
        }
    }
    return current;
}

/**
 * the colour permutations of the sides of a group as the shaders take them (the k-th
 * goes with a fold across side k) from the permutations of a document's generators.
 * They are the same but for a Dirichlet domain, whose sides are words of the generators
 * (group.dirichletWords, in the letters group.dirichletSideNames): the fold across side
 * k applies the inverse of its word, the reverse transforms of the word's letters from
 * the last to the first, and the side's permutation is what a fold through those steps
 * accumulates. It acts on the same cosets, so the colours are those of the group, and
 * the composition is exact however long the word.
 *
 * @param {object} group  the group drawn, or null
 * @param {Array<Array<number>>} generatorPerms  one permutation per generator
 * @param {boolean} useOrbit  as wordToPerm: the shaders compose in the other order
 * @returns {Array<Array<number>>} one permutation per side of `group`
 */
export function sidePermutations(group, generatorPerms, useOrbit) {
    const words = group ? group.dirichletWords : null;
    if (!words || generatorPerms.length === 0) return generatorPerms;
    const names = group.dirichletSideNames;
    const identity = generatorPerms[0].map((_, i) => i);
    return words.map(word => {
        let current = identity;
        for (let i = word.length - 1; i >= 0; i--) {
            const step = generatorPerms[names.indexOf(word[i])];
            if (step) current = useOrbit ? composePerms(step, current) : composePerms(current, step);
        }
        return current;
    });
}

/**
 * Parses a space-separated permutations string into an array of permutation arrays.
 * 
 * @param {string} permutationsStr - Space-separated list of generator permutations.
 * @returns {Array<Array<number>>} Array of permutation arrays.
 */
export function strToPermutations(permutationsStr) {
    const words = permutationsStr ? permutationsStr.trim().split(/\s+/).filter(Boolean) : [];
    return words.map(word => {
        const perm = [];
        for (let i = 0; i < word.length; i++) {
            perm.push(word.charCodeAt(i) - CHAR_a);
        }
        return perm;
    });
}
