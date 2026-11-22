/*
  check that SymRenderer's core stays unaware of its UI
  (docs/symrenderer_refactor_plan.md section 8, from phase 4c on)

    node tests/structure/core_ui.mjs

  1. lib/symhublib/SymRenderer.js imports no name that symhublib's modules.js
     exports from ui/, tools/ or panels/, and no file of those folders directly:
     the page passes its UI builder (options.ui), the builder gives the tools;
  2. no file in ui/, tools/ or panels/ imports SymRenderer: they get the host.
  Exit code 1 when either has entries.
*/

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const LIB = join(ROOT, 'lib/symhublib');
const UI_FOLDERS = ['ui', 'tools', 'panels'];
const UI_PATH = new RegExp(`(^|/)(${UI_FOLDERS.join('|')})/`);

/** source without comments; strings and template literals stay */
function stripComments(src) {
    let out = '';
    let i = 0;
    while (i < src.length) {
        const c = src[i], d = src[i + 1];
        if (c === '/' && d === '/') {
            while (i < src.length && src[i] !== '\n') i++;
        } else if (c === '/' && d === '*') {
            i += 2;
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i += 2;
        } else if (c === '"' || c === "'" || c === '`') {
            let j = i + 1;
            while (j < src.length && src[j] !== c) j += (src[j] === '\\') ? 2 : 1;
            out += src.slice(i, j + 1);
            i = j + 1;
        } else {
            out += c;
            i++;
        }
    }
    return out;
}

/** the names in `{ a, b as c }`: the names the module exports or imports (a, b) */
function namesOf(list) {
    return list.split(',').map(s => s.trim()).filter(Boolean).map(s => s.split(/\s+as\s+/)[0].trim());
}

/** [{names, from}] of the file's `import {…} from` and `export {…} from` */
function bindings(src, keyword) {
    const out = [];
    const re = new RegExp(`\\b${keyword}\\s*\\{([^}]*)\\}\\s*from\\s*['"]([^'"]+)['"]`, 'g');
    let m;
    while ((m = re.exec(src))) out.push({ names: namesOf(m[1]), from: m[2] });
    return out;
}

/** every specifier the file imports or re-exports, also import('…') */
function specifiers(src) {
    const out = [];
    const re = /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(src))) out.push(m[1] || m[2] || m[3]);
    return out;
}

function listFiles(dir, out = []) {
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) listFiles(p, out);
        else if (/\.m?js$/.test(name)) out.push(p);
    }
    return out;
}

const read = (p) => stripComments(readFileSync(p, 'utf8'));
const problems = [];

// the names symhublib's modules.js gives from the UI folders
const uiNames = new Map();
for (const { names, from } of bindings(read(join(LIB, 'modules.js')), 'export')) {
    if (UI_PATH.test(from.replace(/^\.\//, ''))) names.forEach(n => uiNames.set(n, from));
}

// 1. the core
const core = read(join(LIB, 'SymRenderer.js'));
for (const { names } of bindings(core, 'import')) {
    for (const n of names) {
        if (uiNames.has(n)) problems.push(`SymRenderer.js imports ${n} (${uiNames.get(n)})`);
    }
}
for (const s of specifiers(core)) {
    if (UI_PATH.test(s.replace(/^\.\//, ''))) problems.push(`SymRenderer.js imports the file ${s}`);
}

// 2. the UI folders
let uiFiles = 0;
for (const folder of UI_FOLDERS) {
    for (const p of listFiles(join(LIB, folder))) {
        uiFiles++;
        const src = read(p);
        const rel = p.slice(LIB.length + 1).split('\\').join('/');
        for (const { names } of bindings(src, 'import')) {
            if (names.includes('SymRenderer')) problems.push(`${rel} imports SymRenderer`);
        }
        for (const s of specifiers(src)) {
            if (/SymRenderer\.js$/.test(s)) problems.push(`${rel} imports the file ${s}`);
        }
    }
}

console.log(`names from ${UI_FOLDERS.join('/, ')}/: ${uiNames.size}; files there: ${uiFiles}`);
if (problems.length) {
    problems.forEach(p => console.log('  ' + p));
    console.log(`core and UI: ${problems.length} problem(s)`);
    process.exit(1);
}
console.log('core and UI: apart');
