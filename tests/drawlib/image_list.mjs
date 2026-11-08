/*
  tests of a colour layer's images list, what the tiles of each coset show
  (lib/uilib/ImageList.js), as symdraw's sprites per coset read it

    node tests/drawlib/image_list.mjs

  1. parse and format: entries by spaces, names in one by '+', '-' for none
  2. the cosets of a name: entry j for coset j, the last for the ones after it,
     an empty list everything everywhere, an entry of nothing nothing
  3. a rename follows the name in every entry and leaves the rest as written
  4. names a list cannot hold: spaces, '+', '-'
  5. Color Images' componentIds: the names listed, [] for everything, null for nothing
  6. the chips' edits (ParamImageList): the cosets of each entry, a name toggled
     in entry j, an entry set, added, removed, made the same as the next; the
     lists made so equal the typed ones (the 6.24 cases)
*/

import {
    parseImageList, formatImageList, imageListNames, imageListEntry,
    imageListCosets, renameInImageList, imageListNameProblem,
    imageListEntryCosets, setImageListEntry, toggleImageListName,
    addImageListEntry, removeImageListEntry, copyNextImageListEntry,
} from '../../lib/uilib/ImageList.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bits = mask => [...Array(6)].map((_, k) => (mask >>> k) & 1).join('');

// 1 ───────────────────────────────────────────────────────────────────────────

check(same(parseImageList(''), []), 'an empty list has no entries');
check(same(parseImageList('   '), []), 'nor one of spaces');
check(same(parseImageList(undefined), []), 'nor none');
check(same(parseImageList('layer1'), [['layer1']]), 'one name');
check(same(parseImageList(' layer1   layer2 '), [['layer1'], ['layer2']]), 'two cosets, spaces as they come');
check(same(parseImageList('layer1+layer3 layer2'), [['layer1', 'layer3'], ['layer2']]), 'two names in a coset');
check(same(parseImageList('- layer2'), [[], ['layer2']]), "'-': a coset showing nothing");
check(same(parseImageList('a++b+'), [['a', 'b']]), "stray '+' left out");
for (const s of ['layer1', 'layer1 layer2', 'layer1+layer3 layer2', '- layer2', 'a - b+c -'])
    check(formatImageList(parseImageList(s)) === s, `written back as it was: "${s}"`);
check(same(imageListNames(parseImageList('a+b - b c+a')), ['a', 'b', 'c']), 'every name once, in order');
check(same(imageListEntry([], 3), null), 'an empty list: no entry, everything');
check(same(imageListEntry(parseImageList('a b+c'), 0), ['a']) && same(imageListEntry(parseImageList('a b+c'), 5), ['b', 'c']),
      'the last entry for the cosets after it');

// 2 ───────────────────────────────────────────────────────────────────────────

{
    const n = 6;
    const cases = [
        ['', 'a', '111111', 'an empty list: every coset'],
        ['a', 'a', '111111', 'one entry: every coset'],
        ['a', 'b', '000000', 'a layer not listed: none'],
        ['a b', 'a', '100000', 'the first entry: coset 0'],
        ['a b', 'b', '011111', 'the last: coset 1 and the ones after'],
        ['a+c b', 'c', '100000', 'a name joined in coset 0'],
        ['- b', 'b', '011111', "after '-'"],
        ['a -', 'a', '100000', "'-' last: the cosets after it show nothing"],
        ['a b a', 'a', '101111', 'a name in two entries: both'],
        ['b a b', 'b', '101111', 'the last of them reaching on'],
    ];
    for (const [list, name, want, what] of cases) {
        const got = bits(imageListCosets(parseImageList(list), name, n));
        check(got === want, `${what}: "${list}" ${name} ${got}, wanted ${want}`);
    }
    check(imageListCosets(parseImageList('a b'), 'b', 2) === 0b10, 'only the cosets there are');
    const all = imageListCosets([], 'a', 24);
    check(all === 0xffffff && ((all << 8) >> (8 + 23) & 1) === 1, `24 cosets fit above the slot's byte: ${all.toString(16)}`);
}

// 3 ───────────────────────────────────────────────────────────────────────────

check(renameInImageList('layer1 layer2', 'layer2', 'sky') === 'layer1 sky', 'a rename in a list of names');
check(renameInImageList('layer1+layer3 - layer3', 'layer3', 'sea') === 'layer1+sea - sea', 'in every entry, joined or not');
check(renameInImageList('layer1   layer2', 'other', 'x') === 'layer1   layer2', 'nothing named: the list as written');
check(renameInImageList('', 'layer1', 'x') === '', 'an empty list stays empty');
check(renameInImageList('layer10 layer1', 'layer1', 'x') === 'layer10 x', 'whole names only');

