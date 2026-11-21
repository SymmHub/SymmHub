/*
  tests of a conformal transformation's own UI (docs/conformal_transforms_plan.md 5.3
  and section 15, outside the repository): its panel's params, the rational map's
  points, the view's chain cut at a row, and the row's handles and marks on the canvas
  (lib/symhublib/conformal/ConformalMaps.js, FixedPointsTransform.js,
  ProjectionTransform.getChainAt, InversiveNavigator.viewChainAt, TransformHandles.js)

    node tests/symhublib/transform_handles.mjs

  1. the panels (getPanelParams): every kind's params in rows, each control once; what a
     document saves is not changed by them; the fixed points row leaves out the settings
     that move nothing
  2. the rational map's points: four in an old document; added (a zero, a pole) up to
     eight and taken out, those after one moving up; the panel shows the rows of the
     points that are there; the step has them; an add is one undo step
  3. the chain cut at a row: the steps of the rows nearer the screen, with its own for the
     plane on its pattern's side; a row that is off, the whole list off
  4. the handles of a rational map through the cut chain: a point is found at its pixel and
     dragged to the plane point of the pixel it is dropped at, Escape puts it back, the
     exponent steps by the wheel on its label; the pass the GPU draws
  5. the periodic wrap: its cell's outline, the centre and the two vectors dragged (a
     vector's drag keeps the centre where it is)
  6. the fixed points: marks in the plane on the pattern's side, shown where the
     orientation takes them
*/

globalThis.window = globalThis.window || { addEventListener(){}, localStorage: { getItem: () => null, setItem(){} } };

const { InversiveNavigator } = await import('../../lib/symhublib/InversiveNavigator.js');
const { ProjectionTransform } = await import('../../lib/symhublib/ProjectionTransform.js');
const { createTransformHandles } = await import('../../lib/symhublib/TransformHandles.js');
const { createTransformsUndo } = await import('../../lib/symhublib/TransformsUndo.js');
const { viewChainToWorld } = await import('../../lib/symhublib/ViewChain.js');
const { CONFORMAL_KINDS: K } = await import('../../lib/symhublib/conformal/ConformalKinds.js');
const { getParamValues } = await import('../../lib/uilib/uilib.js');
const { UndoStack } = await import('../../lib/uilib/UndoStack.js');
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
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const fmt = (p) => p ? '(' + p.map(x => x.toFixed(4)).join(', ') + ')' : 'null';
const settle = () => new Promise(r => setTimeout(r, 0));
const listOf = (rows) => ({ className: 'ObjArray', params: { id: 'maps', children: rows } });
const row = (className, id, values = {}) => ({ className, params: { id, enabled: true, ...values } });
const kinds = (steps) => steps.map(s => s.kind).join(' ');

/** a list with the rows */
function listWith(rows, more = {}){
    const pt = ProjectionTransform(more);
    pt.setParamsMap({ enabled: true, maps: listOf(rows) }, true);
    return pt;
}

