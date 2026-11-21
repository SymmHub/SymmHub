/*
  tests of the view anchor (lib/grouplib/ViewAnchor.js, docs/infinite_navigation_plan.md)

    node tests/groups/view_anchor.mjs

  1. the anchor of a far centre maps the centre into F; its word and map agree (the
     word's side maps composed give the map)
  2. exactness: around a far centre every pixel p folds (as the shaders do, colour
     permutation included) to the same point of F and the same permutation as a(p)
     folded from the anchor's permutation, a(p) evaluated in the centred form the
     shaders get (uAnchorCQ, uAnchorAB, uAnchorAnti); wallpaper 632 with its Dirichlet
     domain and 3 colours, 333 with 3 colours, the hyperbolic 237 with 7 colours
  3. incremental updates: a pan in small steps gives the same anchor element as one
     update at the end (same map), the word stays short (back home it is folded afresh),
     foldState recomputes only past the common part
  4. a group change resets the anchor; disabled gives no uniforms
  5. step 1b: the view map composed in double (getViewUniforms), evaluated at the float
     offset from the view's centre as the shaders do, against the chain in double;
     the 1a path (the float world point) for comparison
  6, 7. far jumps over frames; 8. phase 2, the anchored view
  9. band mode (step 1b through the whole band, docs/fold_precision_assessment.md 6.4):
     the shaders' band path in float against the same maps in double (sharp at any
     distance) and against the band's true point, the place reduced by the group's
     translation along the band (right to 16 plane units); the walk's word and map a
     function of the place alone; small pans as one jump; a far jump over frames; the
     frames that are no band's (viewChainBand, bandViewFrame)
*/

import fs from 'node:fs';

const realLog = console.log; console.log = () => {};
const grouplib = await import('../../lib/grouplib/grouplib.js');
console.log = realLog;

const { viewAnchorMath } = await import('../../lib/grouplib/modules.js');
const { makeViewAnchor, makeDirichletGroup, parseWords, dirichletBase, strToPermutations, sidePermutations, mirrorsToMap, composeMaps, mapSize } = grouplib;

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}

const EPS = 1e-7;

function makeGroup(className, params, dirichlet = null){
    console.log = () => {};
    const maker = new grouplib[className]();
    if (typeof maker.setParamsMap === 'function') maker.setParamsMap(params);
    else if (typeof maker._setParamsMap === 'function') maker._setParamsMap(params);
    else { Object.assign(maker.params, params); if (maker.state) maker.state.paramChanged = true; }
    const group = maker.getGroup();
    const on = dirichlet && dirichlet.enabled;
    const dg = on ? makeDirichletGroup(group, { base: dirichletBase(dirichlet), words: parseWords(dirichlet.words) }) : null;
    console.log = realLog;
    return dg || group;
}

function loadPreset(path){
    const doc = JSON.parse(fs.readFileSync(new URL(`../../apps/symdraw/presets/${path}.json`, import.meta.url), 'utf8'));
    const sym = doc.params.symmetry;
    const group = makeGroup(sym.group.className, sym.group.params, sym.dirichlet);
    const m = JSON.stringify(doc.params).match(/"permutations":"([^"]+)"[^}]*?"useOrbit":(true|false)/);
    let sidePerms = null, useOrbit = false;
    if (m) {
        useOrbit = m[2] === 'true';
        sidePerms = sidePermutations(group, strToPermutations(m[1]), useOrbit);
    }
    return { group, sidePerms, useOrbit };
}

function sideDist(sp, p){
    const v = sp.v;
    if (sp.type === 1) { const d = Math.hypot(p[0] - v[0], p[1] - v[1]) - Math.abs(v[3]); return v[3] > 0 ? d : -d; }
    return p[0]*v[0] + p[1]*v[1] - v[3];
}
function reflect(sp, p){
    const v = sp.v;
    if (sp.type === 1) {
        const dx = p[0] - v[0], dy = p[1] - v[1], k = v[3]*v[3]/(dx*dx + dy*dy);
        return [v[0] + k*dx, v[1] + k*dy];
    }
    const t = 2*(p[0]*v[0] + p[1]*v[1] - v[3]);
    return [p[0] - t*v[0], p[1] - t*v[1]];
}
const composePerm = (outer, inner) => inner.map(i => outer[i]);
const identityPerm = n => Array.from({ length: n }, (_, i) => i);
const permStep = G => (perm, g) => G.useOrbit ? composePerm(G.sidePerms[g], perm) : composePerm(perm, G.sidePerms[g]);

/** the shaders' fold (permutations24.glsl.mjs) */
function fold(G, p, maxIter, perm){
    const fd = G.group.getFundDomain();
    const trs = G.group.getReverseTransforms();
    let pnt = [p[0], p[1]];
    let inDomain = false, steps = 0;
    for (; steps < maxIter; steps++) {
        const g = fd.findIndex(sp => sideDist(sp, pnt) > EPS);
        if (g < 0) { inDomain = true; break; }
        const t = trs[g];
        for (const sp of (t.getRef ? t.getRef() : t)) pnt = reflect(sp, pnt);
        if (perm) perm = permStep(G)(perm, g);
    }
    return { p: pnt, perm, steps, inDomain };
}

/** the shaders' applyAnchor (inversiveSampler.glsl.mjs), in double */
function applyAnchorUniforms(U, p){
    let w = [p[0] - U.uAnchorCQ[0], p[1] - U.uAnchorCQ[1]];
    if (U.uAnchorAnti) w = [w[0], -w[1]];
    const A = [U.uAnchorAB[0], U.uAnchorAB[1]], B = [U.uAnchorAB[2], U.uAnchorAB[3]];
    const den = [A[0] + B[0]*w[0] - B[1]*w[1], A[1] + B[0]*w[1] + B[1]*w[0]];
    const dd = den[0]*den[0] + den[1]*den[1];
    return [U.uAnchorCQ[2] + (w[0]*den[0] + w[1]*den[1])/dd, U.uAnchorCQ[3] + (w[1]*den[0] - w[0]*den[1])/dd];
}

