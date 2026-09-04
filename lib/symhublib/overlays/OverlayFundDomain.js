import {
    ParamGroup,
    ParamBool,
    ParamFloat,
    ParamColor,
    hexToPremult,
} from '../modules.js';
import { makeOverlayItem } from './OverlayItem.js';

const MYNAME = 'OverlayFundDomain';

//
//  fundamental domain: fill, outline and outline shadow
//
export function OverlayFundDomain(par = {}) {

    return makeOverlayItem({
        className: MYNAME,
        program:   'overlayFundDomain',
        defaults: {
            fill: {
                enabled: false,
                color:   '#FF0000AA',
            },
            outline: {
                enabled:      true,
                width:        1,
                color:        '#000000AA',
                shadowsWidth: 10,
                shadowsColor: '#0000FFAA',
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
                    enabled:      ParamBool({ obj: cfg.outline, key: 'enabled', onChange: oc }),
                    width:        ParamFloat({ obj: cfg.outline, key: 'width', onChange: oc }),
                    color:        ParamColor({ obj: cfg.outline, key: 'color', onChange: oc }),
                    shadowsWidth: ParamFloat({ obj: cfg.outline, key: 'shadowsWidth', onChange: oc }),
                    shadowsColor: ParamColor({ obj: cfg.outline, key: 'shadowsColor', onChange: oc }),
                }
            }),
        }),
        getUniforms: (cfg) => ({
            uFDfillEnabled:         cfg.fill.enabled,
            uFDfillColor:           hexToPremult(cfg.fill.color),
            uFDoutlineEnabled:      cfg.outline.enabled,
            uFDoutlineWidth:        cfg.outline.width,
            uFDoutlineColor:        hexToPremult(cfg.outline.color),
            uFDoutlineShadowsWidth: cfg.outline.shadowsWidth,
            uFDoutlineShadowsColor: hexToPremult(cfg.outline.shadowsColor),
        }),
    }, par);
}