// 1 ───────────────────────────────────────────────────────────────────────────
{
    const pt = listWith([row('ConformalBand', 'band'), row('ConformalPeriodic', 'periodic'), row('ConformalScale', 'scale'),
                         row('ConformalLox', 'lox'), row('ConformalExp', 'exp'), row('ConformalUhp', 'uhp'), row('ConformalRational', 'rational'),
                         row('FixedPointTransform', 'fixedPoints')]);
    const byId = (id) => pt.getMaps().find(r => r.getId() === id);
    const saved = plain(getParamValues(pt.getParams()));

    // the kinds without values, and the band with its one, have the plain panel
    check(['band', 'lox', 'exp', 'uhp'].every(id => !byId(id).getPanelParams), 'the band and the kinds without values: no panel of their own');

    // a panel has the row's params with a control, each once, id and enabled first (the list's title row takes those)
    for (const [id, expect, without] of [
        ['periodic', ['a1x', 'a1y', 'a2x', 'a2y', 'cx', 'cy'], []],
        ['scale', ['a1x', 'a1y', 'a2x', 'a2y', 'n1', 'n2', 'shift1', 'shift2'], []],
        ['fixedPoints', ['word', 'orientation', 'fp0x', 'fp0y', 'fp1x', 'fp1y', 'translation', 'rotation'],
                        ['showUI', 'animate', 'fraction', 'loopTime', 'basex', 'basey', 'ota', 'analyze']],
    ]) {
        const r = byId(id);
        const panel = r.getPanelParams();
        const keys = Object.keys(panel);
        const params = r.getParams();
        const withValue = keys.filter(k => k in params);
        check(keys[0] === 'id' && keys[1] === 'enabled', `${id}: id and enabled first`);
        check(expect.every(k => withValue.includes(k)) && withValue.length === expect.length + 2, `${id}: its params in the panel, each once: ${withValue}`);
        check(without.every(k => !(k in panel)), `${id}: left out of the panel: ${without}`);
        check(keys.filter(k => !(k in params)).every(k => panel[k].serializable === false), `${id}: the rows and folders save nothing`);
        check(r.getPanelParams() === panel, `${id}: one panel, made once`);
    }
    // the rational map: a row a point, eight of them, the count without a control
    const rat = byId('rational');
    const panel = rat.getPanelParams();
    const params = rat.getParams();
    check(Object.keys(panel).filter(k => k in params).length === 2 + 24 && !('count' in panel) && 'count' in params, 'rational: 24 controls of 8 points, the count has none');
    check([1, 2, 3, 4, 5, 6, 7, 8].map(i => panel['point' + i].isVisible()).join() === 'true,true,true,true,false,false,false,false', 'rational: the rows of its four points show');
    // nothing of this changes what is saved
    check(JSON.stringify(plain(getParamValues(pt.getParams()))) === JSON.stringify(saved), 'the panels change nothing of what a document saves');
    const fp = saved.maps.params.children.find(c => c.className === 'FixedPointTransform').params;
    check('animate' in fp && 'fraction' in fp && 'loopTime' in fp && 'showUI' in fp && 'basex' in fp, 'the fixed points row keeps the values its panel leaves out');
}

