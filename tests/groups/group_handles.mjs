/*
  tests of the group makers' handles on the canvas, the Symmetry tool's group handles
  (getHandles of each maker; the kinds and helpers in lib/grouplib/GroupHandles.js;
  docs/symmetry_tool_plan.md section 5, outside the repository)

    node tests/groups/group_handles.mjs

  For every maker with handles (Wallpaper, Frieze, Spherical, KLM, KLMN, KLx, 5 and 6
  splanes, Cyclic, oN and the chains of circles), in its upper half plane and its disk
  where it has both:
  1. an order handle sits at a corner of the domain the maker draws: on two of its sides
     and inside the others; a step changes the order by one (∞ where the maker reads an
     ideal corner) and the handle is at a corner of the new domain
  2. a point handle set to a point where its values allow moves there (the handle is
     then at the point), or to its projection on its path; its values change as its
     rule says and the maker hears one change
  3. save and restore put the values back
  4. the helpers: cornerOf picks the domain's corner of two meeting circles, followParam
     follows a path, setMakerValues writes, shows and tells once, the orders' steps
*/

import {
    Group_WP,
    Group_Frieze,
    Group_Spherical,
    Group_KLM,
    Group_KLMN,
    Group_KLx,
    Group_5splanes,
    Group_6splanes,
    Group_Cyclic,
    Group_ON,
    Group_s22222,
    Group_22222,
    Group_s222222,
} from '../../lib/grouplib/grouplib.js';
import {
    sideDistance, cornerOf, followParam, setMakerValues, orderHandle, uhpDiskSwap,
} from '../../lib/grouplib/GroupHandles.js';
import { iSphere, iPlane } from '../../lib/invlib/invlib.js';

// the makers log as they work (Group_KLM's DEBUG): the test speaks through say
const say = console.log.bind(console);
console.log = () => {};

let failures = 0, checks = 0;
function check(ok, msg){ checks++; if(!ok){ failures++; say('  FAIL:', msg); } return ok; }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps*(1 + Math.abs(b));
const nearP = (p, q, eps = 1e-6) => !!p && !!q && near(p[0], q[0], eps) && near(p[1], q[1], eps);
const fmtP = (p) => p ? `[${p.map(x => x.toFixed(6)).join(', ')}]` : String(p);

/** the maker with a counter of its changes */
function counted(maker){
    const out = { maker, changes: 0 };
    maker.setOptions({ onChanged: () => { out.changes++; } });
    return out;
}

/** the point is a corner of the domain the maker draws: on two sides at least, inside every side */
function isCorner(maker, p, eps = 1e-6){
    const { on, out } = sidesAt(maker, p, eps);
    return on >= 2 && out === 0;
}

/** how many sides of the domain the point is on, how many it is outside of */
function sidesAt(maker, p, eps = 1e-6){
    const fd = maker.getGroup().getFundDomain();
    const d = fd.map(s => sideDistance(s, p));
    const tol = eps*(1 + Math.hypot(p[0], p[1]));
    return { on: d.filter(x => Math.abs(x) <= tol).length, out: d.filter(x => x > tol).length };
}

function handle(maker, id){
    return maker.getHandles().find(h => h.id === id) || null;
}

/**
  every order handle of the maker sits at a corner, before and after a step down and up;
  the orders of virtual corners (where two sides cross outside the domain: the 5 splanes'
  n35, n45 when the side crosses the x axis inside the inner circle) on their two sides
*/
function checkOrders(name, maker, virtual = []){
    const hs = maker.getHandles().filter(h => h.kind === 'order');
    const atCorner = (h, a) => !!a && (virtual.includes(h.id) ? sidesAt(maker, a).on >= 2 : isCorner(maker, a));
    for(const h0 of hs){
        const a = h0.at();
        check(atCorner(h0, a), `${name} ${h0.id}: at a corner of the domain, at ${fmtP(a)}`);
        const n0 = h0.get();
        const dir = (h0.step(n0, 1) !== n0) ? 1 : -1;
        const n1 = h0.step(n0, dir);
        h0.set(n1);
        const h1 = handle(maker, h0.id);
        check(h1.get() === n1, `${name} ${h0.id}: the step set ${n1}, got ${h1.get()}`);
        const a1 = h1.at();
        check(atCorner(h1, a1), `${name} ${h0.id} = ${n1}: at a corner of the new domain, at ${fmtP(a1)}`);
        h1.set(n0);
    }
    return hs.length;
}

