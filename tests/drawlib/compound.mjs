/*
  tests of compound paths, several closed rings in one item (lib/drawlib/Paths.js)

    node tests/drawlib/compound.mjs

  1. the flattened outline: one polygon, right under both fill rules, on two and three
     rings, against each ring tested alone; one ring as before
  2. traceNodes and the bridges: a moveTo per ring, no line between them
  3. what the node tool does: next and previous on a ring, a node put in on a closing
     segment, a node removed, smooth; a path of one ring as before
  4. maps, the document, saving: the rings survive; To polyline and flattening keep them
  5. SVG export: a subpath per ring
  6. DrawingEditor: a hole lets clicks through, a bridge is not hit, a fill is cut by it
*/

import { flattenNodes, flattenDetailed, nodeRings, nextNode, prevNode, traceNodes, itemBridges, withNodes, splitSegment, removeNode, nodeSmoothToggled,
         mappedItem, polylineFromPath, flattenedItem } from '../../lib/drawlib/Paths.js';
import { hitsPolyline } from '../../lib/drawlib/Orbits.js';
import { itemsToSvg } from '../../lib/drawlib/SvgExport.js';
import { DrawingDocument } from '../../lib/drawlib/DrawingDocument.js';
import { DrawingEditor } from '../../lib/drawlib/DrawingEditor.js';

globalThis.window = globalThis.window || { addEventListener(){} };

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

const node = (x, y) => ({ p: [x, y], h1: null, h2: null });
// a square of half size h, counterclockwise, or clockwise
const square = (cx, cy, h, clockwise = false) => {
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => node(cx + h*x, cy + h*y));
    return clockwise ? c.reverse() : c;
};
// the same ring starting at its node k
const from = (ring, k) => [...ring.slice(k), ...ring.slice(0, k)];
const joined = (...rings) => rings.flatMap((ring, k) => ring.map((m, i) => (k < rings.length - 1 && i === ring.length - 1 ? { ...m, ringEnd: true } : m)));
const STYLE = { stroke: null, strokeWidth: 0, fill: { rgba: [0, 0, 1, 1] }, opacity: 1 };
const path = (nodes, style = STYLE) => withNodes({ closed: true, style }, nodes);

// 1 ───────────────────────────────────────────────────────────────────────────

{
    // a square with a square hole (the inner ring turning the other way) and an island in the hole
    const outer = square(0, 0, 3), hole = square(0.5, 0, 1.5, true), island = square(0.5, 0, 0.5), far = square(7, 2, 1);
    const cases = {
        'two rings': [outer, hole],
        'three rings': [outer, hole, island],
        'a hole and a far island': [outer, hole, far],
        'four rings': [outer, hole, island, far],
    };
    const winding = (p, ring) => {
        let w = 0;
        for (let i = 0; i < ring.length; i++) {
            const a = ring[i].p, b = ring[(i + 1) % ring.length].p;
            const side = (b[0] - a[0])*(p[1] - a[1]) - (b[1] - a[1])*(p[0] - a[0]);
            if (a[1] <= p[1] && b[1] > p[1] && side > 0) w++;
            if (a[1] > p[1] && b[1] <= p[1] && side < 0) w--;
        }
        return w;
    };
    let s = 12345;
    const rnd = () => { s = (s*1664525 + 1013904223) % 4294967296; return s/4294967296; };
    for (const [name, rings] of Object.entries(cases)) {
        const points = flattenNodes(joined(...rings), true);
        for (let k = 0; k < 4000; k++) {
            const p = [-4 + 13*rnd() + 1e-5, -4 + 8*rnd() + 1e-5];
            const w = rings.reduce((sum, ring) => sum + winding(p, ring), 0);
            const crossed = rings.reduce((sum, ring) => sum + Math.abs(winding(p, ring)), 0);
            check(hitsPolyline(p, points, true, true, 0, 'nonzero') === (w !== 0), `${name}: nonzero at ${p}`);
            check(hitsPolyline(p, points, true, true, 0, 'evenodd') === (crossed % 2 === 1), `${name}: even-odd at ${p}`);
        }
    }

    const one = square(0, 0, 1), flat = flattenDetailed(one, true);
    check(flat.points.length === 8 && flat.pieces.length === 4 && flat.pieces.every(q => q.seg >= 0), 'one ring: as before');
    const open = flattenDetailed(one, false);
    check(open.points.length === 8 && open.pieces.length === 3, 'an open path: as before');

    const two = flattenDetailed(joined(square(0, 0, 3), square(0, 0, 1, true)), true);
    check(two.pieces.length === two.points.length/2, 'a piece per point');
    check(two.pieces.filter(q => q.seg < 0).length === 2, 'a bridge there and back');
    check(new Set(two.pieces.map(q => q.seg)).size === 9, 'eight segments and the bridge');
}

