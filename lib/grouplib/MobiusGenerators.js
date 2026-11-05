import {
    sqrt,
    Group,
    iSphere,
    iPlane,
    mobiusToSplanes,
    cMul,
    cDiv,
    cAdd,
    cSub,
    cAbs,
    dirichletImages,
    dirichletCell,
    dirichletSide,
    dirichletCellAt,
    dirichletSourceWord,
    makeDirichletGroup,
    normalizeWord,
    inverseWord,
    sideCutsCell,
}
from './modules.js';

const DEBUG = false;
const MYNAME = 'MobiusGenerators';

/*
  groups given by Möbius matrices (2026-11-05, moved out of Group_Grandma.js for the
  group makers of Indra's Pearls: Grandma's recipe, Maskit's twice punctured torus):

  - complex numbers [re, im] and 2x2 matrices [[a, b], [c, d]] of determinant 1;
  - carrierGroup: a Group with the named generators as reflection chains
    (mobiusToSplanes) and a side per generator and inverse, the isometric circles,
    which the renderer can show and the Dirichlet construction reads the generators
    from;
  - dirichletDomain: the Dirichlet domain of a base point as a Group, the fundamental
    domain of such a maker.
*/

// ---- complex numbers and matrices ---------------------------------------------------

export function csqrt(z){
    const r = cAbs(z);
    const re = sqrt(Math.max(0, (r + z[0])/2));
    const im = (z[1] < 0 ? -1 : 1)*sqrt(Math.max(0, (r - z[0])/2));
    return [re, im];
}

/** the product of two matrices */
export function mmul(P, Q){
    return [[cAdd(cMul(P[0][0], Q[0][0]), cMul(P[0][1], Q[1][0])), cAdd(cMul(P[0][0], Q[0][1]), cMul(P[0][1], Q[1][1]))],
            [cAdd(cMul(P[1][0], Q[0][0]), cMul(P[1][1], Q[1][0])), cAdd(cMul(P[1][0], Q[0][1]), cMul(P[1][1], Q[1][1]))]];
}

/** the inverse of a matrix of determinant 1 */
export function minverse(m){
    const neg = z => [-z[0], -z[1]];
    return [[m[1][1], neg(m[0][1])], [neg(m[1][0]), m[0][0]]];
}

export function mtrace(m){
    return cAdd(m[0][0], m[1][1]);
}

export function mdet(m){
    return cSub(cMul(m[0][0], m[1][1]), cMul(m[0][1], m[1][0]));
}

/** m(z) for a point z of the plane */
export function mobius(m, z){
    return cDiv(cAdd(cMul(m[0][0], z), m[0][1]), cAdd(cMul(m[1][0], z), m[1][1]));
}

/** the product of the matrices of a word in named generators, {name: matrix} */
export function wordMatrix(word, matrices){
    let m = [[[1, 0], [0, 0]], [[0, 0], [1, 0]]];
    for(const ch of word) m = mmul(m, matrices[ch]);
    return m;
}

/**
  the isometric circle |c z + d| = 1 of the matrix [[a, b], [c, d]]: the circle of
  radius 1/|c| about -d/c, oriented with the domain outside; null when c = 0
*/
export function isometricCircle(m){
    const c = m[1][0], d = m[1][1];
    const len = cAbs(c);
    if(!(len > 1e-12)) return null;
    const centre = cDiv([-d[0], -d[1]], c);
    return iSphere([centre[0], centre[1], 0, -1/len]);
}

/**
  the side of the generator m of a carrier group: the circle across which the cell
  m(D) lies, the isometric circle of m^-1 (m maps the exterior of its own isometric
  circle onto the interior of that one); for an affine m (c = 0: a translation or a
  similarity) the bisector line of 0 and m(0), a unit circle when m fixes 0
*/
export function generatorSide(m){
    const circle = isometricCircle(minverse(m));
    if(circle) return circle;
    const s = mobius(m, [0, 0]);
    const len = cAbs(s);
    if(len > 1e-12) return iPlane([s[0]/len, s[1]/len, 0, len/2]);
    return iSphere([0, 0, 0, -1]);
}

/**
  the carrier group of the generators [{name, m}] (m a matrix of determinant 1, name
  a lowercase letter): the sides of the generator and of its inverse (the uppercase
  letter) in this order, each paired by its reflection chain (mobiusToSplanes), so that
  Group.transforms[i] is the generator of side i, named by the letter. For
  generators whose isometric circles do not overlap it is a Ford domain; otherwise
  it only carries the generators for dirichletDomain. Null when a chain is degenerate
*/
export function carrierGroup(gens){
    const sides = [], chains = [], names = [];
    for(const {name, m} of gens){
        const inv = minverse(m);
        const cm = mobiusToSplanes(m), ci = mobiusToSplanes(inv);
        if(!cm || !ci || cm.some(s => !s.v.every(Number.isFinite)) || ci.some(s => !s.v.every(Number.isFinite))) return null;
        // the side of the generator: the cell across it is m(D), mapped back by m^-1
        sides.push(generatorSide(m));  chains.push(ci); names.push(name);
        sides.push(generatorSide(inv)); chains.push(cm); names.push(name.toUpperCase());
    }
    return new Group({s: sides, t: chains, genNames: names});
}

