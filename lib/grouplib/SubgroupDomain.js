import {
  ITransform,
  iPoint,
  isDefined,
  GroupUtils,
  Group,
} from '../invlib/invlib.js';
import { U4 } from '../invlib/U4.js';

const DEBUG = false;
const MYNAME = 'SubgroupDomain';

const EPS = 1.e-6;

/*
  SubgroupDomain.js

  Builds the fundamental domain of a finite index subgroup H of a group G,
  together with the pairing transforms of that domain.

  G is given the way grouplib defines groups: a fundamental domain (array of
  splanes) and pairing transforms which map the domain onto its neighboring
  cells.  H is given by its coset table: for each generator of G, the
  permutation it induces on the cosets of H (the format of sublib's
  color_groups files: coset 0 is H itself, words act on cosets left to right).

  The construction:

  1) walk the coset table breadth first, starting from coset 0 with the
     identity.  The first time a coset j is reached, the accumulated transform
     claims the corresponding cell of G's tiling.  The result is one cell per
     coset; their union is a fundamental domain of H, connected by
     construction.  The claimed transforms are a canonical transversal of H.

  2) every side of every claimed cell either faces another claimed cell
     (an interior wall of the union) or faces a cell that belongs to another
     representative's H-orbit.  In the second case the composite

        h = T_i * t_s * T_j^-1     (words act left to right)

     is an element of H which pairs this boundary side with a boundary side of
     the union: the pairing transforms of H's domain.  Collected up to
     inverses, they are canonical generators of H.
*/

/**
  parse a coset permutation string in the sublib format:
  one word per generator, 'a'=0, 'b'=1, ...
  'acb bca cab' -> [[0,2,1],[1,2,0],[2,0,1]]
*/
export function parseCosetPerms(str){

  const words = String(str).trim().split(/[\s,]+/);
  const aa = 'a'.charCodeAt(0);
  return words.map(w => Array.from(w, ch => ch.charCodeAt(0) - aa));
}

function invertPerm(perm){

  const inv = new Array(perm.length);
  perm.forEach((v, i) => inv[v] = i);
  return inv;
}

function ptDistSquared(p1, p2){

  let s = 0;
  for(let i = 0; i < 4; i++){
    const d = p1.v[i] - p2.v[i];
    s += d*d;
  }
  return s;
}

/**
  whether two transforms represent the same isometry,
  tested by their action on the given points
*/
export function sameTransform(t1, t2, testPoints, eps = EPS){

  for(let i = 0; i < testPoints.length; i++){
    const p1 = t1.transform(testPoints[i]);
    const p2 = t2.transform(testPoints[i]);
    if(ptDistSquared(p1, p2) > eps*eps)
      return false;
  }
  return true;
}

/**
  classify a euclidean isometry of the (x,y) plane

  return {
    type:   'identity' | 'rotation' | 'translation' | 'reflection' | 'glide',
    angle:  rotation angle in radians, CCW, in (-PI, PI]   (rotation only)
    center: [x,y] fixed point                              (rotation only)
    translation: [x,y]                                     (translation, glide)
    axis:   {point:[x,y], dir:[x,y]}                       (reflection, glide)
  }
*/
export function classifyEuclidean(itrans, eps = EPS){

  const o = itrans.transform(iPoint([0,0,0,0])).v;
  const u = itrans.transform(iPoint([1,0,0,0])).v;
  const v = itrans.transform(iPoint([0,1,0,0])).v;

  // linear part, columns are images of the basis vectors
  const uxx = u[0]-o[0], uxy = u[1]-o[1];
  const vxx = v[0]-o[0], vxy = v[1]-o[1];
  const det = uxx*vxy - uxy*vxx;
  const tx = o[0], ty = o[1];

  if(det > 0){
    // direct isometry: rotation by angle about some center, or translation
    const angle = Math.atan2(uxy, uxx);
    if(Math.abs(angle) < eps){
      if(Math.abs(tx) < eps && Math.abs(ty) < eps)
        return {type: 'identity'};
      return {type: 'translation', translation: [tx, ty]};
    }
    // fixed point of x -> R x + t:  (I - R) c = t
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const a11 = 1 - ca, a12 = sa, a21 = -sa, a22 = 1 - ca;
    const d = a11*a22 - a12*a21;
    const cx = ( a22*tx - a12*ty)/d;
    const cy = (-a21*tx + a11*ty)/d;
    return {type: 'rotation', angle: angle, center: [cx, cy]};
  } else {
    // opposite isometry: reflection or glide reflection
    // mirror direction is the +1 eigenvector of the linear part
    const theta = Math.atan2(uxy, uxx); // R = reflection across line at angle theta/2
    const dir = [Math.cos(theta/2), Math.sin(theta/2)];
    // glide component: translation part along the axis
    const glide = tx*dir[0] + ty*dir[1];
    // a point on the axis: half of the across-axis part of the translation
    const px = (tx - glide*dir[0])/2;
    const py = (ty - glide*dir[1])/2;
    if(Math.abs(glide) < eps)
      return {type: 'reflection', axis: {point: [px, py], dir: dir}};
    return {type: 'glide', axis: {point: [px, py], dir: dir},
            translation: [glide*dir[0], glide*dir[1]]};
  }
}

