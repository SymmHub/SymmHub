/*
  ConformalMaps.js — the rows of the list of conformal transformations
  (ProjectionTransform.js; docs/conformal_transforms_plan.md, outside the
  repository), one maker per kind: band, periodic, scale, loxodromic, exponent,
  upper half plane, rational, power. (The fixed points transformation is a row
  too, a class of its own: FixedPointsTransform.js.)

  A row has the interface the lists of the app ask of their children
  (uilib ParamObjArray, as an overlay's items have it):

    getClassName(), getParams(), getId() / setId() / setOnIdChange()
    init(par)          par: {onChange, own, onFrame, groupMaker}: onChange() after
                       an edit of its values; own(fn) runs a change the row makes
                       itself (values found again from the group, a frame of an
                       animation), which is no edit of the user's and no undo
                       step; onFrame() asks for the next frame
    enabled            getter

  and gives the list its part of the chain:

    getSteps()            the steps the shaders apply for it (ConformalKinds.js),
                          in their order; [] when it does nothing. Asked of the
                          rows that are on.
    tick(timestamp)       optional: a frame at the time stamp, for a row that
                          follows the time (the animated fixed points)

  A row may have a UI of its own (plan 5.3), all of it optional:

    getPanelParams()      its params as the panel shows them: several in a row
                          (uilib ParamUiRow), the order of the panel. Only the UI:
                          getParams() is what a document saves
    getHandles()          its handles on the canvas, as a group maker's are
                          (the kinds of grouplib/GroupHandles.js: point, order),
                          in the coordinates of its plane
    getMarks()            what is drawn with them and takes no pointer: a
                          geometry of the editing overlay (OverlayGeometry.js),
                          in the coordinates of its plane
    handlesPlane          'screen' (the default): the plane on the screen's side
                          of the row, where the reverse form's numbers live (the
                          points of the rational map, the cell of the wrap);
                          'world': the plane on the pattern's side (the fixed
                          points of a word of the group). TransformHandles.js
                          shows them through the view's chain cut at the row.

  A row is named by the direct map, the one that takes the pattern towards the
  screen (the band shows the disk as a band); its step is the reverse, which
  the shaders apply to a pixel.

  The params of a kind keep the names they had as the fixed maps of
  ProjectionTransform (fraction; a1x ... cy; a1x ... shift2; x1 ... n4), so an
  old document's values go into the row as they are. The rational map has more
  points than the four it had (x5 ... n8) and their number, count.
*/

import {
    ParamBool,
    ParamFloat,
    ParamInt,
    ParamString,
    ParamUiRow,
    add,
    mul,
    cDiv,
    PI,
    rationalStep,
    scaleStep,
    periodicStep,
    bandStep,
    plainStep,
    powerStep,
    RATIONAL_MAX_POINTS,
} from '../modules.js';

const INCREMENT = 1.e-12;
const LIMIT = 100;      // the range of the lattices' and points' coordinates

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** a number for a label: four significant digits, no trailing zeros */
function fmt(v) {
    if (!Number.isFinite(v)) return String(v);
    const a = Math.abs(v);
    const s = (a >= 1000 || (a > 0 && a < 1e-3)) ? v.toExponential(3) : v.toPrecision(4);
    return s.includes('e') ? s : s.replace(/\.?0+$/, '');
}

// the marks' colours (the handles' orange, GroupHandlesTool)
const MARK_LINE = [0.86, 0.42, 0.04, 0.8];
const MARK_HALO = [1, 1, 1, 0.55];

/**
 * a row of a kind
 * @param {object} spec  className, defaults (the kind's values), makeParams(cfg, onChange)
 *                       (its params after id and enabled), getSteps(cfg); optional:
 *                       makePanel(params, row) (the panel's params, id and enabled first),
 *                       getHandles(row), getMarks(row), handlesPlane, onChanged(row) (after
 *                       any change of its values). row: {cfg, params(), set(values),
 *                       pick(keys)}, the row's values for the kind's own code
 * @param {object} par   {id, config}: config over {enabled: true, ...defaults}
 */
