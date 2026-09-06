/* ============================================================================
 * sublib_core.js — the enumeration engine
 *
 * Everything sublib computes: word and presentation parsing, the low-index
 * coset-table search, conjugacy classes, and the color_groups wire format.
 * It knows nothing about any particular group — the catalogue lives in
 * groups_description.js, and the public interface in sublib.js.  Import this
 * module directly only to reach past that interface.
 *
 * Given a finite presentation it enumerates the conjugacy classes of subgroups
 * of index <= maxIndex and returns, for each one, the permutations that the
 * parent generators induce on the cosets — in the JSON shape used by SymmHub's
 * apps/sympix/color_groups/<family>/sub_<name>.json files.
 *
 * The enumeration is a Sims-style low-index coset-table backtrack search: it
 * builds every complete standardized coset table on <= maxIndex cosets.  Such
 * tables are in bijection with the subgroups of index <= maxIndex, so grouping
 * them under change of base point yields the conjugacy classes — which is what
 * GAP's LowIndexSubgroupsFpGroup returns and what the shipped JSON files hold.
 *
 * Coset-table conventions (identical to GAP's):
 *   - cosets are numbered 0..n-1 internally, coset 0 is the subgroup itself;
 *   - column 2k is the action of generator k (0-based), column 2k+1 its
 *     inverse;
 *   - tables are lenlex-standardized: scanning rows in order and, within a
 *     row, columns in order gen1, gen1^-1, gen2, gen2^-1, ..., new cosets are
 *     numbered in the order they are first reached.
 *
 * Class representative: the lexicographically least standardized table over
 * all choices of base point.  This is canonical (independent of search order)
 * and agrees with GAP's representative for ~99% of subgroups; where it
 * differs, the two tables are conjugate, i.e. describe the same class.
 * See README "Compatibility" for the consequences.
 * ========================================================================== */

/* =========================================================================
 * Part 0: words
 *
 * A word is an array of nonzero signed integers: +k is generator k (1-based),
 * -k its inverse.  Text form uses lowercase for a generator and uppercase for
 * its inverse ("aBc" = a b^-1 c); "a*b^-1*c", "(ab)^3" and "[a,b]" (the
 * commutator a^-1 b^-1 a b) are also accepted.
 * ======================================================================= */

export class ParseError extends Error {}

export function freeReduce(word) {
  const out = [];
  for (const x of word) {
    if (out.length && out[out.length - 1] === -x) out.pop();
    else out.push(x);
  }
  return out;
}

export function invWord(word) {
  const out = [];
  for (let i = word.length - 1; i >= 0; i--) out.push(-word[i]);
  return out;
}

export function cyclicReduce(word) {
  const w = freeReduce(word);
  let a = 0, b = w.length;
  while (b - a >= 2 && w[a] === -w[b - 1]) { a++; b--; }
  return w.slice(a, b);
}

/** Parse a word over `genNames` (single lowercase letters). */
export function parseWord(text, genNames) {
  const genIndex = new Map();
  genNames.forEach((g, i) => {
    genIndex.set(g, i + 1);
    genIndex.set(g.toUpperCase(), -(i + 1));
  });
  const s = String(text).replace(/\s+|\*/g, '');
  let pos = 0;

  function parseSeq(stopChars) {
    let word = [];
    while (pos < s.length && !stopChars.includes(s[pos])) word = word.concat(parseFactor());
    return word;
  }
  function parseFactor() {
    let base;
    const ch = s[pos];
    if (ch === '(') {
      pos++;
      base = parseSeq(')');
      if (s[pos] !== ')') throw new ParseError(`missing ")" in "${text}"`);
      pos++;
    } else if (ch === '[') {
      pos++;
      const x = parseSeq(',');
      if (s[pos] !== ',') throw new ParseError(`commutator needs a comma: "${text}"`);
      pos++;
      const y = parseSeq(']');
      if (s[pos] !== ']') throw new ParseError(`missing "]" in "${text}"`);
      pos++;
      base = invWord(x).concat(invWord(y), x, y);
    } else if (genIndex.has(ch)) {
      base = [genIndex.get(ch)];
      pos++;
    } else if (ch === '1' && (pos + 1 >= s.length || !/\d/.test(s[pos + 1]))) {
      base = [];            // identity
      pos++;
    } else {
      throw new ParseError(`unexpected character "${ch}" in "${text}"`);
    }
    if (s[pos] === '^') {
      pos++;
      let sign = 1;
      if (s[pos] === '-') { sign = -1; pos++; }
      let num = '';
      while (pos < s.length && /\d/.test(s[pos])) num += s[pos++];
      if (!num) throw new ParseError(`missing exponent in "${text}"`);
      const n = sign * parseInt(num, 10);
      const b = n < 0 ? invWord(base) : base;
      let w = [];
      for (let i = 0; i < Math.abs(n); i++) w = w.concat(b);
      base = w;
    }
    return base;
  }
  return freeReduce(parseSeq(''));
}

/** "aBc" form: lowercase generator, uppercase inverse. */
export function wordToString(word, genNames) {
  if (!word.length) return '1';
  let out = '';
  for (const x of word) {
    const g = genNames[Math.abs(x) - 1];
    out += x > 0 ? g : g.toUpperCase();
  }
  return out;
}

/** Parse "a b c", "a,b,c" or "abc" into generator names. */
export function parseGenerators(text) {
  if (Array.isArray(text)) text = text.join(' ');
  const parts = String(text).split(/[\s,]+/).filter(Boolean);
  const names = (parts.length === 1 && parts[0].length > 1) ? parts[0].split('') : parts;
  for (const n of names) {
    if (!/^[a-z]$/.test(n)) {
      throw new ParseError(`generator names must be single lowercase letters, got "${n}"`);
    }
  }
  if (!names.length) throw new ParseError('no generators given');
  if (new Set(names).size !== names.length) throw new ParseError('duplicate generator names');
  return names;
}

