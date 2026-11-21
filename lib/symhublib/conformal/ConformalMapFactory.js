/*
  ConformalMapFactory.js — the kinds of rows of the list of conformal
  transformations and their ObjectFactory (ProjectionTransform.js;
  docs/conformal_transforms_plan.md, outside the repository).

  ConformalMapKinds lists every kind with its serialization name (the class
  name in the files), the label of the "+" menu, the base of the ids given to
  new rows ('band', 'band2', ...) and the key the kind had as a fixed map of
  ProjectionTransform (documents saved before the list, see
  upgradeProjectionValue there; null for a kind added since). They are listed
  in the order the fixed maps acted in, from the pattern to the screen, then
  the kinds added since.
*/

import {
    ObjectFactory,
    FixedPointsTransform,
    ConformalBand,
    ConformalPeriodic,
    ConformalScale,
    ConformalLox,
    ConformalExp,
    ConformalUhp,
    ConformalRational,
    ConformalPower,
} from '../modules.js';

const MYNAME = 'ConformalMapFactory';

export const ConformalMapKinds = [
    { name: 'FixedPointTransform', label: 'fixed points',     baseId: 'fixedPoints', oldKey: 'fpdMap',
      ctor: (par) => new FixedPointsTransform(par) },
    { name: 'ConformalBand',       label: 'band',             baseId: 'band',        oldKey: 'bandMap',     ctor: ConformalBand },
    { name: 'ConformalPeriodic',   label: 'periodic',         baseId: 'periodic',    oldKey: 'periodicMap', ctor: ConformalPeriodic },
    { name: 'ConformalScale',      label: 'scale',            baseId: 'scale',       oldKey: 'scaleMap',    ctor: ConformalScale },
    { name: 'ConformalLox',        label: 'loxodromic',       baseId: 'loxodromic',  oldKey: 'loxMap',      ctor: ConformalLox },
    { name: 'ConformalExp',        label: 'exponent',         baseId: 'exponent',    oldKey: 'expMap',      ctor: ConformalExp },
    { name: 'ConformalUhp',        label: 'upper half plane', baseId: 'uhp',         oldKey: 'uhpMap',      ctor: ConformalUhp },
    { name: 'ConformalRational',   label: 'rational',         baseId: 'rational',    oldKey: 'rationalMap', ctor: ConformalRational },
    // the kinds added after the list (no fixed map of the old documents had them)
    { name: 'ConformalPower',      label: 'power',            baseId: 'power',       oldKey: null,          ctor: ConformalPower },
];

/** the kind entry of a class name, null when unknown */
export function getConformalMapKind(className) {
    return ConformalMapKinds.find(k => k.name === className) || null;
}

/** the next unused id for a base: 'band', 'band2', 'band3', ... */
function uniqueId(baseId, existingIds) {
    if (!existingIds.includes(baseId)) return baseId;
    let n = 2;
    while (existingIds.includes(baseId + n)) n++;
    return baseId + n;
}

/**
 * Create a row of a kind by class name, without a factory (tests).
 * @param {string} className
 * @param {object} par  {id, config, groupMaker, onChange}
 */
export function createConformalMap(className, par = {}) {
    const kind = getConformalMapKind(className);
    if (!kind) {
        console.warn(`${MYNAME}.createConformalMap(): unknown class ${className}`);
        return null;
    }
    const row = kind.ctor({ id: par.id ?? kind.baseId, ...par });
    if (row.init) row.init(par);
    return row;
}

/**
 * ObjectFactory of the kinds, for the ParamObjArray of the list.
 *
 * @param {Function} getInitPar   () => what a row's init() gets: {onChange, own, onFrame, groupMaker}
 * @param {Function} getChildren  () => the live rows, for unique ids
 */
export function ConformalMapFactory(getInitPar, getChildren) {

    function make(kind) {
        return () => {
            const existing = getChildren().map(c => c.getId()).filter(Boolean);
            const ip = getInitPar ? getInitPar() : null;
            const row = kind.ctor({ id: uniqueId(kind.baseId, existing), ...(ip || {}) });
            if (ip && row.init) row.init(ip);
            return row;
        };
    }

    return ObjectFactory({
        defaultName: 'ConformalBand',
        infoArray: ConformalMapKinds.map(k => ({ name: k.name, label: k.label, creator: make(k) })),
    });
}
