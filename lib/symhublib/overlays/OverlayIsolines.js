import {
    ParamFloat,
    ParamInt,
    ParamColor,
    ParamChoice,
    hexToPremult,
    VisualizationOptions,
} from '../modules.js';
import { makeOverlayItem } from './OverlayItem.js';

const MYNAME = 'OverlayIsolines';

//
//  isolines of one data source of the pattern
//  the data source is serialized under the key 'type' (legacy name)
//
export function OverlayIsolines(par = {}) {

    const DataSourceNames  = VisualizationOptions.dataSourceNames;
    const DataSourceValues = VisualizationOptions.dataSourceValues;

    return makeOverlayItem({
        className: MYNAME,
        program:   'overlayIsolines',
        symmetry:  true,
        defaults: {
            dataSource: DataSourceNames[0],
            step:   0.1,
            offset: 0.,
            width:  1,
            levels: 1,
            color:  '#000000ff',
        },
        makeParams: (cfg, oc) => ({
            type:    ParamChoice({ obj: cfg, key: 'dataSource', choice: DataSourceNames, onChange: oc }),
            step:    ParamFloat({ obj: cfg, key: 'step',   onChange: oc }),
            offset:  ParamFloat({ obj: cfg, key: 'offset', onChange: oc }),
            width:   ParamFloat({ obj: cfg, key: 'width',  min: -1, max: 100, step: 0.1, onChange: oc }),
            levels:  ParamInt({ obj: cfg, key: 'levels',   min: 1, max: 6, onChange: oc }),
            color:   ParamColor({ obj: cfg, key: 'color',  onChange: oc }),
        }),
        getUniforms: (cfg) => ({
            uIsoDataSource: DataSourceValues[cfg.dataSource],
            uIsoColor:      hexToPremult(cfg.color),
            uIsoStep:       cfg.step,
            uIsoOffset:     cfg.offset,
            uIsoThickness:  cfg.width,
            uIsoLevels:     cfg.levels,
        }),
    }, par);
}
