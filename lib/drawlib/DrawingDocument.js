import {
    ObjArray,
    ObjectFactory,
    DrawingLayer,
} from './modules.js';

//
//  DrawingDocument - a vector drawing in world coordinates
//
//  The drawing is a list of layers (DrawingLayer, kept in an ObjArray so the
//  layers list of the settings edits it), each a list of items, bottom to
//  top. Items follow SVG; for now 'polyline' only,
//
//    { type: 'polyline', id: 'p7', closed: false,
//      points: [x0, y0, x1, y1, ...],          world coordinates
//      style: { stroke: {rgba: [r, g, b, a]},  or null
//               strokeWidth: 0.02,             world units where drawn
//               lineCap: 'round', lineJoin: 'round',
//               fill: null,                    or {rgba: [...]}, for closed items
//               opacity: 1 } }
//
//  An item stays where it was drawn: group changes and moves of the pattern
//  box never change the document. Item ids are unique in the document.
//  The item operations (insertItem, removeItem, updateItem) are what the
//  editor's undo stack replays; every change is reported to the listeners.
//

const FORMAT_VERSION = 1;

const DEFAULT_STYLE = {
    stroke:      { rgba: [0.8, 0.1, 0.1, 1] },
    strokeWidth: 0.02,
    lineCap:     'round',
    lineJoin:    'round',
    fill:        null,
    opacity:     1,
};

function normalizeItem(item){
    return {
        type:   item.type || 'polyline',
        id:     item.id,
        closed: !!item.closed,
        points: Array.from(item.points || []),
        style:  { ...DEFAULT_STYLE, ...(item.style || {}) },
    };
}

