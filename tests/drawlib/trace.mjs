/*
  tests of tracing a picture into outlines (lib/drawlib/OutlineTrace.js)

    node tests/drawlib/trace.mjs

  1. the rings: one per outline, in the right place, finer than a pixel
  2. holes, islands, specks, two opposite corners, ink at the edge of the picture
  3. the nodes: corners kept, straight runs straight, curves few and within tolerance
  4. a compound path of the rings, by the even-odd rule
*/

import { coverageRings, ringNodes } from '../../lib/drawlib/OutlineTrace.js';
import { flattenNodes, withNodes } from '../../lib/drawlib/Paths.js';
import { hitsPolyline } from '../../lib/drawlib/Orbits.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}

/** the coverage of a shape by its signed distance (negative inside), an edge a pixel wide as a drawing's */
function drawn(width, height, distance){
    const values = new Float32Array(width*height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) values[y*width + x] = Math.max(0, Math.min(1, 0.5 - distance(x, y)));
    }
    return values;
}
const disk = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) - r;
const out = (a, b) => (x, y) => Math.max(a(x, y), -b(x, y));
const union = (a, b) => (x, y) => Math.min(a(x, y), b(x, y));
// a square of half size h turned by an angle
const square = (cx, cy, h, angle = 0) => (x, y) => {
    const c = Math.cos(angle), s = Math.sin(angle), u = (x - cx)*c + (y - cy)*s, v = -(x - cx)*s + (y - cy)*c;
    const dx = Math.abs(u) - h, dy = Math.abs(v) - h;
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
};
const area = (ring) => {
    let sum = 0;
    ring.forEach((p, i) => { const q = ring[(i + 1) % ring.length]; sum += p[0]*q[1] - q[0]*p[1]; });
    return Math.abs(sum)/2;
};

// 1 ───────────────────────────────────────────────────────────────────────────

{
    const rings = coverageRings(drawn(300, 300, disk(150.3, 149.6, 100)), 300, 300);
    check(rings.length === 1, 'a disk: one ring');
    const worst = Math.max(...rings[0].map(p => Math.abs(Math.hypot(p[0] - 150.3, p[1] - 149.6) - 100)));
    check(worst < 0.12, `finer than a pixel: ${worst}`);
    check(Math.abs(area(rings[0]) - Math.PI*1e4) < 25, 'its area');
    check(coverageRings(new Float32Array(100), 10, 10).length === 0, 'nothing drawn, no ring');
    check(coverageRings(new Float32Array(100).fill(1), 10, 10).length === 0, 'all drawn, no ring');
}

// 2 ───────────────────────────────────────────────────────────────────────────

{
    let rings = coverageRings(drawn(300, 300, out(disk(150, 150, 120), disk(150, 150, 60))), 300, 300);
    check(rings.length === 2, 'an annulus: two rings');
    check(Math.abs(rings.map(area).sort((a, b) => a - b)[0] - Math.PI*3600) < 25, 'the hole');

    rings = coverageRings(drawn(300, 200, union(disk(60, 100, 40), disk(220, 100, 40))), 300, 200);
    check(rings.length === 2, 'two islands');

    const speck = drawn(100, 100, union(disk(30, 30, 20), disk(80, 80, 0.8)));
    check(coverageRings(speck, 100, 100).length === 1, 'a speck goes');

    // two opposite pixels of a square of four, each way
    const twice = new Float32Array(36);
    twice[2*6 + 2] = 1; twice[3*6 + 3] = 1;
    const a = coverageRings(twice, 6, 6, 0), flipped = new Float32Array(36);
    flipped[2*6 + 3] = 1; flipped[3*6 + 2] = 1;
    check(Array.isArray(a) && Array.isArray(coverageRings(flipped, 6, 6)), 'opposite corners end');

    // ink over the edge of the picture leaves the ring open, and ends
    const cut = coverageRings(drawn(100, 100, disk(0, 50, 30)), 100, 100);
    check(cut.length === 1 && Math.hypot(cut[0][0][0] - cut[0][cut[0].length - 1][0], cut[0][0][1] - cut[0][cut[0].length - 1][1]) > 2, 'cut by the edge');
}

// 3 ───────────────────────────────────────────────────────────────────────────