// 2 ───────────────────────────────────────────────────────────────────────────

{
    const log = [];
    const sink = { moveTo: (x, y) => log.push('M'), lineTo: (x, y) => log.push('L'), bezierCurveTo: () => log.push('C'), closePath: () => log.push('Z') };
    const curved = square(0, 0, 1, true);
    curved[0] = { ...curved[0], h2: [0.5, 0.5] };
    traceNodes(joined(square(0, 0, 3), curved), true, sink);
    check(log.join('') === 'MLLLLZ' + 'MCLLLZ', `a moveTo per ring: ${log.join('')}`);

    log.length = 0;
    traceNodes(square(0, 0, 1), false, sink);
    check(log.join('') === 'MLLL', `an open path: ${log.join('')}`);

    // the hole starts at its far corner (1.5, 1): the bridge from (-3, -3) crosses it
    const item = path(joined(square(0, 0, 3), from(square(0.5, 0, 1, true), 1)));
    const bridges = itemBridges(item);
    check(bridges && bridges.size === 2, 'two bridges');
    check(itemBridges(item) === bridges, 'kept');
    check(itemBridges(path(square(0, 0, 1))) === null, 'one ring: none');
    check(itemBridges({ points: [0, 0, 1, 1] }) === null, 'a polyline: none');

    const pts = item.points, inHole = [0.6, 0.205];
    check(hitsPolyline(inHole, pts, true, true, 0.01, 'nonzero', null), 'the bridge would be hit');
    check(!hitsPolyline(inHole, pts, true, true, 0.01, 'nonzero', bridges), 'it is left out');
    check(hitsPolyline([1.55, 0], pts, true, false, 0.1, 'nonzero', bridges), 'the rings are not');
    check(hitsPolyline([0.5, 1.05], pts, true, false, 0.1, 'nonzero', bridges), 'and the segment that closes a ring is not');
    check(!hitsPolyline([-1.75, -1], pts, true, false, 0.01, 'nonzero', bridges), 'nor is the bridge when nothing is filled');
    const closing = item.points.length/2 - 1;
    check(bridges.has(closing), 'the closing segment of the points is one');
}

// 3 ───────────────────────────────────────────────────────────────────────────