/** short human readable form of classifyEuclidean's result */
export function isometryToString(cls){

  const f = x => x.toFixed(4).replace(/\.?0+$/, '') || '0';
  const pt = p => '(' + f(p[0]) + ',' + f(p[1]) + ')';
  switch(cls.type){
    case 'identity':    return 'identity';
    case 'rotation':    return 'rotation by ' + f(cls.angle/Math.PI) + '*PI about ' + pt(cls.center);
    case 'translation': return 'translation by ' + pt(cls.translation);
    case 'reflection':  return 'reflection in line thru ' + pt(cls.axis.point) + ' dir ' + pt(cls.axis.dir);
    case 'glide':       return 'glide along ' + pt(cls.axis.dir) + ' thru ' + pt(cls.axis.point) + ' by ' + pt(cls.translation);
    default:            return '?';
  }
}

/**
  build the fundamental domain and the pairing transforms of a subgroup

  opt = {
    group:  invlib Group (fundDomain + pairing transforms of G)
    cosets: coset permutations of H: sublib string 'acb bca cab'
            or an array of permutation arrays, one per generator of G
    testPoints: optional points used to compare transforms
  }

  return {
    n:          index of H in G (count of cosets = count of cells)
    genNames:   generator names of G, ['a','b','c',...]
    cells:      array[n] of {coset, word, itrans}, cells[j].coset == j;
                cell j is the image of G's domain under itrans, and the words
                are a canonical transversal: coset(word) == j
    sides:      array of {cell, side, splane, kind:'interior'|'boundary',
                  neighborCell,             // interior: the facing cell
                  pairing }                 // boundary: index into pairings
    pairings:   array of {word, itrans, isometry,
                  from:{cell, side}, to:{cell, side}, inverseOf }
                the pairing transforms of H's domain; entries come in
                inverse pairs unless self inverse (inverseOf: index)
    generators: indices into pairings, one per inverse pair: canonical
                generators of H
  }
*/
export function buildSubgroupDomain(opt){

  const group = opt.group;
  const fd = group.getFundDomain();
  const nsides = fd.length;
  const genNames = group.getGenNames();

  let perms = opt.cosets;
  if(typeof perms === 'string')
    perms = parseCosetPerms(perms);
  if(perms.length !== nsides)
    throw new Error(`${MYNAME}: got ${perms.length} permutations for ${nsides} generators`);
  const n = perms[0].length;

  const testPoints = isDefined(opt.testPoints) ? opt.testPoints :
    [iPoint([0.12345, 0.06789, 0, 0]), iPoint([-0.07211, 0.16183, 0, 0])];

  // direct generators of G as ITransform with single letter words
  const dirGens = group.transforms.map((t, i) => new ITransform(t.slice(), genNames[i]));

  // growth edges: direct generators first, then inverses (used only if needed)
  const edges = [];
  for(let i = 0; i < nsides; i++)
    edges.push({itrans: dirGens[i], perm: perms[i], letter: genNames[i]});
  for(let i = 0; i < nsides; i++)
    edges.push({itrans: dirGens[i].getInverse(), perm: invertPerm(perms[i]),
                letter: genNames[i].toUpperCase()});

  // ---- step 1: claim one cell per ORBIT class --------------------------
  //
  //  Words act left to right on points, so the transform of word W is
  //  fn = last-letter o ... o first-letter, and the neighbor of cell T(FD)
  //  across its image of side s is (T o t_s)(FD): the generator letter is
  //  PREPENDED (it acts first).
  //
  //  The H-images of cell u are the cells u.h (h in H): the ORBIT class,
  //  identified by  beta(u) = A_u^-1[0], which updates locally under a
  //  prepended letter x:  beta(xW) = invperm_x[beta(W)].  A fundamental
  //  domain of H holds ONE CELL PER ORBIT CLASS, chosen by compact growth:
  //  among the cells edge-adjacent to the union built so far, the one whose
  //  anchor lies nearest the identity cell's anchor is claimed next (ties by
  //  word length, then lowercase-preferring word order).  First-found order
  //  can wrap around an unchosen cell and leave a hole; compact growth keeps
  //  the union disc-like, and the boundary loop count verifies it.
  //
  //  The COSET class A_W[0] = j labels the colour of a cell instead; the best
  //  word of each coset class is collected as the coset transversal - the
  //  g_j of the catalog pages.

  // a generic interior point of the fundamental domain, as the anchor
  const anchor0 = (() => {
    if(typeof group.toFundDomain === 'function'){
      const r = group.toFundDomain({ pnt: iPoint([0.01234, 0.00567, 0, 0]),
                                     maxIterations: 400 });
      if(r && r.inDomain) return r.pnt;
    }
    return iPoint([0.01234, 0.00567, 0, 0]);
  })();
  const anchorOf = itrans => itrans.transform(anchor0);
  const dist0 = pnt => {
    const dx = pnt.v[0] - anchor0.v[0], dy = pnt.v[1] - anchor0.v[1];
    return Math.hypot(dx, dy);
  };

  // tie order for equal scores: shorter word, then lowercase before uppercase
  const wordKey = w => w.toLowerCase() + (w === w.toLowerCase() ? '0' : '1');
  const better = (a, b) => a.score < b.score - EPS ||
    (Math.abs(a.score - b.score) <= EPS &&
     (a.word.length < b.word.length ||
      (a.word.length === b.word.length && wordKey(a.word) < wordKey(b.word))));

  const invPerms = perms.map(invertPerm);
  const invEdges = edges.map(e => invertPerm(e.perm));

  /** the full permutation A_W of a left-to-right word */
  const permOfWord = word => {
    const out = new Array(n);
    for(let i = 0; i < n; i++){
      let x = i;
      for(const ch of word){
        const low = ch.toLowerCase();
        const q = ch === low ? perms[low.charCodeAt(0) - 97]
                             : invPerms[low.charCodeAt(0) - 97];
        x = q[x];
      }
      out[i] = x;
    }
    return out;
  };

  const cells = new Array(n);          // indexed by orbit class beta
  cells[0] = { orbit: 0, coset: 0, beta: 0, word: '',
               itrans: new ITransform([], ''), score: 0 };

  const cosetTransversalRaw = new Array(n).fill(null);
  const offerCoset = cand => {
    const prev = cosetTransversalRaw[cand.coset];
    if(!prev || better(cand, prev)) cosetTransversalRaw[cand.coset] = cand;
  };
  offerCoset(cells[0]);

  // candidate pool: cells edge-adjacent to the chosen union, keyed by orbit
  const candidates = new Map();
  const offerFrom = cell => {
    const pFull = permOfWord(cell.word);
    for(let k = 0; k < edges.length; k++){
      const beta = invEdges[k][cell.beta];
      const coset = pFull[edges[k].perm[0]];       // A_{xW}[0] = A_W[perm_x[0]]
      const itrans = edges[k].itrans.getCopy().concat(cell.itrans);
      itrans.word = edges[k].letter + cell.word;
      const cand = { orbit: beta, coset, beta, word: itrans.word, itrans,
                     score: dist0(anchorOf(itrans)) };
      offerCoset(cand);
      if(isDefined(cells[beta])) continue;
      const prev = candidates.get(beta);
      if(!prev || better(cand, prev))
        candidates.set(beta, cand);
    }
  };
  offerFrom(cells[0]);

  let chosenCount = 1;
  while(chosenCount < n){
    let best = null;
    for(const c of candidates.values())
      if(!best || better(c, best)) best = c;
    if(!best)
      throw new Error(`${MYNAME}: coset table is not transitive`);
    candidates.delete(best.orbit);
    cells[best.orbit] = best;
    chosenCount++;
    offerFrom(best);
  }
  // growth stops once every ORBIT slot is filled, but a coset class can first
  // appear outside the chosen cells' immediate neighbors - keep expanding
  // words (permutation bookkeeping only) until every coset has one
  if(cosetTransversalRaw.some(c => !c)){
    const seenWords = new Set(cells.map(c => c.word));
    let ring = cells.slice();
    let guard = 0;
    while(cosetTransversalRaw.some(c => !c) && guard++ < 8 && seenWords.size < 5000){
      const next = [];
      for(const cell of ring){
        const pFull = permOfWord(cell.word);
        for(let k = 0; k < edges.length; k++){
          const word = edges[k].letter + cell.word;
          if(seenWords.has(word)) continue;
          seenWords.add(word);
          const itrans = edges[k].itrans.getCopy().concat(cell.itrans);
          itrans.word = word;
          const cand = { orbit: invEdges[k][cell.beta], coset: pFull[edges[k].perm[0]],
                         beta: invEdges[k][cell.beta], word, itrans,
                         score: dist0(anchorOf(itrans)) };
          offerCoset(cand);
          next.push(cand);
        }
      }
      ring = next;
    }
    for(let j = 0; j < n; j++)
      if(!cosetTransversalRaw[j])
        throw new Error(`${MYNAME}: no transversal word for coset ${j}`);
  }

  // ---- step 2: sides of the union: interior walls and paired boundary --

  const sides = [];
  const pairings = [];

  for(let i = 0; i < n; i++){
    for(let s = 0; s < nsides; s++){

      // neighbor across side s of cell i:  T_i o t_s   (generator acts first)
      const neighbor = dirGens[s].getCopy().concat(cells[i].itrans);
      neighbor.word = genNames[s] + cells[i].word;
      // its H-tile is its orbit class  beta = invperm_s[beta_i]
      const j = invPerms[s][cells[i].beta];
      const side = {
        cell: i,
        side: s,
        splane: cells[i].itrans.transform(fd[s]),
      };
      sides.push(side);

      if(sameTransform(neighbor, cells[j].itrans, testPoints)){
        // the facing cell is a claimed cell: interior wall of the union
        side.kind = 'interior';
        side.neighborCell = j;
        continue;
      }

      side.kind = 'boundary';

      // pairing transform  h = T_i o t_s o T_j^-1  (applied right to left),
      // an element of H; as a left-to-right word: inv(W_j) + s + W_i
      const h = cells[j].itrans.getInverse().concat(dirGens[s]).concat(cells[i].itrans);
      h.word = GroupUtils.getInverseWord(cells[j].word) + genNames[s] + cells[i].word;

      // seen already? (as itself: two sides mapped by one h; or as inverse)
      let found = -1, foundInv = -1;
      for(let p = 0; p < pairings.length; p++){
        if(sameTransform(h, pairings[p].itrans, testPoints)){ found = p; break; }
        if(sameTransform(h, pairings[p].invItrans, testPoints)){ foundInv = p; break; }
      }

      if(found >= 0){
        side.pairing = found;
      } else if(foundInv >= 0){
        // h is the inverse of pairings[foundInv]: record as its partner
        const inv = pairings[foundInv];
        const p = pairings.length;
        pairings.push({
          word: h.word,
          itrans: h,
          invItrans: h.getInverse(),
          isometry: classifyEuclidean(h),
          from: {cell: i, side: s},
          inverseOf: foundInv,
        });
        inv.inverseOf = p;
        inv.to = {cell: i, side: s};
        pairings[p].to = inv.from;
        side.pairing = p;
      } else {
        side.pairing = pairings.length;
        pairings.push({
          word: h.word,
          itrans: h,
          invItrans: h.getInverse(),
          isometry: classifyEuclidean(h),
          from: {cell: i, side: s},
        });
      }
    }
  }

  // self inverse pairings pair two boundary sides with the same h - or, for a
  // half turn about the middle of a side, pair that one side with itself
  for(let p = 0; p < pairings.length; p++){
    if(isDefined(pairings[p].to))
      continue;
    const refs = sides.filter(sd => sd.kind === 'boundary' && sd.pairing === p);
    if(refs.length === 2){
      pairings[p].to = {cell: refs[1].cell, side: refs[1].side};
      pairings[p].inverseOf = p;   // self inverse
    } else if(refs.length === 1){
      pairings[p].to = pairings[p].from;   // side maps onto itself
      pairings[p].inverseOf = p;           // self inverse
    }
  }

  // one generator per inverse pair, first occurrence wins
  const generators = [];
  const used = new Set();
  for(let p = 0; p < pairings.length; p++){
    if(used.has(p))
      continue;
    generators.push(p);
    used.add(p);
    if(isDefined(pairings[p].inverseOf))
      used.add(pairings[p].inverseOf);
  }

  if(DEBUG){
    console.log(`${MYNAME}: n=${n} cells:`, cells.map(c => `'${c.word}'`).join(' '));
    console.log(`${MYNAME}: pairings:`, pairings.map(p => `'${p.word}'`).join(' '));
  }

  const analysis = analyzeDomain(fd, cells, sides);

  return {
    n:          n,
    genNames:   genNames,
    cells:      cells,
    sides:      sides,
    pairings:   pairings,
    generators: generators,
    vertices:      analysis.vertices,
    boundaryLoops: analysis.loops,
    simplyConnected: analysis.loops === 1,
    cosetTransversal: cosetTransversalRaw.map(c => ({ coset: c.coset,
      word: c.word, itrans: c.itrans })),
  };
}

