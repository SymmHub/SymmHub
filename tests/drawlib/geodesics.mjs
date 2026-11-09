/*
  tests of drawing by geodesics: the sides of a geodesic path as the straight lines of the
  group's geometry (phase 1, sections 1 to 6), its curved sides as the cubics of the
  geometry (phase 2, sections 7 to 10), the shapes as shapes of the geometry (phase 3,
  sections 11 to 13) and Kleinian groups by their local disks (phase 4, section 14): lib/invlib/Geodesics.js, the outlines of lib/drawlib/Paths.js and
  DrawingGeometry.js, the shapes of Shapes.js, the outliner of DrawingDocument.js, the
  editor's setting and conversions, the polyline, pen and shape tools
  (docs/geodesic_drawing_assessment.md)

    node tests/drawlib/geodesics.mjs

  1. Geodesics.js in the plane, two disks (inside and outside), a half plane and two
     spheres: the arc of a segment passes through its midpoint, which is halfway in the
     metric, runs along the geodesic (in the chart of its start its points lie on the ray to
     its end), is orthogonal to the absolute and is carried by the isometries; its cubic
     pieces are at most 45 degrees wide, within 5e-6 of its radius and end at its end; the
     plane and a geodesic through the centre of the model give straight segments; across the
     absolute, on it, between antipodes and out through infinity there is none; the point on
     a geodesic ray lies on the ray, as far as the pointer, inside the model
  2. Paths.js: the outline of an open, a closed and a compound path (nodes, the handles of a
     curved side kept, the source of every segment); flattenItem tells the pieces by the
     path's segments; outlinePoint and splitItemSegment put a node on the geodesic;
     euclideanItem, flattenedItem and polylineFromPath; savedItem drops the outline
  3. DrawingDocument: a geodesic path keeps its flag, gets its outline from the outliner and
     its points from the outline; another outliner resolves it again (new objects, one
     notice) and leaves the nodes; items set into a layer as a document loads them are
     resolved; the saved items carry no outline; the items a group or a shape holds are
     resolved; the other items stay the objects they were
  4. DrawingEditor with *237 under a turned, scaled pattern transform: the geometry the
     paths are drawn in does not follow the geometry setting of the moves; a side between two
     points of a mirror lies on the mirror; a move carries a geodesic polygon to its Moebius
     image, and so does a generator of the group; To geodesic and To Euclidean with undo; a
     node inserted on a side lies on it; in a wallpaper group and in a Kleinian group new
     lines are plain polylines
  5. PolylineTool: clicks make a geodesic path with the setting on, a polyline with it off
     and in a wallpaper group; the line being made is shown as arcs; with Shift a side
     leaves the last vertex in a 15 degree step and ends as far as the pointer
  6. what draws: the cubics traced for the renderer are the outline's, the SVG of the
     drawing and of the pattern has them, the fold carries the outline to pattern coordinates
  7. Geodesics.js, cubic segments in the same seven models: the cubic of the linear model is
     carried by the isometries, leaves its start along the geodesic to its first handle, is
     the same from both ends and the geodesic when its handles lie on it; its cubic pieces
     stay within 1.5e-4 of its extent, at most 64, their parts of the parameter in a row; a
     split puts the node on the curve with its handles on one geodesic, the halves close to
     the segment; a handle past the absolute: not drawn; in the plane the Euclidean cubic
  8. Paths.js with the chart of a node: handles pulled out, a dragged handle of a smooth
     node, a corner made smooth and a moved node keep the handles on one geodesic through
     the node, by their lengths in the metric (without the chart: the plane's edits, as
     ever); the curve through such a node has no kink; the outline of a curved side is the
     geometry's cubic, flattenItem tells the parameter, a node inserted on it lies on the
     curve, To polyline gives nodes on the curve
  9. the document and the editor with *237: a geodesic path with handles is drawn by the
     geometry's cubics, the plain path of the same nodes by the plane's; the editor gives
     the chart and the split for the one and none for the other; a move by an isometry maps
     nodes and handles and the path is the image of the path; To Euclidean and To polyline;
     in a wallpaper group a geodesic path is its own cubics
  10. PenTool: with geodesic lines on a geodesic path, the handles of a dragged node pulled
     out along one geodesic through it, shown while made as it is drawn, the stalks of the
     handles geodesics; corners only still a geodesic path; with the setting off the plain
     path as before
  11. Shapes.js with the space of two disks and a sphere (DrawingGeometry.shapeSpace): the
     chart and its inverse, size and length; at the model's centre the chart is the world;
     a polygon's corners at its radius in the metric, its sides equal geodesics, its first
     corner at angle + phase; a rect's corners at the chart's (+-a, +-b) and its sides
     crossing the axes at the half sizes; a circle's drawn points at its radius in the
     metric and on a Euclidean circle, by plain cubic nodes; an ellipse's on the chart's
     ellipse; a rounded rect's on geodesic sides or the chart's corner arcs; a spiral's
     radius growing evenly in the metric, open; a curved star's handles the chart's,
     mapped; a small shape at the model's centre is the Euclidean one
  12. shapeMapped with the space: under a translation, a turn and a reflection every kind
     keeps its sizes, goes to the centre's image with its angle turned (a reflection
     reflects a star's twist and handles and a spiral's turn), and the drawn curve of the
     image is the image of the drawn curve; a scaling of the world keeps the kind, moves
     the centre and grows the size; geodesicShape and euclideanShape undo each other and a
     small geodesic shape stands where the Euclidean one did
  13. the document, the editor and the tools with *237 and *532, and 632: a geodesic polygon
     and circle added are drawn by the geometry; a copy under a generator keeps the sizes
     and is drawn as the image; saved without the outline, loaded and resolved, resolved
     again by another outliner; To Euclidean and To geodesic with undo; a released polygon
     is a geodesic path of its corners, a released circle the plain path of its outline;
     the handles of a polygon, a rect and an ellipse through the chart; the polygon tool's
     drag from the centre (the tip at the pointer, the radius in the metric), the rect
     tool's box drag (the corners at the press and the pointer, the centre their midpoint),
     Shift a square, the setting off a Euclidean rect, the toggle in the bar; in a wallpaper
     group no space, the Euclidean shapes; a spiral is open
  14. a Kleinian group (*2223 bent by 20 degrees): the Kleinian outliner; the disk finder
     gives maximalDisk's disks; the side between two points of a mirror lies on it and is
     the same from both ends; a geodesic pentagon is drawn by arcs and a copy under a
     generator as the image; a smooth node's curved sides leave it with one tangent; the
     chart and the split; a hexagon's corners at one distance in the disk of its centre, a
     circle a Euclidean circle, a generator keeps a shape's sizes; the editor and the
     polyline and rect tools draw geodesics, To Euclidean and undo, the toggle shows
*/

// the makers through the aggregator, which evaluates grouplib in its own order
import { Group_KLM, Group_KLMN, Group_WP, Group_Grandma } from '../../lib/grouplib/grouplib.js';
import { maximalDisk, maximalDiskFinder } from '../../lib/grouplib/GroupGeometry.js';
import { ITransform, iPoint, SPLANE_SPHERE } from '../../lib/invlib/invlib.js';
import {
    mobiusApply, mobiusCompose, mobiusInverse, canonicalChart, translationTo, rotationAbout, reflectionAbout, geodesicDistance,
} from '../../lib/invlib/GeometryMotions.js';
import {
    geodesicMidpoint, geodesicArc, arcPoint, arcCubics, geodesicCubics, geodesicRayPoint, geodesicCurvePoint, geodesicCurveCubics, geodesicCurveSplit,
} from '../../lib/invlib/Geodesics.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';
import { PolylineTool } from '../../lib/drawlib/PolylineTool.js';
import { PenTool } from '../../lib/drawlib/PenTool.js';
import { ShapeTool } from '../../lib/drawlib/ShapeTool.js';
import { shapeHandles, shapeWithHandleAt } from '../../lib/drawlib/ShapeHandles.js';
import { normalShape, shapeGeometry, shapeMapped, shapeInChart, geodesicShape, euclideanShape, cornerPoint, shapePoint } from '../../lib/drawlib/Shapes.js';
import {
    geodesicOutline, flattenItem, flattenNodes, outlinePoint, splitItemSegment, euclideanItem, flattenedItem, polylineFromPath,
    pathFromPolyline, savedItem, drawnNodes, traceNodes, withNodes, nodeRings, nodeMoved, handleMoved, nodeHandlesPulled, nodeSmoothToggled, mappedItem,
} from '../../lib/drawlib/Paths.js';
import { worldGeometry, geometryKey, geodesicOutliner, shapeSpace, groupOutliner } from '../../lib/drawlib/DrawingGeometry.js';
import { foldItems, worldToPatternMap, patternToWorldMap } from '../../lib/drawlib/Folder.js';
import { itemsToSvg, patternSvg } from '../../lib/drawlib/SvgExport.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}
const fmt = x => Number.isFinite(x) ? x.toExponential(2) : String(x);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const polar = (r, a) => [r*Math.cos(a), r*Math.sin(a)];
let seed = 20261109;
const rnd = () => { seed = (seed*1103515245 + 12345) & 0x7fffffff; return seed/0x7fffffff; };

/** how far the point is from the arc's circle (of its radius), 1 more when it is outside the arc's sweep; from the line, of its length */
function offArc(arc, p){
    if (arc.line) {
        const v = [arc.Q[0] - arc.P[0], arc.Q[1] - arc.P[1]], n2 = v[0]*v[0] + v[1]*v[1];
        return Math.abs(v[0]*(p[1] - arc.P[1]) - v[1]*(p[0] - arc.P[0]))/n2;
    }
    const TWO_PI = 2*Math.PI, way = Math.sign(arc.sweep) || 1;
    let turned = way*(Math.atan2(p[1] - arc.centre[1], p[0] - arc.centre[0]) - arc.a0);
    turned = ((turned % TWO_PI) + TWO_PI) % TWO_PI;
    const within = turned <= Math.abs(arc.sweep) + 1e-7 || turned >= TWO_PI - 1e-7;
    return Math.abs(dist(p, arc.centre) - arc.radius)/arc.radius + (within ? 0 : 1);
}
/** the point of a cubic at t */
function cubicAt(p0, c1, c2, p3, t){
    const s = 1 - t, b = [s*s*s, 3*s*s*t, 3*s*t*t, t*t*t];
    return [0, 1].map(i => b[0]*p0[i] + b[1]*c1[i] + b[2]*c2[i] + b[3]*p3[i]);
}

// ---- the groups ────────────────────────────────────────────────────────────

function klm(K, L, M, s){
    const maker = new Group_KLM({});
    Object.assign(maker.params, { K, L, M, s, hasR: false });
    return maker.getGroup();
}
const g237 = klm(2, 3, 7, true);
const g632 = new Group_WP({ type: '632' }).getGroup();
function grandma(taRe, taIm){
    const mk = new Group_Grandma();
    Object.assign(mk.params, { ta_re: taRe, ta_im: taIm, tb_re: 3, tb_im: 0 });
    mk.state.paramChanged = true;
    return mk.getGroup();
}

// 1 ───────────────────────────────────────────────────────────────────────────

const GEOMETRIES = [
    ['the plane',                  { kind: 'euclidean' },                          () => [2*rnd() - 1, 2*rnd() - 1]],
    ['the unit disk',              { kind: 'hyperbolic', c: [0, 0], r: 1 },        () => polar(0.9*Math.sqrt(rnd()), 2*Math.PI*rnd())],
    ['the disk (0.3, -0.2), 1.7',  { kind: 'hyperbolic', c: [0.3, -0.2], r: 1.7 }, () => { const p = polar(1.5*Math.sqrt(rnd()), 2*Math.PI*rnd()); return [0.3 + p[0], -0.2 + p[1]]; }],
    ['outside the unit disk',      { kind: 'hyperbolic', c: [0, 0], r: 1 },        () => polar(1.2 + 2*rnd(), 2*Math.PI*rnd())],
    ['the upper half plane',       { kind: 'halfplane', p: [0, 0], e: [1, 0] },    () => [2*rnd() - 1, 0.2 + 1.5*rnd()]],
    ['the unit sphere',            { kind: 'spherical', c: [0, 0], R: 1 },         () => polar(1.5*Math.sqrt(rnd()), 2*Math.PI*rnd())],
    ['the sphere (0.4, 0.1), 0.8', { kind: 'spherical', c: [0.4, 0.1], R: 0.8 },   () => { const p = polar(1.1*Math.sqrt(rnd()), 2*Math.PI*rnd()); return [0.4 + p[0], 0.1 + p[1]]; }],
];

/** how far the arc's circle is from orthogonal to the absolute (relative) */
function offAbsolute(geom, arc){
    if (geom.kind === 'halfplane') {
        const ac = w => (w[1] - geom.p[1])*geom.e[0] - (w[0] - geom.p[0])*geom.e[1];
        if (arc.line) { const v = [arc.Q[0] - arc.P[0], arc.Q[1] - arc.P[1]]; return Math.abs(v[0]*geom.e[0] + v[1]*geom.e[1])/Math.hypot(v[0], v[1]); }
        return Math.abs(ac(arc.centre))/arc.radius;
    }
    const r2 = geom.kind === 'hyperbolic' ? geom.r*geom.r : -geom.R*geom.R;
    if (arc.line) { const v = [arc.Q[0] - arc.P[0], arc.Q[1] - arc.P[1]]; return Math.abs(v[0]*(geom.c[1] - arc.P[1]) - v[1]*(geom.c[0] - arc.P[0]))/(Math.hypot(v[0], v[1])*Math.sqrt(Math.abs(r2))); }
    const d2 = (arc.centre[0] - geom.c[0])**2 + (arc.centre[1] - geom.c[1])**2;
    return Math.abs(d2 - arc.radius*arc.radius - r2)/(d2 + arc.radius*arc.radius + Math.abs(r2));
}

