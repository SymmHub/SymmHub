import {
    ParamGroup,
    ParamBool,
    ParamFloat,
    ParamColor,
    hexToPremult,
} from '../modules.js';
import { makeOverlayItem } from './OverlayItem.js';

const MYNAME = 'OverlayBuffer';

//
//  the box of the pattern buffer: fill and outline
//
export function OverlayBuffer(par = {}) {

    return makeOverlayItem({
        className: MYNAME,
        program:   'overlayBuffer',
        defaults: {
            fill: {
                enabled: false,
                color:   '#00FF0022',
            },
            outline: {
                enabled: true,
                width:   1,
                color:   '#00AA00AA',
            },
        },
        makeParams: (cfg, oc) => ({
            fill: ParamGroup({
                name: 'fill',
                params: {
                    enabled: ParamBool({ obj: cfg.fill, key: 'enabled', onChange: oc }),
                    color:   ParamColor({ obj: cfg.fill, key: 'color', onChange: oc }),
                }
            }),
            outline: ParamGroup({
                name: 'outline',
                params: {
                    enabled: ParamBool({ obj: cfg.outline, key: 'enabled', onChange: oc }),
                    width:   ParamFloat({ obj: cfg.outline, key: 'width', onChange: oc }),
                    color:   ParamColor({ obj: cfg.outline, key: 'color', onChange: oc }),
                }
            }),
        }),
        getUniforms: (cfg) => ({
            uBufFillEnabled:    cfg.fill.enabled,
            uBufOutlineEnabled: cfg.outline.enabled,
            uBufFillColor:      hexToPremult(cfg.fill.color),
            uBufOutlineColor:   hexToPremult(cfg.outline.color),
            uBufOutlineWidth:   cfg.outline.width,
        }),
    }, par);
}
