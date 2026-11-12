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
*/

import fs from 'node:fs';

const realLog = console.log; console.log = () => {};
const grouplib = await import('../../lib/grouplib/grouplib.js');
console.log = realLog;

const { makeViewAnchor, makeDirichletGroup, parseWords, dirichletBase, strToPermutations, sidePermutations } = grouplib;

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

console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