/** Split relator text on , ; and newlines, but not inside brackets. */
function splitRelators(text) {
  if (Array.isArray(text)) return text.map(s => String(s).trim()).filter(Boolean);
  const out = [];
  let depth = 0, cur = '';
  for (const ch of String(text)) {
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth--;
    if ((ch === ',' || ch === ';' || ch === '\n') && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * Build a presentation.
 *   makePresentation('a b c', 'a^2, b^3, (a*b)^6, b*c')
 * Relators may also be written "u = v".  Returns
 * { gens: string[], relators: word[], relStrings: string[] }.
 */
export function makePresentation(genText, relText) {
  const gens = parseGenerators(genText);
  const relStrings = splitRelators(relText == null ? '' : relText);
  const relators = relStrings
    .map(s => {
      const eq = s.split('=');
      if (eq.length === 2) {
        return freeReduce(parseWord(eq[0], gens).concat(invWord(parseWord(eq[1], gens))));
      }
      return parseWord(s, gens);
    })
    .filter(w => w.length > 0);
  return { gens, relators, relStrings };
}

/* =========================================================================
 * Part 1: low-index coset-table search
 * ======================================================================= */

const colOfLetter = (x) => (x > 0 ? 2 * (x - 1) : 2 * (-x - 1) + 1);
const invCol = (c) => c ^ 1;

class LowIndexSearch {
  constructor(pres, maxIndex, options = {}) {
    this.pres = pres;
    this.nGens = pres.gens.length;
    this.nCols = 2 * this.nGens;
    this.maxIndex = maxIndex;
    this.maxTables = options.maxTables || Infinity;
    this.deadlineMs = options.deadlineMs || Infinity;
    this.relCols = pres.relators
      .map(cyclicReduce)
      .filter(w => w.length > 0)
      .map(w => w.map(colOfLetter));
    // With onTable, completed tables are handed over and dropped; without it
    // they accumulate, which on subgroup-rich groups is a lot of memory.
    this.onTable = options.onTable || null;
    // Sims' canonicity pruning: abandon a branch as soon as some other base
    // point gives a smaller table, so only class representatives are built.
    this.prune = options.prune !== false;
    this.rho = new Int32Array(maxIndex);
    this.rhoInv = new Int32Array(maxIndex);
    this.tables = [];
    this.tableCount = 0;
    this.aborted = false;
    this.limitReached = false;
    this.nodesVisited = 0;
    this.trail = [];
  }

  run() {
    this.tab = new Int32Array(this.maxIndex * this.nCols).fill(-1);
    this.t0 = Date.now();
    this.searchFrom(1);          // start from the single coset 0
    return this.tables;
  }

  /** Scan a relator from coset c; 0 = contradiction, 1 = consistent. */
  scan(relCols, c) {
    const tab = this.tab, nCols = this.nCols, len = relCols.length;
    let f = c, i = 0;
    while (i < len) {
      const t = tab[f * nCols + relCols[i]];
      if (t < 0) break;
      f = t; i++;
    }
    if (i === len) return f === c ? 1 : 0;
    let b = c, j = len - 1;
    while (j > i) {
      const t = tab[b * nCols + invCol(relCols[j])];
      if (t < 0) break;
      b = t; j--;
    }
    if (j < i) return 1;
    if (j === i) return this.define(f, relCols[i], b);   // one gap: deduce it
    return 1;                                            // several gaps: no info
  }

  /** Set tab[f][col] = b together with its inverse edge; 0 on a clash. */
  define(f, col, b) {
    const tab = this.tab, nCols = this.nCols;
    const e1 = f * nCols + col, e2 = b * nCols + invCol(col);
    const v1 = tab[e1], v2 = tab[e2];
    if (v1 >= 0) return v1 === b ? 1 : 0;
    if (v2 >= 0) return 0;
    tab[e1] = b; this.trail.push(e1);
    if (e2 !== e1) { tab[e2] = f; this.trail.push(e2); }
    return 1;
  }

  /** Close under relator scans; 0 on contradiction. */
  propagate(nCosets) {
    let last = -1;
    while (last !== this.trail.length) {
      last = this.trail.length;
      for (const rel of this.relCols) {
        for (let c = 0; c < nCosets; c++) {
          if (this.scan(rel, c) === 0) return 0;
        }
        if (this.trail.length !== last) break;   // restart from the first relator
      }
    }
    return 1;
  }

  firstUndefined(nCosets) {
    const tab = this.tab, nCols = this.nCols;
    for (let c = 0; c < nCosets; c++) {
      for (let col = 0; col < nCols; col++) {
        if (tab[c * nCols + col] < 0) return c * nCols + col;
      }
    }
    return -1;
  }

  /** True while this table could still be the least one in its class. */
  canonical(nCosets) {
    return !this.prune || isCanonical(this.tab, nCosets, this.nCols, this.rho, this.rhoInv);
  }

  searchFrom(nCosets) {
    if (this.aborted) return;
    this.nodesVisited++;
    if ((this.nodesVisited & 1023) === 0 && Date.now() - this.t0 > this.deadlineMs) {
      this.aborted = true;
      return;
    }
    const e = this.firstUndefined(nCosets);
    if (e < 0) {
      if (!this.canonical(nCosets)) return;
      const done = this.tab.slice(0, nCosets * this.nCols);
      if (this.onTable) this.onTable(nCosets, done);
      else this.tables.push({ n: nCosets, tab: done });
      this.tableCount++;
      if (this.tableCount >= this.maxTables) { this.limitReached = true; this.aborted = true; }
      return;
    }
    const c = Math.floor(e / this.nCols), col = e % this.nCols;
    const candidates = [];
    for (let d = 0; d < nCosets; d++) {
      if (this.tab[d * this.nCols + invCol(col)] < 0) candidates.push(d);
    }
    if (nCosets < this.maxIndex) candidates.push(nCosets);   // define a new coset
    for (const d of candidates) {
      const mark = this.trail.length;
      const isNew = d === nCosets;
      if (this.define(c, col, d)) {
        const n2 = isNew ? nCosets + 1 : nCosets;
        if (this.propagate(n2) && this.canonical(n2)) this.searchFrom(n2);
      }
      while (this.trail.length > mark) this.tab[this.trail.pop()] = -1;
      if (this.aborted) return;
    }
  }
}

/**
 * Sims' canonicity test, on a complete or partial table.
 *
 * The search builds tables standardized from coset 0.  Restandardizing from
 * another base point β gives the table of a conjugate subgroup; this compares
 * each of those with the table at hand, entry by entry in the order the search
 * fills them, and answers false as soon as one of them is strictly smaller.
 *
 * On a complete table that is exactly "this table is the least in its class",
 * so accepting only canonical tables yields one representative per conjugacy
 * class.  On a partial table the comparison stops at the first entry that is
 * undefined on either side, and only a strict loss over the defined prefix
 * counts — a prefix that already loses still loses however it is completed, so
 * cutting the branch there cannot discard a canonical table.
 *
 * `rho` maps old coset numbers to the numbering induced by β, `rhoInv` back;
 * both are scratch space of length >= n, passed in to avoid reallocating.
 */
function isCanonical(tab, n, nCols, rho, rhoInv) {
  for (let beta = 1; beta < n; beta++) {
    rho.fill(-1, 0, n);
    rho[beta] = 0; rhoInv[0] = beta;
    let m = 0;                        // highest coset number handed out so far
    let settled = false;              // β lost, or the comparison ran out of table
    for (let i = 0; i <= m && !settled; i++) {
      const oldI = rhoInv[i];
      for (let col = 0; col < nCols; col++) {
        const mine = tab[i * nCols + col];
        const gamma = tab[oldI * nCols + col];
        if (mine < 0 || gamma < 0) { settled = true; break; }   // undecided
        let nv = rho[gamma];
        if (nv < 0) { nv = ++m; rho[gamma] = nv; rhoInv[nv] = gamma; }
        if (nv < mine) return false;                            // β wins: prune
        if (nv > mine) { settled = true; break; }               // β loses
      }
    }
  }
  return true;
}

/**
 * Number of subgroups in the class of a table — i.e. the number of distinct
 * conjugates, which is the number of distinct standardizations of the table.
 * (Two base points give the same subgroup exactly when they standardize to the
 * same table.)  With pruning on this replaces counting the conjugates as the
 * search meets them, since it never meets them.
 */
function classSize(tab, n, nCols) {
  const seen = new Set();
  for (let p = 0; p < n; p++) seen.add(standardize(tab, n, nCols, p).join(','));
  return seen.size;
}

/** Re-standardize `tab` taking coset `base` as the new coset 0. */
export function standardize(tab, n, nCols, base) {
  const map = new Int32Array(n).fill(-1);
  const order = new Int32Array(n);
  map[base] = 0; order[0] = base;
  let next = 1;
  const out = new Int32Array(n * nCols);
  for (let c = 0; c < n; c++) {
    const oc = order[c];
    for (let col = 0; col < nCols; col++) {
      const t = tab[oc * nCols + col];
      if (map[t] < 0) { map[t] = next; order[next] = t; next++; }
      out[c * nCols + col] = map[t];
    }
  }
  return out;
}

function lexLess(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/**
 * Canonical form of the coset table: the lexicographically least
 * standardization over all base points.  Two tables have the same canonical
 * form exactly when their subgroups are conjugate.
 */
export function canonicalForm(tab, n, nCols) {
  let best = null;
  for (let p = 0; p < n; p++) {
    const s = standardize(tab, n, nCols, p);
    if (best === null || lexLess(s, best)) best = s;
  }
  return best;
}

/** Schreier generators of the subgroup (= the stabilizer of coset 0). */
export function schreierGenerators(tab, n, nCols) {
  const nGens = nCols / 2;
  const rep = new Array(n).fill(null);
  rep[0] = [];
  const treeEdge = new Set();
  for (let c = 0; c < n; c++) {
    for (let col = 0; col < nCols; col++) {
      const t = tab[c * nCols + col];
      if (rep[t] === null) {
        const letter = (col % 2 === 0) ? col / 2 + 1 : -((col - 1) / 2 + 1);
        rep[t] = rep[c].concat([letter]);
        treeEdge.add(c + ',' + col);
        treeEdge.add(t + ',' + invCol(col));
      }
    }
  }
  const gens = [];
  const seen = new Set();
  for (let c = 0; c < n; c++) {
    for (let k = 0; k < nGens; k++) {
      const col = 2 * k;
      if (treeEdge.has(c + ',' + col)) continue;
      const t = tab[c * nCols + col];
      const w = freeReduce(rep[c].concat([k + 1], invWord(rep[t])));
      if (!w.length) continue;
      const key = w.join(',');
      if (seen.has(key) || seen.has(invWord(w).join(','))) continue;
      seen.add(key);
      gens.push(w);
    }
  }
  return gens;
}

/** The permutation each generator induces on the cosets, as 0-based arrays. */
export function cosetAction(tab, n, nCols) {
  const perms = [];
  for (let k = 0; k < nCols / 2; k++) {
    const p = new Array(n);
    for (let c = 0; c < n; c++) p[c] = tab[c * nCols + 2 * k];
    perms.push(p);
  }
  return perms;
}

/**
 * Enumerate the conjugacy classes of subgroups of index <= maxIndex.
 *
 * Returns { classes, stats }, where each class is
 *   { index, table (canonical, flat Int32Array), nCols, size, normal }
 * `size` is the number of subgroups in the class, `normal` is size === 1.
 * Classes are sorted by index, then by the canonical table.
 */
export function subgroupClasses(pres, maxIndex, options = {}) {
  const nCols = 2 * pres.gens.length;
  const t0 = Date.now();
  const pruning = options.prune !== false;

  // Each table is reduced to its class as it is found, so memory grows with
  // the number of classes rather than the number of subgroups.  With pruning
  // every table arrives canonical and alone; without it, conjugates arrive
  // too and are counted into the class they belong to.
  const byKey = new Map();
  const search = new LowIndexSearch(pres, maxIndex, {
    ...options,
    onTable: (n, tab) => {
      const canon = pruning ? tab : canonicalForm(tab, n, nCols);
      const key = n + '#' + canon.join(',');
      const cl = byKey.get(key);
      if (cl) { cl.size++; return; }
      byKey.set(key, {
        index: n, table: canon, nCols, key,
        size: pruning ? classSize(canon, n, nCols) : 1,
      });
    },
  });
  search.run();
  const classes = [...byKey.values()];
  let literalCount = 0;
  for (const cl of classes) { cl.normal = cl.size === 1; literalCount += cl.size; }
  classes.sort((a, b) => a.index - b.index || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  return {
    classes,
    stats: {
      literalCount,
      classCount: classes.length,
      nodesVisited: search.nodesVisited,
      elapsedMs: Date.now() - t0,
      aborted: search.aborted,
      limitReached: search.limitReached,
    },
  };
}

/* =========================================================================
 * Part 2: the color_groups wire format
 *
 * Cosets are written as strings over a 62-symbol alphabet, one character per
 * coset, one space-separated block per generator: block k, position i holds
 * the coset that coset i is mapped to by generator k.  "cosets" holds the
 * generators, "invcos" their inverses.  Subgroup generator words are written
 * with uppercase for inverses and — matching the GAP exporter that produced
 * the shipped files — in reversed letter order.
 * ======================================================================= */

export const COSET_SYMBOLS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const MAX_COSETS = COSET_SYMBOLS.length;   // 62

/** Coset table -> { cosets, invcos } strings. */
export function tableToPermStrings(tab, n, nCols) {
  if (n > MAX_COSETS) {
    throw new RangeError(`index ${n} exceeds the ${MAX_COSETS}-symbol coset alphabet`);
  }
  const fwd = [], bwd = [];
  for (let k = 0; k < nCols / 2; k++) {
    let f = '', b = '';
    for (let c = 0; c < n; c++) {
      f += COSET_SYMBOLS[tab[c * nCols + 2 * k]];
      b += COSET_SYMBOLS[tab[c * nCols + 2 * k + 1]];
    }
    fwd.push(f); bwd.push(b);
  }
  return { cosets: fwd.join(' '), invcos: bwd.join(' ') };
}

/** "acb acb bca" -> [[0,2,1],[0,2,1],[1,2,0]] (0-based permutations). */
export function permStringToArrays(str) {
  return String(str).trim().split(/\s+/).filter(Boolean).map(block => {
    const p = [];
    for (const ch of block) {
      const v = COSET_SYMBOLS.indexOf(ch);
      if (v < 0) throw new ParseError(`bad coset symbol "${ch}" in "${block}"`);
      p.push(v);
    }
    return p;
  });
}

/** Inverse of permStringToArrays. */
export function permArraysToString(perms) {
  return perms.map(p => p.map(v => COSET_SYMBOLS[v]).join('')).join(' ');
}

/** GAP exporter convention: uppercase = inverse, letters in reversed order. */
function wordToGapString(word, genNames, reverse = true) {
  const letters = word.map(x => {
    const g = genNames[Math.abs(x) - 1];
    return x > 0 ? g : g.toUpperCase();
  });
  if (reverse) letters.reverse();
  return letters.join('');
}

/** "Group( [ a, b, c ] )", as GAP prints it. */
function gapGroupString(gens) {
  return `Group( [ ${gens.join(', ')} ] )`;
}

/** "[ a^2, b^3, b*c ]", as GAP prints RelatorsOfFpGroup. */
function gapRelatorString(relStrings) {
  return `[ ${relStrings.join(', ')} ]`;
}

/**
 * Mirror of the GAP exporter's findMaxIndex: report the last index whose
 * cumulative subgroup count still fits in `maxSubgroups`, and what the next
 * index would have cost.
 *
 * Searching up to the budget rather than to `maxIndex` matters: a group whose
 * budget runs out at index 6 must not pay for a search to index 24 that would
 * only be thrown away.  Like GAP, this climbs one index at a time.  Climbing
 * faster is tempting — a search to index m already settles the budget for
 * every index below m, so doubling would need only a handful of passes — but
 * on the groups where the budget actually bites, cost grows so steeply with
 * the index that overshooting by two levels costs far more than every pass
 * below it put together: for the (3,8,7) triangle group, doubling to 16 takes
 * 50 s where the whole ladder to the 14 that is needed takes 4 s.
 */
function budgetedSearch(pres, maxIndex, maxSubgroups, options) {
  if (!maxSubgroups || maxSubgroups <= 0) {
    const r = subgroupClasses(pres, maxIndex, options);
    return { ...r, lastGoodIndex: maxIndex, nextIndex: null, nextIndexCount: null };
  }
  // A search to index m yields every class of index <= m, so one pass settles
  // the budget for the whole range 2..m.  Raise the ceiling until the budget
  // is exceeded somewhere inside that range, or until maxIndex is reached.
  const stats = { literalCount: 0, classCount: 0, nodesVisited: 0, elapsedMs: 0, aborted: false, limitReached: false };
  let m = Math.min(4, maxIndex);     // passes below 4 are free; start there
  for (;;) {
    const r = subgroupClasses(pres, m, options);
    stats.literalCount = r.stats.literalCount;
    stats.classCount = r.stats.classCount;
    stats.nodesVisited += r.stats.nodesVisited;
    stats.elapsedMs += r.stats.elapsedMs;
    stats.aborted = stats.aborted || r.stats.aborted;
    stats.limitReached = stats.limitReached || r.stats.limitReached;

    const perIndex = new Map();
    for (const cl of r.classes) perIndex.set(cl.index, (perIndex.get(cl.index) || 0) + 1);

    let prevCount = 1;               // GAP seeds with the whole group at index 1
    let lastIndexWithSubgroups = 2;
    let cum = perIndex.get(1) || 0;
    for (let n = 2; n <= m; n++) {
      cum += perIndex.get(n) || 0;
      if (cum > maxSubgroups) {
        return {
          classes: r.classes,
          stats,
          nextIndex: n > 2 ? n : 2,
          nextIndexCount: cum - prevCount,
          lastGoodIndex: n > 2 ? lastIndexWithSubgroups : 2,
        };
      }
      if (cum - prevCount > 0) lastIndexWithSubgroups = n;
      prevCount = cum;
    }
    if (m >= maxIndex || r.stats.aborted) {
      return {
        classes: r.classes,
        stats,
        lastGoodIndex: Math.min(lastIndexWithSubgroups, maxIndex),
        nextIndex: null,
        nextIndexCount: null,
      };
    }
    m++;
  }
}

/**
 * Enumerate subgroups and return the color_groups JSON object.
 *
 * spec:
 *   name          label used for the "name" field and the subgroup ids
 *   gens          "a b c" (or an array of names)      -- or pass `presentation`
 *   relators      "a^2, b^3, b*c" (or an array)
 *   presentation  a makePresentation() result, instead of gens/relators
 *   maxIndex      largest index to search (default 24)
 *   maxSubgroups  budget; 0/omitted means "no budget", search to maxIndex
 *   deadlineMs    abort the search after this long (default Infinity)
 *   generators    'gap' (default, reversed words) | 'natural' | 'none'
 *
 * Returns { name, group, relators, maxIndex, nextIndex, nextIndexCount,
 *           totalCount, countPerIndex, subgroups: [...] } plus a
 * non-enumerable `stats` property with timing and search counters.
 */
export function subgroupsData(spec = {}) {
  const pres = spec.presentation || makePresentation(spec.gens, spec.relators);
  const name = spec.name != null ? spec.name : 'G';
  const maxIndex = spec.maxIndex || 24;
  const maxSubgroups = spec.maxSubgroups || 0;
  const genMode = spec.generators || 'gap';

  if (maxIndex > MAX_COSETS) {
    throw new RangeError(`maxIndex ${maxIndex} exceeds the ${MAX_COSETS}-symbol coset alphabet`);
  }

  const { classes, stats, lastGoodIndex, nextIndex, nextIndexCount } =
    budgetedSearch(pres, maxIndex, maxSubgroups, {
      deadlineMs: spec.deadlineMs,
      maxTables: spec.maxTables,
    });

  const kept = classes.filter(cl => cl.index <= lastGoodIndex);
  const countsByIndex = new Map();
  for (const cl of kept) countsByIndex.set(cl.index, (countsByIndex.get(cl.index) || 0) + 1);
  const countPerIndex = [...countsByIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, count]) => ({ index, count }));

  const subgroups = [];
  let curIndex = -1, k = 0;
  for (const cl of kept) {
    if (cl.index !== curIndex) { curIndex = cl.index; k = 1; } else { k++; }
    const { cosets, invcos } = tableToPermStrings(cl.table, cl.index, cl.nCols);
    let generators = '';
    if (genMode !== 'none') {
      generators = schreierGenerators(cl.table, cl.index, cl.nCols)
        .map(w => wordToGapString(w, pres.gens, genMode === 'gap'))
        .join(' ');
    }
    subgroups.push({
      subgroup: `${name}.${cl.index}.${k}`,
      index: cl.index,
      generators,
      cosets,
      invcos,
    });
  }

  const data = {
    name,
    group: gapGroupString(pres.gens),
    relators: gapRelatorString(pres.relStrings),
    maxIndex: lastGoodIndex,
    nextIndex,
    nextIndexCount,
    totalCount: kept.length,
    countPerIndex,
    subgroups,
  };
  Object.defineProperty(data, 'stats', { value: stats, enumerable: false });
  Object.defineProperty(data, 'presentation', { value: pres, enumerable: false });
  Object.defineProperty(data, 'generatorMode', { value: genMode, enumerable: false });
  // carried through from a catalogue preset, for the structure analysis
  for (const key of ['geometry', 'dimension', 'family']) {
    if (spec[key] != null) Object.defineProperty(data, key, { value: spec[key], enumerable: false });
  }
  return data;
}

/* =========================================================================
 * Part 3: helpers for consumers
 * ======================================================================= */

const normalizePerms = (s) => String(s || '').trim().split(/\s+/).join(' ');

/** Generator names of a result: from its presentation, else from "Group( [ … ] )". */
function generatorNames(data) {
  if (data && data.presentation && data.presentation.gens) return data.presentation.gens;
  const m = /Group\(\s*\[([^\]]*)\]/.exec((data && data.group) || '');
  if (m) {
    const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
    if (names.length) return names;
  }
  return null;
}

/** a, b, c, … — the fallback when a bare subgroup is passed with no names. */
function defaultNames(count) {
  return Array.from({ length: count }, (_, i) => String.fromCharCode(97 + i));
}

/**
 * Representatives of the right cosets of a subgroup, as words in the parent
 * generators: N elements t_0 … t_{N-1} with G = H t_0 ⊔ … ⊔ H t_{N-1}, where
 * t_i is the representative of coset i and t_0 is the identity.
 *
 * The point of the coset table is that generator x sends coset Hg to Hgx, so a
 * word labelling a path from coset 0 to coset i is exactly a representative of
 * coset i — read left to right, as the product t_i = x₁x₂…x_k.  (Note that
 * this is the opposite of the reversed convention the `generators` field
 * inherits from the GAP exporter.)
 *
 * Canonical, in this sense: the words come from a breadth-first walk of the
 * table in its own scan order — cosets in numerical order and, within a coset,
 * columns g₁, g₁⁻¹, g₂, g₂⁻¹, … — so t_i is the shortest word reaching coset
 * i, and the first such word in that column order.  Being shortest they are
 * also freely reduced, and the set is prefix-closed (a Schreier transversal):
 * every prefix of a representative is itself a representative.  Since the
 * table sublib hands out is the canonical one for its conjugacy class, the
 * transversal depends only on the subgroup, not on how it was found.
 *
 * For building a fundamental domain: if F is a fundamental domain for G under
 * a left action, then ⋃ t_i · F is one for H.  Each entry also carries `via`,
 * the single generator that reaches it from an already-built neighbour, so
 * tiles can be grown one generator at a time instead of by re-multiplying the
 * whole word.
 *
 * Call it either way:
 *   cosetRepresentatives(data, '2222.6.13')   // id, index, or the entry itself
 *   cosetRepresentatives(subgroupEntry, { gens: 'a b c' })
 *
 * Returns an array of length N, indexed by coset number:
 *   { coset, symbol, word, letters, length, via }
 * `letters` is the word as signed generator numbers (+k, -k, 1-based), `word`
 * the same as text with uppercase for inverses ('1' for the identity), and
 * `via` is { from, letter, gen } — null for coset 0.
 */
/**
 * Accept either (data, idOrEntry, options) or (subgroupEntry, options), and
 * work out the generator names.  Shared by everything that takes a subgroup.
 */
function resolveSubgroup(source, subgroup, options, who) {
  let entry, gens, data = null;
  if (source && typeof source === 'object' && source.cosets !== undefined) {
    options = subgroup || {};
    entry = source;
    gens = options.gens ? parseGenerators(options.gens) : null;
  } else {
    if (!source || !Array.isArray(source.subgroups)) {
      throw new ParseError(`${who}: expected a subgroupsData() result or one of its subgroups`);
    }
    data = source;
    entry = typeof subgroup === 'number' ? source.subgroups[subgroup]
      : typeof subgroup === 'string' ? source.subgroups.find(s => String(s.subgroup) === subgroup)
        : subgroup;
    if (!entry || entry.cosets === undefined) {
      throw new ParseError(`${who}: no subgroup ${JSON.stringify(subgroup)} in this result`);
    }
    gens = options.gens ? parseGenerators(options.gens) : generatorNames(source);
  }
  return { entry, gens, data, options: options || {} };
}

/**
 * The presentation behind a result: the one it was built from, or rebuilt from
 * the GAP strings it carries — so this also works on a JSON file read off disk.
 */
export function presentationOf(data) {
  if (data && data.presentation) return data.presentation;
  const gens = generatorNames(data);
  if (!gens) throw new ParseError('presentationOf: no presentation and no "group" string to rebuild it from');
  const rels = String((data && data.relators) || '').replace(/^\[/, '').replace(/\]$/, '').trim();
  return makePresentation(gens.join(' '), rels);
}

export function cosetRepresentatives(source, subgroup, options = {}) {
  const r = resolveSubgroup(source, subgroup, options, 'cosetRepresentatives');
  const entry = r.entry;
  let gens = r.gens;
  options = r.options;

  const fwd = permStringToArrays(entry.cosets);
  const bwd = permStringToArrays(entry.invcos);
  if (!fwd.length || fwd.length !== bwd.length) {
    throw new ParseError('cosetRepresentatives: cosets and invcos disagree on the generator count');
  }
  const n = fwd[0].length;
  for (const block of fwd.concat(bwd)) {
    if (block.length !== n) throw new ParseError('cosetRepresentatives: permutation blocks differ in length');
  }
  if (!gens) gens = defaultNames(fwd.length);
  if (gens.length !== fwd.length) {
    throw new ParseError(`cosetRepresentatives: ${gens.length} generator names for ${fwd.length} permutation blocks`);
  }

  const reps = new Array(n).fill(null);
  reps[0] = { coset: 0, symbol: COSET_SYMBOLS[0], word: '1', letters: [], length: 0, via: null };
  // Breadth first, so every representative is a shortest word.  The queue
  // walks cosets in table order for a standardized table, which is how the
  // numbering arose in the first place.
  const queue = [0];
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi];
    for (let k = 0; k < fwd.length; k++) {
      for (const sign of [1, -1]) {
        const t = sign > 0 ? fwd[k][c] : bwd[k][c];
        if (reps[t]) continue;
        const letter = sign * (k + 1);
        const letters = reps[c].letters.concat([letter]);
        reps[t] = {
          coset: t,
          symbol: COSET_SYMBOLS[t],
          word: wordToString(letters, gens),
          letters,
          length: letters.length,
          via: { from: c, letter, gen: sign > 0 ? gens[k] : gens[k].toUpperCase() },
        };
        queue.push(t);
      }
    }
  }
  const missing = reps.findIndex(r => r === null);
  if (missing >= 0) {
    throw new ParseError(`cosetRepresentatives: coset ${missing} is unreachable — the permutations are not a transitive action`);
  }
  return reps;
}

/**
 * Look a subgroup up by its permutation string.
 *
 * Tries an exact match on `invcos` first (what SymmHub's Subgroups.js does),
 * then on `cosets`.  With { upToConjugacy: true } it falls back to comparing
 * canonical forms, which finds the class even when the caller's permutations
 * came from a different — but conjugate — representative, e.g. one of the
 * pre-generated GAP files.
 */
export function findByPermutations(data, permString, options = {}) {
  const target = normalizePerms(permString);
  if (!target) return null;
  for (const s of data.subgroups) {
    if (normalizePerms(s.invcos) === target || normalizePerms(s.cosets) === target) return s;
  }
  if (!options.upToConjugacy) return null;

  const perms = permStringToArrays(target);
  const n = perms[0].length;
  const nCols = 2 * perms.length;
  const tab = new Int32Array(n * nCols);
  for (let k = 0; k < perms.length; k++) {
    for (let c = 0; c < n; c++) {
      tab[c * nCols + 2 * k] = perms[k][c];
      tab[perms[k][c] * nCols + 2 * k + 1] = c;
    }
  }
  const wantFwd = canonicalForm(tab, n, nCols).join(',');
  // the caller may have handed us the inverse-generator block, so try both
  const flipped = new Int32Array(n * nCols);
  for (let i = 0; i < n * nCols; i++) flipped[i] = tab[(i - (i % nCols)) + invCol(i % nCols)];
  const wantBwd = canonicalForm(flipped, n, nCols).join(',');

  for (const s of data.subgroups) {
    if (s.index !== n) continue;
    const p = permStringToArrays(s.cosets);
    const t = new Int32Array(n * nCols);
    for (let k = 0; k < p.length; k++) {
      for (let c = 0; c < n; c++) {
        t[c * nCols + 2 * k] = p[k][c];
        t[p[k][c] * nCols + 2 * k + 1] = c;
      }
    }
    const key = canonicalForm(t, n, nCols).join(',');
    if (key === wantFwd || key === wantBwd) return s;
  }
  return null;
}

/**
 * Self-check: every relator must act trivially on the cosets, every
 * permutation must be a bijection, and invcos must invert cosets.
 * Returns an array of problem descriptions — empty means the data is sound.
 */
export function verifyData(data, presentation) {
  const pres = presentation || data.presentation;
  const problems = [];
  if (!pres) return ['no presentation available to verify against'];

  for (const s of data.subgroups) {
    const fwd = permStringToArrays(s.cosets);
    const bwd = permStringToArrays(s.invcos);
    const where = s.subgroup;
    if (fwd.length !== pres.gens.length) {
      problems.push(`${where}: ${fwd.length} permutation blocks for ${pres.gens.length} generators`);
      continue;
    }
    let bad = false;
    for (let k = 0; k < fwd.length; k++) {
      if (fwd[k].length !== s.index || bwd[k].length !== s.index) {
        problems.push(`${where}: block ${k} has the wrong length`); bad = true; break;
      }
      if (new Set(fwd[k]).size !== s.index) {
        problems.push(`${where}: block ${k} of cosets is not a permutation`); bad = true; break;
      }
      for (let c = 0; c < s.index; c++) {
        if (bwd[k][fwd[k][c]] !== c) {
          problems.push(`${where}: invcos block ${k} does not invert cosets`); bad = true; break;
        }
      }
      if (bad) break;
    }
    if (bad) continue;

    const apply = (c, x) => (x > 0 ? fwd[x - 1][c] : bwd[-x - 1][c]);
    for (let i = 0; i < pres.relators.length; i++) {
      const rel = pres.relators[i];
      for (let c = 0; c < s.index; c++) {
        let p = c;
        for (const x of rel) p = apply(p, x);
        if (p !== c) {
          problems.push(`${where}: relator ${pres.relStrings[i]} does not act trivially (coset ${c} -> ${p})`);
          break;
        }
      }
    }
    if (s.generators) {
      // 'gap' words are written right to left; undo that before applying them
      const reversed = (data.generatorMode || 'gap') === 'gap';
      for (const gw of s.generators.split(/\s+/).filter(Boolean)) {
        const letters = reversed ? gw.split('').reverse() : gw.split('');
        let p = 0;
        for (const ch of letters) {
          const lower = ch.toLowerCase();
          const k = pres.gens.indexOf(lower);
          if (k < 0) { problems.push(`${where}: unknown letter "${ch}" in generator "${gw}"`); p = -1; break; }
          p = apply(p, ch === lower ? k + 1 : -(k + 1));
        }
        if (p > 0) problems.push(`${where}: generator "${gw}" does not stabilize coset 0`);
      }
    }
  }
  return problems;
}

/* =========================================================================
 * Part 4: structure — telling subgroups apart by what they contain
 *
 * For a group given by an orbifold presentation — wallpaper groups, triangle
 * groups, crystallographic groups — every element of finite order is conjugate
 * to a power of one of the elliptic generators, and those are exactly the
 * relators that are proper powers: a^2, (c*a)^2, (a*b)^6, ...
 *
 * That makes torsion a question about the coset permutations alone.  H
 * contains a conjugate of u^j exactly when the permutation of u^j fixes a
 * coset, so an elliptic u of order n leaves H a cone point of order n/d for
 * every cycle of length d < n it has on the cosets — and H is torsion-free
 * exactly when every cycle of every elliptic generator has full length n.
 *
 * The caveat: this reads torsion off the given presentation.  For an arbitrary
 * finitely presented group, elements of finite order need not be conjugate
 * into the proper-power relators, and `torsionFree` then only means "free of
 * the torsion those relators name".
 * ======================================================================= */

/** A word that is a proper power u^n with n >= 2, else null. */
function asProperPower(word) {
  const w = cyclicReduce(word);
  const L = w.length;
  for (let d = 1; d < L; d++) {
    if (L % d) continue;
    let ok = true;
    for (let i = d; i < L; i++) if (w[i] !== w[i % d]) { ok = false; break; }
    if (ok) return { base: w.slice(0, d), order: L / d };
  }
  return null;
}

/**
 * The elliptic generators of a presentation: one entry per proper-power
 * relator, as { word, letters, order }.  These are the elements whose finite
 * order the structure analysis tests for; a presentation with none of them
 * (p1, pg, a free group) is already torsion-free.
 */
export function ellipticElements(pres) {
  const best = new Map();
  for (const rel of pres.relators) {
    const pp = asProperPower(rel);
    if (!pp || pp.order < 2) continue;
    const key = pp.base.join(',');
    const prev = best.get(key);
    if (!prev || pp.order < prev.order) best.set(key, pp);   // a^2 beats a^4
  }
  return [...best.values()].map(e => ({
    word: wordToString(e.base, pres.gens), letters: e.base, order: e.order,
  }));
}

/** The permutation a word induces on the cosets. */
function wordPermutation(letters, fwd, bwd) {
  const n = fwd[0].length, p = new Array(n);
  for (let c = 0; c < n; c++) {
    let x = c;
    for (const l of letters) x = l > 0 ? fwd[l - 1][x] : bwd[-l - 1][x];
    p[c] = x;
  }
  return p;
}

/**
 * What kind of subgroup is it?
 *
 *   subgroupStructure(data, '632.6.1')
 *   // { index: 6, torsionFree: false, orders: [2, 2, 2, 2],
 *   //   torsion: [ { order: 2, word: 'a', coset: 0, cycleLength: 1, ... }, ... ] }
 *
 * `torsion` lists the elliptic elements the subgroup keeps, one per conjugacy
 * class, each as an explicit word t·u^d·t⁻¹ in the parent generators, with the
 * order it has and the coset it is anchored at.  For an orientation-preserving
 * group these are exactly the cone points of the quotient orbifold; for a
 * reflection group the mirror generators are in there too, which is what you
 * want — a reflection is no more a translation than a rotation is.
 *
 * `orders` is just their orders, sorted, and `torsionFree` says the list is
 * empty: no elliptic elements, only translations, glides, or (in the
 * hyperbolic case) hyperbolic and loxodromic ones.
 *
 * When the parent dimension is known — it is for every catalogue preset — the
 * result also carries the abelianization and `translationsOnly`.  Ask for it
 * explicitly with { abelianization: true }; see abelianInvariants below.
 */
export function subgroupStructure(source, subgroup, options = {}) {
  const r = resolveSubgroup(source, subgroup, options, 'subgroupStructure');
  const entry = r.entry;
  options = r.options;
  const pres = options.presentation || (r.data ? presentationOf(r.data) : null);
  if (!pres) {
    throw new ParseError('subgroupStructure: pass the enumeration result, or a presentation in options');
  }
  const elliptics = options.elliptics || ellipticElements(pres);
  const fwd = permStringToArrays(entry.cosets);
  const bwd = permStringToArrays(entry.invcos);
  const reps = cosetRepresentatives(entry, { gens: pres.gens.join(' ') });

  const torsion = [];
  for (const e of elliptics) {
    const perm = wordPermutation(e.letters, fwd, bwd);
    const seen = new Array(perm.length).fill(false);
    for (let i = 0; i < perm.length; i++) {
      if (seen[i]) continue;
      let j = i, d = 0;
      do { seen[j] = true; j = perm[j]; d++; } while (j !== i);
      if (d === e.order) continue;              // full cycle: the cone point resolves
      const t = reps[i].letters;
      let letters = t.slice();
      for (let k = 0; k < d; k++) letters = letters.concat(e.letters);
      letters = freeReduce(letters.concat(invWord(t)));
      torsion.push({
        order: e.order / d,
        coset: i,
        cycleLength: d,
        from: { word: e.word, order: e.order },
        letters,
        word: wordToString(letters, pres.gens),
      });
    }
  }
  torsion.sort((a, b) => b.order - a.order || a.coset - b.coset);

  const out = {
    subgroup: entry.subgroup,
    index: entry.index,
    torsionFree: torsion.length === 0,
    orders: torsion.map(c => c.order).sort((a, b) => a - b),
    torsion,
    elliptics,
  };

  const dimension = options.dimension != null ? options.dimension
    : (r.data && r.data.dimension != null ? r.data.dimension : null);
  const wantAbelian = options.abelianization != null ? !!options.abelianization : dimension != null;
  if (wantAbelian) {
    out.abelianization = abelianInvariants(entry, { presentation: pres });
    if (dimension != null) {
      out.dimension = dimension;
      out.translationsOnly = out.torsionFree
        && out.abelianization.rank === dimension
        && out.abelianization.torsion.length === 0;
    }
  }
  return out;
}

/* --- Smith normal form over Z, for the abelianization -------------------- */
function smithNormalForm(A, cols) {
  const rows = A.length;
  const inv = [];
  let r = 0, c = 0;
  while (r < rows && c < cols) {
    let pi = -1, pj = -1, best = Infinity;
    for (let i = r; i < rows; i++) {
      for (let j = c; j < cols; j++) {
        const v = Math.abs(A[i][j]);
        if (v && v < best) { best = v; pi = i; pj = j; }
      }
    }
    if (pi < 0) break;                                   // the rest is zero
    [A[r], A[pi]] = [A[pi], A[r]];
    for (const row of A) [row[c], row[pj]] = [row[pj], row[c]];
    let cleared = false;
    while (!cleared) {
      cleared = true;
      for (let i = r + 1; i < rows; i++) {
        if (!A[i][c]) continue;
        const q = Math.trunc(A[i][c] / A[r][c]);
        for (let j = c; j < cols; j++) A[i][j] -= q * A[r][j];
        if (A[i][c]) { [A[r], A[i]] = [A[i], A[r]]; cleared = false; }
      }
      for (let j = c + 1; j < cols; j++) {
        if (!A[r][j]) continue;
        const q = Math.trunc(A[r][j] / A[r][c]);
        for (let i = r; i < rows; i++) A[i][j] -= q * A[i][c];
        if (A[r][j]) { for (const row of A) [row[c], row[j]] = [row[j], row[c]]; cleared = false; }
      }
    }
    inv.push(Math.abs(A[r][c]));
    r++; c++;
  }
  return inv;
}

/**
 * First homology of the subgroup — its abelianization — as
 * { rank, torsion, text }, e.g. { rank: 1, torsion: [2], text: 'Z^1 + Z/2' }.
 *
 * Computed by Reidemeister-Schreier: one generator per (coset, generator) with
 * the spanning-tree ones set to zero, one relation per (coset, relator), then
 * Smith normal form.  Nothing is needed beyond the coset permutations.
 *
 * For a crystallographic group of dimension n this settles what the abstract
 * subgroup is.  A finite-index subgroup consists of translations only exactly
 * when it is abelian, and — because the point group acts faithfully on the
 * lattice — that happens exactly when it is torsion-free and its homology is
 * free of full rank n.  In two dimensions the two torsion-free wallpaper
 * groups are told apart precisely here: the lattice p1 has Z^2, while pg, the
 * Klein-bottle group of glides, has Z + Z/2.
 */
export function abelianInvariants(source, subgroup, options = {}) {
  const r = resolveSubgroup(source, subgroup, options, 'abelianInvariants');
  const entry = r.entry;
  options = r.options;
  const pres = options.presentation || (r.data ? presentationOf(r.data) : null);
  if (!pres) {
    throw new ParseError('abelianInvariants: pass the enumeration result, or a presentation in options');
  }
  const fwd = permStringToArrays(entry.cosets);
  const bwd = permStringToArrays(entry.invcos);
  const n = fwd[0].length, g = fwd.length;
  const col = (c, k) => c * g + k;

  // spanning tree, the same walk cosetRepresentatives uses
  const seen = new Array(n).fill(false);
  seen[0] = true;
  const queue = [0], rows = [];
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi];
    for (let k = 0; k < g; k++) {
      for (const sign of [1, -1]) {
        const t = sign > 0 ? fwd[k][c] : bwd[k][c];
        if (seen[t]) continue;
        seen[t] = true;
        queue.push(t);
        const row = new Array(n * g).fill(0);
        row[sign > 0 ? col(c, k) : col(t, k)] = 1;    // that Schreier generator is trivial
        rows.push(row);
      }
    }
  }
  // one rewritten relator per coset
  for (const rel of pres.relators) {
    for (let c0 = 0; c0 < n; c0++) {
      const row = new Array(n * g).fill(0);
      let c = c0;
      for (const l of rel) {
        if (l > 0) { row[col(c, l - 1)] += 1; c = fwd[l - 1][c]; }
        else { c = bwd[-l - 1][c]; row[col(c, -l - 1)] -= 1; }
      }
      rows.push(row);
    }
  }

  const inv = smithNormalForm(rows, n * g);
  const torsion = inv.filter(d => d > 1);
  const rank = n * g - inv.length;
  const text = 'Z^' + rank + (torsion.length ? ' + ' + torsion.map(d => 'Z/' + d).join(' + ') : '');
  return { rank, torsion, text };
}
