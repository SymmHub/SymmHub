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
//  fundamental domain: fill, outline and outline shadow; with a subgroup
//  symmetry the domain is a union of cells of the renderer's domain, whose
//  interior walls can be drawn too
//
export function OverlayFundDomain(par = {}) {

    return makeOverlayItem({
        className: MYNAME,
        program:   'overlayFundDomain',
        symmetry:  true,
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
            walls: {
                enabled: false,
                width:   1,
                color:   '#00000055',
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
            walls: ParamGroup({
                name: 'walls',
                params: {
                    enabled: ParamBool({ obj: cfg.walls, key: 'enabled', onChange: oc }),
                    width:   ParamFloat({ obj: cfg.walls, key: 'width', onChange: oc }),
                    color:   ParamColor({ obj: cfg.walls, key: 'color', onChange: oc }),
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
            uFDwallsEnabled:        cfg.walls.enabled,
            uFDwallsWidth:          cfg.walls.width,
            uFDwallsColor:          hexToPremult(cfg.walls.color),
        }),
    }, par);
}