{
    for (const [name, geom, pick] of GEOMETRIES) {
        let onRay = 0, halfway = 0, ortho = 0, carried = 0, pieceOff = 0, widest = 0, endOff = 0, n = 0, arcs = 0;
        for (let trial = 0; trial < 200; trial++) {
            const P = pick(), Q = pick();
            const arc = geodesicArc(geom, P, Q);
            if (!arc) continue;        // out through infinity (the sphere, outside a disk): its own check below
            n++;
            const M = geodesicMidpoint(geom, P, Q);
            const d = geodesicDistance(geom, P, Q);
            halfway = Math.max(halfway, Math.abs(geodesicDistance(geom, P, M) - d/2), Math.abs(geodesicDistance(geom, M, Q) - d/2));
            if (geom.kind !== 'euclidean') ortho = Math.max(ortho, offAbsolute(geom, arc));
            // in the chart of P the geodesic is the ray to the image of Q
            const s = canonicalChart(geom, P), wq = mobiusApply(s, Q), lq = Math.hypot(wq[0], wq[1]);
            // an isometry: a translation, a turn, every second time a reflection too
            const m = mobiusCompose(rotationAbout(geom, pick(), 2*Math.PI*rnd()), translationTo(geom, pick(), pick()));
            const refl = trial % 2 ? reflectionAbout(geom, pick(), polar(1, Math.PI*rnd())) : null;
            const iso = z => { const w = mobiusApply(m, z); return refl ? refl(w) : w; };
            const arc2 = geodesicArc(geom, iso(P), iso(Q));
            for (const t of [0.13, 0.5, 0.86]) {
                const z = arcPoint(arc, t), w = mobiusApply(s, z);
                onRay = Math.max(onRay, Math.abs(w[0]*wq[1] - w[1]*wq[0])/(lq*(1 + Math.hypot(w[0], w[1]))));
                if (w[0]*wq[0] + w[1]*wq[1] < 0) onRay = 1;
                // (an absolute distance: the images come close to the absolute, where the arcs are tiny)
                if (arc2) carried = Math.max(carried, Math.min(1, offArc(arc2, iso(z))*(arc2.line ? 1 : Math.min(1, arc2.radius))));
            }
            if (arc.line) continue;
            arcs++;
            const pieces = arcCubics(arc);
            widest = Math.max(widest, Math.abs(arc.sweep)/pieces.length);
            endOff = Math.max(endOff, dist(pieces[pieces.length - 1].p, Q));
            let p0 = P;
            for (const piece of pieces) {
                for (const t of [0.25, 0.5, 0.75]) pieceOff = Math.max(pieceOff, Math.min(1, offArc(arc, cubicAt(p0, piece.c1, piece.c2, piece.p, t))));
                p0 = piece.p;
            }
        }
        check(n > 100 && onRay < 1e-8 && halfway < 1e-8 && ortho < 1e-8 && carried < 1e-7 && pieceOff < 5e-6 && widest <= Math.PI/4 + 1e-9 && endOff === 0,
              `${name}: ${n} segments (${arcs} arcs): off the ray ${fmt(onRay)}, the midpoint off halfway ${fmt(halfway)}, off orthogonal ${fmt(ortho)}, ` +
              `off after an isometry ${fmt(carried)}, the cubic pieces off the arc ${fmt(pieceOff)} of the radius, widest ${(widest*180/Math.PI).toFixed(1)} degrees, the end off ${fmt(endOff)}`);
        console.log(`  ${name}: ${n} segments, ${arcs} arcs; cubic pieces off by ${fmt(pieceOff)} of the radius, the image under an isometry off by ${fmt(carried)}`);
    }
    const disk = { kind: 'hyperbolic', c: [0, 0], r: 1 }, sphere = { kind: 'spherical', c: [0, 0], R: 1 };
    check(geodesicCubics({ kind: 'euclidean' }, [0.1, 0.2], [0.5, 0.7]) === null && geodesicArc({ kind: 'euclidean' }, [0.1, 0.2], [0.5, 0.7]).line, 'in the plane a segment is straight');
    check(geodesicArc(disk, [0.2, 0.1], [-0.4, -0.2]).line && geodesicCubics(disk, [0.2, 0.1], [-0.4, -0.2]) === null, 'a geodesic through the centre of the disk is straight');
    check(geodesicArc(disk, [0.3, 0.2], [1.5, 0.2]) === null && geodesicMidpoint(disk, [0.3, 0.2], [1.5, 0.2]) === null, 'no geodesic across the absolute');
    check(geodesicArc(disk, [0.3, 0.2], [0.6, 0.8]) === null, 'no geodesic to a point of the absolute');
    check(geodesicArc(disk, [1.5, 0.2], [2, -1]) !== null, 'two points outside the disk have one (the other sheet)');
    check(geodesicArc(sphere, [0.5, 0], [-2, 0]) === null, 'no arc between antipodes of the sphere');
    check(geodesicArc(sphere, [3, 0.01], [-3, 0.02]) === null, 'no arc out through infinity');
    check(geodesicArc(sphere, [0.5, 0.1], [-0.2, 0.7]) !== null, 'an ordinary segment of the sphere has its arc');
    // the point of a geodesic ray
    for (const [name, geom, pick] of GEOMETRIES) {
        let worst = 0;
        for (let trial = 0; trial < 50; trial++) {
            const A = pick(), W = pick(), dir = polar(1, 2*Math.PI*rnd());
            const X = geodesicRayPoint(geom, A, dir, W);
            const s = canonicalChart(geom, A), wx = mobiusApply(s, X), ww = mobiusApply(s, W);
            const along = Math.abs(wx[0]*dir[1] - wx[1]*dir[0]) + (wx[0]*dir[0] + wx[1]*dir[1] < 0 ? 1 : 0);
            worst = Math.max(worst, along/(1 + Math.hypot(wx[0], wx[1])), Math.abs(Math.hypot(wx[0], wx[1]) - Math.hypot(ww[0], ww[1]))/(1 + Math.hypot(ww[0], ww[1])));
        }
        check(worst < 1e-8, `${name}: the point of a geodesic ray lies on it, as far as the pointer (${fmt(worst)})`);
    }
    const beyond = geodesicRayPoint(disk, [0.3, 0.2], [1, 0], [5, 6]);
    check(Math.hypot(beyond[0], beyond[1]) < 1, `a pointer past the absolute: the ray's point stays in the disk (${beyond.map(x => x.toFixed(4))})`);
}

// 2 ───────────────────────────────────────────────────────────────────────────

const UNIT = { kind: 'hyperbolic', c: [0, 0], r: 1 };
const unitPieces = (P, Q) => geodesicCubics(UNIT, P, Q);
const node = (x, y, extra = {}) => ({ p: [x, y], h1: null, h2: null, ...extra });
/** the largest distance of the item's flattened points from the arcs of its sides without handles (of their radii) */
function offSides(item, geom){
    const nodes = item.nodes, n = nodes.length;
    const arcs = [];
    for (const [first, last] of nodeRings(nodes)) {
        for (let i = first; i <= last; i++) {
            if (i === last && !item.closed) break;
            const j = i === last ? first : i + 1;
            if (nodes[i].h2 || nodes[j].h1) continue;
            arcs.push(geodesicArc(geom, nodes[i].p, nodes[j].p) || { line: true, P: nodes[i].p, Q: nodes[j].p });
        }
    }
    let worst = 0;
    const flat = flattenItem(item);
    flat.pieces.forEach((piece, k) => {
        if (piece.seg < 0) return;
        const a = nodes[piece.seg], b = nodes[piece.seg === n - 1 || nodes[piece.seg].ringEnd ? nodeRings(nodes).find(r => r[1] === piece.seg)[0] : piece.seg + 1];
        if (a.h2 || b.h1) return;
        const p = [flat.points[2*k], flat.points[2*k + 1]];
        worst = Math.max(worst, Math.min(...arcs.map(arc => Math.min(1, offArc(arc, p)))));
    });
    return worst;
}

{
    // an open path of three sides, the middle one curved
    const open = [node(-0.5, 0.1), node(-0.1, 0.4, { h2: [0.0, 0.6] }), node(0.3, 0.3, { h1: [0.2, 0.5] }), node(0.6, -0.2)];
    const o = geodesicOutline(open, false, unitPieces);
    const mine = o.source.map((s, k) => (s ? s.seg : -1));
    check(o.nodes.length === o.source.length && o.source[o.nodes.length - 1] === null && mine.filter(s => s === 0).length >= 1 && mine.filter(s => s === 1).length === 1
          && mine.filter(s => s === 2).length >= 1, `an open path: ${o.nodes.length} outline nodes, the segments ${mine}`);
    const k1 = mine.indexOf(1);
    check(dist(o.nodes[k1].h2, [0.0, 0.6]) === 0 && dist(o.nodes[k1 + 1].h1, [0.2, 0.5]) === 0 && o.source[k1].t0 === 0 && o.source[k1].t1 === 1, 'the curved side keeps its two handles and is one segment of the outline');
    check(dist(o.nodes[0].p, open[0].p) === 0 && dist(o.nodes[o.nodes.length - 1].p, open[3].p) === 0 && !o.nodes[0].h1 && !o.nodes[o.nodes.length - 1].h2, 'the ends are the path\'s, with no handles outward');
    // a long side: several pieces, their parameters in a row from 0 to 1
    const long = geodesicOutline([node(...polar(0.97, 0.3)), node(...polar(0.97, 1.5))], false, unitPieces);
    const ts = long.source.filter(Boolean);
    check(ts.length >= 2 && ts[0].t0 === 0 && ts[ts.length - 1].t1 === 1 && ts.every((s, k) => k === 0 || Math.abs(s.t0 - ts[k - 1].t1) < 1e-12) && long.nodes.slice(1, -1).every(m => m.smooth),
          `a side near the absolute: ${ts.length} pieces, their parameters ${ts.map(s => s.t0.toFixed(3) + '-' + s.t1.toFixed(3)).join(' ')}, the nodes inside smooth`);
    // closed: the closing side ends at the first node
    const tri = [node(0.5, 0), node(-0.2, 0.5), node(-0.3, -0.4)];
    const c = geodesicOutline(tri, true, unitPieces);
    const segs = c.source.map(s => (s ? s.seg : -1));
    check(c.source.every(Boolean) && segs.includes(2) && c.nodes[0].h1 && dist(c.nodes[0].p, tri[0].p) === 0, `a closed path: every outline node starts a segment (${segs}), the first takes the closing side's handle`);
    // compound: two rings, the ring's end marked on the outline
    const two = [node(0.5, 0), node(-0.2, 0.5), node(-0.3, -0.4, { ringEnd: true }), node(0.1, 0), node(-0.1, 0.1), node(-0.1, -0.1)];
    const cc = geodesicOutline(two, true, unitPieces);
    const rings = nodeRings(cc.nodes);
    check(rings.length === 2 && cc.source[rings[0][1]].seg === 2 && cc.source[rings[1][1]].seg === 5, `a compound path: the outline has ${rings.length} rings ending on the closing sides`);

    // flattenItem, outlinePoint, splitItemSegment
    const item = { type: 'path', closed: true, geodesic: true, nodes: tri, outline: c, points: flattenNodes(c.nodes, true), style: {} };
    const flat = flattenItem(item);
    const ok = flat.pieces.every(p => p.seg >= 0 && p.seg <= 2 && p.t0 >= -1e-12 && p.t1 <= 1 + 1e-12 && p.t1 > p.t0) && flat.points.length === item.points.length;
    check(ok && flat.pieces[0].seg === 0 && flat.pieces[flat.pieces.length - 1].seg === 2, `flattenItem: ${flat.pieces.length} pieces told by the path's three sides`);
    check(offSides(item, UNIT) < 5e-6, `the flattened points lie on the sides' arcs (${fmt(offSides(item, UNIT))})`);
    for (let seg = 0; seg < 3; seg++) {
        const a = tri[seg].p, b = tri[(seg + 1) % 3].p, arc = geodesicArc(UNIT, a, b);
        check(dist(outlinePoint(item, seg, 0), a) < 1e-12 && dist(outlinePoint(item, seg, 1), b) < 1e-12 && offArc(arc, outlinePoint(item, seg, 0.37)) < 5e-6,
              `outlinePoint on side ${seg}: its ends at 0 and 1, on the arc between`);
    }
    const split = splitItemSegment(item, 2, 0.5);
    check(split.length === 4 && offArc(geodesicArc(UNIT, tri[2].p, tri[0].p), split[3].p) < 5e-6 && !split[3].h1 && !split[3].h2, 'a node inserted on the closing side lies on its geodesic');
    // the two sides it leaves are the same geodesic
    const after = { ...item, nodes: split, outline: geodesicOutline(split, true, unitPieces) };
    after.points = flattenNodes(after.outline.nodes, true);
    const whole = geodesicArc(UNIT, tri[2].p, tri[0].p);
    let off = 0;
    flattenItem(after).pieces.forEach((p, k) => { if (p.seg >= 2) off = Math.max(off, Math.min(1, offArc(whole, [after.points[2*k], after.points[2*k + 1]]))); });
    check(off < 2e-5, `and its two halves are the side it was on (${fmt(off)})`);
    // a curved side splits as a cubic
    const curved = { ...item, nodes: [node(0.5, 0, { h2: [0.5, 0.3] }), node(-0.2, 0.5, { h1: [0.1, 0.6] }), node(-0.3, -0.4)] };
    curved.outline = geodesicOutline(curved.nodes, true, unitPieces);
    check(splitItemSegment(curved, 0, 0.5)[1].smooth === true, 'a node inserted on a curved side splits the cubic');

    // the conversions
    const plain = euclideanItem(item);
    check(!plain.geodesic && !plain.outline && plain.nodes.length === c.nodes.length && plain.points.every((x, k) => Math.abs(x - item.points[k]) < 1e-12),
          'euclideanItem: the outline for the nodes, the same points, no flag');
    check(euclideanItem(plain) === plain, 'a plain item stays the object it is');
    const holder = { type: 'path', closed: true, nodes: tri, points: tri.flatMap(m => m.p), style: {}, children: [item] };
    check(euclideanItem(holder) === holder && !euclideanItem(holder, true).children[0].geodesic, 'with deep the items inside are converted too');
    const flatItem = flattenedItem(item, 5e-4);
    check(flatItem.type === 'polyline' && !flatItem.geodesic && !flatItem.nodes && flatItem.points.length > item.points.length, `flattenedItem: a plain polyline of ${flatItem.points.length/2} points through the arcs`);
    check(polylineFromPath(item) === item, 'To polyline leaves a geodesic path of straight sides as it is');
    const straight = polylineFromPath(curved);
    check(straight.geodesic && straight.nodes.length > 3 && straight.nodes.every(m => !m.h1 && !m.h2), `and turns its curved side into ${straight.nodes.length - 2} sides without handles`);
    check(!('outline' in savedItem(item)) && savedItem(item).geodesic === true && savedItem(holder).children[0].outline === undefined, 'savedItem drops the outline, here and inside');
    check(withNodes(item, tri).geodesic === true && withNodes(item, tri).outline === undefined, 'withNodes keeps the flag and drops the outline');
}

// 3 ───────────────────────────────────────────────────────────────────────────

const stroke = { stroke: { rgba: [1, 0, 0, 1] }, strokeWidth: 0.01, fill: null };
const geoTriangle = () => ({ type: 'path', closed: true, geodesic: true, nodes: [node(0.5, 0), node(-0.2, 0.5), node(-0.3, -0.4)], style: stroke });