function makeConformalMap(spec, par = {}) {

    const mConfig = { enabled: true, ...JSON.parse(JSON.stringify(spec.defaults || {})), ...(par.config || {}) };
    const mIdRef = { id: par.id ?? '' };
    let mOnIdChange = null;
    let mOnChange   = null;
    let mParams     = null;
    let mPanel      = null;

    function onChange(p) {
        if (spec.onChanged) spec.onChanged(mRow);
        if (mOnChange) mOnChange(p);
    }

    function getParams() {
        if (!mParams) {
            mParams = {
                id:      ParamString({ obj: mIdRef, key: 'id', name: 'id', onChange: () => { if (mOnIdChange) mOnIdChange(); } }),
                enabled: ParamBool({ obj: mConfig, key: 'enabled', onChange }),
                ...(spec.makeParams ? spec.makeParams(mConfig, onChange) : {}),
            };
        }
        return mParams;
    }

    // the row's values for the kind's own code (its panel's commands, its handles)
    const mRow = {
        cfg:    mConfig,
        params: getParams,
        /**
         * values set at once, as the row's controls would set them: written, the controls
         * that show them updated, and the list hears one change; values that are no
         * numbers, or the same, are left out. Returns whether anything changed
         */
        set(values) {
            if (!values) return false;
            const params = getParams();
            let changed = false;
            for (const key of Object.keys(values)) {
                const v = values[key];
                if (typeof v !== 'number' || !Number.isFinite(v) || mConfig[key] === v) continue;
                mConfig[key] = v;
                if (params[key] && params[key].updateDisplay) params[key].updateDisplay();
                changed = true;
            }
            if (changed) onChange();
            return changed;
        },
        /** the values of the keys, to put back (set) */
        pick(keys) {
            const out = {};
            for (const key of keys) out[key] = mConfig[key];
            return out;
        },
    };

    const row = {
        getClassName:  () => spec.className,
        getParams:     getParams,
        getId:         ()   => mIdRef.id,
        setId:         (id) => { mIdRef.id = id; },
        setOnIdChange: (fn) => { mOnIdChange = fn; },
        init:          (p)  => { mOnChange = p ? p.onChange : null; },
        getConfig:     () => mConfig,
        getSteps:      () => spec.getSteps(mConfig),
        get enabled() { return mConfig.enabled; },
        handlesPlane:  spec.handlesPlane || 'screen',
    };
    if (spec.makePanel) row.getPanelParams = () => (mPanel || (mPanel = spec.makePanel(getParams(), mRow)));
    if (spec.getHandles) row.getHandles = () => spec.getHandles(mRow);
    if (spec.getMarks) row.getMarks = () => spec.getMarks(mRow);
    // the kind's own commands (the rational map's points added and taken out)
    if (spec.commands) Object.assign(row, spec.commands(mRow));
    return row;
}

const coord = (cfg, key, onChange) => ParamFloat({ obj: cfg, key, min: -LIMIT, max: LIMIT, step: INCREMENT, onChange });

/** a row of the panel with two of the params in it: `name [a] [b]` */
function pairRow(panel, p, name, keyA, keyB, tooltip, tipA = 'x', tipB = 'y') {
    const row = ParamUiRow({ name, tooltip, labelWidth: '3.6em' });
    panel['row_' + keyA] = row;
    panel[keyA] = row.contain(p[keyA], { tooltip: tipA });
    panel[keyB] = row.contain(p[keyB], { tooltip: tipB });
}

/** a point handle of the row (grouplib/GroupHandles.js: the kind 'point') */
function pointHandle(row, def) {
    return {
        kind:    'point',
        id:      def.id,
        at:      def.at,
        set:     (p) => row.set(def.toValues(p)),
        shape:   def.shape || 'disc',
        filled:  !!def.filled,
        title:   def.title || '',
        label:   def.label || (() => def.keys.map(k => `${k} ${fmt(row.cfg[k])}`).join('  ')),
        guide:   def.guide || null,
        save:    () => row.pick(def.keys),
        restore: (state) => row.set(state),
    };
}

// ── band: the disk shown as a band ─────────────────────────────────────────────

/** the fraction the shader gets: below 1 it runs through six decades, 0 the identity, 1 the band */
export function bandMapFraction(fraction) {
    return (fraction < 1.) ? (1. - 10. ** (-6.*fraction))/(1. - 1.e-6) : fraction;
}

