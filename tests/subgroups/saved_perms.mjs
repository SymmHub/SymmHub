/*
  the permutations saved in the shipped documents against the presentations of their
  groups, read with their own useOrbit: a presentation which changes the generators
  or their order shows up here. Group_WP and Group_KLM, which are the only makers with
  saved permutations.

    node tests/subgroups/saved_perms.mjs

  Layers which are not enabled hold many leftovers of earlier groups, and they are
  only counted. What an enabled layer draws must fit, but for the documents of KNOWN.
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Group_WP, Group_KLM, checkPermutations } from '../../lib/grouplib/modules.js';

const quiet = console.log;
console.log = () => {};
const say = (...a) => quiet(...a);

const APPS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps');

// fits nothing and is drawn: the relator a*d*b*d of XX does not hold, seams on the screen
const KNOWN = new Set(['wp_xx.json']);
// fewer than these and the walk below lost its way
const AT_LEAST = { Group_WP: 46, Group_KLM: 73 };

function jsonFiles(dir, found = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name !== 'node_modules' && e.name !== 'thumbnails') jsonFiles(p, found);
        } else if (e.name.endsWith('.json')) {
            found.push(p);
        }
    }
    return found;
}

function walk(o, visit) {
    if (Array.isArray(o)) o.forEach(x => walk(x, visit));
    else if (o && typeof o === 'object') {
        visit(o);
        for (const k in o) walk(o[k], visit);
    }
}

function presentationOf(maker) {
    if (maker.className === 'Group_WP') return new Group_WP(maker.params).getPresentation();
    if (maker.className === 'Group_KLM') {
        const klm = new Group_KLM({});
        Object.assign(klm.params, maker.params);
        return klm.getPresentation();
    }
    return undefined;   // a maker with no permutations saved
}

const tally = {};
const count = (key) => { tally[key] = (tally[key] || 0) + 1; };
const failed = [];

for (const file of jsonFiles(APPS)) {
    let doc;
    try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { continue; }

    let maker = null;
    walk(doc, o => { if (o.className && /^Group_/.test(o.className)) maker = o; });
    if (!maker) continue;
    const pres = presentationOf(maker);
    if (pres === undefined) continue;

    walk(doc, o => {
        if (typeof o.permutations !== 'string' || !o.permutations.trim()) return;
        count(`${maker.className} layers`);
        if (o.enabled === false) return;
        if (!pres) { count(`${maker.className} enabled, no presentation`); return; }
        const result = checkPermutations(pres, o.permutations, !!o.useOrbit);
        if (result.ok) {
            count(`${maker.className} enabled, fit`);
        } else {
            const name = path.basename(file);
            count(`${maker.className} enabled, do not fit`);
            if (!KNOWN.has(name)) failed.push(`${name}: ${result.reason}`);
        }
    });
}

for (const key of Object.keys(tally).sort()) say(`  ${key}: ${tally[key]}`);

let failures = failed.length;
for (const line of failed) say('  FAIL:', line);
for (const [maker, least] of Object.entries(AT_LEAST)) {
    if ((tally[`${maker} enabled, fit`] || 0) < least) {
        failures++;
        say(`  FAIL: fewer than ${least} layers of ${maker} which fit`);
    }
}

say(failures ? `\n${failures} FAILED` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