const nearSide = (G, p, tol) => G.group.getFundDomain().some(sp => Math.abs(sideDist(sp, p)) < tol);
const inF = (G, p) => G.group.getFundDomain().every(sp => sideDist(sp, p) <= EPS);
const samePerm = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

const wp632 = loadPreset('wp/par_632-3-colors-2');
const wp333 = loadPreset('color/symdraw-333-stars');
const h237 = loadPreset('klm/symdraw-237-kites-7-colors');

const cmul = (a, b) => [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
const cdiv = (a, b) => { const d = b[0]*b[0] + b[1]*b[1]; return [(a[0]*b[0] + a[1]*b[1])/d, (a[1]*b[0] - a[0]*b[1])/d]; };
const hypTo = c => z => { const cz = cmul([c[0], -c[1]], z); return cdiv([z[0] + c[0], z[1] + c[1]], [1 + cz[0], cz[1]]); };
const diskPoint = (d, t) => { const r = Math.tanh(d/2); return [r*Math.cos(t), r*Math.sin(t)]; };

// 1, 2 ────────────────────────────────────────────────────────────────────────

function exactness(name, G, centre, view, n = 25){
    const anchor = makeViewAnchor();
    anchor.update({ group: G.group, refPoint: centre, enabled: true, maxSteps: 1e7, budgetMs: Infinity });
    const U = anchor.getUniforms();
    check(U.uAnchorEnabled, `${name}: the anchor is on`);
    const c0 = [Math.fround(centre[0]), Math.fround(centre[1])];
    check(inF(G, anchor.mapPoint(c0)), `${name}: the anchor maps the centre into F`);
    // the word's maps composed against the map
    const np = G.sidePerms[0].length;
    const aPerm = anchor.foldState({}, identityPerm(np), permStep(G));
    let worst = 0, permDiff = 0, count = 0, maxDirect = 0, maxAnch = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const p = view([2*i/(n - 1) - 1, 2*j/(n - 1) - 1]);
        const d = fold(G, p, 1e7, identityPerm(np));
        const q = fold(G, applyAnchorUniforms(U, p), 1000, aPerm.slice());
        if (!d.inDomain || !q.inDomain || nearSide(G, d.p, 1e-6)) continue;
        count++;
        worst = Math.max(worst, Math.hypot(d.p[0] - q.p[0], d.p[1] - q.p[1]));
        if (!samePerm(d.perm, q.perm)) permDiff++;
        maxDirect = Math.max(maxDirect, d.steps);
        maxAnch = Math.max(maxAnch, q.steps);
    }
    console.log(`  ${name.padEnd(30)} word ${String(anchor.getWord().length).padStart(5)} | steps direct <= ${String(maxDirect).padStart(5)}, anchored <= ${String(maxAnch).padStart(3)} | points apart <= ${worst.toExponential(1)} | colours differ ${permDiff}/${count}`);
    check(count > n*n/2, `${name}: most pixels compared`);
    check(worst < 1e-5, `${name}: the same points (${worst})`);
    check(permDiff === 0, `${name}: the same colours (${permDiff} differ)`);
    check(maxAnch < 60, `${name}: few steps from the anchor (${maxAnch})`);
}

console.log('1, 2. the anchor of a far centre, pixels folded directly and from the anchor');
for (const [name, G] of [['632 Dirichlet, 3 colours', wp632], ['333, 3 colours', wp333]]) {
    for (const c of [[7.31, -3.17], [-412.3, 977.1], [3051.7, -2012.9]]) {
        exactness(`${name} at (${c})`, G, c, s => [c[0] + 3*s[0], c[1] + 3*s[1]]);
    }
}
for (const d of [2, 5, 8]) {
    const c = diskPoint(d, 0.7);
    const T = hypTo(c);
    exactness(`237, 7 colours, distance ${d}`, h237, c, s => T([0.5*s[0], 0.5*s[1]]));
}

// 3 ───────────────────────────────────────────────────────────────────────────

console.log('3. incremental updates');
{
    const G = wp632;
    const a = makeViewAnchor();
    const cache = {};
    const np = G.sidePerms[0].length;
    let calls = 0;
    const step = (perm, g) => { calls++; return permStep(G)(perm, g); };
    const end = [83.17, -41.29];
    const N = 400;
    for (let k = 0; k <= N; k++) {
        const t = k/N;
        a.update({ group: G.group, refPoint: [end[0]*t + 0.11, end[1]*t + 0.07], enabled: true });
        a.foldState(cache, identityPerm(np), step);
    }
    const b = makeViewAnchor();
    b.update({ group: G.group, refPoint: [end[0] + 0.11, end[1] + 0.07], enabled: true, maxSteps: 1e7, budgetMs: Infinity });
    // the same element: the same map (up to the sign of the matrix) and the same permutation
    const ma = a.getMap(), mb = b.getMap();
    const s = Math.sign(ma.m[0][0]*mb.m[0][0] + ma.m[0][1]*mb.m[0][1]) || 1;
    const diff = Math.max(...ma.m.map((e, i) => Math.hypot(e[0] - s*mb.m[i][0], e[1] - s*mb.m[i][1])));
    check(ma.anti === mb.anti && diff < 1e-9, `the pan and the jump give the same anchor (${diff})`);
    const pa = a.foldState(cache, identityPerm(np), step);
    const pb = b.foldState({}, identityPerm(np), permStep(G));
    check(samePerm(pa, pb), 'the pan and the jump give the same permutation');
    console.log(`  pan of ${N} steps: word ${a.getWord().length} letters (jump: ${b.getWord().length}), the permutation computed ${calls} times`);
    check(calls < 3*a.getWord().length + 50, `foldState is incremental (${calls} steps for a word of ${a.getWord().length})`);
    // back home in small steps: the word reduces to nothing
    for (let k = N; k >= 0; k--) {
        const t = k/N;
        a.update({ group: G.group, refPoint: [end[0]*t + 0.11, end[1]*t + 0.07], enabled: true });
    }
    const len = a.getWord().length;
    console.log(`  back home: word ${len} letters`);
    check(len < 2*64, `back home the word is short (${len})`);
    check(inF(G, a.mapPoint([Math.fround(0.11), Math.fround(0.07)])), 'back home the anchor maps the centre into F');
}