// 4 ───────────────────────────────────────────────────────────────────────────

check(imageListNameProblem('layer2') === null, 'a plain name');
check(imageListNameProblem('sky_2.b') === null, 'with marks other than + and -');
check(imageListNameProblem('a-b') === null, "'-' inside a name");
for (const bad of ['', 'two words', 'a+b', '-'])
    check(typeof imageListNameProblem(bad) === 'string', `refused: "${bad}"`);

// 5 ───────────────────────────────────────────────────────────────────────────

{
    const { VisualizationColorSym } = await import('../../lib/symhublib/VisualizationColorSym.js');
    const ids = (imageId, opacity = 1) => VisualizationColorSym({ config: { imageId, opacity } }).componentIds();
    check(same(ids(''), []), 'no list: every component');
    check(same(ids('layer2'), ['layer2']), 'one');
    check(same(ids('a+b - c'), ['a', 'b', 'c']), 'every one listed');
    check(ids('-') === null && ids('- -') === null, 'nothing listed: none seen');
    check(ids('layer1', 0) === null, 'no opacity: none seen');
    const view = VisualizationColorSym({ config: { imageId: 'a b' } }).describeCopies();
    check(same(view.entries, []) && !view.sprites, 'before a frame: the buffer path, everything');
}

// 6 ───────────────────────────────────────────────────────────────────────────

{
    const cosets = (list, n) => imageListEntryCosets(parseImageList(list), n);
    check(same(cosets('', 3), [[0, 1, 2]]), 'an empty list: one entry seen in every coset');
    check(same(cosets('a b', 4), [[0], [1, 2, 3]]), 'the last entry also in the cosets after it');
    check(same(cosets('a b c', 3), [[0], [1], [2]]), 'an entry per coset');
    check(same(cosets('a b c d', 2), [[0], [1], [], []]), 'entries past the cosets: in none');
    check(same(cosets('a', 0), [[]]), 'no cosets');

    // a name toggled in entry j: put at its end, or taken out ('-' when none is left)
    check(toggleImageListName('', 0, 'sun') === 'sun', 'an empty list becomes the name');
    check(toggleImageListName('sun', 0, 'p2') === 'sun+p2', 'a second name in the entry');
    check(toggleImageListName('sun+p2', 0, 'sun') === 'p2', 'taken out');
    check(toggleImageListName('sun p2', 1, 'p2') === 'sun -', 'the last name out: nothing');
    check(toggleImageListName('sun -', 1, 'p4') === 'sun p4', 'into an entry of nothing');
    check(toggleImageListName('a b', 2, 'c') === 'a b', 'no entry 2: no change');

    // set, add, remove, same as the next
    check(setImageListEntry('a b', 1, ['c', 'd', 'c']) === 'a c+d', 'an entry set, each name once');
    check(setImageListEntry('a b', 0, []) === '- b', 'an entry of nothing');
    check(setImageListEntry('', 0, ['x']) === 'x', 'the first entry of an empty list');
    check(setImageListEntry('a', 3, ['x']) === 'a', 'not past the end');
    check(addImageListEntry('a b+c') === 'a b+c b+c', 'one more: the last again, the same cosets show the same');
    check(addImageListEntry('') === '', 'an empty list has no last entry');
    check(removeImageListEntry('a b c', 1) === 'a c', 'an entry removed');
    check(removeImageListEntry('a', 0) === '', 'the only entry removed: everything');
    check(copyNextImageListEntry('a b+c d', 0) === 'b+c b+c d', 'same as the next');
    check(copyNextImageListEntry('a b', 1) === 'a b', 'the last has no next');

    // the 6.24 lists made with the chips as they would be clicked
    let s = '';
    s = toggleImageListName(s, 0, 'sun');                       // the everything chip: sun
    s = addImageListEntry(s);                                    // +: sun sun
    s = setImageListEntry(s, 1, []);                             // coset 1 on: Nothing
    for (const n of ['p2', 'p4', 'p7']) s = toggleImageListName(s, 1, n);
    check(s === 'sun p2+p4+p7', `made with the chips: "${s}"`);
    s = toggleImageListName('', 0, 'layer2');
    s = addImageListEntry(s);
    s = toggleImageListName(s, 1, 'layer2');
    s = toggleImageListName(s, 1, 'layer1');
    s = toggleImageListName(s, 1, 'p4');
    check(s === 'layer2 layer1+p4', `made with the chips: "${s}"`);
}

console.log(failed ? `${failed} failed` : 'all passed');
if (failed) process.exitCode = 1;
