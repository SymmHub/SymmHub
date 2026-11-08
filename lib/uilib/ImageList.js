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
//  A drawing's (drawlib) names are its layers' ids, its groups' and its
//  items': a shape is shown in the cosets whose entries name its layer, a
//  group holding it, or the shape itself, so a shape has several names.
//
//  The edits of ParamImageList's chips (one chip per entry) are the functions
//  after imageListNameProblem: each takes the list's text and gives the new
//  text, the entries other than the one edited written as they were.
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
 * the cosets whose tiles show the component with the name, or with any of
 * the names of an array (a drawing's shape: its layer's, its groups', its
 * own), as a bit mask (bit k: coset k, for k below count); every bit for an
 * empty list
 */
function imageListCosets(entries, name, count){
    const names = Array.isArray(name) ? name : [name];
    let mask = 0;
    for (let k = 0; k < count; k++) {
        const entry = imageListEntry(entries, k);
        if (!entry || names.some(n => entry.includes(n))) mask |= (1 << k);
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

/**
 * the cosets each entry is seen in, for count cosets: an array per entry
 * (entry j: [j], the last also the cosets after it, [] for an entry past the
 * cosets there are); an empty list is one entry seen in every coset
 */
function imageListEntryCosets(entries, count){
    const range = (from, to) => Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
    if (!entries.length) return [range(0, count)];
    return entries.map((e, j) => j >= count ? [] : (j === entries.length - 1 ? range(j, count) : [j]));
}

/** the list with entry j naming the names ([]: nothing); an empty list gets its first entry for j 0 */
function setImageListEntry(str, j, names){
    const entries = parseImageList(str);
    if (j < 0 || j > entries.length || (j === entries.length && j > 0)) return str;
    entries[j] = [...new Set(names)];
    return formatImageList(entries);
}

/**
 * the list with the name taken out of entry j, or put at its end when it
 * was not there; an empty list (every component in every coset) becomes the
 * one entry of the name
 */
function toggleImageListName(str, j, name){
    const entries = parseImageList(str);
    const entry = entries.length ? entries[j] : [];
    if (!entry) return str;
    return setImageListEntry(str, entries.length ? j : 0,
        entry.includes(name) ? entry.filter(n => n !== name) : [...entry, name]);
}

/** the list with one more entry, as the last: the cosets the last entry was seen in show the same */
function addImageListEntry(str){
    const entries = parseImageList(str);
    if (!entries.length) return str;
    entries.push([...entries[entries.length - 1]]);
    return formatImageList(entries);
}

/** the list without entry j: the cosets after it show what the entries after it named */
function removeImageListEntry(str, j){
    const entries = parseImageList(str);
    if (j < 0 || j >= entries.length) return str;
    entries.splice(j, 1);
    return formatImageList(entries);
}

/** the list with entry j naming what entry j+1 names */
function copyNextImageListEntry(str, j){
    const entries = parseImageList(str);
    if (j < 0 || j + 1 >= entries.length) return str;
    entries[j] = [...entries[j + 1]];
    return formatImageList(entries);
}

export {
    imageListEntryCosets,
    setImageListEntry,
    toggleImageListName,
    addImageListEntry,
    removeImageListEntry,
    copyNextImageListEntry,
    parseImageList,
    formatImageList,
    imageListNames,
    imageListEntry,
    imageListCosets,
    renameInImageList,
    imageListNameProblem,
};
