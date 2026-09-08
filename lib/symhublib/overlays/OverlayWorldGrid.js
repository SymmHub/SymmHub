import {
    ParamFloat,
    ParamInt,
    ParamColor,
    ParamChoice,
    hexToPremult,
    VisualizationOptions,
} from '../modules.js';
import { makeOverlayItem } from './OverlayItem.js';

const MYNAME = 'OverlayWorldGrid';

//
//  cartesian or polar grid in world space
//
export function OverlayWorldGrid(par = {}) {

    const gridTypeNames  = VisualizationOptions.gridTypeNames;
    const gridTypeValues = VisualizationOptions.gridTypeValues;

    return makeOverlayItem({
        className: MYNAME,
        program:   'overlayWorldGrid',
        defaults: {
            type:    gridTypeNames[0],
            color:   '#000000ff',
            width:   1,
            levels:  1,
            stepx:   0.1,
            stepy:   0.1,
            offsetx: 0,
            offsety: 0,
        },
        makeParams: (cfg, oc) => ({
            type:    ParamChoice({ obj: cfg, key: 'type', choice: gridTypeNames, onChange: oc }),
            stepx:   ParamFloat({ obj: cfg, key: 'stepx',   onChange: oc }),
            stepy:   ParamFloat({ obj: cfg, key: 'stepy',   onChange: oc }),
            offsetx: ParamFloat({ obj: cfg, key: 'offsetx', onChange: oc }),
            offsety: ParamFloat({ obj: cfg, key: 'offsety', onChange: oc }),
            levels:  ParamInt({ obj: cfg, key: 'levels',    onChange: oc }),
            color:   ParamColor({ obj: cfg, key: 'color',   onChange: oc }),
            width:   ParamFloat({ obj: cfg, key: 'width',   onChange: oc }),
        }),
        getUniforms: (cfg) => ({
            uWorldGridType:   gridTypeValues[cfg.type],
            uWorldGridColor:  hexToPremult(cfg.color),
            uWorldGridStep:   [cfg.stepx, cfg.stepy],
            uWorldGridOffset: [cfg.offsetx, cfg.offsety],
            uWorldGridLevels: cfg.levels,
            uWorldGridWidth:  cfg.width,
        }),
    }, par);
}
