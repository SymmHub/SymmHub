/*
  test for the overlay item list of VisualizationOverlay
  (lib/symhublib/VisualizationOverlay.js, lib/symhublib/VisualizationOverlayUpgradeData.js,
   the id keyed patch and addChild(index) of ParamObjArray in lib/uilib/paramobj.js)

    node tests/overlay/upgrade.mjs

  fixtures/ holds the visualization block of real presets (old flat format,
  current ObjArray format) and the catalog driver's layer patch.

  1. a legacy overlay tree becomes an item list: the features in the drawing
     order of the old shader, disabled features at their defaults dropped,
     tiling.outline mapped onto the tiling item, fill/outline enables onto the
     item enable
  2. a document load into the overlay replaces the item list (stale items go
     away); save → load → save of the new format is the identity
  3. the same through the visualization manager: old flat format, current
     ObjArray format (layer keyed by name), very old v1 format
  4. partial patches: the catalog driver's legacy paths reach the items, a
     missing item is made at its old place; the id keyed patch of
     ParamObjArray; scripted setParams through the manager
  5. add / move / remove of items keeps list and serialization in sync
  6. an item works as a layer of its own
*/

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { VisualizationOverlay, VisualizationManager, OverlayIsolines } from '../../lib/symhublib/symhublib.js';
import { getParamValues, setParamValues } from '../../lib/uilib/param.js';
import { ObjectFactory } from '../../lib/uilib/ObjectFactory.js';
import {
    upgradeOverlayParams, legacyToItemParams, isLegacyDefault, isLegacyOverlay, LEGACY_DEFAULTS,
} from '../../lib/symhublib/VisualizationOverlayUpgradeData.js';

// the manager and the object factory log a lot; keep warnings and errors only
const quiet = { log: console.log, group: console.group, groupEnd: console.groupEnd };
console.log = () => {}; console.group = () => {}; console.groupEnd = () => {};
const say = (...a) => quiet.log(...a);

let failures = 0;
function check(ok, msg) { if (!ok) { failures++; say('  FAIL:', msg); } return ok; }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = name => JSON.parse(readFileSync(path.join(here, 'fixtures', name), 'utf8'));
const flat   = fixture('visualization_flat.json').visualization;       // { image, overlay, options }
const objarr = fixture('visualization_objarray.json').visualization;   // { className: 'VisualizationManager', params: { layers } }
const patch  = fixture('catalog_patch.json');                           // { layers: { overlay: {...} }, enable: {...} }

const ids     = ov => ov.getItems().map(it => it.getId());
const save    = ov => getParamValues(ov.getParams());
const cfg     = (ov, id) => ov.getItem(id).getConfig();

// a manager with the overlay only (the other layer classes need GL or the DOM)
function overlayOnlyFactory() {
    return ObjectFactory({
        defaultName: 'VisualizationOverlay',
        infoArray: [{ name: 'VisualizationOverlay', creator: () => VisualizationOverlay({ id: 'overlay', config: { enabled: false } }) }],
    });
}
function makeManager() {
    const mgr = VisualizationManager({
        layerFactory:   overlayOnlyFactory,
        upgradeMapping: [{ key: 'overlay', cls: 'VisualizationOverlay' }],
        visLayers:      [{ name: 'overlay', visLayer: VisualizationOverlay({ config: { enabled: false } }) }],
    });
    mgr.getParams();
    return mgr;
}
// the ObjArray fixture reduced to its overlay layer
const objarrOverlayOnly = {
    layers: {
        className: 'ObjArray',
        params: { id: 'layers', children: objarr.params.layers.params.children.filter(c => c.className === 'VisualizationOverlay') },
    },
};

