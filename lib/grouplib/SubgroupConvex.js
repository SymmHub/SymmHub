import { ITransform, iPoint } from '../invlib/invlib.js';
import { SPLANE_PLANE, SPLANE_SPHERE } from '../invlib/ISplane.js';
import { U4 } from '../invlib/U4.js';
import { splaneIntersections } from './GeneratorElements.js';

const MYNAME = 'SubgroupConvex';
const DEBUG = false;

/*
  SubgroupConvex.js — a convex fundamental domain of a subgroup, when the
  cells of the parent's tiling allow one.

  buildSubgroupDomain (SubgroupDomain.js) takes one cell of G's tiling per
  orbit class of H; its compact growth keeps the union disc-like but not
  convex, and very often another choice of cells gives a convex union, which
  is what the point reduction of a group needs (a domain given by its sides
  alone, as the intersection of their half spaces) and what the tilings look
  best with.  findConvexTransversal() searches for such a choice.

  Convexity is the one the reduction algorithm uses: the union equals the
  intersection of the inner half spaces of its boundary splanes.  The test
  (isUnionConvex) works with the splanes alone, in every geometry: the cells
  tile edge to edge, so the union is convex exactly when every corner of
  every cell lies on the inner side of every boundary side of the union
  (the sides of its cells whose neighbour is outside).  Cell corners, not
  centres: a reflex corner between two cells can appear while every centre
  is still inside.

  The search cannot grow through convex unions alone (no three cells of a
  2x2 block are convex), so it grows connected unions from F and closes each
  one under the rule which the same convexity gives for unions of cells:
  every cell whose interior meets the interior of the convex hull of the
  union belongs to the union, and a union which is part of a convex
  fundamental domain has its closure in that domain too.  The hull is taken
  in the model where the splanes are straight: the plane itself for a
  Euclidean group, the Klein model for a group of the Poincare disk (the map
  k = 2p/(1+|p|^2) sends every geodesic to a chord, so the hyperbolic hull
  is the Euclidean hull of the mapped corners).  A closure with two cells
  of the same class, or with more than n cells, cannot be completed; a
  closure of n cells of distinct classes is a convex fundamental domain.
  The walk is depth first over closed unions, each extended by one
  neighbouring cell of an unclaimed class, nearest to F first, with a
  budget of closures; among the solutions the most compact one is taken
  (the least radius about F, then the least perimeter, then the shortest
  words).  Spherical groups have no such model; there the connected unions
  of n cells of distinct classes are enumerated (their number is small) and
  tested with the splanes.
*/

// ---------------------------------------------------------------------------
// the model: where the splanes are straight
// ---------------------------------------------------------------------------

/** 'euclidean' (straight sides), 'hyperbolic' (circle sides orthogonal to the unit circle), else null (spherical) */
export function domainGeometry(fd){
  const circles = fd.filter(s => s.type === SPLANE_SPHERE);
  if(circles.length === 0) return fd.every(s => s.type === SPLANE_PLANE) ? 'euclidean' : null;
  const orthogonal = sp => {
    const [cx, cy, , r] = sp.v;
    return Math.abs(cx*cx + cy*cy - r*r - 1) < 1.e-4*(1 + cx*cx + cy*cy);
  };
  return circles.every(orthogonal) ? 'hyperbolic' : null;
}

/** the point in the model coordinates: itself, or its Klein image */
export function toModel(p, geometry){
  if(geometry !== 'hyperbolic') return [p[0], p[1]];
  const f = 2/(1 + p[0]*p[0] + p[1]*p[1]);
  return [p[0]*f, p[1]*f];
}

const sigDist = (sp, p) => U4.sigDistanceSP(sp, iPoint([p[0], p[1], 0, 0]));