{
    const doc = DrawingDocument();
    doc.clear();
    let notices = 0;
    doc.onChange(() => notices++);
    // without an outliner: the flag is kept, the sides are straight
    const bare = doc.insertItem(geoTriangle());
    check(bare.geodesic === true && !bare.outline && bare.points.length === 6, 'without an outliner a geodesic path keeps its flag and is drawn straight');
    const line = doc.insertItem({ type: 'polyline', points: [0, 0, 0.3, 0.1, 0.2, 0.4], style: stroke });
    const euclid = doc.insertItem({ type: 'path', closed: false, nodes: [node(0, 0), node(0.4, 0.4)], style: stroke });
    notices = 0;
    const outliner = geodesicOutliner(UNIT);
    doc.setOutliner(outliner);
    const first = doc.getItem(bare.id);
    check(notices === 1 && first !== bare && first.outline && first.outline.key === outliner.key && first.points.length > 6 && offSides(first, UNIT) < 5e-6,
          `an outliner resolves it: ${notices} notice, a new object, ${first.points.length/2} points on the arcs (${fmt(offSides(first, UNIT))})`);
    check(doc.getItem(line.id) === line && doc.getItem(euclid.id) === euclid && !doc.getItem(euclid.id).outline, 'the other items stay the objects they were');
    // the same outliner again: nothing happens
    notices = 0;
    doc.setOutliner(geodesicOutliner(UNIT));
    check(notices === 0 && doc.getItem(bare.id) === first, 'the outliner of the same geometry changes nothing');
    // another geometry: the nodes stay, the outline follows
    const other = { kind: 'hyperbolic', c: [0.1, 0], r: 2 };
    doc.setOutliner(geodesicOutliner(other));
    const second = doc.getItem(bare.id);
    check(notices === 1 && second !== first && second.nodes.every((m, k) => dist(m.p, first.nodes[k].p) === 0) && offSides(second, other) < 5e-6 && offSides(second, UNIT) > 1e-3,
          'another geometry: one notice, the nodes where they were, the sides the new geodesics');
    doc.setOutliner(geodesicOutliner({ kind: 'euclidean' }));
    const third = doc.getItem(bare.id);
    check(third.outline && third.outline.key === 'euclidean' && third.points.length === 6, 'in the plane the outline is the straight sides');
    doc.setOutliner(outliner);
    // an edit goes through the outliner
    const moved = doc.updateItem(bare.id, withNodes(doc.getItem(bare.id), [node(0.6, 0.1), node(-0.2, 0.5), node(-0.3, -0.4)]));
    check(moved.outline && moved.outline.key === outliner.key && offSides(moved, UNIT) < 5e-6, 'an updated item is resolved at once');
    // as a document loads: raw items set into the layer
    const layer = doc.getLayers()[0];
    const saved = layer.getParams().items.getValue();
    check(saved.length === 3 && saved.every(it => !('outline' in it)) && saved[0].geodesic === true, 'the saved items carry the flag and no outline');
    layer.getParams().items.setValue(saved);
    const loaded = doc.getItem(bare.id);
    check(loaded && loaded.outline && loaded.outline.key === outliner.key && offSides(loaded, UNIT) < 5e-6, 'items set into a layer as a document loads them are resolved');
    check(doc.toJSON().layers[0].items.every(it => !('outline' in it)), 'toJSON carries no outline');
    // inside a group and inside a shape
    const group = doc.insertItem({ type: 'group', children: [geoTriangle(), { type: 'polyline', points: [0, 0, 0.1, 0.1], style: stroke }], style: {} });
    const holder = doc.insertItem({ type: 'polyline', closed: true, points: [-0.6, -0.6, 0.6, -0.6, 0.6, 0.6, -0.6, 0.6], style: stroke, children: [geoTriangle()] });
    check(doc.getItem(group.id).children[0].outline && doc.getItem(holder.id).children[0].outline, 'the items a group or a shape holds are resolved on the way in');
    doc.setOutliner(geodesicOutliner(other));
    const g2 = doc.getItem(group.id), h2 = doc.getItem(holder.id);
    check(g2 !== group && h2 !== holder && g2.children[0].outline.key === geometryKey(other) && h2.children[0].outline.key === geometryKey(other) && g2.children[1] === group.children[1],
          'and again by another outliner: their holders are new objects, the plain members the same');
    check(offSides(g2.children[0], other) < 5e-6, 'the member\'s sides are the new geodesics');
}

// 4 ───────────────────────────────────────────────────────────────────────────

function newEditor(group, ptc, view = null){
    const document = DrawingDocument();
    document.clear();
    document.setOutliner(groupOutliner(group, ptc));
    const editor = DrawingEditor({
        document,
        getContext: () => ({ group, ptc, sprites: false, visLayers: [] }),
        view: view || { toCanvas: w => w, toWorld: c => ({ pnt: c }), isLinear: () => true, pixelSize: () => 0.001 },
    });
    return { doc: document, editor };
}
const PTC = { centerX: 0.1, centerY: -0.05, scale: 0.8, angle: 20 };

{
    const { doc, editor } = newEditor(g237, PTC);
    const toW = patternToWorldMap(PTC), toP = worldToPatternMap(PTC);
    const geom = editor.drawingGeometry();
    check(geom.kind === 'hyperbolic' && dist(geom.c, toW.map(0, 0)) < 1e-9 && Math.abs(geom.r - 0.8) < 1e-9, `the geometry of *237 in world coordinates: ${JSON.stringify(geom)}`);
    check(doc.getOutliner().key === geometryKey(geom) && editor.drawsGeodesics(), 'the document draws in it, and new lines are geodesic');
    editor.setStyleValue('geometry', false);
    check(editor.geometry().kind === 'euclidean' && editor.drawingGeometry().kind === 'hyperbolic' && editor.drawsGeodesics(), 'with the geometry of the moves off the paths are still drawn in the group\'s');
    editor.setStyleValue('geometry', true);
    editor.setStyleValue('geodesic', false);
    check(!editor.drawsGeodesics() && editor.getStyleParams().getValue().geodesic === false, 'the geodesic setting turns the new lines plain, and is saved with the tool settings');
    editor.setStyleValue('geodesic', true);

    // a side between two points of a mirror lies on the mirror
    const sides = g237.getFundDomain();
    const inside = g237.toFundDomain({ pnt: iPoint([0.11, 0.07, 0, 0]), maxIterations: 100 }).pnt.v;
    let worst = 0, mirrors = 0;
    for (const sp of sides) {
        // the feet of two inner points on the side, in pattern coordinates
        const foot = (z) => {
            if (sp.type === SPLANE_SPHERE) { const c = [sp.v[0], sp.v[1]], d = dist(z, c); return [c[0] + (z[0] - c[0])/d*Math.abs(sp.v[3]), c[1] + (z[1] - c[1])/d*Math.abs(sp.v[3])]; }
            const len2 = sp.v[0]*sp.v[0] + sp.v[1]*sp.v[1], t = (sp.v[0]*z[0] + sp.v[1]*z[1] - sp.v[3])/len2;
            return [z[0] - t*sp.v[0], z[1] - t*sp.v[1]];
        };
        const a = foot([inside[0] + 0.03, inside[1] - 0.02]), b = foot([inside[0] - 0.02, inside[1] + 0.04]);
        const item = doc.insertItem({ type: 'path', geodesic: true, nodes: [node(...toW.map(a[0], a[1])), node(...toW.map(b[0], b[1]))], style: stroke });
        for (let k = 0; k + 1 < item.points.length; k += 2) {
            const q = toP.map(item.points[k], item.points[k + 1]);
            worst = Math.max(worst, dist(q, foot(q))/dist(a, b));
        }
        mirrors++;
        doc.removeItem(item.id);
    }
    check(mirrors === 3 && worst < 1e-5, `a geodesic side between two points of a mirror lies on it, for the ${mirrors} mirrors (${fmt(worst)} of the side)`);

    // a move carries a geodesic polygon to its Moebius image
    const corners = [[0.12, 0.05], [0.2, 0.22], [-0.05, 0.3], [-0.2, 0.1], [0.0, -0.1]].map(p => toW.map(p[0], p[1]));
    const item = doc.insertItem({ type: 'path', closed: true, geodesic: true, nodes: corners.map(p => node(p[0], p[1])), style: stroke });
    editor.setSelection([{ id: item.id, frame: null, frameInv: null }]);
    const w0 = corners[0], w1 = toW.map(-0.45, -0.35);
    const before = doc.getItem(item.id);
    editor.applyReplace(editor.transformedSelection(new Map([[item.id, before]]), editor.moveMap(w0, w1), true));
    const movedItem = doc.getItem(item.id);
    const back = editor.moveMap(w1, w0);
    const oldArcs = before.nodes.map((m, k) => geodesicArc(geom, m.p, before.nodes[(k + 1) % before.nodes.length].p));
    let offImage = 0;
    for (const m of movedItem.outline.nodes) offImage = Math.max(offImage, Math.min(...oldArcs.map(arc => Math.min(1, offArc(arc, back(m.p))))));
    check(movedItem.geodesic && movedItem.outline && movedItem.nodes.length === 5 && offImage < 1e-8,
          `a move by an isometry: the nodes of the new outline are the images of points of the old sides (${fmt(offImage)} of their radii)`);
    check(offSides(movedItem, geom) < 5e-6, 'and its sides are geodesics where it is now');
    // a generator of the group carries it too (the copies are drawn by the same maps)
    const gen = new ITransform(g237.getTransforms()[0].slice(), 'g');
    const viaGroup = (w) => { const q = toP.map(w[0], w[1]); const im = gen.transform(iPoint([q[0], q[1], 0, 0])).v; return toW.map(im[0], im[1]); };
    const copyNodes = movedItem.nodes.map(m => node(...viaGroup(m.p)));
    const copy = doc.insertItem({ type: 'path', closed: true, geodesic: true, nodes: copyNodes, style: stroke });
    const movedArcs = copy.nodes.map((m, k) => geodesicArc(geom, m.p, copy.nodes[(k + 1) % copy.nodes.length].p));
    let offCopy = 0;
    for (const m of movedItem.outline.nodes) offCopy = Math.max(offCopy, Math.min(...movedArcs.map(arc => Math.min(1, offArc(arc, viaGroup(m.p))))));
    check(offCopy < 1e-8, `the image of the outline under a generator lies on the geodesic polygon of the images of the nodes (${fmt(offCopy)})`);
    doc.removeItem(copy.id);

    // To Euclidean and To geodesic, with undo
    editor.setSelection([{ id: item.id, frame: null, frameInv: null }]);
    const geo = doc.getItem(item.id);
    editor.setGeodesic(false);
    const plain = doc.getItem(item.id);
    check(!plain.geodesic && !plain.outline && plain.nodes.length === geo.outline.nodes.length && plain.points.every((x, k) => Math.abs(x - geo.points[k]) < 1e-12),
          'To Euclidean: a plain path of the outline\'s nodes, the same points');
    editor.undo();
    check(doc.getItem(item.id).geodesic === true && doc.getItem(item.id).nodes.length === 5 && !!doc.getItem(item.id).outline, 'undo gives the geodesic path back, resolved');
    const pl = doc.insertItem({ type: 'polyline', closed: true, points: corners.flat(), style: stroke });
    editor.setSelection([{ id: pl.id, frame: null, frameInv: null }]);
    editor.setGeodesic(true);
    const made = doc.getItem(pl.id);
    check(made.geodesic && made.type === 'path' && made.nodes.length === 5 && made.outline && offSides(made, geom) < 5e-6, 'To geodesic: a polyline becomes a path of its corners, its sides the geodesics');
    editor.undo();
    check(doc.getItem(pl.id).type === 'polyline' && !doc.getItem(pl.id).geodesic, 'undo gives the polyline back');
    doc.removeItem(pl.id);

    // a node inserted on a side lies on it, through the document
    const cur = doc.getItem(item.id);
    const inserted = doc.updateItem(item.id, withNodes(cur, splitItemSegment(cur, 1, 0.4)));
    check(inserted.nodes.length === 6 && offArc(geodesicArc(geom, cur.nodes[1].p, cur.nodes[2].p), inserted.nodes[2].p) < 5e-6 && offSides(inserted, geom) < 5e-6,
          'a node inserted on a side lies on its geodesic');

    // the line being made, as the polyline tool shows it
    const shown = editor.geodesicPolyline([corners[0], corners[2], corners[3]]);
    const a1 = geodesicArc(geom, corners[0], corners[2]), a2 = geodesicArc(geom, corners[2], corners[3]);
    let offShown = 0;
    for (const p of shown) offShown = Math.max(offShown, Math.min(Math.min(1, offArc(a1, p)), Math.min(1, offArc(a2, p))));
    check(shown.length > 3 && offShown < 5e-6, `geodesicPolyline: ${shown.length} points on the two arcs (${fmt(offShown)})`);

    // the wallpaper group and a Kleinian group: plain lines
    const wp = newEditor(g632, { centerX: 0, centerY: 0, scale: 1, angle: 0 });
    check(wp.editor.drawingGeometry().kind === 'euclidean' && !wp.editor.drawsGeodesics() && wp.doc.getOutliner().key === 'euclidean', 'a wallpaper group: the plane, new lines are plain');
    const kl = newEditor(grandma(3, 0.3), { centerX: 0, centerY: 0, scale: 1, angle: 0 });
    check(kl.editor.drawingGeometry().fallback === 'kleinian' && kl.editor.drawsGeodesics() && kl.doc.getOutliner().key.startsWith('kleinian'), 'a Kleinian group: no absolute, new lines are drawn by the local disks (section 14)');
    const bentTriangle = kl.doc.insertItem(geoTriangle());
    check(bentTriangle.geodesic && bentTriangle.outline && bentTriangle.points.length > 6, 'and a geodesic path there is drawn by arcs');
}

// 5 ───────────────────────────────────────────────────────────────────────────

function pointer(type, w, extra = {}){
    return { type, wpnt: w, canvasX: w[0], canvasY: w[1], offsetX: w[0], offsetY: w[1], button: 0, buttons: type === 'pointermove' ? 0 : 1,
             preventDefault(){}, ...extra };
}
function clickAt(tool, w, extra = {}){
    tool.handleEvent(pointer('pointerdown', w, extra));
    tool.handleEvent(pointer('pointerup', w, extra));
}

{
    const { doc, editor } = newEditor(g237, PTC);
    editor.setStyleValue('snap', false);
    const tool = PolylineTool({ editor });
    const geom = editor.drawingGeometry();
    const pts = [[0.15, 0.0], [0.3, 0.2], [0.0, 0.25]];
    clickAt(tool, pts[0]);
    clickAt(tool, pts[1]);
    tool.handleEvent(pointer('pointermove', pts[2]));
    // the line being made: two sides as arcs
    const geoShown = tool.getOverlayGeometry();
    const lines = geoShown.polylines.filter(pl => pl.points.length > 3);
    const a1 = geodesicArc(geom, pts[0], pts[1]), a2 = geodesicArc(geom, pts[1], pts[2]);
    let off = 1;
    if (lines.length) { off = 0; for (const p of lines[0].points) off = Math.max(off, Math.min(Math.min(1, offArc(a1, p)), Math.min(1, offArc(a2, p)))); }
    check(lines.length === 1 && off < 5e-6, `the line being made is shown as arcs (${lines.length ? lines[0].points.length : 0} points, ${fmt(off)} off them)`);
    clickAt(tool, pts[2]);
    tool.handleEvent({ type: 'dblclick', wpnt: pts[2], canvasX: pts[2][0], canvasY: pts[2][1], preventDefault(){} });
    const items = doc.getAllItems();
    const made = items[items.length - 1];
    check(items.length === 1 && made.type === 'path' && made.geodesic === true && made.nodes.length === 3 && !made.closed && !!made.outline && offSides(made, geom) < 5e-6,
          `clicks with geodesic lines on: a geodesic path of ${made.nodes ? made.nodes.length : 0} nodes`);
    check(editor.canUndo(), 'one undo step');
    // closing by a click on the first vertex
    const loop = [[-0.3, -0.1], [-0.1, -0.3], [-0.35, -0.35]];
    loop.forEach(p => clickAt(tool, p));
    tool.handleEvent(pointer('pointerdown', loop[0]));
    tool.handleEvent(pointer('pointerup', loop[0]));
    const closed = doc.getAllItems()[1];
    check(closed && closed.closed && closed.geodesic && closed.nodes.length === 3 && offSides(closed, geom) < 5e-6, 'a click on the first vertex closes the geodesic path');

    // Shift: the side leaves the last vertex in a 15 degree step and ends as far as the pointer
    clickAt(tool, [0.2, -0.3]);
    const aim = [0.37, -0.2];       // about 30.5 degrees up from the last vertex
    tool.handleEvent(pointer('pointermove', aim, { shiftKey: true }));
    clickAt(tool, aim, { shiftKey: true });
    tool.handleKey({ type: 'keydown', key: 'Enter' });
    const ray = doc.getAllItems()[2];
    const s = canonicalChart(geom, ray.nodes[0].p), w = mobiusApply(s, ray.nodes[1].p), wa = mobiusApply(s, aim);
    const angle = Math.atan2(w[1], w[0])*180/Math.PI;
    check(ray && ray.geodesic && Math.abs(angle - 30) < 1e-6 && Math.abs(Math.hypot(w[0], w[1]) - Math.hypot(wa[0], wa[1])) < 1e-9,
          `with Shift the side leaves at ${angle.toFixed(6)} degrees and is as long as the pointer is far`);

    // the setting off: a plain polyline
    editor.setStyleValue('geodesic', false);
    clickAt(tool, [0.4, 0.4]);
    clickAt(tool, [0.5, 0.3]);
    tool.handleKey({ type: 'keydown', key: 'Enter' });
    const plain = doc.getAllItems()[3];
    check(plain && plain.type === 'polyline' && !plain.geodesic && plain.points.length === 4, 'with the setting off the line is a plain polyline');

    // a wallpaper group: a polyline whatever the setting
    const wp = newEditor(g632, { centerX: 0, centerY: 0, scale: 1, angle: 0 });
    wp.editor.setStyleValue('snap', false);
    const wtool = PolylineTool({ editor: wp.editor });
    clickAt(wtool, [0.1, 0.1]);
    clickAt(wtool, [0.3, 0.2]);
    wtool.handleKey({ type: 'keydown', key: 'Enter' });
    const wline = wp.doc.getAllItems()[0];
    check(wline && wline.type === 'polyline' && !wline.geodesic, 'in a wallpaper group the line is a polyline, as before');
    check(wtool.getProperties().some(p => p.visible && p.visible() === false) && tool.getProperties().every(p => !p.visible || p.visible()), 'the geodesic toggle shows only where the geometry is not the plane');
}

