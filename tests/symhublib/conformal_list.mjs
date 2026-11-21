/*
  tests of the list of conformal transformations (lib/symhublib/ProjectionTransform.js,
  the rows of lib/symhublib/conformal/; docs/conformal_transforms_plan.md, outside the
  repository)

    node tests/symhublib/conformal_list.mjs

  1. the upgrade of a value of the fixed maps (upgradeProjectionValue): the maps that are
     on become rows in the order they acted in; a map off with changed values is a row
     that is off, one off with the defaults is none (the fixed points map by the values a
     user sets); logMap goes; the switch of the whole stays; a key a map lacks is the
     row's default; a value with a list passes as it is
  2. every document under apps/ (the json files with a projection): the chain of the list
     made of its values gives the same world points as the fixed chain it replaces (the
     frozen copies in tests/symhublib/legacy: the old ProjectionTransform.getChainParts
     and the old viewChainToWorld), on a grid of the document's canvas and one of the
     plane; the list saved and loaded again is the same value and the same chain
  3. the list edited through its ParamObjArray, as the panel and the window do: a row
     added (its id the next free one), moved, switched off, duplicated, renamed, removed;
     the chain follows in the shaders' order (the last row first); the listeners hear of
     it (an edit: no system change; a value set: a system change and a load)
  4. a value set: a document without maps empties the list; a row of an unknown kind is
     left out; a patch without the list leaves it
  5. the limits of the shader's loop: the rows from the first as far as there is room,
     those past it told by getOverLimit; the uniforms are the packed chain
  6. the fixed points row: its steps from its points without a group; a change of the
     group is passed to it and its points are found again from its word
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.window = globalThis.window || { addEventListener(){}, localStorage: { getItem: () => null, setItem(){} } };

const { ProjectionTransform, upgradeProjectionValue } = await import('../../lib/symhublib/ProjectionTransform.js');
const { ProjectionTransform: LegacyProjectionTransform } = await import('./legacy/ProjectionTransform_fixed.js');
const { viewChainToWorld: legacyToWorld } = await import('./legacy/ViewChain_fixed.js');
const { viewChainToWorld, viewChainToScreen, viewChainScale } = await import('../../lib/symhublib/ViewChain.js');
const { packViewChain, VIEW_CHAIN_MAX_STEPS } = await import('../../lib/symhublib/conformal/ConformalKinds.js');
const { getParamValues, setParamValues } = await import('../../lib/uilib/uilib.js');
const { Group, iSphere, iPlane } = await import('../../lib/invlib/invlib.js');

let failed = 0, checks = 0;
function check(ok, what){
    checks++;
    if (ok) return;
    failed++;
    process.stdout.write('FAILED: ' + what + '\n');
}
const say = (s) => process.stdout.write(s + '\n');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const plain = (v) => JSON.parse(JSON.stringify(v));
// the libraries log as they make objects: not here
console.log = () => {};
console.trace = () => {};

const listOf = (rows) => ({ className: 'ObjArray', params: { id: 'maps', children: rows } });
const rowsOf = (value) => value.maps.params.children;
const kindsOf = (chain) => chain.map(s => s.kind).join(' ');

// 1 ───────────────────────────────────────────────────────────────────────────

{
    const FP_OFF = { className: 'FixedPointTransform', params: { enabled: false, showUI: false, animate: false, word: 'ac', orientation: 'none',
                     fp0x: -1, fp0y: 0, fp1x: 1, fp1y: 0, basex: 0, basey: 0, translation: 1, rotation: 0, fraction: 0, loopTime: 5 } };
    const allOff = {
        enabled: true, fpdMap: FP_OFF, bandMap: { enabled: false, fraction: 1 }, logMap: { enabled: false },
        periodicMap: { enabled: false, a1x: 1, a1y: 0, a2x: 0, a2y: 1, cx: 0, cy: 0 },
        scaleMap: { enabled: false, a1x: 1, a1y: 0, a2x: 0, a2y: 1, n1: 10, n2: 0, shift1: 0, shift2: 0 },
        expMap: { enabled: false }, loxMap: { enabled: false }, uhpMap: { enabled: false },
        rationalMap: { enabled: false, x1: 1, y1: 0, n1: 1, x2: 0, y2: 1, n2: -1, x3: -1, y3: 0, n3: 1, x4: 0, y4: -1, n4: -1 },
    };
    const up0 = upgradeProjectionValue(plain(allOff));
    check(up0.enabled === true && rowsOf(up0).length === 0, 'all maps off with their defaults: an empty list, the whole switch kept');

    // every map on: the rows in the order the fixed maps acted in
    const allOn = plain(allOff);
    for (const k of Object.keys(allOn)) if (k !== 'enabled') (allOn[k].params || allOn[k]).enabled = true;
    const up1 = upgradeProjectionValue(allOn);
    check(rowsOf(up1).map(r => r.className).join() ===
          'FixedPointTransform,ConformalBand,ConformalPeriodic,ConformalScale,ConformalLox,ConformalExp,ConformalUhp,ConformalRational',
          `every map on: the rows in the direct order (${rowsOf(up1).map(r => r.className).join()})`);
    check(rowsOf(up1).map(r => r.params.id).join() === 'fixedPoints,band,periodic,scale,loxodromic,exponent,uhp,rational', 'their ids');
    check(rowsOf(up1).every(r => r.params.enabled === true), 'all on');
    check(rowsOf(up1)[0].params.word === 'ac' && rowsOf(up1)[3].params.n1 === 10 && rowsOf(up1)[7].params.n4 === -1, 'the values carried over');
    check(!JSON.stringify(up1).includes('logMap'), 'logMap is gone');

    // off with changed values: a row that is off; the fixed points map by its own values
    const some = plain(allOff);
    some.enabled = false;
    some.scaleMap.n1 = 14;
    some.fpdMap.params.fp0x = 0.3;          // found from the word: no change of the user's
    some.rationalMap.x1 = 0.5;
    some.expMap.enabled = true;
    const up2 = upgradeProjectionValue(some);
    check(up2.enabled === false, 'the whole switch off stays off');
    check(rowsOf(up2).map(r => r.params.id + ':' + r.params.enabled).join() === 'scale:false,exponent:true,rational:false',
          `off with changed values are rows that are off: ${rowsOf(up2).map(r => r.params.id + ':' + r.params.enabled).join()}`);
    const fp = plain(allOff); fp.fpdMap.params.word = 'abcb';
    check(rowsOf(upgradeProjectionValue(fp)).map(r => r.params.id).join() === 'fixedPoints', 'the fixed points map off with another word is a row');

    // a key a map lacks: the row's default
    const pt = ProjectionTransform({});
    pt.setParamsMap({ enabled: true, bandMap: { enabled: true }, scaleMap: { enabled: true, n1: 3 } }, true);
    const v = getParamValues(pt.getParams());
    check(rowsOf(v)[0].params.fraction === 1 && rowsOf(v)[1].params.n1 === 3 && rowsOf(v)[1].params.a2y === 1 && rowsOf(v)[1].params.shift2 === 0,
          'a key the document lacks is the row\'s default');

    // a value with a list, and one that is no value of the fixed maps, pass as they are
    const withList = { enabled: true, maps: listOf([{ className: 'ConformalExp', params: { id: 'exponent', enabled: true } }]) };
    check(upgradeProjectionValue(withList) === withList, 'a value with a list passes as it is');
    const bare = { enabled: false };
    check(upgradeProjectionValue(bare) === bare, 'a value without maps passes as it is');
}

// 2 ───────────────────────────────────────────────────────────────────────────

{
    const root = fileURLToPath(new URL('../../apps/', import.meta.url));
    const files = [];
    (function walk(dir){
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) { if (e.name !== 'test-out') walk(p); }
            else if (e.name.endsWith('.json')) files.push(p);
        }
    })(root);

    // a fixed grid of the plane, and one of the document's canvas
    const planeGrid = [];
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) planeGrid.push([-2 + 0.5*i + 0.0371, -2 + 0.5*j - 0.0213]);

    let docs = 0, withMaps = 0, points = 0, undefinedPoints = 0, worst = 0, worstFile = '', wholeOff = 0;
    let mismatched = 0, notIdempotent = 0, fractional = 0, rowsTotal = 0, rowsOff = 0, differentExact = 0;
    let backPoints = 0, backNone = 0, backHidden = 0, backFar = 0, backMissed = 0, backWorst = 0;
    const backBad = [];
    const fmtP = (p) => '(' + p.map(x => x.toPrecision(8)).join(', ') + ')';
    const bad = [];
    for (const f of files) {
        let data;
        try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
        const tr = data && data.params && data.params.tools && data.params.tools.transform;
        const tp = tr ? (tr.params || tr) : null;
        const pr = tp && tp.projection ? (tp.projection.params || tp.projection) : null;
        if (!pr || typeof pr !== 'object') continue;
        docs++;

        // the fixed chain it replaces
        const old = LegacyProjectionTransform({});
        setParamValues(old.getParams(), plain(pr), true);
        const parts = old.getChainParts();
        const oldChain = { sphere: false, moebius: null, ...parts };
        // the list
        const pt = ProjectionTransform({});
        pt.setParamsMap(plain(pr), true);
        const steps = pt.getChain(0);
        const chain = { sphere: false, moebius: null, steps };
        const value = plain(getParamValues(pt.getParams()));
        const rows = rowsOf(value);
        rowsTotal += rows.length;
        rowsOff += rows.filter(r => !r.params.enabled).length;
        if (pr.enabled === false) wholeOff++;
        if (steps.length) withMaps++;

        // an exponent of the rational map that is no whole number: the old CPU chain rounded
        // it, the shader cut it, and the new chain cuts it as the shader does
        const rat = rows.find(r => r.className === 'ConformalRational' && r.params.enabled);
        const frac = !!rat && [1, 2, 3, 4].some(i => !Number.isInteger(rat.params['n' + i]));
        if (frac) fractional++;

        const e = tp.euclidean || {};
        const zoom = Number(e.zoom) || 1, cx = Number(e.centerX) || 0, cy = Number(e.centerY) || 0;
        const grid = planeGrid.slice();
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) grid.push([cx + (-1 + (2*i + 0.731)/8)/zoom, cy + (-1 + (2*j + 0.317)/8)/zoom]);
        let docWorst = 0, docBad = false;
        if (!frac) {
            for (const p of grid) {
                const a = legacyToWorld(oldChain, p), b = viewChainToWorld(chain, p);
                if (a.exact !== b.exact) { differentExact++; docBad = true; continue; }
                if (!a.exact) { undefinedPoints++; continue; }
                points++;
                const d = Math.hypot(a.pnt[0] - b.pnt[0], a.pnt[1] - b.pnt[1])/(1 + Math.hypot(a.pnt[0], a.pnt[1]));
                if (d > docWorst) docWorst = d;
            }
        }
        if (docWorst > worst) { worst = docWorst; worstFile = path.relative(root, f); }
        if (docWorst > 1e-9 || docBad) { mismatched++; if (bad.length < 5) bad.push(`${path.relative(root, f)}: ${docWorst.toExponential(2)} (${kindsOf(steps)})`); }

        // the other way: a point sent to the world comes back to itself by the steps'
        // direct forms, the seed on it (viewChainToScreen), and its place shows it
        if (steps.length) {
            for (const p of grid) {
                const b = viewChainToWorld(chain, p);
                if (!b.exact) continue;
                backPoints++;
                const s = viewChainToScreen(chain, b.pnt, p);
                if (!s) { backNone++; continue; }
                if (!s.shown) backHidden++;
                // a miss counts in the world's units: where the chain squeezes the plane (far
                // along a band) two screen points are one number in the world
                const d = Math.hypot(s.pnt[0] - p[0], s.pnt[1] - p[1]);
                const dw = d*viewChainScale(chain, p)/(1 + Math.hypot(b.pnt[0], b.pnt[1]));
                if (d > 1e-6*(1 + Math.hypot(p[0], p[1]))) {
                    backFar++;
                    if (dw > 1e-9) { backMissed++; if (backBad.length < 5) backBad.push(`${path.relative(root, f)}: ${fmtP(p)} came back at ${fmtP(s.pnt)} (${kindsOf(steps)})`); }
                }
                if (dw > backWorst) backWorst = dw;
            }
        }

        // saved and loaded again: the same value, the same chain
        const again = ProjectionTransform({});
        again.setParamsMap(plain(value), true);
        if (!same(plain(getParamValues(again.getParams())), value) || !same(plain(again.getChain(0)), plain(steps))) {
            notIdempotent++;
            if (bad.length < 5) bad.push(`${path.relative(root, f)}: not the same after a save and a load`);
        }
    }
    say(`2. ${docs} documents with a projection (${withMaps} with a row acting, ${wholeOff} with the whole switched off): ${rowsTotal} rows, ${rowsOff} of them off;`
        + ` ${points} points compared, ${undefinedPoints} undefined in both, the largest difference ${worst.toExponential(2)}${worstFile ? ' (' + worstFile + ')' : ''};`
        + ` ${fractional} with an exponent that is no whole number left out`);
    for (const b of bad) say('   ' + b);
    check(docs > 0, 'there are documents to compare');
    check(mismatched === 0, `the list's chain gives the fixed chain's points in every document (${mismatched} differ)`);
    check(differentExact === 0, `both chains are defined at the same points (${differentExact} differ)`);
    check(notIdempotent === 0, `the list saved and loaded again is the same (${notIdempotent} differ)`);

    say(`   the other way, the seed on the point: ${backPoints} points of the documents with a row acting; ${backNone} without a place, ${backHidden} at a place that does not show them;`
        + ` ${backFar} came back elsewhere on the screen, ${backMissed} of them elsewhere in the world too; the largest miss in the world's units ${backWorst.toExponential(2)}`);
    for (const b of backBad) say('   ' + b);
    check(backPoints > 10000, 'there are points to send back');
    check(backNone === 0 && backHidden === 0, `every point has a place that shows it (${backNone} without one, ${backHidden} not shown)`);
    check(backMissed === 0, `every point comes back to itself (${backMissed} came back on another copy)`);
}

// 3 ───────────────────────────────────────────────────────────────────────────

{
    const heard = [];
    const pt = ProjectionTransform({});
    pt.addListener((info) => heard.push(info.system ? (info.load ? 'load' : 'system') : 'edit'));
    const maps = pt.getParams().maps;
    const ids = () => pt.getMaps().map(r => r.getId()).join();

    check(pt.getMaps().length === 0 && pt.isIdentity() && pt.getChain(0).length === 0, 'a new list is empty: the identity');
    const band = maps.addChild('ConformalBand');
    check(ids() === 'band' && kindsOf(pt.getChain(0)) === 'band' && !pt.isIdentity(), 'a band added');
    check(heard.length > 0 && heard.every(h => h === 'edit'), `an edit is no system change (${[...new Set(heard)]})`);
    maps.addChild('ConformalExp');
    maps.addChild('ConformalBand');
    check(ids() === 'band,exponent,band2', `a second band gets the next free id: ${ids()}`);
    // the shaders go from the last row to the first
    check(kindsOf(pt.getChain(0)) === 'band exp band', 'the chain from the last row to the first');
    maps.addChild('ConformalScale', 0);
    check(ids() === 'scale,band,exponent,band2' && kindsOf(pt.getChain(0)) === 'band exp band scale', 'a row added at the top is the last step');
    maps.moveChildTo(0, 2);
    check(ids() === 'band,exponent,scale,band2' && kindsOf(pt.getChain(0)) === 'band scale exp band', `a row moved: ${ids()}`);
    pt.getMaps()[1].getParams().enabled.setValue(false);
    check(kindsOf(pt.getChain(0)) === 'band scale band', 'a row switched off leaves the chain');
    band.getParams().fraction.setValue(0.5);
    const first = pt.getChain(0)[2], last = pt.getChain(0)[0];
    check(first.kind === 'band' && Math.abs(first.data[0] - (1 - 1e-3)/(1 - 1e-6)) < 1e-12 && last.data[0] === 1, 'a row\'s value reaches its step');
    const copy = maps.duplicateChild(0);
    check(ids() === 'band,band3,exponent,scale,band2' && copy.getParams().fraction.getValue() === 0.5, `a row duplicated below itself with its values: ${ids()}`);
    maps.setChildId(1, 'narrow');
    check(ids() === 'band,narrow,exponent,scale,band2', 'a row renamed');
    maps.removeChildAt(0);
    check(ids() === 'narrow,exponent,scale,band2' && kindsOf(pt.getChain(0)) === 'band scale band', 'a row removed');
    // the whole switched off
    pt.getParams().enabled.setValue(false);
    check(pt.getChain(0).length === 0 && pt.isIdentity(), 'the whole switched off: no chain');
    pt.getParams().enabled.setValue(true);
    // a value set as a whole is a system change and a load
    heard.length = 0;
    const value = plain(getParamValues(pt.getParams()));
    pt.setParamsMap(value);
    check(heard.length > 0 && heard.every(h => h === 'load'), `a value set is a system change and a load (${[...new Set(heard)]})`);
    check(same(plain(getParamValues(pt.getParams())), value), 'and gives the same value back');
    // the saved shape
    check(value.maps.className === 'ObjArray' && value.maps.params.id === 'maps' && rowsOf(value)[0].className === 'ConformalBand'
          && same(Object.keys(rowsOf(value)[0].params), ['id', 'enabled', 'fraction']), 'the saved shape of the list and of a row');
    check(same(pt.getMapKinds().map(k => k.label), ['fixed points', 'band', 'periodic', 'scale', 'loxodromic', 'exponent', 'upper half plane', 'rational', 'power']),
          'the kinds a row can be, with their labels: those of the fixed maps, then the kinds added since');

    // a kind added after the list, the power: a row like the others, its step z^n, saved and loaded
    const pw = ProjectionTransform({});
    const power = pw.getParams().maps.addChild('ConformalPower');
    check(power.getId() === 'power' && power.enabled && power.getParams().n.getValue() === 2 && kindsOf(pw.getChain(0)) === 'power', 'a power row: z^2 at first');
    const sq = viewChainToWorld({ steps: pw.getChain(0) }, [1, 1]).pnt;
    check(Math.hypot(sq[0], sq[1] - 2) < 1e-12, `the pixel's point squared: (1 + i)^2 = 2i, ${sq.map(x => x.toFixed(6))}`);
    power.getParams().n.setValue(3);
    const cube = viewChainToWorld({ steps: pw.getChain(0) }, [1, 1]).pnt;
    check(Math.hypot(cube[0] + 2, cube[1] - 2) < 1e-12, `its exponent 3: (1 + i)^3 = -2 + 2i, ${cube.map(x => x.toFixed(6))}`);
    pw.getParams().maps.addChild('ConformalBand');
    check(kindsOf(pw.getChain(0)) === 'band power', 'with a band after it: the band first for the shader');
    const saved = plain(getParamValues(pw.getParams()));
    check(same(rowsOf(saved)[0], { className: 'ConformalPower', params: { id: 'power', enabled: true, n: 3 } }), `the saved row: ${JSON.stringify(rowsOf(saved)[0])}`);
    const again = ProjectionTransform({});
    again.setParamsMap(plain(saved), true);
    check(same(plain(getParamValues(again.getParams())), saved) && same(plain(again.getChain(0)), plain(pw.getChain(0))), 'saved and loaded again: the same list, the same chain');
    const un = pw.getUniforms({}, 0);
    check(un.uViewChainCount === 2 && un.uViewChainStep[2] === 9 && un.uViewChainData[4*un.uViewChainStep[3]] === 3, 'the shader gets the power\'s code 9 and its exponent');
    // an old document has no key for it: its upgrade is as it was
    check(same(upgradeProjectionValue({ enabled: true, bandMap: { enabled: true, fraction: 1 } }).maps.params.children.map(c => c.className), ['ConformalBand']), 'the upgrade of an old document knows no power');
}

// 4 ───────────────────────────────────────────────────────────────────────────

{
    const pt = ProjectionTransform({});
    pt.setParamsMap({ enabled: true, maps: listOf([{ className: 'ConformalExp', params: { id: 'exponent', enabled: true } },
                                                   { className: 'ConformalBand', params: { id: 'band', enabled: true, fraction: 1 } }]) }, true);
    check(pt.getMaps().length === 2, 'a list loaded');
    // a patch without the list (a script): the list stays
    pt.setParamsMap({ enabled: false });
    check(pt.getMaps().length === 2 && pt.getParams().enabled.getValue() === false, 'a patch without the list leaves it');
    // a document without maps: an empty list
    pt.setParamsMap({ enabled: true }, true);
    check(pt.getMaps().length === 0 && pt.getParams().enabled.getValue() === true, 'a document without maps empties the list');
    // a row of an unknown kind is left out, the others stay in their order
    const warn = console.warn; let warned = 0; console.warn = () => { warned++; };
    pt.setParamsMap({ enabled: true, maps: listOf([{ className: 'ConformalExp', params: { id: 'exponent', enabled: true } },
                                                   { className: 'ConformalOfTomorrow', params: { id: 'new', enabled: true } },
                                                   { className: 'ConformalUhp', params: { id: 'uhp', enabled: true } }]) }, true);
    console.warn = warn;
    check(pt.getMaps().map(r => r.getClassName()).join() === 'ConformalExp,ConformalUhp' && warned === 1, 'a row of an unknown kind is left out, with a warning');
    // a list loaded over another: the rows of the new one, by their values
    pt.setParamsMap({ enabled: true, maps: listOf([{ className: 'ConformalBand', params: { id: 'band', enabled: false, fraction: 0.25 } }]) }, true);
    check(pt.getMaps().length === 1 && pt.getMaps()[0].getClassName() === 'ConformalBand' && pt.getMaps()[0].getParams().fraction.getValue() === 0.25
          && pt.isIdentity(), 'a list loaded over another');
}

// 5 ───────────────────────────────────────────────────────────────────────────

{
    const pt = ProjectionTransform({});
    const rows = [];
    for (let i = 0; i < VIEW_CHAIN_MAX_STEPS + 2; i++) rows.push({ className: i === 0 ? 'ConformalUhp' : 'ConformalExp', params: { id: 'r' + i, enabled: true } });
    pt.setParamsMap({ enabled: true, maps: listOf(rows) }, true);
    const chain = pt.getChain(0);
    check(chain.length === VIEW_CHAIN_MAX_STEPS, 'as many steps as the loop has');
    check(chain[chain.length - 1].kind === 'uhp', 'the first row is kept (the last step)');
    check(pt.getOverLimit().map(r => r.getId()).join() === `r${VIEW_CHAIN_MAX_STEPS},r${VIEW_CHAIN_MAX_STEPS + 1}`, `the rows past the room are told: ${pt.getOverLimit().map(r => r.getId())}`);
    const un = pt.getUniforms({}, 0);
    const packed = packViewChain(chain);
    check(un.uViewChainCount === packed.count && same([...un.uViewChainStep], [...packed.steps]) && same([...un.uViewChainData], [...packed.data]), 'the uniforms are the packed chain');
    // a row switched off makes room for the next
    pt.getMaps()[1].getParams().enabled.setValue(false);
    check(pt.getChain(0).length === VIEW_CHAIN_MAX_STEPS && pt.getOverLimit().length === 1, 'a row switched off makes room for the next');
}

// 6 ───────────────────────────────────────────────────────────────────────────

{
    // without a group: the steps from the points as they are
    const pt = ProjectionTransform({});
    pt.setParamsMap({ enabled: true, maps: listOf([{ className: 'FixedPointTransform',
        params: { id: 'fixedPoints', enabled: true, word: 'ab', orientation: '1,-1', fp0x: -0.5, fp0y: 0.1, fp1x: 0.6, fp1y: -0.2 } }]) }, true);
    const steps = pt.getChain(0);
    check(steps.length >= 1 && steps.every(s => s.kind === 'moebius'), `the fixed points row gives moebius steps (${steps.length})`);
    // the chain takes the points (-1, 0) and (1, 0) of the screen to the fixed points
    const w0 = viewChainToWorld({ steps }, [-1, 0]).pnt, w1 = viewChainToWorld({ steps }, [1, 0]).pnt;
    const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    check(Math.min(d(w0, [-0.5, 0.1]) + d(w1, [0.6, -0.2]), d(w1, [-0.5, 0.1]) + d(w0, [0.6, -0.2])) < 1e-9,
          `the screen's points (-1, 0) and (1, 0) show the fixed points: ${w0.map(x => x.toFixed(4))} ${w1.map(x => x.toFixed(4))}`);
    check(pt.getMaps()[0].getParams().orientation.getValue() === '1,-1' && pt.getMaps()[0].getId() === 'fixedPoints', 'its values and id');

    // with a group: a change of the group is passed on and the points are found again from the word
    let group = new Group({ s: [iPlane([1, 0, 0, 0]), iPlane([-1, 0, 0, -1])] });     // x -> x + 2
    const pg = ProjectionTransform({ groupMaker: { getGroup: () => group } });
    pg.setParamsMap({ enabled: true, maps: listOf([{ className: 'FixedPointTransform',
        params: { id: 'fixedPoints', enabled: true, word: 'ab', orientation: '1,-1' } }]) }, true);
    const row = pg.getMaps()[0];
    pg.getChain(0);
    check(row.groupChanged === false, 'the row has its values of the group');
    const heard = [];
    pg.addListener((info) => heard.push(info.system));
    pg.onGroupChanged(group);
    check(row.groupChanged === true, 'a change of the group is passed to the row');
    pg.getChain(0);
    check(row.groupChanged === false, 'and its values are found again at the next chain');
}

say(failed ? `conformal_list: ${failed} of ${checks} FAILED` : `conformal_list: all ${checks} passed`);
process.exit(failed ? 1 : 0);
