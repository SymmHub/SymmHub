import {
    ParamGroup,
    ParamBool,
    ParamFloat,
    ParamColor,
    hexToPremult,
} from '../modules.js';
import { makeOverlayItem } from './OverlayItem.js';

const MYNAME = 'OverlayGenerators';

//
//  generators: the pairing sides of the fundamental domain, with a shadow
//
export function OverlayGenerators(par = {}) {

    return makeOverlayItem({
        className: MYNAME,
        program:   'overlayGenerators',
        defaults: {
            width: 2,
            color: '#0000AAAA',
            shadow: {
                enabled: true,
                width:   10,
                color:   '#0000AA55',
            },
        },
        makeParams: (cfg, oc) => ({
            width:  ParamFloat({ obj: cfg, key: 'width', onChange: oc }),
            color:  ParamColor({ obj: cfg, key: 'color', onChange: oc }),
            shadow: ParamGroup({
                name: 'shadow',
                params: {
                    enabled: ParamBool({ obj: cfg.shadow, key: 'enabled', onChange: oc }),
                    color:   ParamColor({ obj: cfg.shadow, key: 'color', onChange: oc }),
                    width:   ParamFloat({ obj: cfg.shadow, key: 'width', onChange: oc }),
                }
            }),
        }),
        getUniforms: (cfg) => ({
            uGensWidth:          cfg.width,
            uGensColor:          hexToPremult(cfg.color),
            uGensShadowsEnabled: cfg.shadow.enabled,
            uGensShadowsColor:   hexToPremult(cfg.shadow.color),
            uGensShadowsWidth:   cfg.shadow.width,
        }),
    }, par);
}