/**
  polygon vertices of the fundamental domain and the number of closed loops
  the union's boundary decomposes into: 1 = simply connected, 2+ = holes.
  (splane planes: signed distance = n.p - d)
*/
function analyzeDomain(fd, cells, sides){

  const verts = [];
  for(let i = 0; i < fd.length; i++){
    for(let j = i + 1; j < fd.length; j++){
      const [a1, b1, d1] = [fd[i].v[0], fd[i].v[1], fd[i].v[3]];
      const [a2, b2, d2] = [fd[j].v[0], fd[j].v[1], fd[j].v[3]];
      const det = a1 * b2 - a2 * b1;
      if(Math.abs(det) < 1e-9) continue;
      const x = (d1 * b2 - d2 * b1) / det;
      const y = (a1 * d2 - a2 * d1) / det;
      if(fd.every(sp => sp.v[0] * x + sp.v[1] * y - sp.v[3] <= 1e-6))
        verts.push([x, y]);
    }
  }
  const cx = verts.reduce((a, v) => a + v[0], 0) / verts.length;
  const cy = verts.reduce((a, v) => a + v[1], 0) / verts.length;
  verts.sort((u, v) => Math.atan2(u[1] - cy, u[0] - cx) - Math.atan2(v[1] - cy, v[0] - cx));

  // edge of the polygon lying on each side
  const edgeOfSide = new Array(fd.length).fill(null);
  verts.forEach((v, i) => {
    const w = verts[(i + 1) % verts.length];
    const mx = (v[0] + w[0]) / 2, my = (v[1] + w[1]) / 2;
    let side = 0, best = 1e9;
    fd.forEach((sp, k) => {
      const d = Math.abs(sp.v[0] * mx + sp.v[1] * my - sp.v[3]);
      if(d < best){ best = d; side = k; }
    });
    edgeOfSide[side] = [v, w];
  });

  // boundary segments of the union, chained into loops by shared endpoints
  const key = p => p.map(v => (Math.abs(v) < 1e-6 ? 0 : v).toFixed(5)).join(',');
  const links = new Map();       // endpoint -> [endpoint, ...]
  let segCount = 0;
  for(const sd of sides){
    if(sd.kind !== 'boundary') continue;
    const e = edgeOfSide[sd.side];
    if(!e) continue;
    const it = cells[sd.cell].itrans;
    const A = it.transform(iPoint([e[0][0], e[0][1], 0, 0]));
    const B = it.transform(iPoint([e[1][0], e[1][1], 0, 0]));
    const ka = key([A.v[0], A.v[1]]), kb = key([B.v[0], B.v[1]]);
    if(!links.has(ka)) links.set(ka, []);
    if(!links.has(kb)) links.set(kb, []);
    links.get(ka).push(kb);
    links.get(kb).push(ka);
    segCount++;
  }
  // count cycles in the 2-regular graph
  const visited = new Set();
  let loops = 0;
  for(const start of links.keys()){
    if(visited.has(start)) continue;
    loops++;
    let cur = start, prev = null;
    while(true){
      visited.add(cur);
      const nbrs = links.get(cur) || [];
      const next = nbrs.find(nb => nb !== prev && !visited.has(nb))
                ?? nbrs.find(nb => nb !== prev);
      if(next === undefined || next === start || visited.has(next)) break;
      prev = cur; cur = next;
    }
  }
  return { vertices: verts, loops, segments: segCount };
}