// ── 1. upgrade of the legacy tree ─────────────────────────────────────────────
say('1. upgrade of the legacy tree');
{
    const up = upgradeOverlayParams(flat.overlay);
    const ch = up.overlays.params.children;
    check(!('fundDomain' in up) && !('tiling' in up) && !('ruler' in up), 'legacy keys removed');
    check(up.enabled === true && up.opacity === 1, 'enabled and opacity kept');
    check(same(ch.map(c => c.params.id), ['tiling', 'fundDomain', 'buffer']),
          `children in the old drawing order, defaults dropped: ${ch.map(c => c.params.id)}`);
    const [tiling, fd, buf] = ch;
    check(tiling.className === 'OverlayTiling' && tiling.params.enabled === true && tiling.params.width === 1
          && tiling.params.color === '#000000FF' && !('outline' in tiling.params) && !('fill' in tiling.params),
          'tiling.outline mapped onto the tiling item');
    check(fd.className === 'OverlayFundDomain' && fd.params.enabled === true && fd.params.fill.enabled === true
          && fd.params.fill.color === '#ff00001c' && fd.params.outline.enabled === false,
          'fundDomain: item enabled by its fill');
    check(buf.className === 'OverlayBuffer' && buf.params.enabled === true && buf.params.outline.enabled === false
          && buf.params.outline.width === 7, 'buffer: tuned but disabled outline kept');

    check(isLegacyDefault('screenGrid', { ...LEGACY_DEFAULTS.screenGrid, step: 0.02 }), 'screen grid: auto step ignored');
    check(!isLegacyDefault('screenGrid', { ...LEGACY_DEFAULTS.screenGrid, stepAuto: false, step: 0.02 }), 'screen grid: manual step counts');
    check(isLegacyDefault('generators', { enabled: false, width: 2, color: '#0000aaaa', shadow: { enabled: true, width: 10, color: '#0000aa55' } }),
          'colours compared case insensitive');
    check(!isLegacyDefault('isolines', { ...LEGACY_DEFAULTS.isolines, type: 'v' }), 'a changed value is not default');
    check(isLegacyDefault('tiling', { fill: { enabled: true, color: '#123456ff' }, outline: LEGACY_DEFAULTS.tiling.outline }), 'dead tiling.fill ignored');
    check(isLegacyDefault('isolines', { enabled: false }), 'missing keys count as default');

    check(!('enabled' in legacyToItemParams('fundDomain', { fill: { enabled: false } }, true)), 'patch: disabling a part leaves the item enable alone');
    check(legacyToItemParams('fundDomain', { outline: { enabled: true } }, true).enabled === true, 'patch: enabling a part enables the item');
    check(legacyToItemParams('fundDomain', { fill: { enabled: false }, outline: { enabled: false } }, false).enabled === false, 'full: both parts off, item off');
    check(same(legacyToItemParams('tiling', { outline: { width: 3 } }, true), { width: 3 }), 'patch: tiling width only');
    check(isLegacyOverlay(flat.overlay) && !isLegacyOverlay(up) && !isLegacyOverlay({ enabled: true }), 'legacy detection');
}

