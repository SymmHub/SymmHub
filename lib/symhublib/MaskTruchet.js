/**
 * MaskTruchet.js
 *
 * Truchet-tile mask shape for MaskWorker.
 *
 * Uses uExtents.x as the half-size of a single tile cell (world [-1,1]).
 * The shader folds neighbouring tiles into the central cell via iSPlane reflections.
 *
 * Parameters:
 *   tileSize  — half-size of a tile cell (world space)
 */

import {
    ParamFloat,
    ParamGroup,
    ParamChoice,
} from './modules.js';

const MYNAME = 'MaskTruchet';

// Ordered list of fold-type names — index matches the uFoldType int sent to the shader.
// '2222'  = p2  (two iSPlane reflections per tile, creates 180° rotation symmetry)
// 'O'     = p1  (pure translation / periodic tiling, no reflections)
// '*2222' = pmm (single axis-aligned mirror per wall)
const FOLD_TYPE_NAMES  = ['2222', 'O', '*2222'];
const TRANS_TYPE_NAMES = ['linear', 'smooth', 'box', 'smoothLinear'];
const AVG_TYPE_NAMES   = ['n', '*n'];  // 'n'=C4 rotation, '*n'=C4v (C4 + reflection)
const DOMAIN_NAMES     = ['square', 'hexagon', 'triangle'];

export function MaskTruchet(options = {}) {

    const mConfig = {
        tileSize:   options.tileSize   ?? 0.5,   // half-size in world [-1,1]
        transition: options.transition ?? 0.01,  // blend-zone width at central tile border
        foldType:   options.foldType   ?? '2222', // fold symmetry type
        transType:  options.transType  ?? 'linear',
        avgType:    options.avgType    ?? 'n',
        domain:     options.domain     ?? 'square',
    };

    let mParams = null;

    // ── shape interface ───────────────────────────────────────────────────────

    /** Returns mask type index 2 = truchet */
    function getMaskType() { return 2; }

    function getShapeUniforms() {
        return {
            uCenter:        [0, 0],                                    // unused by truchet shader
            uExtents:       [mConfig.tileSize, mConfig.tileSize],
            uRadius:        0,                                         // unused
            uTransition:    mConfig.transition,
            uFoldType:      FOLD_TYPE_NAMES.indexOf(mConfig.foldType), // 0='2222', 1='O', 2='*2222'
            uTransType:     TRANS_TYPE_NAMES.indexOf(mConfig.transType),
            uAvgType:       AVG_TYPE_NAMES.indexOf(mConfig.avgType),
            uTruchetDomain: DOMAIN_NAMES.indexOf(mConfig.domain),
        };
    }

    // ── params ────────────────────────────────────────────────────────────────

    function makeParams() {
        const c = mConfig;
        return ParamGroup({
            name: 'truchet',
            params: {
                domain:     ParamChoice({ obj: c, key: 'domain',     choice: DOMAIN_NAMES,     name: 'domain'     }),
                foldType:   ParamChoice({ obj: c, key: 'foldType',   choice: FOLD_TYPE_NAMES,  name: 'fold type'  }),
                tileSize:   ParamFloat({  obj: c, key: 'tileSize',   min: 0.01, max: 2,   step: 0.001,  name: 'tile size'  }),
                transition: ParamFloat({  obj: c, key: 'transition', min: 0,    max: 1,   step: 0.0001, name: 'transition' }),
                transType:  ParamChoice({ obj: c, key: 'transType',  choice: TRANS_TYPE_NAMES, name: 'trans type' }),
                avgType:    ParamChoice({ obj: c, key: 'avgType',    choice: AVG_TYPE_NAMES,   name: 'avg type'   }),
            },
        });
    }

    function getParams() {
        if (!mParams) mParams = makeParams();
        return mParams;
    }

    // ── serialisation ─────────────────────────────────────────────────────────

    function getClassName() { return MYNAME; }
    function getName()      { return MYNAME; }

    // ── public API ────────────────────────────────────────────────────────────

    return {
        getMaskType,
        getShapeUniforms,
        getParams,
        getName,
        getClassName,
    };

} // MaskTruchet