function DrawingDocument(options = {}) {

    let mVersion = 0;
    let mNextId = 1;
    const mListeners = [];

    const mLayers = ObjArray({ id: 'layers', children: [makeLayer({ id: 'layer1' })] });
    // the layer new items go into (an id; the top layer when it is gone)
    let mActiveLayerId = 'layer1';

    function makeLayer(par){
        return DrawingLayer({ ...par, onChange: changed });
    }

    // makes the layers the "+" and "Duplicate" of the layers list add
    const mLayerFactory = ObjectFactory({
        defaultName: 'DrawingLayer',
        infoArray: [{ name: 'DrawingLayer', label: 'layer', creator: () => makeLayer({ id: freeLayerId() }) }],
    });

    if (options.items) options.items.forEach(item => insertItem(item));
    mVersion = 0;

    function changed(){
        ensureUniqueIds();
        mVersion++;
        mListeners.forEach(cb => cb());
    }

    // a layer duplicated in the layers list copies its items with their ids
    function ensureUniqueIds(){
        const seen = new Set();
        for (const layer of getLayers()) {
            for (const it of layer.getItems()) {
                if (!it.id || seen.has(it.id)) {
                    let id;
                    do { id = 'p' + (mNextId++); } while (seen.has(id) || getAllItems().some(o => o !== it && o.id === id));
                    it.id = id;
                }
                seen.add(it.id);
            }
        }
    }

    function freeLayerId(){
        const used = new Set(getLayers().map(l => l.getId()));
        let n = 1;
        while (used.has('layer' + n)) n++;
        return 'layer' + n;
    }

    function getLayers(){
        return mLayers.getChildren();
    }

    function getLayer(id){
        return getLayers().find(l => l.getId() === id) || null;
    }

    /** the layer new items go into: the chosen one, else the top one */
    function getActiveLayer(){
        const layers = getLayers();
        return getLayer(mActiveLayerId) || layers[layers.length - 1] || null;
    }

    function setActiveLayer(id){
        mActiveLayerId = id;
    }

    function getAllItems(){
        return getLayers().flatMap(layer => layer.getItems());
    }

    /** the items of the visible layers, bottom to top, each with its layer's opacity applied */
    function getItems(){
        return getLayers().filter(l => l.isVisible()).flatMap(layer => {
            const a = layer.getOpacity();
            if (a >= 1) return layer.getItems();
            return layer.getItems().map(it => ({ ...it, style: { ...it.style, opacity: (it.style.opacity ?? 1)*a } }));
        });
    }

    /** the items that can be picked and edited: visible and not locked */
    function getEditableItems(){
        return getLayers().filter(l => l.isVisible() && !l.isLocked()).flatMap(layer => layer.getItems());
    }

    function nextId(){
        const used = new Set(getAllItems().map(it => it.id));
        let id;
        do { id = 'p' + (mNextId++); } while (used.has(id));
        return id;
    }

    /** {layer, index} of the item with the id, or null */
    function findItem(id){
        for (const layer of getLayers()) {
            const index = layer.getItems().findIndex(it => it.id === id);
            if (index >= 0) return { layer, index };
        }
        return null;
    }

    function getItem(id){
        const at = findItem(id);
        return at ? at.layer.getItems()[at.index] : null;
    }

    /**
     * add an item (a copy, the default style filled in, an id when it has
     * none or a taken one) to a layer at an index (default: the active layer,
     * on top); returns the added item
     */
    function insertItem(item, layerId = null, index = null){
        const it = normalizeItem(item);
        if (!it.id || getItem(it.id)) it.id = nextId();
        const layer = (layerId && getLayer(layerId)) || getActiveLayer();
        const items = layer.getItems();
        const i = (index === null || index === undefined) ? items.length : Math.max(0, Math.min(index, items.length));
        items.splice(i, 0, it);
        changed();
        return it;
    }

    /** add an item on top of the active layer */
    function addItem(item){
        return insertItem(item);
    }

    /** remove an item; returns {item, layerId, index} to insert it back, or null */
    function removeItem(id){
        const at = findItem(id);
        if (!at) return null;
        const [item] = at.layer.getItems().splice(at.index, 1);
        changed();
        return { item, layerId: at.layer.getId(), index: at.index };
    }

    /** replace the content of an item, keeping its id and place */
    function updateItem(id, newItem){
        const at = findItem(id);
        if (!at) return null;
        const it = normalizeItem({ ...newItem, id });
        at.layer.getItems()[at.index] = it;
        changed();
        return it;
    }

    function clear(){
        getLayers().forEach(layer => layer.setItems([]));
        changed();
    }

    function toJSON(){
        return {
            version: FORMAT_VERSION,
            layers:  getLayers().map(layer => ({
                id:      layer.getId(),
                visible: layer.isVisible(),
                locked:  layer.isLocked(),
                opacity: layer.getOpacity(),
                items:   layer.getItems().map(it => JSON.parse(JSON.stringify(it))),
            })),
        };
    }

    /** replace everything by a toJSON() value */
    function fromJSON(json){
        if (!json || !Array.isArray(json.layers)) return;
        while (getLayers().length) mLayers.removeChild(0);
        json.layers.forEach((l, i) => mLayers.addChild(makeLayer({
            id:      l.id || ('layer' + (i + 1)),
            enabled: l.visible !== false,
            locked:  !!l.locked,
            opacity: l.opacity ?? 1,
            items:   (l.items || []).map(normalizeItem),
        })));
        if (!getLayers().length) mLayers.addChild(makeLayer({ id: 'layer1' }));
        changed();
    }

    return {
        // layers
        getLayersArray:   () => mLayers,
        getLayerFactory:  () => mLayerFactory,
        getLayers,
        getLayer,
        getActiveLayer,
        setActiveLayer,
        // items
        getItems,
        getEditableItems,
        getAllItems,
        getItem,
        findItem,
        addItem,
        insertItem,
        removeItem,
        updateItem,
        clear,
        // all of it
        toJSON,
        fromJSON,
        layersChanged:   changed,
        getVersion:      () => mVersion,
        onChange:        (cb) => { mListeners.push(cb); },
        getDefaultStyle: () => JSON.parse(JSON.stringify(DEFAULT_STYLE)),
    };

} // function DrawingDocument()

export { DrawingDocument };