// ── 2. document load into the overlay ─────────────────────────────────────────
say('2. document load into the overlay');
{
    const ov = VisualizationOverlay({ id: 'overlay', config: { enabled: false } });
    check(same(ids(ov), ['tiling', 'fundDomain', 'generators']), `fresh overlay: tiling, fundDomain, generators: ${ids(ov)}`);
    check(ov.getItems().every(it => !it.enabled), 'fresh overlay items are disabled');

    ov.setParamsMap(flat.overlay, true);
    check(same(ids(ov), ['tiling', 'fundDomain', 'buffer']), `legacy document replaces the list: ${ids(ov)}`);
    check(ov.enabled === true, 'layer enabled from the document');
    check(cfg(ov, 'tiling').enabled === true && cfg(ov, 'fundDomain').fill.color === '#ff00001c' && cfg(ov, 'buffer').outline.width === 7, 'item values');

    const saved = save(ov);
    check(saved.overlays && saved.overlays.className === 'ObjArray' && !('fundDomain' in saved) && !('tiling' in saved), 'saved in the new format only');
    check(same(saved.overlays.params.children.map(c => c.className), ['OverlayTiling', 'OverlayFundDomain', 'OverlayBuffer']), 'saved children classes');
    check(same(saved.overlays.params.children[0].params,
               { id: 'tiling', enabled: true, opacity: 1, width: 1, color: '#000000FF', symmetry: { type: 'renderer', maxIndex: 8, cosets: '' } }),
          'saved tiling item');

    const ov2 = VisualizationOverlay({ id: 'x' });
    ov2.setParamsMap(saved, true);
    check(same(save(ov2), saved), 'save, load, save is the identity');

    ov2.addItem('OverlayIsolines');
    ov2.addItem('OverlayIsolines');
    check(same(ids(ov2), ['tiling', 'fundDomain', 'buffer', 'isolines', 'isolines2']), `added items get unique ids: ${ids(ov2)}`);
    ov2.setParamsMap(flat.overlay, true);
    check(same(ids(ov2), ['tiling', 'fundDomain', 'buffer']), `reload drops the stale items: ${ids(ov2)}`);

    // an untouched legacy overlay (everything at the defaults) gives the items of a fresh overlay
    const untouched = JSON.parse(JSON.stringify(flat.overlay));
    untouched.fundDomain.fill.enabled = false; untouched.fundDomain.fill.color = '#FF0000AA';
    untouched.buffer.fill.enabled = false; untouched.buffer.fill.color = '#00FF0022';
    untouched.buffer.outline.width = 1; untouched.buffer.outline.color = '#00AA00AA';
    untouched.tiling.outline.enabled = false;
    check(upgradeOverlayParams(untouched).overlays.params.children.length === 0, 'untouched legacy overlay upgrades to no items');
    const ov5 = VisualizationOverlay({ id: 'u' });
    ov5.addItem('OverlayIsolines');
    ov5.setParamsMap(untouched, true);
    check(same(ids(ov5), ['tiling', 'fundDomain', 'generators']) && ov5.getItems().every(it => !it.enabled),
          `untouched legacy overlay loads as a fresh overlay: ${ids(ov5)}`);
    const ov6 = VisualizationOverlay({ id: 'v', config: { overlays: [{ className: 'OverlayIsolines', id: 'iso' }] } });
    ov6.setParamsMap(untouched, true);
    check(same(ids(ov6), ['iso']), `an app's own default list is used as well: ${ids(ov6)}`);

    // two items of a kind survive a round trip
    const ov3 = VisualizationOverlay({ id: 'y' });
    ov3.addItem('OverlayIsolines'); ov3.addItem('OverlayIsolines');
    cfg(ov3, 'isolines2').dataSource = 'mod(uv)';
    const saved3 = save(ov3);
    const ov4 = VisualizationOverlay({ id: 'z' });
    ov4.setParamsMap(saved3, true);
    check(same(ids(ov4), ['tiling', 'fundDomain', 'generators', 'isolines', 'isolines2']) && cfg(ov4, 'isolines2').dataSource === 'mod(uv)',
          `two isolines items round trip: ${ids(ov4)}`);
    check(same(save(ov4), saved3), 'round trip with two items of a kind is the identity');
}

