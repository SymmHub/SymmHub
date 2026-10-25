import {
    ParamBool,
    ParamCustom,
    ParamFloat,
    ParamString,
} from './modules.js';

//
//  DrawingLayer - one layer of a DrawingDocument, an item of the layers list
//  (ObjArray / ParamObjArray: its title row holds the 'enabled' checkbox,
//  which is the layer's visibility, and the list's menu renames, moves,
//  duplicates and deletes it)
//
//  config: { id, enabled (visible), locked, opacity }
//  items:  plain JSON items in world coordinates (see DrawingDocument)
//

const MYNAME = 'DrawingLayer';

function DrawingLayer(par = {}) {

    const mConfig = {
        id:      par.id || 'layer1',
        enabled: par.enabled !== false,
        locked:  !!par.locked,
        opacity: (par.opacity !== undefined) ? par.opacity : 1,
    };
    let mItems = (par.items || []).map(it => JSON.parse(JSON.stringify(it)));
    let mOnChange = par.onChange || null;
    let mOnIdChange = null;

    function changed(){
        if (mOnChange) mOnChange();
    }

    const mParams = {
        id:      ParamString({obj: mConfig, key: 'id', onChange: () => { if (mOnIdChange) mOnIdChange(); changed(); }}),
        enabled: ParamBool  ({obj: mConfig, key: 'enabled', name: 'visible', onChange: changed}),
        locked:  ParamBool  ({obj: mConfig, key: 'locked', onChange: changed}),
        opacity: ParamFloat ({obj: mConfig, key: 'opacity', min: 0, max: 1, step: 0.01, onChange: changed}),
        items:   ParamCustom({
            getValue: () => mItems.map(it => JSON.parse(JSON.stringify(it))),
            setValue: (v) => { mItems = Array.isArray(v) ? v.map(it => JSON.parse(JSON.stringify(it))) : []; changed(); },
        }),
    };

    return {
        getClassName:  () => MYNAME,
        getId:         () => mConfig.id,
        setId:         (id) => { mConfig.id = id; mParams.id.updateDisplay?.(); if (mOnIdChange) mOnIdChange(); },
        setOnIdChange: (cb) => { mOnIdChange = cb; },
        setOnChange:   (cb) => { mOnChange = cb; },
        getParams:     () => mParams,
        isVisible:     () => mConfig.enabled,
        isLocked:      () => mConfig.locked,
        getOpacity:    () => mConfig.opacity,
        // the item list itself; DrawingDocument changes it and reports the change
        getItems:      () => mItems,
        setItems:      (items) => { mItems = items; },
    };

} // function DrawingLayer()

export { DrawingLayer };
