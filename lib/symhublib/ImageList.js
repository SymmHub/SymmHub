//
//  the images list of a colour layer (Color Images' `images`): what the tiles
//  of each coset show.
//
//    layer1 layer2         coset 0: layer1; coset 1 and the ones after: layer2
//    layer1+layer3 layer2  coset 0: layer1 and layer3; coset 1 on: layer2
//    - layer2              coset 0: nothing; coset 1 on: layer2
//    layer1                every coset: layer1
//    (empty)               every component in every coset
//
//  Entries are separated by spaces, the names in one entry by '+', and '-'
//  is an entry naming nothing. Entry j is seen in the tiles of coset j, the
//  last entry also in the cosets after it, as the buffer path's array of
//  images is indexed (its layer index clamped). So a component name has no
//  spaces or '+' and is not '-'.
//

const EMPTY_ENTRY = '-';
const JOIN = '+';

/** the entries of a list: an array of arrays of names ([] for '-'); [] for an empty list */
function parseImageList(str){
    const tokens = (str || '').trim().split(/\s+/).filter(Boolean);
    return tokens.map(t => t === EMPTY_ENTRY ? [] : t.split(JOIN).filter(Boolean));
}

/** the list written from its entries */
function formatImageList(entries){
    return entries.map(e => e.length ? e.join(JOIN) : EMPTY_ENTRY).join(' ');
}

/** every name of the entries, once each, in the order they first come */
function imageListNames(entries){
    return [...new Set(entries.flat())];
}

/** the entry seen in the tiles of coset k, null when the list is empty (everything everywhere) */
function imageListEntry(entries, k){
    return entries.length ? entries[Math.min(k, entries.length - 1)] : null;
}

/**
 * the cosets whose tiles show the component with the name, as a bit mask
 * (bit k: coset k, for k below count); every bit for an empty list
 */
function imageListCosets(entries, name, count){
    let mask = 0;
    for (let k = 0; k < count; k++) {
        const entry = imageListEntry(entries, k);
        if (!entry || entry.includes(name)) mask |= (1 << k);
    }
    return mask >>> 0;
}

/** the list with one name renamed wherever it is named; the rest kept as written */
function renameInImageList(str, from, to){
    const entries = parseImageList(str);
    if (!entries.some(e => e.includes(from))) return str;
    return formatImageList(entries.map(e => e.map(n => n === from ? to : n)));
}

/** why a component name cannot be listed, null when it can */
function imageListNameProblem(name){
    if (!name) return 'the name is empty';
    if (/\s/.test(name)) return 'no spaces: a Color Images layer lists names with spaces between them';
    if (name.includes(JOIN)) return `no "${JOIN}": a Color Images layer joins names shown in one coset with it`;
    if (name === EMPTY_ENTRY) return `not "${EMPTY_ENTRY}": in a Color Images layer's list it is a coset showing nothing`;
    return null;
}

export {
    parseImageList,
    formatImageList,
    imageListNames,
    imageListEntry,
    imageListCosets,
    renameInImageList,
    imageListNameProblem,
};