/**
  Build the subgroup H as a Group in its own right: its fundamental domain is
  the union of the coset cells, bounded by the boundary sides, and its pairing
  transforms are the ones the builder derived.

  The result is an ordinary grouplib Group, so everything that consumes a group
  - the overlay's fundamental domain / tiling / generators, point reduction,
  the packed group data of the renderer - works on H unchanged.

  opt is the same as buildSubgroupDomain(), plus an optional prebuilt `domain`.

  Group takes `t` as the REVERSE transforms (neighbouring cell -> domain) and
  inverts them itself, so each side contributes the reversed reflection list of
  its pairing transform.
*/
export function makeSubgroupGroup(opt){

  const domain = opt.domain || buildSubgroupDomain(opt);
  const boundary = domain.sides.filter(sd => sd.kind === 'boundary');

  const s = boundary.map(sd => sd.splane);
  const t = boundary.map(sd => [...domain.pairings[sd.pairing].itrans.ref].reverse());

  const group = new Group({ s, t });
  group.subgroupDomain = domain;      // keep the provenance for callers

  // The reduction algorithm needs a convex domain; the union of coset cells
  // often is not one.  Check unless the caller opts out, and record the result
  // on the group so callers can refuse to render a domain that cannot work.
  if(opt.checkConvex !== false){
    group.convexity = checkDomainConvex({ group: opt.group, domain,
                                          radius: opt.convexRadius,
                                          step: opt.convexStep });
    if(!group.convexity.convex){
      console.warn(`${MYNAME}: the union of the coset cells is NOT convex ` +
        `(union-only ${group.convexity.unionOnly} px, half-plane-only ` +
        `${group.convexity.halfPlaneOnly} px of ${group.convexity.samples} sampled). ` +
        `Point reduction and rendering assume a convex fundamental domain, so ` +
        `this group will not reduce correctly. A Dirichlet domain built from ` +
        `H's generators is the general fix.`);
    }
  }
  return group;
}