{
    const near = (nodes, ring, tol) => {
        const pts = flattenNodes(nodes, true, 0.05);
        return ring.every(p => hitsPolyline(p, pts, true, false, tol, 'nonzero'));
    };

    // a turned square: four corners, four straight sides
    for (const angle of [0, 0.3, 0.7854, 1.2]) {
        const ring = coverageRings(drawn(300, 300, square(150, 150, 80, angle)), 300, 300)[0];
        const nodes = ringNodes(ring, 0.5, 8);
        check(nodes.length === 4, `a square turned ${angle}: ${nodes.length} nodes`);
        check(nodes.every(m => !m.h1 && !m.h2 && !m.smooth), 'straight');
        const c = Math.cos(angle), s = Math.sin(angle);
        const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([u, v]) => [150 + 80*(u*c - v*s), 150 + 80*(u*s + v*c)]);
        check(corners.every(q => nodes.some(m => Math.hypot(m.p[0] - q[0], m.p[1] - q[1]) < 0.25)), 'at the corners, not cut off');
    }

    // a circle: no corner, few nodes
    let ring = coverageRings(drawn(300, 300, disk(150, 150, 100)), 300, 300)[0];
    let nodes = ringNodes(ring, 0.5, 8);
    check(nodes.length <= 12, `a circle: ${nodes.length} nodes`);
    check(nodes.every(m => m.h1 && m.h2 && m.smooth), 'all smooth');
    check(near(nodes, ring, 0.6), 'within tolerance');

    // half a disk: two corners, a straight side, a curve
    const half = (x, y) => Math.max(disk(150, 150, 100)(x, y), y - 150);
    ring = coverageRings(drawn(300, 300, half), 300, 300)[0];
    nodes = ringNodes(ring, 0.5, 8);
    const corners = nodes.filter(m => !m.smooth);
    check(corners.length === 2, `half a disk: ${corners.length} corners`);
    check(corners.every(m => Math.abs(m.p[1] - 150) < 1.5), 'at the ends of its straight side');
    const a = nodes.indexOf(corners[0]), b = (a + 1) % nodes.length;
    check(nodes.length > 2 && near(nodes, ring, 0.6), 'within tolerance');
    const straight = [[a, b], [nodes.indexOf(corners[1]), (nodes.indexOf(corners[1]) + 1) % nodes.length]].some(([i, j]) => !nodes[i].h2 && !nodes[j].h1);
    check(straight, 'a straight side has no handles');

    // every segment is straight or curved at both its ends, whichever node a ring starts from
    for (const side of [1, -1]) {
        const cut = (x, y) => Math.max(disk(150, 150, 100)(x, y), side*(y - 150));
        for (const start of [0, 200, 400]) {
            const whole = coverageRings(drawn(300, 300, cut), 300, 300)[0];
            const list = ringNodes([...whole.slice(start), ...whole.slice(0, start)], 0.5, 8);
            check(list.every((m, i) => !!m.h2 === !!list[(i + 1) % list.length].h1), `half a disk ${side}, from ${start}: both ends of a segment agree`);
        }
    }

    // a small ring keeps to a reach of its size: a dot has no corners
    ring = coverageRings(drawn(40, 40, disk(20, 20, 8)), 40, 40)[0];
    check(ringNodes(ring, 0.25, 8).every(m => m.smooth), 'a small dot is smooth');

    // tighter is closer, and takes more nodes
    const wavy = (x, y) => Math.hypot(x - 200, y - 200) - 120 - 18*Math.sin(5*Math.atan2(y - 200, x - 200));
    ring = coverageRings(drawn(400, 400, wavy), 400, 400)[0];
    const fine = ringNodes(ring, 0.3, 8), rough = ringNodes(ring, 2, 8);
    check(fine.length > rough.length, `${fine.length} and ${rough.length} nodes`);
    check(near(fine, ring, 0.4) && near(rough, ring, 2.1), 'each within its tolerance');
}

// 4 ───────────────────────────────────────────────────────────────────────────

{
    // the letter O: rings in no order, in any direction
    const shape = out(disk(150, 150, 120), disk(150, 150, 60));
    const rings = coverageRings(drawn(300, 300, shape), 300, 300).map(ring => ringNodes(ring, 0.5, 8));
    const nodes = rings.flatMap((ring, k) => ring.map((m, i) => (k < rings.length - 1 && i === ring.length - 1 ? { ...m, ringEnd: true } : m)));
    const item = withNodes({ closed: true, style: {} }, nodes);
    for (const [p, inside] of [[[150, 150], false], [[150, 60], true], [[60, 150], true], [[260, 150], true], [[290, 290], false], [[190, 190], false]]) {
        check(hitsPolyline(p, item.points, true, true, 0, 'evenodd') === inside, `the letter O at ${p}`);
    }
}

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
