/*
  tests of the select tool's Normalize (DrawingEditor.normalizeSelection, Orbits.foldHome):
  each selected shape moved home, to its copy in the fundamental domain, coloured as it was,
  so that the picture stays (docs/shape_normalization_plan.md)

    node tests/drawlib/normalize.mjs

  1. foldHome folds a point hundreds of steps out into the domain (chunked, the map
     factorized), and says so when its budget does not reach it
  2. 632 with the three colours of symdraw-632-3-colors-5 and *237 with the seven of
     symdraw-237-seven-colors (their permutations, coset mode): a shape a few cells out is
     normalized: its centre lands in the domain, it is the old shape moved by a symmetry,
     and every copy is where it was, in the colour it had (the colour layers' sprite
     colouring emulated on a grid of points, as spriteCopyColor computes it; in the disk a
     straight side is an arc in the old copies, so only the outlines differ, between arc and
     chord); the seen box (the selection's copy) stays; a second normalize leaves it; undo
     restores it
  3. a shape far out (beyond the colour layers' 20 fold steps, and beyond one chunk of
     200), carried there with the word back as its colour word: normalized, it comes back
     onto the shape it was carried from, its colour word the identity in the colouring; a
     shape off home carried far the same way lands where normalizing it at once puts it,
     with the same short colour word (shortColorWord)
  4. *632 (mirrors) with the checkerboard colouring: an orientation-reversing fold is
     followed by a mirror, so the shape comes home unmirrored, next to the domain, with a
     colour word of even parity
  5. a group moves as one piece, its members' colour words prefixed; inside a group being
     edited the command is off
  6. a shape far out (up to about 300 fold steps) keeps its copies in the colour layers'
     sprite tiles (CrownCalculator brings a far box near before its search): about home
     they are those of its normalized copy, in the same colours
*/

import { Group_KLM, wordToPerm, strToPermutations, invertPerm, composePerms } from '../../lib/grouplib/grouplib.js';
import { iPoint } from '../../lib/invlib/invlib.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { foldHome, foldSides, spriteCopies, hitsPolyline, applyTransform } from '../../lib/drawlib/Orbits.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const fmt = x => Number.isFinite(x) ? x.toExponential(2) : String(x);

function klm(K, L, M, s){
    const maker = new Group_KLM({});
    Object.assign(maker.params, { K, L, M, s, hasR: false });
    return maker.getGroup();
}
// the presets' KLM parameters: K = 6, L = 2, M = 3 and K = 2, L = 3, M = 7, rotations only (s false)
const g632 = klm(6, 2, 3, false);
const g237 = klm(2, 3, 7, false);
const gs632 = klm(6, 2, 3, true);

const PTC = { centerX: 0, centerY: 0, scale: 1, angle: 0 };

function newEditor(group){
    const document = DrawingDocument();
    document.clear();
    const editor = DrawingEditor({
        document,
        getContext: () => ({ group, ptc: PTC, sprites: false, visLayers: [] }),
        view: { toCanvas: w => w, toWorld: c => ({ pnt: c }), isLinear: () => true, pixelSize: () => 0.001 },
    });
    return { doc: document, editor };
}

// an arrow-like closed polygon (no symmetry of its own, so a mirror image shows) of size h about (cx, cy)
const arrow = (cx, cy, h) => ({ type: 'polyline', closed: true,
    points: [cx - h, cy - 0.4*h, cx + 0.3*h, cy - 0.4*h, cx + 0.3*h, cy - h, cx + h, cy, cx + 0.3*h, cy + 0.7*h, cx + 0.3*h, cy + 0.4*h, cx - h, cy + 0.4*h],
    style: { stroke: { rgba: [1, 0, 0, 1] }, strokeWidth: 0.004, fill: { rgba: [0, 0, 1, 1] } } });

function boxOf(pts){
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i + 1 < pts.length; i += 2) {
        x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]);
        y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]);
    }
    return [x0, y0, x1, y1];
}
const centreOf = pts => { const b = boxOf(pts); return [0.5*(b[0] + b[2]), 0.5*(b[1] + b[3])]; };
const inDomain = (group, p) => group.toFundDomain({ pnt: iPoint(p), maxIterations: 1 }).inDomain;
function signedArea(pts){
    let a = 0;
    for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) a += pts[j]*pts[i + 1] - pts[i]*pts[j + 1];
    return a/2;
}

