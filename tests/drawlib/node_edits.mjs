/*
  tests of the node tool's Inkscape edits of handles and segments
  (lib/drawlib/Paths.js, docs/node_editing_plan.md 5.3)

    node tests/drawlib/node_edits.mjs

  A Shift+drag on a corner pulls out the one retracted handle on the side
  the drag goes to, and the corner stays a corner; a retracted handle makes
  its segment straight; Make segments curves puts the handles at the thirds
  and leaves the flattened outline as it was, Make segments lines takes them
  away; a bent segment's point at the grabbed parameter follows the pointer,
  the handles sharing the move by Inkscape's weights, a smooth node keeping
  its handles in line; a snapped handle lies on a multiple of 15 degrees; a
  linked handle turns the other one with it (a corner) or mirrors it (a
  smooth node). The chart versions, with a chart that is a plain
  translation, give the same as the plane's.
*/

import { flattenNodes, nodeNeighbour, nodeSegments, segmentStraight, pulledHandle, handleRetracted, segmentsCurved, segmentsStraight,
         bendWeight, segmentBent, handleSnapped, handleLinkedMoved } from '../../lib/drawlib/Paths.js';

let failed = 0;
function check(ok, what){
    if (!ok) { failed++; console.log('FAILED: ' + what); }
    else console.log('ok: ' + what);
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const near = (a, b, eps = 1e-12) => !!a && !!b && dist(a, b) <= eps;

/** the point of segment s at t */
function segmentPoint(nodes, closed, s, t){
    const e = nodeNeighbour(nodes, s, 'h2', closed);
    const a = nodes[s], b = nodes[e];
    const c1 = a.h2 || a.p, c2 = b.h1 || b.p, u = 1 - t;
    const w = [u*u*u, 3*u*u*t, 3*u*t*t, t*t*t];
    return [0, 1].map(k => w[0]*a.p[k] + w[1]*c1[k] + w[2]*c2[k] + w[3]*b.p[k]);
}

// a translation as a chart: the same edits as in the plane
const translationChart = (p) => ({ to: q => [q[0] - p[0], q[1] - p[1]], from: q => [q[0] + p[0], q[1] + p[1]] });

// an open zigzag of corners: 0 (0,0), 1 (3,0), 2 (3,3), 3 (6,3)
const corners = () => [[0, 0], [3, 0], [3, 3], [6, 3]].map(p => ({ p, h1: null, h2: null }));

// ── neighbours and segments ────────────────────────────────────────────────
{
    const n = corners();
    check(nodeNeighbour(n, 0, 'h1', false) === -1 && nodeNeighbour(n, 0, 'h2', false) === 1 && nodeNeighbour(n, 3, 'h2', false) === -1,
          'an open path: no neighbour past its ends');
    check(nodeNeighbour(n, 0, 'h1', true) === 3 && nodeNeighbour(n, 3, 'h2', true) === 0, 'a closed path: the ends meet');
    check(JSON.stringify(nodeSegments(n, 1, false)) === '[0,1]' && JSON.stringify(nodeSegments(n, 0, false)) === '[0]'
          && JSON.stringify(nodeSegments(n, 0, true)) === '[3,0]', 'the segments meeting at a node');
    // a compound path: two rings, the second closing on itself
    const ring = [[0, 0], [1, 0], [1, 1], [5, 5], [6, 5], [6, 6]].map(p => ({ p, h1: null, h2: null }));
    ring[2].ringEnd = true;
    check(nodeNeighbour(ring, 2, 'h2', true) === 0 && nodeNeighbour(ring, 3, 'h1', true) === 5, 'the rings of a compound path close on themselves');
}

// ── a handle pulled out of a corner ────────────────────────────────────────
{
    const n = corners();
    check(pulledHandle(n, 1, [2, 0.2], false) === 'h1', 'a pull towards the node before draws out h1');
    check(pulledHandle(n, 1, [3.1, 1.5], false) === 'h2', 'a pull towards the node after draws out h2');
    check(pulledHandle(n, 0, [-1, 0], false) === 'h2', 'the first node of an open path has only h2 to pull');
    check(pulledHandle(n, 1, [2, 0.2], false, translationChart) === 'h1', 'the same in a chart');
    const out = n.map((m, k) => k === 1 ? { ...m, h1: [2, 0], h2: [3, 1] } : m);
    check(pulledHandle(out, 1, [2, 0.2], false) === null, 'a node with both handles out has none to pull');
    const one = n.map((m, k) => k === 1 ? { ...m, h2: [3, 1] } : m);
    check(pulledHandle(one, 1, [3.1, 1.5], false) === 'h1', 'only the retracted handle is pulled, whatever the direction');
}

// ── retract, curves, lines ──────────────────────────────────────────────────
{
    const n = corners();
    const curved = segmentsCurved(n, false, nodeSegments(n, 1, false));
    check(near(curved[0].h2, [1, 0]) && near(curved[1].h1, [2, 0]) && near(curved[1].h2, [3, 1]) && near(curved[2].h1, [3, 2]),
          'Make segments curves: the handles at the thirds of the two segments of node 1');
    check(!curved[1].smooth && !curved[2].h2 && !curved[3].h1, 'the node stays a corner, the other segments stay straight');
    check(JSON.stringify(flattenNodes(curved, false)) === JSON.stringify(flattenNodes(n, false)), 'the flattened outline is the same');
    const closedCurved = segmentsCurved(n, true, [3]);
    check(near(closedCurved[3].h2, [4, 2]) && near(closedCurved[0].h1, [2, 1]), 'the closing segment of a closed path');
    const bent = curved.map((m, k) => k === 1 ? { ...m, h2: [4, 1] } : m);
    check(segmentsCurved(bent, false, [1])[1].h2[0] === 4, 'a segment with handles is left as it is');
    const lines = segmentsStraight(curved, false, [1]);
    check(near(lines[0].h2, [1, 0]) && near(lines[1].h1, [2, 0]) && !lines[1].h2 && !lines[2].h1 && segmentStraight(lines, 1, false),
          'Make segments lines: the handles of that segment gone, the others kept');
    const retracted = handleRetracted(curved, 1, 'h1');
    check(!retracted[1].h1 && near(retracted[1].h2, [3, 1]) && !segmentStraight(retracted, 0, false), 'a handle retracted, the other kept');
    check(segmentStraight(handleRetracted(retracted, 0, 'h2'), 0, false), 'both retracted: the segment is straight');
    const inChart = segmentsCurved(n, false, [0, 1], translationChart);
    check([0, 1].every(k => near(inChart[k].h2, curved[k].h2)) && [1, 2].every(k => near(inChart[k].h1, curved[k].h1)), 'the same in a chart');
}

// ── a segment bent ──────────────────────────────────────────────────────────
{
    check(bendWeight(0.1) === 0 && bendWeight(0.9) === 1 && Math.abs(bendWeight(0.5) - 0.5) < 1e-15
          && Math.abs(bendWeight(1/6)) < 1e-15 && Math.abs(bendWeight(5/6) - 1) < 1e-15, 'Inkscape\'s weights: 0 near the start, 1 near the end, a half halfway');
    const n = corners();
    // on a straight segment the grabbed parameter is linear along it, as the node tool's flattening gives it
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const from = [3*t, 0], to = [from[0] + 0.4, from[1] + 1.1];
        const out = segmentBent(n, false, 0, t, from, to);
        check(near(segmentPoint(out, false, 0, t), to, 1e-12) && near(out[0].p, n[0].p) && near(out[1].p, n[1].p),
              `a straight segment bent at t = ${t}: its point there follows the pointer, its nodes stay`);
    }
    const from = [0.3, 0], out = segmentBent(n, false, 0, 0.1, from, [from[0], from[1] + 1]);
    check(near(out[1].h1, [2, 0]), 'near the start only the first handle moves');
    // a smooth node at the end keeps its handles in line, its other handle's length kept
    const s = corners().map((m, k) => k === 1 ? { ...m, h1: [2, 0], h2: [4, 0], smooth: true } : m);
    const p = segmentPoint(s, false, 0, 0.6), bentSmooth = segmentBent(s, false, 0, 0.6, p, [p[0], p[1] + 1]);
    const a = bentSmooth[1], u = [a.h1[0] - a.p[0], a.h1[1] - a.p[1]], v = [a.h2[0] - a.p[0], a.h2[1] - a.p[1]];
    check(Math.abs(u[0]*v[1] - u[1]*v[0]) < 1e-12 && u[0]*v[0] + u[1]*v[1] < 0 && Math.abs(Math.hypot(v[0], v[1]) - 1) < 1e-12,
          'a smooth node at the end turns its other handle to stay in line, its length kept');
    check(near(segmentPoint(bentSmooth, false, 0, 0.6), [p[0], p[1] + 1], 1e-12), 'and the bent point still follows the pointer');
    const inChart = segmentBent(n, false, 0, 0.3, [0.9, 0], [1, 1], translationChart);
    const plane = segmentBent(n, false, 0, 0.3, [0.9, 0], [1, 1]);
    check(near(inChart[0].h2, plane[0].h2, 1e-12) && near(inChart[1].h1, plane[1].h1, 1e-12), 'the same in a chart');
}