// 4 ───────────────────────────────────────────────────────────────────────────

console.log('4. reset and off');
{
    const a = makeViewAnchor();
    a.update({ group: wp632.group, refPoint: [40.3, 12.1], enabled: true });
    check(a.getWord().length > 0, 'a far centre gives a word');
    const v = a.getVersion();
    a.update({ group: wp333.group, refPoint: [0.01, 0.02], enabled: true });
    check(a.getVersion() !== v, 'a group change changes the version');
    a.update({ group: wp333.group, refPoint: [40.3, 12.1], enabled: false });
    check(a.getUniforms().uAnchorEnabled === false && a.getWord().length === 0, 'off: no anchor');
    a.update({ group: wp333.group, refPoint: null, enabled: true });
    check(a.getUniforms().uAnchorEnabled === false, 'no reference point: no anchor');
}

// 5 ───────────────────────────────────────────────────────────────────────────

console.log('5. step 1b: the view map composed in double, against the chain applied in double');
{
    const f32 = Math.fround;
    // the shaders' 1b path: q + v'/(A + B v') with v the float offset from the view's centre
    function applyView(U, v){
        let w = [f32(v[0]), f32(v[1])];
        if (U.uAnchorViewAnti) w = [w[0], -w[1]];
        // the uniforms and every operation in float
        const [A0, A1, B0, B1] = U.uAnchorViewAB.map(f32);
        const den = [f32(A0 + f32(f32(B0*w[0]) - f32(B1*w[1]))), f32(A1 + f32(f32(B0*w[1]) + f32(B1*w[0])))];
        const dd = f32(f32(den[0]*den[0]) + f32(den[1]*den[1]));
        const r = [f32(f32(f32(w[0]*den[0]) + f32(w[1]*den[1]))/dd), f32(f32(f32(w[1]*den[0]) - f32(w[0]*den[1]))/dd)];
        return [f32(f32(U.uAnchorViewQ[0]) + r[0]), f32(f32(U.uAnchorViewQ[1]) + r[1])];
    }
    // the 1a path: the world point in float, then the centred anchor
    const apply1a = (U, p) => applyAnchorUniforms(U, [f32(p[0]), f32(p[1])]);
    const applyMirrors = (ms, p) => { for (const sp of ms) p = reflect(sp, p); return p; };

    function viewCase(name, G, center, mirrors, half, pixel){
        const anchor = makeViewAnchor();
        const ref = applyMirrors(mirrors, center);
        anchor.update({ group: G.group, refPoint: ref, enabled: true, maxSteps: 1e7, budgetMs: Infinity });
        const U = anchor.getUniforms();
        const V = anchor.getViewUniforms(center, mirrors);
        check(V.uAnchorView, `${name}: 1b on`);
        let e1a = 0, e1b = 0;
        const n = 9;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
            const v = [half*(2*i/(n - 1) - 1), half*(2*j/(n - 1) - 1)];
            // exact: the chain in double, the anchor's map in double
            const exact = anchor.mapPoint(applyMirrors(mirrors, [center[0] + v[0], center[1] + v[1]]));
            // the GPU's 1a: u_center + v in float, the chain (float model: rounded after it), then the anchor
            const p1a = apply1a(U, applyMirrors(mirrors, [f32(f32(center[0]) + f32(v[0])), f32(f32(center[1]) + f32(v[1]))]));
            const p1b = applyView(V, v);
            // in pixels of the anchored frame: pixel times the local scale
            const v2 = [v[0] + pixel, v[1]];
            const e2 = anchor.mapPoint(applyMirrors(mirrors, [center[0] + v2[0], center[1] + v2[1]]));
            const px = Math.hypot(e2[0] - exact[0], e2[1] - exact[1]);
            e1a = Math.max(e1a, Math.hypot(p1a[0] - exact[0], p1a[1] - exact[1])/px);
            e1b = Math.max(e1b, Math.hypot(p1b[0] - exact[0], p1b[1] - exact[1])/px);
        }
        console.log(`  ${name.padEnd(34)} error in pixels: 1a ${e1a.toExponential(1)}, 1b ${e1b.toExponential(1)}`);
        check(e1b < 0.01, `${name}: 1b within 0.01 pixel (${e1b})`);
        return { e1a, e1b };
    }
    // Euclidean: the canvas centre far out, no mirrors; view 2 wide, 1000 pixels
    for (const D of [1e3, 1e5, 1e6]) {
        const c = [D*0.8 + 0.1234, D*0.6 + 0.2345];
        viewCase(`632 Euclidean, centre at ${D.toExponential(0)}`, wp632, c, [], 1, 0.002);
    }
    // hyperbolic: the navigator's two mirrors taking 0 to the point at distance d; view radius 0.5
    for (const d of [8, 12, 15]) {
        const t = 0.7, r = Math.tanh(d/2), ch = [Math.cos(t), Math.sin(t)];
        const R = 1/r, rho = Math.sqrt(R*R - 1);
        const mirrors = [{ type: 2, v: [ch[0], ch[1], 0, 0] }, { type: 1, v: [R*ch[0], R*ch[1], 0, rho] }];
        viewCase(`237 hyperbolic, distance ${d}`, h237, [0.0123, -0.0071], mirrors, 0.5, 0.001);
    }
}