let n;

// -----------------------------------------------------------------------------
say('1. orders at the corners');
{
    const cases = [
        ['KLM 237', () => Object.assign(new Group_KLM(), {}), { K: 2, L: 3, M: 7 }],
        ['KLM *237', () => new Group_KLM(), { K: 2, L: 3, M: 7, s: true }],
        ['KLM 333', () => new Group_KLM(), { K: 3, L: 3, M: 3 }],
        ['KLM 234', () => new Group_KLM(), { K: 2, L: 3, M: 4 }],
        ['KLM 3∞3', () => new Group_KLM(), { K: 3, L: 0, M: 3 }],
        ['KLMN', () => new Group_KLMN(), {}],
        ['KLMN *', () => new Group_KLMN(), { s: true }],
        ['KLMN disk', () => new Group_KLMN(), { uhp: false }],
        ['KLMN 3245', () => new Group_KLMN(), { K: 3, L: 2, M: 4, N: 5, aspect: 0.3 }],
        ['KLx', () => new Group_KLx(), {}],
        ['KLx disk', () => new Group_KLx(), { uhp: false, K: 4, L: 3 }],
        ['5 splanes', () => new Group_5splanes(), {}],
        ['5 splanes disk', () => new Group_5splanes(), { uhp: false }],
        ['5 splanes s5 no s1', () => new Group_5splanes(), { s1: false, s5: true, use_n35: true, use_n45: true, n35: 3, n45: 4 }],
        // the user's presets with s5 (attractors and sample apps): the sides s3, s4 cross the
        // x axis inside the inner circle, but in the disk preset's n35
        ['5 splanes preset 1', () => new Group_5splanes(), { n13: 3, n23: 3, n14: 3, n24: 3, n35: 2, use_n35: true, n45: 4, use_n45: true,
                                                             r1: 0.24, r2: 1, s5: true }, ['n35', 'n45']],
        ['5 splanes preset 2', () => new Group_5splanes(), { n13: 4, n23: 3, n14: 3, n24: 3, n35: 5, use_n35: true, n45: 2, use_n45: true,
                                                             r1: 0.41, r2: 1.22, uhp: false, s5: true }, ['n45']],
        ['5 splanes preset 3', () => new Group_5splanes(), { n13: 2, n23: 3, n14: 3, n24: 2, n35: 3, use_n35: true, n45: 3, use_n45: true,
                                                             r1: 0.56, r2: 1, s5: true }, ['n35', 'n45']],
        ['6 splanes', () => new Group_6splanes(), {}],
        ['oN', () => new Group_ON(), {}],
        ['oN N4', () => new Group_ON(), { N: 4 }],
    ];
    for(const [name, make, values, virtual] of cases){
        const maker = make();
        Object.assign(maker.params, values);
        if(maker.onParamChanged) maker.onParamChanged();
        n = checkOrders(name, maker, virtual);
        check(n > 0, `${name}: order handles`);
    }
    // the spherical dihedral groups: n at the pole
    for(const [type, centered] of [['*nn', true], ['nn', true], ['*22n', true], ['22n', true], ['*nn', false], ['n*', false]]){
        const maker = new Group_Spherical({ type, n: 5 });
        maker.mConfig.centered = centered;
        n = checkOrders(`spherical ${type}${centered ? '' : ' not centred'}`, maker);
        check(n === 1, `spherical ${type}: one order handle, ${n}`);
    }
    check(new Group_Spherical({ type: '*532' }).getHandles().length === 0, 'spherical *532: no handles');
    // the steps of an order with ideal corners: 2..19, ∞ (0, 1, 20)
    const klm = new Group_KLM();
    const k = handle(klm, 'K');
    check(k.step(19, 1) === 20 && k.text(20) === '∞' && k.text(0) === '∞' && k.text(1) === '∞', 'KLM: 19 + 1 is ∞');
    check(k.step(20, -1) === 19 && k.step(0, -1) === 19 && k.step(0, 1) === 20 && k.step(2, -1) === 2, 'KLM: ∞ - 1 is 19, 2 - 1 stays 2');
    const six = new Group_6splanes();
    const n13 = handle(six, 'n13');
    check(n13.step(2, -1) === 1 && n13.text(1) === '∞' && n13.step(1, 1) === 2 && n13.text(20) === '20', '6 splanes: ∞ below 2, 20 a number');
}