// ── 3. through the visualization manager ──────────────────────────────────────
say('3. document load through the visualization manager');
{
    const mgr = makeManager();
    mgr.setParamsMap(flat, true);
    const ov = mgr.getLayer('overlay');
    check(ov && same(ids(ov), ['tiling', 'fundDomain', 'buffer']), `old flat document: ${ov && ids(ov)}`);
    check(mgr.getLayers().length === 1, 'one layer');

    const mgr2 = makeManager();
    mgr2.setParamsMap(objarrOverlayOnly, true);
    const ov2 = mgr2.getLayer('overlay');
    check(ov2 && same(ids(ov2), ['fundDomain']), `ObjArray document, layer keyed by name: ${ov2 && ids(ov2)}`);
    check(ov2 && cfg(ov2, 'fundDomain').fill.color === '#ff000023' && cfg(ov2, 'fundDomain').enabled === true, 'ObjArray document values');
    const savedMgr = getParamValues(mgr2.getParams());
    check(savedMgr.layers.params.children[0].params.id === 'overlay' && savedMgr.layers.params.children[0].params.overlays.params.children.length === 1,
          'manager saves the item list');

    const mgr3 = makeManager();
    mgr3.setParamsMap({
        renderStyle: 'colormap', colormap: {}, texture: {}, bump: {},
        isolines: { enabled: true, type: 'v', step: 0.25, offset: 0, width: 2, levels: 1, color: '#ff0000ff' },
    }, true);
    const ov3 = mgr3.getLayer('overlay');
    check(ov3 && same(ids(ov3), ['isolines']) && cfg(ov3, 'isolines').dataSource === 'v' && cfg(ov3, 'isolines').step === 0.25,
          `v1 document: ${ov3 && ids(ov3)}`);
}

// ── 4. partial patches ────────────────────────────────────────────────────────
say('4. partial patches');
{
    const mgr = makeManager();
    mgr.setParamsMap(objarrOverlayOnly, true);          // items: fundDomain
    const ov = mgr.getLayer('overlay');

    // the catalog driver walks layer.getParams() and calls setValue() where it can
    setParamValues(ov.getParams(), patch.layers.overlay);
    check(same(ids(ov), ['tiling', 'fundDomain']), `missing tiling item made below the domain: ${ids(ov)}`);
    check(cfg(ov, 'tiling').enabled === true && cfg(ov, 'tiling').width === 1 && cfg(ov, 'tiling').color === '#000000FF',
          'tiling from the legacy defaults plus the patch');
    setParamValues(ov.getParams(), { enabled: patch.enable.overlay });
    check(ov.enabled === true, 'enable shorthand');

    setParamValues(ov.getParams(), { tiling: { outline: { width: 2.5 } }, fundDomain: { fill: { enabled: false } } });
    check(cfg(ov, 'tiling').width === 2.5 && cfg(ov, 'tiling').enabled === true, 'a patch changes the given values only');
    check(cfg(ov, 'fundDomain').fill.enabled === false && cfg(ov, 'fundDomain').enabled === true, 'disabling a part leaves the item enabled');

    setParamValues(ov.getParams(), { isolines: { enabled: true, type: 'mod(uv)' } });
    check(same(ids(ov), ['isolines', 'tiling', 'fundDomain']) && cfg(ov, 'isolines').dataSource === 'mod(uv)', `isolines made at the bottom: ${ids(ov)}`);
    setParamValues(ov.getParams(), { ruler: { width: 30 } });
    check(ids(ov).at(-1) === 'ruler' && cfg(ov, 'ruler').width === 30 && cfg(ov, 'ruler').enabled === false,
          'ruler made at the top, disabled like its legacy default');
    setParamValues(ov.getParams(), { generators: { enabled: true } });
    check(same(ids(ov), ['isolines', 'tiling', 'fundDomain', 'generators', 'ruler']), `generators made between the domain and the ruler: ${ids(ov)}`);

    const saved = save(ov);
    check(!Object.keys(saved).some(k => ['isolines', 'tiling', 'fundDomain', 'generators', 'ruler'].includes(k)), 'route-only params are not serialized');

    // the id keyed patch of ParamObjArray
    ov.getParams().overlays.setValue({ fundDomain: { opacity: 0.5 }, tiling: { params: { color: '#ff0000ff' } } });
    check(cfg(ov, 'fundDomain').opacity === 0.5 && cfg(ov, 'tiling').color === '#ff0000ff', 'id keyed patch, bare and {params} forms');
    check(same(ids(ov), ['isolines', 'tiling', 'fundDomain', 'generators', 'ruler']), 'id keyed patch leaves the list alone');
    const warn = console.warn; let warned = 0; console.warn = () => { warned++; };
    ov.getParams().overlays.setValue({ nosuch: { opacity: 0.1 } });
    console.warn = warn;
    check(warned === 1 && same(ids(ov), ['isolines', 'tiling', 'fundDomain', 'generators', 'ruler']), 'unknown id warns and changes nothing');

    // scripted setParams through the manager: layers keyed by id, items by id or by legacy path
    mgr.setParamsMap({ layers: { overlay: { overlays: { tiling: { width: 4 } }, fundDomain: { outline: { enabled: true, width: 3 } } } } });
    check(cfg(ov, 'tiling').width === 4 && cfg(ov, 'fundDomain').outline.width === 3 && cfg(ov, 'fundDomain').outline.enabled === true,
          'manager patch: item path and legacy path');
    check(mgr.getLayers().length === 1 && same(ids(ov), ['isolines', 'tiling', 'fundDomain', 'generators', 'ruler']), 'manager patch leaves the lists alone');
}