// 2 ───────────────────────────────────────────────────────────────────────────
{
    // an old document's four points: the count is 4, the step has them
    const old = { enabled: true, x1: 0.5, y1: 0, n1: 2, x2: 0, y2: 1, n2: -1, x3: -1, y3: 0, n3: 1, x4: 0, y4: -1, n4: -1 };
    const pt = listWith([{ className: 'ConformalRational', params: { id: 'rational', ...old } }]);
    const rat = pt.getMaps()[0];
    const step = () => pt.getChain(0)[0];
    const pointsOf = (st) => { const d = st.data, out = []; for (let i = 0; i < d[0]; i++) out.push([d[4*(i + 1)], d[4*(i + 1) + 1], d[4*(i + 1) + 2]]); return out; };
    check(rat.getPointCount() === 4 && pointsOf(step()).length === 4 && pointsOf(step())[0].join() === '0.5,0,2', `an old document: four points (${pointsOf(step()).map(p => p.join(' ')).join('; ')})`);

    // the list hears one change for an add; the undo step is one
    const stack = UndoStack();
    let user = true, gesture = 1;
    createTransformsUndo({ list: pt, push: stack.push, input: { inEvent: () => user, held: () => false, gesture: () => gesture } });
    let heard = 0;
    pt.addListener(() => { heard++; });
    check(rat.addPoint(1) === true && heard === 1, `a zero added: one change of the list (${heard})`);
    await settle();
    const five = pointsOf(step());
    check(rat.getPointCount() === 5 && five.length === 5 && five[4][2] === 1 && near(Math.hypot(five[4][0], five[4][1]), 0.5), `five points, the new one a zero half a unit out: ${five[4].map(x => x.toFixed(3))}`);
    check(stack.canUndo() && /^transformations: rational/.test(stack.undoLabel()), `one undo step (${stack.undoLabel()})`);
    stack.undo();
    check(rat.getPointCount() === 4 && pointsOf(step()).length === 4, 'undone: four points');
    stack.redo();
    check(rat.getPointCount() === 5 && pointsOf(step())[4][2] === 1, 'done again: five');

    // a pole, then up to eight; no ninth
    gesture++;
    rat.addPoint(-1);
    check(rat.getPointCount() === 6 && pointsOf(step())[5][2] === -1, 'a pole added');
    rat.addPoint(1); rat.addPoint(1);
    check(rat.getPointCount() === 8 && pointsOf(step()).length === 8, 'eight points');
    const places = pointsOf(step()).slice(4).map(p => p[0].toFixed(3) + ',' + p[1].toFixed(3));
    check(new Set(places).size === 4, `the added points are apart: ${places.join(' ')}`);
    check(rat.addPoint(1) === false && rat.getPointCount() === 8, 'no ninth point');
    // the panel shows the rows of the points that are there
    const panel = rat.getPanelParams();
    check([1, 2, 3, 4, 5, 6, 7, 8].every(i => panel['point' + i].isVisible()), 'the panel shows eight rows');

    // the second point taken out: those after it move up
    const before = pointsOf(step());
    check(rat.removePoint(2) === true && rat.getPointCount() === 7, 'a point taken out');
    const after = pointsOf(step());
    check(after.length === 7 && after[0].join() === before[0].join() && after.slice(1).every((p, i) => p.join() === before[i + 2].join()), 'the points after it moved up');
    check(panel.point7.isVisible() && !panel.point8.isVisible(), 'the panel shows seven rows');
    // down to one, which stays
    while (rat.getPointCount() > 1) rat.removePoint(1);
    check(rat.getPointCount() === 1 && rat.removePoint(1) === false && pointsOf(step()).length === 1, 'the last point stays');
    check(rat.removePoint(5) === false, 'no point 5 to take out');

    // a document with six points, and one with a count out of range
    pt.setParamsMap({ enabled: true, maps: listOf([{ className: 'ConformalRational', params: { id: 'rational', ...old, x5: 0.3, y5: 0.2, n5: -2, x6: -0.3, y6: 0.4, n6: 3, count: 6 } }]) }, true);
    const six = pointsOf(pt.getChain(0)[0]);
    check(six.length === 6 && six[4].join() === '0.3,0.2,-2' && six[5].join() === '-0.3,0.4,3', 'a document with six points');
    check(pt.getMaps()[0].getPanelParams().point6.isVisible() && !pt.getMaps()[0].getPanelParams().point7.isVisible(), 'its panel shows six rows');
    pt.setParamsMap({ enabled: true, maps: listOf([{ className: 'ConformalRational', params: { id: 'rational', ...old, count: 40 } }]) }, true);
    check(pointsOf(pt.getChain(0)[0]).length === 8, 'a count out of range is cut to eight');
    // the map of six points: the product over them
    pt.setParamsMap({ enabled: true, maps: listOf([{ className: 'ConformalRational', params: { id: 'rational', x1: 0, y1: 0, n1: 1, x2: 1, y2: 0, n2: 1, x3: 0, y3: 1, n3: -1, x4: 2, y4: 0, n4: 0, x5: -1, y5: 0, n5: 2, count: 5 } }]) }, true);
    const z = [0.3, 0.2];
    const w = viewChainToWorld({ steps: pt.getChain(0) }, z).pnt;
    const mul = (a, b) => [a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0]];
    const div = (a, b) => { const d = b[0]*b[0] + b[1]*b[1]; return [(a[0]*b[0] + a[1]*b[1])/d, (a[1]*b[0] - a[0]*b[1])/d]; };
    const s5 = [z[0] + 1, z[1]];
    const expect = div(mul(mul(z, [z[0] - 1, z[1]]), mul(s5, s5)), [z[0], z[1] - 1]);
    check(dist(w, expect) < 1e-12, `five points: z (z - 1) (z + 1)^2 / (z - i), the fourth taking no part: ${fmt(w)}`);
}