// ── handles snapped and linked ─────────────────────────────────────────────
{
    const step = Math.PI/12;
    const x = handleSnapped([1, 1], [3, 1.6], step);
    const angle = Math.atan2(x[1] - 1, x[0] - 1);
    check(Math.abs(angle/step - Math.round(angle/step)) < 1e-12 && Math.abs(dist(x, [1, 1]) - dist([3, 1.6], [1, 1])) < 1e-12,
          'a snapped handle: on a multiple of 15 degrees, its length kept');
    check(near(handleSnapped([1, 1], [3, 1.6], step, translationChart), x), 'the same in a chart');
    const corner = [{ p: [0, 0], h1: null, h2: null }, { p: [2, 0], h1: [1, 0], h2: [2, 1] }, { p: [4, 0], h1: null, h2: null }];
    // h2 turned from up (90 degrees) to the left (180): h1 turns from the left to down
    const turned = handleLinkedMoved(corner, 1, 'h2', [1, 0], null);
    check(near(turned[1].h2, [1, 0]) && near(turned[1].h1, [2, -1], 1e-12) && !turned[1].smooth, 'a corner: the other handle turns with the dragged one');
    const smooth = corner.map((m, k) => k === 1 ? { ...m, h1: [1, 0], h2: [5, 0], smooth: true } : m);
    const mirrored = handleLinkedMoved(smooth, 1, 'h2', [2, 2], null);
    check(near(mirrored[1].h1, [2, -2], 1e-12), 'a smooth node: the other handle mirrors the dragged one, as long');
    check(near(handleLinkedMoved(corner, 1, 'h2', [1, 0], translationChart)[1].h1, turned[1].h1, 1e-12), 'the same in a chart');
}

console.log(failed ? `${failed} check(s) FAILED` : 'node_edits: all checks passed');
if (failed) process.exitCode = 1;