/**
 * the colour layers' sprite colouring, emulated for one item (coset mode, slot 0 + permIndex):
 * the colours of the copies of the item covering the point P (sorted), as
 * VisualizationColorSym.spriteCopyColor gives them: P folded into the domain (its sides'
 * permutations), each of the item's tiles (spriteCopies, the layer's own search) taking the
 * folded point near the item, the tile's word's permutation after the sides', the slot moved
 * by the item's colour word
 */
function colouring(group, perms, permIndex = 0){
    const inv = perms.map(invertPerm);
    const names = group.getGenNames();
    const size = perms[0].length;
    const tileCache = new Map();
    return function coloursAt(P, item){
        const res = group.toFundDomain({ pnt: iPoint(P), maxIterations: 200 });
        if (!res.inDomain) return null;
        const f = [res.pnt.v[0], res.pnt.v[1]];
        const sides = foldSides(group, res.word || '');
        let p = Array.from({ length: size }, (_, i) => i);
        for (const g of sides) p = composePerms(p, perms[g]);
        let slot = permIndex % size;
        if (item.colorWord) slot = wordToPerm(item.colorWord, perms, inv, false, names)[slot];
        const b = boxOf(item.points);
        const key = item.points.join(',');
        if (!tileCache.has(key)) {
            const half = 0.5*Math.max(b[2] - b[0], b[3] - b[1])*1.05;
            tileCache.set(key, spriteCopies(group, { cx: 0.5*(b[0] + b[2]), cy: 0.5*(b[1] + b[3]), half }, 0, 16, 7));
        }
        const out = [];
        for (const t of tileCache.get(key)) {
            const q = applyTransform(t.fromFD, f);
            if (!hitsPolyline(q, item.points, true, true, 0, 'nonzero')) continue;
            // the permutation of the tile's map from the domain (transToPackedPerms of the fromFD maps)
            const tp = wordToPerm(t.fromFD ? (t.fromFD.getWord() || '') : '', perms, inv, false, names);
            out.push(composePerms(p, tp)[slot]);
        }
        return out.sort((a, b) => a - b).join(',');
    };
}

/**
 * the colourings of the two items compared on a grid round the region [x0, y0, x1, y1]
 * (off the round numbers, so no point lies on an edge): {differ: points the copies of
 * both cover in other colours, cover: points the copies of only one cover, covered: points
 * a copy of the first covers, total}
 */
function compareColours(coloursAt, a, b, region, n = 60){
    let differ = 0, cover = 0, covered = 0, total = 0;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const P = [region[0] + (region[2] - region[0])*(i + 0.3711)/n, region[1] + (region[3] - region[1])*(j + 0.6173)/n];
            const ca = coloursAt(P, a), cb = coloursAt(P, b);
            if (ca === null || cb === null) continue;
            total++;
            if (ca) covered++;
            if (!ca !== !cb) cover++;
            else if (ca !== cb) differ++;
        }
    }
    return { differ, cover, covered, total };
}

// 1 ───────────────────────────────────────────────────────────────────────────

{
    for (const [name, group, P] of [['632', g632, [37.3, -21.1]], ['*237', g237, [0.93, 0.21]]]) {
        const f = foldHome(group, P);
        const q = applyTransform(f.transform, P);
        check(f.inDomain && inDomain(group, f.pnt), `${name}: foldHome reaches the domain from ${P}`);
        check(Math.hypot(q[0] - f.pnt[0], q[1] - f.pnt[1]) < 1e-9, `${name}: the factorized map takes the point where the fold did: ${fmt(Math.hypot(q[0] - f.pnt[0], q[1] - f.pnt[1]))}`);
        check(f.transform.getLength() <= 5, `${name}: the map is at most 5 reflections: ${f.transform.getLength()}`);
        const short = foldHome(group, P, 3);
        check(!short.inDomain, `${name}: a budget of 3 steps does not reach the domain`);
        console.log(`  ${name}: ${P} folded home by a word of ${f.transform.getWord().length} letters`);
    }
}

// 2 ───────────────────────────────────────────────────────────────────────────

const PERMS_632 = strToPermutations('acb bac acb bac');
const PERMS_237 = strToPermutations('abdcegf cabfdeg abdcegf bcaefdg');