// 3 ───────────────────────────────────────────────────────────────────────────
{
    const pt = listWith([row('FixedPointTransform', 'fixedPoints', { word: 'ab', orientation: '1,-1', fp0x: -0.5, fp0y: 0.1, fp1x: 0.6, fp1y: -0.2 }),
                         row('ConformalBand', 'band'), row('ConformalRational', 'rational'), row('ConformalExp', 'exp')]);
    const [fp, band, rat, exp] = pt.getMaps();
    check(kinds(pt.getChain(0)) === 'exp rational band moebius', `the whole chain: ${kinds(pt.getChain(0))}`);
    check(kinds(pt.getChainAt(rat)) === 'exp' && kinds(pt.getChainAt(rat, true)) === 'exp rational', 'cut at the rational map: the exponent; with its own steps for the pattern\'s side');
    check(kinds(pt.getChainAt(exp)) === '' && kinds(pt.getChainAt(exp, true)) === 'exp', 'cut at the last row: nothing before it');
    check(kinds(pt.getChainAt(fp)) === 'exp rational band' && kinds(pt.getChainAt(fp, true)) === 'exp rational band moebius', 'cut at the first row: all the others');
    check(kinds(pt.getChainAt(band)) === 'exp rational', 'cut at the band');
    // a row that is off has no steps: both its planes are the one
    rat.getParams().enabled.setValue(false);
    check(kinds(pt.getChainAt(rat)) === 'exp' && kinds(pt.getChainAt(rat, true)) === 'exp', 'a row that is off: the plane where it would act');
    check(kinds(pt.getChainAt(band)) === 'exp', 'and the rows before it skip it');
    rat.getParams().enabled.setValue(true);
    // the whole switched off: no steps
    pt.getParams().enabled.setValue(false);
    check(pt.getChainAt(rat).length === 0 && pt.getChainAt(fp, true).length === 0, 'the whole off: no steps');
    pt.getParams().enabled.setValue(true);
    // a row that is not in the list: the whole chain
    check(kinds(pt.getChainAt({})) === kinds(pt.getChain(0)), 'a row of another list: the whole chain');
}

// ── a navigator with a canvas of 800 x 500 ────────────────────────────────────

const canvas = { width: 800, height: 500, clientWidth: 800, clientHeight: 500 };
function navigator({ centre = [0, 0], zoom = 1, moebius = [], rows = [] } = {}){
    const nav = new InversiveNavigator({});
    nav.init({ canvas, onChanged(){} });
    nav.setParamsMap({
        mode: 'hyperbolic',
        euclidean: { centerX: centre[0], centerY: centre[1], zoom, angle: 0 },
        inversive: { enabled: true, itrans: plain(moebius), poleSet: false, poleX: 0, poleY: 0, anchored: null },
        spherical: { enabled: false },
        projection: { className: 'ProjectionTransform', params: { enabled: true, maps: listOf(rows) } },
    }, true);
    return nav;
}
const ev = (type, c, extra = {}) => ({ type, canvasX: c[0], canvasY: c[1], button: 0,
                                     buttons: (type === 'pointerdown' || type === 'pointermove') ? 1 : 0,
                                     preventDefault() { this.prevented = true; }, ...extra });
const hover = (c) => ev('pointermove', c, { buttons: 0 });
const MOEBIUS = [iSphere([0.4, 0.1, 0, 1.3]), iPlane([0.6, 0.8, 0, 0.05])];

/** the handles of a row of the navigator's list, its tool active */
function handlesOf(nav, id){
    const target = nav.getProjection().getMaps().find(r => r.getId() === id);
    let pointer = null;
    const cnv = { style: { cursor: '' }, title: '' };
    const th = createTransformHandles({ navigator: nav, getRow: () => target, pointer: () => pointer, canvas: cnv });
    th.setActive(true);
    return { th, target, cnv, at: (c) => { pointer = c; } };
}