export const BAND_DEFAULTS = { fraction: 1 };

export function ConformalBand(par) {
    return makeConformalMap({
        className: 'ConformalBand',
        defaults: BAND_DEFAULTS,
        makeParams: (cfg, onc) => ({
            fraction: ParamFloat({ obj: cfg, key: 'fraction', onChange: onc }),
        }),
        getSteps: (cfg) => [bandStep(bandMapFraction(cfg.fraction))],
    }, par);
}

// ── periodic: the cell of a lattice repeated over the plane ────────────────────

export const PERIODIC_DEFAULTS = { a1x: 1, a1y: 0, a2x: 0, a2y: 1, cx: 0., cy: 0. };

/** the lattice of a periodic row: its vectors, their cross product, the centre of the cell in the plane */
function periodicLattice(cfg) {
    const a1 = [cfg.a1x, cfg.a1y], a2 = [cfg.a2x, cfg.a2y];
    return { a1, a2, det: a1[0]*a2[1] - a1[1]*a2[0], C: [cfg.cx*a1[0] + cfg.cy*a2[0], cfg.cx*a1[1] + cfg.cy*a2[1]] };
}

/** the coordinates of the plane point p in the lattice a1, a2 (p = u a1 + v a2); null for vectors along one line */
function latticeCoords(p, a1, a2) {
    const det = a1[0]*a2[1] - a1[1]*a2[0];
    if (!(Math.abs(det) > 1e-12)) return null;
    return [(p[0]*a2[1] - p[1]*a2[0])/det, (a1[0]*p[1] - a1[1]*p[0])/det];
}

/**
 * the handles of the wrap, in the plane on its screen's side: the centre of the cell,
 * and the middles of two of its sides, which set the lattice's vectors (the centre
 * stays where it is)
 */
function periodicHandles(row) {
    const cfg = row.cfg;
    const { a1, a2, C } = periodicLattice(cfg);
    const vector = (k, a, other) => pointHandle(row, {
        id: 'a' + k, keys: [`a${k}x`, `a${k}y`], shape: 'diamond',
        at: () => [C[0] + a[0]/2, C[1] + a[1]/2],
        toValues: (p) => {
            const v = [clamp(2*(p[0] - C[0]), -LIMIT, LIMIT), clamp(2*(p[1] - C[1]), -LIMIT, LIMIT)];
            // the centre stays: its coordinates in the new lattice
            const c = (k === 1) ? latticeCoords(C, v, other) : latticeCoords(C, other, v);
            if (!c) return null;
            return { [`a${k}x`]: v[0], [`a${k}y`]: v[1], cx: clamp(c[0], -LIMIT, LIMIT), cy: clamp(c[1], -LIMIT, LIMIT) };
        },
        title: `a${k}: a vector of the lattice, from the middle of the cell's side to the middle of the opposite one`,
        label: () => `a${k} ${fmt(cfg[`a${k}x`])}, ${fmt(cfg[`a${k}y`])}`,
    });
    return [
        pointHandle(row, {
            id: 'centre', keys: ['cx', 'cy'],
            at: () => C,
            toValues: (p) => {
                const c = latticeCoords(p, a1, a2);
                return c ? { cx: clamp(c[0], -LIMIT, LIMIT), cy: clamp(c[1], -LIMIT, LIMIT) } : null;
            },
            title: 'the centre of the cell that is repeated',
            label: () => `centre ${fmt(cfg.cx)}, ${fmt(cfg.cy)} (of the vectors)`,
        }),
        vector(1, a1, a2),
        vector(2, a2, a1),
    ];
}

/** the cell that is repeated: its outline */
function periodicMarks(row) {
    const { a1, a2, C } = periodicLattice(row.cfg);
    const corner = (s, t) => [C[0] + 0.5*(s*a1[0] + t*a2[0]), C[1] + 0.5*(s*a1[1] + t*a2[1])];
    return { polylines: [{ points: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], closed: true,
                           width: 1.3, color: MARK_LINE, halo: MARK_HALO, haloWidth: 3 }] };
}