// ── 5. add / move / remove ────────────────────────────────────────────────────
say('5. add, move, remove');
{
    const ov = VisualizationOverlay({ id: 'overlay' });
    const iso = ov.addItem('OverlayIsolines', 0);
    check(iso && iso.getId() === 'isolines' && same(ids(ov), ['isolines', 'tiling', 'fundDomain', 'generators']), `addItem at an index: ${ids(ov)}`);
    check(iso.enabled === true, 'items from the "+" menu are enabled');
    ov.getParams().overlays.moveChildAt(0, 1);
    check(same(ids(ov), ['tiling', 'isolines', 'fundDomain', 'generators']), `move down: ${ids(ov)}`);
    check(same(save(ov).overlays.params.children.map(c => c.params.id), ids(ov)), 'serialization follows the list');
    check(ov.removeItem('isolines') && same(ids(ov), ['tiling', 'fundDomain', 'generators']), `remove by id: ${ids(ov)}`);
    check(!ov.removeItem('isolines'), 'removing a missing item is false');
    check(ov.removeItem(0) && same(ids(ov), ['fundDomain', 'generators']), `remove by index: ${ids(ov)}`);
    const t = ov.addItem('OverlayTiling');
    check(t.getId() === 'tiling' && same(ids(ov), ['fundDomain', 'generators', 'tiling']), 'the freed id is reused');
    const t2 = ov.addItem('OverlayTiling', 1);
    check(t2.getId() === 'tiling2' && same(ids(ov), ['fundDomain', 'tiling2', 'generators', 'tiling']), `second tiling: ${ids(ov)}`);
    check(same(save(ov).overlays.params.children.map(c => c.params.id), ids(ov)), 'serialization follows the list after edits');
}

// ── 6. an item as a layer of its own ──────────────────────────────────────────
say('6. an item as a top level layer');
{
    const iso = OverlayIsolines({ id: 'isolines', config: { enabled: true, step: 0.2 } });
    check(iso.getClassName() === 'OverlayIsolines' && iso.getId() === 'isolines' && iso.enabled === true, 'layer interface');
    const v = getParamValues(iso.getParams());
    check(same(v, { id: 'isolines', enabled: true, opacity: 1, type: 'u', step: 0.2, offset: 0, width: 1, levels: 1, color: '#000000ff',
                    symmetry: { type: 'renderer', maxIndex: 8, cosets: '' } }), `serialized item: ${JSON.stringify(v)}`);
    let threw = false;
    try { iso.render({}); } catch (e) { threw = true; }
    check(!threw, 'render before init is a no-op');
    setParamValues(iso.getParams(), { type: 'abs(u)', levels: 3 });
    check(iso.getConfig().dataSource === 'abs(u)' && iso.getConfig().levels === 3, 'patch of a top level item');
}

Object.assign(console, quiet);
if (failures) { console.log(`\n${failures} check(s) FAILED`); process.exit(1); }
console.log('\nall checks passed');
