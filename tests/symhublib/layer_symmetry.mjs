/*
  tests of the per-layer symmetry (docs/per_layer_symmetry_plan.md): the
  global symmetry.options.useSymm of an old document goes to the layers
  without a switch of their own

    node tests/symhublib/layer_symmetry.mjs

  1. useSymm false: every layer off, a layer's own value kept, the folding
     overlay items (standing as a layer or in an overlay) drawn with symmetry
     'none' (a subgroup's keeps its cosets), the grids and the domain left alone
  2. useSymm true: the layers on, the overlay items as they were
  3. the old flat format of the layers (upgradeData_v2) gets it as well
  4. no useSymm (a document saved since): nothing changed
*/

import { SymRendererUpgradeData } from '../../lib/symhublib/SymRendererUpgradeData.js';
import { upgradeData } from '../../lib/symhublib/VisualizationManagerUpgradeData.js';

let failed = 0;
function check(name, ok){
    if (!ok) { failed++; console.log('FAILED: ' + name); }
}

function doc(useSymm, layers){
    const options = { symIterations: 10 };
    if (useSymm !== undefined) options.useSymm = useSymm;
    return {
        appInfo: { fileFormatRelease: 1 },
        params: {
            pattern: { className: 'PatternDrawing', params: {} },
            symmetry: { options },
            visualization: { className: 'VisualizationManager', params: { layers } },
        },
    };
}

function layersOf(children){
    return { className: 'ObjArray', params: { id: 'layers', children } };
}

function makeChildren(){
    return [
        { className: 'VisualizationImage', params: { id: 'scan', enabled: true } },
        { className: 'VisualizationColorSym', params: { id: 'drawing', enabled: true, useSymmetry: true } },
        { className: 'OverlayIsolines', params: { id: 'iso', enabled: true, symmetry: { type: 'renderer', maxIndex: 8, cosets: '' } } },
        { className: 'OverlayWorldGrid', params: { id: 'grid', enabled: true } },
        { className: 'VisualizationOverlay', params: { id: 'overlay', enabled: true, opacity: 1, overlays: { className: 'ObjArray', params: { id: 'overlays', children: [
            { className: 'OverlayTiling', params: { id: 'tiling', enabled: true, symmetry: { type: 'renderer', maxIndex: 8, cosets: '' } } },
            { className: 'OverlayTiling', params: { id: 'tiling2', enabled: true, symmetry: { type: 'subgroup', maxIndex: 8, cosets: 'ab ba' } } },
            { className: 'OverlayFundDomain', params: { id: 'domain', enabled: true } },
        ] } } } },
    ];
}

const MAPPING = [{ key: 'image', cls: 'VisualizationImage' }, { key: 'drawing', cls: 'VisualizationColorSym' }];

function load(d){
    SymRendererUpgradeData(d, {});
    return upgradeData(d.params.visualization.params, MAPPING);
}

// 1.
{
    const d = doc(false, layersOf(makeChildren()));
    const vis = load(d);
    const c = vis.layers.params.children;
    check('1: the global switch is gone from the document', !('useSymm' in d.params.symmetry.options));
    check('1: the iterations stay', d.params.symmetry.options.symIterations === 10);
    check('1: no legacy key left', !('legacyUseSymm' in vis));
    check('1: a layer without a switch takes the document\'s', c[0].params.useSymmetry === false);
    check('1: a layer\'s own switch is kept', c[1].params.useSymmetry === true);
    check('1: an overlay item layer drawn without symmetry', c[2].params.symmetry.type === 'none');
    check('1: a grid gets no symmetry', !('symmetry' in c[3].params) && !('useSymmetry' in c[3].params));
    const items = c[4].params.overlays.params.children;
    check('1: the overlay layer gets no switch', !('useSymmetry' in c[4].params));
    check('1: its tiling drawn without symmetry', items[0].params.symmetry.type === 'none');
    check('1: a subgroup tiling unfolded, its cosets kept', items[1].params.symmetry.type === 'none' && items[1].params.symmetry.cosets === 'ab ba');
    check('1: the domain left alone', !('symmetry' in items[2].params));
}

// 2.
{
    const vis = load(doc(true, layersOf(makeChildren())));
    const c = vis.layers.params.children;
    check('2: a layer without a switch on', c[0].params.useSymmetry === true);
    check('2: an overlay item keeps the renderer\'s group', c[2].params.symmetry.type === 'renderer');
}

// 3.
{
    const d = doc(false, undefined);
    d.params.visualization.params = { image: { enabled: true }, drawing: { enabled: false } };
    const vis = load(d);
    const c = vis.layers.params.children;
    check('3: the flat format upgraded to a list', Array.isArray(c) && c.length === 2);
    check('3: its layers take the document\'s switch', c.every(l => (l.params || l).useSymmetry === false));
}

// 4.
{
    const vis = load(doc(undefined, layersOf(makeChildren())));
    const c = vis.layers.params.children;
    check('4: nothing changed without the global switch', !('useSymmetry' in c[0].params) && c[2].params.symmetry.type === 'renderer');
}

console.log(failed ? `${failed} failed` : 'all checks passed');
