/*
  catalog_driver.js — ScriptAPI driver for batch rendering catalog layers.

  Loaded by catalog_render.html.  Exposes window.catalog with helpers to load a
  preset, patch parameters, render at an explicit size and POST the PNG to the
  dev server's /save endpoint, which writes into the colorsym catalog tree.

  A job is a plain object:

    {
      outDir: '632/3/632-632-3/gen',
      size:   800,
      preset: '/catalog/presets/wp_632_632_3.1.json',   // template for all items
      view:   { zoom: 0.45, centerX: 0, centerY: 0 },   // same framing for all
      items: [
        { file:   'group_pattern.png',
          preset: '...',        // optional per item template
          params: { ... },      // nested patch handed to api.setParams
          layers: { arrows: { permIndex: 1, useOrbit: false },
                    overlay: { tiling: { outline: { enabled: true } } } },
          enable: { arrows: true, overlay: false }   // layer on/off shorthand
        }, ...
      ]
    }

  Run one with:   await catalog.runJob(jobObject)
              or  await catalog.runJobUrl('/catalog/jobs/632_632_3.json')
              or  open the page with ?job=<url>
*/

export default function catalogDriver(api) {

    const canvas = () => document.querySelector('canvas.layeredCanvas') ||
                         document.querySelector('canvas');

    // catalog images are square; 800 matches the hand built entry's PNGs
    const DEFAULT_SIZE = 800;

    // presets carry a texture sidecar, so give each load a moment to settle
    const SETTLE_MS = 1600;

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function listParams(path) {
        let node = api.getParams();
        if (path) {
            for (const part of path.split('.')) {
                node = node && (node[part] !== undefined ? node[part]
                              : (node.params ? node.params[part] : undefined));
                if (node === undefined) return 'no node at ' + part;
            }
        }
        return Object.keys(node);
    }

    /**
     * Walk a nested plain object against a live params tree, calling setValue()
     * at the leaves.  Layer params are not reachable through the ScriptAPI dot
     * paths, so this is how per layer settings get applied.
     * Returns the paths that had no matching param, for reporting.
     */
    function applyParams(params, values, trail = '') {
        const missing = [];
        for (const key of Object.keys(values)) {
            const target = params[key];
            const value = values[key];
            if (target === undefined) { missing.push(trail + key); continue; }
            if (value !== null && typeof value === 'object' && !Array.isArray(value)
                && typeof target.setValue !== 'function') {
                missing.push(...applyParams(target, value, trail + key + '.'));
            } else if (typeof target.setValue === 'function') {
                target.setValue(value);
            } else {
                missing.push(trail + key);
            }
        }
        return missing;
    }

    // ── Subgroup as a group of its own ───────────────────────────────────────
    //
    //  Build H from the current wallpaper group plus a coset table, and install
    //  it as the renderer's group.  Everything that consumes a group then works
    //  on H: the overlay's fundamental domain, its tiling, and its pairing
    //  transforms.  setSubgroup(null) puts G back.

    let mGroupLib = null;
    async function groupLib() {
        if (!mGroupLib) {
            const [sd, wp, inv] = await Promise.all([
                import('/lib/grouplib/SubgroupDomain.js'),
                import('/lib/grouplib/WallpaperGroups.js'),
                import('/lib/invlib/invlib.js'),
            ]);
            mGroupLib = { ...sd, ...wp, Group: inv.Group };
        }
        return mGroupLib;
    }

    /**
     * Install the subgroup with the given coset table as the rendered group.
     * @param {string|null} cosets  e.g. 'acb bca cab'; null restores G
     * @returns {Promise<object>}   a short description of what was installed
     */
    async function setSubgroup(cosets) {
        if (!cosets) {
            api.setGroupOverride(null);
            return { group: 'G (override cleared)' };
        }
        const lib = await groupLib();
        // rebuild G from its parameters rather than reading the live group, so
        // the symmetry transform is applied once, by the renderer, not twice
        const gp = api.getParams().symmetry.group.params;
        const G = new lib.Group(lib.iWallpaperGroup({
            name: gp.type, a: gp.a, b: gp.b, c: gp.c,
            angle_a: (gp.angle_a || 0) * Math.PI / 180,
            angle_b: (gp.angle_b === undefined ? 90 : gp.angle_b) * Math.PI / 180,
        }));
        const H = lib.makeSubgroupGroup({ group: G, cosets });
        api.setGroupOverride(H);
        const dom = H.subgroupDomain;
        return {
            parent: gp.type,
            index: dom.n,
            sides: H.getFundDomain().length,
            generators: dom.generators.map(gi => dom.pairings[gi].word),
            isometries: dom.generators.map(gi => lib.isometryToString(dom.pairings[gi].isometry)),
        };
    }

    /** set params on one visualization layer, addressed by its layer id */
    function setLayer(id, values) {
        const layer = api.getVisualization(id);
        if (!layer) return ['layer "' + id + '" not found'];
        return applyParams(layer.getParams(), values).map(m => id + '.' + m);
    }

    /**
     * Render at an explicit pixel size and POST the PNG to the dev server.
     * @param {string} relPath  path under the catalog root
     * @param {object} [opt]    {size} or {width, height}; defaults to 800x800
     */
    async function save(relPath, opt = {}) {
        const width  = opt.width  || opt.size || DEFAULT_SIZE;
        const height = opt.height || opt.size || DEFAULT_SIZE;
        const cnv = api.renderToCanvas(width, height);
        const blob = await new Promise(r => cnv.toBlob(r, 'image/png'));
        const resp = await fetch('/save?path=' + encodeURIComponent(relPath),
                                 { method: 'POST', body: blob });
        const out = await resp.json();
        return { ...out, width, height };
    }

    /**
     * Apply one configuration block: subgroup selection, param patch, layer
     * enables and layer params.  Returns the params that had no match.
     */
    async function applyConfig(cfg) {
        const missing = [];
        if (cfg.subgroup !== undefined) await setSubgroup(cfg.subgroup);
        if (cfg.params) api.setParams(cfg.params);
        if (cfg.enable)
            for (const [id, on] of Object.entries(cfg.enable))
                missing.push(...setLayer(id, { enabled: on }));
        if (cfg.layers)
            for (const [id, values] of Object.entries(cfg.layers))
                missing.push(...setLayer(id, values));
        return missing;
    }

    /**
     * Render several configurations and stack them into a single image, in the
     * order given.  This is how the catalog's images have always been built:
     * one geometric fact per layer, composited.  Each entry may carry
     * {opacity} to fade its contribution.
     *
     * @returns {HTMLCanvasElement}
     */
    async function composeCanvas(configs, width, height) {
        const out = document.createElement('canvas');
        out.width = width; out.height = height;
        const ctx = out.getContext('2d');
        const missing = [];
        for (const cfg of configs) {
            missing.push(...await applyConfig(cfg));
            const layer = api.renderToCanvas(width, height);
            ctx.globalAlpha = (cfg.opacity === undefined) ? 1 : cfg.opacity;
            ctx.drawImage(layer, 0, 0);
        }
        ctx.globalAlpha = 1;
        return { canvas: out, missing };
    }

    // -- Subgroup geometry, drawn as vectors ---------------------------------
    //
    //  The reduction algorithm needs a convex fundamental domain, and the union
    //  of coset cells usually is not one.  So H's geometry is never handed to
    //  the reducer: G stays the group, and H's domain, tiling and markers are
    //  drawn as plain 2d vectors from the SubgroupDomain data - the transversal
    //  cells (a union of copies of G's domain), the boundary sides, and the
    //  H-translates of the whole union.  Non convex unions come for free.

    const geoCache = new Map();

    async function subgroupGeo(cosets) {
        const gp = api.getParams().symmetry.group.params;
        const cacheKey = JSON.stringify([gp.type, gp.a, gp.b, gp.c, cosets]);
        if (geoCache.has(cacheKey)) return geoCache.get(cacheKey);

        const lib = await groupLib();
        const inv = await import('/lib/invlib/invlib.js');
        const G = new lib.Group(lib.iWallpaperGroup({
            name: gp.type, a: gp.a, b: gp.b, c: gp.c,
            angle_a: (gp.angle_a || 0) * Math.PI / 180,
            angle_b: (gp.angle_b === undefined ? 90 : gp.angle_b) * Math.PI / 180,
        }));
        const apply = (it, v) => {
            const p = it.transform(inv.iPoint([v[0], v[1], 0, 0]));
            return [p.v[0], p.v[1]];
        };

        // vertices of G's (convex) fundamental domain, ordered around it
        const fd = G.getFundDomain();
        const EPS = 1e-7;
        const verts = [];
        for (let i = 0; i < fd.length; i++) {
            for (let j = i + 1; j < fd.length; j++) {
                const [a1, b1, d1] = [fd[i].v[0], fd[i].v[1], fd[i].v[3]];
                const [a2, b2, d2] = [fd[j].v[0], fd[j].v[1], fd[j].v[3]];
                // splane planes: signed distance = n.p - d  (see iDistanceU4)
                const det = a1 * b2 - a2 * b1;
                if (Math.abs(det) < EPS) continue;
                const x = (d1 * b2 - d2 * b1) / det;
                const y = (a1 * d2 - a2 * d1) / det;
                if (fd.every(sp => sp.v[0] * x + sp.v[1] * y - sp.v[3] <= 1e-6))
                    verts.push([x, y]);
            }
        }
        const cx = verts.reduce((s2, v) => s2 + v[0], 0) / verts.length;
        const cy = verts.reduce((s2, v) => s2 + v[1], 0) / verts.length;
        verts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));

        // label each polygon edge with the fundamental domain side it lies on
        const edges = verts.map((v, i) => {
            const w = verts[(i + 1) % verts.length];
            const mx = (v[0] + w[0]) / 2, my = (v[1] + w[1]) / 2;
            let side = 0, best = 1e9;
            fd.forEach((sp, k) => {
                const d = Math.abs(sp.v[0] * mx + sp.v[1] * my - sp.v[3]);
                if (d < best) { best = d; side = k; }
            });
            return { a: v, b: w, side };
        });

        const dom = lib.buildSubgroupDomain({ group: G, cosets, checkConvex: false });
        const cells = dom.cells.map(c => ({
            coset: c.coset,
            word: c.word,
            itrans: c.itrans,
            poly: verts.map(v => apply(c.itrans, v)),
        }));
        const boundary = dom.sides.filter(sd => sd.kind === 'boundary').map(sd => {
            const cell = dom.cells[sd.cell];
            const e = edges.find(ed => ed.side === sd.side);
            return { a: apply(cell.itrans, e.a), b: apply(cell.itrans, e.b) };
        });

        const xs = cells.flatMap(c => c.poly.map(q => q[0]));
        const ys = cells.flatMap(c => c.poly.map(q => q[1]));
        const bbox = { x0: Math.min(...xs), x1: Math.max(...xs),
                       y0: Math.min(...ys), y1: Math.max(...ys) };
        const center = [(bbox.x0 + bbox.x1) / 2, (bbox.y0 + bbox.y1) / 2];
        const diam = Math.hypot(bbox.x1 - bbox.x0, bbox.y1 - bbox.y0);

        // H's pairing generators, for enumerating the translates of the domain
        const gens = dom.generators.map(gi => dom.pairings[gi].itrans);
        const hGens = gens.concat(gens.map(g => g.getInverse()));

        const geo = { G, dom, cells, boundary, bbox, center, diam,
                      fdCentroid: [cx, cy], hGens,
                      cosetTransversal: (dom.cosetTransversal || []).map(t => ({
                          word: t.word, itrans: t.itrans })),
                      classify: lib.classifyEuclidean, apply,
                      Identity: () => new inv.ITransform([], '') };
        geoCache.set(cacheKey, geo);
        return geo;
    }

    /** H-translates whose copy of the domain touches a disc of radius R */
    function hTranslates(geo, R) {
        const key = t => geo.apply(t, geo.center).map(v => v.toFixed(5)).join(',');
        const id = geo.Identity();
        let frontier = [id];
        const seen = new Map([[key(id), id]]);
        for (let d = 0; d < 40 && seen.size < 1500; d++) {
            const next = [];
            for (const cur of frontier) for (const g of geo.hGens) {
                const t = cur.getCopy().concat(g);
                const p = geo.apply(t, geo.center);
                if (Math.hypot(p[0], p[1]) > R + geo.diam) continue;
                const k = key(t);
                if (!seen.has(k)) { seen.set(k, t); next.push(t); }
            }
            if (next.length === 0) break;
            frontier = next;
        }
        return [...seen.values()];
    }

    function worldMap(size, view) {
        const zoom = view.zoom, cx = view.centerX || 0, cy = view.centerY || 0;
        return p => [((p[0] - cx) * zoom + 1) * size / 2,
                     (1 - (p[1] - cy) * zoom) * size / 2];
    }

    /**
     * Draw subgroup geometry onto a 2d context.
     * what = { tiling, fill, cells, outline }, each true or a style override.
     */
    function drawSubgroup(ctx, size, view, geo, what = {}) {
        const W = worldMap(size, view);
        const path = poly => {
            ctx.beginPath();
            poly.forEach((q, i) => { const s2 = W(q);
                i ? ctx.lineTo(s2[0], s2[1]) : ctx.moveTo(s2[0], s2[1]); });
            ctx.closePath();
        };
        const seg = (a, b) => { const q1 = W(a), q2 = W(b);
            ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); };
        const st = (v, def) => Object.assign({}, def, v === true ? {} : v);

        if (what.tiling) {
            const o = st(what.tiling, { color: '#000000', width: 1.5 });
            const R = 1.5 / view.zoom;
            ctx.strokeStyle = o.color; ctx.lineWidth = o.width;
            ctx.beginPath();
            for (const h of hTranslates(geo, R))
                for (const s2 of geo.boundary)
                    seg(geo.apply(h, s2.a), geo.apply(h, s2.b));
            ctx.stroke();
        }
        if (what.fill) {
            const o = st(what.fill, { color: 'rgba(255,220,120,0.55)' });
            ctx.fillStyle = o.color;
            for (const c of geo.cells) { path(c.poly); ctx.fill(); }
        }
        if (what.cells) {   // internal walls: the composition out of G's cells
            const o = st(what.cells, { color: 'rgba(140,100,30,0.9)', width: 1.2 });
            ctx.strokeStyle = o.color; ctx.lineWidth = o.width;
            for (const c of geo.cells) { path(c.poly); ctx.stroke(); }
        }
        if (what.outline) {
            const o = st(what.outline, { color: '#b03020', width: 2.5 });
            ctx.strokeStyle = o.color; ctx.lineWidth = o.width;
            ctx.beginPath();
            for (const s2 of geo.boundary) seg(s2.a, s2.b);
            ctx.stroke();
        }
    }

    /**
     * Glyph of one motion, anchored at a point: a rotation as an arc with an
     * arrowhead about its centre, a translation as a straight arrow.
     * The word names a transversal cell of the geometry ('' or 'e' = identity).
     */
    function drawMotionGlyph(ctx, size, view, geo, word, anchor, style = {}, kind = 'cell') {
        const W = worldMap(size, view);
        const w = (word === 'e') ? '' : word;
        const pool = (kind === 'coset') ? geo.cosetTransversal : geo.cells;
        const cell = pool.find(c => c.word === w) ||
                     geo.cells.find(c => c.word === w) ||
                     (geo.cosetTransversal || []).find(c => c.word === w);
        if (!cell) return 'no word "' + word + '" among cells or coset transversal';
        const cls = geo.classify(cell.itrans);
        const o = Object.assign({ color: '#c02020', width: 3.5, head: 10 }, style);
        ctx.strokeStyle = o.color; ctx.fillStyle = o.color; ctx.lineWidth = o.width;

        const head = (q, ang) => {
            ctx.beginPath();
            ctx.moveTo(q[0], q[1]);
            ctx.lineTo(q[0] - o.head * Math.cos(ang - 0.42), q[1] - o.head * Math.sin(ang - 0.42));
            ctx.lineTo(q[0] - o.head * Math.cos(ang + 0.42), q[1] - o.head * Math.sin(ang + 0.42));
            ctx.closePath(); ctx.fill();
        };

        if (cls.type === 'rotation') {
            const c = W(cls.center), a = W(anchor);
            // a readable arc even when the anchor sits close to the centre
            const r = Math.max(Math.hypot(a[0] - c[0], a[1] - c[1]), 28);
            const a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
            // dot at the anchor: where the motion starts
            ctx.beginPath(); ctx.arc(a[0], a[1], o.width, 0, 2 * Math.PI); ctx.fill();
            const sweep = -cls.angle;                 // canvas y points down
            ctx.beginPath();
            ctx.arc(c[0], c[1], r, a0, a0 + sweep, sweep < 0);
            ctx.stroke();
            const ae = a0 + sweep;
            head([c[0] + r * Math.cos(ae), c[1] + r * Math.sin(ae)],
                 ae + (sweep > 0 ? Math.PI / 2 : -Math.PI / 2));
            ctx.beginPath(); ctx.arc(c[0], c[1], o.width, 0, 2 * Math.PI); ctx.fill();
        } else if (cls.type === 'translation') {
            const a = W(anchor);
            const b = W([anchor[0] + cls.translation[0], anchor[1] + cls.translation[1]]);
            ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
            head(b, Math.atan2(b[1] - a[1], b[0] - a[0]));
        } else if (cls.type === 'identity') {
            const a = W(anchor);
            ctx.beginPath(); ctx.arc(a[0], a[1], o.width * 1.6, 0, 2 * Math.PI); ctx.fill();
        }
        return null;
    }

    // ── Rotation axis markers ────────────────────────────────────────────────
    //
    //  The catalog's axis symbols are hand drawn SVGs; until those are wired in,
    //  a rotation centre is drawn as a filled circle whose colour and size carry
    //  the order of the rotation.  Colours keep the drawings' convention:
    //  6-fold magenta, 3-fold orange, 2-fold blue.  Fills are translucent so the
    //  geometry underneath stays readable.

    const AXIS_STYLE = {
        2: { fill: 'rgba(40,60,220,0.45)',  stroke: 'rgba(20,30,160,0.95)', r: 11 },
        3: { fill: 'rgba(240,140,20,0.45)', stroke: 'rgba(170,90,0,0.95)',  r: 13 },
        4: { fill: 'rgba(20,170,120,0.45)', stroke: 'rgba(10,110,80,0.95)', r: 14 },
        6: { fill: 'rgba(230,30,200,0.45)', stroke: 'rgba(150,10,130,0.95)', r: 16 },
    };
    // hand drawn hurricane symbols (2, 3, 4, 6 arms); loaded lazily, the
    // colored circles below remain as the fallback for missing orders.
    const AXIS_IMG = {};
    let axisImagesReady = null;
    function ensureAxisImages() {
        if (!axisImagesReady) {
            axisImagesReady = Promise.all([2, 3, 4, 6].map(o => new Promise(res => {
                const img = new Image();
                img.onload = () => { AXIS_IMG[o] = img; res(); };
                img.onerror = () => res();
                img.src = '/catalog/work/axis_' + o + '.svg';
            })));
        }
        return axisImagesReady;
    }

    const AXIS_DEFAULT = { fill: 'rgba(120,120,120,0.45)',
                           stroke: 'rgba(60,60,60,0.95)', r: 12 };

    /**
     * All rotation centres of a group, near the origin.
     *
     * The pairing transforms alone are not enough: for 632 they give only the
     * 2-fold centre at an edge midpoint and the 3-fold centre at a vertex, and
     * miss the 6-fold centres at the other two vertices.  So walk short words in
     * the pairing transforms, classify each as an isometry, and collect the
     * distinct rotation centres.  A centre's order is the largest k seen there,
     * i.e. 2*PI over the smallest rotation angle about it.
     *
     * @param {string|null} cosets  coset table for a subgroup, else the parent
     * @returns {Promise<Array<{x,y,order}>>}
     */
    async function axisCenters(cosets, opt = {}) {
        const lib = await groupLib();
        const inv = await import('/lib/invlib/invlib.js');
        const depth = opt.depth || 5;
        const radius = opt.radius === undefined ? 1.2 : opt.radius;

        const gp = api.getParams().symmetry.group.params;
        const G = new lib.Group(lib.iWallpaperGroup({
            name: gp.type, a: gp.a, b: gp.b, c: gp.c,
            angle_a: (gp.angle_a || 0) * Math.PI / 180,
            angle_b: (gp.angle_b === undefined ? 90 : gp.angle_b) * Math.PI / 180,
        }));

        // the transforms to walk: G's pairings, or H's pairing generators
        let gens;
        if (cosets) {
            const H = lib.makeSubgroupGroup({ group: G, cosets, checkConvex: false });
            const dom = H.subgroupDomain;
            gens = dom.generators.map(gi => dom.pairings[gi].itrans);
        } else {
            gens = G.transforms.map(t => new inv.ITransform(t.slice(), ''));
        }
        gens = gens.concat(gens.map(g => g.getInverse()));

        // breadth first over short words, deduplicating by action on test points
        const key = t => {
            const a = t.transform(inv.iPoint([0.1234, 0.0567, 0, 0])).v;
            const b = t.transform(inv.iPoint([-0.0721, 0.1618, 0, 0])).v;
            return [a[0], a[1], b[0], b[1]].map(v => v.toFixed(5)).join(',');
        };
        let frontier = [new inv.ITransform([], '')];
        const seen = new Map([[key(frontier[0]), frontier[0]]]);
        for (let d = 0; d < depth && seen.size < 400; d++) {
            const next = [];
            for (const t of frontier) {
                for (const g of gens) {
                    const c = t.getCopy().concat(g);
                    const k = key(c);
                    if (!seen.has(k)) { seen.set(k, c); next.push(c); }
                }
            }
            frontier = next;
        }

        // collect rotation centres, keeping the highest order at each
        const centers = new Map();
        for (const t of seen.values()) {
            const cls = lib.classifyEuclidean(t);
            if (cls.type !== 'rotation') continue;
            const [x, y] = cls.center;
            if (Math.abs(x) > radius || Math.abs(y) > radius) continue;
            const order = Math.round(2 * Math.PI / Math.abs(cls.angle));
            if (!(order >= 2 && order <= 12)) continue;
            // normalise -0 so that it does not key a duplicate centre
            const z = v => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(4);
            const k = z(x) + ',' + z(y);
            const prev = centers.get(k);
            if (!prev || order > prev.order) centers.set(k, { x, y, order, k });
        }

        // equivalence classes: c1 ~ c2 iff some walked group element maps one
        // centre onto the other (same order).  The class count per order must
        // reproduce the orbifold digits of the group's type (2222 -> four 2s).
        const list = [...centers.values()];
        const byKey = new Map(list.map((c, i) => [c.k, i]));
        const parent = list.map((_, i) => i);
        const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
        const z4 = v => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(4);
        for (const t of seen.values()) {
            for (let i = 0; i < list.length; i++) {
                const q = t.transform(inv.iPoint([list[i].x, list[i].y, 0, 0])).v;
                const j = byKey.get(z4(q[0]) + ',' + z4(q[1]));
                if (j !== undefined && list[j].order === list[i].order) {
                    const a = find(i), b = find(j);
                    if (a !== b) parent[a] = b;
                }
            }
        }
        // stable class numbering per order: by the class's centre nearest 0,
        // ties by angle
        const roots = new Map();
        for (let i = 0; i < list.length; i++) {
            const r = find(i);
            if (!roots.has(r)) roots.set(r, []);
            roots.get(r).push(i);
        }
        const classInfo = [...roots.values()].map(members => {
            let best = members[0];
            for (const i of members) {
                const di = Math.hypot(list[i].x, list[i].y), db = Math.hypot(list[best].x, list[best].y);
                if (di < db - 1e-6 ||
                    (Math.abs(di - db) <= 1e-6 &&
                     Math.atan2(list[i].y, list[i].x) < Math.atan2(list[best].y, list[best].x) - 1e-9))
                    best = i;
            }
            return { members, order: list[best].order,
                     d: Math.hypot(list[best].x, list[best].y),
                     a: Math.atan2(list[best].y, list[best].x) };
        });
        const perOrder = new Map();
        for (const ci of classInfo) {
            if (!perOrder.has(ci.order)) perOrder.set(ci.order, []);
            perOrder.get(ci.order).push(ci);
        }
        for (const group of perOrder.values()) {
            group.sort((u, v) => u.d - v.d || u.a - v.a);
            group.forEach((ci, idx) => { for (const i of ci.members) list[i].cls = idx; });
        }
        for (const c of list) delete c.k;
        return list;
    }

    /**
     * Draw axis markers onto a canvas, mapping world to pixels the same way
     * CanvasTransform does (square canvas, so aspect is 1).
     */
    async function drawAxisMarkers(ctx, size, centers, view, scale = 1) {
        const zoom = view.zoom, cx = view.centerX || 0, cy = view.centerY || 0;
        const toX = x => ((x - cx) * zoom + 1) * size / 2;
        const toY = y => (1 - (y - cy) * zoom) * size / 2;
        await ensureAxisImages();
        for (const c of centers) {
            const st = AXIS_STYLE[c.order] || AXIS_DEFAULT;
            const r = st.r * scale;
            const img = AXIS_IMG[c.order];
            if (img && img.naturalHeight) {
                const shaded = shadedAxisImage(c.order, img, (c.cls || 0));
                const h = 2.4 * r;
                const w = h * (img.naturalWidth / img.naturalHeight);
                ctx.drawImage(shaded, toX(c.x) - w / 2, toY(c.y) - h / 2, w, h);
                continue;
            }
            ctx.filter = ['none', 'brightness(1.6)', 'brightness(0.55)',
                          'saturate(0.3)'][(c.cls || 0) % 4];
            ctx.beginPath();
            ctx.arc(toX(c.x), toY(c.y), r, 0, 2 * Math.PI);
            ctx.fillStyle = st.fill;
            ctx.fill();
            ctx.lineWidth = Math.max(1.5, r * 0.18);
            ctx.strokeStyle = st.stroke;
            ctx.stroke();
            ctx.filter = 'none';
        }
    }

    // shades of the symbol's base color for inequivalent axis classes: blend
    // white / black / gray INTO the symbol's own alpha (hue preserving - css
    // brightness/saturate filters fail on saturated blues, whose luma is tiny)
    const AXIS_SHADE_OVERLAY = [null, 'rgba(255,255,255,0.55)', 'rgba(0,0,0,0.45)',
                                'rgba(128,128,128,0.62)'];
    const axisShadeCache = new Map();
    function shadedAxisImage(order, img, cls) {
        const mode = cls % AXIS_SHADE_OVERLAY.length;
        const key = order + ':' + mode;
        let cnv = axisShadeCache.get(key);
        if (!cnv) {
            const w = img.naturalWidth * 6, h = img.naturalHeight * 6;
            cnv = document.createElement('canvas');
            cnv.width = w; cnv.height = h;
            const g = cnv.getContext('2d');
            g.drawImage(img, 0, 0, w, h);
            if (AXIS_SHADE_OVERLAY[mode]) {
                g.globalCompositeOperation = 'source-atop';
                g.fillStyle = AXIS_SHADE_OVERLAY[mode];
                g.fillRect(0, 0, w, h);
            }
            axisShadeCache.set(key, cnv);
        }
        return cnv;
    }

    /** the view actually in effect, for world -> pixel mapping */
    function currentView() {
        const e = api.getParams().tools.transform.euclidean || {};
        const zoom = Array.isArray(e.zoom) ? e.zoom[0] : e.zoom;
        return { zoom: zoom || 1, centerX: e.centerX || 0, centerY: e.centerY || 0 };
    }

    /**
     * A view framing the subgroup domain: centred on it, zoomed so that it
     * fills `fillRatio` of the image height (the world span is 2 / zoom).
     */
    async function autoView(cosets, fillRatio = 0.42) {
        const geo = await subgroupGeo(cosets);
        const span = Math.max(geo.bbox.x1 - geo.bbox.x0, geo.bbox.y1 - geo.bbox.y0);
        return { zoom: 2 * fillRatio / span,
                 centerX: geo.center[0], centerY: geo.center[1] };
    }

    /** apply the shared view, so every image of an entry is framed identically */
    function setView(view) {
        if (!view) return;
        const euclidean = {};
        for (const k of ['zoom', 'centerX', 'centerY'])
            if (view[k] !== undefined) euclidean[k] = view[k];
        if (Object.keys(euclidean).length)
            api.setParams({ tools: { transform: { euclidean } } });
    }

    /**
     * Run a whole job: one image per item.  The template preset is reloaded for
     * every item, so items cannot leak state into one another.
     * @returns {Promise<Array>} one report row per item
     */
    async function runJob(job) {
        const report = [];
        let jobView = job.view || null;

        for (const item of job.items) {
            const preset = item.preset || job.preset;
            if (preset) {
                await api.loadPreset(preset);
                await sleep(SETTLE_MS);
            }

            // an autoView is resolved after the first preset load, when the
            // group parameters are known, and then shared by every item
            if (!jobView && job.autoView)
                jobView = await autoView(job.autoView.subgroup, job.autoView.fillRatio);

            setView(item.view || jobView);

            const size = item.size || job.size || DEFAULT_SIZE;
            const file = (job.outDir ? job.outDir + '/' : '') + item.file;
            const missing = [];
            let res;

            let cnv;
            if (item.compose) {
                // stacked image: one render per configuration, composited
                const composed = await composeCanvas(item.compose, size, size);
                missing.push(...composed.missing);
                cnv = composed.canvas;
            } else {
                if (item.subgroup !== undefined) await setSubgroup(item.subgroup);
                else if (job.subgroup !== undefined) await setSubgroup(job.subgroup);
                else api.setGroupOverride(null);
                missing.push(...await applyConfig(item));
                cnv = api.renderToCanvas(size, size);
            }

            const effView = item.view || jobView || currentView();

            if (item.draw) {
                const geo = await subgroupGeo(item.draw.subgroup);
                drawSubgroup(cnv.getContext('2d'), size, effView, geo, item.draw);
            }
            if (item.glyphs) {
                const geo = await subgroupGeo(item.glyphs.subgroup);
                const anchor = item.glyphs.anchor || geo.fdCentroid;
                for (const g of item.glyphs.list) {
                    const err = drawMotionGlyph(cnv.getContext('2d'), size, effView,
                                                geo, g.word, anchor, g.style,
                                                item.glyphs.kind);
                    if (err) missing.push('glyph: ' + err);
                }
            }
            if (item.markers) {
                const centers = await axisCenters(item.markers.subgroup);
                await drawAxisMarkers(cnv.getContext('2d'), size, centers,
                                effView, item.markers.scale || 1);
            }

            const blob = await new Promise(r => cnv.toBlob(r, 'image/png'));
            const resp = await fetch('/save?path=' + encodeURIComponent(file),
                                     { method: 'POST', body: blob });
            res = { ...(await resp.json()), width: size, height: size };
            report.push({ file: res.saved, bytes: res.bytes,
                          size: res.width + 'x' + res.height,
                          ...(missing.length ? { missingParams: missing } : {}) });
            console.log('[catalog]', res.saved, res.bytes, 'bytes',
                        missing.length ? ' MISSING: ' + missing.join(',') : '');
        }
        return report;
    }

    async function runJobUrl(url) {
        const job = await (await fetch(url)).json();
        return runJob(job);
    }

    const catalog = {
        api,
        canvas,
        listParams,
        setParam: (path, value) => api.setParam(path, value),
        getParam: (path) => api.getParam(path),
        setLayer,
        setSubgroup,
        composeCanvas,
        axisCenters,
        subgroupGeo,
        drawSubgroup,
        drawMotionGlyph,
        autoView,
        render: () => api.render(),
        renderToCanvas: (w, h) => api.renderToCanvas(w, h),
        getCanvasSize: () => api.getCanvasSize(),
        save,
        runJob,
        runJobUrl,
    };

    window.catalog = catalog;
    console.log('[catalog_driver] ready; window.catalog =', Object.keys(catalog));

    const jobUrl = new URLSearchParams(location.search).get('job');
    if (jobUrl) {
        runJobUrl(jobUrl).then(r => {
            window.catalogJobReport = r;
            console.log('[catalog_driver] job finished', r);
        });
    }

    return {
        setTime(t) { /* no animation */ }
    };
}