// the share of the covered points the outlines may differ by: none in the plane, where the
// symmetries are affine; in the disk a straight side carried by a Moebius map is an arc in the
// old copies and a straight side at home, so the points between arc and chord differ
for (const [name, group, perms, start, h, edges] of [
    ['632', g632, PERMS_632, [0.93, 0.57], 0.04, 0],
    ['*237', g237, PERMS_237, [0.62, 0.33], 0.02, 0.03],
]) {
    const { doc, editor } = newEditor(group);
    const item = doc.insertItem(arrow(start[0], start[1], h));
    const old = doc.getItem(item.id);
    editor.setSelection([{ id: item.id, frame: null, frameInv: null }]);
    const box0 = editor.selectionBox();
    check(editor.canNormalizeSelection(), `${name}: the command is on with a shape selected`);
    const r = editor.normalizeSelection();
    const now = doc.getItem(item.id);
    check(r.moved === 1 && r.home === 0 && r.failed === 0, `${name}: one shape moved: ${JSON.stringify(r)}`);
    const c = centreOf(now.points);
    const cf = foldHome(group, c);
    check(!cf.transform || cf.transform.getLength() === 0, `${name}: its centre is in the domain: ${c.map(x => x.toFixed(4))}`);
    // the old shape moved by a symmetry: the fold of the old centre, applied to every point
    const k = foldHome(group, centreOf(old.points)).transform;
    let dev = 0;
    for (let i = 0; i + 1 < old.points.length; i += 2) {
        const q = applyTransform(k, [old.points[i], old.points[i + 1]]);
        dev = Math.max(dev, Math.hypot(q[0] - now.points[i], q[1] - now.points[i + 1]));
    }
    check(dev < 1e-9, `${name}: the shape is the old one moved by the fold of its centre: ${fmt(dev)}`);
    check(typeof now.colorWord === 'string' && now.colorWord.length > 0, `${name}: it took a colour word: '${now.colorWord}'`);
    // the picture: every copy where it was, in the colour it had (about the old place and about home)
    const coloursAt = colouring(group, perms);
    const ob = boxOf(old.points), nb = boxOf(now.points);
    const pad = 3*h;
    for (const [where, b] of [['the old place', ob], ['home', nb]]) {
        const cmp = compareColours(coloursAt, old, now, [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad]);
        check(cmp.covered > 50 && cmp.differ === 0, `${name}: about ${where}, ${cmp.differ} of ${cmp.total} points take other colours (${cmp.covered} covered)`);
        check(cmp.cover <= edges*cmp.covered, `${name}: about ${where}, ${cmp.cover} points covered by the copies of one only (${cmp.covered} covered)`);
        console.log(`  ${name}: about ${where}: ${cmp.total} points, ${cmp.covered} covered by copies, ${cmp.differ} in other colours, ${cmp.cover} by one only`);
    }
    // the copy seen stays selected where it was
    const box1 = editor.selectionBox();
    check(box1.every((x, i) => near(x, box0[i], 1e-9)), `${name}: the seen box stays: ${box1.map(x => x.toFixed(5))} against ${box0.map(x => x.toFixed(5))}`);
    // a second time: home already
    const again = editor.normalizeSelection();
    check(again.moved === 0 && again.home === 1 && doc.getItem(item.id).colorWord === now.colorWord, `${name}: normalized again it stays: ${JSON.stringify(again)}`);
    // undo
    editor.undo();
    const back = doc.getItem(item.id);
    check(back.points.every((x, i) => x === old.points[i]) && !back.colorWord, `${name}: undo restores the shape and drops the colour word`);
}

// 3 ───────────────────────────────────────────────────────────────────────────

for (const [name, group, perms, home, far, h] of [
    ['632', g632, PERMS_632, [0.21, 0.08], [83.4, -51.7], 0.05],
    ['*237', g237, PERMS_237, [0.05, 0.02], [0.985, 0.12], 0.01],
]) {
    const { doc, editor } = newEditor(group);
    const A = arrow(home[0], home[1], h);
    // S takes the domain where the far point folds from: S = k^-1 for the fold k of the far point
    const fk = foldHome(group, far);
    check(fk.inDomain, `${name}: the far point folds home`);
    const S = fk.transform.getInverse();
    const steps = fk.transform.getWord().length;
    const carried = { ...A, points: [] };
    for (let i = 0; i + 1 < A.points.length; i += 2) carried.points.push(...applyTransform(S, [A.points[i], A.points[i + 1]]));
    // coloured as it was at A: the word back is S^-1 = k
    carried.colorWord = fk.transform.getWord();
    const item = doc.insertItem(carried);
    editor.setSelection([{ id: item.id, frame: null, frameInv: null }]);
    const r = editor.normalizeSelection();
    const now = doc.getItem(item.id);
    let dev = 0;
    for (let i = 0; i < A.points.length; i++) dev = Math.max(dev, Math.abs(now.points[i] - A.points[i]));
    const inv = perms.map(invertPerm);
    const perm = wordToPerm(now.colorWord || '', perms, inv, false, group.getGenNames());
    const identity = perm.every((x, i) => x === i);
    check(r.moved === 1 && dev < 1e-6, `${name}: a shape ${steps} fold steps out comes back onto the one it was carried from: ${fmt(dev)}`);
    check(identity, `${name}: its colour word ('${(now.colorWord || '').slice(0, 40)}', ${(now.colorWord || '').length} letters) is the identity in the colouring: ${perm}`);
    console.log(`  ${name}: ${steps} steps out, back within ${fmt(dev)}, colour word ${(now.colorWord || '').length} letters`);
}