// 4 ───────────────────────────────────────────────────────────────────────────
{
    // the rational map with a band after it (nearer the screen) and the navigation's transform:
    // its points live in the plane the band and the navigation show
    const nav = navigator({ zoom: 0.9, moebius: MOEBIUS, rows: [row('ConformalRational', 'rational', { x1: 0.2, y1: 0.1, n1: 1 }), row('ConformalBand', 'band')] });
    const { th, target, cnv } = handlesOf(nav, 'rational');
    const cut = nav.viewChainAt(target);
    check(kinds(cut.steps) === 'band' && cut.moebius.length === 2 && kinds(nav.viewChainAt(target, true).steps) === 'band rational', 'the cut chain: the navigation and the band');
    const cfg = target.getConfig();

    // the pass the GPU draws: the cut chain, and the points (a zero filled, a pole hollow)
    const pass = th.getOverlayPass();
    check(pass && kinds(pass.chain.steps) === 'band', 'the pass has the cut chain');
    const discs = pass.geometry.points.filter(p => p.size === 6.5);
    check(discs.length === 4 && dist(discs[0].p, [0.2, 0.1]) < 1e-12, `the four points in the plane's coordinates: ${discs.map(d => fmt(d.p)).join(' ')}`);
    const white = (c) => c[0] === 1 && c[1] === 1 && c[2] === 1;
    check(!white(discs[0].fill) && white(discs[1].fill) && !white(discs[2].fill) && white(discs[3].fill), 'the zeros are filled, the poles hollow');

    // the pixel of the first point: where the cut chain shows it
    const place = nav.worldToScreenPlace([0.2, 0.1], null, cut);
    check(place && place.shown && dist(nav.screenToWorld(place.pnt, cut).pnt, [0.2, 0.1]) < 1e-9, `the first point's pixel through the cut chain: ${fmt(place && place.pnt)}`);
    check(dist(nav.screenToWorld(place.pnt).pnt, [0.2, 0.1]) > 1e-3, 'which the whole chain shows as another point (the map\'s own zero)');
    const c0 = place.pnt;

    // found there, dragged 40 pixels right and 25 down: it is at the plane point of that pixel
    th.handleEvent(hover(c0));
    check(th.getHover() && th.getHover().id === 'p1' && cnv.style.cursor === 'grab', `the point is found at its pixel (${th.getHover() && th.getHover().id})`);
    const press = ev('pointerdown', c0);
    th.handleEvent(press);
    check(press.isConsumed && th.isDragging(), 'the press is taken');
    const c1 = [c0[0] + 40, c0[1] + 25];
    const move = ev('pointermove', c1);
    th.handleEvent(move);
    const target1 = nav.screenToWorld(c1, cut).pnt;
    check(move.isConsumed && dist([cfg.x1, cfg.y1], target1) < 1e-9, `dragged: the point is at the plane point of the pixel, ${fmt([cfg.x1, cfg.y1])}`);
    check(dist(nav.screenToWorld(c1, nav.viewChainAt(target)).pnt, target1) < 1e-12, 'the cut chain does not change with the row\'s own values');
    // the picture follows: the map's zero is at the new place
    check(dist(nav.screenToWorld(c1).pnt, [0, 0]) < 1e-9, 'the picture follows: the pixel now shows the map\'s 0');
    // Escape: back
    th.handleKey({ type: 'keydown', key: 'Escape' });
    check(near(cfg.x1, 0.2) && near(cfg.y1, 0.1) && !th.isDragging(), 'Escape puts the point back');
    // again, and released: it stays
    th.handleEvent(ev('pointerdown', c0));
    th.handleEvent(ev('pointermove', c1));
    const up = ev('pointerup', c1);
    th.handleEvent(up);
    check(up.isConsumed && !th.isDragging() && dist([cfg.x1, cfg.y1], target1) < 1e-9, 'released: it stays');
    // a press away from every point is not taken
    const away = ev('pointerdown', [5, 5]);
    th.handleEvent(away);
    check(!away.isConsumed, 'a press away from the points is left to the tool under it');

    // the exponent: its label 20 pixels above the point, stepped by the wheel
    const lab = [c1[0], c1[1] - 20];
    th.handleEvent(hover(lab));
    check(th.getHover() && th.getHover().id === 'n1' && th.getHover().part === 'box', `the exponent's label above the point (${JSON.stringify(th.getHover())})`);
    const wheel = ev('wheel', lab, { deltaY: -40, deltaMode: 0 });
    th.handleEvent(wheel);
    check(wheel.isConsumed && cfg.n1 === 2, `the wheel steps the exponent (${cfg.n1})`);
    for (let i = 0; i < 4; i++) th.handleEvent(ev('wheel', lab, { deltaY: -40, deltaMode: 0 }));
    check(cfg.n1 === 3, 'up to 3');
    for (let i = 0; i < 8; i++) th.handleEvent(ev('wheel', lab, { deltaY: 40, deltaMode: 0 }));
    check(cfg.n1 === -3, 'down to -3');
    // the text of the labels: the exponents with their signs
    const texts = [];
    const ctx = new Proxy({}, {
        get: (o, k) => (k in o) ? o[k] : (k === 'fillText' ? (t) => { texts.push(t); } : () => {}),
        set: (o, k, v) => { o[k] = v; return true; },
    });
    th.renderText(ctx);
    check(texts.includes('−3') && texts.includes('−1') && texts.includes('+1'), `the labels: ${texts.join(' ')}`);

    // not active, or no row: nothing drawn, nothing taken
    th.setActive(false);
    const off = ev('pointerdown', c1);
    th.handleEvent(off);
    check(th.getOverlayPass() === null && !off.isConsumed, 'not active: nothing drawn or taken');
    const none = createTransformHandles({ navigator: nav, getRow: () => null });
    none.setActive(true);
    check(none.getOverlayPass() === null && !none.isShown(), 'no row: nothing');
    const plainRow = createTransformHandles({ navigator: nav, getRow: () => nav.getProjection().getMaps()[1] });
    plainRow.setActive(true);
    check(plainRow.getOverlayPass() === null && !plainRow.isShown(), 'a row without handles (the band): nothing');
}