// 6 ───────────────────────────────────────────────────────────────────────────

{
    const doc = DrawingDocument();
    doc.clear();
    doc.setOutliner(geodesicOutliner(UNIT));
    const item = doc.insertItem(geoTriangle());
    // what the renderer traces: the cubics of the outline
    const ops = [];
    traceNodes(drawnNodes(item), item.closed, {
        moveTo: (x, y) => ops.push(['M', x, y]), lineTo: (x, y) => ops.push(['L', x, y]),
        bezierCurveTo: (...c) => ops.push(['C', ...c]), closePath: () => ops.push(['Z']),
    });
    const curves = ops.filter(o => o[0] === 'C');
    let off = 0;
    const arcs = item.nodes.map((m, k) => geodesicArc(UNIT, m.p, item.nodes[(k + 1) % 3].p));
    let p0 = [ops[0][1], ops[0][2]];
    for (const c of curves) {
        const p3 = [c[5], c[6]];
        for (const t of [0.3, 0.7]) off = Math.max(off, Math.min(...arcs.map(arc => Math.min(1, offArc(arc, cubicAt(p0, [c[1], c[2]], [c[3], c[4]], p3, t))))));
        p0 = p3;
    }
    check(curves.length >= 3 && ops.filter(o => o[0] === 'L').length === 0 && off < 5e-6, `the renderer traces ${curves.length} cubics along the arcs (${fmt(off)}) and no straight side`);
    const svg = itemsToSvg(doc.getItems());
    check((svg.match(/ C /g) || []).length >= 3 && !/ L /.test(svg), 'the SVG of the drawing has the cubics');
    const psvg = patternSvg({ items: doc.getItems(), group: g237, ptc: { centerX: 0, centerY: 0, scale: 1, angle: 0 }, region: [-0.6, -0.6, 0.6, 0.6] });
    check((psvg.match(/<path/g) || []).length > 3 && (/ C /.test(psvg) || / L /.test(psvg)), `the SVG of the pattern has the copies (${(psvg.match(/<path/g) || []).length} paths)`);
    // the fold: the outline in pattern coordinates
    const ptc = { centerX: 0.1, centerY: -0.05, scale: 0.8, angle: 20 };
    const groups = foldItems(doc.getItems(), null, ptc);
    const folded = groups[0].items[0], toP = worldToPatternMap(ptc);
    const want = toP.map(item.outline.nodes[1].p[0], item.outline.nodes[1].p[1]);
    check(folded.outline && folded.outline.nodes.length === item.outline.nodes.length && dist(folded.outline.nodes[1].p, want) < 1e-12
          && dist(folded.outline.nodes[1].h1, toP.map(...item.outline.nodes[1].h1)) < 1e-12, 'the fold carries the outline, handles and all, to pattern coordinates');
}

// 7 ───────────────────────────────────────────────────────────────────────────

/** the largest distance from the points of a to the polyline b */
function deviation(a, b){
    let worst = 0;
    for (const p of a) {
        let best = Infinity;
        for (let i = 0; i + 1 < b.length; i++) {
            const vx = b[i + 1][0] - b[i][0], vy = b[i + 1][1] - b[i][1], wx = p[0] - b[i][0], wy = p[1] - b[i][1];
            const t = Math.max(0, Math.min(1, (vx*wx + vy*wy)/(vx*vx + vy*vy || 1)));
            best = Math.min(best, Math.hypot(wx - t*vx, wy - t*vy));
        }
        worst = Math.max(worst, best);
    }
    return worst;
}
/** points along cubic pieces [{c1, c2, p}] from P0 */
function piecePoints(P0, pieces, per = 24){
    const out = [];
    let p0 = P0;
    for (const piece of pieces) {
        for (let i = 0; i < per; i++) out.push(cubicAt(p0, piece.c1, piece.c2, piece.p, i/per));
        p0 = piece.p;
    }
    out.push(p0);
    return out;
}
const curveFine = (geom, cp, n = 600) => Array.from({ length: n + 1 }, (_, i) => geodesicCurvePoint(geom, cp, i/n));
const spread = pts => Math.max(Math.max(...pts.map(p => p[0])) - Math.min(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1])) - Math.min(...pts.map(p => p[1])));
const unitOf = v => { const n = Math.hypot(v[0], v[1]) || 1; return [v[0]/n, v[1]/n]; };

{
    for (const [name, geom, pick] of GEOMETRIES) {
        const k = geom.kind === 'spherical' ? 1 : (geom.kind === 'euclidean' ? 0 : -1);
        const radius = d => (k < 0 ? Math.tanh(d/2) : (k > 0 ? Math.tan(d/2) : d));
        let carried = 0, tangent = 0, reversed = 0, onGeodesic = 0, piecesOff = 0, most = 0, ranges = true, splitOff = 0, halvesOff = 0, kink = 0, n = 0;
        for (let trial = 0; trial < 60; trial++) {
            // (outside a disk the far points are next to the centre of the model, the point at
            // infinity: a segment there runs out of every picture; these start near the disk)
            const P0 = name === 'outside the unit disk' ? polar(1.2 + 0.6*rnd(), 2*Math.PI*rnd()) : pick();
            // the other control points within a moderate distance of P0, by its chart
            const s0 = canonicalChart(geom, P0), s0i = mobiusInverse(s0);
            const size = 0.2 + 0.6*rnd();
            const near = () => mobiusApply(s0i, polar(radius(size*(0.3 + 0.7*rnd())), 2*Math.PI*rnd()));
            const cp = [P0, near(), near(), near()];
            n++;
            // an isometry: a translation, a turn, every second time a reflection too
            const m = mobiusCompose(rotationAbout(geom, pick(), 2*Math.PI*rnd()), translationTo(geom, pick(), pick()));
            const refl = trial % 2 ? reflectionAbout(geom, pick(), polar(1, Math.PI*rnd())) : null;
            const iso = z => { const w = mobiusApply(m, z); return refl ? refl(w) : w; };
            const cq = cp.map(iso);
            for (const t of [0.2, 0.5, 0.9]) {
                const z = geodesicCurvePoint(geom, cp, t), zi = geodesicCurvePoint(geom, cq, t), zr = geodesicCurvePoint(geom, cp.slice().reverse(), 1 - t);
                if (!z || !zi || !zr) { carried = 1; continue; }
                carried = Math.max(carried, dist(iso(z), zi)/(1 + Math.hypot(zi[0], zi[1])));
                reversed = Math.max(reversed, dist(z, zr)/(1 + Math.hypot(z[0], z[1])));
            }
            // it leaves P0 along the geodesic to the first handle
            const eps = 1e-5, w1 = mobiusApply(s0, cp[1]), dir = unitOf([geodesicCurvePoint(geom, cp, eps)[0] - P0[0], geodesicCurvePoint(geom, cp, eps)[1] - P0[1]]), want = unitOf(w1);
            tangent = Math.max(tangent, Math.abs(dir[0]*want[1] - dir[1]*want[0]));
            // handles on the geodesic of the ends: the curve is that geodesic
            const arc = geodesicArc(geom, P0, cp[3]);
            if (arc) {
                const on = [P0, arcPoint(arc, 0.2 + 0.2*rnd()), arcPoint(arc, 0.6 + 0.3*rnd()), cp[3]];
                for (const t of [0.3, 0.7]) onGeodesic = Math.max(onGeodesic, Math.min(1, offArc(arc, geodesicCurvePoint(geom, on, t))*(arc.line ? 1 : Math.min(1, arc.radius))));
            }
            // the cubic pieces and the split
            const pieces = geodesicCurveCubics(geom, cp), halves = geodesicCurveSplit(geom, cp, 0.4);
            if (k === 0) { if (pieces !== null || halves !== null) ranges = false; continue; }
            const fine = curveFine(geom, cp, 6000), extent = spread(cp);
            piecesOff = Math.max(piecesOff, deviation(piecePoints(P0, pieces), fine)/extent);
            most = Math.max(most, pieces.length);
            if (pieces[0].t0 !== 0 || pieces[pieces.length - 1].t1 !== 1 || pieces.some((p, i) => i > 0 && p.t0 !== pieces[i - 1].t1) || dist(pieces[pieces.length - 1].p, cp[3]) !== 0) ranges = false;
            const M = halves.left[3], at = geodesicCurvePoint(geom, cp, 0.4);
            splitOff = Math.max(splitOff, dist(M, at)/(1 + Math.hypot(at[0], at[1])));
            const both = [...curveFine(geom, halves.left, 150), ...curveFine(geom, halves.right, 150)];
            halvesOff = Math.max(halvesOff, deviation(both, fine)/dist(P0, cp[3]));
            // the two handles of the new node in line through it, in its chart
            const sm = canonicalChart(geom, M), u = mobiusApply(sm, halves.left[2]), v = mobiusApply(sm, halves.right[1]);
            kink = Math.max(kink, Math.abs(u[0]*v[1] - u[1]*v[0])/(Math.hypot(u[0], u[1])*Math.hypot(v[0], v[1]) || 1) + (u[0]*v[0] + u[1]*v[1] < 0 ? 0 : 1));
        }
        check(carried < 1e-7 && tangent < 1e-4 && reversed < 1e-9 && onGeodesic < 1e-8 && ranges && piecesOff < 1.5e-4 && most <= 64 && splitOff < 1e-10 && kink < 1e-8,
              `${name}: ${n} cubic segments: off after an isometry ${fmt(carried)}, the end tangent off the geodesic to the handle ${fmt(tangent)}, reversed ${fmt(reversed)}, ` +
              `handles on the geodesic: off it ${fmt(onGeodesic)}; the cubic pieces off the curve ${fmt(piecesOff)} of the extent (at most ${most}), their parts in a row ${ranges}; ` +
              `split: the node off the curve ${fmt(splitOff)}, its handles off one line ${fmt(kink)}, the halves off the segment ${fmt(halvesOff)} of the chord`);
        if (k !== 0) console.log(`  ${name}: cubic segments drawn by at most ${most} cubic pieces, ${fmt(piecesOff)} of their extent off; a split moves the curve by up to ${fmt(halvesOff)} of the chord`);
    }
    const disk = { kind: 'hyperbolic', c: [0, 0], r: 1 };
    const out = [[-0.3, 0.1], [-0.1, 1.5], [0.3, 0.5], [0.5, 0.0]];
    check(geodesicCurveCubics(disk, out) === null && geodesicCurveSplit(disk, out, 0.5) === null && geodesicCurvePoint(disk, out, 0.5) === null, 'a handle past the absolute: the geometry does not draw the segment');
    const cp = [[0.1, 0.2], [0.5, 0.9], [1.1, -0.3], [1.4, 0.4]];
    check(dist(geodesicCurvePoint({ kind: 'euclidean' }, cp, 0.3), cubicAt(...cp, 0.3)) < 1e-15, 'in the plane a cubic segment is the Euclidean cubic');
    // a missing handle is a control point on the node: no velocity there
    const one = geodesicCurveCubics(disk, [[-0.3, 0.1], [-0.3, 0.1], [0.3, 0.5], [0.5, 0.0]]);
    check(one && dist(one[0].c1, [-0.3, 0.1]) < 1e-12, 'a control point on its node: the curve starts there at rest');
}

// 8 ───────────────────────────────────────────────────────────────────────────