export function ConformalPeriodic(par) {
    return makeConformalMap({
        className: 'ConformalPeriodic',
        defaults: PERIODIC_DEFAULTS,
        makeParams: (cfg, onc) => ({
            a1x: coord(cfg, 'a1x', onc),
            a1y: coord(cfg, 'a1y', onc),
            a2x: coord(cfg, 'a2x', onc),
            a2y: coord(cfg, 'a2y', onc),
            cx:  coord(cfg, 'cx', onc),
            cy:  coord(cfg, 'cy', onc),
        }),
        makePanel: (p) => {
            const panel = { id: p.id, enabled: p.enabled };
            pairRow(panel, p, 'a1', 'a1x', 'a1y', 'the first vector of the lattice');
            pairRow(panel, p, 'a2', 'a2x', 'a2y', 'the second vector of the lattice');
            pairRow(panel, p, 'centre', 'cx', 'cy', 'the centre of the cell that is repeated, in the vectors: cx a1 + cy a2', 'along a1', 'along a2');
            return panel;
        },
        // the cell about the point cx a1 + cy a2; vectors along one line make no lattice: no step
        getSteps: (cfg) => {
            const a1 = [cfg.a1x, cfg.a1y], a2 = [cfg.a2x, cfg.a2y];
            const step = periodicStep(a1, a2, [cfg.cx*a1[0] + cfg.cy*a2[0], cfg.cx*a1[1] + cfg.cy*a2[1]]);
            return step ? [step] : [];
        },
        getHandles: periodicHandles,
        getMarks: periodicMarks,
    }, par);
}

// ── scale: a lattice vector made the period 2 pi i of the exponent ─────────────

export const SCALE_DEFAULTS = { a1x: 1, a1y: 0, a2x: 0, a2y: 1, n1: 10, n2: 0, shift1: 0., shift2: 0. };

export function ConformalScale(par) {
    return makeConformalMap({
        className: 'ConformalScale',
        defaults: SCALE_DEFAULTS,
        makeParams: (cfg, onc) => ({
            a1x:    coord(cfg, 'a1x', onc),
            a1y:    coord(cfg, 'a1y', onc),
            a2x:    coord(cfg, 'a2x', onc),
            a2y:    coord(cfg, 'a2y', onc),
            n1:     coord(cfg, 'n1', onc),
            n2:     coord(cfg, 'n2', onc),
            shift1: coord(cfg, 'shift1', onc),
            shift2: coord(cfg, 'shift2', onc),
        }),
        makePanel: (p) => {
            const panel = { id: p.id, enabled: p.enabled };
            pairRow(panel, p, 'a1', 'a1x', 'a1y', 'the first vector of the pattern\'s lattice');
            pairRow(panel, p, 'a2', 'a2x', 'a2y', 'the second vector of the pattern\'s lattice');
            pairRow(panel, p, 'turn', 'n1', 'n2', 'the lattice vector n1 a1 + n2 a2 that becomes one turn about the centre', 'n1: steps along a1', 'n2: steps along a2');
            pairRow(panel, p, 'shift', 'shift1', 'shift2', 'the pattern moved, in turns: along the turn and across it', 'along the turn', 'across it');
            return panel;
        },
        // the lattice vector n1 a1 + n2 a2 scaled and turned onto [0, 2 pi]
        getSteps: (cfg) => {
            const s = add(mul([cfg.a1x, cfg.a1y], cfg.n1), mul([cfg.a2x, cfg.a2y], cfg.n2));
            return [scaleStep(cDiv(s, [0, 2*PI]), [2*PI*cfg.shift1, 2*PI*cfg.shift2])];
        },
    }, par);
}

// ── the maps without values ────────────────────────────────────────────────────

/** loxodromic: the exponent between the points (-1, 0) and (1, 0) */
export function ConformalLox(par) {
    return makeConformalMap({ className: 'ConformalLox', getSteps: () => [plainStep('lox')] }, par);
}

/** exponent: the plane rolled up by e^z */
export function ConformalExp(par) {
    return makeConformalMap({ className: 'ConformalExp', getSteps: () => [plainStep('exp')] }, par);
}

/** upper half plane: the disk shown as the upper half plane */
export function ConformalUhp(par) {
    return makeConformalMap({ className: 'ConformalUhp', getSteps: () => [plainStep('uhp')] }, par);
}

// ── power: the plane seen through z^n ──────────────────────────────────────────

