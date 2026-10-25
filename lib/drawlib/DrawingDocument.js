//
//  DrawingDocument - a vector drawing in world coordinates
//
//  The drawing is a list of layers, each a list of items. Items follow SVG:
//  for now 'polyline' only,
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
//  box never change the document. Listeners hear every change.
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

function makeLayer(id){
    return { id, visible: true, items: [] };
}

function DrawingDocument(options = {}) {

    let mLayers = [makeLayer('layer1')];
    let mNextId = 1;
    let mVersion = 0;
    const mListeners = [];

    if (options.items) options.items.forEach(item => addItem(item));
    mVersion = 0;

    function changed(){
        mVersion++;
        mListeners.forEach(cb => cb());
    }

    function nextId(){
        const used = new Set(getAllItems().map(it => it.id));
        let id;
        do { id = 'p' + (mNextId++); } while (used.has(id));
        return id;
    }

    function getAllItems(){
        return mLayers.flatMap(layer => layer.items);
    }

    /** the items of the visible layers, bottom to top */
    function getItems(){
        return mLayers.filter(layer => layer.visible).flatMap(layer => layer.items);
    }

    /** add an item (a copy, with an id and the default style filled in) to a layer, on top */
    function addItem(item, layerIndex = mLayers.length - 1){
        const it = {
            type:   item.type || 'polyline',
            id:     item.id || nextId(),
            closed: !!item.closed,
            points: Array.from(item.points),
            style:  { ...DEFAULT_STYLE, ...(item.style || {}) },
        };
        mLayers[Math.max(0, Math.min(layerIndex, mLayers.length - 1))].items.push(it);
        changed();
        return it;
    }

    function removeItem(id){
        for (const layer of mLayers) {
            const i = layer.items.findIndex(it => it.id === id);
            if (i >= 0) {
                layer.items.splice(i, 1);
                changed();
                return true;
            }
        }
        return false;
    }

    function clear(){
        mLayers = [makeLayer('layer1')];
        changed();
    }

    function toJSON(){
        return {
            version: FORMAT_VERSION,
            layers:  mLayers.map(layer => ({
                id:      layer.id,
                visible: layer.visible,
                items:   layer.items.map(it => JSON.parse(JSON.stringify(it))),
            })),
        };
    }

    function fromJSON(json){
        if (!json || !Array.isArray(json.layers)) return;
        mLayers = json.layers.map((layer, i) => ({
            id:      layer.id || ('layer' + (i + 1)),
            visible: layer.visible !== false,
            items:   (layer.items || []).map(it => ({
                type:   it.type || 'polyline',
                id:     it.id,
                closed: !!it.closed,
                points: Array.from(it.points || []),
                style:  { ...DEFAULT_STYLE, ...(it.style || {}) },
            })),
        }));
        changed();
    }

    return {
        getItems,
        getAllItems,
        addItem,
        removeItem,
        clear,
        toJSON,
        fromJSON,
        getVersion:  () => mVersion,
        onChange:    (cb) => { mListeners.push(cb); },
        getDefaultStyle: () => ({ ...DEFAULT_STYLE }),
    };

} // function DrawingDocument()

export { DrawingDocument };
