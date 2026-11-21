/*
  tests of the navigator's map from a world point to the canvas pixel that shows it
  (lib/symhublib/InversiveNavigator.js worldToScreen, worldToScreenPlace, whereShown,
  viewHasSheets; docs/conformal_transforms_plan.md 3.1 and section 14, outside the
  repository): the view's whole chain taken backwards, on the sheet of a seed

    node tests/symhublib/world_to_screen.mjs

  A navigator with a canvas of 800 x 500.

  1. without conformal transformations: the Moebius transform and the canvas backwards,
     as before; a seed changes nothing; on the sphere a point of the back has a pixel
     (worldToScreen always gives one) but is shown nowhere (whereShown)
  2. under a band, with the fixed points before it: the pixel shows the point (before,
     worldToScreen stopped at the Moebius transform and gave a pixel showing another
     point); a pixel's step from it is a step of the view's scale there (the nudge)
  3. under a periodic wrap a point shows in every cell: the pixel is the one in the cell
     of the seed; without a seed the canvas centre's; whereShown takes the canvas
     centre's copy when the seed's is off the canvas, and none for a point outside the
     wrap's cell; viewHasSheets tells that the seed matters
  4. the exponent with a scale: one place, shown on the logarithm's sheet alone
*/

globalThis.window = globalThis.window || { addEventListener(){}, localStorage: { getItem: () => null, setItem(){} } };

const { InversiveNavigator } = await import('../../lib/symhublib/InversiveNavigator.js');
const { iSphere, iPlane } = await import('../../lib/invlib/invlib.js');

let failed = 0, checks = 0;
function check(ok, what){
    checks++;
    if (!ok) { failed++; process.stdout.write('FAILED: ' + what + '\n'); }
}
console.log = () => {};
console.trace = () => {};

const plain = (v) => JSON.parse(JSON.stringify(v));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const fmt = (p) => p ? '(' + p.map(x => x.toFixed(4)).join(', ') + ')' : 'null';
const listOf = (rows) => ({ className: 'ProjectionTransform', params: { enabled: true,
    maps: { className: 'ObjArray', params: { id: 'maps', children: rows } } } });
const row = (className, id, values = {}) => ({ className, params: { id, enabled: true, ...values } });

const canvas = { width: 800, height: 500, clientWidth: 800, clientHeight: 500 };

/** a navigator at a view: the canvas's centre and zoom, the Moebius transform, the sphere, the list */
function navigator({ centre = [0, 0], zoom = 1, moebius = [], sphere = false, rows = [] } = {}){
    const nav = new InversiveNavigator({});
    nav.init({ canvas, onChanged(){} });
    nav.setParamsMap({
        mode: 'hyperbolic',
        euclidean: { centerX: centre[0], centerY: centre[1], zoom, angle: 0 },
        inversive: { enabled: true, itrans: plain(moebius), poleSet: false, poleX: 0, poleY: 0, anchored: null },
        spherical: { enabled: sphere },
        projection: listOf(rows),
    }, true);
    return nav;
}

const MOEBIUS = [iSphere([0.4, 0.1, 0, 1.3]), iPlane([0.6, 0.8, 0, 0.05])];
const PIXELS = [[400, 250], [120, 80], [700, 420], [333.3, 77.7], [50, 460]];

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const nav = navigator({ centre: [0.2, -0.1], zoom: 1.5, moebius: MOEBIUS });
    check(!nav.hasProjectionMaps() && !nav.viewHasSheets(), 'no transformations: one place for a point');
    let worst = 0, seeded = 0, shown = 0;
    for (const s of PIXELS) {
        const w = nav.screenToWorld(s).pnt;
        const c = nav.worldToScreen(w);
        worst = Math.max(worst, dist(c, s));
        seeded = Math.max(seeded, dist(nav.worldToScreen(w, [10, 480]), c));
        const at = nav.whereShown(w, [10, 480]);
        if (at && dist(at, s) < 1e-6) shown++;
    }
    check(worst < 1e-8, `the Moebius transform backwards: a pixel's point shows at the pixel (${worst.toExponential(1)})`);
    check(seeded === 0, 'a seed changes nothing');
    check(shown === PIXELS.length, 'and whereShown gives the same pixels');
    const place = nav.worldToScreenPlace(nav.screenToWorld([120, 80]).pnt);
    check(place && place.shown && dist(place.pnt, [120, 80]) < 1e-8, 'worldToScreenPlace: the pixel, shown');

    // the sphere: a point of the front shows, one of the back has a pixel and is shown nowhere
    const ball = navigator({ zoom: 0.8, sphere: true });
    const front = ball.screenToWorld([450, 230]).pnt;
    check(dist(ball.worldToScreen(front), [450, 230]) < 1e-8 && dist(ball.whereShown(front), [450, 230]) < 1e-8, 'the sphere: a point of the front at its pixel');
    const back = [3, 1];        // outside the unit disk of the plane: the back hemisphere
    const pix = ball.worldToScreen(back);
    check(pix && Number.isFinite(pix[0]) && Number.isFinite(pix[1]), `a point of the back has a pixel all the same: ${fmt(pix)}`);
    check(ball.whereShown(back) === null && ball.worldToScreenPlace(back) === null, 'and is shown nowhere');
}