// 6 ───────────────────────────────────────────────────────────────────────────

realLog('6. a jump far away: over frames, each within its budget');
{
    const G = wp632;
    const ref = [8.3e4 + 0.1234, -5.1e4 + 0.2345];
    const a = makeViewAnchor();
    let frames = 0, worst = 0;
    do {
        const t0 = performance.now();
        a.update({ group: G.group, refPoint: ref, enabled: true, budgetMs: 6 });
        worst = Math.max(worst, performance.now() - t0);
        frames++;
    } while (a.isPending() && frames < 10000);
    const len = a.getWord().length;
    realLog(`  word ${len} letters in ${frames} frames, the longest update ${worst.toFixed(1)} ms`);
    check(!a.isPending(), 'the jump gets to F');
    check(worst < 20, `each update within its budget (${worst.toFixed(1)} ms)`);
    check(inF(G, a.mapPoint([Math.fround(ref[0]), Math.fround(ref[1])])), 'the anchor maps the centre into F');
    const b = makeViewAnchor();
    b.update({ group: G.group, refPoint: ref, enabled: true, maxSteps: 1e8, budgetMs: Infinity });
    const np = G.sidePerms[0].length;
    const cache = {};
    let calls = 0;
    const step = (perm, g) => { calls++; return permStep(G)(perm, g); };
    const pa = a.foldState(cache, identityPerm(np), step);
    check(samePerm(pa, b.foldState({}, identityPerm(np), permStep(G))), 'the same permutation as one fold');
    check(cache.states.length < len/200 + 2, `the cache keeps checkpoints only (${cache.states.length} states)`);
    // a small pan further: a few steps of the permutation
    calls = 0;
    a.update({ group: G.group, refPoint: [ref[0] + 1.3, ref[1] - 0.7], enabled: true });
    a.foldState(cache, identityPerm(np), step);
    realLog(`  a pan of 1.5 units: the permutation computed ${calls} times`);
    check(calls < 2*256, `a small pan far out is cheap (${calls})`);
}

// 7 ───────────────────────────────────────────────────────────────────────────

realLog('7. far away and back, the permutation of every frame as the renderer gets it');
{
    const G = wp632;
    const home = [0.1234, 0.2345];
    const D = Number(process.env.FAR || 2e5);
    const EXTRA = Number(process.env.EXTRA ?? 400);
    const far = [0.8*D + 0.1234, -0.6*D + 0.2345];
    const a = makeViewAnchor();
    const cache = {};
    const frame = ref => { a.update({ group: G.group, refPoint: ref, enabled: true, budgetMs: 6 }); return a.foldPermutation(cache, G.sidePerms, G.useOrbit); };
    const settle = ref => { let n = 0, p; do { p = frame(ref); n++; } while (a.isPending() && n < 100000); for (let k = 0; k < EXTRA; k++) p = frame(ref); return { p, n }; };
    settle(home);
    const f = settle(far);
    const fFar = makeViewAnchor();
    fFar.update({ group: G.group, refPoint: far, enabled: true, maxSteps: 1e9, budgetMs: Infinity });
    const pFar = fFar.foldPermutation({}, G.sidePerms, G.useOrbit);
    check(samePerm(f.p, pFar), `far: the same permutation as one fold (${f.n} frames, word ${a.getWord().length})`);
    const b = settle(home);
    const fresh = makeViewAnchor();
    fresh.update({ group: G.group, refPoint: home, enabled: true, maxSteps: 1e7, budgetMs: Infinity });
    const ma = a.getMap(), mb = fresh.getMap();
    const s = Math.sign(ma.m[0][0]*mb.m[0][0] + ma.m[0][1]*mb.m[0][1]) || 1;
    const diff = Math.max(...ma.m.map((e, i) => Math.hypot(e[0] - s*mb.m[i][0], e[1] - s*mb.m[i][1])));
    const wl = a.getWord(); realLog(`  back home in ${b.n} frames: word ${wl.length > 20 ? wl.length + " letters" : JSON.stringify(wl)} (fresh ${JSON.stringify(fresh.getWord())}), maps apart ${diff.toExponential(1)}`);
    const pb = fresh.foldPermutation({}, G.sidePerms, G.useOrbit);
    const pw = a.foldPermutation({}, G.sidePerms, G.useOrbit);
    check(samePerm(pw, pb), `back: the word's permutation is the fresh one's (${pw} / ${pb})`);
    check(samePerm(b.p, pb), `back: the cached permutation is the fresh one's (${b.p} / ${pb})`);
}

// 8 ───────────────────────────────────────────────────────────────────────────

const { applyMap } = viewAnchorMath;
const { iFactorizeU4 } = await import('../../lib/invlib/invlib.js');
const mapApart = (S, T, pts) => Math.max(...pts.map(p => { const a = applyMap(S, p), b = applyMap(T, p); return Math.hypot(a[0] - b[0], a[1] - b[1]); }));