// -----------------------------------------------------------------------------
say('2. points');
{
    // the wallpaper groups
    const wp = counted(new Group_WP({ type: '*442', a: 0.5 }));
    let h = handle(wp.maker, 'a');
    check(isCorner(wp.maker, h.at()), '*442: (a/2, 0) is a corner');
    h.set([0.4, 0.1]);
    check(near(wp.maker.params.a, 0.8) && wp.changes === 1, `*442: a = 2x, one change: a ${wp.maker.params.a}, ${wp.changes}`);
    check(nearP(handle(wp.maker, 'a').at(), [0.4, 0]), '*442: the handle at the projection');
    h.set([-1, 0]);
    check(near(wp.maker.params.a, 0.0001), `*442: a stays positive, ${wp.maker.params.a}`);
    for(const type of ['442', '4*2', '*632', '632', '3*3', '*333', '333']){
        const m = new Group_WP({ type, a: 0.6 });
        const at = handle(m, 'a').at();
        const fd = m.getGroup().getFundDomain();
        const onSide = fd.some(s => Math.abs(sideDistance(s, at)) < 1e-9);
        check(nearP(at, [0.3, 0]), `${type}: the handle at (a/2, 0), ${fmtP(at)}`);
        check(onSide || type === '632' || type === '3*3' || type === '442', `${type}: (a/2, 0) on the domain's boundary`);
    }
    for(const type of ['*2222', '2*22', '22*', '**', '*X', '22X', 'XX']){
        const m = counted(new Group_WP({ type, a: 0.5, b: 0.7 }));
        const hh = handle(m.maker, 'a,b');
        check(isCorner(m.maker, hh.at()), `${type}: (a/2, b/2) is a corner`);
        hh.set([0.3, 0.2]);
        check(near(m.maker.params.a, 0.6) && near(m.maker.params.b, 0.4) && m.changes === 1, `${type}: a = 2x, b = 2y, one change`);
        check(isCorner(m.maker, handle(m.maker, 'a,b').at()), `${type}: still a corner`);
    }
    {
        const m = new Group_WP({ type: '2222', a: 0.5, b: 0.7, c: 0.1 });
        check(isCorner(m, handle(m, 'a,b').at()), '2222: (a, b/2) is a corner');
        handle(m, 'a,b').set([0.8, 0.5]);
        check(near(m.params.a, 0.8) && near(m.params.b, 1.0), '2222: a = x, b = 2y');
        const c = handle(m, 'c');
        check(nearP(c.at(), [0, -0.1]), '2222: the 2-fold point (0, -c)');
        c.set([0.3, 0.25]);
        check(near(m.params.c, -0.25) && nearP(handle(m, 'c').at(), [0, 0.25]), '2222: c = -y, the handle on x = 0');
    }
    {
        const m = counted(new Group_WP({ type: 'O', a: 0.5, b: 0.6, angle_a: 0, angle_b: 90 }));
        const hb = handle(m.maker, 'b,angle_b');
        check(nearP(hb.at(), [0, 0.6]), 'o: the end of b');
        hb.set([-0.3, 0.4]);
        check(near(m.maker.params.b, 0.5) && near(m.maker.params.angle_b, Math.atan2(0.4, -0.3)*180/Math.PI) && m.changes === 1,
              `o: b, angle_b of the point: ${m.maker.params.b}, ${m.maker.params.angle_b}`);
        check(nearP(handle(m.maker, 'b,angle_b').at(), [-0.3, 0.4]), 'o: the handle at the point');
        // the save and restore of the press
        const s = handle(m.maker, 'a,angle_a').save();
        handle(m.maker, 'a,angle_a').set([0.1, 0.9]);
        handle(m.maker, 'a,angle_a').restore(s);
        check(near(m.maker.params.a, 0.5) && near(m.maker.params.angle_a, 0), 'o: restore puts a, angle_a back');
    }
    check(new Group_WP({ type: 'trivial' }).getHandles().length === 0, 'trivial: no handles');

    // the frieze groups
    {
        const f = counted(new Group_Frieze({ a: 0.5 }));
        const h = handle(f.maker, 'a');
        check(isCorner(f.maker, h.at()), '*22∞: (a, 0) is a corner');
        h.set([0.7, 3]);
        check(near(f.maker.mConfig.a, 0.7) && f.changes === 1 && nearP(handle(f.maker, 'a').at(), [0.7, 0]), 'frieze: a = x');
    }

    // KLMN, KLx: the aspect on the inner circle
    for(const [name, maker] of [['KLMN', new Group_KLMN()], ['KLx', new Group_KLx()]]){
        for(const uhp of [true, false]){
            maker.params.uhp = uhp;
            const h = handle(maker, 'aspect');
            const t = uhp ? [0.2, 0.3] : uhpDiskSwap([0.2, 0.3]);
            h.set(t);
            check(near(maker.params.aspect, Math.hypot(0.2, 0.3)), `${name}${uhp ? '' : ' disk'}: the aspect is |p| in the half plane, ${maker.params.aspect}`);
            const a = handle(maker, 'aspect').at();
            const q = uhp ? a : uhpDiskSwap(a);
            check(near(Math.hypot(q[0], q[1]), maker.params.aspect), `${name}${uhp ? '' : ' disk'}: the handle on the inner circle`);
            h.set(uhp ? [0, 5] : uhpDiskSwap([0, 5]));
            check(near(maker.params.aspect, 0.99), `${name}: the aspect at most 0.99`);
            maker.params.aspect = 0.5;
        }
    }

    // Cyclic: λ
    for(const finiteFP of [false, true]){
        const c = counted(new Group_Cyclic());
        c.maker.params.finiteFP = finiteFP;
        const h = handle(c.maker, 'AbsLambda,ArgLambda');
        const lam = [1.5*Math.cos(0.7), 1.5*Math.sin(0.7)];
        const t = finiteFP ? [1 + 2*(lam[0] - 1)/((lam[0] - 1)**2 + lam[1]**2), 2*lam[1]/((lam[0] - 1)**2 + lam[1]**2)] : lam;
        h.set(t);
        check(near(c.maker.params.AbsLambda, 1.5) && near(c.maker.params.ArgLambda, 0.7*180/Math.PI) && c.changes === 1,
              `cyclic${finiteFP ? ' finiteFP' : ''}: |λ|, arg λ of the point: ${c.maker.params.AbsLambda}, ${c.maker.params.ArgLambda}`);
        check(nearP(handle(c.maker, 'AbsLambda,ArgLambda').at(), t), `cyclic${finiteFP ? ' finiteFP' : ''}: the handle at the point`);
        h.set(finiteFP ? [1.2, 0.05] : [0.3, 0]);
        check(c.maker.params.AbsLambda >= 1.001, 'cyclic: |λ| at least 1.001');
    }
    {
        // a drag across ±180 goes on past it
        const c = new Group_Cyclic();
        c.params.ArgLambda = 170;
        handle(c, 'AbsLambda,ArgLambda').set([1.2*Math.cos(-170*Math.PI/180), 1.2*Math.sin(-170*Math.PI/180)]);
        check(near(c.params.ArgLambda, 190), `cyclic: 170 to -170 goes on to 190, ${c.params.ArgLambda}`);
    }

    // oN: R on the absolute, r1 by its point on the x axis
    {
        const o = counted(new Group_ON());
        handle(o.maker, 'R').set([0.9, 1.2]);
        check(near(o.maker.params.R, 1.5) && o.changes === 1, `oN: R = |p|, ${o.maker.params.R}, ${o.changes}`);
        handle(o.maker, 'R').set([3, 0]);
        check(near(o.maker.params.R, 2), 'oN: R at most 2');
        o.maker.params.R = 1;
        const h = handle(o.maker, 'r1');
        const a0 = h.at();
        const S1 = () => o.maker.getGroup().getFundDomain()[5];
        check(Math.abs(sideDistance(S1(), a0)) < 1e-9, 'oN: r1 at its point on the circle S1');
        // a point of the path for another r1: the handle goes there
        o.maker.params.r1 = 0.7;
        o.maker.onParamChanged();
        const target = handle(o.maker, 'r1').at();
        o.maker.params.r1 = 0.5;
        o.maker.onParamChanged();
        handle(o.maker, 'r1').set([target[0], target[1] + 0.05]);
        check(near(o.maker.params.r1, 0.7, 1e-5), `oN: r1 found from its point, ${o.maker.params.r1}`);
        check(Math.abs(sideDistance(S1(), handle(o.maker, 'r1').at())) < 1e-9, 'oN: the handle on the new S1');
        // with a bend
        o.maker.params.bend1 = 25;
        o.maker.onParamChanged();
        const b = handle(o.maker, 'r1').at();
        check(Math.abs(sideDistance(S1(), b)) < 1e-9, 'oN: bent, the handle on S1');
    }

    // the chains of circles
    for(const [name, make, radii] of [['*22222', () => new Group_s22222(), 3], ['22222', () => new Group_22222(), 3], ['*222222', () => new Group_s222222(), 4]]){
        for(const uhp of [true, false]){
            const c = counted(make());
            c.maker.params.uhp = uhp;
            const model = (p) => uhp ? p : uhpDiskSwap(p);
            const tag = `${name}${uhp ? '' : ' disk'}`;
            handle(c.maker, 'R1').set(model([0.3, 0.4]));
            check(near(c.maker.params.R1, 0.5) && c.changes === 1, `${tag}: R1 = |p|`);
            // the second circle's centre: its radius and direction
            const h = handle(c.maker, 'R2,A2');
            const t = [0.8, 0.3];
            h.set(model(t));
            const d = Math.hypot(t[0], t[1]);
            check(near(c.maker.params.R2, Math.sqrt(d*d - 0.25)) && near(c.maker.params.A2, Math.atan2(0.3, 0.8)*180/Math.PI),
                  `${tag}: R2, A2 of the centre, ${c.maker.params.R2}, ${c.maker.params.A2}`);
            check(nearP(handle(c.maker, 'R2,A2').at(), model(t)), `${tag}: the second centre at the point`);
            // a circle of the group has that centre (in the half plane)
            if(uhp){
                const fd = c.maker.getGroup().getFundDomain();
                check(fd.some(s => s.v && nearP([s.v[0], s.v[1]], t)), `${tag}: a side centred there`);
            }
            // the closing circle's centre on the y axis
            const last = `A${radii + 1}`;
            const hc = handle(c.maker, last);
            if(check(!!hc, `${tag}: the closing circle's handle`)){
                hc.set(model([0.5, 0.9]));
                check(nearP(handle(c.maker, last).at(), model([0, 0.9])), `${tag}: the closing centre at (0, y), ${fmtP(handle(c.maker, last).at())}`);
            }
        }
    }

    // 5 and 6 splanes: the radii, the directions
    for(const [name, make] of [['5 splanes', () => new Group_5splanes()], ['6 splanes', () => new Group_6splanes()]]){
        for(const uhp of [true, false]){
            const maker = make();
            maker.params.uhp = uhp;
            const model = (p) => uhp ? p : uhpDiskSwap(p);
            const tag = `${name}${uhp ? '' : ' disk'}`;
            handle(maker, 'r1').set(model([0.3, 0.3]));
            check(near(maker.params.r1, Math.hypot(0.3, 0.3)), `${tag}: r1 = |p|`);
            maker.params.r1 = 0.5;
            const h = handle(maker, 'a3');
            const a = uhp ? h.at() : uhpDiskSwap(h.at());
            const rad = Math.hypot(a[0], a[1]);
            check(rad > 0.5 && rad < 1, `${tag}: the direction's handle in the annulus, |.| ${rad}`);
            const fd = () => maker.getGroup().getFundDomain();
            maker.onParamChanged();
            check(Math.abs(sideDistance(fd()[2], h.at())) < 1e-9, `${tag}: the handle on the side s3`);
            const ang = Math.atan2(a[1], a[0]) + 0.4;
            const t = [rad*Math.cos(ang), rad*Math.sin(ang)];
            h.set(model(t));
            const b = uhp ? handle(maker, 'a3').at() : uhpDiskSwap(handle(maker, 'a3').at());
            check(nearP(b, t, 1e-6), `${tag}: the direction follows the point about the origin, ${fmtP(b)} for ${fmtP(t)}`);
            check(near(maker.params.a3, 0.4*180/Math.PI, 1e-6), `${tag}: a3 turned by the angle, ${maker.params.a3}`);
            check(Math.abs(sideDistance(fd()[2], handle(maker, 'a3').at())) < 1e-9, `${tag}: still on s3`);
        }
    }
    {
        const m = new Group_5splanes();
        Object.assign(m.params, { use_n35: true });
        check(!handle(m, 'a3') && !!handle(m, 'a4'), '5 splanes: a3 has no handle while n35 sets it');
    }
}

