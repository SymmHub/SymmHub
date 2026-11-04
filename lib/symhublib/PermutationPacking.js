import {
    wordToPerm,
} from './modules.js';

//
//  Packing of color permutations for the shaders (permutations24.glsl.mjs):
//  up to MAX_COLORS_COUNT values of 5 bits, 6 per component of a uvec4.
//  The permutations themselves come from lib/grouplib/Permutations.js.
//

export const MAX_COLORS_COUNT = 24;
// the permutations the shaders hold, one per side of the domain: more than
// the 26 letters a Dirichlet domain's sides are named by (MAX_PERM_COUNT of
// permutations24.glsl.mjs)
export const MAX_PERM_COUNT = 32;

export function packPerm(perm) {
    const result = new Uint32Array(4);
    for (let i = 0; i < MAX_COLORS_COUNT; i++) {
        const val = (i < perm.length) ? perm[i] : i;
        const comp  = Math.floor(i / 6);
        const shift = (i % 6) * 5;
        result[comp] |= (val << shift);
    }
    return result;
}

/** the permutations of the sides as the shaders take them: MAX_PERM_COUNT packed values */
export function packSidePerms(perms) {
    const data = new Uint32Array(MAX_PERM_COUNT * 4);
    perms.slice(0, MAX_PERM_COUNT).forEach((perm, k) => data.set(packPerm(perm), k * 4));
    return data;
}

/**
 * Computes packed permutation data for the crown transforms.
 * Maps each transform's word representation to its color permutation,
 * packs the permutation, and stores it in a flat Uint32Array.
 *
 * @param {Array<ITransform>} transforms - The array of transforms.
 * @param {Array<Array<number>>} generatorPerms - Array of permutation arrays.
 * @param {boolean} useOrbit - true: coloring by orbits, false: coloring by cosets (was: leftCoset, same values).
 * @param {Array<string>} [names] - The names of the sides the permutations go with, as wordToPerm.
 * @returns {Uint32Array} Packed permutation data of size transforms.length * 4.
 */
export function transToPackedPerms(transforms, generatorPerms, invGeneratorPerms, useOrbit, names) {
    const crownPerms = new Uint32Array(transforms.length * 4);
    const loopCount = transforms.length;

    for (let g = 0; g < loopCount; g++) {
        const t = transforms[g];
        const perm = wordToPerm(t.getWord(), generatorPerms, invGeneratorPerms, useOrbit, names);
        const packed = packPerm(perm);
        crownPerms.set(packed, g * 4);
    }

    return crownPerms;
}
