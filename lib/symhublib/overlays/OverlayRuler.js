import {
    ParamFloat,
    ParamColor,
} from '../modules.js';
import { makeOverlayItem } from './OverlayItem.js';

const MYNAME = 'OverlayRuler';

//
//  ruler: a placeholder which keeps the ruler settings of old documents.
//  The ruler is still drawn by SymRenderer.onDrawGridAndRuler() on the 2D
//  canvas (misc.options.showRuler); this item draws nothing until the ruler
//  moves into WebGL.
//
export function OverlayRuler(par = {}) {

    return makeOverlayItem({
        className: MYNAME,
        program:   null,
        defaults: {
            color:      '#000000ff',
            background: '#AAAAAAAA',
            width:      20,
        },
        makeParams: (cfg, oc) => ({
            color:      ParamColor({ obj: cfg, key: 'color',      onChange: oc }),
            background: ParamColor({ obj: cfg, key: 'background', onChange: oc }),
            width:      ParamFloat({ obj: cfg, key: 'width',      onChange: oc }),
        }),
    }, par);
}
