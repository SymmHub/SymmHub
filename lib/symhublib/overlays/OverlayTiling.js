import {
    ParamFloat,
    ParamColor,
    hexToPremult,
} from '../modules.js';
import { makeOverlayItem } from './OverlayItem.js';

const MYNAME = 'OverlayTiling';

//
//  edges of the whole tiling (the legacy tiling.outline; tiling.fill was never drawn)
//
export function OverlayTiling(par = {}) {

    return makeOverlayItem({
        className: MYNAME,
        program:   'overlayTiling',
        symmetry:  true,
        defaults: {
            width: 1,
            color: '#000000FF',
        },
        makeParams: (cfg, oc) => ({
            width: ParamFloat({ obj: cfg, key: 'width', onChange: oc }),
            color: ParamColor({ obj: cfg, key: 'color', onChange: oc }),
        }),
        getUniforms: (cfg) => ({
            uTilingWidth: cfg.width,
            uTilingColor: hexToPremult(cfg.color),
        }),
    }, par);
}
