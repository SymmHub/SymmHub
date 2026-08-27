/* ============================================================================
 * sublib.js — the public interface
 *
 * Subgroup enumeration for finitely presented groups.  Given a presentation it
 * enumerates the conjugacy classes of subgroups of index <= maxIndex and
 * returns, for each one, the permutations that the parent generators induce on
 * the cosets — in the JSON shape used by SymmHub's
 * apps/sympix/color_groups/<family>/sub_<name>.json files.
 *
 *   import { subgroupsData } from './sublib/src/sublib.js';
 *   const data = subgroupsData({ preset: 'wallpaper:2222', maxIndex: 24, maxSubgroups: 1000 });
 *
 * This module is the whole supported surface.  The engine lives in
 * sublib_core.js and the group catalogue in groups_description.js; import
 * those directly only to reach past this interface, and expect them to move.
 * ========================================================================== */

import {
  ParseError,
  makePresentation,
  subgroupClasses,
  subgroupsData as enumerateSubgroups,
  canonicalForm,
  COSET_SYMBOLS,
  MAX_COSETS,
  permStringToArrays,
  permArraysToString,
  findByPermutations,
  cosetRepresentatives,
  verifyData,
} from './sublib_core.js';

import {
  PRESETS,
  WALLPAPER_NAMES,
  getPreset,
  wallpaperPresentation,
  klmPresentation,
  sklmPresentation,
  fileStem,
} from './groups_description.js';

/**
 * Enumerate subgroups and return the color_groups JSON object.
 *
 * spec:
 *   preset        a catalogue key — 'wallpaper:2222', 'klm:237', 'sklm:*237',
 *                 or a bare orbifold symbol — instead of gens/relators
 *   name          label for the "name" field and the subgroup ids
 *   gens          'a b c' (or an array of names)      -- or pass `presentation`
 *   relators      'a^2, b^3, b*c' (or an array)
 *   presentation  a makePresentation() result, instead of gens/relators
 *   maxIndex      largest index to search (default 24)
 *   maxSubgroups  budget; 0/omitted means "no budget", search to maxIndex
 *   deadlineMs    abort the search after this long (default Infinity)
 *   maxTables     abort after this many subgroups have been accepted
 *   generators    'gap' (default, reversed words) | 'natural' | 'none'
 *
 * Anything given explicitly wins over the preset, so
 * `{ preset: 'klm:237', name: 'hurwitz' }` relabels the same group.
 *
 * Returns { name, group, relators, maxIndex, nextIndex, nextIndexCount,
 *           totalCount, countPerIndex, subgroups: [...] }, plus non-enumerable
 * `stats`, `presentation` and `generatorMode` properties.
 */
export function subgroupsData(spec = {}) {
  if (!spec.preset) return enumerateSubgroups(spec);
  return enumerateSubgroups({ ...getPreset(spec.preset), ...spec });
}

export {
  // presentations
  makePresentation,
  ParseError,
  // enumeration
  subgroupClasses,
  // the group catalogue
  PRESETS,
  WALLPAPER_NAMES,
  getPreset,
  wallpaperPresentation,
  klmPresentation,
  sklmPresentation,
  fileStem,
  // the wire format
  COSET_SYMBOLS,
  MAX_COSETS,
  permStringToArrays,
  permArraysToString,
  // working with results
  findByPermutations,
  cosetRepresentatives,
  canonicalForm,
  verifyData,
};

export default {
  subgroupsData, subgroupClasses, makePresentation, ParseError,
  PRESETS, WALLPAPER_NAMES, getPreset, fileStem,
  wallpaperPresentation, klmPresentation, sklmPresentation,
  COSET_SYMBOLS, MAX_COSETS, permStringToArrays, permArraysToString,
  findByPermutations, cosetRepresentatives, canonicalForm, verifyData,
};