// 5 ───────────────────────────────────────────────────────────────────────────
{
    const nav = navigator({ zoom: 0.8, rows: [row('ConformalPeriodic', 'periodic', { a1x: 0.6, a1y: 0.1, a2x: -0.1, a2y: 0.5, cx: 0.25, cy: -0.5 })] });
    const { th, target } = handlesOf(nav, 'periodic');
    const cfg = target.getConfig();
    const centre = () => [cfg.cx*cfg.a1x + cfg.cy*cfg.a2x, cfg.cx*cfg.a1y + cfg.cy*cfg.a2y];
    const cut = nav.viewChainAt(target);
    check(cut.steps.length === 0, 'the wrap is the only row: its plane is the navigation\'s');
    const pixel = (w) => nav.worldToScreenPlace(w, null, cut).pnt;
    const C0 = centre();

    // the cell's outline: about the centre, its sides the vectors
    const pass = th.getOverlayPass();
    const outline = pass.geometry.polylines[0];
    check(outline && outline.closed && outline.points.length === 4, 'the cell\'s outline');
    const mid = outline.points.reduce((s, p) => [s[0] + p[0]/4, s[1] + p[1]/4], [0, 0]);
    check(dist(mid, C0) < 1e-12 && dist([outline.points[1][0] - outline.points[0][0], outline.points[1][1] - outline.points[0][1]], [0.6, 0.1]) < 1e-12, 'about the centre, a side the first vector');
    // the cell is the one the wrap takes the plane into: its corners all show the same point
    const corners = outline.points.map(p => viewChainToWorld({ steps: target.getSteps() }, [p[0]*(1 - 1e-9) + C0[0]*1e-9, p[1]*(1 - 1e-9) + C0[1]*1e-9]).pnt);
    check(corners.every(w => Math.abs(Math.abs(w[0]*0.5 - w[1]*(-0.1)) - 0.5*(0.6*0.5 + 0.1*0.1)) < 1e-6), 'its corners are the corners of the wrap\'s cell');

    // the centre dragged: cx, cy are the pointer's point in the vectors
    const cc = pixel(C0);
    th.handleEvent(hover(cc));
    check(th.getHover() && th.getHover().id === 'centre', 'the centre is found');
    th.handleEvent(ev('pointerdown', cc));
    const c1 = [cc[0] + 60, cc[1] - 30];
    th.handleEvent(ev('pointermove', c1));
    th.handleEvent(ev('pointerup', c1));
    const want = nav.screenToWorld(c1, cut).pnt;
    check(dist(centre(), want) < 1e-9 && near(cfg.a1x, 0.6) && near(cfg.a2y, 0.5), `the centre dragged to the pointer's point: ${fmt(centre())}`);

    // the first vector dragged by the middle of the cell's side: the centre stays
    const C1 = centre();
    const tip = [C1[0] + cfg.a1x/2, C1[1] + cfg.a1y/2];
    const tc = pixel(tip);
    th.handleEvent(hover(tc));
    check(th.getHover() && th.getHover().id === 'a1', 'the first vector\'s handle is found at the middle of the side');
    th.handleEvent(ev('pointerdown', tc));
    const t1 = [tc[0] + 35, tc[1] + 20];
    th.handleEvent(ev('pointermove', t1));
    th.handleEvent(ev('pointerup', t1));
    const p = nav.screenToWorld(t1, cut).pnt;
    check(dist([cfg.a1x, cfg.a1y], [2*(p[0] - C1[0]), 2*(p[1] - C1[1])]) < 1e-9, `the vector is twice the pointer's point from the centre: ${fmt([cfg.a1x, cfg.a1y])}`);
    check(dist(centre(), C1) < 1e-9, 'and the centre stays where it is');
    check(near(cfg.a2x, -0.1) && near(cfg.a2y, 0.5), 'the other vector too');
    // the second vector
    const C2 = centre();
    const tip2 = pixel([C2[0] + cfg.a2x/2, C2[1] + cfg.a2y/2]);
    th.handleEvent(hover(tip2));
    check(th.getHover() && th.getHover().id === 'a2', 'the second vector\'s handle');
    // a drag that would lay the vectors along one line is refused
    th.handleEvent(ev('pointerdown', tip2));
    const flat = pixel([C2[0] + cfg.a1x*0.4, C2[1] + cfg.a1y*0.4]);
    const a2 = [cfg.a2x, cfg.a2y];
    th.handleEvent(ev('pointermove', flat));
    check(Math.abs(cfg.a1x*cfg.a2y - cfg.a1y*cfg.a2x) > 1e-9, `the vectors stay a lattice (${fmt(a2)} to ${fmt([cfg.a2x, cfg.a2y])})`);
    th.handleKey({ type: 'keydown', key: 'Escape' });
    check(dist([cfg.a2x, cfg.a2y], a2) < 1e-12, 'Escape puts it back');
}

