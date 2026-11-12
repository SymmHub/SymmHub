/*
  tests of the images of points under reflection lists (lib/invlib Inversive.js, ITransform.js)

    node tests/transforms/point_images.mjs

  1. a point stays a point (H4toU4Point, 2026-11-12): far points of the plane reflected
     in a few spheres and a plane. H4toU4 tells a point from a sphere by the inner
     product, whose rounding grows with the square of the distance, and read some of
     these images as spheres of radius 4e-8 (the Dirichlet check of the group 237 threw
     on one, tests/groups/dirichlet.mjs section 17). ITransform.transform and
     inverseTransform, iTransformU4, iInverseTransformU4 and iReflectU4 give points, where
     the H4 vector says, and splanes are as before
  2. iTransformU4 takes an ITransform as well as a reflection list (it called a method
     ITransform does not have)
  3. the point at infinity (H4toU4 of the vector [0, 0, 0, 1, 1]) is a point with
     coordinates, a new one every time (it was a shared point whose v was the number 1e10)
*/

const { iSphere, iPlane, iPoint, H4toU4, H4toU4Point, U4toH4, iTransformH4, iTransformU4, iInverseTransformU4, iReflectU4,
        ITransform, SPLANE_SPHERE, SPLANE_POINT } = await import('../../lib/invlib/invlib.js');

let failed = 0;
function check(ok, what){
    if (ok) return;
    failed++;
    console.log('FAILED:', what);
}

const ref = [iSphere([3.6, 2.0, 0, 1]), iPlane([0.6, 0.8, 0, 0.3]), iSphere([-1.2, 0.4, 0, 2])];
const tr = new ITransform(ref);
const inv = [...ref].reverse();
const fmt = v => v.map(x => x.toPrecision(6)).join(', ');

// ---- 1. a point stays a point -------------------------------------------------------------

console.log('1. a point stays a point');
{
    let spheres = 0;
    for (const R of [1e2, 1e3, 1e4, 1.3e4, 3e4, 1e5, 1e6, 1e7]) {
        for (const a of [0.3, 1.0, 2.2, 4.1]) {
            const p = iPoint([R * Math.cos(a), R * Math.sin(a), 0, 0]);
            const v = iTransformH4(ref, U4toH4(p));
            const x = v[0] / (v[4] - v[3]), y = v[1] / (v[4] - v[3]);
            const raw = H4toU4(v.slice());
            if (raw.type === SPLANE_SPHERE) spheres++;
            const near = q => q && q.type === SPLANE_POINT && Array.isArray(q.v)
                && Math.hypot(q.v[0] - x, q.v[1] - y) <= 1e-9 * (1 + Math.hypot(x, y)) && Math.abs(q.v[3]) < 1e-6;
            const images = {
                'H4toU4Point': H4toU4Point ? H4toU4Point(v) : null,
                'ITransform.transform': tr.transform(p),
                'ITransform.inverseTransform': new ITransform(inv).inverseTransform(p),
                'iTransformU4': iTransformU4(ref, p),
                'iInverseTransformU4': iInverseTransformU4(inv, p),
            };
            for (const [name, q] of Object.entries(images)) {
                check(near(q), `${name} of the point at ${R} (angle ${a}): type ${q && q.type}, ${q && Array.isArray(q.v) ? fmt(q.v) : q && q.v} against ${fmt([x, y])}`);
            }
            // one reflection: the sphere the far point is reflected in last
            const r1 = iReflectU4(ref[2], iPoint([R * Math.cos(a), R * Math.sin(a), 0, 0]));
            const w = iTransformH4([ref[2]], U4toH4(p));
            check(r1.type === SPLANE_POINT && Math.hypot(r1.v[0] - w[0] / (w[4] - w[3]), r1.v[1] - w[1] / (w[4] - w[3])) < 1e-9,
                `iReflectU4 of the point at ${R} (angle ${a}): type ${r1.type}`);
        }
    }
    // the case exists: without H4toU4Point some of these images are spheres
    check(spheres > 0, 'H4toU4 reads some far images as spheres (the case of the test)');
    console.log(`   H4toU4 alone: ${spheres} of 32 images read as spheres`);

    // splanes as before: a sphere's image is the sphere H4toU4 gives
    const s = iSphere([0.4, -0.3, 0, 0.7]);
    const a = tr.transform(s), b = H4toU4(iTransformH4(ref, U4toH4(s)));
    check(a.type === b.type && a.v.every((x, i) => Math.abs(x - b.v[i]) < 1e-12), `a sphere's image: ${fmt(a.v)} against ${fmt(b.v)}`);
    // a point in space (w > 0) keeps its height
    const h = tr.transform(iPoint([0.2, 0.1, 0, 0.5]));
    const hv = iTransformH4(ref, U4toH4(iPoint([0.2, 0.1, 0, 0.5])));
    check(h.type === SPLANE_POINT && h.v[3] > 0 && Math.abs(h.v[0] - H4toU4(hv).v[0]) < 1e-12, `a point in space: ${fmt(h.v)}`);
}

// ---- 2. iTransformU4 of an ITransform ------------------------------------------------------

console.log('2. iTransformU4 of an ITransform');
{
    const p = iPoint([0.31, -0.42, 0, 0]);
    let q = null, error = '';
    try {
        q = iTransformU4(tr, p);
    } catch (e) {
        error = e.message;
    }
    const r = iTransformU4(ref, p);
    check(q && q.type === SPLANE_POINT && q.v.every((x, i) => Math.abs(x - r.v[i]) < 1e-12), `as with the list: ${error || fmt(q.v)} against ${fmt(r.v)}`);
    const s = iSphere([0.4, -0.3, 0, 0.7]);
    let t = null;
    try { t = iTransformU4(tr, s); } catch (e) { t = null; }
    check(t && t.type === SPLANE_SPHERE, 'a sphere through an ITransform');
}

// ---- 3. the point at infinity ----------------------------------------------------------------

console.log('3. the point at infinity');
{
    const a = H4toU4([0, 0, 0, 1, 1]), b = H4toU4([0, 0, 0, 1, 1]);
    check(a && a.type === SPLANE_POINT && Array.isArray(a.v) && a.v.length === 4 && a.v.every(Number.isFinite) && a.v[0] > 1e9,
        `a point with coordinates: ${a && JSON.stringify(a.v)}`);
    check(a !== b && a.v !== b.v, 'a new point every time');
    // a reflection in the unit sphere sends the origin there
    const o = iReflectU4(iSphere([0, 0, 0, 1]), iPoint([0, 0, 0, 0]));
    check(o.type === SPLANE_POINT && Array.isArray(o.v) && Math.hypot(...o.v) > 1e9, `the image of the centre: ${o && JSON.stringify(o.v)}`);
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
