import { Group } from '../invlib/invlib.js';
import { iWallpaperGroup } from './WallpaperGroups.js';
import { computeFrame, subgroupKey, subgroupClassKey } from './SubgroupKey.js';
import {
  subgroupsData,
  subgroupStructure,
  presentationOf,
  permStringToArrays,
  reidemeisterSchreier,
  getPreset,
  WALLPAPER_NAMES,
} from '../sublib/src/sublib.js';

const MYNAME = 'SubgroupNames';
const DEBUG = false;

/*
  SubgroupNames.js — the display names of the subgroups of a group, the way
  the colour group catalogue (250117_colorsym/catalog, tools/make_manifest.mjs)
  names them:

      G/H[n]#k

  G is the orbifold name of the parent group, H the wallpaper type of the
  subgroup, n its index and #k its ordinal among the subgroups of the same
  type and index (omitted when it is alone there).

  The type is an isomorphism invariant of the subgroup, read off a
  Reidemeister-Schreier presentation of it: the number of subgroup classes it
  has at each index up to GROWTH_DEPTH together with its first homology
  (sublib's subgroupStructure), compared with the same fingerprint of the 17
  wallpaper groups.  Growth to depth 6 leaves three ambiguous pairs; homology
  splits two of them (** vs 22*, *x vs 22x) and depth 7 the last (3*3 vs 632).

  The ordinal sorts the bucket by the geometric key of SubgroupKey.js, which is
  computed for the group in a canonical geometry (iWallpaperGroup with a = 0.5,
  the catalogue's), so the names do not depend on the lattice parameters of the
  document.  The key used is the key of the conjugacy class
  (subgroupClassKey: the least key over the conjugates), so the names survive
  a change of the fundamental domain: another domain shape gives other coset
  tables, standing for other placements of the same subgroups, but the same
  class keys.  The catalogue manifests were regenerated with the class key
  on 2026-09-05; before that they sorted by the key of the representative
  (subgroupKey), which makeSubgroupNamer({classInvariant: false}) still
  gives, and tests/subgroups/catalog_names.mjs shows where the two orders
  differ.

  Only wallpaper groups get catalogue names; for any other group the sublib ids
  ('237.3.1') are the names.  The work is done lazily per index, the first time
  a name of that index is asked for: about 10 to 50 ms per subgroup.
*/

// depth of the subgroup growth fingerprint, as in the catalogue
const GROWTH_DEPTH = 8;

// geometry the keys are computed in, as in the catalogue
const GEOMETRY_A = 0.5;

// ---------------------------------------------------------------------------
// the fingerprint of a wallpaper type
// ---------------------------------------------------------------------------

/**
  primary decomposition of a torsion list: [6] and [2,3] both become [2,3],
  so differently spelled but isomorphic homology gives the same key
*/
function primaryTorsion(torsion){
  const out = [];
  for(let t of torsion){
    for(let p = 2; p * p <= t; p++){
      while(t % p === 0){
        let q = p;
        while(t % (q * p) === 0) q *= p;
        out.push(q);
        t /= q;
      }
    }
    if(t > 1) out.push(t);
  }
  return out.sort((x, y) => x - y);
}

function growthVector(d){
  const v = new Array(GROWTH_DEPTH).fill(0);
  for(const e of d.countPerIndex) if(e.index <= GROWTH_DEPTH) v[e.index - 1] = e.count;
  return v;
}

function fingerprintKey(growth, abelianization){
  return JSON.stringify([growth, abelianization.rank, primaryTorsion(abelianization.torsion)]);
}

let gReferenceFingerprints = null;

/** fingerprint -> wallpaper type, for the 17 wallpaper groups (computed once, ~50 ms) */
export function wallpaperFingerprints(){
  if(gReferenceFingerprints) return gReferenceFingerprints;
  const ref = new Map();
  for(const name of WALLPAPER_NAMES){
    const d = subgroupsData({ preset: 'wallpaper:' + name, maxIndex: GROWTH_DEPTH, generators: 'none' });
    const st = subgroupStructure(d, d.subgroups[0].subgroup, { abelianization: true });
    const key = fingerprintKey(growthVector(d), st.abelianization);
    if(ref.has(key))
      throw new Error(`${MYNAME}: reference fingerprints collide: ${ref.get(key)} vs ${name}`);
    ref.set(key, name);
  }
  gReferenceFingerprints = ref;
  return ref;
}