// 2 ───────────────────────────────────────────────────────────────────────────
{
    const rows = [row('FixedPointTransform', 'fixedPoints', { word: 'ab', orientation: '1,-1', fp0x: -0.5, fp0y: 0.1, fp1x: 0.6, fp1y: -0.2 }),
                  row('ConformalBand', 'band', { fraction: 1 })];
    const nav = navigator({ centre: [0.3, 0], zoom: 0.9, moebius: MOEBIUS, rows });
    check(nav.hasProjectionMaps() && nav.viewHasSheets(), 'a band is on: a point shows in every strip');
    let worst = 0, oldMiss = 0, step = 0;
    for (const s of PIXELS) {
        const r = nav.screenToWorld(s);
        if (!r.exact) continue;
        const w = r.pnt;
        const c = nav.worldToScreen(w, s);
        worst = Math.max(worst, dist(c, s));
        // the place the Moebius transform alone gives (what worldToScreen was): it shows another point
        const old = nav.canvasTransform.world2screen(moebiusForward(nav, w));
        if (dist(nav.screenToWorld(old).pnt, w) > 1e-3) oldMiss++;
        // a pixel to the right of the point: the world point there is a pixel's scale away
        const w1 = nav.screenToWorld([c[0] + 1, c[1]]).pnt;
        const scale = nav.screenScale(c);
        step = Math.max(step, Math.abs(dist(w1, w)/scale - 1));
    }
    check(worst < 1e-6, `under the band and the fixed points a point's pixel shows it (${worst.toExponential(1)})`);
    check(oldMiss === PIXELS.length, `where the Moebius transform alone gave a pixel showing another point (${oldMiss} of ${PIXELS.length})`);
    check(step < 0.02, `a pixel's step from the point is the view's scale there (${step.toExponential(1)} off)`);
    // behind the Moebius transform the canvas shows several of the band's strips: a seed
    // elsewhere gives the point's place on its strip, another pixel that shows the point
    const w = nav.screenToWorld([333.3, 77.7]).pnt;
    const places = [[333.3, 77.7], [50, 460], [700, 100], undefined].map(seed => nav.worldToScreen(w, seed));
    check(places.every(c => dist(nav.screenToWorld(c).pnt, w) < 1e-9), `every seed's pixel shows the point: ${places.map(fmt).join(' ')}`);
    check(places.some(c => dist(c, [333.3, 77.7]) > 10), 'and the seeds on other strips give other pixels');
    const shown = nav.whereShown(w, [333.3, 77.7]);
    check(shown && dist(shown, [333.3, 77.7]) < 1e-6, 'whereShown with the seed on the pixel: the pixel');

    // the band alone: the canvas (0.69 high about the axis) is inside one strip, any seed on it gives the pixel
    const one = navigator({ centre: [0.3, 0], zoom: 0.9, rows: [row('ConformalBand', 'band', { fraction: 1 })] });
    const w1 = one.screenToWorld([333.3, 77.7]).pnt;
    check(dist(one.worldToScreen(w1, [50, 460]), [333.3, 77.7]) < 1e-6 && dist(one.worldToScreen(w1), [333.3, 77.7]) < 1e-6 && dist(one.whereShown(w1, [780, 20]), [333.3, 77.7]) < 1e-6,
          'the band alone, one strip on the canvas: any seed gives the pixel');
}

/** the plane point of a world point by the navigation's Moebius transform alone (worldToScreen before the list) */
function moebiusForward(nav, w){
    // with the list switched off worldToScreen is that map
    const whole = nav.getParams().projection.getValue();
    const off = plain(whole);
    off.params.enabled = false;
    nav.getParams().projection.setValue(off);
    const c = nav.worldToScreen(w);
    nav.getParams().projection.setValue(whole);
    return nav.canvasTransform.screen2world(c);
}

