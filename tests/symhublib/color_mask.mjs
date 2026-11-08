/*
  tests of the colour layers' masks as the strip's eyes set them, and of the
  layers' panels (getPanelParams) leaving what a document saves alone

    node tests/symhublib/color_mask.mjs

  1. maskWithShown: a colour hidden ('0') or shown, the other characters as
     written, '' when none is hidden
  2. maskShowingOnly: a colour alone, or all again when it was alone
  3. Color Images, Color Tiles, Image: the saved keys and values are the
     same with the panel made, and the panel holds every control of the
     layer (and of its colours)
*/

import { maskWithShown, maskShowingOnly } from '../../lib/symhublib/ColorTiles.js';

// the saved palettes are read from the browser's storage: none here
const storage = { getItem: () => null, setItem(){}, removeItem(){} };
globalThis.localStorage = globalThis.localStorage || storage;
globalThis.window = globalThis.window || { addEventListener(){}, localStorage: storage };

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1 ───────────────────────────────────────────────────────────────────────────

check(maskWithShown('', 1, false) === '10', 'hide 1 of all');
check(maskWithShown('10', 1, true) === '', 'shown again: none hidden, the mask empty');
check(maskWithShown('1101', 0, false) === '0101', 'hide 0, the rest as written');
check(maskWithShown('0101', 0, true) === '1101', 'and back as it was');
check(maskWithShown('0101', 3, true) === '0101', 'shown already: no change');
check(maskWithShown('000', 2, true) === '001', 'show the last of three hidden');
check(maskWithShown('', 5, false) === '111110', 'past the end: the ones before shown');
check(maskWithShown('2020', 1, true) === '2120' && maskWithShown('2020', 0, false) === '0020', 'other characters kept');
check(maskWithShown('0', 0, false) === '0', 'hidden again: no change');
check(maskWithShown('0', 3, true) === '0', 'past the end is shown: no change');

// 2 ───────────────────────────────────────────────────────────────────────────

check(maskShowingOnly('', 1, 3) === '010', 'only 1 of 3');
check(maskShowingOnly('010', 1, 3) === '', 'again: all');
check(maskShowingOnly('', 2, 3) === '00', 'only the last: the ones before hidden');
check(maskShowingOnly('00', 2, 3) === '', 'the last alone again: all');
check(maskShowingOnly('011', 1, 3) === '010', 'two shown: the one alone');
check(maskShowingOnly('000', 1, 3) === '010', 'a hidden one alone');

// 3 ───────────────────────────────────────────────────────────────────────────

const { getParamValues } = await import('../../lib/uilib/param.js');
const { VisualizationColorSym } = await import('../../lib/symhublib/VisualizationColorSym.js');
const { VisualizationColorTiles } = await import('../../lib/symhublib/VisualizationColorTiles.js');
const { VisualizationImage } = await import('../../lib/symhublib/VisualizationImage.js');

// a param's getValue, or its createUI for one without a value (a contained copy keeps the first)
const mark = p => p.getValue || p.createUI;

const kinds = [
    ['Color Images', () => VisualizationColorSym({ config: { imageId: 'a b+c', permutations: 'acb bac', mask: '01', coloringType: 'mult', useCrown: true } }),
     ['id', 'enabled', 'opacity', 'imageId', 'permutations', 'permIndex', 'useOrbit', 'mask', 'subgroups', 'coloringType',
      'colorTiles', 'useCrown', 'useTilt', 'patternTiltDirection', 'useMipmap', 'interpolation']],
    ['Color Tiles', () => VisualizationColorTiles({ config: { permutations: 'acb bac', mask: '001' } }),
     ['id', 'enabled', 'opacity', 'permutations', 'useOrbit', 'permIndex', 'mask', 'subgroups', 'colorTiles']],
    ['Image', () => VisualizationImage({ config: { imageId: 'p2 p3', useTilt: true } }),
     ['id', 'enabled', 'opacity', 'interpolation', 'dataSource', 'useMipmap', 'imageId', 'useCrown', 'useTilt', 'patternTiltDirection']],
];
for (const [name, make, keys] of kinds) {
    const layer = make();
    const before = JSON.stringify(getParamValues(layer.getParams()));
    const panel = layer.getPanelParams();
    check(layer.getPanelParams() === panel, `${name}: one panel object`);
    check(same(Object.keys(layer.getParams()), keys), `${name}: the saved keys in their order`);
    check(JSON.stringify(getParamValues(layer.getParams())) === before, `${name}: the same saved values with the panel made`);
    check(Object.values(panel).every(p => p.serializable === false || p.getValue || p.createUI), `${name}: the panel holds params`);
    // every control of the layer is in the panel, colorTiles by its own params
    const inPanel = new Set(Object.values(panel).map(mark));
    for (const [key, p] of Object.entries(layer.getParams())) {
        if (key === 'colorTiles') {
            for (const [k, q] of Object.entries(p.getObj ? p.getObj().getParams() : {})) {
                if (q.createUI) check(inPanel.has(mark(q)), `${name}: colours' ${k} in the panel`);
            }
            continue;
        }
        check(inPanel.has(mark(p)), `${name}: ${key} in the panel`);
    }
}

console.log(failed ? `${failed} failed` : 'all passed');
if (failed) process.exitCode = 1;