realLog('8. phase 2: the anchored view kept as the navigator keeps it, hyperbolic travel');
{
    const G = h237;
    const inverseOf = list => list.slice().reverse();
    // the navigator's transform: mirrors from the world to the view plane, the first
    // first, normalized as the navigator does
    const norm = list => list.length > 5 ? iFactorizeU4(list) : list;
    // the motion of the unit disk taking 0 to p: the line across p through 0, then the
    // geodesic halfway
    const disk = p => {
        const r = Math.hypot(p[0], p[1]);
        if (r < 1e-15) return [];
        const n = [p[0]/r, p[1]/r];
        const s = Math.tanh(Math.atanh(r)/2);
        const C = (1 + s*s)/(2*s), rho = (1 - s*s)/(2*s);
        return [{ type: 2, v: [n[0], n[1], 0, 0] }, { type: 1, v: [C*n[0], C*n[1], 0, rho] }];
    };
    const a = makeViewAnchor();
    let trans = [];
    const centre = () => applyMap(mirrorsToMap(inverseOf(trans)), [0, 0]);
    const frame = () => {
        a.update({ group: G.group, refPoint: centre(), enabled: true, anchored: true, budgetMs: Infinity, maxSteps: 1e6 });
        const pre = [];
        for (const g of a.takeSteps()) pre.unshift(...inverseOf(a.sideReflections(g)));
        trans = norm([...pre, ...trans]);
        return centre();
    };
    // a move as the navigator makes it in the group's frame (modelFrame): the view's
    // point q to the centre is a motion of the world's disk after the transform
    // the view's point at distance d along x to the centre: the translation along the
    // geodesic of the world's points u (the view's centre) and v, taking v to u
    // (centred at u: phi_u o phi_-w o phi_-u, w = phi_-u(v))
    const moveBy = d => {
        const back = mirrorsToMap(inverseOf(trans));
        const u = applyMap(back, [0, 0]);
        const v = applyMap(back, [Math.tanh(d/2), 0]);
        const w = applyMap(mirrorsToMap(disk([-u[0], -u[1]])), v);
        trans = norm([...disk([-u[0], -u[1]]), ...disk([-w[0], -w[1]]), ...disk(u), ...trans]);
    };
    frame();
    let outside = 0, biggest = 0;
    const travel = (d, n) => {
        for (let k = 0; k < n; k++) {
            moveBy(d);
            if (!inF(G, frame())) outside++;
            biggest = Math.max(biggest, mapSize(mirrorsToMap(trans)));
        }
    };
    // the unit circle (the group's absolute) to the unit circle: the view is a hyperbolic motion
    const offCircle = () => Math.max(...[0, 1, 2, 3, 4, 5].map(k => { const p = applyMap(mirrorsToMap(trans), [Math.cos(k), Math.sin(k)]); return Math.abs(Math.hypot(p[0], p[1]) - 1); }));
    const home = [0.3, 0.2, -0.1].map(x => applyMap(mirrorsToMap(trans), [x, x/2]));
    // there and back: a heading error e is e sinh(d) away after the distance d, so not far
    travel(0.25, 20);
    travel(-0.25, 20);
    const backApart = Math.max(...[0.3, 0.2, -0.1].map((x, i) => { const p = applyMap(composeMaps(mirrorsToMap(trans), a.getMap()), [x, x/2]); return Math.hypot(p[0] - home[i][0], p[1] - home[i][1]); }));
    realLog(`  out to distance 5 and back: the true view ${backApart.toExponential(1)} from the start, word ${a.getWord().length}`);
    check(backApart < 1e-6, 'out to distance 5 and back: the same view');
    // circles: the moves of the view (after trans) along a geodesic polygon round a
    // circle of radius 3, crossing the same tiles again; the free reduction does not
    // shorten such words, the anchor refolds the true centre near home
    // (refoldAnchored). The true view trans o a against the moves composed apart
    {
        const viewMove = (m) => { trans = norm([...trans, ...m]); truth = composeMaps(mirrorsToMap(m), truth); };
        const step = 0.25, turnBy = step/Math.tanh(3);
        const turn = s => [{ type: 2, v: [0, 1, 0, 0] }, { type: 2, v: [-Math.sin(s/2), Math.cos(s/2), 0, 0] }];
        let truth = composeMaps(mirrorsToMap(trans), a.getMap());
        let steps = 0, longest = 0, refolds = 0, last = a.getWord().length;
        for (let k = 0, n = 3*Math.round(2*Math.PI*Math.sinh(3)/step); k < n; k++) {
            viewMove(disk([-Math.tanh(step/2), 0]));
            viewMove(turn(turnBy));
            frame();
            steps++;
            const wl = a.getWord().length;
            if (wl < last - 2) refolds++;
            last = wl;
            longest = Math.max(longest, wl);
        }
        const now = composeMaps(mirrorsToMap(trans), a.getMap());
        const pts = [[0.3, 0.15], [0.2, 0.1], [-0.1, -0.05], [0, 0]];
        const apart = mapApart(now, truth, pts);
        realLog(`  ${steps} steps round a circle of radius 3, three times: the true view ${apart.toExponential(1)} from the moves composed, word ${a.getWord().length} letters (the longest ${longest}, refolded ${refolds} times)`);
        check(apart < 1e-9, 'circles: the true view the same after the refolds');
        // the word grows by REFOLD_MIN (64) and a quarter before the anchor refolds
        check(refolds > 0 && longest < 160, `circles: the word stays short (${longest}, ${refolds} refolds)`);
    }
    // out past distance 18 the anchor's map is no longer exact (the true transform out
    // of reach); back the same way the word reduces freely and the map, evaluated
    // afresh from it, is exact again
    {
        // a generic heading: the x axis runs along edges of the tiling, where the
        // rounding picks the sides and the way back is not the way out
        const s = 0.4123;
        trans = norm([...trans, { type: 2, v: [0, 1, 0, 0] }, { type: 2, v: [-Math.sin(s/2), Math.cos(s/2), 0, 0] }]);
        frame();
        const w0 = a.getWord().length;
        travel(0.25, 120);
        const farExact = a.isMapExact(), farWord = a.getWord().length;
        travel(-0.25, 120);
        frame();
        realLog(`  out to distance 30 and back: word ${w0} -> ${farWord} -> ${a.getWord().length} letters, the map exact far out ${farExact}, back ${a.isMapExact()}`);
        check(!farExact && a.isMapExact(), 'out to distance 30 and back: the map exact again');
    }
    travel(0.25, 400);
    realLog(`  out to distance 100: word ${a.getWord().length} letters, the anchored transform's largest entry ${biggest.toFixed(2)}, off the absolute ${offCircle().toExponential(1)}, centre outside F ${outside} times`);
    check(outside === 0, 'the anchored centre is in F after every frame');
    check(biggest < 20, `the anchored transform stays bounded (${biggest.toFixed(2)})`);
    // the view's disk drifts by the rounding of the factorizations, as without the anchor;
    // the moves are made in the view's own disk (modelFrame), so the drift does not build up
    check(offCircle() < 1e-5, 'the anchored view is a hyperbolic motion at distance 100');
}

