/*
  Subgroups, presentations and generator elements of orbifolds with bounded walls.

    node tests/orbifold/subgroup_walls.mjs

  An orbifold with a handle or a second crosscap has sides of its domain F on one
  splane, told apart by bounds (Group.getFundDomainWalls), each with its own pairing;
  with a twist F is not convex. Every loop over the sides has to cross a side only
  within its stretch, as Group.toFundDomain does.

  1. the subgroup fold (lib/grouplib/SubgroupDomain.js subgroupFold, subgroupImage)
     of every subgroup of index <= MAX_INDEX, from the derived presentation
     (GroupPresentation.js): random points fold into the walled F with a class, the
     image in the domain of H is H-invariant and lies in the cell of its class.
     Not where h takes the point within 0.01 of the rim of the disk: the CPU's
     transform of a point there gains a height above the plane from the rounding
     (H4toU4), which the next transforms blow up (an open task in TASKS.md)
  2. control: the fold without the walls leaves points of a twisted F unfolded
  3. the packed subgroup domain (packSubgroupDomain) carries the walls, and its
     header and class table stay where the shaders read them
  4. makeSubgroupGroup: the group of H has the walls of its boundary sides, and
     checkDomainConvex takes them
  5. SubgroupConvex.domainCornersCCW: the ends of the stretches are corners; an
     untwisted F is convex, a twisted one not (isUnionConvex of F alone)
  6. GeneratorElements: the sides on one splane get the middles of their own
     stretches (domainSideMidpoints), where the arrows of the generators start,
     and the polygon of F (domainPolygon, the Tile tool's tile) an edge each
*/

const realLog = console.log, realWarn = console.warn;
console.log = () => {}; console.warn = () => {};
const { Group_Orbifold } = await import('../../lib/orbilib/orbilib.js');
const { Group, iPoint, ITransform } = await import('../../lib/invlib/invlib.js');
const { U4 } = await import('../../lib/invlib/U4.js');
const { groupPresentation } = await import('../../lib/grouplib/GroupPresentation.js');
const {
    buildSubgroupDomain, subgroupDomainTable, subgroupFold, subgroupImage, packSubgroupDomain,
    makeSubgroupGroup, checkDomainConvex,
} = await import('../../lib/grouplib/SubgroupDomain.js');
const { domainCornersCCW, domainGeometry, isUnionConvex } = await import('../../lib/grouplib/SubgroupConvex.js');
const {
    domainSideMidpoints, domainPolygon, generatorElements, groupModelAbsolute, groupWalls,
} = await import('../../lib/grouplib/GeneratorElements.js');
const { subgroupsData } = await import('../../lib/sublib/src/sublib.js');
console.log = realLog;

const MAX_INDEX = 3;
const MAX_SUBGROUPS = 10;          // per group
const SAMPLES = 40;
const EPS = 1e-7;
const RIM = 0.99;                  // h(p) beyond this radius is not compared
const INVARIANT = 1e-5;            // images apart by this much are one (the relaxed transforms)

let failures = 0;
function check(ok, msg){ if(!ok){ failures++; console.log('  FAIL:', msg); } return ok; }

// deterministic pseudo random numbers
let seed = 20261121;
function rnd(){ seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed/4294967296; }

const pnt = xy => iPoint([xy[0], xy[1], 0, 0]);
const dist = (p, q) => Math.hypot(p.v[0]-q.v[0], p.v[1]-q.v[1]);

/** a random point of the disk within hyperbolic distance R of its centre */
function randomPoint(R){
    const r = Math.tanh(R*Math.sqrt(rnd())/2), t = 2*Math.PI*rnd();
    return pnt([r*Math.cos(t), r*Math.sin(t)]);
}

// the relaxation starts at random; about 1 in 100 twisted handles comes out with a
// pairing whose mirror has a zero normal (an open task in TASKS.md): built again
const brokenMirror = (group) => [...group.getTransforms(), ...group.getReverseTransforms()].some(t => t.some(s => s.v.every(x => x === 0)));

function makeGroup(name, twist){
    console.log = () => {};
    try {
        for (let attempt = 0; ; attempt++) {
            const maker = new Group_Orbifold({ orbifold: name });
            if (twist !== 0) {
                const p = { ...maker.getParamsMap() };
                Object.keys(p).filter(k => k.endsWith('_t')).forEach(k => p[k] = twist);
                maker.setParamsMap(p);
            }
            const group = maker.getGroup();
            if (!brokenMirror(group) || attempt === 5) return group;
        }
    } finally { console.log = realLog; }
}

/** in the walled domain: across no side (outside it, within its stretch) */
function inWalled(fd, walls, p){
    return fd.every((sp, i) => !(U4.sigDistanceSP(sp, p) > EPS && Group.withinWallBounds(walls && walls[i], p)));
}

/** some elements of H: its pairing transforms and short products of them */
function elementsOf(domain){
    const gens = domain.pairings.map(p => p.itrans);
    const out = gens.slice();
    for(let k = 0; k < 6 && gens.length > 0; k++){
        const a = gens[Math.floor(rnd()*gens.length)], b = gens[Math.floor(rnd()*gens.length)];
        out.push(a.getCopy().concat(b));
    }
    return out;
}

