/*
  tests of fitting curves to points with corners kept (lib/drawlib/CurveFit.js)

    node tests/drawlib/curve_fit.mjs

  sparse polygons (a star, a hexagon, a square, an open zigzag) keep every
  corner and their straight sides; sampled curves (a 12-gon, a wavy loop, a
  jittery hand-drawn circle) get the same smooth fit as without corners; a
  jittery hand-drawn V keeps its tip; a D keeps its two corners, its diameter
  straight and its arc fitted. Each fit stays within the tolerance of the points.
*/

import { fitCurve } from '../../lib/drawlib/CurveFit.js';

const TOL = 0.0015;   // 1.5 px of 0.001
let seed = 7;
const rnd = () => { seed = (seed*16807) % 2147483647; return seed/2147483647 - 0.5; };

// points along the fitted path, 40 per segment
function pathPoints(nodes, closed){
    const out = [], m = nodes.length, segs = closed ? m : m - 1;
    for (let k = 0; k < segs; k++) {
        const a = nodes[k], b = nodes[(k + 1)%m];
        const c1 = a.h2 || a.p, c2 = b.h1 || b.p;
        for (let i = 0; i <= 40; i++) {
            const t = i/40, u = 1 - t;
            const w = [u*u*u, 3*u*u*t, 3*u*t*t, t*t*t];
            out.push([w[0]*a.p[0] + w[1]*c1[0] + w[2]*c2[0] + w[3]*b.p[0], w[0]*a.p[1] + w[1]*c1[1] + w[2]*c2[1] + w[3]*b.p[1]]);
        }
    }
    return out;
}
function distToPolyline(p, pts, closed){
    let best = Infinity;
    const n = pts.length, segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
        const a = pts[i], b = pts[(i + 1)%n], ab = [b[0] - a[0], b[1] - a[1]], l2 = ab[0]*ab[0] + ab[1]*ab[1];
        const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0])*ab[0] + (p[1] - a[1])*ab[1])/l2)) : 0;
        best = Math.min(best, Math.hypot(p[0] - a[0] - t*ab[0], p[1] - a[1] - t*ab[1]));
    }
    return best;
}
// how far the path strays from the polyline's sides, and how far the points lie off the path
function deviation(nodes, pts, closed){
    const path = pathPoints(nodes, closed);
    const off = Math.max(...path.map(p => distToPolyline(p, pts, closed)));
    const miss = Math.max(...pts.map(p => distToPolyline(p, path, false)));
    return { off, miss };
}
const sharpCount = nodes => nodes.filter(n => !n.smooth).length;
const straightCount = (nodes, closed) => { let s = 0; const m = nodes.length; for (let k = 0; k < (closed ? m : m - 1); k++) if (!nodes[k].h2 && !nodes[(k + 1)%m].h1) s++; return s; };

function polygon(n, r, cx = 0.2, cy = 0.1, inner = null){
    const pts = [];
    const m = inner ? 2*n : n;
    for (let i = 0; i < m; i++) {
        const a = 2*Math.PI*i/m + 0.1, rr = inner && i%2 ? inner : r;
        pts.push([cx + rr*Math.cos(a), cy + rr*Math.sin(a)]);
    }
    return pts;
}

const cases = [];
cases.push({ name: 'star p6 (12 vertices)', pts: polygon(6, 0.05, 0.2, 0.1, 0.05/Math.sqrt(3)), closed: true, expect: { sharp: 12, straight: 12 } });
cases.push({ name: 'hexagon', pts: polygon(6, 0.05), closed: true, expect: { sharp: 6, straight: 6 } });
cases.push({ name: 'square', pts: polygon(4, 0.05), closed: true, expect: { sharp: 4, straight: 4 } });
cases.push({ name: '12-gon (30 deg turns)', pts: polygon(12, 0.05), closed: true, expect: { sharp: 0 } });
{
    const pts = [];
    for (let i = 0; i < 24; i++) { const a = 2*Math.PI*i/24, r = 0.05*(1 + 0.2*Math.sin(3*a)); pts.push([0.2 + r*Math.cos(a), 0.1 + r*Math.sin(a)]); }
    cases.push({ name: 'wavy loop (24 points)', pts, closed: true, expect: { sharp: 0 } });
}
{
    // a hand-drawn circle: a point every 3 px, 0.3 px jitter
    const pts = [], r = 0.04, n = Math.round(2*Math.PI*r/0.003);
    for (let i = 0; i < n; i++) { const a = 2*Math.PI*i/n; pts.push([0.2 + r*Math.cos(a) + 0.0003*rnd(), 0.1 + r*Math.sin(a) + 0.0003*rnd()]); }
    cases.push({ name: 'hand circle (jitter)', pts, closed: true, expect: { sharp: 0 } });
}
{
    // a hand-drawn V: 60 deg at the tip, a point every 2 px, 0.4 px jitter
    const pts = [], L = 0.08;
    for (let s = L; s > 0; s -= 0.002) pts.push([0.2 - s*Math.sin(Math.PI/6) + 0.0004*rnd(), 0.1 + s*Math.cos(Math.PI/6) + 0.0004*rnd()]);
    for (let s = 0; s <= L; s += 0.002) pts.push([0.2 + s*Math.sin(Math.PI/6) + 0.0004*rnd(), 0.1 + s*Math.cos(Math.PI/6) + 0.0004*rnd()]);
    cases.push({ name: 'hand V (jitter), open', pts, closed: false, expect: { sharp: 3 } });   // two ends and the tip
}
{
    // a D: a dense half circle and its straight diameter, two vertices there
    const pts = [], r = 0.05;
    for (let i = 0; i <= 30; i++) { const a = -Math.PI/2 + Math.PI*i/30; pts.push([0.2 + r*Math.cos(a), 0.1 + r*Math.sin(a)]); }
    cases.push({ name: 'D shape', pts, closed: true, expect: { sharp: 2, straight: 1 } });
}
{
    // an open zigzag of four long strokes
    const pts = [[0, 0], [0.05, 0.04], [0.1, 0], [0.15, 0.04], [0.2, 0]];
    cases.push({ name: 'open zigzag', pts, closed: false, expect: { sharp: 5, straight: 4 } });
}

let failed = 0;
for (const c of cases) {
    const old = fitCurve(c.pts, c.closed, TOL);
    const now = fitCurve(c.pts, c.closed, TOL, true);
    const dOld = deviation(old, c.pts, c.closed), dNow = deviation(now, c.pts, c.closed);
    const sharp = sharpCount(now), straight = straightCount(now, c.closed);
    let ok = sharp === c.expect.sharp && (c.expect.straight === undefined || straight === c.expect.straight) && dNow.miss <= TOL*1.05;
    if (c.expect.sharp === 0) ok = ok && JSON.stringify(now) === JSON.stringify(old);   // a curve: the same fit as before
    else ok = ok && dNow.off <= Math.max(TOL*1.05, 0);
    if (!ok) failed++;
    console.log(`${c.name}: nodes ${old.length} -> ${now.length}, sharp ${sharp}, straight sides ${straight}; off the sides ${dOld.off.toFixed(4)} -> ${dNow.off.toFixed(4)}, points off the path ${dOld.miss.toFixed(4)} -> ${dNow.miss.toFixed(4)}  ${ok ? 'ok' : 'FAILED'}`);
}
console.log(failed ? `${failed} FAILED` : 'curve_fit: all checks passed');
process.exit(failed ? 1 : 0);
