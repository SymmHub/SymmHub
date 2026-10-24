/*
  check of the import structure of SymmHub's ES modules

    node tests/structure/imports.mjs            summary and violations
    node tests/structure/imports.mjs --files    also every file-level cycle
    node tests/structure/imports.mjs --direct   also every direct import

  Goals (Vladimir, 2026-10-24): no circular imports, no imports between apps,
  no direct imports of code files — imports go through aggregators
  (modules.js, the library modules lib/<name>/<name>.js, lib/sublib/src/sublib.js).
  Reported:
  1. imports from one app (apps/<name>) into another;
  2. imports from a library (lib/<name>) into an app;
  3. cycles between packages (lib/<name>, apps/<name>, tests/<name>);
  4. file-level cycles (strongly connected sets of files), with the number of
     them that pass through an aggregator;
  5. relative imports of files that do not exist;
  6. direct imports: inside a package, a code file importing a code file that
     is not an aggregator (shader sources *.glsl.mjs count as code files too);
     from another package, an import of anything but that package's public
     module (lib/<name>/<name>.js, lib/sublib/src/sublib.js), also when the
     importing file is an aggregator; split into imports from another package
     and inside one; tests are listed apart, since a test may import the file
     it tests, and so are the exceptions of ALLOWED_DIRECT, with their reasons.
     Exempt inside a package (counted only): imports of data modules (preset
     lists presets*.js and *_presets.js, apps/sympix/res/*, and modules that
     define no function or class and import nothing) and the vendored dat.gui
     source in lib/datgui (Vladimir, 2026-10-24).
  Exit code 1 when 1, 2, 3 or 5 has entries; file-level cycles are reported
  only, since the aggregator pattern (a file importing its own library's
  modules.js) makes them everywhere; direct imports are reported only, as
  many predate the rule (--direct lists them).

  The scan reads .js and .mjs files under apps, lib and tests (lib/extlib and
  *.bak skipped), drops comments (strings and template literals are kept, so
  shader sources do not confuse it) and collects the specifiers of static
  imports, re-exports and import('literal'). Bare and URL specifiers are
  ignored.
*/

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCAN = ['apps', 'lib', 'tests'];
const SKIP_DIRS = new Set(['extlib', 'node_modules', '.git']);

/** direct imports kept on purpose: imported file -> reason */
const ALLOWED_DIRECT = new Map([
  ['lib/symhublib/appendThumbnails.js',
   'the thumbnail pages import it through their app\'s appendThumbnails.js and must not load the whole symhublib'],
]);
const showFiles = process.argv.includes('--files');
const showDirect = process.argv.includes('--direct');

const rel = (p) => relative(ROOT, p).split(sep).join('/');

function listFiles(dir, out = []){
  for(const name of readdirSync(dir)){
    const p = join(dir, name);
    const st = statSync(p);
    if(st.isDirectory()){
      if(!SKIP_DIRS.has(name)) listFiles(p, out);
    } else if(/\.(m?js)$/.test(name)){
      out.push(p);
    }
  }
  return out;
}

