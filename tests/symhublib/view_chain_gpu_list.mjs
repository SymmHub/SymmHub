/*
  the values for tests/symhublib/view_chain_gpu.html: the different projections of the
  documents under apps/ (the json files), each with the window of the canvas of the
  first document that has it

    node tests/symhublib/view_chain_gpu_list.mjs

  writes tests/symhublib/test-out/chain_values.json (git-ignored):
    [{ file, centre: [x, y], zoom, projection: {the params of the document's projection} }]
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../apps/', import.meta.url));
const out = fileURLToPath(new URL('./test-out/chain_values.json', import.meta.url));

const files = [];
(function walk(dir){
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'test-out') walk(p); }
        else if (e.name.endsWith('.json')) files.push(p);
    }
})(root);

const seen = new Map();
let docs = 0;
for (const f of files.sort()) {
    let data;
    try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
    const tr = data && data.params && data.params.tools && data.params.tools.transform;
    const tp = tr ? (tr.params || tr) : null;
    const pr = tp && tp.projection ? (tp.projection.params || tp.projection) : null;
    if (!pr || typeof pr !== 'object') continue;
    docs++;
    const key = JSON.stringify(pr);
    if (seen.has(key)) continue;
    const e = tp.euclidean || {};
    seen.set(key, { file: path.relative(root, f).replace(/\\/g, '/'),
                    centre: [Number(e.centerX) || 0, Number(e.centerY) || 0], zoom: Number(e.zoom) || 1, projection: pr });
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify([...seen.values()]));
console.log(`${docs} documents with a projection, ${seen.size} different ones written to ${path.relative(process.cwd(), out)}`);
