# sublib

Standalone subgroup enumeration for finitely presented groups. Give it a
presentation; it returns the conjugacy classes of subgroups of index ≤ *n*,
each one described by the permutations its parent generators induce on the
cosets — in the JSON shape that SymmHub's
`apps/sympix/color_groups/<family>/sub_<name>.json` files use.

No dependencies, no GAP, no build step. Plain ES modules that run in a browser
or in node.

```js
import { subgroupsData } from './sublib/src/sublib.js';

const data = subgroupsData({
  name: '2222',
  gens: 'a b c d',
  relators: 'a^2, b^2, c*d, (c*a)^2, (c*b)^2',
  maxIndex: 24,
  maxSubgroups: 1000,
});

data.subgroups[1];
// { subgroup: '2222.2.1', index: 2, generators: 'a b CC',
//   cosets: 'ab ab ba ba', invcos: 'ab ab ba ba' }
```

Presets cover the 17 wallpaper groups and the `klm` / `*klm` triangle groups:

```js
subgroupsData({ preset: 'wallpaper:*632', maxIndex: 24 });
subgroupsData({ preset: 'klm:237',        maxIndex: 24, maxSubgroups: 300 });
```

## Install and layout

Copy the folder and `import` from `src/sublib.js` — from a page, from node, or
through a bundler. There is nothing to build and nothing to install.

In this repo the pieces live at:

| file | |
| --- | --- |
| `lib/sublib/src/sublib.js` | **the public interface** — import this, and only this |
| `lib/sublib/src/sublib_core.js` | the engine: parsing, the coset-table search, classes, the wire format. Knows no particular group |
| `lib/sublib/src/groups_description.js` | the catalogue: wallpaper, `klm` and `*klm` presentations, verbatim from the GAP sources. Computes nothing |
| `lib/sublib/bin/sublib.mjs` | command line |
| `apps/groups/index.html` | interactive page |
| `tests/sublib/` | the two suites below |

The two inner modules are reachable — nothing is hidden — but only what
`src/sublib.js` re-exports is the supported surface; the rest may move.

## Command line

```bash
node lib/sublib/bin/sublib.mjs wallpaper:2222 --max-index 24 --max-subgroups 1000 -o sub_2222.json
node lib/sublib/bin/sublib.mjs klm:237 --summary
node lib/sublib/bin/sublib.mjs --gens "a b" --relators "a^2, b^3, (a*b)^7" --name 237 --verify
node lib/sublib/bin/sublib.mjs --all wallpaper --outdir ./out/wallpaper   # 17 files + groups.json
node lib/sublib/bin/sublib.mjs --all klm --max-digit 8 --outdir ./out/klm # 343 files + groups.json
```

`--all` also writes the `groups.json` manifest, sorted exactly the way
SymmHub's `generate_manifests.js` sorts it.

## Demo

Open `apps/groups/index.html` through whatever serves the SymmHub tree — pick
a group, enumerate, inspect the permutations, download the JSON. (A server is
needed only because browsers refuse ES-module imports over `file://`.)

## Output format

`subgroupsData()` returns exactly the object the JSON files hold:

| field | meaning |
| --- | --- |
| `name` | group label, e.g. `2222`, `*237` |
| `group` | `Group( [ a, b, c, d ] )` — GAP's printed form |
| `relators` | `[ a^2, b^2, c*d, (c*a)^2, (c*b)^2 ]` |
| `maxIndex` | largest index actually enumerated |
| `nextIndex` | first index dropped for budget, else `null` |
| `nextIndexCount` | how many subgroups that index would have added |
| `totalCount` | number of subgroups reported |
| `countPerIndex` | `[{index, count}, …]`, indices with no subgroups omitted |
| `subgroups` | `[{subgroup, index, generators, cosets, invcos}, …]` |

**`cosets` and `invcos`** are the payload. Each is a space-separated list of
blocks, one block per generator of the parent group, in the order the
generators are declared. A block has one character per coset: the character at
position *i* names the coset that coset *i* is mapped to. `cosets` holds the
generators, `invcos` their inverses. Cosets are named from the 62-symbol
alphabet `a…z A…Z 0…9`, so coset 0 is `a` and the maximum index is 62.