export const POWER_DEFAULTS = { n: 2 };

/**
 * power: the shaders take a pixel's point z to z^n, so the pattern shows n times round
 * the origin (a whole n), each copy in a sector of the angle 2 pi / n; an exponent
 * between 0 and 1 opens a sector of the pattern out to the whole plane, a negative one
 * turns it inside out as well
 */
export function ConformalPower(par) {
    return makeConformalMap({
        className: 'ConformalPower',
        defaults: POWER_DEFAULTS,
        makeParams: (cfg, onc) => ({
            n: ParamFloat({ obj: cfg, key: 'n', min: -8, max: 8, step: INCREMENT, onChange: onc }),
        }),
        getSteps: (cfg) => [powerStep(cfg.n)],
    }, par);
}

// ── rational: the product of (z - zi)^ni ───────────────────────────────────────

// the four points the map had as a fixed map of ProjectionTransform (the defaults an
// old document is compared with)
export const RATIONAL_DEFAULTS = {
    x1:  1,  y1: 0,  n1:  1,
    x2:  0,  y2: 1,  n2: -1,
    x3: -1,  y3: 0,  n3:  1,
    x4:  0,  y4:-1,  n4: -1,
};

// the points a row can have (the shader's loop takes this many) and its values:
// the four old points, the others, and how many are there (4 in an old document)
export const RATIONAL_POINTS = RATIONAL_MAX_POINTS;
const RATIONAL_ROW_DEFAULTS = {
    ...RATIONAL_DEFAULTS,
    x5:  0.5, y5:  0.5, n5:  1,
    x6: -0.5, y6:  0.5, n6: -1,
    x7: -0.5, y7: -0.5, n7:  1,
    x8:  0.5, y8: -0.5, n8: -1,
    count: 4,
};
const RATIONAL_MAX_EXPONENT = 3;

/** the number of points of a rational row, from 1 to RATIONAL_POINTS */
function rationalCount(cfg) {
    const n = Math.trunc(Number(cfg.count));
    return Number.isFinite(n) ? clamp(n, 1, RATIONAL_POINTS) : 4;
}

/** a point added after the others: a zero (sign 1) or a pole (-1), away from the others */
function addRationalPoint(row, sign) {
    const k = rationalCount(row.cfg) + 1;
    if (k > RATIONAL_POINTS) return false;
    const a = 2.4*k;        // the golden angle apart: no two on one place
    return row.set({ ['x' + k]: 0.5*Math.cos(a), ['y' + k]: 0.5*Math.sin(a), ['n' + k]: sign, count: k });
}

/** the point i taken out: those after it move up */
function removeRationalPoint(row, i) {
    const count = rationalCount(row.cfg);
    if (count <= 1 || i < 1 || i > count) return false;
    const values = { count: count - 1 };
    for (let j = i; j < count; j++) {
        for (const c of ['x', 'y', 'n']) values[c + j] = row.cfg[c + (j + 1)];
    }
    return row.set(values);
}

const exponentText = (n) => { const k = Math.trunc(n); return (k > 0 ? '+' : k < 0 ? '−' : '') + Math.abs(k); };

/**
 * the handles of the rational map, in the plane on its screen's side: its points
 * (a zero filled, a pole hollow), each with its exponent as a label that steps
 */
function rationalHandles(row) {
    const cfg = row.cfg;
    const handles = [];
    for (let i = 1; i <= rationalCount(cfg); i++) {
        const kx = 'x' + i, ky = 'y' + i, kn = 'n' + i;
        const at = () => [cfg[kx], cfg[ky]];
        const kind = () => (Math.trunc(cfg[kn]) > 0 ? 'a zero' : Math.trunc(cfg[kn]) < 0 ? 'a pole' : 'takes no part');
        handles.push({
            kind:    'order',
            id:      kn,
            key:     kn,
            at,
            toward:  null,
            get:     () => cfg[kn],
            set:     (n) => row.set({ [kn]: n }),
            step:    (n, dir) => clamp(Math.trunc(n) + Math.sign(dir), -RATIONAL_MAX_EXPONENT, RATIONAL_MAX_EXPONENT),
            text:    exponentText,
            title:   `the exponent of the point ${i}: above 0 a zero, below 0 a pole`,
            save:    () => row.pick([kn]),
            restore: (state) => row.set(state),
        });
        handles.push(pointHandle(row, {
            id: 'p' + i, keys: [kx, ky],
            at,
            toValues: (p) => ({ [kx]: clamp(p[0], -LIMIT, LIMIT), [ky]: clamp(p[1], -LIMIT, LIMIT) }),
            filled: Math.trunc(cfg[kn]) > 0,
            title: `the point ${i} of the rational map (${kind()})`,
            label: () => `${fmt(cfg[kx])}, ${fmt(cfg[ky])}`,
        }));
    }
    return handles;
}