/**
  Is the union of the coset cells convex?

  This matters because the reduction algorithm - both GroupUtils.toFundDomain
  and the shader's iToFundamentalDomainSampler* - treats a fundamental domain
  as the INTERSECTION of the half planes of its sides, walking a point inside
  one side at a time.  That is only correct for a convex domain.  The union of
  the coset cells of a subgroup is frequently not convex, so a group built from
  it would render and reduce incorrectly.

  The test is by sampling: a point is compared for membership of the union
  (is it in some cell?) against membership of the half plane intersection.
  Any disagreement means the union is not convex.

  opt = { group, domain, radius = 1.4, step = 0.01 }

  return { convex, unionOnly, halfPlaneOnly, samples }
*/
export function checkDomainConvex(opt){

  const fdG = opt.group.getFundDomain();
  const domain = opt.domain;
  const radius = isDefined(opt.radius) ? opt.radius : 1.4;
  const step = isDefined(opt.step) ? opt.step : 0.01;

  const boundary = domain.sides.filter(sd => sd.kind === 'boundary');
  const fdH = boundary.map(sd => sd.splane);

  const insideAll = (fd, p) => fd.every(sp => U4.sigDistanceSP(sp, p) <= EPS);
  const inUnion = p => domain.cells.some(
      cell => insideAll(fdG, cell.itrans.inverseTransform(p)));

  let unionOnly = 0, halfPlaneOnly = 0, samples = 0;
  for(let x = -radius; x <= radius; x += step){
    for(let y = -radius; y <= radius; y += step){
      const p = iPoint([x, y, 0, 0]);
      samples++;
      const u = inUnion(p);
      const h = insideAll(fdH, p);
      if(u && !h) unionOnly++;
      else if(h && !u) halfPlaneOnly++;
    }
  }
  return { convex: unionOnly === 0 && halfPlaneOnly === 0,
           unionOnly, halfPlaneOnly, samples };
}