So for `2222.2.1` above, index 2: generators *a* and *b* fix both cosets
(`ab` = identity), *c* and *d* swap them (`ba`).

```js
import { permStringToArrays } from './src/sublib.js';
permStringToArrays('ab ab ba ba');   // [[0,1],[0,1],[1,0]] — 0-based arrays
```

**`generators`** are words in the parent generators that generate the
subgroup, uppercase meaning inverse, written in reversed letter order — the
convention of the GAP exporter that produced the shipped files. These are
Schreier generators: correct, but not Tietze-simplified the way GAP's are, so
they are longer and more numerous than the words in the pre-generated files.
Pass `generators: 'natural'` for un-reversed words, or `generators: 'none'` to
skip them (a small speedup, and the field is unused by the sympix viewer).

**Subgroup ids** are `<name>.<index>.<k>`, with `k` numbering from 1 within
each index.

## Coset representatives, and fundamental domains

`cosetRepresentatives(data, id)` returns the N elements of a transversal of a
subgroup of index N — one representative per right coset, as words in the
parent generators, the first of them the identity:

```js
const data = subgroupsData({ preset: 'wallpaper:632', maxIndex: 12 });
cosetRepresentatives(data, '632.6.1').map(r => r.word);
// [ '1', 'b', 'B', 'Ba', 'Bab', 'BaB' ]
```