{
    const nodes = joined(square(0, 0, 3), square(0, 0, 1, true));
    check(nodeRings(nodes).join(' ') === '0,3 4,7', 'the rings');
    check(nextNode(nodes, 3) === 0 && nextNode(nodes, 7) === 4 && nextNode(nodes, 4) === 5, 'next wraps on its ring');
    check(prevNode(nodes, 0) === 3 && prevNode(nodes, 4) === 7 && prevNode(nodes, 5) === 4, 'previous too');
    const one = square(0, 0, 1);
    check(nextNode(one, 3) === 0 && prevNode(one, 0) === 3, 'one ring');

    // a node on the closing segment of the first ring
    let out = splitSegment(nodes, true, 3, 0.5);
    check(out.length === 9 && nodeRings(out).join(' ') === '0,4 5,8', 'split a closing segment: the ring has it');
    check(near(out[4].p[0], -3) && near(out[4].p[1], 0), 'halfway to the ring\'s first node');
    check(!out[3].ringEnd && out[4].ringEnd, 'the new node ends the ring');
    check(nodes[3].ringEnd && nodes.length === 8, 'the nodes stay as they were');
    out = splitSegment(nodes, true, 7, 0.5);
    check(nodeRings(out).join(' ') === '0,3 4,8' && near(out[8].p[1], 0), 'the last ring too');
    out = splitSegment(nodes, true, 0, 0.5);
    check(nodeRings(out).join(' ') === '0,4 5,8' && out[4].ringEnd, 'any other segment');

    // removed: the ring's last, a ring's only node
    out = removeNode(nodes, 3);
    check(nodeRings(out).join(' ') === '0,2 3,6', 'the last of a ring removed');
    const small = joined(square(0, 0, 3), [node(9, 9)], square(0, 0, 1, true));
    check(nodeRings(removeNode(small, 4)).join(' ') === '0,3 4,7', 'a ring of one node gone');
    const tail = joined(square(0, 0, 3), [node(9, 9)]);
    const left = removeNode(tail, 4);
    check(left.length === 4 && !left.some(m => m.ringEnd), 'the last ring gone: one ring, an ordinary path');
    check(itemBridges(path(left)) === null, 'without bridges');

    // smooth: the neighbours on its ring
    const toggled = nodeSmoothToggled(nodes, 4, true);
    const d = [nodes[5].p[0] - nodes[7].p[0], nodes[5].p[1] - nodes[7].p[1]];
    check(toggled[4].smooth, 'smooth');
    const u = [toggled[4].h2[0] - toggled[4].p[0], toggled[4].h2[1] - toggled[4].p[1]];
    check(near(u[0]*d[1] - u[1]*d[0], 0), 'its handles along its ring\'s neighbours');
    const end = nodeSmoothToggled(nodes, 3, true);
    const e = [nodes[0].p[0] - nodes[2].p[0], nodes[0].p[1] - nodes[2].p[1]];
    const v = [end[3].h2[0] - end[3].p[0], end[3].h2[1] - end[3].p[1]];
    check(near(v[0]*e[1] - v[1]*e[0], 0), 'at the end of a ring too');
}

// 4 ───────────────────────────────────────────────────────────────────────────

{
    const item = path(joined(square(0, 0, 3), square(0.5, 0, 1, true)));
    const moved = mappedItem(item, q => [q[0] + 1, 2*q[1]]);
    check(moved.nodes[3].ringEnd && itemBridges(moved).size === 2, 'mapped: the rings stay');
    check(!hitsPolyline([1.5, 0.1], moved.points, true, true, 0, 'nonzero'), 'and the hole');
    check(hitsPolyline([3.5, 0.1], moved.points, true, true, 0, 'nonzero'), 'and the ring');

    const doc = DrawingDocument();
    doc.clear();
    const it = doc.insertItem(item);
    check(doc.getItem(it.id).nodes[3].ringEnd === true, 'the document keeps the rings');
    const back = JSON.parse(JSON.stringify(doc.toJSON()));
    doc.fromJSON(back);
    const again = doc.getItem(it.id);
    check(again && again.nodes[3].ringEnd === true && again.points.length === item.points.length, 'saved and read');
    check(doc.getItem(it.id).type === 'path', 'a path');

    const curved = joined(square(0, 0, 3).map((m, i) => (i ? m : { ...m, h2: [0, -4], h1: [-4, 0] })), square(0, 0, 1, true));
    const c = path(curved);
    const poly = polylineFromPath(c);
    check(poly.nodes && poly.nodes.every(m => !m.h1 && !m.h2), 'To polyline: straight nodes');
    check(itemBridges(poly) && nodeRings(poly.nodes).length === 2, 'the rings kept');
    check(poly.nodes.length > curved.length, 'through the flattened curve');
    const flat = flattenedItem(c, 2e-3);
    check(flat.nodes && nodeRings(flat.nodes).length === 2, 'flattened for an export: too');
    const plain = polylineFromPath(path(square(0, 0, 1)));
    check(plain.type === 'polyline' && !plain.nodes, 'one ring: a polyline as before');
}