{
    const outliner = geodesicOutliner(UNIT), chart = outliner.chart;
    const plane = geodesicOutliner({ kind: 'euclidean' });
    check(plane.chart === null && plane.split === null && typeof chart === 'function' && typeof outliner.split === 'function', 'the outliner has the chart of a node and the split of a curved side, none of them in the plane');
    // in the chart of p: how far a and b are from one line through p, 1 more when they are on the same side
    const offLine = (p, a, b) => {
        const c = chart(p), u = c.to(a), v = c.to(b);
        return Math.abs(u[0]*v[1] - u[1]*v[0])/(Math.hypot(u[0], u[1])*Math.hypot(v[0], v[1])) + (u[0]*v[0] + u[1]*v[1] < 0 ? 0 : 1);
    };
    const P = [0.35, 0.2], X = [0.5, 0.35];
    // handles pulled out of a node
    const pulled = nodeHandlesPulled([node(...P)], 0, X, chart)[0];
    check(pulled.smooth && dist(pulled.h2, X) === 0 && dist(pulled.p, P) === 0 && offLine(P, pulled.h1, pulled.h2) < 1e-12
          && Math.abs(geodesicDistance(UNIT, P, pulled.h1) - geodesicDistance(UNIT, P, pulled.h2)) < 1e-12,
          'handles pulled out of a node: one at the pointer, the other as far along the same geodesic through the node');
    const flatPulled = nodeHandlesPulled([node(...P)], 0, X)[0];
    check(dist(flatPulled.h1, [0.2, 0.05]) < 1e-15 && dist(pulled.h1, flatPulled.h1) > 1e-3, 'without the chart: the mirror image in the plane, as ever (another point)');
    // a handle of a smooth node dragged: the other turns to stay in line and keeps its length
    const short = { ...pulled, h1: chart(P).from(chart(P).to(pulled.h1).map(x => 0.5*x)) };
    const lenBefore = geodesicDistance(UNIT, P, short.h1), Y = [0.3, 0.45];
    const turned = handleMoved([short], 0, 'h2', Y, true, chart)[0];
    check(dist(turned.h2, Y) === 0 && turned.smooth && offLine(P, turned.h1, turned.h2) < 1e-12 && Math.abs(geodesicDistance(UNIT, P, turned.h1) - lenBefore) < 1e-12,
          'a dragged handle of a smooth node: the other turns onto the same geodesic and keeps its length in the metric');
    const broken = handleMoved([short], 0, 'h2', Y, false, chart)[0];
    check(broken.smooth === false && dist(broken.h1, short.h1) < 1e-12 && dist(broken.h2, Y) === 0, 'with Alt the node becomes a corner, the other handle stays');
    // a corner made smooth: its new handles in line, a third of the way to its neighbours in its chart
    const three = [node(0.1, 0.1), node(...P), node(0.55, 0.05)];
    const smooth = nodeSmoothToggled(three, 1, false, chart);
    const c = chart(P), toPrev = c.to(three[0].p), toNext = c.to(three[2].p), h1 = c.to(smooth[1].h1), h2 = c.to(smooth[1].h2);
    check(smooth[1].smooth && smooth[0] === three[0] && smooth[2] === three[2] && offLine(P, smooth[1].h1, smooth[1].h2) < 1e-12
          && Math.abs(Math.hypot(h1[0], h1[1]) - Math.hypot(toPrev[0], toPrev[1])/3) < 1e-12 && Math.abs(Math.hypot(h2[0], h2[1]) - Math.hypot(toNext[0], toNext[1])/3) < 1e-12,
          'a corner made smooth: handles on one geodesic through it, a third of the way to its neighbours as seen from it; the neighbours untouched');
    check(nodeSmoothToggled(smooth, 1, false, chart)[1].smooth === false, 'and a corner again');
    // a moved node takes its handles along as they are seen from it
    const Z = [-0.2, 0.4];
    const moved = nodeMoved([node(0, 0), turned], 1, Z, chart);
    const seen = (p, h) => chart(p).to(h);
    check(moved[0].p[0] === 0 && dist(moved[1].p, Z) === 0 && dist(seen(Z, moved[1].h1), seen(P, turned.h1)) < 1e-12 && dist(seen(Z, moved[1].h2), seen(P, turned.h2)) < 1e-12
          && offLine(Z, moved[1].h1, moved[1].h2) < 1e-12,
          'a moved node: its handles are seen from it as before (the same picture in its chart), still in line');
    const shifted = nodeMoved([turned], 0, Z)[0];
    check(dist(shifted.h1, [turned.h1[0] + Z[0] - P[0], turned.h1[1] + Z[1] - P[1]]) < 1e-15, 'without the chart: the handles shifted with the node');

    // the outline of a path with a smooth node: no kink there, with the handles of the chart
    const path = (mid) => [node(0.05, 0.05), mid, node(0.6, 0.0)];
    const kinkAt = (nodes) => {
        const o = outliner.outline(nodes, false);
        const k = o.source.findIndex(s => s && s.seg === 1), m = o.nodes[k];
        const a = [m.p[0] - m.h1[0], m.p[1] - m.h1[1]], b = [m.h2[0] - m.p[0], m.h2[1] - m.p[1]];
        return Math.abs(a[0]*b[1] - a[1]*b[0])/(Math.hypot(a[0], a[1])*Math.hypot(b[0], b[1]));
    };
    check(kinkAt(path(pulled)) < 1e-9 && kinkAt(path(flatPulled)) > 1e-3,
          `the curve through a smooth node has one tangent there (${fmt(kinkAt(path(pulled)))}); with handles in line on screen only it would have a kink (${fmt(kinkAt(path(flatPulled)))})`);

    // the outline of a curved side is the geometry's cubic, and flattenItem tells where on it a point is
    const nodes = path(pulled);
    const o = outliner.outline(nodes, false);
    const item = { type: 'path', closed: false, geodesic: true, nodes, outline: o, points: flattenNodes(o.nodes, false), style: {} };
    const sides = [[nodes[0].p, nodes[0].p, nodes[1].h1, nodes[1].p], [nodes[1].p, nodes[1].h2, nodes[2].p, nodes[2].p]];
    const flat = flattenItem(item);
    let off = 0, tOff = 0, count = [0, 0];
    flat.pieces.forEach((piece, i) => {
        const p = [flat.points[2*i + 2], flat.points[2*i + 3]], cp = sides[piece.seg];
        count[piece.seg]++;
        off = Math.max(off, deviation([p], curveFine(UNIT, cp))/spread(cp));
        tOff = Math.max(tOff, dist(p, geodesicCurvePoint(UNIT, cp, piece.t1))/spread(cp));
    });
    check(o.nodes.length > 3 && count[0] > 1 && count[1] > 1 && off < 1.5e-4 && tOff < 2e-3,
          `the outline of the curved sides: ${o.nodes.length} nodes; the flattened points off the geometry's cubics ${fmt(off)} of their extent, the parameters flattenItem tells off by ${fmt(tOff)}`);
    // a node inserted on a curved side: on the curve, smooth, its handles in line; the curve moves little
    const split = splitItemSegment(item, 1, 0.5, outliner.split);
    const fresh = split[2], at = geodesicCurvePoint(UNIT, sides[1], 0.5);
    const after = outliner.outline(split, false);
    const movedBy = deviation(piecePoints(after.nodes[0].p, after.nodes.slice(1).map((m, i) => ({ c1: after.nodes[i].h2 || after.nodes[i].p, c2: m.h1 || m.p, p: m.p }))),
                              piecePoints(o.nodes[0].p, o.nodes.slice(1).map((m, i) => ({ c1: o.nodes[i].h2 || o.nodes[i].p, c2: m.h1 || m.p, p: m.p })), 60))/dist(nodes[1].p, nodes[2].p);
    check(split.length === 4 && dist(fresh.p, at) < 1e-12 && fresh.smooth && offLine(fresh.p, fresh.h1, fresh.h2) < 1e-9 && dist(split[1].h1, nodes[1].h1) === 0
          && dist(split[1].h2, nodes[1].h2) > 1e-6 && movedBy < 0.01,
          `a node inserted on a curved side lies on the curve, smooth, its handles on one geodesic; the path moves by ${fmt(movedBy)} of the side`);
    check(splitItemSegment(item, 1, 0.5)[2].smooth === true && dist(splitItemSegment(item, 1, 0.5)[2].p, at) > 1e-6, 'without the split of the geometry the side is split as a Euclidean cubic');
    // To polyline: the curved sides as runs of sides on the curve
    const straight = polylineFromPath(item);
    let offNodes = 0;
    for (const m of straight.nodes) offNodes = Math.max(offNodes, Math.min(deviation([m.p], curveFine(UNIT, sides[0])), deviation([m.p], curveFine(UNIT, sides[1]))));
    check(straight.geodesic && straight.nodes.length > 6 && straight.nodes.every(m => !m.h1 && !m.h2) && dist(straight.nodes[0].p, nodes[0].p) === 0
          && dist(straight.nodes[straight.nodes.length - 1].p, nodes[2].p) === 0 && offNodes < 2e-4,
          `To polyline: ${straight.nodes.length} nodes without handles on the geometry's curves (${fmt(offNodes)})`);
}

// 9 ───────────────────────────────────────────────────────────────────────────

{
    const { doc, editor } = newEditor(g237, PTC);
    const geom = editor.drawingGeometry();
    const toW = patternToWorldMap(PTC);
    const chart = doc.getOutliner().chart;
    const at = (x, y) => toW.map(x, y);
    let nodes = [at(0.12, 0.05), at(0.25, 0.2), at(0.02, 0.3)].map(p => node(p[0], p[1]));
    nodes = nodeHandlesPulled(nodes, 0, at(0.2, 0.02), chart);
    nodes = nodeHandlesPulled(nodes, 1, at(0.22, 0.3), chart);
    nodes = nodeHandlesPulled(nodes, 2, at(-0.05, 0.22), chart);
    const item = doc.insertItem({ type: 'path', closed: true, geodesic: true, nodes, style: stroke });
    const plain = doc.insertItem({ type: 'path', closed: true, nodes, style: stroke });
    const sidesOf = (it) => it.nodes.map((m, k) => { const b = it.nodes[(k + 1) % it.nodes.length]; return [m.p, m.h2 || m.p, b.h1 || b.p, b.p]; });
    const offCurves = (it, g) => {
        const fine = sidesOf(it).map(cp => curveFine(g, cp));
        const flat = flattenItem(it);
        let worst = 0;
        flat.pieces.forEach((piece, i) => {
            const j = (i + 1) % (flat.points.length/2);
            worst = Math.max(worst, deviation([[flat.points[2*j], flat.points[2*j + 1]]], fine[piece.seg])/spread(sidesOf(it)[piece.seg]));
        });
        return worst;
    };
    check(item.outline && item.outline.nodes.length > 3 && offCurves(item, geom) < 1.5e-4 && offCurves(plain, { kind: 'euclidean' }) < 2e-3 && offCurves(plain, geom) > 2e-3,
          `in the document a geodesic path with handles is drawn by the cubics of the geometry (${fmt(offCurves(item, geom))} of their extent), the plain path of the same nodes by the plane's`);
    check(editor.nodeChart(item) === chart && editor.nodeChart(plain) === null && editor.curveSplitter(item) === doc.getOutliner().split && editor.curveSplitter(plain) === null
          && editor.drawingChart() === chart, 'the editor gives the chart and the split for a geodesic path, none for a plain one');
    // a move by an isometry: the nodes and handles are mapped, and the path is the image of the path
    editor.setSelection([{ id: item.id, frame: null, frameInv: null }]);
    const w0 = item.nodes[0].p, w1 = at(-0.4, -0.3);
    const map = editor.moveMap(w0, w1), back = editor.moveMap(w1, w0);
    editor.applyReplace(editor.transformedSelection(new Map([[item.id, item]]), map, true));
    const moved = doc.getItem(item.id);
    let nodeOff = 0;
    moved.nodes.forEach((m, k) => { for (const key of ['p', 'h1', 'h2']) nodeOff = Math.max(nodeOff, dist(m[key], map(item.nodes[k][key]))); });
    const oldFine = sidesOf(item).flatMap(cp => curveFine(geom, cp));
    const newPts = [];
    for (let i = 0; i + 1 < moved.points.length; i += 2) newPts.push(back([moved.points[i], moved.points[i + 1]]));
    const imageOff = deviation(newPts, oldFine)/spread(item.nodes.map(m => m.p));
    check(nodeOff < 1e-12 && offCurves(moved, geom) < 1.5e-4 && imageOff < 3e-4,
          `a move by an isometry: nodes and handles mapped (${fmt(nodeOff)}), the moved path is the image of the path (${fmt(imageOff)} of its size)`);
    // the conversions
    editor.setGeodesic(false);
    const euclid = doc.getItem(item.id);
    check(!euclid.geodesic && euclid.nodes.length === moved.outline.nodes.length && euclid.points.every((x, i) => Math.abs(x - moved.points[i]) < 1e-12), 'To Euclidean: the plain path of the outline, the same points');
    editor.undo();
    editor.setSelection([{ id: item.id, frame: null, frameInv: null }]);
    editor.convertSelection(false);
    const runs = doc.getItem(item.id);
    check(runs.geodesic && runs.nodes.length > 6 && runs.nodes.every(m => !m.h1 && !m.h2) && deviation(runs.nodes.map(m => back(m.p)), oldFine)/spread(item.nodes.map(m => m.p)) < 3e-4,
          `To polyline: a geodesic path of ${runs.nodes.length} nodes without handles on the curves`);
    editor.undo();
    // a wallpaper group: no chart, the edits are the plane's
    const wp = newEditor(g632, { centerX: 0, centerY: 0, scale: 1, angle: 0 });
    const flatItem = wp.doc.insertItem({ type: 'path', closed: false, geodesic: true, nodes: [node(0, 0, { h2: [0.1, 0.2] }), node(0.4, 0.1, { h1: [0.3, 0.3] })], style: stroke });
    check(wp.editor.nodeChart(flatItem) === null && wp.editor.curveSplitter(flatItem) === null && wp.editor.drawingChart() === null
          && flatItem.outline.nodes.length === 2 && dist(flatItem.outline.nodes[0].h2, [0.1, 0.2]) === 0, 'in the plane a geodesic path is its own cubics, edited as ever');
}

// 10 ──────────────────────────────────────────────────────────────────────────

{
    // a view with pixels: a drag of the pen is told from a click by them
    const view = { toCanvas: w => [1000*w[0], 1000*w[1]], toWorld: c => ({ pnt: [c[0]/1000, c[1]/1000] }), isLinear: () => true, pixelSize: () => 0.001 };
    const { doc, editor } = newEditor(g237, PTC, view);
    editor.setStyleValue('snap', false);
    const tool = PenTool({ editor });
    const geom = editor.drawingGeometry(), chart = doc.getOutliner().chart;
    const ev = (type, w, extra = {}) => ({ type, wpnt: w, canvasX: 1000*w[0], canvasY: 1000*w[1], button: 0, buttons: type === 'pointerup' ? 0 : 1, preventDefault(){}, ...extra });
    const press = (w, pullTo = null) => {
        tool.handleEvent(ev('pointerdown', w));
        if (pullTo) tool.handleEvent(ev('pointermove', pullTo));
        tool.handleEvent(ev('pointerup', pullTo || w));
    };
    const offLine = (p, a, b) => {
        const c = chart(p), u = c.to(a), v = c.to(b);
        return Math.abs(u[0]*v[1] - u[1]*v[0])/(Math.hypot(u[0], u[1])*Math.hypot(v[0], v[1])) + (u[0]*v[0] + u[1]*v[1] < 0 ? 0 : 1);
    };
    const A = [0.15, 0.0], A2 = [0.25, 0.08], B = [0.3, 0.25], C = [0.05, 0.3], C2 = [-0.05, 0.25], D = [-0.1, 0.1];
    press(A, A2);
    press(B);
    press(C, C2);
    tool.handleEvent(ev('pointermove', D, { buttons: 0 }));
    // the path being made: drawn by the geometry, the stalks of the last node's handles geodesics
    const shown = tool.getOverlayGeometry();
    const stalks = shown.polylines.filter(pl => pl.width === 1);
    let stalkOff = 0;
    for (const pl of stalks) {
        const arc = geodesicArc(geom, pl.points[0], pl.points[pl.points.length - 1]);
        for (const q of pl.points) stalkOff = Math.max(stalkOff, Math.min(1, offArc(arc, q)));
    }
    const outline = shown.polylines.find(pl => pl.width !== 1);
    check(stalks.length === 2 && stalks.every(pl => pl.points.length > 2 && dist(pl.points[0], C) === 0) && stalkOff < 5e-6 && outline && outline.points.length > 8,
          `the pen's path being made: ${outline ? outline.points.length : 0} points, the stalks of the last node's handles on geodesics (${fmt(stalkOff)})`);
    tool.handleKey({ type: 'keydown', key: 'Enter' });
    const made = doc.getAllItems()[0];
    const first = made && made.nodes && made.nodes[0], last = made && made.nodes && made.nodes[2];
    check(made && made.type === 'path' && made.geodesic === true && made.nodes.length === 3 && !made.closed && !!made.outline
          && first.smooth && dist(first.h2, A2) === 0 && offLine(A, first.h1, first.h2) < 1e-12 && Math.abs(geodesicDistance(geom, A, first.h1) - geodesicDistance(geom, A, first.h2)) < 1e-12
          && !made.nodes[1].h1 && !made.nodes[1].h2 && last.smooth && offLine(C, last.h1, last.h2) < 1e-12,
          'the pen with geodesic lines on: a geodesic path, the handles of a dragged node pulled out along one geodesic through it, as far both ways');
    // what was shown is what is drawn: the first two sides
    let shownOff = 0;
    const drawn = [];
    for (let i = 0; i + 1 < made.points.length; i += 2) drawn.push([made.points[i], made.points[i + 1]]);
    if (outline) shownOff = deviation(drawn, outline.points)/spread(made.nodes.map(m => m.p));
    // (the two are flattened apart, each within 2e-3 of its extent)
    check(shownOff < 4e-3, `the path was shown while made as it is drawn (${fmt(shownOff)} of its size)`);
    // corners only: still a geodesic path
    press([0.4, -0.2]);
    press([0.5, -0.1]);
    tool.handleKey({ type: 'keydown', key: 'Enter' });
    const corners = doc.getAllItems()[1];
    check(corners && corners.type === 'path' && corners.geodesic === true && corners.nodes.every(m => !m.h1 && !m.h2) && corners.points.length > 4, 'corner nodes only: a geodesic path of straight sides (arcs)');
    // the setting off: the plain path, its handles mirrored in the plane
    editor.setStyleValue('geodesic', false);
    press(A, A2);
    press(B);
    tool.handleKey({ type: 'keydown', key: 'Enter' });
    const plain = doc.getAllItems()[2];
    check(plain && plain.type === 'path' && !plain.geodesic && dist(plain.nodes[0].h1, [2*A[0] - A2[0], 2*A[1] - A2[1]]) < 1e-15 && !plain.outline, 'with the setting off the pen draws the plain path, as before');
    check(tool.getProperties().length === 2, 'the pen has the geodesic toggle in its bar');
}