Each entry is `{ coset, symbol, word, letters, length, via }`. `letters` is the
word as signed generator numbers (`+k` / `-k`, 1-based) and `word` the same as
text, uppercase meaning inverse — **read left to right**, so
`'Bab'` is *b*⁻¹·*a*·*b*. (The `generators` field of a subgroup reads the other
way round; that reversal is the GAP exporter's, and it stops here.)

This is what turns a fundamental domain for the group into one for the
subgroup. If *F* is a fundamental domain for *G* acting on the left, then

&nbsp;&nbsp;&nbsp;&nbsp;*G* = *H t*₀ ⊔ … ⊔ *H t*<sub>N−1</sub>&nbsp;&nbsp;⟹&nbsp;&nbsp;*D* = *t*₀·*F* ∪ … ∪ *t*<sub>N−1</sub>·*F*

is a fundamental domain for *H* — N copies of the group's tile, one per coset.

Rather than evaluate each word from scratch, build the tiles in order and use
`via`, which names the single generator that reaches a coset from one already
built:

```js
const T = new Array(reps.length);
T[0] = identityTransform();
for (const r of reps.slice(1)) T[r.coset] = compose(T[r.via.from], transformOf(r.via.gen));
```

Coset numbering is the table's own, so `reps[i]` matches position *i* of every
permutation block in `cosets` — apply generator *g* to the tile of coset *i*
and you land on the tile of coset `permStringToArrays(s.cosets)[g][i]`.

**Canonical in what sense.** The words come from a breadth-first walk of the
coset table in its own scan order — cosets in numerical order, and within a
coset the columns *g*₁, *g*₁⁻¹, *g*₂, *g*₂⁻¹, … — so each *t*ᵢ is a *shortest*
word reaching coset *i*, and the first such word in that column order. Being
shortest they are freely reduced, and the set is prefix-closed (a Schreier
transversal): every prefix of a representative is itself a representative,
which is what makes the `via` construction above possible. Since the table
sublib hands out is the canonical one for its conjugacy class, the transversal
depends only on the subgroup, not on how the search happened to find it.

Shortest words also mean compact fundamental domains: the tiles cluster around
the group's own tile instead of straggling.

From the command line:

```bash
node lib/sublib/bin/sublib.mjs wallpaper:632 --max-index 12 --reps 632.6.1
```

## Using it from SymmHub's `Subgroups.js`

`apps/sympix/js/Subgroups.js` fetches a JSON file and hands it to
`parseSubgroupsData(data, name, preferredSubgroup)`. sublib produces the same
object, so computing replaces fetching:

```js
import { subgroupsData, getPreset } from '../../lib/sublib/src/sublib.js';

// instead of: const data = await (await fetch(url)).json();
const data = subgroupsData({ ...getPreset('wallpaper:2222'), maxIndex: 24, maxSubgroups: 1000 });
parseSubgroupsData(data, 'sublib:wallpaper:2222', preferredSubgroup);
```

Everything downstream — the index chips built from `countPerIndex`, the
subgroup list, the `normalizePerms(s.invcos) === parentPerms` lookup — works
unchanged.

For the `invcos` lookup specifically, `findByPermutations(data, perms,
{ upToConjugacy: true })` is more forgiving than an exact string compare: it
finds the class even when the permutations came from a different (conjugate)
representative, such as one of the pre-generated files.

## Compatibility with the GAP-generated files

sublib is checked file by file against the corpus GAP produced
(`apps/sympix/color_groups`: 17 `wallpaper` files, 343 `klm`, 343 `*klm`). For
every one of the 703 it recomputes the enumeration from the presentation
recorded in that file and compares. **All 703 pass.**

- **`countPerIndex`, `maxIndex`, `nextIndex`, `nextIndexCount`, `totalCount`:
  identical everywhere.** The budget walk that decides how far to enumerate
  reproduces GAP's `findMaxIndex` exactly.
- **The subgroups are the same subgroups.** Every subgroup in every GAP file
  is in exactly one of sublib's classes, matched by canonical form — i.e. the
  two enumerations agree as sets of conjugacy classes.
- **Coset permutations agree verbatim for 97% of the corpus' 110 524
  subgroups** — 4847/4847 in `wallpaper`, 54 691/54 691 in `*klm`, and
  47 739/50 986 in `klm`. Where they differ,
  sublib and GAP picked different representatives of the same class, so the
  two permutation sets are relabelings of each other. sublib picks the
  lexicographically least standardized table, which is canonical and
  independent of search order; GAP returns whichever representative its
  backtrack happened to accept.
- **The `.k` numbering is sublib's own.** GAP's within-index order comes from
  its search order passed through an unstable sort, and is not reproducible;
  sublib sorts by canonical table. So `2222.6.13` may name a different
  subgroup than it does in the shipped file. Match on permutations, not on
  ids, when both sources are in play.

Run it yourself:

```bash
node tests/sublib/validate-corpus.mjs --family wallpaper    # 17 files, ~2 s
node tests/sublib/validate-corpus.mjs --family sklm         # 343 files, ~4 min
node tests/sublib/validate-corpus.mjs --family klm          # 343 files, ~25 min
node tests/sublib/validate-corpus.mjs /path/to/color_groups --sample 20
```

Progress is written to stderr, one line per file, so a long sweep can be
watched or piped to a log.

`node tests/sublib/smoke.mjs` needs no corpus. It checks σ(n) for ℤ², Marshall Hall's
subgroup counts for the free group of rank 2, GAP's published class counts for
the (2,3,7) and \*283 triangle groups, the 62-symbol alphabet, the budget walk,
and the lookup helpers.

## Performance

Single-threaded, on the corpus presentations to index 24: the 17 wallpaper
groups take 5–290 ms each (`2222`, the largest at 999 subgroups, is 290 ms).
Triangle groups are the expensive end — most `*klm` groups are under a second,
while the hardest `klm` ones, `775` and its relatives, take around 30 s. The
whole 703-file corpus revalidates in about half an hour.

Two things do the work. The search prunes non-canonical branches as it goes
(see below), so it builds one table per conjugacy class instead of one per
subgroup — 3–8× fewer search nodes on the corpus presentations. And with a
`maxSubgroups` budget it climbs one index at a time and stops as soon as the
budget is spent, rather than enumerating to `maxIndex` and discarding the
excess; on `klm:346` that is 32 ms instead of 14 s.

Schreier generators are computed only for representatives, and each table is
reduced to its class as it is found, so memory tracks the number of classes
rather than the number of subgroups.

Everything runs synchronously on the calling thread. For interactive use,
bound it with `deadlineMs` — the result then carries `data.stats.aborted ===
true` and is incomplete — or run the module in a Worker. `maxTables` bounds
the search by number of tables accepted instead.

## How it works

A Sims-style low-index backtrack over coset tables: extend a partial table at
its first undefined entry, propagate the consequences of every relator, and
record each table that comes out complete on ≤ `maxIndex` cosets. Complete
standardized tables are in bijection with the subgroups of index ≤ `maxIndex`,
and restandardizing one from a different base point gives the table of a
conjugate subgroup — so the least table over all base points identifies the
conjugacy class, which is what GAP's `LowIndexSubgroupsFpGroup` returns.

Rather than build every subgroup and group them afterwards, the search carries
Sims' canonicity test: at each node it compares the table with its
restandardizations and abandons the branch as soon as one of them is strictly
smaller over the entries defined so far. A prefix that already loses still
loses however it is completed, so nothing canonical is ever discarded, and
what survives to completion is exactly one table per class — the same
representative the post-hoc grouping would have chosen. The class size is then
recovered from the representative alone, as the number of distinct
restandardizations.

Pass `prune: false` to `subgroupClasses` to switch the test off and enumerate
every subgroup instead; the classes that come out are identical, which is
what the `prune`/`no prune` equivalence test in the smoke suite checks.

The coset-table conventions match GAP's: cosets are numbered in the order
they are first reached, scanning rows in order and, within a row, columns in
the order *g*₁, *g*₁⁻¹, *g*₂, *g*₂⁻¹, … (lenlex standardization). That is why
the permutation strings agree verbatim rather than merely up to relabeling.

`verifyData(data)` re-checks a result from scratch: every block a permutation,
`invcos` inverting `cosets`, every relator acting trivially, every listed
generator word stabilizing coset 0.

## API

Everything `src/sublib.js` exports, and nothing else:

| export | |
| --- | --- |
| `subgroupsData(spec)` | enumerate; returns the color_groups object |
| `subgroupClasses(pres, maxIndex, opts)` | lower level: `{classes, stats}` with raw tables |
| `makePresentation(gens, relators)` | parse `'a b c'` + `'a^2, b^3, (a*b)^6'` |
| `ParseError` | what bad generator, relator or preset input throws |
| `getPreset(key)` | `'wallpaper:2222'`, `'klm:237'`, `'sklm:*237'`, or a bare orbifold |
| `PRESETS`, `WALLPAPER_NAMES` | the 17 wallpaper presets |
| `wallpaperPresentation`, `klmPresentation`, `sklmPresentation` | preset builders |
| `fileStem(name)` | `'*2222'` → `'s2222'`, the color_groups file naming |
| `COSET_SYMBOLS`, `MAX_COSETS` | the 62-symbol coset alphabet |
| `permStringToArrays`, `permArraysToString` | wire format ⇄ 0-based arrays |
| `findByPermutations(data, perms, opts)` | look a subgroup up by its permutations |
| `cosetRepresentatives(data, id)` | a transversal of the right cosets, as words |
| `canonicalForm(tab, n, nCols)` | the table that identifies a conjugacy class |
| `verifyData(data, pres?)` | self-check; returns an array of problems |

The word helpers, the coset-table primitives (`standardize`,
`schreierGenerators`, `cosetAction`, `tableToPermStrings`) and the search class
stay inside `src/sublib_core.js`.

Relator syntax: juxtaposition or `*`, `^n` with negative `n` allowed,
parentheses, `[a,b]` for the commutator *a*⁻¹*b*⁻¹*ab*, uppercase for
inverses, and `u = v` for a relation. Generators are single lowercase letters.

## Provenance

The low-index engine is derived from the `LowIndex` engine of
[wieting-subgroups](https://github.com/yaroslavvb/wieting-subgroups), reduced
to the one engine this library needs and given the color_groups format layer.
The presentations in `src/groups_description.js` are those in SymmHub's
`apps/sympix/gap/groups_wp.g` and `groups_klm.g`, so that sublib reproduces
the shipped files. One of them, `3*3`, carries a `WRONG` comment in the GAP
source; sublib keeps it verbatim (see the `note` on that preset) rather than
silently substituting a different group.