/** relators of a sublib presentation as letter words: [1,1] -> 'aa', [-2] -> 'B' */
function relatorWords(pres){
  return pres.relators.map(rel => rel.map(x => x > 0
    ? String.fromCharCode(96 + x)
    : String.fromCharCode(64 - x)).join(''));
}

/**
  the wallpaper type of the subgroup with the given entry of a subgroupsData()
  result, or null when the fingerprint is not one of the 17

  opt = { data, entry, presentation (of the parent, sublib form), relators (letter words) }
*/
export function classifySubgroupType(opt){
  const perms = permStringToArrays(opt.entry.cosets);
  const st = subgroupStructure(opt.data, opt.entry, { abelianization: true, presentation: opt.presentation });
  let rs;
  try {
    rs = reidemeisterSchreier({ perms, relators: opt.relators });
  } catch(e){
    if(DEBUG) console.log(`${MYNAME}: reidemeister failed for ${opt.entry.subgroup}: ${e.message}`);
    return null;
  }
  const sd = subgroupsData({ name: 'h', gens: rs.gens, relators: rs.relators,
                             maxIndex: GROWTH_DEPTH, generators: 'none' });
  const key = fingerprintKey(growthVector(sd), st.abelianization);
  return wallpaperFingerprints().get(key) || null;
}

// ---------------------------------------------------------------------------
// spellings
// ---------------------------------------------------------------------------

/** sublib's spelling of a wallpaper group name ('22X' -> '22x'), null when it is not one */
export function wallpaperNameOf(name){
  if(!name) return null;
  try {
    const p = getPreset('wallpaper:' + name);
    return (p && p.family === 'wallpaper') ? p.name : null;
  } catch(e){
    return null;
  }
}

/** grouplib's spelling of a wallpaper group name ('22x' -> '22X') */
export function grouplibWallpaperName(name){
  return name.replace(/x/g, 'X').replace(/^o$/, 'O');
}

/**
  order of the names in a list: by the name up to the ordinal, as text, then
  by the ordinal as a number (632/2222[3] before 632/632[3], #2 before #10)
*/
export function compareSubgroupNames(a, b){
  const [na, ka] = String(a).split('#');
  const [nb, kb] = String(b).split('#');
  if(na !== nb) return na < nb ? -1 : 1;
  return (parseInt(ka, 10) || 0) - (parseInt(kb, 10) || 0);
}

// ---------------------------------------------------------------------------
// the namer
// ---------------------------------------------------------------------------