// 11 ──────────────────────────────────────────────────────────────────────────

/** the drawn curve of a shape in a space: its skeleton outlined and flattened finely, as points */
function drawnShape(shape, geom, sp){
    const g = shapeGeometry(shape, sp);
    const outliner = geodesicOutliner(geom);
    const o = outliner.outline(g.nodes, g.closed);
    const flat = flattenNodes(o.nodes, g.closed, 1e-5*spread(o.nodes.map(m => m.p)));
    const pts = [];
    for (let i = 0; i + 1 < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
    if (g.closed) pts.push(pts[0]);
    return { nodes: g.nodes, closed: g.closed, outline: o.nodes, pts };
}
/** the metric length of a shape's size (a world length at the model's centre) in the metric of curvature -1 or 1 */
const metricOf = (geom, L) => L/(0.5*(geom.kind === 'spherical' ? geom.R : geom.r));
/** the point's chart coordinates in the space's chart of C, as fractions of the chart radii a, b */
const onEllipse = (sp, C, a, b, q) => { const k = sp.chart(C).to(q); return Math.hypot(k[0]/a, k[1]/b); };
/** the Euclidean circle through three points: {c, r} */
function circleThrough(p, q, s){
    const ax = p[0], ay = p[1], bx = q[0], by = q[1], cx = s[0], cy = s[1];
    const d = 2*(ax*(by - cy) + bx*(cy - ay) + cx*(ay - by));
    const ux = ((ax*ax + ay*ay)*(by - cy) + (bx*bx + by*by)*(cy - ay) + (cx*cx + cy*cy)*(ay - by))/d;
    const uy = ((ax*ax + ay*ay)*(cx - bx) + (bx*bx + by*by)*(ax - cx) + (cx*cx + cy*cy)*(bx - ax))/d;
    return { c: [ux, uy], r: Math.hypot(ax - ux, ay - uy) };
}

const SPACES = [
    ['the unit disk',              { kind: 'hyperbolic', c: [0, 0], r: 1 },        [0.25, -0.15]],
    ['the disk (0.3, -0.2), 1.7',  { kind: 'hyperbolic', c: [0.3, -0.2], r: 1.7 }, [0.8, 0.3]],
    ['the sphere (0.4, 0.1), 0.8', { kind: 'spherical', c: [0.4, 0.1], R: 0.8 },   [0.7, -0.2]],
];

for (const [name, geom, C] of SPACES) {
    const sp = shapeSpace(geom);
    const half = 0.5*(geom.kind === 'spherical' ? geom.R : geom.r);
    const chart = sp.chart(C);
    // the chart and the sizes
    let off = 0, offSize = 0;
    for (let i = 0; i < 20; i++) {
        const q = polar(0.6*half*rnd(), 2*Math.PI*rnd());
        off = Math.max(off, dist(chart.to(chart.from(q)), q)/half);
        const L = 0.5*half*rnd();
        offSize = Math.max(offSize, Math.abs(sp.length(sp.size(L)) - L)/L);
    }
    const w = chart.from([0.3*half, 0]);
    check(off < 1e-12 && offSize < 1e-12 && Math.abs(geodesicDistance(geom, C, w) - metricOf(geom, sp.length(0.3*half))) < 1e-12,
          `${name}: the chart and its inverse, size and length, and a chart radius is the length it says (${fmt(off)}, ${fmt(offSize)})`);
    const centre = sp.chart(geom.c), e = 1e-3*half;
    check(dist(centre.to([geom.c[0] + e, geom.c[1] + 0.5*e]), [e, 0.5*e]) < 1e-8*half && Math.abs(sp.size(e) - e) < 1e-8*half,
          `${name}: at the model's centre the chart agrees with the world (${fmt(dist(centre.to([geom.c[0] + e, geom.c[1] + 0.5*e]), [e, 0.5*e])/half)})`);
    // a regular polygon: its corners at the radius in the metric, its sides equal, its first corner at the angle
    const R = 0.3*half;
    const poly = { kind: 'polygon', cx: C[0], cy: C[1], rx: R, ry: R, angle: 0.4, phase: 0.3, n: 7 };
    const { nodes, pts } = drawnShape(poly, geom, sp);
    const d = metricOf(geom, R);
    const radii = nodes.map(m => Math.abs(geodesicDistance(geom, C, m.p) - d));
    const sides = nodes.map((m, k) => geodesicDistance(geom, m.p, nodes[(k + 1) % 7].p));
    const first = chart.to(nodes[0].p);
    check(nodes.length === 7 && nodes.every(m => !m.h1 && !m.h2 && !m.plain) && Math.max(...radii) < 1e-12 && Math.max(...sides) - Math.min(...sides) < 1e-12
          && Math.abs(Math.atan2(first[1], first[0]) - 0.7) < 1e-12,
          `${name}: a polygon's corners at its radius in the metric (${fmt(Math.max(...radii))}), its sides equal, its first corner at angle + phase`);
    const arcs = nodes.map((m, k) => geodesicArc(geom, m.p, nodes[(k + 1) % 7].p));
    const offSide = Math.max(...pts.map(q => Math.min(...arcs.map(arc => Math.min(1, offArc(arc, q))))));
    check(offSide < 2e-5, `${name}: its drawn sides are the geodesics between the corners (${fmt(offSide)} of their radii)`);
    // a rect: corners at the chart's (+-a, +-b), the sides crossing the axes at the half sizes
    const rect = { kind: 'rect', cx: C[0], cy: C[1], rx: 0.3*half, ry: 0.2*half, angle: -0.5 };
    const rn = shapeGeometry(rect, sp).nodes;
    const a = sp.size(rect.rx), b = sp.size(rect.ry), ca = Math.cos(-0.5), sa = Math.sin(-0.5);
    const inFrame = q => { const k = chart.to(q); return [k[0]*ca + k[1]*sa, -k[0]*sa + k[1]*ca]; };
    const corners = rn.map(m => inFrame(m.p));
    const offCorner = Math.max(...corners.map(q => Math.min(Math.abs(Math.abs(q[0]) - a), Math.abs(Math.abs(q[1]) - b))));
    const mid01 = geodesicMidpoint(geom, rn[0].p, rn[1].p), mid12 = geodesicMidpoint(geom, rn[1].p, rn[2].p);
    check(rn.length === 4 && offCorner < 1e-12*half && Math.abs(geodesicDistance(geom, C, mid01) - metricOf(geom, rect.ry)) < 1e-12
          && Math.abs(geodesicDistance(geom, C, mid12) - metricOf(geom, rect.rx)) < 1e-12,
          `${name}: a rect's corners at the chart's (+-a, +-b), its sides crossing the axes at the half sizes in the metric`);
    // a circle: every drawn point at the radius in the metric, and a Euclidean circle
    const circle = { kind: 'ellipse', cx: C[0], cy: C[1], rx: 0.35*half, ry: 0.35*half };
    const dc = drawnShape(circle, geom, sp);
    const dr = metricOf(geom, circle.rx);
    const offRadius = Math.max(...dc.pts.map(q => Math.abs(geodesicDistance(geom, C, q) - dr)))/dr;
    const eu = circleThrough(dc.pts[0], dc.pts[Math.floor(dc.pts.length/3)], dc.pts[Math.floor(2*dc.pts.length/3)]);
    const offRound = Math.max(...dc.pts.map(q => Math.abs(dist(q, eu.c) - eu.r)))/eu.r;
    check(dc.nodes.every(m => m.plain && m.h1 && m.h2 && m.smooth) && dc.closed && offRadius < 1e-4 && offRound < 2e-5,
          `${name}: a circle's drawn points at its radius in the metric (${fmt(offRadius)}), on a Euclidean circle (${fmt(offRound)}), by ${dc.nodes.length} plain cubic nodes`);
    // an ellipse: the drawn points on the chart's ellipse
    const ell = { kind: 'ellipse', cx: C[0], cy: C[1], rx: 0.35*half, ry: 0.15*half, angle: 0.8 };
    const de = drawnShape(ell, geom, sp);
    const ea = sp.size(ell.rx), eb = sp.size(ell.ry), ec = Math.cos(0.8), es = Math.sin(0.8);
    const offEll = Math.max(...de.pts.map(q => { const k = chart.to(q); const x = k[0]*ec + k[1]*es, y = -k[0]*es + k[1]*ec; return Math.abs(Math.hypot(x/ea, y/eb) - 1); }));
    check(offEll < 3e-4, `${name}: an ellipse's drawn points lie on the chart's ellipse (${fmt(offEll)})`);
    // a rounded rect: the straight parts geodesics, the corners the chart's arcs
    const round = { kind: 'rect', cx: C[0], cy: C[1], rx: 0.3*half, ry: 0.2*half, round: 0.5 };
    const drr = drawnShape(round, geom, sp);
    const rr = 0.5*Math.min(sp.size(round.rx), sp.size(round.ry)), ra = sp.size(round.rx), rb = sp.size(round.ry);
    const offRR = Math.max(...drr.pts.map(q => {
        const k = chart.to(q), x = Math.abs(k[0]), y = Math.abs(k[1]);
        if (x <= ra - rr + 1e-9) return Math.abs(y - rb);                        // on a side along the first axis
        if (y <= rb - rr + 1e-9) return Math.abs(x - ra);                        // along the second
        return Math.abs(Math.hypot(x - (ra - rr), y - (rb - rr)) - rr);         // on a corner's arc
    }))/half;
    const straight = drr.nodes.filter(m => !m.plain).length, arcsOf = drr.nodes.filter(m => m.plain).length;
    check(offRR < 3e-4 && straight === 4 && arcsOf >= 4, `${name}: a rounded rect's drawn points on its sides or on the chart's corner arcs (${fmt(offRR)}), ${straight} straight sides, ${arcsOf} arc pieces`);
    // a spiral: its radius growing in the metric, open
    const spiral = { kind: 'spiral', cx: C[0], cy: C[1], rx: 0.3*half, ry: 0.3*half, n: 2, phase: 0.2 };
    const sn = shapeGeometry(spiral, sp);
    const offSpiral = Math.max(...sn.nodes.map((m, k) => Math.abs(geodesicDistance(geom, C, m.p) - d*k/(sn.nodes.length - 1))));
    check(!sn.closed && sn.nodes.length === 49 && offSpiral < 1e-12 && sn.nodes.every(m => !m.h1 && !m.h2), `${name}: a spiral's radius grows evenly in the metric (${fmt(offSpiral)}), open`);
    // a curved star: the handles of the chart, mapped
    const star = { kind: 'star', cx: C[0], cy: C[1], rx: 0.3*half, ry: 0.3*half, n: 5, ratio: 0.5, twist: 0.1, curved: true, phase: 0.3 };
    const { local } = shapeInChart(star, sp);
    const stn = shapeGeometry(star, sp).nodes;
    let offHandle = 0;
    stn.forEach((m, i) => {
        const k = Math.floor(i/2), inner = i % 2 === 1;
        for (const [h, which] of [[m.h1, 1], [m.h2, 2]]) {
            const q = cornerPoint(local, k, inner, which);
            offHandle = Math.max(offHandle, dist(chart.to(h), shapePoint(local, local.rx*q[0], local.ry*q[1]))/half);
        }
    });
    check(stn.length === 10 && stn.every(m => m.h1 && m.h2 && m.smooth && !m.plain) && offHandle < 1e-12, `${name}: a curved star's handles are the chart's, mapped (${fmt(offHandle)})`);
    // a small shape at the model's centre is the Euclidean shape
    const small = { kind: 'polygon', cx: geom.c[0], cy: geom.c[1], rx: 1e-3*half, ry: 1e-3*half, n: 5, phase: 0.3 };
    const smallE = shapeGeometry(small).points, smallG = shapeGeometry(small, sp).nodes;
    const offSmall = Math.max(...smallG.map((m, k) => dist(m.p, [smallE[2*k], smallE[2*k + 1]])))/(1e-3*half);
    check(offSmall < 1e-6, `${name}: a small shape at the model's centre has the corners of the Euclidean shape (${fmt(offSmall)} of its size)`);
}

// 12 ──────────────────────────────────────────────────────────────────────────

for (const [name, geom, C] of SPACES) {
    const sp = shapeSpace(geom);
    const half = 0.5*(geom.kind === 'spherical' ? geom.R : geom.r);
    const shapes = [
        { kind: 'star', cx: C[0], cy: C[1], rx: 0.3*half, ry: 0.3*half, n: 5, ratio: 0.5, twist: 0.2, curved: true, phase: 0.3, angle: 0.1 },
        { kind: 'rect', cx: C[0], cy: C[1], rx: 0.3*half, ry: 0.2*half, round: 0.4, angle: -0.3 },
        { kind: 'ellipse', cx: C[0], cy: C[1], rx: 0.3*half, ry: 0.15*half, angle: 0.8 },
        { kind: 'spiral', cx: C[0], cy: C[1], rx: 0.3*half, ry: 0.2*half, n: 2, phase: 0.2, angle: 0.4 },
        { kind: 'polygon', cx: C[0], cy: C[1], rx: 0.3*half, ry: 0.3*half, n: 6, phase: 0.1 },
    ];
    const B = geom.kind === 'spherical' ? [geom.c[0] - 0.5*half, geom.c[1] + 0.3*half] : [geom.c[0] - 0.6*half, geom.c[1] + 0.4*half];
    const motions = [
        ['a translation', translationTo(geom, C, B), 1],
        ['a turn', rotationAbout(geom, B, 1.1), 1],
        ['a reflection', reflectionAbout(geom, B, [0.6, 0.8]), -1],
    ];
    // the direction a shape's numbers fix: a rect's and an ellipse's first axis (the ellipse's unoriented), a polygon's or star's first corner
    const dirOf = (sh) => (sh.kind === 'rect' || sh.kind === 'ellipse') ? sh.angle : sh.angle + sh.phase;
    for (const [what, g, sign] of motions) {
        const map = typeof g === 'function' ? g : q => mobiusApply(g, q);
        let offSize = 0, offCentre = 0, offAngle = 0, offDrawn = 0, kinds = true, turned = true;
        for (const s0 of shapes) {
            const s = normalShape(s0), m = shapeMapped(s, map, true, sp);
            kinds = kinds && !!m && m.kind === s.kind;
            if (!m) continue;
            offSize = Math.max(offSize, Math.abs(m.rx - s.rx)/s.rx, Math.abs(m.ry - s.ry)/s.ry);
            offCentre = Math.max(offCentre, dist([m.cx, m.cy], map(C))/half);
            // the direction turns with the map (a reflection: reflected); a spiral's start has none to tell
            if (s.kind !== 'spiral') {
                const e = 1e-6*half, a0 = dirOf(s), dg = map([C[0] + e*Math.cos(a0), C[1] + e*Math.sin(a0)]), c0 = map(C);
                const expected = Math.atan2(dg[1] - c0[1], dg[0] - c0[0]), period = s.kind === 'ellipse' ? Math.PI : 2*Math.PI;
                const diff = dirOf(m) - expected;
                offAngle = Math.max(offAngle, Math.abs(diff - period*Math.round(diff/period)));
            }
            // a reflection swaps a corner's handles and turns them about its direction
            if (s.kind === 'star') {
                const from = sign < 0 ? { o1: [s.handles.o2[0], -s.handles.o2[1]], o2: [s.handles.o1[0], -s.handles.o1[1]] } : s.handles;
                turned = turned && Math.abs((m.twist || 0) - sign*s.twist) < 1e-12 && dist(m.handles.o1, from.o1) < 1e-12 && dist(m.handles.o2, from.o2) < 1e-12;
            }
            if (s.kind === 'spiral') turned = turned && m.dir === sign*s.dir;
            // the image's drawn curve is the drawn curve mapped: the mapped points against the
            // image's polyline (the mapped polyline's chords are no chords of the image's arcs)
            const a = drawnShape(s, geom, sp).pts.map(map), b = drawnShape(m, geom, sp).pts;
            offDrawn = Math.max(offDrawn, deviation(a, b)/spread(b));
        }
        check(kinds && offSize < 1e-10 && offCentre < 1e-12 && offAngle < 1e-6 && turned && offDrawn < 2e-4,
              `${name}, ${what}: every kind keeps its sizes (${fmt(offSize)}) and goes to the centre's image, its direction turned (${fmt(offAngle)}), a star's twist and handles and a spiral's turn ${sign < 0 ? 'reflected' : 'kept'}; the drawn curve is the image of the drawn curve (${fmt(offDrawn)} of its size)`);
    }
    // a map that is no isometry: a similarity of the world about the model's centre, by the affine approximation at the centre
    const scale = q => [geom.c[0] + 1.3*(q[0] - geom.c[0]), geom.c[1] + 1.3*(q[1] - geom.c[1])];
    const smallStar = { ...shapes[0], rx: 0.02*half, ry: 0.02*half };
    const ms = shapeMapped(smallStar, scale, true, sp);
    const a = drawnShape(smallStar, geom, sp).pts.map(scale), b = drawnShape(ms, geom, sp).pts;
    const offScaled = Math.max(deviation(a, b), deviation(b, a))/spread(b);
    check(ms && ms.kind === 'star' && dist([ms.cx, ms.cy], scale(C)) < 1e-12 && ms.rx > smallStar.rx && offScaled < 5e-3,
          `${name}: a scaling of the world keeps the kind, moves the centre and grows the size (${(ms.rx/smallStar.rx).toFixed(4)}); a small star is drawn where its scaled curve is (${fmt(offScaled)} of its size)`);
    // To geodesic and back
    let offBack = 0, offStand = 0;
    for (const s0 of shapes) {
        const s = normalShape({ ...s0, rx: 0.05*half, ry: 0.05*half*s0.ry/s0.rx });
        const g = geodesicShape(s, sp), back = euclideanShape(g, sp);
        const turn = s.kind === 'spiral' ? 0 : Math.abs(dirOf(back) - dirOf(s));
        offBack = Math.max(offBack, Math.abs(back.rx - s.rx)/s.rx, Math.abs(back.ry - s.ry)/s.ry, dist([back.cx, back.cy], [s.cx, s.cy])/half, Math.min(turn, Math.abs(turn - Math.PI)));
        const e = shapeGeometry(s), pe = [];
        if (e.points) for (let i = 0; i + 1 < e.points.length; i += 2) pe.push([e.points[i], e.points[i + 1]]);
        else { const flat = flattenNodes(e.nodes, e.closed, 1e-5*half); for (let i = 0; i + 1 < flat.length; i += 2) pe.push([flat[i], flat[i + 1]]); }
        if (e.closed) pe.push(pe[0]);
        const pg = drawnShape(g, geom, sp).pts;
        offStand = Math.max(offStand, Math.max(deviation(pe, pg), deviation(pg, pe))/spread(pg));
    }
    check(offBack < 1e-3 && offStand < 1e-2, `${name}: To geodesic and To Euclidean nearly undo each other (${fmt(offBack)}), and a small geodesic shape stands where the Euclidean one did (${fmt(offStand)} of its size)`);
}

// 13 ──────────────────────────────────────────────────────────────────────────

const flatPoints = (item) => { const out = []; for (let i = 0; i + 1 < item.points.length; i += 2) out.push([item.points[i], item.points[i + 1]]); if (item.closed && out.length) out.push(out[0]); return out; };

for (const [name, group] of [['*237', g237], ['*532', klm(2, 3, 5, true)]]) {
    const { doc, editor } = newEditor(group, PTC);
    editor.setStyleValue('snap', false);
    const geom = editor.drawingGeometry(), sp = editor.shapeSpace();
    const half = 0.5*(geom.kind === 'spherical' ? geom.R : geom.r);
    check(!!sp && editor.drawingShapeSpace() === sp && (geom.kind === 'hyperbolic') === (name === '*237'), `${name}: the editor has the space of the ${geom.kind} geometry for the shapes`);
    const C = geom.kind === 'spherical' ? [geom.c[0] + 0.3*half, geom.c[1] - 0.2*half] : [geom.c[0] + 0.3*half, geom.c[1] - 0.2*half];
    // a geodesic shape in the document: resolved, drawn by the geometry
    const poly = doc.addItem({ shape: { kind: 'polygon', cx: C[0], cy: C[1], rx: 0.3*half, ry: 0.3*half, n: 5, phase: 0.2 }, geodesic: true, style: stroke });
    const arcs = poly.nodes.map((m, k) => geodesicArc(geom, m.p, poly.nodes[(k + 1) % 5].p));
    const offPoly = Math.max(...flatPoints(poly).map(q => Math.min(...arcs.map(arc => Math.min(1, offArc(arc, q))))));
    check(poly.geodesic === true && poly.type === 'path' && poly.closed && poly.shape.kind === 'polygon' && poly.nodes.length === 5 && poly.outline && poly.outline.key === doc.getOutliner().key
          && offPoly < 2e-5, `${name}: a geodesic polygon added to the document is drawn by the geodesics between its corners (${fmt(offPoly)})`);
    const circle = doc.addItem({ shape: { kind: 'ellipse', cx: C[0], cy: C[1], rx: 0.2*half, ry: 0.2*half }, geodesic: true, style: stroke });
    const dr = metricOf(geom, 0.2*half);
    const offCircle = Math.max(...flatPoints(circle).map(q => Math.abs(geodesicDistance(geom, C, q) - dr)))/dr;
    check(circle.geodesic === true && circle.nodes.every(m => m.plain) && offCircle < 3e-3, `${name}: a geodesic circle is drawn at its radius in the metric (${fmt(offCircle)} of it, flattened)`);
    // a copy under a generator of the group: the same sizes, the drawn curve the image of the drawn curve
    const toW = patternToWorldMap(PTC), toP = worldToPatternMap(PTC);
    const gen = new ITransform(group.getTransforms()[0].slice(), 'g');
    const viaGroup = (w) => { const q = toP.map(w[0], w[1]); const im = gen.transform(iPoint([q[0], q[1], 0, 0])).v; return toW.map(im[0], im[1]); };
    const copy = doc.addItem(mappedItem(poly, viaGroup, sp));
    const imagePts = flatPoints(poly).map(viaGroup), copyPts = flatPoints(copy);
    const offCopy = Math.max(deviation(imagePts, copyPts), deviation(copyPts, imagePts))/spread(copyPts);
    check(copy.shape && Math.abs(copy.shape.rx - poly.shape.rx) < 1e-12 && dist([copy.shape.cx, copy.shape.cy], viaGroup(C)) < 1e-12 && offCopy < 1e-4,
          `${name}: a copy under a generator keeps the sizes and is drawn as the image (${fmt(offCopy)} of its size)`);
    doc.removeItem(copy.id);
    // saved without the outline, loaded and resolved
    const layer = doc.getLayers()[0];
    const saved = layer.getParams().items.getValue();
    check(saved.length === 2 && saved.every(it => !('outline' in it) && it.geodesic === true && it.shape), 'the saved shapes carry the flag, their numbers and no outline');
    const polyPts = flatPoints(poly);
    layer.getParams().items.setValue(saved);
    const loaded = doc.getItem(poly.id);
    check(loaded !== poly && loaded.outline && loaded.outline.key === doc.getOutliner().key && deviation(flatPoints(loaded), polyPts) < 1e-12, 'shapes set into a layer as a document loads them are resolved to the same curve');
    // another geometry: resolved again from the numbers
    const other = geodesicOutliner(worldGeometry(group, { ...PTC, scale: 0.6 }));
    doc.setOutliner(other);
    const again = doc.getItem(poly.id);
    check(again !== loaded && again.outline.key === other.key && again.shape.rx === poly.shape.rx && deviation(flatPoints(again), polyPts) > 1e-3, 'another outliner resolves a geodesic shape again from its numbers');
    doc.setOutliner(geodesicOutliner(geom));
    // To Euclidean, To geodesic with undo
    editor.setSelection([{ id: poly.id, frame: null, frameInv: null }]);
    editor.setGeodesic(false);
    const eu = doc.getItem(poly.id);
    check(!eu.geodesic && !eu.outline && eu.shape.kind === 'polygon' && dist([eu.shape.cx, eu.shape.cy], C) < 1e-12 && eu.type === 'polyline',
          `${name}: To Euclidean makes a Euclidean polygon where the geodesic one stood (its radius ${eu.shape.rx.toFixed(4)} for ${poly.shape.rx.toFixed(4)} in the metric)`);
    editor.undo();
    const back = doc.getItem(poly.id);
    check(back.geodesic === true && JSON.stringify(back.shape) === JSON.stringify(poly.shape) && deviation(flatPoints(back), polyPts) < 1e-12, 'undo brings the geodesic shape back');
    editor.setGeodesic(false);
    editor.setGeodesic(true);
    const forth = doc.getItem(poly.id);
    check(forth.geodesic === true && Math.abs(forth.shape.rx - poly.shape.rx) < 0.05*poly.shape.rx && dist([forth.shape.cx, forth.shape.cy], C) < 1e-12,
          `${name}: To geodesic again: a geodesic polygon of about the size (${fmt(Math.abs(forth.shape.rx - poly.shape.rx)/poly.shape.rx)} off)`);
    editor.undo(); editor.undo();
    // release: a polygon a geodesic path of the same curve, a circle the plain path of its outline
    editor.setSelection([{ id: poly.id, frame: null, frameInv: null }]);
    editor.releaseShapes();
    const released = doc.getItem(poly.id);
    check(released && !released.shape && released.geodesic === true && released.nodes.length === 5 && released.nodes.every(m => !m.h1 && !m.h2 && !m.plain) && deviation(flatPoints(released), polyPts) < 1e-12,
          'a released geodesic polygon is a geodesic path of its corners, drawn the same');
    editor.undo();
    editor.setSelection([{ id: circle.id, frame: null, frameInv: null }]);
    const circlePts = flatPoints(circle);
    editor.releaseShapes();
    const plain = doc.getItem(circle.id);
    check(plain && !plain.shape && !plain.geodesic && !plain.outline && plain.nodes.length === circle.outline.nodes.length && plain.nodes.every(m => m.smooth && !m.plain)
          && deviation(flatPoints(plain), circlePts) < 1e-12, 'a released geodesic circle is the plain path of its outline, its nodes smooth, drawn the same');
    editor.undo();
    check(doc.getItem(circle.id).shape && doc.getItem(circle.id).geodesic === true, 'undo brings the circle back');
    // the handles of a shape through the chart
    const s = doc.getItem(poly.id).shape;
    const hs = shapeHandles(editor, s, null, sp);
    check(hs.length === 1 && hs[0].kind === 'tip' && dist(hs[0].world, poly.nodes[0].p) < 1e-12, 'a geodesic polygon\'s tip handle is at its first corner');
    const X = [C[0] + 0.25*half, C[1] + 0.2*half];
    const dragged = shapeWithHandleAt(s, 'tip', X, s, false, false, sp);
    const draggedNodes = shapeGeometry(dragged, sp).nodes;
    check(dist(draggedNodes[0].p, X) < 1e-9 && Math.abs(metricOf(geom, dragged.rx) - geodesicDistance(geom, C, X)) < 1e-9, 'the tip dragged to a point: the first corner there, the radius its distance in the metric');
    const rs = normalShape({ kind: 'rect', cx: C[0], cy: C[1], rx: 0.2*half, ry: 0.1*half, angle: 0.3 });
    const sized = shapeWithHandleAt(rs, 'size', X, rs, false, false, sp);
    const sizedCorners = shapeGeometry(sized, sp).nodes.map(m => m.p);
    check(Math.min(...sizedCorners.map(q => dist(q, X))) < 1e-9 && Math.abs(sized.angle - 0.3) < 1e-12, 'a rect\'s size handle dragged to a point: a corner there');
    const es = normalShape({ kind: 'ellipse', cx: C[0], cy: C[1], rx: 0.2*half, ry: 0.1*half, angle: 0.3 });
    const widened = shapeWithHandleAt(es, 'rx', X, es, false, false, sp);
    const hx = shapeHandles(editor, widened, null, sp).find(h => h.kind === 'rx');
    const kx = sp.chart(C).to(X), kh = sp.chart(C).to(hx.world), c3 = Math.cos(0.3), s3 = Math.sin(0.3);
    check(Math.abs((kh[0]*c3 + kh[1]*s3) - (kx[0]*c3 + kx[1]*s3)) < 1e-9 && Math.abs(widened.ry - es.ry) < 1e-12, 'an ellipse\'s rx handle dragged: the handle at the point\'s chart coordinate along the first axis');
    // the shape tools: a drag from the centre, a box drag, Shift, the setting off
    const tool = ShapeTool({ editor, kind: 'polygon' });
    const T = [C[0] + 0.2*half, C[1] + 0.15*half];
    tool.handleEvent(pointer('pointerdown', C));
    tool.handleEvent(pointer('pointermove', T, { buttons: 1 }));
    const shown = tool.getOverlayGeometry();
    tool.handleEvent(pointer('pointerup', T));
    const madeItems = doc.getAllItems();
    const made = madeItems[madeItems.length - 1];
    check(made && made.shape && made.shape.kind === 'polygon' && made.geodesic === true && dist(made.nodes[0].p, T) < 1e-9 && dist([made.shape.cx, made.shape.cy], C) < 1e-12
          && Math.abs(metricOf(geom, made.shape.rx) - geodesicDistance(geom, C, T)) < 1e-9 && Math.abs(editor.getShapeToolConfig('polygon').radius - made.shape.rx) < 1e-12
          && shown.polylines.some(pl => pl.points.length > 6),
          `${name}: the polygon tool's drag makes a geodesic polygon from its centre to its tip at the pointer, its radius in the metric, shown as drawn while dragged`);
    const rectTool = ShapeTool({ editor, kind: 'rect' });
    const P1 = [C[0] + 0.3*half, C[1] + 0.2*half];
    rectTool.handleEvent(pointer('pointerdown', C));
    rectTool.handleEvent(pointer('pointermove', P1, { buttons: 1 }));
    rectTool.handleEvent(pointer('pointerup', P1));
    const madeRect = doc.getAllItems().pop();
    const M = geodesicMidpoint(geom, C, P1);
    check(madeRect && madeRect.shape.kind === 'rect' && madeRect.geodesic === true && dist([madeRect.shape.cx, madeRect.shape.cy], M) < 1e-12
          && Math.min(...madeRect.nodes.map(m => dist(m.p, C))) < 1e-9 && Math.min(...madeRect.nodes.map(m => dist(m.p, P1))) < 1e-9 && madeRect.shape.angle === 0,
          `${name}: the rect tool's box drag makes a geodesic rect with the two corners at the press and the pointer, its centre their midpoint`);
    rectTool.handleEvent(pointer('pointerdown', C));
    rectTool.handleEvent(pointer('pointermove', P1, { buttons: 1, shiftKey: true }));
    rectTool.handleEvent(pointer('pointerup', P1, { shiftKey: true }));
    const square = doc.getAllItems().pop();
    check(square && Math.abs(square.shape.rx - square.shape.ry) < 1e-12 && Math.min(...square.nodes.map(m => dist(m.p, C))) < 1e-7,
          `with Shift a square in the metric, the press corner kept (${fmt(Math.min(...square.nodes.map(m => dist(m.p, C))))} off)`);
    editor.setStyleValue('geodesic', false);
    rectTool.handleEvent(pointer('pointerdown', C));
    rectTool.handleEvent(pointer('pointermove', P1, { buttons: 1 }));
    rectTool.handleEvent(pointer('pointerup', P1));
    const plainRect = doc.getAllItems().pop();
    check(plainRect && !plainRect.geodesic && plainRect.type === 'polyline' && Math.abs(plainRect.shape.rx - 0.15*half) < 1e-12 && !editor.drawingShapeSpace(),
          'with the setting off the tool draws the Euclidean rect as before');
    editor.setStyleValue('geodesic', true);
    check(tool.getProperties().some(p => p.kind === 'toggle' && p.title.startsWith('geodesic')), 'the shape tools have the geodesic toggle in their bars');
}
{
    // in a wallpaper group there is no space: shapes are the Euclidean ones, flag or not
    const { doc, editor } = newEditor(g632, PTC);
    check(!editor.shapeSpace() && !editor.drawingShapeSpace(), 'a wallpaper group has no space for geodesic shapes');
    const it = doc.addItem({ shape: { kind: 'polygon', cx: 0.1, cy: 0.2, rx: 0.3, ry: 0.3, n: 5 }, geodesic: true, style: stroke });
    const e = shapeGeometry(it.shape);
    check(it.geodesic === true && it.type === 'polyline' && it.outline && !it.outline.nodes && it.outline.key === 'euclidean' && it.points.every((v, i) => Math.abs(v - e.points[i]) < 1e-15),
          'a geodesic polygon in the plane is the Euclidean polygon, resolved with the key of the plane');
    const spiral = doc.addItem({ shape: { kind: 'spiral', cx: 0.1, cy: 0.2, rx: 0.3, ry: 0.3, n: 2 }, style: stroke });
    check(spiral.closed === false, 'a spiral is an open polyline');
}

// 14 ──────────────────────────────────────────────────────────────────────────

{
    // *2223 bent by 20 degrees: a Kleinian reflection group whose mirrors are geodesics of the metric
    const maker = new Group_KLMN();
    maker.setParamsMap({ s: true, K: 3, L: 2, M: 2, N: 2, twist: 0, aspect: 0.49, bend: 20, uhp: true });
    const bent = maker.getGroup();
    const ptc = { centerX: 0.05, centerY: -0.1, scale: 0.7, angle: 15 };
    const toW = patternToWorldMap(ptc), toP = worldToPatternMap(ptc);
    const img = (g) => (w) => { const q = toP.map(w[0], w[1]); const im = g.transform(iPoint([q[0], q[1], 0, 0])).v; return toW.map(im[0], im[1]); };
    const outliner = groupOutliner(bent, ptc);
    // an item's drawn curve flattened finely (its points are flattened coarsely)
    const fine = (item) => { const nodes = drawnNodes(item); const flat = flattenNodes(nodes, item.closed, 1e-5*spread(nodes.map(m => m.p))); const out = []; for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]]); if (item.closed) out.push(out[0]); return out; };
    check(outliner.key.startsWith('kleinian') && outliner.geometry.fallback === 'kleinian' && outliner.space && outliner.space.at && outliner.disk, 'a Kleinian group gets the Kleinian outliner');
    // a point inside the domain, in world coordinates
    const fold = bent.toFundDomain({ pnt: iPoint([0.1, 0.2, 0, 0]), maxIterations: 200 });
    const Zp = [fold.pnt.v[0], fold.pnt.v[1]], Z = toW.map(Zp[0], Zp[1]);
    const DZ = outliner.disk(Z);
    check(DZ && DZ.kind === 'hyperbolic' && dist(DZ.c, Z) < DZ.r, `the disk at a point of the domain (radius ${DZ ? DZ.r.toFixed(3) : '-'})`);
    // the finder gives maximalDisk's disks
    let offDisk = 0;
    for (let i = 0; i < 12; i++) {
        const p = [Zp[0] + 0.3*(rnd() - 0.5), Zp[1] + 0.3*(rnd() - 0.5)];
        const a = maximalDisk(bent, p), b = maximalDiskFinder(bent)(p);
        if (a && b && a.kind === 'hyperbolic' && b.kind === 'hyperbolic') offDisk = Math.max(offDisk, (dist(a.c, b.c) + Math.abs(a.r - b.r))/a.r);
    }
    check(offDisk < 1e-9, `the disk finder gives the disks of maximalDisk (${fmt(offDisk)})`);
    // two points of a mirror: the side between them lies on the mirror
    const sides = bent.getFundDomain();
    const footOf = (sp) => (w) => {
        const z = toP.map(w[0], w[1]);
        let f;
        if (sp.type === SPLANE_SPHERE) { const c = [sp.v[0], sp.v[1]], d = unitOf([z[0] - c[0], z[1] - c[1]]); f = [c[0] + d[0]*Math.abs(sp.v[3]), c[1] + d[1]*Math.abs(sp.v[3])]; }
        else { const n = [sp.v[0], sp.v[1]], l2 = n[0]*n[0] + n[1]*n[1], t = (n[0]*z[0] + n[1]*z[1] - sp.v[3])/l2; f = [z[0] - n[0]*t, z[1] - n[1]*t]; }
        return toW.map(f[0], f[1]);
    };
    const pointsOut = (pieces, P) => { const out = [P]; let p0 = P; for (const pc of pieces) { for (let j = 1; j <= 16; j++) out.push(cubicAt(p0, pc.c1, pc.c2, pc.p, j/16)); p0 = pc.p; } return out; };
    let offMirror = 0, sidesChecked = 0, offBoth = 0;
    sides.forEach((sp, k) => {
        const foot = footOf(sp);
        const r = 0.12*DZ.r;
        const P1 = foot([Z[0] + r*Math.cos(1 + k), Z[1] + r*Math.sin(1 + k)]), P2 = foot([Z[0] + r*Math.cos(2.2 + k), Z[1] + r*Math.sin(2.2 + k)]);
        const o = outliner.outline([node(...P1), node(...P2)], false);
        const pieces = o.nodes.slice(1).map((m, i) => ({ c1: o.nodes[i].h2 || o.nodes[i].p, c2: m.h1 || m.p, p: m.p }));
        if (!o.nodes[0].h2) return;
        sidesChecked++;
        const pts = pointsOut(pieces, P1);
        for (const q of pts) offMirror = Math.max(offMirror, dist(q, foot(q))/dist(P1, P2));
        const back = outliner.outline([node(...P2), node(...P1)], false);
        const bpieces = back.nodes.slice(1).map((m, i) => ({ c1: back.nodes[i].h2 || back.nodes[i].p, c2: m.h1 || m.p, p: m.p }));
        offBoth = Math.max(offBoth, deviation(pts, pointsOut(bpieces, P2))/dist(P1, P2));
    });
    check(sidesChecked >= 3 && offMirror < 1e-5 && offBoth < 1e-5, `${sidesChecked} mirrors: the side between two points of a mirror lies on it (${fmt(offMirror)} of the chord), the same from both ends (${fmt(offBoth)})`);
    // a geodesic polygon in the document: its sides arcs, carried by a generator of the group
    const doc = DrawingDocument();
    doc.clear();
    doc.setOutliner(outliner);
    const corners = [0, 1, 2, 3, 4].map(j => [Z[0] + 0.25*DZ.r*Math.cos(0.3 + 2*Math.PI*j/5), Z[1] + 0.25*DZ.r*Math.sin(0.3 + 2*Math.PI*j/5)]);
    const pent = doc.addItem({ type: 'path', closed: true, geodesic: true, nodes: corners.map(c => node(...c)), style: stroke });
    const pentPts = fine(pent);
    const straightPts = fine(doc.addItem({ type: 'path', closed: true, nodes: corners.map(c => node(...c)), style: stroke }));
    const bend = Math.max(deviation(pentPts, straightPts), deviation(straightPts, pentPts))/spread(corners);
    check(pent.outline && pent.outline.key === outliner.key && pent.outline.nodes.length >= 5 && bend > 1e-3, `a geodesic pentagon is drawn by arcs, ${fmt(bend)} of its size off the straight one`);
    const gen = new ITransform(bent.getTransforms()[0].slice(), 'g');
    const copy = doc.addItem(mappedItem(pent, img(gen), outliner.space));
    const offCopy = deviation(pentPts.map(img(gen)), fine(copy))/spread(fine(copy));
    check(offCopy < 5e-5, `the copy under a generator is drawn as the image of the pentagon (${fmt(offCopy)} of its size)`);
    // a curved side: a smooth node keeps its tangent across its two sides, drawn in two disks
    const A = corners[0], B = corners[2], Cc = corners[3];
    const h = (p, q, f) => [p[0] + f*(q[0] - p[0]), p[1] + f*(q[1] - p[1])];
    const mid = h(A, B, 0.5), away = [mid[0] + 0.15*DZ.r, mid[1] - 0.1*DZ.r];
    // the node's handles on one geodesic through it: opposite in its chart
    const awayChart = outliner.chart(away), h1 = h(away, A, 0.4), w1 = awayChart.to(h1), h2 = awayChart.from([-w1[0], -w1[1]]);
    const curved = doc.addItem({ type: 'path', closed: false, geodesic: true, style: stroke,
                                 nodes: [node(...A), { p: away, h1, h2, smooth: true }, node(...Cc)] });
    const on = curved.outline.nodes, at = on.findIndex(m => dist(m.p, away) < 1e-12);
    const tIn = unitOf([away[0] - on[at].h1[0], away[1] - on[at].h1[1]]), tOut = unitOf([on[at].h2[0] - away[0], on[at].h2[1] - away[1]]);
    check(at > 0 && on[at].smooth && Math.abs(tIn[0]*tOut[1] - tIn[1]*tOut[0]) < 1e-6 && tIn[0]*tOut[0] + tIn[1]*tOut[1] > 0,
          `a smooth node's two curved sides, drawn in two disks, leave it with one tangent (${fmt(Math.abs(tIn[0]*tOut[1] - tIn[1]*tOut[0]))})`);
    check(!!outliner.chart(away) && !!outliner.split([A, h(A, away, 0.3), h(away, A, 0.4), away], 0.5), 'the chart of a node and the split of a side are given');
    // shapes in the disk of their centre
    const sp = outliner.space.at(Z);
    const dZ = (p) => geodesicDistance(DZ, Z, p);
    const poly = doc.addItem({ shape: { kind: 'polygon', cx: Z[0], cy: Z[1], rx: 0.2*DZ.r, ry: 0.2*DZ.r, n: 6 }, geodesic: true, style: stroke });
    const radii = poly.nodes.map(m => dZ(m.p));
    check(sp && poly.nodes.length === 6 && Math.max(...radii) - Math.min(...radii) < 1e-12, `a geodesic hexagon has its corners at one distance in the disk of its centre (${radii[0].toFixed(4)})`);
    const circle = doc.addItem({ shape: { kind: 'ellipse', cx: Z[0], cy: Z[1], rx: 0.15*DZ.r, ry: 0.15*DZ.r }, geodesic: true, style: stroke });
    const cpts = fine(circle), eu = circleThrough(cpts[0], cpts[Math.floor(cpts.length/3)], cpts[Math.floor(2*cpts.length/3)]);
    const offRound = Math.max(...cpts.map(q => Math.abs(dist(q, eu.c) - eu.r)))/eu.r;
    check(offRound < 1e-4 && Math.abs(dist(eu.c, Z)) > 1e-6, `a geodesic circle is a Euclidean circle (${fmt(offRound)}), its centre off the Euclidean one`);
    const polyCopy = mappedItem(poly, img(gen), outliner.space);
    check(Math.abs(polyCopy.shape.rx - poly.shape.rx) < 1e-9 && dist([polyCopy.shape.cx, polyCopy.shape.cy], img(gen)(Z)) < 1e-12, 'a generator keeps a geodesic shape\'s sizes');
    const polyAdded = doc.addItem(polyCopy);
    const offShape = deviation(fine(poly).map(img(gen)), fine(polyAdded))/spread(fine(polyAdded));
    check(offShape < 5e-5, `and the copy is drawn as the image (${fmt(offShape)} of its size)`);
    // the editor and the tools in the Kleinian group
    const { doc: edoc, editor } = newEditor(bent, ptc);
    editor.setStyleValue('snap', false);
    check(editor.hasGeodesics() && editor.drawsGeodesics() && editor.shapeSpace() && editor.shapeSpace().at && edoc.getOutliner().key === outliner.key,
          'the editor draws geodesics in a Kleinian group, with the space of the disks');
    const tool = PolylineTool({ editor });
    clickAt(tool, corners[0]); clickAt(tool, corners[1]); clickAt(tool, corners[2]);
    tool.handleKey({ type: 'keydown', key: 'Enter' });
    const line = edoc.getAllItems()[0];
    check(line && line.geodesic === true && line.outline && line.outline.nodes.length >= 3 && line.outline.nodes[0].h2, 'the polyline tool makes a geodesic path drawn by arcs');
    const rectTool = ShapeTool({ editor, kind: 'rect' });
    const P1 = [Z[0] + 0.2*DZ.r, Z[1] + 0.15*DZ.r];
    rectTool.handleEvent(pointer('pointerdown', Z));
    rectTool.handleEvent(pointer('pointermove', P1, { buttons: 1 }));
    rectTool.handleEvent(pointer('pointerup', P1));
    const rect = edoc.getAllItems().pop();
    check(rect && rect.shape && rect.geodesic === true && Math.min(...rect.nodes.map(m => dist(m.p, Z))) < 1e-9 && Math.min(...rect.nodes.map(m => dist(m.p, P1))) < 1e-9 && rect.outline.nodes[0].h2,
          'the rect tool makes a geodesic rect with its corners at the press and the pointer, drawn by arcs');
    check(!!editor.nodeChart(line) && !!editor.pointGeometry(Z) && editor.pointGeometry(Z).kind === 'hyperbolic', 'the node chart and the geometry at a point are the disks\'');
    editor.setSelection([{ id: rect.id, frame: null, frameInv: null }]);
    editor.setGeodesic(false);
    const eu2 = edoc.getItem(rect.id);
    check(eu2 && !eu2.geodesic && eu2.shape.kind === 'rect', 'To Euclidean on a Kleinian geodesic rect');
    editor.undo();
    check(edoc.getItem(rect.id).geodesic === true, 'and undo');
    check(tool.getProperties().some(p => p.kind === 'toggle' && p.title.startsWith('geodesic') && p.visible()), 'the geodesic toggle shows in a Kleinian group');
}

console.log(failed ? `${failed} check(s) FAILED` : 'all checks passed');
process.exit(failed ? 1 : 0);