// 5 ───────────────────────────────────────────────────────────────────────────

{
    const svg = itemsToSvg([path(joined(square(0, 0, 3), square(0.5, 0, 1, true)))]);
    const d = svg.match(/ d="([^"]*)"/)[1];
    check((d.match(/M/g) || []).length === 2 && (d.match(/Z/g) || []).length === 2, `a subpath per ring: ${d}`);
    check(/Z M/.test(d), 'one after the other');
    check(/stroke-miterlimit="4"/.test(itemsToSvg([path(square(0, 0, 1), { ...STYLE, stroke: { rgba: [1, 0, 0, 1] }, strokeWidth: 0.1, miterLimit: 4 })])), 'a miter limit goes out');
    check(!/miterlimit/.test(itemsToSvg([path(square(0, 0, 1), { ...STYLE, stroke: { rgba: [1, 0, 0, 1] }, strokeWidth: 0.1 })])), 'none, none');
    const line = itemsToSvg([{ type: 'path', closed: false, nodes: square(0, 0, 1), points: flattenNodes(square(0, 0, 1), false), style: { ...STYLE, stroke: { rgba: [1, 0, 0, 1] }, strokeWidth: 0.1 } }]);
    check(!/Z/.test(line.match(/ d="([^"]*)"/)[1]), 'an open path stays open');
}

// 6 ───────────────────────────────────────────────────────────────────────────

{
    const document = DrawingDocument();
    document.clear();
    const editor = DrawingEditor({
        document,
        getContext: () => ({ group: null, ptc: { centerX: 0, centerY: 0, scale: 1, angle: 0 }, sprites: false, visLayers: [] }),
        view: { toCanvas: w => w, toWorld: c => ({ pnt: c }), isLinear: () => true, pixelSize: () => 0.001 },
    });
    const under = document.insertItem(path(square(0, 0, 4, false), { ...STYLE, fill: { rgba: [1, 0, 0, 1] } }));
    const o = document.insertItem(path(joined(square(0, 0, 3), from(square(0.5, 0, 1, true), 1))));
    check(editor.hitTest([2, 2], null, 0)?.item.id === o.id, 'on the ring');
    check(editor.hitTest([0.5, 0], null, 0)?.item.id === under.id, 'through the hole');
    check(editor.hitTest([0.6, 0.205], null, 0)?.item.id === under.id, 'the bridge in the hole is not there');
    check(editor.hitTest([0.6, 0.205], null, 10)?.item.id === under.id, 'nor with a reach');
    check(editor.hitTest([1.505, 0], null, 10)?.item.id === o.id, 'its edge is, from in the hole');
    check(editor.hitTest([-3.5, 0], null, 0)?.item.id === under.id, 'outside');

    // a fill, cut by the rings: its child is picked on the ring, not in the hole
    const image = { type: 'image', src: null, closed: true, points: [-3, -3, 3, -3, 3, 3, -3, 3], style: { stroke: null, fill: null, strokeWidth: 0, opacity: 1 } };
    document.insertItem(image, null, null, o.id);
    editor.setSelection([{ id: o.id, frame: null, frameInv: null }]);
    editor.setStyleValue('filled', false);
    editor.clearSelection();
    check(editor.hitTest([2, 2], null, 0)?.item.id === o.id, 'its content picks it');
    check(editor.hitTest([0.5, 0], null, 0)?.item.id === under.id, 'not in the hole');
    check(editor.getSelection().length === 0, 'nothing selected');
}

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
