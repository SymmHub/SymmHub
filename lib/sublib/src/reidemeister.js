/*
  reidemeister.js — Reidemeister-Schreier presentation of a subgroup.

  Given a parent presentation (generator count + relators as letter words,
  uppercase = inverse) and the coset permutations of a subgroup H, produce a
  presentation of H itself:

    generators:  the Schreier generators s(i,x) = t_i x t_{i.x}^-1 for the
                 non-tree edges of the coset graph (tree edges are trivial)
    relators:    every parent relator rewritten at every coset

  The transversal t_i comes from the same breadth first walk the
  SubgroupDomain builder (lib/grouplib/SubgroupDomain.js) uses (direct
  generators first, then inverses), so the combinatorics here and the
  geometry there agree.

  Words act left to right, matching the project convention.
*/

const CHAR_a = 'a'.charCodeAt(0);
const CHAR_A = 'A'.charCodeAt(0);

function invertPerm(perm){
  const inv = new Array(perm.length);
  perm.forEach((v, i) => inv[v] = i);
  return inv;
}

/** free reduction of a letter word (xX and Xx cancel) */
function freeReduce(word){
  const out = [];
  for(const ch of word){
    const last = out[out.length - 1];
    if(last !== undefined && last !== ch &&
       last.toLowerCase() === ch.toLowerCase()) out.pop();
    else out.push(ch);
  }
  return out.join('');
}

/**
  build the Reidemeister-Schreier presentation

  opt = {
    perms:    array of permutation arrays, one per parent generator
    relators: array of parent relator words ('aa', 'bbb', 'abababababab', ...)
  }

  return {
    gens:      'a b c ...'          Schreier generator names of H
    relators:  'w1, w2, ...'        relators of H over those names
    count:     number of generators
    schreier:  [{coset, parentGen, word}]   what each H generator is in the
               parent group (word = t_i x t_j^-1, freely reduced)
  }
*/
export function reidemeisterSchreier(opt){

  const perms = opt.perms;
  const k = perms.length;
  const n = perms[0].length;
  const invPerms = perms.map(invertPerm);

  // ---- breadth first transversal, direct generators first --------------

  const twords = new Array(n).fill(null);
  twords[0] = '';
  const order = [0];
  const treeEdge = new Set();                 // 'i:x' edges used by the tree
  for(let q = 0; q < order.length; q++){
    const i = order[q];
    for(let x = 0; x < k; x++){
      const j = perms[x][i];
      if(twords[j] === null){
        twords[j] = twords[i] + String.fromCharCode(CHAR_a + x);
        treeEdge.add(i + ':' + x);
        order.push(j);
      }
    }
    for(let x = 0; x < k; x++){
      const j = invPerms[x][i];
      if(twords[j] === null){
        twords[j] = twords[i] + String.fromCharCode(CHAR_A + x);
        treeEdge.add(j + ':' + x);            // tree uses edge j --x--> i
        order.push(j);
      }
    }
  }
  if(twords.some(w => w === null))
    throw new Error('reidemeisterSchreier: coset table is not transitive');

  // ---- Schreier generators for the non-tree edges ----------------------

  const genIndex = new Map();                 // 'i:x' -> generator number
  const schreier = [];
  for(let i = 0; i < n; i++){
    for(let x = 0; x < k; x++){
      if(treeEdge.has(i + ':' + x)) continue;
      const j = perms[x][i];
      const parentWord = freeReduce(
        twords[i] + String.fromCharCode(CHAR_a + x) + invertWord(twords[j]));
      genIndex.set(i + ':' + x, schreier.length);
      schreier.push({ coset: i, parentGen: String.fromCharCode(CHAR_a + x),
                      word: parentWord === '' ? 'e' : parentWord });
    }
  }
  const count = schreier.length;
  if(count > 26)
    throw new Error(`reidemeisterSchreier: ${count} generators exceed a-z naming`);

  const genChar = g => String.fromCharCode(CHAR_a + g);
  const invChar = g => String.fromCharCode(CHAR_A + g);

  // ---- rewrite every parent relator at every coset ----------------------

  const relators = [];
  for(const rel of opt.relators){
    for(let i = 0; i < n; i++){
      let c = i;
      let out = '';
      for(const ch of rel){
        const code = ch.charCodeAt(0);
        if(code >= CHAR_a){
          const x = code - CHAR_a;
          const key = c + ':' + x;
          if(!treeEdge.has(key)) out += genChar(genIndex.get(key));
          c = perms[x][c];
        } else {
          const x = code - CHAR_A;
          const cPrev = invPerms[x][c];
          const key = cPrev + ':' + x;
          if(!treeEdge.has(key)) out += invChar(genIndex.get(key));
          c = cPrev;
        }
      }
      if(c !== i)
        throw new Error(`reidemeisterSchreier: relator '${rel}' does not fix coset ${i}`);
      out = freeReduce(out);
      if(out.length > 0) relators.push(out);
    }
  }

  return {
    gens: Array.from({length: count}, (_, g) => genChar(g)).join(' '),
    relators: relators.join(', '),
    count,
    schreier,
  };
}

function invertWord(word){
  let out = '';
  for(let i = word.length - 1; i >= 0; i--){
    const ch = word[i];
    out += ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase();
  }
  return out;
}
