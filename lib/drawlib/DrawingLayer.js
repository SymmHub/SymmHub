import {
    ParamBool,
    ParamCustom,
    getCurrentDocument,
    BinaryLoader,
    dataURLToBytes,
    bytesToDataURL,
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

//
//  an image item's bytes go into the document's binary sidecar when one is
//  being written (the data URL is replaced by the chunk's sentinel), and
//  come back as a data URL when one is read; without a sidecar the data URL
//  stays in the JSON
//
function withImagesStored(item){
    const store = getCurrentDocument()?.getBinaryStore();
    if (store && item.type === 'image' && typeof item.src === 'string' && item.src.startsWith('data:')) {
        const { bytes, type } = dataURLToBytes(item.src);
        item.src = store.register(store.getChunkName('image_' + item.id), type, bytes, {});
    }
    if (item.children) item.children = item.children.map(withImagesStored);
    return item;
}

function withImagesLoaded(item){
    const loader = getCurrentDocument()?.getBinaryLoader();
    if (loader && item.type === 'image' && BinaryLoader.isChunkSentinel(item.src)) {
        const ref = loader.getChunkRef(BinaryLoader.chunkName(item.src));
        item.src = (ref && ref.isValid()) ? bytesToDataURL(ref.asUint8Array(), ref.type || 'image/png') : null;
    }
    if (item.children) item.children = item.children.map(withImagesLoaded);
    return item;
}

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
            getValue: () => mItems.map(it => withImagesStored(JSON.parse(JSON.stringify(it)))),
            setValue: (v) => { mItems = Array.isArray(v) ? v.map(it => withImagesLoaded(JSON.parse(JSON.stringify(it)))) : []; changed(); },
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