// 9 ───────────────────────────────────────────────────────────────────────────

realLog('9. band mode: step 1b through the whole band, the anchor walking the band');
{
    const { viewChainBand } = await import('../../lib/symhublib/ViewChain.js');
    const { bandStep, moebiusSteps, plainStep } = await import('../../lib/symhublib/conformal/ConformalKinds.js');
    const { bandViewFrame, groupGeometry } = grouplib;
    const { translationX } = viewAnchorMath;
    const G = h237;
    const geo = groupGeometry(G.group);
    check(geo.kind === 'hyperbolic' && Math.hypot(geo.c[0], geo.c[1]) < 1e-9 && Math.abs(geo.r - 1) < 1e-9, 'the kites: the unit disk');
    const RATE = Math.PI/4;
    const f32 = Math.fround;
    const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
    // tanh in double: (sinh 2x + i sin 2y)/(cosh 2x + cos 2y)
    const ctanh = z => { const den = Math.cosh(2*z[0]) + Math.cos(2*z[1]); return [Math.sinh(2*z[0])/den, Math.sin(2*z[1])/den]; };
    const dH = (a, b) => { const n = cmul([a[0], -a[1]], b); return 2*Math.atanh(Math.hypot(a[0] - b[0], a[1] - b[1])/Math.hypot(1 - n[0], -n[1])); };
    // the kites' translation along the real axis, an element of the group: twice the
    // triangle's three sides; the coloured pattern repeats after three of them
    const side = (a, b, c) => Math.acosh((Math.cos(a) + Math.cos(b)*Math.cos(c))/(Math.sin(b)*Math.sin(c)));
    const P1 = (2/Math.PI)*2*(side(Math.PI/2, Math.PI/3, Math.PI/7) + side(Math.PI/3, Math.PI/2, Math.PI/7) + side(Math.PI/7, Math.PI/2, Math.PI/3));
    // applyAnchor's band path in float, operation by operation (inversiveSampler.glsl.mjs)
    function shaderPoint(U, v){
        let w = [f32(v[0]), f32(v[1])];
        if (U.uAnchorBandAnti) w = [w[0], -w[1]];
        const [a0, a1, b0, b1] = U.uAnchorBandAB.map(f32);
        const d1 = [f32(a0 + f32(f32(b0*w[0]) - f32(b1*w[1]))), f32(a1 + f32(f32(b0*w[1]) + f32(b1*w[0])))];
        const dd1 = f32(f32(d1[0]*d1[0]) + f32(d1[1]*d1[1]));
        const z = [f32(f32(U.uAnchorBandQ[0]) + f32(f32(f32(w[0]*d1[0]) + f32(w[1]*d1[1]))/dd1)),
                   f32(f32(U.uAnchorBandQ[1]) + f32(f32(f32(w[1]*d1[0]) - f32(w[0]*d1[1]))/dd1))];
        const k = f32(0.7853981633974483);
        const zz = [f32(k*z[0]), f32(k*z[1])];
        const e = f32(Math.exp(f32(-2*Math.abs(zz[0]))));
        const c = f32(Math.cos(zz[1])), s = f32(Math.sin(zz[1]));
        const t = f32(1 - e);
        const d = f32(f32(t*t) + f32(f32(f32(4*e)*c)*c));
        const re = f32(1 - f32(f32(f32(2*e)*f32(f32(f32(2*c)*c) - t))/d));
        let sp = [zz[0] < 0 ? -re : re, f32(f32(f32(f32(4*e)*s)*c)/d)];
        if (U.uAnchorViewAnti) sp = [sp[0], -sp[1]];
        const [A0, A1, B0, B1] = U.uAnchorViewAB.map(f32);
        const den = [f32(A0 + f32(f32(B0*sp[0]) - f32(B1*sp[1]))), f32(A1 + f32(f32(B0*sp[1]) + f32(B1*sp[0])))];
        const dd = f32(f32(den[0]*den[0]) + f32(den[1]*den[1]));
        const r = [f32(f32(f32(sp[0]*den[0]) + f32(sp[1]*den[1]))/dd), f32(f32(f32(sp[1]*den[0]) - f32(sp[0]*den[1]))/dd)];
        return [f32(f32(U.uAnchorViewQ[0]) + r[0]), f32(f32(U.uAnchorViewQ[1]) + r[1])];
    }
    // the same maps in double: the maps before the band centred, the band, T
    function doublePoint(F, T, v){
        let w = v.slice();
        if (F.pre.anti) w = [w[0], -w[1]];
        const z = cadd(F.pre.q, cdiv(w, cadd([F.pre.AB[0], F.pre.AB[1]], cmul([F.pre.AB[2], F.pre.AB[3]], w))));
        return applyMap(T, ctanh([RATE*z[0], RATE*z[1]]));
    }
    const applyMirrorsD = (ms, p) => { for (const sp of ms) p = reflect(sp, p); return p; };
    const bandArgs = (c, pre, post) => [c, pre, post, RATE, geo];
    const update = (a, F, budgetMs = Infinity) => a.update({ group: G.group, refPoint: null, enabled: true, band: F.walk, maxSteps: 1e9, budgetMs });
    const uniforms = (a, F) => ({ ...a.getBandUniforms(), uAnchorBandQ: F.pre.q, uAnchorBandAB: F.pre.AB, uAnchorBandAnti: F.pre.anti });
    const np = G.sidePerms[0].length;

    // a view about the canvas centre c: offsets within half (plane units), 128 pixels a plane unit
    // truth(v): the band's true point of the pixel, null where there is none
    function bandCase(name, c, pre, post, half, truth, placeTol){
        const F = bandViewFrame(...bandArgs(c, pre, post));
        check(!!F, `${name}: a band's frame`);
        if (!F) return null;
        const a = makeViewAnchor();
        update(a, F);
        check(a.isBand() && !a.isPending(), `${name}: band mode, the walk done`);
        const U = uniforms(a, F);
        check(U.uAnchorView && U.uAnchorBand, `${name}: the band's uniforms`);
        const T = a.getBandMap();
        const aPerm = a.foldPermutation({}, G.sidePerms, G.useOrbit);
        let sharp = 0, place = [], colours = 0, compared = 0, stepsMax = 0;
        const n = 9;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
            const v = [half*(2*i/(n - 1) - 1), half*(2*j/(n - 1) - 1)];
            const pixel = (Math.PI/2)/128/Math.cos(Math.PI/2*Math.min(0.99, Math.abs(F.pre.q[1] + v[1])));
            const qf = fold(G, shaderPoint(U, v), 200, aPerm.slice());
            const qd = fold(G, doublePoint(F, T, v), 200, aPerm.slice());
            if (!qf.inDomain || !qd.inDomain || nearSide(G, qd.p, 1e-6)) continue;
            stepsMax = Math.max(stepsMax, qf.steps);
            sharp = Math.max(sharp, dH(qf.p, qd.p)/pixel);
            const t = truth ? truth(v) : null;
            if (!t) continue;
            const qt = fold(G, t, 1e6, identityPerm(np));
            if (!qt.inDomain || nearSide(G, qt.p, 1e-6)) continue;
            compared++;
            place.push(dH(qd.p, qt.p)/pixel);
            if (!samePerm(qd.perm, qt.perm)) colours++;
        }
        place.sort((x, y) => x - y);
        const med = place.length ? place[place.length >> 1] : NaN;
        const worst = place.length ? place[place.length - 1] : NaN;
        realLog(`  ${name.padEnd(42)} word ${String(a.getWord().length).padStart(6)} | fold steps <= ${String(stepsMax).padStart(2)} | float against double <= ${sharp.toExponential(1)} px` +
                (truth ? ` | place: middle ${med.toExponential(1)}, largest ${worst.toExponential(1)} px, colours differ ${colours}/${compared}` : ''));
        check(sharp < 0.01, `${name}: sharp, the float path within 0.01 pixel of the double (${sharp})`);
        check(stepsMax <= 40, `${name}: few fold steps (${stepsMax})`);
        if (truth && placeTol) {
            check(compared > n*n/2, `${name}: most pixels compared with the truth (${compared})`);
            check(worst < placeTol, `${name}: in its place within ${placeTol} pixel (${worst})`);
            check(colours === 0, `${name}: the true colours (${colours} differ)`);
        }
        return { a, F };
    }

    // the band alone, the view's centre at x + 0.17 i: the truth reduced by the
    // translation (three of them: the colours repeat too), exact in double near the middle
    const y0 = 0.17;
    const reduced = (x) => (v) => { const k = Math.round(x/(3*P1)); const z = [x - 3*P1*k + v[0], y0 + v[1]]; return ctanh([RATE*z[0], RATE*z[1]]); };
    for (const [x, tol] of [[0.3, 0.01], [2.9, 0.01], [5.7, 0.01], [8.3, 0.01], [12, 0.01], [14, 0.01], [16, 0.05], [18, null], [20, null], [30, null], [100, null], [1000, null]]) {
        bandCase(`the band at ${x}`, [x, y0], [], [], 0.5, reduced(x), tol);
    }
    // the maps before the band (the navigation's, z -> 2 conj(z) + 0.3) and after it (a turn
    // of the disk by 0.7): the truth through the same maps in double, near the middle
    {
        const pre = [{ type: 2, v: [0, 1, 0, 0] }, { type: 1, v: [0, 0, 0, 1] }, { type: 1, v: [0, 0, 0, Math.SQRT2] }, { type: 2, v: [1, 0, 0, 0] }, { type: 2, v: [1, 0, 0, 0.15] }];
        const post = [{ type: 2, v: [0, 1, 0, 0] }, { type: 2, v: [-Math.sin(0.35), Math.cos(0.35), 0, 0] }];
        for (const x of [3.1, 9.7, 13.2]) {
            const c = [(x - 0.3)/2, -y0/2];
            const truth = (v) => { const z = applyMirrorsD(pre, [c[0] + v[0], c[1] + v[1]]); return applyMirrorsD(post, ctanh([RATE*z[0], RATE*z[1]])); };
            bandCase(`before and after the band, at ${x}`, c, pre, post, 0.25, truth, 0.01);
        }
        bandCase('before and after the band, at 200', [(200 - 0.3)/2, -y0/2], pre, post, 0.25, null, null);
    }

    // the walk is a function of the place: the same word and map however reached
    {
        const at = (x) => bandViewFrame(...bandArgs([x, y0], [], []));
        const walk = (xs) => { const a = makeViewAnchor(); for (const x of xs) update(a, at(x)); return a; };
        const ref = walk([50.3]);
        const sameAs = (b) => {
            const w1 = ref.getWord(), w2 = b.getWord();
            const T1 = ref.getBandMap(), T2 = b.getBandMap();
            return w1.length === w2.length && w1.every((g, i) => g === w2[i]) && T1.anti === T2.anti && T1.m.every((e, i) => e[0] === T2.m[i][0] && e[1] === T2.m[i][1]);
        };
        check(sameAs(walk([80.1, 50.3])), 'the walk: there by way of 80, the same word and map');
        check(sameAs(walk([-30.2, 61.7, 50.3])), 'the walk: there by way of -30 and 62, the same word and map');
        const small = makeViewAnchor();
        let biggest = 0;
        for (let x = 0; x <= 50.3 + 1e-9; x += 0.1) {
            update(small, at(Math.min(x, 50.3)));
            biggest = Math.max(biggest, mapSize(small.getMap()));
        }
        update(small, at(50.3));
        check(sameAs(small), 'the walk: small pans give the jump\'s word and map');
        realLog(`  the walk to 50.3: word ${ref.getWord().length} letters, the walk's map at most ${biggest.toFixed(2)} on the way`);
        check(biggest < 20, `the walk's map stays near the identity (${biggest})`);
        // the uniforms of the programs without the offset (1a) stay on, the anchor's element at the float world point
        const far = walk([1000]);
        check(far.getUniforms().uAnchorEnabled === true, 'band mode: the anchor on for the 1a programs far out');
    }

    // a far jump: over frames within the budget, then the jump's word
    {
        const F = bandViewFrame(...bandArgs([2.0e4 + 0.37, y0], [], []));
        const a = makeViewAnchor();
        let frames = 0, worst = 0;
        do {
            const t0 = performance.now();
            update(a, F, 6);
            worst = Math.max(worst, performance.now() - t0);
            frames++;
            if (a.isPending()) check(!a.getBandUniforms().uAnchorView, 'pending: no band uniforms (the 1a path)');
        } while (a.isPending() && frames < 10000);
        realLog(`  a jump to 20000 plane units: ${frames} frames, the longest update ${worst.toFixed(1)} ms, word ${a.getWord().length} letters`);
        check(!a.isPending() && a.isBand(), 'the far jump gets there');
        check(worst < 20, `each update within its budget (${worst.toFixed(1)} ms)`);
        const b = makeViewAnchor();
        update(b, F);
        const wa = a.getWord(), wb = b.getWord();
        check(wa.length === wb.length && wa.every((g, i) => g === wb[i]), 'over frames: the jump\'s word');
    }

    // the frames that are no band's
    {
        const band = bandStep(1);
        const two = [{ type: 1, v: [0, 0, 0, 1] }, { type: 1, v: [0, 0, 0, 2] }];   // z -> 4z: the unit circle off the absolute
        check(viewChainBand({ sphere: false, moebius: null, steps: [band] }) !== null, 'viewChainBand: the band alone');
        const split = viewChainBand({ sphere: false, moebius: two, steps: [...moebiusSteps(two), band, ...moebiusSteps(two.slice(0, 1))] });
        check(split && split.pre.length === 4 && split.post.length === 1 && split.rate === RATE, 'viewChainBand: the mirrors before and after the band');
        check(viewChainBand({ sphere: true, moebius: null, steps: [band] }) === null, 'viewChainBand: not with the sphere');
        check(viewChainBand({ sphere: false, moebius: null, steps: [bandStep(0.5)] }) === null, 'viewChainBand: not a fraction of the band');
        check(viewChainBand({ sphere: false, moebius: null, steps: [band, band] }) === null, 'viewChainBand: not two bands');
        check(viewChainBand({ sphere: false, moebius: null, steps: [band, plainStep('uhp')] }) === null, 'viewChainBand: not with another kind');
        check(viewChainBand({ sphere: false, moebius: null, steps: [] }) === null, 'viewChainBand: no band');
        check(bandViewFrame([3, 0], [], two, RATE, geo) === null, 'bandViewFrame: not when the maps after the band move the disk off the absolute');
        check(bandViewFrame([3, 0], [], [], RATE, null) === null, 'bandViewFrame: not without an absolute');
        // a pan composed: L(u) L(w) = L(u + w), tanh(rate (x + z)) = L(rate x)(tanh(rate z))
        const L = translationX(RATE*7.3);
        const z = [0.41, -0.23], lhs = ctanh([RATE*(7.3 + z[0]), RATE*z[1]]), rhs = applyMap(L, ctanh([RATE*z[0], RATE*z[1]]));
        check(Math.hypot(lhs[0] - rhs[0], lhs[1] - rhs[1]) < 1e-15, 'the pan along the band is the translation of the disk');
        // leaving band mode: the anchor folds the view's disk again
        const a = makeViewAnchor();
        update(a, bandViewFrame(...bandArgs([40, 0.1], [], [])));
        const c = diskPoint(3, 0.4);
        a.update({ group: G.group, refPoint: c, viewDisk: { c, r: 1e-9 }, enabled: true, maxSteps: 1e7, budgetMs: Infinity });
        check(!a.isBand() && a.getViewUniforms([0, 0], []).uAnchorBand === false, 'band mode left: the view\'s disk folded, no band');
        check(inF(G, a.mapPoint(c)), 'band mode left: the anchor maps the centre into F');
    }
}

console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