const CASES = [['o33', 0], ['o33', 0.5], ['oo', 0.25], ['2xo', 0.25], ['234oo', 0], ['234oo', 0.25]];

console.log('1-4. subgroups');
let tested = 0;
for (const [name, twist] of CASES) {
    const group = makeGroup(name, twist);
    const fd = group.getFundDomain();
    const walls = group.getFundDomainWalls();
    const tag0 = `${name} twist ${twist}`;
    let pres = null;
    try { pres = groupPresentation(group); } catch (e) { check(false, `${tag0}: presentation: ${e.message}`); continue; }
    const subs = subgroupsData({ name, gens: pres.gens, relators: pres.relators, maxIndex: MAX_INDEX }).subgroups
                  .filter(s => s.index > 1).slice(0, MAX_SUBGROUPS);
    let lines = 0, folded = 0, invariant = 0, nearRim = 0;
    for (const sub of subs) {
        let domain;
        console.log = () => {};
        try { domain = buildSubgroupDomain({ group, cosets: sub.cosets, convex: false }); }
        catch (e) { console.log = realLog; check(false, `${tag0} ${sub.subgroup}: ${e.message}`); continue; }
        console.log = realLog;
        const tag = `${tag0} ${sub.subgroup} (index ${sub.index})`;
        const table = subgroupDomainTable(domain);
        const elements = elementsOf(domain);
        let notInF = 0, notInvariant = 0, notInCell = 0;
        for (let k = 0; k < SAMPLES; k++) {
            const p = randomPoint(2);
            const f = subgroupFold({ group, table, pnt: p });
            if (!f.inDomain || !inWalled(fd, walls, f.pnt) || dist(f.itrans.transform(p), f.pnt) > 1e-6) { notInF++; continue; }
            folded++;
            const img = subgroupImage({ group, domain, table, pnt: p });
            // the image lies in the cell of its class
            if (!inWalled(fd, walls, domain.cells[img.cls].itrans.inverseTransform(img.pnt))) notInCell++;
            const h = elements[k % elements.length];
            const hp = h.transform(p);
            if (Math.hypot(hp.v[0], hp.v[1]) > RIM) { nearRim++; continue; }
            const img2 = subgroupImage({ group, domain, table, pnt: hp });
            if (!img2.inDomain || dist(img.pnt, img2.pnt) > INVARIANT) notInvariant++;
            else invariant++;
        }
        check(notInF === 0, `${tag}: ${notInF} of ${SAMPLES} points did not fold into F`);
        check(notInCell === 0, `${tag}: ${notInCell} images not in the cell of their class`);
        check(notInvariant === 0, `${tag}: ${notInvariant} images are not H-invariant`);

        // 3. the packed domain: header, walls, table
        const data = packSubgroupDomain(domain);
        const n = data[1], m = data[2], tableOffset = data[3];
        const wallsOffset = data[4*1 + 1];
        check(n === domain.n && m === fd.length && tableOffset*4 + 4*n*m === data.length, `${tag}: packed header`);
        check(wallsOffset > 0 && wallsOffset < tableOffset && data[4*wallsOffset] === fd.length, `${tag}: packed walls at ${wallsOffset}`);
        let bounded = 0;
        for (let s = 0; s < fd.length; s++) if (data[4*(wallsOffset + 1 + s)] > 0) bounded++;
        check(bounded === walls.filter(w => w.length > 1).length, `${tag}: ${bounded} bounded sides packed`);

        // 4. the group of H
        console.log = () => {}; console.warn = () => {};
        const H = makeSubgroupGroup({ group, domain, checkConvex: false });
        const convexity = checkDomainConvex({ group, domain, radius: 0.95, step: 0.05 });
        console.log = realLog;
        const hWalls = H.getFundDomainWalls();
        const boundary = domain.sides.filter(sd => sd.kind === 'boundary');
        check(Array.isArray(hWalls) && hWalls.length === boundary.length, `${tag}: the group of H has walls`);
        check(!hWalls || hWalls.every((w, i) => w.length === 1 + boundary[i].bounds.length), `${tag}: H's walls are the bounds of its sides`);
        check(convexity.samples > 0, `${tag}: checkDomainConvex runs`);
        lines++;
        tested++;
    }
    check(invariant >= SAMPLES, `${tag0}: ${invariant} images compared`);
    console.log(`  ${tag0.padEnd(17)} ${lines} subgroups of index 2..${MAX_INDEX}: ${folded} points folded with their class, ${invariant} images H-invariant (${nearRim} h(p) near the rim not compared)`);
}