// ---- the Dirichlet domain ----------------------------------------------------------

// the rounds of the closure of the sides under inverses and products, and of the
// generator folds (dirichletDomain)
const CLOSURE_ROUNDS = 8;
const GENERATOR_ROUNDS = 4;
const MAX_CANDIDATES = 4000;
// the fold of a generator's image into the cell: near a nearly parabolic fixed point
// the cell is thin and the fold takes many steps
const FOLD_ITERATIONS = 5000;
// the time after which the search stops with the sides found (a base near the limit
// set has a domain of many long words; the group is computed on every parameter change)
export const TIME_BUDGET = 2;

/**
  the Dirichlet domain of the base as a Group (makeDirichletGroup), or null.

  The candidates are the images of the base under the words of at most `depth`
  letters whose scale factor is at least minScale (dirichletImages); the cell of the
  base is bounded by some of their bisectors (dirichletCell). The cell's sides are
  closed under inverses and products of pairs (the standard closure: the side of g
  pairs with the side of g^-1, a side missed among the short words appears as a
  product of sides) until the cell no longer changes; only candidates that cut the
  current cell are kept (sideCutsCell), since the cell only shrinks. Then each
  generator's image of the base is folded back into the cell by the cell's pairings
  (dirichletCellAt): a fold that does not end at the base means an image of the base
  inside the cell, the cell is the domain of a subgroup (near a fixed point the
  powers of one generator bound it alone); that image's word is added and the
  closure runs again, as the automatic selection of the Dirichlet domain operation
  does. The words of the sides are in the side names of `group`; the search stops
  after `seconds` with the sides found.
*/
export function dirichletDomain(group, base, depth, minScale, seconds = TIME_BUDGET){

    const deadline = Date.now() + 1000*seconds;
    const tried = new Set();      // plain words looked at
    let kept = [];                // the candidates in play: the cell's sides and what cuts the cell
    let cell = [];                // dirichletCell of kept: {index, arcs}

    const cutsCell = (c) => (cell.length === 0) || sideCutsCell(kept.map(k => k.side), c.side);
    const addWord = (w) => {
        const plain = normalizeWord(group, w);
        if(plain === null || plain.length === 0 || tried.has(plain)) return false;
        tried.add(plain);
        const c = dirichletSide(group, base, plain);
        if(!c || !c.side || !cutsCell(c)) return false;
        kept.push(c);
        return true;
    };
    const recompute = () => {
        cell = dirichletCell(kept.map(c => c.side));
        kept = cell.map(c => kept[c.index]);
        cell = dirichletCell(kept.map(c => c.side));
    };

    // the images' words are raw (aBb for a): one candidate per reduced word
    for(const it of dirichletImages(group, {base, depth, minScale, maxCount: MAX_CANDIDATES})){
        const plain = normalizeWord(group, it.word);
        if(plain === null || plain.length === 0 || tried.has(plain)) continue;
        tried.add(plain);
        kept.push({...it, word: plain});
    }
    recompute();

    const closure = () => {
        for(let round = 0; round < CLOSURE_ROUNDS; round++){
            const words = kept.map(c => c.word);
            let added = 0;
            for(const w of words){
                const inv = inverseWord(group, w);
                if(inv !== null && addWord(inv)) added++;
            }
            for(const w1 of words){
                for(const w2 of words){
                    if(Date.now() > deadline) break;
                    if(addWord(w1 + w2)) added++;
                }
            }
            if(added === 0) break;
            recompute();
            if(Date.now() > deadline) break;
        }
    };

    let dg = null;
    for(let round = 0; round < GENERATOR_ROUNDS; round++){
        closure();
        const words = kept.map(c => c.word);
        dg = (words.length > 0) ? makeDirichletGroup(group, {base, words}) : null;
        if(!dg) return null;
        if(Date.now() > deadline){
            console.warn(`${MYNAME}: the Dirichlet domain of (${base.v[0]}, ${base.v[1]}) is not complete after ${seconds} s: ${words.length} sides`);
            break;
        }
        let added = 0;
        for(const g of group.getGenNames()){
            const img = dirichletSide(group, base, g);
            if(!img) continue;
            const at = dirichletCellAt(dg, base, [img.point.v[0], img.point.v[1]], FOLD_ITERATIONS);
            if(at === null) continue;    // the fold failed, or the image is in the base's cell
            // the image W(base) of the cell's word lies in the same cell as g(base):
            // W^-1 g maps the base into its own cell, so it is the identity (g is a
            // product of the sides) or an image inside the cell
            const w = inverseWord(group, dirichletSourceWord(dg, at.word));
            if(w === null) continue;
            const u = normalizeWord(group, w + g);
            if(u && u.length > 0 && addWord(u)) added++;
        }
        if(added === 0) break;
        recompute();
        if(DEBUG) console.log(`${MYNAME}: ${added} images inside the cell, closure round ${round + 1}`);
    }
    return dg;
}