// 6 ───────────────────────────────────────────────────────────────────────────
{
    // the fixed points row before a band: its marks in the plane on the pattern's side
    const nav = navigator({ zoom: 0.5, rows: [row('FixedPointTransform', 'fixedPoints', { word: 'ab', orientation: '1,-1', fp0x: -0.5, fp0y: 0.1, fp1x: 0.6, fp1y: -0.2 }),
                                             row('ConformalBand', 'band')] });
    const { th, target } = handlesOf(nav, 'fixedPoints');
    check(target.handlesPlane === 'world' && !target.getHandles, 'the fixed points: marks in the plane on the pattern\'s side, no handles');
    const pass = th.getOverlayPass();
    check(pass && kinds(pass.chain.steps) === 'band moebius', `the pass has the chain with the row's own steps: ${pass && kinds(pass.chain.steps)}`);
    const marks = pass.geometry.points.filter(p => p.size === 7);
    check(marks.length === 2 && dist(marks[0].p, [-0.5, 0.1]) < 1e-12 && dist(marks[1].p, [0.6, -0.2]) < 1e-12, 'the two fixed points');
    // through that chain they show where the orientation takes them: (-1, 0) and (1, 0) of the band's plane
    const bandOnly = nav.viewChainAt(target);
    const p0 = nav.worldToScreenPlace([-0.5, 0.1], null, pass.chain), p1 = nav.worldToScreenPlace([0.6, -0.2], null, pass.chain);
    const b0 = nav.screenToWorld(p0.pnt, bandOnly).pnt, b1 = nav.screenToWorld(p1.pnt, bandOnly).pnt;
    check(Math.min(dist(b0, [-1, 0]) + dist(b1, [1, 0]), dist(b0, [1, 0]) + dist(b1, [-1, 0])) < 1e-6, `they show at -1 and 1 of the band's plane: ${fmt(b0)} ${fmt(b1)}`);
    // the row off: the marks stay, in the plane where it would act
    target.getParams().enabled.setValue(false);
    const offPass = th.getOverlayPass();
    check(offPass && kinds(offPass.chain.steps) === 'band' && offPass.geometry.points.length === pass.geometry.points.length, 'the row off: its marks where it would act');
    // a press is never taken: there is nothing to drag
    const press = ev('pointerdown', p0.pnt);
    th.handleEvent(press);
    check(!press.isConsumed, 'the marks take no press');
}

process.stdout.write((failed ? `transform_handles: ${failed} of ${checks} FAILED` : `transform_handles: all ${checks} passed`) + '\n');
process.exit(failed ? 1 : 0);