console.log('2. control: the fold without the walls');
{
    const group = makeGroup('o33', 0.5);
    const flat = new Group({ s: group.getFundDomain(), t: group.getReverseTransforms() });
    const fd = group.getFundDomain(), walls = group.getFundDomainWalls();
    const pres = groupPresentation(group);
    const sub = subgroupsData({ name: 'o33', gens: pres.gens, relators: pres.relators, maxIndex: 2 }).subgroups.find(s => s.index === 2);
    const domain = buildSubgroupDomain({ group, cosets: sub.cosets, convex: false });
    const table = subgroupDomainTable(domain);
    let lost = 0;
    for (let k = 0; k < 200; k++) {
        const f = subgroupFold({ group: flat, table, pnt: randomPoint(3), maxIterations: 200 });
        if (!f.inDomain || !inWalled(fd, walls, f.pnt)) lost++;
    }
    console.log(`  o33 twist 0.5 without its walls: ${lost} of 200 points do not reach F`);
    check(lost > 0, 'the control bites');
}

console.log('5. SubgroupConvex: corners and convexity');
for (const [name, twist, convex] of [['o33', 0, true], ['o33', 0.5, false], ['oo', 0, true], ['oo', 0.25, false]]) {
    const group = makeGroup(name, twist);
    const fd = group.getFundDomain(), walls = group.getFundDomainWalls();
    const geometry = domainGeometry(fd);
    const flat = domainCornersCCW(fd, geometry);
    const walled = domainCornersCCW(fd, geometry, walls);
    const ends = walls.reduce((s, w) => s + w.length - 1, 0);
    const one = isUnionConvex({ group, cells: [{ itrans: new ITransform([], ''), word: '' }] });
    console.log(`  ${name} twist ${twist}: ${flat ? flat.length : 0} corners without the walls, ${walled ? walled.length : 0} with them (${ends} bounds); F ${one ? 'convex' : 'not convex'}`);
    check(walled && walled.length > (flat ? flat.length : 0) - 1, `${name} twist ${twist}: corners with the walls`);
    // every corner found with the walls is a point of the walled domain
    check(walled && walled.every(c => inWalled(fd, walls, pnt(c)) || fd.some(sp => Math.abs(U4.sigDistanceSP(sp, pnt(c))) < 1e-5)), `${name} twist ${twist}: corners on the walled domain`);
    check(one === convex, `${name} twist ${twist}: F is ${convex ? '' : 'not '}convex`);
}

console.log('6. GeneratorElements: the middles of the sides, the polygon');
for (const [name, twist] of CASES) {
    const group = makeGroup(name, twist);
    const fd = group.getFundDomain(), walls = groupWalls(group);
    const absolute = groupModelAbsolute(group);
    const mids = domainSideMidpoints(fd, { absolute, walls });
    const plain = domainSideMidpoints(fd, { absolute });
    const tag = `${name} twist ${twist}`;
    let onOwn = 0, shared = 0, sharedPlain = 0;
    for (let i = 0; i < fd.length; i++) {
        if (walls[i].length < 2) continue;
        const p = pnt(mids[i]);
        if (Math.abs(U4.sigDistanceSP(fd[i], p)) < 1e-5 && Group.withinWallBounds(walls[i], p)) onOwn++;
        for (let j = 0; j < i; j++) {
            if (walls[j].length < 2) continue;
            if (Math.hypot(mids[i][0] - mids[j][0], mids[i][1] - mids[j][1]) < 1e-6) shared++;
            if (Math.hypot(plain[i][0] - plain[j][0], plain[i][1] - plain[j][1]) < 1e-6) sharedPlain++;
        }
    }
    const bounded = walls.filter(w => w.length > 1).length;
    check(onOwn === bounded, `${tag}: ${onOwn} of ${bounded} sides with bounds have their middle on their stretch`);
    check(shared === 0, `${tag}: ${shared} pairs of sides share a middle`);
    // as the Tile tool asks for it (Tiles.js tileFromDomain): the centres of the half
    // turns which split a side in two are corners
    const elements = generatorElements({ group });
    const centres = elements.filter(e => e.kind === 'cone').flatMap(e => [e.center, ...((e.isometry && e.isometry.mirrorFixedPoints) || [])]).filter(c => c);
    const poly = domainPolygon(fd, { corners: centres, absolute, walls });
    const polyPlain = domainPolygon(fd, { corners: centres, absolute });
    const covered = poly ? new Set(poly.sides.map(e => e.side)).size : 0;
    check(poly && covered === fd.length, `${tag}: the polygon has an edge on each of the ${fd.length} sides (${covered})`);
    const starts = elements.filter(e => e.arrow).map(e => e.arrow[0]);
    const distinct = starts.filter((a, i) => starts.findIndex(b => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) === i).length;
    check(distinct === starts.length, `${tag}: the arrows start at ${distinct} points for ${starts.length} arrows`);
    console.log(`  ${tag.padEnd(17)} middles on their own stretches ${onOwn}/${bounded} (without the walls ${sharedPlain} pairs shared one); polygon ${poly ? poly.sides.length + ' edges' : 'none'} (without the walls ${polyPlain ? polyPlain.sides.length + ' edges' : 'none'}); ${starts.length} arrows from distinct points`);
}

console.log(`\n${tested} subgroups tested`);
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} FAILURES`);
process.exit(failures ? 1 : 0);