/** source without comments; strings and template literals stay */
function stripComments(src){
  let out = '';
  let i = 0;
  const n = src.length;
  while(i < n){
    const c = src[i], d = src[i + 1];
    if(c === '/' && d === '/'){
      while(i < n && src[i] !== '\n') i++;
    } else if(c === '/' && d === '*'){
      i += 2;
      while(i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
    } else if(c === '"' || c === "'" || c === '`'){
      const q = c;
      out += c; i++;
      while(i < n && src[i] !== q){
        if(src[i] === '\\'){ out += src[i++]; }
        out += src[i++];
      }
      out += q; i++;
    } else {
      out += c; i++;
    }
  }
  return out;
}

const RE_FROM    = /\b(?:import|export)\s[^'"`;]*?\bfrom\s*(['"])([^'"]+)\1/g;
const RE_BARE    = /\bimport\s*(['"])([^'"]+)\1/g;
const RE_DYNAMIC = /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g;

function specifiers(src){
  const code = stripComments(src);
  const out = [];
  for(const re of [RE_FROM, RE_BARE, RE_DYNAMIC]){
    re.lastIndex = 0;
    let m;
    while((m = re.exec(code))) out.push(m[2]);
  }
  return out;
}

/** modules.js, lib/<name>/<name>.js, lib/sublib/src/sublib.js */
function isAggregator(relPath){
  const parts = relPath.split('/');
  const name = parts[parts.length - 1];
  return name === 'modules.js'
      || (parts[0] === 'lib' && parts.length === 3 && name === parts[1] + '.js')
      || relPath === 'lib/sublib/src/sublib.js';
}

/** a data module: a preset list, a sympix resource list, or a module of literals only */
const DATA_NAME = /(^|\/)presets[^/]*\.js$|_presets\.js$|^apps\/sympix\/res\//;
function isData(relPath){
  if(DATA_NAME.test(relPath)) return true;
  if(relPath.endsWith('.glsl.mjs')) return false;
  const code = stripComments(readFileSync(join(ROOT, relPath), 'utf8'))
                 .replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/gs, '""');
  return !/\bimport\b|\bfunction\b|\bclass\b|=>/.test(code);
}

/** packages whose sources are vendored as they are */
const VENDORED = new Set(['lib/datgui']);

/** lib/<name>/<name>.js, lib/sublib/src/sublib.js: what other packages import */
function isPublic(relPath){
  const parts = relPath.split('/');
  return (parts[0] === 'lib' && parts.length === 3 && parts[2] === parts[1] + '.js')
      || relPath === 'lib/sublib/src/sublib.js';
}

/** 'apps/sympix', 'lib/uilib', 'tests/uilib' */
function packageOf(relPath){
  const parts = relPath.split('/');
  return parts.length > 2 ? parts[0] + '/' + parts[1] : parts[0];
}

/** Tarjan's strongly connected components */
function stronglyConnected(nodes, edges){
  let index = 0;
  const idx = new Map(), low = new Map(), onStack = new Set(), stack = [], comps = [];
  function visit(v){
    idx.set(v, index); low.set(v, index); index++;
    stack.push(v); onStack.add(v);
    for(const w of edges.get(v) ?? []){
      if(!idx.has(w)){ visit(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if(onStack.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if(low.get(v) === idx.get(v)){
      const comp = [];
      let w;
      do { w = stack.pop(); onStack.delete(w); comp.push(w); } while(w !== v);
      comps.push(comp);
    }
  }
  for(const v of nodes) if(!idx.has(v)) visit(v);
  return comps;
}

const files = SCAN.filter(d => existsSync(join(ROOT, d)))
                  .flatMap(d => listFiles(join(ROOT, d)))
                  .filter(p => !p.endsWith('.bak'));

const fileEdges = new Map();
const pkgEdges = new Map();
const crossApp = [], libToApp = [], missing = [];
const directCross = [], directInside = [], directTests = [], directAllowed = [], directExempt = [];

for(const file of files){
  const from = rel(file);
  const deps = new Set();
  for(const spec of specifiers(readFileSync(file, 'utf8'))){
    if(!spec.startsWith('./') && !spec.startsWith('../')) continue;
    const target = resolve(dirname(file), spec.split(/[?#]/)[0]);
    const to = rel(target);
    if(!existsSync(target)){ missing.push(`${from} -> ${spec}`); continue; }
    if(!/\.(m?js)$/.test(to) || to.split('/').includes('extlib')) continue;
    deps.add(to);
    const pf = packageOf(from), pt = packageOf(to);
    const direct = pf !== pt ? !isPublic(to) : !isAggregator(from) && !isAggregator(to);
    if(direct){
      const line = `${from} -> ${to}`;
      if(pf.startsWith('tests')) directTests.push(line);
      else if(ALLOWED_DIRECT.has(to)) directAllowed.push(`${line}  (${ALLOWED_DIRECT.get(to)})`);
      else if(pf !== pt) directCross.push(line);
      else if(VENDORED.has(pf) || isData(to)) directExempt.push(line);
      else directInside.push(line);
    }
    if(pf !== pt){
      if(!pkgEdges.has(pf)) pkgEdges.set(pf, new Set());
      pkgEdges.get(pf).add(pt);
      if(pf.startsWith('apps/') && pt.startsWith('apps/')) crossApp.push(`${from} -> ${to}`);
      if(pf.startsWith('lib/') && pt.startsWith('apps/')) libToApp.push(`${from} -> ${to}`);
    }
  }
  fileEdges.set(from, deps);
}

const pkgCycles = stronglyConnected([...pkgEdges.keys()], pkgEdges).filter(c => c.length > 1);
const fileCycles = stronglyConnected([...fileEdges.keys()], fileEdges)
  .filter(c => c.length > 1 || (fileEdges.get(c[0])?.has(c[0])));
const viaAggregator = fileCycles.filter(c => c.some(isAggregator)).length;

function section(title, list){
  console.log(`${title}: ${list.length}`);
  for(const s of list) console.log('  ' + s);
}

console.log(`${files.length} files scanned`);
console.log('package dependencies:');
for(const [p, ts] of [...pkgEdges].sort()) console.log(`  ${p} -> ${[...ts].sort().join(', ')}`);
section('imports between apps', crossApp);
section('library imports of apps', libToApp);
section('package cycles', pkgCycles.map(c => c.sort().join(' <-> ')));
section('missing relative imports', missing);
console.log(`file-level cycles: ${fileCycles.length} (${viaAggregator} through an aggregator)`);
if(showFiles) for(const c of fileCycles) console.log('  ' + c.sort().join(' | '));
console.log(`direct imports: ${directCross.length} from another package, `
          + `${directInside.length} inside a package, ${directTests.length} in tests, `
          + `${directAllowed.length} allowed, ${directExempt.length} exempt (data modules, lib/datgui)`);
if(showDirect){
  for(const [title, list] of [['from another package', directCross],
                              ['inside a package', directInside], ['in tests', directTests],
                              ['allowed', directAllowed], ['exempt', directExempt]]){
    console.log(`  ${title}:`);
    for(const s of list) console.log('    ' + s);
  }
}

const failed = crossApp.length + libToApp.length + pkgCycles.length + missing.length > 0;
process.exit(failed ? 1 : 0);