// -----------------------------------------------------------------------------
say('3. helpers');
{
    // two circles meet twice: the corner on the domain's side of the others, nearest the point
    const a = iSphere([0, 0, 0, 1]);          // inside the unit circle
    const b = iSphere([1, 1, 0, -1]);         // outside the circle about (1, 1)
    const line = iPlane([0, 1, 0, 0.5]);      // y <= 0.5
    const c = cornerOf(a, b, [line]);
    check(nearP(c, [1, 0]), `cornerOf: the meeting point below y = 0.5, ${fmtP(c)}`);
    const d = cornerOf(a, b, [], [0, 2]);
    check(nearP(d, [0, 1]), `cornerOf: no other side, the one nearest (0, 2), ${fmtP(d)}`);
    const t = cornerOf(iSphere([0, 0, 0, 1]), iPlane([0, 1, 0, 1]), []);
    check(nearP(t, [0, 1]), `cornerOf: a touch point, ${fmtP(t)}`);
    check(cornerOf(iSphere([0, 0, 0, 1]), iSphere([5, 0, 0, 1]), []) === null, 'cornerOf: apart, none');

    // followParam: the point of a parabola nearest the target
    const posOf = (v) => [v, v*v];
    const v = followParam(posOf, 0.1, [0.8, 0.64], 0, 2);
    check(near(v, 0.8, 1e-9), `followParam: on the path, ${v}`);
    const w = followParam(posOf, 0.1, [5, 25], 0, 2);
    check(near(w, 2), `followParam: held at the end, ${w}`);

    // setMakerValues: written, shown, one change, numbers only
    let shown = 0, changed = 0;
    const maker = {
        params: { a: 1, b: 2, t: 'x' },
        mParams: { a: { updateDisplay: () => shown++ }, b: { updateDisplay: () => shown++ } },
        onParamChanged: () => changed++,
    };
    check(setMakerValues(maker, { a: 3, b: 2, t: 'y' }) && maker.params.a === 3 && maker.params.t === 'x' && shown === 1 && changed === 1,
          'setMakerValues: the changed number written and shown, one change');
    check(!setMakerValues(maker, { a: 3 }) && changed === 1, 'setMakerValues: nothing new, no change');
    // an order without ideal corners
    const o = orderHandle(maker, { key: 'a', min: 2, max: 5, at: () => [0, 0] });
    check(o.step(5, 1) === 5 && o.step(2, -1) === 2 && o.text(5) === '5', 'orderHandle: held in [min, max]');
}

say(failures ? `${failures} of ${checks} failed` : `all ${checks} passed`);
process.exit(failures ? 1 : 0);