/**
  the corners of the domain, in the group's coordinates, counterclockwise
  (ordered by the angle about the centroid of their model images)
*/
export function domainCornersCCW(fd, geometry){
  const eps = 1.e-6;
  const inside = (p, skip) => fd.every((s, k) => skip.includes(k) || sigDist(s, p) <= eps);
  const inModel = p => geometry !== 'hyperbolic' || p[0]*p[0] + p[1]*p[1] <= 1 + 1.e-6;
  const corners = [];
  for(let i = 0; i < fd.length; i++){
    for(let j = i + 1; j < fd.length; j++){
      for(const p of splaneIntersections(fd[i], fd[j])){
        if(!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
        if(!inModel(p) || !inside(p, [i, j])) continue;
        if(corners.some(c => Math.hypot(c[0] - p[0], c[1] - p[1]) < 1.e-7)) continue;
        corners.push(p);
      }
    }
  }
  if(corners.length < 3) return null;
  const m = corners.map(p => toModel(p, geometry));
  const cx = m.reduce((s, p) => s + p[0], 0)/m.length, cy = m.reduce((s, p) => s + p[1], 0)/m.length;
  const order = m.map((p, i) => [Math.atan2(p[1] - cy, p[0] - cx), i]).sort((a, b) => a[0] - b[0]);
  return order.map(([, i]) => corners[i]);
}

// ---------------------------------------------------------------------------
// polygons in the model
// ---------------------------------------------------------------------------

const cross = (o, a, b) => (a[0] - o[0])*(b[1] - o[1]) - (a[1] - o[1])*(b[0] - o[0]);

export function polygonArea(poly){
  let a = 0;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    a += poly[j][0]*poly[i][1] - poly[i][0]*poly[j][1];
  return a/2;
}

function centroid(poly){
  return [poly.reduce((s, p) => s + p[0], 0)/poly.length, poly.reduce((s, p) => s + p[1], 0)/poly.length];
}

/**
  convex hull, counterclockwise (Andrew's monotone chain).  The points are
  ordered on coordinates snapped to 1e-9: corners of neighbouring cells share
  coordinates up to rounding noise, and the chain needs them in true
  lexicographic order.
*/
export function convexHull(points){
  const q = 1.e9;
  const snapped = points.map(p => ({ x: Math.round(p[0]*q), y: Math.round(p[1]*q), p }));
  snapped.sort((a, b) => a.x - b.x || a.y - b.y);
  const uniq = [];
  for(const s of snapped){
    const last = uniq[uniq.length - 1];
    if(!last || s.x !== last.x || s.y !== last.y) uniq.push(s);
  }
  if(uniq.length < 3) return uniq.map(s => s.p);
  return monotoneChain(uniq.map(s => s.p));
}

function monotoneChain(uniq){
  const lower = [];
  for(const p of uniq){
    while(lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1.e-12) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for(let i = uniq.length - 1; i >= 0; i--){
    const p = uniq[i];
    while(upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1.e-12) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

/** the polygon clipped by a convex counterclockwise polygon (Sutherland-Hodgman) */
export function clipByConvex(poly, hull){
  let out = poly;
  for(let i = 0; i < hull.length && out.length; i++){
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const input = out;
    out = [];
    for(let k = 0; k < input.length; k++){
      const p = input[k], q = input[(k + 1) % input.length];
      const dp = cross(a, b, p), dq = cross(a, b, q);
      if(dp >= 0) out.push(p);
      if((dp >= 0) !== (dq >= 0)){
        const t = dp/(dp - dq);
        out.push([p[0] + t*(q[0] - p[0]), p[1] + t*(q[1] - p[1])]);
      }
    }
  }
  return out;
}

function perimeter(poly){
  let s = 0;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += Math.hypot(poly[i][0] - poly[j][0], poly[i][1] - poly[j][1]);
  return s;
}

// ---------------------------------------------------------------------------
// cells of the tiling
// ---------------------------------------------------------------------------

function invertPerm(perm){
  const inv = new Array(perm.length);
  perm.forEach((v, i) => inv[v] = i);
  return inv;
}

const P1 = iPoint([0.12345, 0.06789, 0, 0]);
const P2 = iPoint([-0.07211, 0.16183, 0, 0]);

/**
  the context of a search: the domain, the model, the cells (cached by the
  transform which makes them) and the neighbours across the sides

  perms may be null when the classes do not matter (isUnionConvex)
*/
function makeContext(group, perms, geometry, corners){
  const fd = group.getFundDomain();
  const names = group.getGenNames();
  const dirGens = group.transforms.map((t, i) => new ITransform(t.slice(), names[i]));
  const invPerms = perms ? perms.map(invertPerm) : null;
  const cache = new Map();

  const keyOf = t => {
    const a = t.transform(P1).v, b = t.transform(P2).v;
    return [a[0], a[1], b[0], b[1]].map(v => v.toFixed(6)).join(',');
  };

  function makeCell(itrans, cls, word){
    const key = keyOf(itrans);
    let c = cache.get(key);
    if(c) return c;
    // the corners of the cell in the group's coordinates, and in the model
    const cornersW = corners.map(p => {
      const q = itrans.transform(iPoint([p[0], p[1], 0, 0])).v;
      return [q[0], q[1]];
    });
    const poly = cornersW.map(p => toModel(p, geometry));
    if(polygonArea(poly) < 0) poly.reverse();
    c = { key, itrans, cls, word, cornersW, poly, area: polygonArea(poly), anchor: centroid(poly), sides: null };
    cache.set(key, c);
    return c;
  }

  /** the cell across side s of the cell: T o t_s (the generator acts first) */
  function neighbor(cell, s){
    const t = dirGens[s].getCopy().concat(cell.itrans);
    t.word = names[s] + cell.word;
    return makeCell(t, invPerms ? invPerms[s][cell.cls] : -1, t.word);
  }

  /** the splanes of the sides of the cell, the cell on their inner side */
  function sidesOf(cell){
    if(!cell.sides) cell.sides = fd.map(sp => cell.itrans.transform(sp));
    return cell.sides;
  }

  return { n: perms ? perms[0].length : Infinity, nsides: fd.length, makeCell, neighbor, sidesOf };
}

/**
  is the union convex?  The splane test: every corner of every cell on the
  inner side of every boundary side of the union (a side of a cell whose
  neighbour is not in the union).  Exact for cells tiling edge to edge, in
  every geometry.
*/
function convexBySplanes(cells, ctx, eps = 1.e-6){
  const corners = [...cells.values()].flatMap(c => c.cornersW);
  for(const c of cells.values()){
    const sides = ctx.sidesOf(c);
    for(let s = 0; s < ctx.nsides; s++){
      if(cells.has(ctx.neighbor(c, s).key)) continue;
      const b = sides[s];
      for(const p of corners)
        if(sigDist(b, p) > eps) return false;
    }
  }
  return true;
}

/**
  the closure of a union of cells: every cell whose interior meets the
  interior of the hull of the union, repeated until the hull is stable

  opt = { maxCells, checkClasses }

  return { valid, cells (Map key -> cell), hull } - valid is false when the
  closure would hold more than maxCells cells or (checkClasses) two cells of
  one class.  The cap is essential: a tiling need not have any bounded
  convex union around a given union (the bricks of a staggered tiling, say),
  and the closure of such a union grows without end.
*/
function closure(union, ctx, opt){
  const maxCells = opt.maxCells;
  const checkClasses = opt.checkClasses;
  const cells = new Map(union);
  const classes = new Set();
  if(cells.size > maxCells) return { valid: false };
  if(checkClasses){
    for(const c of cells.values()){
      if(classes.has(c.cls)) return { valid: false };
      classes.add(c.cls);
    }
  }
  for(;;){
    const hull = convexHull([...cells.values()].flatMap(c => c.poly));
    if(hull.length < 3) return { valid: true, cells, hull };
    let added = false;
    const queue = [...cells.values()];
    while(queue.length){
      const c = queue.pop();
      for(let s = 0; s < ctx.nsides; s++){
        const nb = ctx.neighbor(c, s);
        if(cells.has(nb.key)) continue;
        const inter = clipByConvex(nb.poly, hull);
        if(inter.length < 3 || Math.abs(polygonArea(inter)) <= 1.e-6*Math.abs(nb.area)) continue;
        if(cells.size >= maxCells) return { valid: false };
        if(checkClasses){
          if(classes.has(nb.cls)) return { valid: false };
          classes.add(nb.cls);
        }
        cells.set(nb.key, nb);
        queue.push(nb);
        added = true;
      }
    }
    if(!added) return { valid: true, cells, hull };
  }
}

/** the hull of a union and its excess over the union: (area(hull) - area(union)) / area(union) */
function hullExcess(cells){
  const list = [...cells.values()];
  const hull = convexHull(list.flatMap(c => c.poly));
  const area = list.reduce((s, c) => s + Math.abs(c.area), 0);
  return { hull, excess: (Math.abs(polygonArea(hull)) - area)/area };
}

// ---------------------------------------------------------------------------
// the search
// ---------------------------------------------------------------------------

/**
  a convex fundamental domain of the subgroup as a union of cells of G

  opt = {
    group:      invlib Group of G
    perms:      coset permutation arrays of H, one per generator (side) of G
    maxStates:  budget of closures (default 4000)
    all:        keep looking after the first solution (default true: the most compact one wins)
    bestEffort: when no convex union exists, look for the connected union with
                the least hull excess instead (default true; budget maxUnions,
                default 3000 complete unions)
  }

  return null when nothing was found within the budgets; else {
    cells:      array[n] of {cls, word, itrans}, indexed by orbit class
    convex:     true for a convex union, false for the best effort
    excess:     (area of the hull - area of the union) / area of the union, 0 when convex
    geometry:   'euclidean' | 'hyperbolic' | 'spherical' (enumeration, no best effort)
    states, solutions, unions, radius, perimeter, exhausted (a budget ran out)
  }
*/
export function findConvexTransversal(opt){
  const group = opt.group;
  const perms = opt.perms;
  const fd = group.getFundDomain();
  const geometry = domainGeometry(fd);
  const corners = domainCornersCCW(fd, geometry);
  if(!corners) return null;
  const n = perms[0].length;
  const ctx = makeContext(group, perms, geometry, corners);
  const F = ctx.makeCell(new ITransform([], ''), 0, '');
  const maxStates = opt.maxStates || 4000;
  const all = opt.all !== false;

  const visited = new Set();
  const solutions = [];
  let states = 0;
  const q6 = v => Math.round(v*1.e6);
  const unionKey = cells => [...cells.keys()].sort().join('|');
  const dist = c => Math.hypot(c.anchor[0] - F.anchor[0], c.anchor[1] - F.anchor[1]);

  // no model in which the splanes are straight: enumerate the connected
  // unions of n cells of distinct classes and test them with the splanes
  if(!geometry){
    const maxUnions = opt.maxUnions || 3000;
    const seen = new Set();
    let unions = 0;
    const found = [];
    const grow = cells => {
      if(unions >= maxUnions) return;
      if(cells.size === n){
        unions++;
        if(convexBySplanes(cells, ctx)) found.push(cells);
        return;
      }
      for(const nb of candidates(cells)){
        if(unions >= maxUnions) return;
        const next = new Map(cells);
        next.set(nb.key, nb);
        const key = unionKey(next);
        if(seen.has(key)) continue;
        seen.add(key);
        grow(next);
      }
    };
    grow(new Map([[F.key, F]]));
    if(!found.length) return null;
    const scored = found.map(cells => {
      const pts = [...cells.values()].flatMap(c => c.cornersW);
      const radius = Math.max(...pts.map(p => Math.hypot(p[0] - F.anchor[0], p[1] - F.anchor[1])));
      const words = [...cells.values()].map(c => c.word).sort();
      return { cells, radius: q6(radius), length: words.reduce((s, w) => s + w.length, 0), words: words.join(' ') };
    });
    scored.sort((a, b) => (a.radius - b.radius) || (a.length - b.length) || (a.words < b.words ? -1 : a.words > b.words ? 1 : 0));
    const cells = new Array(n);
    for(const c of scored[0].cells.values()) cells[c.cls] = { cls: c.cls, word: c.word, itrans: c.itrans };
    return { cells, convex: true, excess: 0, geometry: 'spherical', states: 0, solutions: found.length, unions,
             exhausted: unions >= maxUnions, radius: scored[0].radius/1.e6, perimeter: 0 };
  }

  /** the cells next to the union whose class is not in it, nearest to F first */
  function candidates(cells){
    const classes = new Set([...cells.values()].map(c => c.cls));
    const cand = new Map();
    for(const c of cells.values()){
      for(let s = 0; s < ctx.nsides; s++){
        const nb = ctx.neighbor(c, s);
        if(cells.has(nb.key) || classes.has(nb.cls) || cand.has(nb.key)) continue;
        cand.set(nb.key, nb);
      }
    }
    return [...cand.values()].sort((a, b) =>
      (q6(dist(a)) - q6(dist(b))) || (a.word.length - b.word.length) || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
  }

  function expand(cur){
    for(const nb of candidates(cur.cells)){
      if(states >= maxStates) return;
      const next = new Map(cur.cells);
      next.set(nb.key, nb);
      states++;
      const cl = closure(next, ctx, { maxCells: n, checkClasses: true });
      if(!cl.valid) continue;
      const key = unionKey(cl.cells);
      if(visited.has(key)) continue;
      visited.add(key);
      if(cl.cells.size === n){
        // a closed union of n cells is convex by construction; the splane test confirms it
        if(convexBySplanes(cl.cells, ctx)) solutions.push(cl);
        else if(DEBUG) console.log(`${MYNAME}: a closed union fails the splane test`);
        if(!all) return;
        continue;
      }
      expand(cl);
      if(!all && solutions.length) return;
    }
  }

  const start = closure(new Map([[F.key, F]]), ctx, { maxCells: n, checkClasses: true });
  if(start.valid){
    if(start.cells.size === n) solutions.push(start);
    else expand(start);
  }
  if(DEBUG) console.log(`${MYNAME}: n=${n} ${geometry}: ${solutions.length} solutions, ${states} closures`);

  const result = (sol, convex, excess) => {
    const cells = new Array(n);
    for(const c of sol.cells.values()) cells[c.cls] = { cls: c.cls, word: c.word, itrans: c.itrans };
    const radius = Math.max(...sol.hull.map(p => Math.hypot(p[0] - F.anchor[0], p[1] - F.anchor[1])));
    return { cells, convex, excess, geometry, states, solutions: solutions.length, exhausted: states >= maxStates,
             radius, perimeter: perimeter(sol.hull) };
  };

  if(solutions.length){
    // the most compact solution: the least radius about F, then perimeter, then words
    const scored = solutions.map(sol => {
      const radius = Math.max(...sol.hull.map(p => Math.hypot(p[0] - F.anchor[0], p[1] - F.anchor[1])));
      const words = [...sol.cells.values()].map(c => c.word).sort();
      return { sol, radius: q6(radius), perimeter: q6(perimeter(sol.hull)),
               length: words.reduce((s, w) => s + w.length, 0), words: words.join(' ') };
    });
    scored.sort((a, b) => (a.radius - b.radius) || (a.perimeter - b.perimeter) || (a.length - b.length) ||
                          (a.words < b.words ? -1 : a.words > b.words ? 1 : 0));
    return result(scored[0].sol, true, 0);
  }
  if(opt.bestEffort === false) return null;

  // no convex union: the connected union of n cells of distinct classes with
  // the least hull excess, among those a budget of complete unions reaches
  const maxUnions = opt.maxUnions || 3000;
  const seen = new Set();
  let best = null, unions = 0;
  function grow(cells){
    if(unions >= maxUnions) return;
    if(cells.size === n){
      unions++;
      const { hull, excess } = hullExcess(cells);
      const radius = Math.max(...hull.map(p => Math.hypot(p[0] - F.anchor[0], p[1] - F.anchor[1])));
      const words = [...cells.values()].map(c => c.word).sort().join(' ');
      const cand = { cells, hull, excess: q6(excess), radius: q6(radius), words };
      if(!best || cand.excess < best.excess || (cand.excess === best.excess && (cand.radius < best.radius ||
         (cand.radius === best.radius && cand.words < best.words)))) best = cand;
      return;
    }
    for(const nb of candidates(cells)){
      if(unions >= maxUnions) return;
      const next = new Map(cells);
      next.set(nb.key, nb);
      const key = unionKey(next);
      if(seen.has(key)) continue;
      seen.add(key);
      grow(next);
    }
  }
  grow(new Map([[F.key, F]]));
  if(DEBUG) console.log(`${MYNAME}: best effort over ${unions} unions: excess ${best && best.excess/1.e6}`);
  if(!best) return null;
  const r = result(best, false, best.excess/1.e6);
  r.unions = unions;
  return r;
}

/**
  is the union of the cells convex?  The splane test: every corner of every
  cell on the inner side of every boundary side of the union.  The cells are
  given by their transforms (as buildSubgroupDomain returns them); false when
  the corners of the domain cannot be found.
*/
export function isUnionConvex(opt){
  const group = opt.group;
  const fd = group.getFundDomain();
  const geometry = domainGeometry(fd);
  const corners = domainCornersCCW(fd, geometry);
  if(!corners) return false;
  const ctx = makeContext(group, null, geometry, corners);
  const union = new Map();
  opt.cells.forEach((c, i) => {
    const cell = ctx.makeCell(c.itrans, i, c.word || '');
    union.set(cell.key, cell);
  });
  return convexBySplanes(union, ctx);
}

/**
  is the union of the cells hull closed?  No cell outside the union reaches
  the interior of its hull (the closure adds nothing); the same as convex for
  a Euclidean or hyperbolic group, false when the geometry has no model
*/
export function isUnionHullClosed(opt){
  const group = opt.group;
  const fd = group.getFundDomain();
  const geometry = domainGeometry(fd);
  if(!geometry) return false;
  const corners = domainCornersCCW(fd, geometry);
  if(!corners) return false;
  const ctx = makeContext(group, null, geometry, corners);
  const union = new Map();
  opt.cells.forEach((c, i) => {
    const cell = ctx.makeCell(c.itrans, i, c.word || '');
    union.set(cell.key, cell);
  });
  return closure(union, ctx, { maxCells: union.size, checkClasses: false }).valid;
}
