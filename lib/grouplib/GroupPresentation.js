import { ITransform, iPoint, SPLANE_PLANE } from '../invlib/invlib.js';
import { U4 } from '../invlib/U4.js';
import { sameTransform } from './SubgroupDomain.js';

const MYNAME = 'GroupPresentation';
const EPS = 1e-7;
const MAX_CYCLE_LENGTH = 100;
const MAX_FOLD_ITERATIONS = 200;

/*
  GroupPresentation.js

  Derives a presentation (generators and relators) of a plane group from its
  fundamental domain and pairing transforms, after Poincare's polygon theorem.
  A group given another fundamental domain has other pairing transforms, hence
  other generators and relators; this is what makes such a group usable with
  the subgroup enumeration of sublib, which works from a presentation.

  generators
    one per side of the domain, named like the group's generators (a, b, c, ...
    for sides 0, 1, 2, ...).  Generator i is the direct transform of side i,
    which maps the domain onto the cell across side i.

  sub sides
    a cell across a side need not cover the whole side: in 2222 the 2-fold
    points may sit off the side midpoints, and a side then touches two cells.
    Every side is therefore split into the segments touched by the cells across
    it; folding a point just outside a segment into the domain gives the
    transform of that cell as a word in the generators.  For a plain polygon
    each side is one segment and the word is one letter.

  side pairing relators
    the transform of a segment maps it onto another segment of the boundary,
    and the transform of that one is its inverse: w_i * w_j = 1.  A segment
    paired with itself (a 2-fold rotation about its midpoint, or a reflection
    in the side) gives w_i^2 = 1.

  corner cycle relators
    leaving a vertex of the refined polygon through one of its segments, the
    transform brings us to another vertex (the same vertex of the cell across
    the segment, seen from the domain); leaving that vertex through its other
    segment continues the walk, which closes when the start vertex is reached
    through its other segment.  The angles met on the way add up to 2*PI/m and
    the product of the transforms is a rotation by that angle, so its m-th
    power is the identity.  Every vertex belongs to exactly one such cycle.

  Words act left to right, as in sublib: the word 'ab' means "apply a, then
  b"; an upper case letter is the inverse of the generator.  Each relator is
  verified numerically before it is returned, and an error is thrown when the
  domain is not a bounded convex polygon with straight sides or its transforms
  do not tile the plane with it.

  Usage:
    const pres = groupPresentation(group);
    subgroupsData({ name: '632', gens: pres.gens, relators: pres.relators, maxIndex: 6 });
*/

function xyOf(p){ return [p.v[0], p.v[1]]; }
function pnt(xy){ return iPoint([xy[0], xy[1], 0, 0]); }
function dist(p, q){ return Math.hypot(p[0]-q[0], p[1]-q[1]); }
function sigDist(side, xy){ return U4.sigDistanceSP(side, pnt(xy)); }
function apply(itrans, xy){ return xyOf(itrans.transform(pnt(xy))); }

/** intersection point of two lines given as planes, null when parallel */
function lineIntersection(p, q){
  const [a1, b1, , d1] = p.v, [a2, b2, , d2] = q.v;
  const det = a1*b2 - a2*b1;
  if(Math.abs(det) < 1e-12) return null;
  return [(d1*b2 - d2*b1)/det, (a1*d2 - a2*d1)/det];
}

/** inverse of a word in the left to right convention: reversed letters, case swapped */
function inverseWord(word){
  let out = '';
  for(let i = word.length - 1; i >= 0; i--){
    const ch = word[i];
    out += (ch === ch.toLowerCase()) ? ch.toUpperCase() : ch.toLowerCase();
  }
  return out;
}

/** free reduction of a word: cancels adjacent inverse letters */
function freeReduce(word){
  const out = [];
  for(const ch of word){
    const last = out[out.length - 1];
    if(last && last !== ch && last.toLowerCase() === ch.toLowerCase()) out.pop();
    else out.push(ch);
  }
  return out.join('');
}

/** sublib spelling of a word: letters separated by '*' */
const wordString = (word) => word.split('').join('*');

/** sublib spelling of word^m */
function powerString(word, m){
  if(m === 1) return wordString(word);
  return (word.length === 1) ? `${word}^${m}` : `(${wordString(word)})^${m}`;
}

