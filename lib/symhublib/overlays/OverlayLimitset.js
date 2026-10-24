import {
    ParamFloat,
    ParamColor,
    hexToPremult,
    makeOverlayItem,
} from '../modules.js';

const MYNAME = 'OverlayLimitset';

//
//  limit set: the limit circle of a hyperbolic group
//
export function OverlayLimitset(par = {}) {

    return makeOverlayItem({
        className: MYNAME,
        program:   'overlayLimitset',
        symmetry:  true,
        defaults: {
            color: '#000000ff',
            width: 1,
        },
        makeParams: (cfg, oc) => ({
            color: ParamColor({ obj: cfg, key: 'color', onChange: oc }),
            width: ParamFloat({ obj: cfg, key: 'width', onChange: oc }),
        }),
        getUniforms: (cfg) => ({
            uLsThickness: cfg.width,
            uLsColor:     hexToPremult(cfg.color),
        }),
    }, par);
}
