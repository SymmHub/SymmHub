import {
    ParamBool,
    ParamFloat,
    ParamColor,
    hexToPremult,
    getRulerStep,
} from '../modules.js';
import { makeOverlayItem } from './OverlayItem.js';

const MYNAME = 'OverlayScreenGrid';
const DEBUG = false;

//
//  grid in screen space; with stepAuto the step follows the zoom like the ruler does
//
export function OverlayScreenGrid(par = {}) {

    return makeOverlayItem({
        className: MYNAME,
        program:   'overlayScreenGrid',
        defaults: {
            stepAuto: true,
            color:    '#000000ff',
            width:    1,
            levels:   1,
            step:     0.1,
        },
        makeParams: (cfg, oc) => ({
            step:     ParamFloat({ obj: cfg, key: 'step',     onChange: oc }),
            stepAuto: ParamBool({ obj: cfg, key: 'stepAuto',  onChange: oc }),
            color:    ParamColor({ obj: cfg, key: 'color',    onChange: oc }),
            width:    ParamFloat({ obj: cfg, key: 'width',    onChange: oc }),
        }),
        getUniforms: (cfg, renderPar, ctx) => {
            if (cfg.stepAuto && renderPar.navigator) {
                const pixelSize = renderPar.navigator.canvasTransform.getPixelSize();
                const step = getRulerStep(pixelSize);
                if (DEBUG) console.log(`${MYNAME} pixelSize: ${pixelSize} step: ${step}`);
                if (step != cfg.step) {
                    cfg.step = step;
                    if (ctx.params) ctx.params.step.updateDisplay();
                }
            }
            return {
                uScreenGridColor:  hexToPremult(cfg.color),
                uScreenGridStep:   [cfg.step, cfg.step],
                uScreenGridLevels: cfg.levels,
                uScreenGridWidth:  cfg.width,
            };
        },
    }, par);
}
