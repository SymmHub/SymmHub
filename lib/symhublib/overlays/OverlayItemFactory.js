/*
  OverlayItemFactory.js — the overlay item kinds and their ObjectFactory.

  OverlayItemKinds lists every kind with its serialization name, the label of
  the "+" menu and the base of the ids given to new items ('tiling',
  'tiling2', ...).
*/

import { ObjectFactory } from '../modules.js';
import { cloneConfig }        from './OverlayItem.js';
import { OverlayFundDomain }  from './OverlayFundDomain.js';
import { OverlayGenerators }  from './OverlayGenerators.js';
import { OverlayTiling }      from './OverlayTiling.js';
import { OverlayIsolines }    from './OverlayIsolines.js';
import { OverlayLimitset }    from './OverlayLimitset.js';
import { OverlayBuffer }      from './OverlayBuffer.js';
import { OverlayWorldGrid }   from './OverlayWorldGrid.js';
import { OverlayScreenGrid }  from './OverlayScreenGrid.js';
import { OverlayRuler }       from './OverlayRuler.js';

const MYNAME = 'OverlayItemFactory';

export const OverlayItemKinds = [
    { name: 'OverlayFundDomain', label: 'fundamental domain', baseId: 'fundDomain', ctor: OverlayFundDomain },
    { name: 'OverlayGenerators', label: 'generators',         baseId: 'generators', ctor: OverlayGenerators },
    { name: 'OverlayTiling',     label: 'tiling',             baseId: 'tiling',     ctor: OverlayTiling     },
    { name: 'OverlayIsolines',   label: 'isolines',           baseId: 'isolines',   ctor: OverlayIsolines   },
    { name: 'OverlayLimitset',   label: 'limit set',          baseId: 'limitset',   ctor: OverlayLimitset   },
    { name: 'OverlayBuffer',     label: 'buffer box',         baseId: 'buffer',     ctor: OverlayBuffer     },
    { name: 'OverlayWorldGrid',  label: 'world grid',         baseId: 'worldGrid',  ctor: OverlayWorldGrid  },
    { name: 'OverlayScreenGrid', label: 'screen grid',        baseId: 'screenGrid', ctor: OverlayScreenGrid },
    { name: 'OverlayRuler',      label: 'ruler',              baseId: 'ruler',      ctor: OverlayRuler      },
];

/** the kind entry of a class name, null when unknown */
export function getOverlayItemKind(className) {
    return OverlayItemKinds.find(k => k.name === className) || null;
}

/** the next unused id for a base: 'tiling', 'tiling2', 'tiling3', ... */
export function makeUniqueId(baseId, existingIds) {
    if (!existingIds.includes(baseId)) return baseId;
    let n = 2;
    while (existingIds.includes(baseId + n)) n++;
    return baseId + n;
}

/**
 * Create an item of a kind by class name, without a factory (default items, upgrade, tests).
 * @param {string} className
 * @param {object} par  {id, config}
 */
export function createOverlayItem(className, par = {}) {
    const kind = getOverlayItemKind(className);
    if (!kind) {
        console.warn(`${MYNAME}.createOverlayItem(): unknown class ${className}`);
        return null;
    }
    return kind.ctor(par);
}

/**
 * ObjectFactory of the overlay item kinds, for the ParamObjArray of the overlay layer.
 *
 * @param {Function} getInitPar   () => the arguments init() of the overlay received (null before init)
 * @param {Function} getChildren  () => the live item list, for unique ids
 * @param {object}   [options]    config: config given to new items (default: enabled)
 */
export function OverlayItemFactory(getInitPar, getChildren, options = {}) {

    const config = options.config ?? { enabled: true };

    function make(kind) {
        return () => {
            const existing = getChildren().map(c => c.getId()).filter(Boolean);
            const id   = makeUniqueId(kind.baseId, existing);
            const item = kind.ctor({ id, config: cloneConfig(config) });
            const ip   = getInitPar ? getInitPar() : null;
            if (ip && ip.glCtx) item.init(ip);
            return item;
        };
    }

    return ObjectFactory({
        defaultName: 'OverlayIsolines',
        infoArray: OverlayItemKinds.map(k => ({ name: k.name, label: k.label, creator: make(k) })),
    });
}