// 3 ───────────────────────────────────────────────────────────────────────────
{
    // a square lattice of period 0.5: the canvas (2.22 by 1.39 plane units at zoom 0.9) shows about 4 by 3 cells
    const rows = [row('ConformalPeriodic', 'periodic', { a1x: 0.5, a1y: 0, a2x: 0, a2y: 0.5, cx: 0, cy: 0 })];
    const nav = navigator({ zoom: 0.9, rows });
    check(nav.viewHasSheets(), 'a periodic wrap is on: the seed matters');
    const px = nav.canvasTransform.world2screen([0.5, 0])[0] - nav.canvasTransform.world2screen([0, 0])[0];     // a period in pixels
    check(px > 100 && px < 400, `a period is ${px.toFixed(1)} pixels`);
    const s = [430, 270];
    const w = nav.screenToWorld(s).pnt;
    check(dist(nav.worldToScreen(w, s), s) < 1e-8, 'the seed on the pixel: the pixel');
    check(dist(nav.worldToScreen(w, [s[0] + 0.3*px, s[1] - 0.2*px]), s) < 1e-8, 'a seed less than half a period off: the same pixel');
    // a seed two periods to the left and one up: the copy there, which shows the same point
    const other = nav.worldToScreen(w, [s[0] - 2*px + 5, s[1] - px - 7]);
    check(dist(other, [s[0] - 2*px, s[1] - px]) < 1e-6 && dist(nav.screenToWorld(other).pnt, w) < 1e-9, `the copy in the seed's cell: ${fmt(other)}`);
    // without a seed: the copy at the canvas centre
    const centre = nav.worldToScreen(w);
    check(dist(centre, [400, 250]) <= 0.71*px && dist(nav.screenToWorld(centre).pnt, w) < 1e-9, `without a seed the copy at the canvas centre: ${fmt(centre)}`);
    // whereShown: the seed's copy while it is on the canvas, else the canvas centre's
    const onCanvas = nav.whereShown(w, [s[0] - px, s[1]]);
    check(dist(onCanvas, [s[0] - px, s[1]]) < 1e-6, 'whereShown: the seed\'s copy');
    const offCanvas = nav.whereShown(w, [s[0] + 4*px, s[1]]);
    check(offCanvas && dist(offCanvas, centre) < 1e-6, `a seed whose copy is off the canvas: the canvas centre's (${fmt(offCanvas)})`);
    // a point outside the wrap's cell is shown nowhere
    check(nav.whereShown([0.4, 0.1], s) === null, 'a point outside the cell is shown nowhere');
    const place = nav.worldToScreenPlace([0.4, 0.1], s);
    check(place && !place.shown && Number.isFinite(place.pnt[0]), 'its place says so');
    check(Number.isFinite(nav.worldToScreen([0.4, 0.1], s)[0]), 'and worldToScreen gives a pixel all the same');
    // the whole switched off: one place again
    const off = plain(nav.getParams().projection.getValue());
    off.params.enabled = false;
    nav.getParams().projection.setValue(off);
    check(!nav.hasProjectionMaps() && !nav.viewHasSheets(), 'the list switched off: no sheets');
}

// 4 ───────────────────────────────────────────────────────────────────────────
{
    const rows = [row('ConformalScale', 'scale', { a1x: 1, a1y: 0, a2x: 0, a2y: 1, n1: 4, n2: 0, shift1: 0, shift2: 0 }), row('ConformalExp', 'exponent')];
    const nav = navigator({ zoom: 0.7, rows });
    check(nav.hasProjectionMaps() && !nav.viewHasSheets(), 'the exponent and a scale: one place for a point');
    const s = [520, 310];
    const w = nav.screenToWorld(s).pnt;
    check(dist(nav.worldToScreen(w), s) < 1e-7 && dist(nav.whereShown(w), s) < 1e-7, 'a pixel\'s point at the pixel');
    // the same place a turn on (the scale makes a turn about the centre 4 along x in the world): not shown
    const on = [w[0] + 4, w[1]];
    const place = nav.worldToScreenPlace(on);
    check(place && dist(place.pnt, s) < 1e-6 && !place.shown && nav.whereShown(on) === null, 'a point a turn on has the same pixel, which shows the first one');
}

process.stdout.write((failed ? `world_to_screen: ${failed} of ${checks} FAILED` : `world_to_screen: all ${checks} passed`) + '\n');
process.exit(failed ? 1 : 0);
