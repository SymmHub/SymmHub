import {
    ParamBool,
    ParamCustom,
    getCurrentDocument,
    BinaryLoader,
    dataURLToBytes,
    bytesToDataURL,
    withImagesFramed,
    savedItem,
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
//  being written (the data URL is replaced by the chunk's sentinel), once
//  however many items show the image, and come back as a data URL when one
//  is read; without a sidecar the data URL stays in the JSON
//
// a sidecar being written -> Map data URL -> its chunk's sentinel
const mStored = new WeakMap();
// a sidecar being read -> Map chunk name -> its data URL
const mLoaded = new WeakMap();

function onceFor(cache, owner, key, make){
    if (!cache.has(owner)) cache.set(owner, new Map());
    const known = cache.get(owner);
    if (!known.has(key)) known.set(key, make());
    return known.get(key);
}

function withImagesStored(item){
    const store = getCurrentDocument()?.getBinaryStore();
    if (store && item.type === 'image' && typeof item.src === 'string' && item.src.startsWith('data:')) {
        item.src = onceFor(mStored, store, item.src, () => {
            const { bytes, type } = dataURLToBytes(item.src);
            return store.register(store.getChunkName('image_' + item.id), type, bytes, {});
        });
    }
    if (item.children) item.children = item.children.map(withImagesStored);
    return item;
}

function withImagesLoaded(item){
    const loader = getCurrentDocument()?.getBinaryLoader();
    if (loader && item.type === 'image' && BinaryLoader.isChunkSentinel(item.src)) {
        const name = BinaryLoader.chunkName(item.src);
        item.src = onceFor(mLoaded, loader, name, () => {
            const ref = loader.getChunkRef(name);
            return (ref && ref.isValid()) ? bytesToDataURL(ref.asUint8Array(), ref.type || 'image/png') : null;
        });
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
    let mItems = (par.items || []).map(it => withImagesFramed(JSON.parse(JSON.stringify(it))));
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
            // as saved: without the outlines of the geodesic paths, which the document makes again
            getValue: () => mItems.map(it => withImagesStored(savedItem(it))),
            setValue: (v) => { mItems = Array.isArray(v) ? v.map(it => withImagesFramed(withImagesLoaded(JSON.parse(JSON.stringify(it))))) : []; changed(); },
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
        // set from the layers window, as from the layer's controls
        setVisible:    (v) => { mConfig.enabled = !!v; mParams.enabled.updateDisplay?.(); changed(); },
        setLocked:     (v) => { mConfig.locked = !!v; mParams.locked.updateDisplay?.(); changed(); },
        setOpacity:    (v) => { mConfig.opacity = v; mParams.opacity.updateDisplay?.(); changed(); },
        // the item list itself; DrawingDocument changes it and reports the change
        getItems:      () => mItems,
        setItems:      (items) => { mItems = items; },
    };

} // function DrawingLayer()

export { DrawingLayer };
