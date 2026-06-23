const CHAR_a = 'a'.charCodeAt(0);
const CHAR_z = 'z'.charCodeAt(0);
const CHAR_A = 'A'.charCodeAt(0);
const CHAR_Z = 'Z'.charCodeAt(0);

export const MAX_COLORS_COUNT = 24;

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
 * Maps a word character to its color permutation with a swapped convention:
 *   lowercase 'a'-'z'  →  invGeneratorPerms[charCode - 'a']
 *   uppercase 'A'-'Z'  →  generatorPerms[charCode - 'A']
 *
 * Works correctly for crown rendering. Reason for the swap is not fully understood.
 */
// Works correctly for crown rendering. Reason for the swapped convention is not fully understood.
function getGeneratorPerm(charCode, generatorPerms, invGeneratorPerms) {
    if (charCode >= CHAR_a && charCode <= CHAR_z) { // lowercase 'a'-'z'
        return invGeneratorPerms[charCode - CHAR_a];
    } else if (charCode >= CHAR_A && charCode <= CHAR_Z) { // uppercase 'A'-'Z'
        return generatorPerms[charCode - CHAR_A];
    }
    return null;
}

// Works correctly for crown rendering. Reason for the swapped convention is not fully understood.
export function wordToPerm(word, generatorPerms, invGeneratorPerms, leftCoset) {
    const size = (generatorPerms && generatorPerms[0]) ? generatorPerms[0].length : 0;
    let current = [];
    for (let i = 0; i < size; i++) {
        current.push(i);
    }

    for (let i = 0; i < word.length; i++) {
        const charCode = word.charCodeAt(i);
        const stepPerm = getGeneratorPerm(charCode, generatorPerms, invGeneratorPerms);
        if (stepPerm) {
            if (leftCoset) {
                current = composePerms(stepPerm, current);
            } else {
                current = composePerms(current, stepPerm);
            }
        }
    }
    return current;
}

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

/**
 * Computes packed permutation data for the crown transforms.
 * Maps each transform's word representation to its color permutation,
 * packs the permutation, and stores it in a flat Uint32Array.
 * 
 * @param {Array<ITransform>} transforms - The array of transforms.
 * @param {Array<Array<number>>} generatorPerms - Array of permutation arrays.
 * @param {boolean} leftCoset - If true, applies left coset multiplication order.
 * @returns {Uint32Array} Packed permutation data of size transforms.length * 4.
 */
export function transToPackedPerms(transforms, generatorPerms, invGeneratorPerms, leftCoset) {
    const crownPerms = new Uint32Array(transforms.length * 4);
    const loopCount = transforms.length;

    for (let g = 0; g < loopCount; g++) {
        const t = transforms[g];
        const perm = wordToPerm(t.getWord(), generatorPerms, invGeneratorPerms, leftCoset);
        const packed = packPerm(perm);
        crownPerms.set(packed, g * 4);
    }

    return crownPerms;
}
