#!/usr/bin/env node
/* sublib command line: enumerate subgroups and write color_groups JSON.
 *
 *   sublib wallpaper:2222 --max-index 24 --max-subgroups 1000 -o sub_2222.json
 *   sublib klm:237 --max-index 20
 *   sublib --gens "a b c" --relators "a^2, b^3, (a*b)^7" --name 237
 *   sublib --all wallpaper --outdir ./color_groups/wallpaper
 *   sublib --all klm --max-digit 8 --outdir ./color_groups/klm
 *
 * With no -o the JSON goes to stdout; --summary prints counts instead.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  subgroupsData, getPreset, wallpaperPresentation, klmPresentation, sklmPresentation,
  WALLPAPER_NAMES, fileStem, verifyData, cosetRepresentatives,
} from '../src/sublib.js';

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log(`sublib — subgroup enumeration for finitely presented groups

  sublib <preset> [options]
  sublib --gens "a b c" --relators "a^2, b^3, (a*b)^7" [--name N] [options]
  sublib --all <wallpaper|klm|sklm> --outdir DIR [options]

presets   wallpaper:2222  (or just 2222)   klm:237   sklm:*237
options
  --max-index N        largest index to search              (default 24)
  --max-subgroups N    budget: stop at the last index that fits (default 0 = no budget)
  --name NAME          label for the "name" field and subgroup ids
  --generators MODE    gap (default) | natural | none
  --max-digit D        --all klm/sklm: highest triangle order (default 8)
  --deadline MS        abort the search after MS milliseconds
  -o, --out FILE       write JSON here instead of stdout
  --outdir DIR         --all: directory for sub_*.json + groups.json
  --summary            print index/count summary instead of JSON
  --reps ID            print the right-coset representatives of one subgroup
                       (its id, e.g. 632.6.1, or its position in the list)
  --verify             run the self-check and report problems
  --pretty             2-space indented JSON (default: same as GAP's exporter)`);
  process.exit(0);
}

const flag = (...names) => {
  for (const n of names) {
    const i = argv.indexOf(n);
    if (i >= 0) return argv[i + 1];
  }
  return undefined;
};
const has = (...names) => names.some(n => argv.includes(n));

const maxIndex = Number(flag('--max-index') || 24);
const maxSubgroups = Number(flag('--max-subgroups') || 0);
const generators = flag('--generators') || 'gap';
const deadlineMs = flag('--deadline') ? Number(flag('--deadline')) : undefined;
const summary = has('--summary');
const verify = has('--verify');
const pretty = has('--pretty');

function emit(data, file) {
  const json = JSON.stringify(data, null, 2) + (pretty ? '\n' : '\n');
  if (file) { writeFileSync(file, json, 'utf8'); return; }
  process.stdout.write(json);
}

function report(data) {
  const line = data.countPerIndex.map(o => `${o.index}:${o.count}`).join(' ');
  console.log(`${data.name}  maxIndex=${data.maxIndex}  total=${data.totalCount}` +
    (data.nextIndex ? `  (next index ${data.nextIndex} would add ${data.nextIndexCount})` : '') +
    `  ${data.stats.elapsedMs}ms`);
  console.log(`  ${line}`);
}

function runOne(spec) {
  const data = subgroupsData({ ...spec, maxIndex, maxSubgroups, generators, deadlineMs });
  if (data.stats.aborted) {
    console.error(`warning: search for ${data.name} was aborted (deadline or table limit) — output is incomplete`);
  }
  if (verify) {
    const problems = verifyData(data);
    if (problems.length) {
      console.error(`verify: ${problems.length} problem(s) in ${data.name}`);
      for (const p of problems.slice(0, 10)) console.error(`  ${p}`);
    } else {
      console.error(`verify: ${data.name} ok (${data.totalCount} subgroups)`);
    }
  }
  return data;
}

const allFamily = flag('--all');
if (allFamily) {
  const outdir = flag('--outdir');
  if (!outdir) { console.error('--all needs --outdir'); process.exit(1); }
  mkdirSync(outdir, { recursive: true });
  const maxDigit = Number(flag('--max-digit') || 8);

  let specs;
  if (allFamily === 'wallpaper') {
    specs = WALLPAPER_NAMES.map(n => wallpaperPresentation(n));
  } else if (allFamily === 'klm' || allFamily === 'sklm') {
    const make = allFamily === 'klm' ? klmPresentation : sklmPresentation;
    specs = [];
    for (let k = 2; k <= maxDigit; k++) {
      for (let l = 2; l <= maxDigit; l++) {
        for (let m = 2; m <= maxDigit; m++) specs.push(make(k, l, m));
      }
    }
  } else {
    console.error(`unknown family "${allFamily}" (wallpaper | klm | sklm)`);
    process.exit(1);
  }

  const manifest = [];
  for (const spec of specs) {
    const data = runOne(spec);
    const file = `sub_${fileStem(spec.name)}.json`;
    emit(data, join(outdir, file));
    manifest.push({ name: String(data.name), file });
    report(data);
  }
  manifest.sort((a, b) => {
    const na = a.name.split(/[\s_]+/).map(Number), nb = b.name.split(/[\s_]+/).map(Number);
    for (let i = 0; i < Math.max(na.length, nb.length); i++) {
      const x = isNaN(na[i]) ? 0 : na[i], y = isNaN(nb[i]) ? 0 : nb[i];
      if (x !== y) return x - y;
    }
    return a.name.localeCompare(b.name);
  });
  writeFileSync(join(outdir, 'groups.json'), JSON.stringify({ groups: manifest }, null, 2), 'utf8');
  console.error(`\nwrote ${specs.length} files + groups.json to ${outdir}`);
  process.exit(0);
}

let spec;
const gens = flag('--gens');
if (gens) {
  spec = { gens, relators: flag('--relators') || '', name: flag('--name') || 'G' };
} else {
  const presetKey = argv.find(a => !a.startsWith('-') && argv[argv.indexOf(a) - 1]?.startsWith('-') !== true);
  if (!presetKey) { console.error('give a preset, or --gens/--relators'); process.exit(1); }
  spec = getPreset(presetKey);
  if (flag('--name')) spec = { ...spec, name: flag('--name') };
}

const data = runOne(spec);
const repsOf = flag('--reps');
if (repsOf !== undefined) {
  const id = /^\d+$/.test(repsOf) ? Number(repsOf) : repsOf;
  const entry = typeof id === 'number' ? data.subgroups[id] : data.subgroups.find(s => s.subgroup === id);
  if (!entry) { console.error(`no subgroup "${repsOf}" — ids look like ${data.subgroups[1]?.subgroup}`); process.exit(1); }
  console.log(`${entry.subgroup}  index ${entry.index}  cosets ${entry.cosets}`);
  for (const r of cosetRepresentatives(data, entry)) {
    console.log(`  ${r.symbol}  ${String(r.coset).padStart(3)}  ${r.word.padEnd(16)}` +
      (r.via ? `= ${r.via.gen} applied to coset ${r.via.from}` : '= identity'));
  }
} else if (summary) report(data);
else emit(data, flag('-o', '--out'));