// a shape off home (not in the domain) carried far with its colours kept, then normalized:
// where normalizing it at once puts it, with a short colour word of the same element (two
// ways to the same place give one long word that free reduction leaves; shortColorWord)
for (const [name, group, perms, start, far, h] of [
    ['632', g632, PERMS_632, [0.93, 0.57], [41.3, 23.7], 0.04],
    ['*237', g237, PERMS_237, [0.62, 0.33], [0.97, -0.18], 0.02],
]) {
    const direct = newEditor(group);
    const d0 = direct.doc.insertItem(arrow(start[0], start[1], h));
    direct.editor.setSelection([{ id: d0.id, frame: null, frameInv: null }]);
    direct.editor.normalizeSelection();
    const want = direct.doc.getItem(d0.id);

    const { doc, editor } = newEditor(group);
    const A = arrow(start[0], start[1], h);
    const fk = foldHome(group, far);
    const S = fk.transform.getInverse();
    const carried = { ...A, points: [] };
    for (let i = 0; i + 1 < A.points.length; i += 2) carried.points.push(...applyTransform(S, [A.points[i], A.points[i + 1]]));
    carried.colorWord = fk.transform.getWord();
    const item = doc.insertItem(carried);
    editor.setSelection([{ id: item.id, frame: null, frameInv: null }]);
    editor.normalizeSelection();
    const now = doc.getItem(item.id);
    let dev = 0;
    for (let i = 0; i < want.points.length; i++) dev = Math.max(dev, Math.abs(now.points[i] - want.points[i]));
    const inv = perms.map(invertPerm);
    const pa = wordToPerm(now.colorWord || '', perms, inv, false, group.getGenNames()).join('');
    const pb = wordToPerm(want.colorWord || '', perms, inv, false, group.getGenNames()).join('');
    check(dev < 1e-6, `${name}: carried ${fk.transform.getWord().length} steps out and normalized, it lands where normalizing at once puts it: ${fmt(dev)}`);
    check(pa === pb && (now.colorWord || '').length <= (want.colorWord || '').length + 2,
          `${name}: with a short colour word of the same colours: '${now.colorWord}' against '${want.colorWord}'`);
    console.log(`  ${name}: carried ${fk.transform.getWord().length} steps out: back within ${fmt(dev)}, colour word '${now.colorWord}' (at once '${want.colorWord}')`);
}

// 4 ───────────────────────────────────────────────────────────────────────────

{
    // *632: the checkerboard colouring, each mirror swaps the two colours
    const group = gs632;
    const perms = strToPermutations(group.getFundDomain().map(() => 'ba').join(' '));
    const inv = perms.map(invertPerm);
    const coloursAt = colouring(group, perms);
    let reversing = 0;
    for (const start of [[0.9, 0.5], [1.1, 0.2], [-0.8, 0.6], [-0.6, -0.9], [0.3, -1.1], [0.62, 0.71]]) {
        const { doc, editor } = newEditor(group);
        const item = doc.insertItem(arrow(start[0], start[1], 0.02));
        const old = doc.getItem(item.id);
        const f = foldHome(group, centreOf(old.points));
        const e = 1e-4, a = applyTransform(f.transform, start), x = applyTransform(f.transform, [start[0] + e, start[1]]), y = applyTransform(f.transform, [start[0], start[1] + e]);
        const rev = (x[0] - a[0])*(y[1] - a[1]) - (x[1] - a[1])*(y[0] - a[0]) < 0;
        if (rev) reversing++;
        editor.setSelection([{ id: item.id, frame: null, frameInv: null }]);
        editor.normalizeSelection();
        const now = doc.getItem(item.id);
        check(Math.sign(signedArea(now.points)) === Math.sign(signedArea(old.points)), `*632 from ${start}: the shape comes home unmirrored`);
        const perm = wordToPerm(now.colorWord || '', perms, inv, false, group.getGenNames());
        check(perm[0] === 0, `*632 from ${start}: its colour word '${now.colorWord}' has even parity`);
        const c = centreOf(now.points);
        const back = foldHome(group, c);
        check(!back.transform || back.transform.getWord().length <= 1, `*632 from ${start}: it lands in the domain or the cell next to it`);
        const ob = boxOf(old.points), nb = boxOf(now.points);
        for (const b of [ob, nb]) {
            const cmp = compareColours(coloursAt, old, now, [b[0] - 0.06, b[1] - 0.06, b[2] + 0.06, b[3] + 0.06], 40);
            check(cmp.covered > 20 && cmp.differ === 0 && cmp.cover === 0, `*632 from ${start}: ${cmp.differ} of ${cmp.total} points in other colours, ${cmp.cover} covered by one only`);
        }
    }
    check(reversing > 0, `*632: some of the starts fold by a reversing map (${reversing})`);
    console.log(`  *632: ${reversing} of 6 starts folded by a reversing map, all home unmirrored`);
}

