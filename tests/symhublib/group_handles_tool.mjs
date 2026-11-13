/*
  tests of the group handles on the canvas, the Symmetry tool's group handles
  (lib/symhublib/GroupHandlesTool.js with the kinds of lib/grouplib/GroupHandles.js;
  docs/symmetry_tool_plan.md section 5, outside the repository)

    node tests/symhublib/group_handles_tool.mjs

  A view of 100 pixels to the unit and a group transform g (a turn, a scale, a move)
  between the maker's coordinates and the world:
  1. a tool not active takes nothing; the hover finds a point within its reach, sets
     the cursor and the tooltip
  2. a point's drag: the values follow the pointer through g (the grabbed point stays
     under the pointer), Shift counts a tenth of the move, Escape puts the values of the
     press back, the release ends it and keeps them, the click of the press is taken, a
     move with the button up ends it
  3. an order's label (moved from its corner toward the domain): the wheel steps it
     (the deltas add up to a step, lines count 16), its − and + marks while hovered,
     the keys - and + (=), a drag up and down a step per 20 pixels (Escape: back);
     ∞ past the top; a label whose corner moves with its order stays under the pointer
     while the pointer is on it and goes back by its corner when it leaves
  4. the geometry: the points and corners at g(at), the hovered point's guide carried by
     g, the label and the values as text; out of reach and without labels, nothing is
     drawn or taken; left, the cursor and the tooltip are put back
  5. the makers' own handles: the wallpaper group's a, the KLM orders
*/

import { GroupHandlesTool } from '../../lib/symhublib/GroupHandlesTool.js';
import { groupTransformMaps } from '../../lib/symhublib/GroupTransformFrame.js';
import { pointHandle, orderHandle } from '../../lib/grouplib/GroupHandles.js';
import { Group_WP, Group_KLM } from '../../lib/grouplib/grouplib.js';

// the makers log as they work (Group_KLM's DEBUG): the test speaks through say
const say = console.log.bind(console);
console.log = () => {};