export function ConformalRational(par) {
    return makeConformalMap({
        className: 'ConformalRational',
        defaults: RATIONAL_ROW_DEFAULTS,
        makeParams: (cfg, onc) => {
            const p = {};
            for (let i = 1; i <= RATIONAL_POINTS; i++) {
                p['x' + i] = coord(cfg, 'x' + i, onc);
                p['y' + i] = coord(cfg, 'y' + i, onc);
                p['n' + i] = ParamFloat({ obj: cfg, key: 'n' + i, min: -3, max: 3, onChange: onc });
            }
            // how many of the points are there: no control of its own (the panel's rows, its menus)
            p.count = ParamInt({ obj: cfg, key: 'count', min: 1, max: RATIONAL_POINTS, onChange: onc });
            return p;
        },
        // a row a point (x, y, exponent) with its menu; the rows of the points that are there
        makePanel: (p, row) => {
            const cfg = row.cfg;
            const full = () => rationalCount(cfg) >= RATIONAL_POINTS;
            const head = ParamUiRow({ name: 'points: x, y, exponent', labelWidth: 'auto',
                menu: () => [
                    { label: 'Add a zero', title: 'a point where the map is 0', disabled: full(), action: () => addRationalPoint(row, 1) },
                    { label: 'Add a pole', title: 'a point where the map is infinite', disabled: full(), action: () => addRationalPoint(row, -1) },
                ],
                menuTooltip: `add a point (at most ${RATIONAL_POINTS})` });
            const panel = { id: p.id, enabled: p.enabled, points: head };
            row.pointRows = [];
            for (let i = 1; i <= RATIONAL_POINTS; i++) {
                const line = ParamUiRow({ name: String(i), labelWidth: '1em', visible: i <= rationalCount(cfg),
                    menu: () => [
                        { label: 'Zero ↔ pole', title: 'the exponent with the other sign', action: () => row.set({ ['n' + i]: -cfg['n' + i] || 1 }) },
                        { label: 'Delete', title: 'take the point out', disabled: rationalCount(cfg) <= 1, action: () => removeRationalPoint(row, i) },
                    ],
                    menuTooltip: `the point ${i}` });
                row.pointRows.push(line);
                panel['point' + i] = line;
                panel['x' + i] = line.contain(p['x' + i], { tooltip: 'x of the point' });
                panel['y' + i] = line.contain(p['y' + i], { tooltip: 'y of the point' });
                panel['n' + i] = line.contain(p['n' + i], { tooltip: 'its exponent: above 0 a zero, below 0 a pole; from -3 to 3, a whole number' });
            }
            return panel;
        },
        // the panel shows the rows of the points that are there
        onChanged: (row) => {
            if (!row.pointRows) return;
            const count = rationalCount(row.cfg);
            row.pointRows.forEach((line, k) => { if (line.isVisible() !== (k < count)) line.setVisible(k < count); });
        },
        getSteps: (cfg) => {
            const points = [];
            for (let i = 1; i <= rationalCount(cfg); i++) points.push([cfg['x' + i], cfg['y' + i], cfg['n' + i]]);
            return [rationalStep(points)];
        },
        getHandles: rationalHandles,
        // row.addPoint(1 | -1) a zero or a pole after the others, row.removePoint(i) (from 1),
        // row.getPointCount(): as the panel's menus do them, each one change of the list
        commands: (row) => ({
            addPoint:      (sign = 1) => addRationalPoint(row, sign < 0 ? -1 : 1),
            removePoint:   (i) => removeRationalPoint(row, i),
            getPointCount: () => rationalCount(row.cfg),
        }),
    }, par);
}
