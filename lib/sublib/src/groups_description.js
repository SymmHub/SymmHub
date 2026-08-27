/* ============================================================================
 * groups_description.js — the group catalogue
 *
 * Presentations for the families the sympix viewer ships coset tables for.
 * They are the ones in SymmHub's gap/groups_wp.g and gap/groups_klm.g, kept
 * character for character, so that sublib reproduces the shipped
 * color_groups files rather than an equivalent-but-different enumeration.
 *
 * A preset is a plain object { name, family, gens, relators }, ready to hand
 * to subgroupsData().  Nothing here computes anything.
 * ========================================================================== */

import { ParseError } from './sublib_core.js';

const WP = {
  'o':      { gens: 'a b c d', relators: 'a*b, c*d, a*c*b*d' },
  '2222':   { gens: 'a b c d', relators: 'a^2, b^2, c*d, (c*a)^2, (c*b)^2' },
  '**':     { gens: 'a b c d', relators: 'a^2, b^2, c*d, a*c*a*d, a*d*a*c, b*c*b*d, b*d*b*c' },
  'xx':     { gens: 'a b c d', relators: 'a*b, c*d, a*d*b*d, a*c*b*c, b*d*a*d, b*c*a*c' },
  '*x':     { gens: 'a b c d', relators: 'c^2, d^2, a*b, a*c*b*d, b*c*a*d' },
  '*2222':  { gens: 'a b c d', relators: 'a^2, b^2, c^2, d^2, (a*c)^2, (c*b)^2, (b*d)^2, (d*a)^2' },
  '22*':    { gens: 'a b c d', relators: 'a^2, b^2, c^2, d^2, (a*c*a*d), (b*c*b*d)' },
  '22x':    { gens: 'a b c d', relators: 'a*b, c*d, (b*c)^2, (b*d)^2, (a*c)^2, (a*d)^2' },
  '2*22':   { gens: 'a b c d', relators: 'a^2, b^2, c^2, d^2, (a*c)^2, (a*d)^2, (b*c*b*d), (b*d*b*c)' },
  '442':    { gens: 'a b c',   relators: 'a^2, c*b, b^4, (a*b)^4' },
  '*442':   { gens: 'a b c',   relators: 'a^2, b^2, c^2, (a*b)^2, (a*c)^4, (b*c)^4' },
  '4*2':    { gens: 'a b c',   relators: 'a^2, b^4, b*c, (c*a*b*a)^2' },
  '333':    { gens: 'a b c d', relators: 'a^3, b^3, a*c, b*d, (a*d)^3' },
  '*333':   { gens: 'a b c',   relators: 'a^2, b^2, c^2, (a*b)^3, (b*c)^3, (c*a)^3' },
  '3*3':    { gens: 'a b c',   relators: 'a^2, b^3, b*c, (c*a*b*a)^3'},
  '632':    { gens: 'a b c',   relators: 'a^2, b^3, (a*b)^6, b*c' },
  '*632':   { gens: 'a b c',   relators: 'a^2, b^2, c^2, (a*b)^2, (b*c)^3, (c*a)^6' },
};

/** File-name stem used by the color_groups layout ("*2222" -> "s2222"). */
export function fileStem(name) {
  return String(name).replace(/\*/g, 's');
}

/* Listed explicitly, in the order of groups_wp.g: JavaScript would otherwise
 * sort the integer-like keys ("333", "2222") ahead of the rest. */
export const WALLPAPER_NAMES = [
  'o', '2222', '**', 'xx', '*x', '*2222', '22*', '22x', '2*22',
  '442', '*442', '4*2', '333', '*333', '3*3', '632', '*632',
];

export function wallpaperPresentation(orbifold) {
  const key = { 'O': 'o', 'XX': 'xx', 'x*': '*x', 'X*': '*x', '*X': '*x', '22X': '22x' }[orbifold] || orbifold;
  const p = WP[key];
  if (!p) throw new ParseError(`unknown wallpaper group "${orbifold}"`);
  return { name: key, family: 'wallpaper', ...p };
}

/** klm — the orientation-preserving triangle group (k,l,m), GAP's groups_klm.g. */
export function klmPresentation(k, l, m) {
  return {
    name: `${k}${l}${m}`,
    family: 'klm',
    gens: 'a b c d',
    relators: `a*c, b*d, a^${k}, b^${l}, (a*d)^${m}`,
  };
}

/** *klm — the full (reflection) triangle group. */
export function sklmPresentation(k, l, m) {
  return {
    name: `*${k}${l}${m}`,
    family: 'sklm',
    gens: 'a b c',
    relators: `a^2, b^2, c^2, (a*b)^${k}, (c*a)^${l}, (b*c)^${m}`,
  };
}

/**
 * All presets by key: "wallpaper:2222", "klm:237", "sklm:*237".
 * Wallpaper groups are additionally reachable by their bare orbifold symbol.
 */
export function getPreset(key) {
  const s = String(key);
  const colon = s.indexOf(':');
  const family = colon < 0 ? null : s.slice(0, colon);
  const rest = colon < 0 ? s : s.slice(colon + 1);
  if (family === null || family === 'wallpaper') return wallpaperPresentation(rest);
  if (family === 'klm' || family === 'sklm') {
    const digits = rest.replace(/^\*/, '');
    if (!/^\d{3}$/.test(digits)) throw new ParseError(`"${key}": expected three digits, got "${rest}"`);
    const [k, l, m] = digits.split('').map(Number);
    return family === 'klm' ? klmPresentation(k, l, m) : sklmPresentation(k, l, m);
  }
  throw new ParseError(`unknown preset family "${family}"`);
}

/** The 17 wallpaper presets by orbifold symbol; klm/*klm come from getPreset. */
export const PRESETS = Object.fromEntries(
  WALLPAPER_NAMES.map(n => [n, wallpaperPresentation(n)]));