let failed = 0, checks = 0;
function check(ok, what){
    checks++;
    if (!ok) { failed++; say('FAILED: ' + what); }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const nearP = (p, q, eps = 1e-9) => !!p && !!q && near(p[0], q[0], eps) && near(p[1], q[1], eps);
const TORAD = Math.PI/180;

// a view of 100 pixels to the unit, y up, origin at the pixel (400, 300)
const view = {
    toWorld: (c) => [(c[0] - 400)/100, (300 - c[1])/100],
    toCanvas: (w) => [400 + 100*w[0], 300 - 100*w[1]],
    scaleAt: () => 0.01,
};
// g: a turn by 30 degrees, twice the size, the origin to (0.5, 0.25)
const conf = { translationX: 0.5, translationY: 0.25, rotation: 30, scale: 2 };
const g = groupTransformMaps(conf);

const ev = (type, c, extra = {}) => ({ type, canvasX: c[0], canvasY: c[1], button: 0,
                                     buttons: (type === 'pointerdown' || type === 'pointermove') ? 1 : 0,
                                     preventDefault() { this.prevented = true; }, ...extra });
const hover = (c) => ev('pointermove', c, { buttons: 0 });
const key = (k, extra = {}) => ({ type: 'keydown', key: k, ...extra });

// a fake maker: a point (a, b) with a circle about the origin as its guide, the order K at the origin
function fakeMaker() {
    const maker = { params: { a: 0.5, b: 0.2, K: 3 }, changes: 0 };
    maker.onParamChanged = () => { maker.changes++; };
    maker.getHandles = () => [
        pointHandle(maker, {
            keys: ['a', 'b'],
            at: () => [maker.params.a, maker.params.b],
            toValues: (q) => ({ a: q[0], b: q[1] }),
            guide: () => ({ circle: [0, 0, Math.hypot(maker.params.a, maker.params.b)] }),
            title: 'the point (a, b)',
        }),
        orderHandle(maker, { key: 'K', at: () => [0, 0], toward: [0.5, 0.5], ideal: 'max', title: 'K: the order' }),
    ];
    return maker;
}

function makeTool(maker, extra = {}) {
    const canvas = { style: { cursor: 'crosshair' }, title: 'the canvas' };
    let repaints = 0;
    const tool = GroupHandlesTool({ getHandles: () => maker.getHandles(), toWorld: g.toWorld, fromWorld: g.fromWorld,
                                    view, canvas, repaint: () => { repaints++; }, ...extra });
    return { tool, canvas, repaints: () => repaints };
}

/** the canvas point of a point in the maker's coordinates */
const canvasOf = (m) => view.toCanvas(g.toWorld(m));

/** the order label's centre: 20 pixels from the corner toward the point toward (half the way if nearer) */
function labelCentre(at, toward) {
    const c = canvasOf(at), t = canvasOf(toward);
    const len = Math.hypot(t[0] - c[0], t[1] - c[1]);
    const d = Math.min(20, len/2);
    return [c[0] + (t[0] - c[0])/len*d, c[1] + (t[1] - c[1])/len*d];
}

// 1 ───────────────────────────────────────────────────────────────────────────

{
    const maker = fakeMaker();
    const { tool, canvas } = makeTool(maker);
    const pc = canvasOf([0.5, 0.2]);

    let e = ev('pointerdown', pc);
    tool.handleEvent(e);
    check(!e.isConsumed && !tool.isDragging(), 'a tool not active takes nothing');
    check(tool.getOverlayGeometry() === null, 'nothing drawn when not active');

    tool.setActive(true);
    tool.handleEvent(hover([pc[0] + 6, pc[1] + 6]));
    check(tool.getHover() && tool.getHover().id === 'a,b' && tool.getHover().part === 'point', 'the point is hovered within 10 pixels');
    check(canvas.style.cursor === 'grab' && canvas.title.startsWith('the point (a, b)'), `the cursor and the tooltip (${canvas.style.cursor}, ${canvas.title})`);
    tool.handleEvent(hover([pc[0] + 9, pc[1] + 9]));
    check(tool.getHover() === null, 'nothing beyond 10 pixels');
    check(canvas.style.cursor === 'crosshair' && canvas.title === 'the canvas', 'the cursor and the tooltip put back');
}

// 2 ───────────────────────────────────────────────────────────────────────────

{
    const maker = fakeMaker();
    const { tool, canvas } = makeTool(maker);
    tool.setActive(true);
    const pc = canvasOf([0.5, 0.2]);
    const grab = [pc[0] + 3, pc[1] - 2];

    let e = ev('pointerdown', grab);
    tool.handleEvent(e);
    check(e.isConsumed && e.prevented && tool.isDragging(), 'a press on the point is taken');
    check(canvas.style.cursor === 'grabbing', 'grabbing');
    check(maker.changes === 0, 'a press changes nothing');

    // 50 pixels right: 0.5 in the world, a quarter turned back by 30 degrees in the maker's coordinates
    tool.handleEvent(ev('pointermove', [grab[0] + 50, grab[1]]));
    const d = [0.25*Math.cos(30*TORAD), -0.25*Math.sin(30*TORAD)];
    check(near(maker.params.a, 0.5 + d[0], 1e-12) && near(maker.params.b, 0.2 + d[1], 1e-12),
          `the point follows the pointer through g (${maker.params.a}, ${maker.params.b})`);
    check(maker.changes === 1, 'one change');
    const c1 = canvasOf([maker.params.a, maker.params.b]);
    check(nearP([c1[0] + 3, c1[1] - 2], [grab[0] + 50, grab[1]], 1e-9), 'the grabbed point stays under the pointer');

    // Shift: a tenth
    tool.handleEvent(ev('pointermove', [grab[0] + 100, grab[1]], { shiftKey: true }));
    check(near(maker.params.a, 0.5 + 1.1*d[0], 1e-12) && near(maker.params.b, 0.2 + 1.1*d[1], 1e-12), 'Shift: a tenth of the move');
    // and on from there without Shift
    tool.handleEvent(ev('pointermove', [grab[0] + 150, grab[1]]));
    check(near(maker.params.a, 0.5 + 2.1*d[0], 1e-12), 'on from there');

    e = key('Escape');
    tool.handleKey(e);
    check(e.isConsumed && !tool.isDragging(), 'Escape ends the drag');
    check(maker.params.a === 0.5 && maker.params.b === 0.2, 'Escape puts the values of the press back');
    e = key('Escape');
    tool.handleKey(e);
    check(!e.isConsumed, 'Escape without a drag is not taken');

    // the release keeps the values; the click of the press is taken
    tool.handleEvent(ev('pointerdown', grab));
    tool.handleEvent(ev('pointermove', [grab[0], grab[1] - 50]));
    e = ev('pointerup', [grab[0], grab[1] - 50]);
    tool.handleEvent(e);
    check(e.isConsumed && !tool.isDragging(), 'the release ends the drag');
    check(near(maker.params.a, 0.5 + 0.25*Math.sin(30*TORAD), 1e-12) && near(maker.params.b, 0.2 + 0.25*Math.cos(30*TORAD), 1e-12),
          'the values stay after the release');
    e = ev('click', [grab[0], grab[1] - 50]);
    tool.handleEvent(e);
    check(e.isConsumed, 'the click of the press is the tool\'s');

    // a press away from the handles: not taken, nor its click
    e = ev('pointerdown', [100, 100]);
    tool.handleEvent(e);
    check(!e.isConsumed && !tool.isDragging(), 'a press away from the handles is not taken');
    e = ev('click', [100, 100]);
    tool.handleEvent(e);
    check(!e.isConsumed, 'nor its click');

    // a move with the button up (released off the canvas) ends the drag
    const p2 = canvasOf([maker.params.a, maker.params.b]);
    tool.handleEvent(ev('pointerdown', p2));
    check(tool.isDragging(), 'a new drag');
    tool.handleEvent(ev('pointermove', [p2[0] + 20, p2[1]], { buttons: 0 }));
    check(!tool.isDragging(), 'a move with the button up ends it');

    // the right button is not taken
    e = ev('pointerdown', p2, { button: 2 });
    tool.handleEvent(e);
    check(!e.isConsumed, 'the right button is not taken');
}

// 3 ───────────────────────────────────────────────────────────────────────────

{
    const maker = fakeMaker();
    const { tool, canvas } = makeTool(maker);
    tool.setActive(true);
    const lc = labelCentre([0, 0], [0.5, 0.5]);

    tool.handleEvent(hover(lc));
    check(tool.getHover() && tool.getHover().id === 'K' && tool.getHover().part === 'box', 'the label is hovered');
    check(canvas.style.cursor === 'ns-resize' && canvas.title.startsWith('K: the order'), 'its cursor and tooltip');

    // the wheel: up a step, the deltas add up, lines count 16
    let e = ev('wheel', lc, { deltaY: -40, deltaMode: 0 });
    tool.handleEvent(e);
    check(e.isConsumed && e.prevented && maker.params.K === 4, `the wheel up steps up (${maker.params.K})`);
    tool.handleEvent(ev('wheel', lc, { deltaY: 25, deltaMode: 0 }));
    check(maker.params.K === 4, 'part of a step: nothing yet');
    tool.handleEvent(ev('wheel', lc, { deltaY: 25, deltaMode: 0 }));
    check(maker.params.K === 3, 'the deltas add up to a step down');
    tool.handleEvent(ev('wheel', lc, { deltaY: 3, deltaMode: 1 }));
    check(maker.params.K === 2, 'three lines: a step');
    tool.handleEvent(ev('wheel', lc, { deltaY: 3, deltaMode: 1 }));
    check(maker.params.K === 2, '2 is the least');
    e = ev('wheel', [100, 100], { deltaY: -40 });
    tool.handleEvent(e);
    check(!e.isConsumed && maker.params.K === 2, 'the wheel away from the labels is not taken');

    // the marks beside the box while it is hovered: its width is 20 (one character), the marks 20.5 pixels out
    tool.handleEvent(hover(lc));
    const minus = [lc[0] - 20.5, lc[1]], plus = [lc[0] + 20.5, lc[1]];
    tool.handleEvent(hover(plus));
    check(tool.getHover() && tool.getHover().part === 'plus' && canvas.style.cursor === 'pointer', 'the + mark is hovered');
    e = ev('pointerdown', plus);
    tool.handleEvent(e);
    check(e.isConsumed && maker.params.K === 3 && !tool.isDragging(), 'a press on + steps up');
    e = ev('click', plus);
    tool.handleEvent(e);
    check(e.isConsumed, 'its click is the tool\'s');
    tool.handleEvent(ev('pointerup', plus));
    tool.handleEvent(hover(minus));
    tool.handleEvent(ev('pointerdown', minus));
    check(maker.params.K === 2, 'a press on − steps down');

    // the marks are not there while another thing is hovered
    tool.handleEvent(hover([100, 100]));
    tool.handleEvent(hover(plus));
    check(tool.getHover() === null, 'the marks only while the label is hovered');

    // the keys while the label is hovered
    tool.handleEvent(hover(lc));
    e = key('+');
    tool.handleKey(e);
    check(e.isConsumed && maker.params.K === 3, 'the key + steps up');
    tool.handleKey(key('='));
    check(maker.params.K === 4, 'the key = steps up');
    tool.handleKey(key('-'));
    check(maker.params.K === 3, 'the key - steps down');
    tool.handleKey(key('x', { code: 'NumpadSubtract' }));
    check(maker.params.K === 2, 'the numpad - steps down');
    e = key('+', { ctrlKey: true });
    tool.handleKey(e);
    check(!e.isConsumed && maker.params.K === 2, 'Ctrl + is not the tool\'s');
    tool.handleEvent(hover([100, 100]));
    e = key('+');
    tool.handleKey(e);
    check(!e.isConsumed && maker.params.K === 2, 'the keys only while a label is hovered');

    // a drag up and down on the label: a step per 20 pixels, Escape puts the number back
    e = ev('pointerdown', lc);
    tool.handleEvent(e);
    check(e.isConsumed && tool.isDragging(), 'a press on the label starts a drag');
    tool.handleEvent(ev('pointermove', [lc[0], lc[1] - 45]));
    check(maker.params.K === 4, `45 pixels up: two steps (${maker.params.K})`);
    tool.handleEvent(ev('pointermove', [lc[0] + 30, lc[1] + 21]));
    check(maker.params.K === 2, '21 pixels down: one step down from the press, 2 the least');
    tool.handleEvent(ev('pointermove', [lc[0], lc[1] - 70]));
    e = key('Escape');
    tool.handleKey(e);
    check(e.isConsumed && maker.params.K === 2 && !tool.isDragging(), 'Escape: the number of the press');

    // ∞ past 19
    maker.params.K = 19;
    tool.handleEvent(hover(lc));
    tool.handleKey(key('+'));
    check(maker.params.K === 20, 'past 19: ∞ (20)');
    tool.handleKey(key('+'));
    check(maker.params.K === 20, '∞ is the top');
    // ∞ is one character: the marks are where they were
    tool.handleEvent(hover(lc));
    tool.handleEvent(hover(minus));
    tool.handleEvent(ev('pointerdown', minus));
    check(maker.params.K === 19, '∞ − 1 is 19');
}

{
    // the corner moves with the order: the label stays under the pointer while it is on it
    const maker = { params: { K: 3 }, onParamChanged() {} };
    // a step moves the corner 30 pixels, the label's box is 24 pixels wide (with the margin)
    maker.getHandles = () => [orderHandle(maker, { key: 'K', at: () => [0.3*maker.params.K, 0], toward: [0.3*maker.params.K, 1], ideal: 'max' })];
    const { tool } = makeTool(maker);
    tool.setActive(true);
    const l3 = labelCentre([0.9, 0], [0.9, 1]);
    tool.handleEvent(hover(l3));
    tool.handleEvent(ev('wheel', l3, { deltaY: -40 }));
    tool.handleEvent(ev('wheel', l3, { deltaY: -40 }));
    let e = ev('wheel', l3, { deltaY: -40 });
    tool.handleEvent(e);
    check(e.isConsumed && maker.params.K === 6, `three turns of the wheel at one place: three steps (${maker.params.K})`);
    // the − mark where it was: two clicks, two steps
    const minus = [l3[0] - 20.5, l3[1]];
    tool.handleEvent(hover(minus));
    tool.handleEvent(ev('pointerdown', minus));
    tool.handleEvent(ev('pointerup', minus));
    tool.handleEvent(ev('pointerdown', minus));
    tool.handleEvent(ev('pointerup', minus));
    check(maker.params.K === 4, `two clicks on − at one place: two steps (${maker.params.K})`);
    // drawn there, its leader from the corner that moved
    const lines = [], texts = [];
    const ctx = new Proxy({}, {
        get: (o, k) => (k in o) ? o[k] : (k === 'fillText' ? (t, x, y) => { texts.push([t, x, y]); }
                                        : (k === 'lineTo' ? (x, y) => { lines.push([x, y]); } : () => {})),
        set: (o, k, v) => { o[k] = v; return true; },
    });
    tool.renderText(ctx);
    const four = texts.find(t => t[0] === '4');
    check(four && near(four[1], l3[0], 1e-9) && near(four[2], l3[1] + 0.5, 1e-9), 'the label is drawn where the pointer found it');
    // away and back: the label by its corner
    tool.handleEvent(hover([100, 100]));
    check(tool.getHover() === null, 'the pointer left the label');
    const l4 = labelCentre([1.2, 0], [1.2, 1]);
    tool.handleEvent(hover(l4));
    check(tool.getHover() && tool.getHover().id === 'K', 'the label is back by its corner');
    tool.handleEvent(hover(l3));
    check(tool.getHover() === null, 'and no longer where it was');
}

// 4 ───────────────────────────────────────────────────────────────────────────

{
    const maker = fakeMaker();
    let reach = true, labels = true;
    const { tool, canvas } = makeTool(maker, { inReach: () => reach, labelsShown: () => labels });
    tool.setActive(true);
    const pc = canvasOf([0.5, 0.2]);

    let geo = tool.getOverlayGeometry();
    const pw = g.toWorld([0.5, 0.2]);
    check(geo && geo.points.filter(p => nearP(p.p, pw, 1e-12)).length === 2, 'the point at g(at): a halo and a disc');
    check(geo.points.some(p => nearP(p.p, g.toWorld([0, 0]), 1e-12) && p.kind === 'disc'), 'the corner at g(at)');
    check(geo.splanes.length === 0, 'no guide while nothing is hovered');

    tool.handleEvent(hover(pc));
    geo = tool.getOverlayGeometry();
    const r = Math.hypot(0.5, 0.2);
    check(geo.splanes.length === 1 && nearP(geo.splanes[0].circle, g.toWorld([0, 0]), 1e-12) && near(geo.splanes[0].circle[2], 2*r, 1e-12),
          'the hovered point\'s guide, carried by g');
    check(geo.points.some(p => nearP(p.p, pw, 1e-12) && p.size === 8), 'the hovered point is larger');

    // the text: the order's label, the hovered point's values
    const texts = [];
    const ctx = new Proxy({}, {
        get: (o, k) => (k in o) ? o[k] : (k === 'fillText' ? (t) => { texts.push(t); } : () => {}),
        set: (o, k, v) => { o[k] = v; return true; },
    });
    tool.renderText(ctx);
    check(texts.includes('3'), `the order's label (${texts.join(' | ')})`);
    check(texts.includes('a 0.5  b 0.2'), 'the hovered point\'s values');
    texts.length = 0;
    tool.renderUI(ctx);
    check(texts.includes('3') && texts.includes('a 0.5  b 0.2'), 'the 2D fallback draws the text too');

    // without labels (projection maps): no label drawn or picked, the points still are
    labels = false;
    texts.length = 0;
    tool.renderText(ctx);
    check(texts.length === 0, 'no text without labels');
    tool.handleEvent(hover(labelCentre([0, 0], [0.5, 0.5])));
    check(tool.getHover() === null, 'no label picked without labels');
    tool.handleEvent(hover(pc));
    check(tool.getHover() && tool.getHover().id === 'a,b', 'the point is still picked');
    labels = true;

    // out of reach (the view off home): nothing drawn or taken
    reach = false;
    check(tool.getOverlayGeometry() === null, 'nothing drawn out of reach');
    let e = ev('pointerdown', pc);
    tool.handleEvent(e);
    check(!e.isConsumed, 'nothing taken out of reach');
    reach = true;

    // a drag goes on when the view goes off home under it
    tool.handleEvent(ev('pointerdown', pc));
    reach = false;
    check(tool.isShown() && tool.getOverlayGeometry() !== null, 'shown while a drag goes on');
    tool.handleEvent(ev('pointerup', pc));
    reach = true;

    // left: the cursor and the tooltip put back, nothing drawn
    tool.handleEvent(hover(pc));
    check(canvas.style.cursor === 'grab', 'hovered');
    tool.setActive(false);
    check(canvas.style.cursor === 'crosshair' && canvas.title === 'the canvas' && tool.getHover() === null, 'left: put back');
    check(tool.getOverlayGeometry() === null && !tool.isShown(), 'left: nothing drawn');

    // a maker that fails: no handles, one warning
    const warn = console.warn;
    let warned = 0;
    console.warn = () => { warned++; };
    const bad = GroupHandlesTool({ getHandles: () => { throw new Error('no'); }, view, canvas: null });
    bad.setActive(true);
    check(bad.getOverlayGeometry().points.length === 0 && warned === 1, 'a failing maker: nothing, one warning');
    bad.getOverlayGeometry();
    check(warned === 1, 'warned once');
    console.warn = warn;
}

// 5 ───────────────────────────────────────────────────────────────────────────

{
    // the wallpaper group *442: a diamond at (a/2, 0); a drag along x sets a = 2x
    const wp = new Group_WP({ type: '*442', a: 0.5 });
    let changes = 0;
    wp.setOptions({ onChanged: () => { changes++; } });
    const { tool } = makeTool(wp);
    tool.setActive(true);
    const hc = canvasOf([0.25, 0]);
    let e = ev('pointerdown', hc);
    tool.handleEvent(e);
    check(e.isConsumed, '*442: the press on a is taken');
    // along the maker's x axis by 0.1: in the world 0.2 at 30 degrees
    const to = canvasOf([0.35, 0]);
    tool.handleEvent(ev('pointermove', to));
    check(near(wp.params.a, 0.7, 1e-9) && changes === 1, `*442: a = 2x (${wp.params.a}, ${changes})`);
    // off the axis: the projection
    tool.handleEvent(ev('pointermove', canvasOf([0.35, 0.2])));
    check(near(wp.params.a, 0.7, 1e-9), '*442: off the axis, its projection');
    tool.handleEvent(ev('pointerup', to));

    // KLM: the wheel over K's label
    const klm = new Group_KLM();
    Object.assign(klm.params, { K: 2, L: 3, M: 7 });
    const t2 = makeTool(klm);
    t2.tool.setActive(true);
    const k = klm.getHandles().find(h => h.id === 'K');
    const lc = labelCentre(k.at(), k.toward);
    t2.tool.handleEvent(hover(lc));
    check(t2.tool.getHover() && t2.tool.getHover().id === 'K', 'KLM: K\'s label hovered');
    t2.tool.handleEvent(ev('wheel', lc, { deltaY: -40 }));
    check(klm.params.K === 3, `KLM: the wheel sets K (${klm.params.K})`);
    const l2 = klm.params.K === 3 && klm.getHandles().find(h => h.id === 'L');
    Object.assign(klm.params, { K: 2 });
    const l1 = klm.getHandles().find(h => h.id === 'L');
    check(l2 && !nearP(l2.at(), l1.at(), 1e-6), `KLM: L's corner moves with the triangle (${l1.at()} to ${l2 && l2.at()})`);
}

say(failed ? `${failed} of ${checks} FAILED` : `all ${checks} passed`);
if (failed) process.exitCode = 1;