/**
  corners of a fundamental domain given as the intersection of half planes
  (a bounded convex polygon with straight sides)

  return array of {point:[x,y], sides:[i,j], angle}, angle is the interior angle
*/
export function domainCorners(sides){

  sides.forEach((s, i) => {
    if(s.type !== SPLANE_PLANE)
      throw new Error(`${MYNAME}: side ${i} is not a straight line, only polygonal domains are supported`);
  });
  const n = sides.length;
  const corners = [];
  for(let i = 0; i < n; i++){
    for(let j = i + 1; j < n; j++){
      const p = lineIntersection(sides[i], sides[j]);
      if(!p) continue;
      // a corner of the polygon lies on the inner side of every other side
      let inside = true;
      for(let k = 0; k < n && inside; k++){
        if(k !== i && k !== j && sigDist(sides[k], p) > EPS) inside = false;
      }
      if(!inside) continue;
      // interior angle: PI minus the angle between the outward normals
      const [ax, ay] = sides[i].v, [bx, by] = sides[j].v;
      const c = Math.max(-1, Math.min(1, ax*bx + ay*by));
      corners.push({ point: p, sides: [i, j], angle: Math.PI - Math.acos(c) });
    }
  }
  return corners;
}

/**
  presentation of the group from its fundamental domain and pairing transforms

  group: invlib Group with a polygonal fundamental domain (an array of planes)
         and one pairing transform per side

  return {
    gens:        'a b c'                      generator names, one per side
    relators:    'a^2, b*c, b^3, (a*b)^6'     relators in the sublib syntax
    genNames:    ['a','b','c']
    relatorList: the relators as an array
    subSides:    array of {side, t0, t1, P0, P1, word, directWord}: the segments
                 of the sides touched by the cells across them; word is the
                 transform which maps that cell onto the domain, directWord
                 its inverse (the generator for a plain side)
    pairing:     pairing[i] == j when the transform of segment i maps it onto
                 segment j
    corners:     see domainCorners()
    vertices:    corners and the points splitting the sides, {point, angle, subSides}
    cycles:      array of {vertices:[...], subSides:[...], order:m, word}: the
                 vertex cycles, the segments left through on the way, the order
                 of the cycle transform and the relator word (without the power)
  }
*/
export function groupPresentation(group){

  const sides = group.getFundDomain();
  const n = sides.length;
  const names = group.getGenNames();
  const rev = group.getReverseTransforms().map((t, i) => new ITransform(t.slice(), names[i].toUpperCase()));
  const direct = group.getTransforms().map((t, i) => new ITransform(t.slice(), names[i]));

  const testPoints = [pnt([0.12345, 0.06789]), pnt([-0.07211, 0.16183]), pnt([0.31, -0.2])];
  const identity = new ITransform([], '');

  // letters -> transforms, to evaluate words
  const letterTransform = {};
  names.forEach((name, i) => {
    letterTransform[name] = direct[i];
    letterTransform[name.toUpperCase()] = rev[i];
  });
  const evaluate = (word, power) => {
    let t = new ITransform([], '');
    for(let k = 0; k < power; k++){
      for(const ch of word){
        if(!letterTransform[ch]) throw new Error(`${MYNAME}: unknown letter '${ch}' in word ${word}`);
        t = t.concat(letterTransform[ch]);
      }
    }
    return t;
  };

  // folds a point into the domain with the pairing transforms, as the shaders
  // do; the accumulated word names the cell the point came from
  const fold = (xy) => {
    let p = pnt(xy);
    let total = new ITransform([], '');
    for(let k = 0; k < MAX_FOLD_ITERATIONS; k++){
      const i = sides.findIndex(s => U4.sigDistanceSP(s, p) > 0);
      if(i < 0) return total;
      p = rev[i].transform(p);
      total = total.concat(rev[i]);
    }
    return null;
  };

  // ---- the sides as segments ---------------------------------------------------
  const corners = domainCorners(sides);
  const radius = corners.reduce((r, c) => Math.max(r, Math.hypot(c.point[0], c.point[1])), 0);
  const tol = EPS*(1 + radius);

  const sideCorners = sides.map(() => []);
  corners.forEach((c, ci) => c.sides.forEach(s => sideCorners[s].push(ci)));
  sideCorners.forEach((cs, i) => {
    if(cs.length !== 2)
      throw new Error(`${MYNAME}: side ${i} has ${cs.length} corners, the domain is not a bounded convex polygon`);
  });
  const segments = sides.map((s, i) => {
    const A = corners[sideCorners[i][0]].point, B = corners[sideCorners[i][1]].point;
    const len = dist(A, B);
    return { A, B, len, u: [(B[0]-A[0])/len, (B[1]-A[1])/len], normal: [s.v[0], s.v[1]] };
  });
  const paramOn = (i, P) => (P[0]-segments[i].A[0])*segments[i].u[0] + (P[1]-segments[i].A[1])*segments[i].u[1];
  const pointOn = (i, t) => [segments[i].A[0] + t*segments[i].u[0], segments[i].A[1] + t*segments[i].u[1]];
  const onLine = (i, P) => Math.abs(sigDist(sides[i], P)) < tol;

  // ---- refinement: the segments of each side touched by the cells across it -----
  const subSides = [];
  for(let i = 0; i < n; i++){
    const pieces = [];
    const queue = [[0, segments[i].len]];
    let guard = 0;
    while(queue.length){
      if(++guard > 1000) throw new Error(`${MYNAME}: side ${i} cannot be covered by the cells across it`);
      const [t0, t1] = queue.pop();
      if(t1 - t0 < tol) continue;
      const mid = pointOn(i, (t0 + t1)/2);
      const outside = [mid[0] + segments[i].normal[0]*10*tol, mid[1] + segments[i].normal[1]*10*tol];
      const T = fold(outside);                  // the cell across -> domain
      if(!T) throw new Error(`${MYNAME}: a point across side ${i} does not fold into the domain`);
      const G = T.getInverse();                 // domain -> the cell across
      // the side of the domain which G maps onto the line of side i
      let j = -1, tA = 0, tB = 0;
      for(let k = 0; k < n && j < 0; k++){
        const PA = apply(G, segments[k].A), PB = apply(G, segments[k].B);
        if(onLine(i, PA) && onLine(i, PB)){ j = k; tA = paramOn(i, PA); tB = paramOn(i, PB); }
      }
      if(j < 0) throw new Error(`${MYNAME}: the cell across side ${i} has no side on the line of side ${i}`);
      const lo = Math.max(t0, Math.min(tA, tB)), hi = Math.min(t1, Math.max(tA, tB));
      if(hi - lo < tol) throw new Error(`${MYNAME}: the cell found across side ${i} does not touch it`);
      pieces.push({ side: i, t0: lo, t1: hi, trans: T, word: T.word });
      if(lo - t0 > tol) queue.push([t0, lo]);
      if(t1 - hi > tol) queue.push([hi, t1]);
    }
    pieces.sort((p, q) => p.t0 - q.t0);
    let t = 0;
    for(const p of pieces){
      if(Math.abs(p.t0 - t) > tol) throw new Error(`${MYNAME}: side ${i} is not covered by the cells across it`);
      t = p.t1;
    }
    if(Math.abs(t - segments[i].len) > tol) throw new Error(`${MYNAME}: side ${i} is not covered by the cells across it`);
    for(const p of pieces){
      p.P0 = pointOn(i, p.t0);
      p.P1 = pointOn(i, p.t1);
      p.directWord = inverseWord(p.word);
      subSides.push(p);
    }
  }

  // ---- vertices of the refined polygon ------------------------------------------
  const vertices = corners.map(c => ({ point: c.point, angle: c.angle, subSides: [] }));
  const vertexAt = (P) => vertices.findIndex(v => dist(v.point, P) < tol);
  subSides.forEach((s, si) => {
    for(const P of [s.P0, s.P1]){
      let vi = vertexAt(P);
      if(vi < 0){
        vertices.push({ point: P, angle: Math.PI, subSides: [] });   // a point splitting a side
        vi = vertices.length - 1;
      }
      vertices[vi].subSides.push(si);
    }
  });
  vertices.forEach((v, vi) => {
    if(v.subSides.length !== 2)
      throw new Error(`${MYNAME}: vertex ${vi} at (${v.point}) has ${v.subSides.length} segments`);
  });

  // ---- pairing of the segments ------------------------------------------------------
  const pairing = subSides.map((s, si) => {
    const Q0 = apply(s.trans, s.P0), Q1 = apply(s.trans, s.P1);
    const j = subSides.findIndex(r => (dist(r.P0, Q0) < tol && dist(r.P1, Q1) < tol) ||
                                      (dist(r.P0, Q1) < tol && dist(r.P1, Q0) < tol));
    if(j < 0)
      throw new Error(`${MYNAME}: the transform of segment ${si} of side ${s.side} does not map it onto the boundary of the domain`);
    return j;
  });
  pairing.forEach((j, i) => {
    if(pairing[j] !== i)
      throw new Error(`${MYNAME}: segment ${i} is paired with segment ${j}, but segment ${j} with segment ${pairing[j]}`);
    if(!sameTransform(subSides[j].trans, subSides[i].trans.getInverse(), testPoints))
      throw new Error(`${MYNAME}: the transform of segment ${j} is not the inverse of the one of segment ${i}`);
  });

  // ---- vertex cycles ----------------------------------------------------------------
  const visited = new Array(vertices.length).fill(false);
  const cycles = [];
  for(let v0 = 0; v0 < vertices.length; v0++){
    if(visited[v0]) continue;
    const [sA, sB] = vertices[v0].subSides;
    // leave through the segment with the larger index and close through the other one
    let leave = Math.max(sA, sB);
    const closing = Math.min(sA, sB);
    let v = v0;
    const path = [], vertexPath = [];
    let angleSum = 0;
    for(let step = 0; ; step++){
      if(step > MAX_CYCLE_LENGTH)
        throw new Error(`${MYNAME}: the vertex cycle starting at vertex ${v0} does not close`);
      visited[v] = true;
      path.push(leave);
      vertexPath.push(v);
      angleSum += vertices[v].angle;
      const next = vertexAt(apply(subSides[leave].trans, vertices[v].point));
      const arriving = pairing[leave];
      if(next < 0 || !vertices[next].subSides.includes(arriving))
        throw new Error(`${MYNAME}: the transform of segment ${leave} does not map vertex ${v} onto a vertex of segment ${arriving}`);
      if(next === v0 && arriving === closing) break;
      v = next;
      leave = (vertices[v].subSides[0] === arriving) ? vertices[v].subSides[1] : vertices[v].subSides[0];
    }
    const ratio = 2*Math.PI/angleSum;
    const order = Math.round(ratio);
    if(order < 1 || Math.abs(ratio - order) > 1e-6)
      throw new Error(`${MYNAME}: the angles of the cycle at vertex ${v0} sum to ${angleSum}, not to a divisor of 2*PI`);
    cycles.push({ vertices: vertexPath, subSides: path, order });
  }

  // ---- relators -----------------------------------------------------------------------
  // the walk around a vertex visits the cells D, g_x1(D), g_x1 g_x2(D), ...:
  // the cycle transform is g_x1 * g_x2 * ... * g_xk (g_xk applied first), which
  // in the left to right word convention is the word xk ... x2 x1
  const relatorList = [];
  const seen = new Set();
  const addRelator = (word, power) => {
    if(freeReduce(word).length === 0) return;      // trivially true
    const relator = powerString(word, power);
    if(seen.has(relator)) return;
    if(!sameTransform(evaluate(word, power), identity, testPoints))
      throw new Error(`${MYNAME}: relator ${relator} is not the identity`);
    seen.add(relator);
    relatorList.push(relator);
  };

  subSides.forEach((s, i) => {
    const j = pairing[i];
    if(j === i)     addRelator(s.directWord, 2);
    else if(j > i)  addRelator(s.directWord + subSides[j].directWord, 1);
  });
  for(const cycle of cycles){
    const word = cycle.subSides.slice().reverse().map(x => subSides[x].directWord).join('');
    cycle.word = wordString(word);
    addRelator(word, cycle.order);
  }

  return {
    gens: names.join(' '),
    relators: relatorList.join(', '),
    genNames: names,
    relatorList,
    subSides: subSides.map(s => ({ side: s.side, t0: s.t0, t1: s.t1, P0: s.P0, P1: s.P1,
                                   word: s.word, directWord: s.directWord })),
    pairing,
    corners,
    vertices,
    cycles,
  };
}