// 5 ───────────────────────────────────────────────────────────────────────────

{
    const { doc, editor } = newEditor(g632);
    const a = arrow(3.0, 1.6, 0.05), b = { ...arrow(3.15, 1.75, 0.03), colorWord: 'a' };
    const grp = doc.insertItem({ type: 'group', children: [a, b] });
    const old = doc.getItem(grp.id);
    editor.setSelection([{ id: grp.id, frame: null, frameInv: null }]);
    const r = editor.normalizeSelection();
    const now = doc.getItem(grp.id);
    const k = foldHome(g632, centreOf(old.points)).transform;
    let dev = 0;
    old.children.forEach((ch, n) => {
        for (let i = 0; i + 1 < ch.points.length; i += 2) {
            const q = applyTransform(k, [ch.points[i], ch.points[i + 1]]);
            dev = Math.max(dev, Math.hypot(q[0] - now.children[n].points[i], q[1] - now.children[n].points[i + 1]));
        }
    });
    check(r.moved === 1 && dev < 1e-9, `a group moves as one piece, by the fold of its box's centre: ${fmt(dev)}`);
    const w0 = now.children[0].colorWord || '', w1 = now.children[1].colorWord || '';
    check(!now.colorWord && w0.length > 0 && (w1 === w0 + 'a' || w1.length < w0.length + 1), `its members take the word back before their own: '${w0}', '${w1}'`);
    // inside the group: off
    editor.enterContainer(grp.id, null, null);
    editor.setSelection([{ id: now.children[0].id, frame: null, frameInv: null }]);
    check(!editor.canNormalizeSelection(), 'off while editing inside a group');
}

// 6 ───────────────────────────────────────────────────────────────────────────
//  a sprite far out keeps its copies in the colour layers: their tile search
//  (CrownCalculator) brings a box its 20 fold steps do not reach near first, so the
//  copies about home of a shape hundreds of steps out are those of its normalized
//  copy, in the same colours

{
    const coloursAt = colouring(g632, PERMS_632);
    for (const start of [[0.93, 0.57], [1.9, 1.1], [3.1, 1.7], [12.3, 7.1], [37.3, -21.1]]) {
        const { doc, editor } = newEditor(g632);
        const item = doc.insertItem(arrow(start[0], start[1], 0.04));
        const old = doc.getItem(item.id);
        editor.setSelection([{ id: item.id, frame: null, frameInv: null }]);
        editor.normalizeSelection();
        const now = doc.getItem(item.id);
        const steps = foldHome(g632, centreOf(old.points)).transform.getWord().length;
        const nb = boxOf(now.points);
        const c = compareColours(coloursAt, old, now, [nb[0] - 0.1, nb[1] - 0.1, nb[2] + 0.1, nb[3] + 0.1], 40);
        check(c.covered > 50 && c.differ === 0 && c.cover === 0,
              `632, a shape ${steps} fold steps out: its copies about home are its normalized copy's: ${c.covered} of ${c.total} points covered, ${c.cover} covered by one only, ${c.differ} in other colours`);
        console.log(`  632, a shape ${steps} fold steps out: ${c.covered} points about home covered, as by its normalized copy`);
    }
}

if (failed) {
    console.log(`${failed} check(s) failed`);
    process.exit(1);
}
console.log('normalize: all checks passed');
