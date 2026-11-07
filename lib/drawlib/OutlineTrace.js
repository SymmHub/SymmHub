//
//  outlines of a picture: where a coverage (a number per pixel, 0 outside, 1
//  inside) crosses one half, as closed rings of points, and those rings as
//  nodes of a path (Paths.js). The crossing is placed between pixels by
//  interpolation (marching squares), so that the soft edges of a drawing
//  give a place finer than a pixel. On a ring, corners are where it turns
//  sharply over a short reach, put back where the two sides cross since
//  pixels cut them off; a run between corners that stays near its chord is
//  one straight segment, any other is fitted (CurveFit.js).
//
//  A browser draws the text of an SVG but does not hand over its curves: the
//  import traces what it draws (SvgImport.js).
//

import {
    fitCurve,
} from './modules.js';

const ISO = 0.5;
// shorter rings are specks of the drawing's edges, not of what it shows
const MIN_RING_POINTS = 8;
// a turn this sharp is a corner
const CORNER_TURN = 40*Math.PI/180;
// so many points of a ring on each side of a corner are cut off by the pixels
const CUT = 2;

/**
 * the closed rings of pixel coordinates ([[x, y], ...], a pixel's value
 * standing at its integer place) where the coverage crosses one half: an
 * outer outline and its holes alike, in no particular order or direction.
 * Ink touching the edge of the picture leaves a ring open there.
 */
function coverageRings(values, width, height){
    const places = new Map(), links = new Map();
    // the two edges of the grid leaving a pixel by its number: 2*pixel to the right, one more down
    const across = (x, y) => {
        const i = y*width + x, key = 2*i;
        if (!places.has(key)) places.set(key, [x + (ISO - values[i])/(values[i + 1] - values[i]), y]);
        return key;
    };
    const down = (x, y) => {
        const i = y*width + x, key = 2*i + 1;
        if (!places.has(key)) places.set(key, [x, y + (ISO - values[i])/(values[i + width] - values[i])]);
        return key;
    };
    const link = (a, b) => {
        if (!links.has(a)) links.set(a, []);
        if (!links.has(b)) links.set(b, []);
        links.get(a).push(b);
        links.get(b).push(a);
    };
    for (let y = 0; y + 1 < height; y++) {
        for (let x = 0; x + 1 < width; x++) {
            const i = y*width + x;
            const a = values[i], b = values[i + 1], c = values[i + width + 1], d = values[i + width];
            const code = (a >= ISO ? 8 : 0) + (b >= ISO ? 4 : 0) + (c >= ISO ? 2 : 0) + (d >= ISO ? 1 : 0);
            if (code === 0 || code === 15) continue;
            const top = () => across(x, y), bottom = () => across(x, y + 1), left = () => down(x, y), right = () => down(x + 1, y);
            switch (code) {
            case 1: case 14: link(left(), bottom()); break;
            case 2: case 13: link(bottom(), right()); break;
            case 3: case 12: link(left(), right()); break;
            case 4: case 11: link(top(), right()); break;
            case 6: case 9:  link(top(), bottom()); break;
            case 7: case 8:  link(left(), top()); break;
            default:
                // two opposite corners: joined when the middle of the square is with them
                if ((code === 5) === ((a + b + c + d)/4 >= ISO)) { link(left(), top()); link(bottom(), right()); }
                else { link(left(), bottom()); link(top(), right()); }
            }
        }
    }
    const seen = new Set(), rings = [];
    for (const start of links.keys()) {
        if (seen.has(start)) continue;
        const ring = [];
        let before = null, at = start;
        while (at !== undefined && !seen.has(at)) {
            seen.add(at);
            ring.push(places.get(at));
            const from = before;
            before = at;
            at = links.get(at).find(k => k !== from && !seen.has(k));
        }
        if (ring.length >= MIN_RING_POINTS) rings.push(ring);
    }
    return rings;
}

/** the places on a ring where it turns sharply, each the sharpest within the reach */
function cornersOf(ring, reach){
    const n = ring.length, turn = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const p = ring[i], a = ring[(i - reach + n) % n], b = ring[(i + reach) % n];
        const ux = p[0] - a[0], uy = p[1] - a[1], vx = b[0] - p[0], vy = b[1] - p[1];
        turn[i] = Math.abs(Math.atan2(ux*vy - uy*vx, ux*vx + uy*vy));
    }
    const corners = [];
    for (let i = 0; i < n; i++) {
        if (turn[i] < CORNER_TURN) continue;
        let sharpest = true;
        for (let k = 1; k <= reach && sharpest; k++) sharpest = turn[(i + k) % n] <= turn[i] && turn[(i - k + n) % n] < turn[i];
        if (sharpest) corners.push(i);
    }
    return corners;
}

/** where the sides meeting at a corner of a ring cross; the ring's own point when they do not, nearby */
function cornerPoint(ring, i, reach){
    const n = ring.length, at = (k) => ring[(i + k + n) % n];
    const a = at(-reach), b = at(reach), ux = at(-CUT)[0] - a[0], uy = at(-CUT)[1] - a[1], vx = at(CUT)[0] - b[0], vy = at(CUT)[1] - b[1];
    const det = ux*vy - uy*vx;
    if (Math.abs(det) < 1e-6*Math.hypot(ux, uy)*Math.hypot(vx, vy)) return ring[i];
    const t = ((b[0] - a[0])*vy - (b[1] - a[1])*vx)/det, p = [a[0] + t*ux, a[1] + t*uy];
    return Math.hypot(p[0] - ring[i][0], p[1] - ring[i][1]) <= reach ? p : ring[i];
}

/** the nodes of an open run of points: one straight segment when it stays near its chord */
function runNodes(run, tolerance){
    const a = run[0], b = run[run.length - 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], chord = Math.hypot(dx, dy);
    if (chord > 0 && run.every(p => Math.abs((p[0] - a[0])*dy - (p[1] - a[1])*dx) <= tolerance*chord)) {
        return [{ p: a, h1: null, h2: null }, { p: b, h1: null, h2: null }];
    }
    return fitCurve(run, false, tolerance);
}

/**
 * the nodes of a closed path along a ring within tolerance (the ring's units),
 * corners looked for over a reach of that many points of it
 */
function ringNodes(ring, tolerance, reach){
    const n = ring.length, near = Math.max(CUT + 1, Math.min(reach, Math.floor(n/16)));
    const corners = cornersOf(ring, near);
    if (!corners.length) return fitCurve(ring, true, tolerance);
    const nodes = [];
    corners.forEach((corner, k) => {
        const end = corners[(k + 1) % corners.length], length = (end - corner + n - 1) % n + 1;
        // between the two corners, without what the pixels cut off them
        const run = [cornerPoint(ring, corner, near)];
        for (let i = CUT; i <= length - CUT; i++) run.push(ring[(corner + i) % n]);
        run.push(cornerPoint(ring, end, near));
        const part = runNodes(run, tolerance);
        if (part.length < 2) return;
        if (nodes.length) nodes[nodes.length - 1].h2 = part[0].h2;
        else nodes.push(part[0]);
        nodes.push(...part.slice(1));
    });
    if (nodes.length < 2) return nodes;
    // the last node is the first again
    nodes[0].h1 = nodes.pop().h1;
    return nodes;
}

export { coverageRings, ringNodes };