/**
  names for the subgroups of a subgroupsData() result

  opt = {
    data:         the subgroupsData() result the names are for
    presentation: the parent's presentation as SymRenderer's getGroupPresentation()
                  gives it: {name, domainShape, preset?, gens?, relators?}; optional
    family:       'wallpaper' | 'klm' | '*klm' ...  alternative to presentation
    name:         group name, alternative to presentation.name
    classInvariant: sort by the key of the conjugacy class (default true), or by
                  the key of the representative as the catalogue manifests do
  }

  return {
    isCatalogue:      true when the catalogue naming applies (a wallpaper group)
    groupName:        the G of the names
    nameOf(entry):    the name of a subgroup entry (or id); the sublib id when the
                      catalogue naming does not apply
    entryByName(str): the entry with that name, or that id; null when unknown
    infoOf(entry):    {name, type, key} of an entry (type and key null outside the catalogue)
  }
*/
export function makeSubgroupNamer(opt){

  const data = opt.data;
  const pres = opt.presentation || null;
  const rawName = (pres && pres.name) || opt.name || (data && data.name) || '';
  const family = opt.family || (pres && pres.preset ? String(pres.preset).split(':')[0] : null);

  const wpName = (family === null || family === 'wallpaper') ? wallpaperNameOf(rawName) : null;
  const classInvariant = opt.classInvariant !== false;

  // the parent presentation: the one the table was computed from, or rebuilt
  // from the GAP strings of a table read from a file; without it no types
  let mParentPres = null;
  try {
    mParentPres = (data && Array.isArray(data.subgroups)) ? presentationOf(data) : null;
  } catch(e){
    if(DEBUG) console.log(`${MYNAME}: no presentation for the table of ${rawName}: ${e.message}`);
  }
  const isCatalogue = !!(wpName && mParentPres);

  const byId = new Map();      // sublib id -> info
  const byName = new Map();    // name -> entry
  const done = new Set();      // indices named so far

  let mGroup = null, mFrame = null, mRelators = null;
  let mPrepared = false;

  /** the canonical geometry and the parent relators, once */
  function prepare(){
    if(mPrepared) return;
    mPrepared = true;
    mRelators = relatorWords(mParentPres);
    try {
      const gname = grouplibWallpaperName(wpName);
      const group = new Group(iWallpaperGroup({ name: gname, a: GEOMETRY_A,
                                                domainShape: pres ? pres.domainShape : undefined }));
      const genCount = mParentPres.gens.length;
      if(group.getFundDomain().length !== genCount){
        console.warn(`${MYNAME}: ${wpName}: ${group.getFundDomain().length} sides but ${genCount} generators, no geometric keys`);
      } else {
        mGroup = group;
        mFrame = computeFrame(group);
      }
    } catch(e){
      console.warn(`${MYNAME}: no canonical geometry for ${wpName}: ${e.message}`);
      mGroup = null;
    }
  }

  function typeOf(entry){
    if(!mRelators) return null;
    try {
      return classifySubgroupType({ data, entry, presentation: mParentPres, relators: mRelators });
    } catch(e){
      if(DEBUG) console.log(`${MYNAME}: no type for ${entry.subgroup}: ${e.message}`);
      return null;
    }
  }

  function keyOf(entry){
    if(!mGroup) return null;
    try {
      const arg = { group: mGroup, frame: mFrame, cosets: entry.cosets };
      return (classInvariant ? subgroupClassKey(arg) : subgroupKey(arg)).key;
    } catch(e){
      if(DEBUG) console.log(`${MYNAME}: no key for ${entry.subgroup}: ${e.message}`);
      return null;
    }
  }

  /** name every subgroup of the index: the buckets need all of them */
  function ensureIndex(index){
    if(done.has(index)) return;
    done.add(index);
    prepare();
    const t0 = Date.now();
    const infos = data.subgroups.filter(s => s.index === index)
      .map(entry => ({ entry, type: typeOf(entry), key: keyOf(entry), name: null }));
    const buckets = new Map();
    for(const info of infos){
      const b = info.type || '?';
      if(!buckets.has(b)) buckets.set(b, []);
      buckets.get(b).push(info);
    }
    for(const [type, arr] of buckets){
      // the ordinal: the bucket sorted by the geometric key, as the catalogue does it
      arr.sort((p, q) => (p.key || p.entry.cosets) < (q.key || q.entry.cosets) ? -1 : 1);
      arr.forEach((info, i) => {
        info.name = `${wpName}/${type}[${index}]` + (arr.length > 1 ? '#' + (i + 1) : '');
      });
    }
    for(const info of infos){
      byId.set(info.entry.subgroup, info);
      byName.set(info.name, info.entry);
    }
    if(DEBUG) console.log(`${MYNAME}: ${wpName} index ${index}: ${infos.length} names in ${Date.now() - t0}ms`);
  }

  function entryOf(entryOrId){
    if(entryOrId && typeof entryOrId === 'object') return entryOrId;
    return data.subgroups.find(s => String(s.subgroup) === String(entryOrId)) || null;
  }

  function infoOf(entryOrId){
    const entry = entryOf(entryOrId);
    if(!entry) return null;
    if(!isCatalogue) return { name: String(entry.subgroup), type: null, key: null };
    ensureIndex(entry.index);
    const info = byId.get(entry.subgroup);
    return info ? { name: info.name, type: info.type, key: info.key }
                : { name: String(entry.subgroup), type: null, key: null };
  }

  function nameOf(entryOrId){
    const info = infoOf(entryOrId);
    return info ? info.name : String(entryOrId);
  }

  /** the entry with the given catalogue name, or with the given sublib id */
  function entryByName(str){
    if(!str) return null;
    if(isCatalogue){
      // G/H[n]#k: the index is in the brackets, so only that index has to be named
      const m = /\[(\d+)\]/.exec(str);
      if(m){
        ensureIndex(Number(m[1]));
        const e = byName.get(str);
        if(e) return e;
      }
    }
    return entryOf(str);
  }

  return {
    isCatalogue,
    groupName: wpName || rawName,
    nameOf,
    entryByName,
    infoOf,
  };
}
