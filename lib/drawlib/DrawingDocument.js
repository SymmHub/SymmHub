import {
    ObjArray,
    ObjectFactory,
    isShape,
    normalShape,
    shapeGeometry,
    flattenNodes,
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
//               opacity: 1,
//               motifClass: 1 },               optional: shown only in the tiles
//                                             of that colour class (sprites)
//      children: [items],                     optional: items drawn inside a
//                                             closed item, clipped by its
//                                             outline, moved with it
//      pivot: [x, y],                         optional: the pivot of the
//                                             transform box (world), moved
//                                             with the item
//      shape: {kind, cx, cy, rx, ry, angle, round} }  optional (Shapes.js): a
//                                             rect or an ellipse kept by its
//                                             numbers, its outline made from
//                                             them here
//  'path' (Paths.js): cubic Bezier segments between nodes [{p, h1, h2}],
//  points being the outline flattened; 'image' (ImageItems.js): a raster
//  image on a quad, src a data URL; and 'group': children only, drawn as
//  they are (no outline, no clipping), moved and transformed together, its
//  points the corners of the box round them. A closed item with a tile
//  (Tiles.js) has its edges paired by the group.
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

/** the corners of the box round the items, their stroke widths included: [x, y, ...] or [] */
function groupPoints(items){
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const it of items) {
        const half = (it.style && it.style.stroke) ? 0.5*(it.style.strokeWidth || 0) : 0;
        for (let i = 0; i + 1 < it.points.length; i += 2) {
            x0 = Math.min(x0, it.points[i] - half);     x1 = Math.max(x1, it.points[i] + half);
            y0 = Math.min(y0, it.points[i + 1] - half); y1 = Math.max(y1, it.points[i + 1] + half);
        }
    }
    return x0 <= x1 ? [x0, y0, x1, y0, x1, y1, x0, y1] : [];
}

function normalizeItem(item){
    const it = {
        type:   item.type || 'polyline',
        id:     item.id,
        closed: !!item.closed,
        points: Array.from(item.points || []),
        style:  { ...DEFAULT_STYLE, ...(item.style || {}) },
    };
    if (item.src) it.src = item.src;
    if (item.pivot) it.pivot = [item.pivot[0], item.pivot[1]];
    if (item.nodes && item.nodes.length) {
        it.type = 'path';
        it.nodes = item.nodes.map(n => ({ p: [n.p[0], n.p[1]], h1: n.h1 ? [n.h1[0], n.h1[1]] : null, h2: n.h2 ? [n.h2[0], n.h2[1]] : null,
                                          ...(n.smooth ? { smooth: true } : {}) }));
        it.points = flattenNodes(it.nodes, it.closed);
    }
    if (isShape(item.shape)) {
        // a shape's outline comes from its numbers
        it.shape = normalShape(item.shape);
        const g = shapeGeometry(it.shape);
        it.closed = true;
        if (g.nodes) { it.type = 'path'; it.nodes = g.nodes; it.points = flattenNodes(g.nodes, true); }
        else { it.type = 'polyline'; delete it.nodes; it.points = g.points; }
    }
    if (item.tile) it.tile = JSON.parse(JSON.stringify(item.tile));
    if (item.children && item.children.length) it.children = item.children.map(normalizeItem);
    if (it.type === 'group') {
        // nothing of its own: no outline, the box round its children
        it.closed = false;
        it.style = { stroke: null, fill: null, opacity: (item.style && item.style.opacity) ?? 1 };
        it.points = groupPoints(it.children || []);
    }
    return it;
}

function DrawingDocument(options = {}) {

    let mVersion = 0;
    let mNextId = 1;
    const mListeners = [];
    // what a layer shows changes with its own count (its items and settings
    // changed) or with mAllVersion (the whole document changed)
    const mLayerVersions = new WeakMap();
    let mAllVersion = 0;

    const mLayers = ObjArray({ id: 'layers', children: [makeLayer({ id: 'layer1' })] });
    // the layer new items go into (an id; the top layer when it is gone)
    let mActiveLayerId = 'layer1';

    function makeLayer(par){
        const layer = DrawingLayer({ ...par, onChange: () => changed(layer) });
        return layer;
    }

    // makes the layers the "+" and "Duplicate" of the layers list add
    const mLayerFactory = ObjectFactory({
        defaultName: 'DrawingLayer',
        infoArray: [{ name: 'DrawingLayer', label: 'layer', creator: () => makeLayer({ id: freeLayerId() }) }],
    });

    if (options.items) options.items.forEach(item => insertItem(item));
    mVersion = 0;

    /** something changed: in that layer only, or anywhere when no layer is given */
    function changed(layer = null){
        ensureUniqueIds();
        mVersion++;
        if (layer) mLayerVersions.set(layer, (mLayerVersions.get(layer) || 0) + 1);
        else mAllVersion++;
        mListeners.forEach(cb => cb());
    }

    /** a key that changes when what the layer with the id shows changes; null for an unknown id */
    function getLayerVersion(id){
        const layer = getLayer(id);
        return layer ? mAllVersion + '.' + (mLayerVersions.get(layer) || 0) : null;
    }

    // a layer duplicated in the layers list copies its items with their ids
    function ensureUniqueIds(){
        const seen = new Set();
        const all = allItems();
        for (const it of all) {
            if (!it.id || seen.has(it.id)) {
                let id;
                do { id = 'p' + (mNextId++); } while (seen.has(id) || all.some(o => o !== it && o.id === id));
                it.id = id;
            }
            seen.add(it.id);
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

    /** a layer's items as they are shown: none when it is hidden, its opacity applied */
    function shownItems(layer){
        if (!layer.isVisible()) return [];
        const a = layer.getOpacity();
        if (a >= 1) return layer.getItems();
        return layer.getItems().map(it => ({ ...it, style: { ...it.style, opacity: (it.style.opacity ?? 1)*a } }));
    }

    /** the items of the visible layers, bottom to top, each with its layer's opacity applied */
    function getItems(){
        return getLayers().flatMap(shownItems);
    }

    /** the items of one layer as getItems() shows them; none for an unknown id */
    function getLayerItems(id){
        const layer = getLayer(id);
        return layer ? shownItems(layer) : [];
    }

    /** the items that can be picked and edited: visible and not locked */
    function getEditableItems(){
        return getLayers().filter(l => l.isVisible() && !l.isLocked()).flatMap(layer => layer.getItems());
    }

    /** every item of every layer, each parent before its children */
    function allItems(){
        const out = [];
        const walk = items => { for (const it of items) { out.push(it); if (it.children) walk(it.children); } };
        for (const layer of getLayers()) walk(layer.getItems());
        return out;
    }

    function nextId(){
        const used = new Set(allItems().map(it => it.id));
        let id;
        do { id = 'p' + (mNextId++); } while (used.has(id));
        return id;
    }

    /**
     * where the item with the id is: {layer, path, index, parentId} with path
     * the indices from the layer's items down to it (index the last of them,
     * parentId the id of the item holding it, null at the top), or null
     */
    function findItem(id){
        function search(items, path, parentId){
            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                if (it.id === id) return { path: [...path, i], index: i, parentId };
                if (it.children) {
                    const found = search(it.children, [...path, i], it.id);
                    if (found) return found;
                }
            }
            return null;
        }
        for (const layer of getLayers()) {
            const found = search(layer.getItems(), [], null);
            if (found) return { layer, ...found };
        }
        return null;
    }

    /** the item at a path of a layer */
    function itemAt(layer, path){
        let items = layer.getItems(), it = null;
        for (const i of path) { it = items[i]; items = it ? it.children || [] : []; }
        return it;
    }

    /**
     * puts newItem at the path of the layer (null removes the item there),
     * copying the items holding it, so that a changed child gives a changed
     * parent (the sprites draw an item again when it is another object)
     */
    function replaceAt(layer, path, newItem){
        function rebuilt(list, depth){
            const i = path[depth];
            const copy = list.slice();
            if (depth === path.length - 1) {
                if (newItem === null) copy.splice(i, 1); else copy[i] = newItem;
            } else {
                const parent = { ...list[i], children: rebuilt(list[i].children, depth + 1) };
                if (!parent.children.length) delete parent.children;
                copy[i] = parent;
            }
            return copy;
        }
        layer.setItems(rebuilt(layer.getItems(), 0));
    }

    function getItem(id){
        const at = findItem(id);
        return at ? itemAt(at.layer, at.path) : null;
    }

    /**
     * add an item (a copy, the default style filled in, an id when it has
     * none or a taken one) to a layer at an index (default: the active layer,
     * on top), or into the item with parentId, among its children; returns
     * the added item
     */
    function insertItem(item, layerId = null, index = null, parentId = null){
        const it = normalizeItem(item);
        if (!it.id || getItem(it.id)) it.id = nextId();
        const at = parentId ? findItem(parentId) : null;
        if (at) {
            const parent = itemAt(at.layer, at.path);
            const children = (parent.children || []).slice();
            const i = (index === null || index === undefined) ? children.length : Math.max(0, Math.min(index, children.length));
            children.splice(i, 0, it);
            replaceAt(at.layer, at.path, { ...parent, children });
            changed(at.layer);
            return it;
        }
        const layer = (layerId && getLayer(layerId)) || getActiveLayer();
        const items = layer.getItems();
        const i = (index === null || index === undefined) ? items.length : Math.max(0, Math.min(index, items.length));
        items.splice(i, 0, it);
        changed(layer);
        return it;
    }

    /** add an item on top of the active layer */
    function addItem(item){
        return insertItem(item);
    }

    /** remove an item; returns {item, layerId, index, parentId} to insert it back, or null */
    function removeItem(id){
        const at = findItem(id);
        if (!at) return null;
        const item = itemAt(at.layer, at.path);
        replaceAt(at.layer, at.path, null);
        changed(at.layer);
        return { item, layerId: at.layer.getId(), index: at.index, parentId: at.parentId };
    }

    /** replace the content of an item, keeping its id and place */
    function updateItem(id, newItem){
        const at = findItem(id);
        if (!at) return null;
        const it = normalizeItem({ ...newItem, id });
        replaceAt(at.layer, at.path, it);
        changed(at.layer);
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
        getLayerItems,
        getEditableItems,
        getAllItems,
        allItems,
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
        layersChanged:   () => changed(),
        getLayerVersion,
        getVersion:      () => mVersion,
        onChange:        (cb) => { mListeners.push(cb); },
        getDefaultStyle: () => JSON.parse(JSON.stringify(DEFAULT_STYLE)),
    };

} // function DrawingDocument()

export { DrawingDocument };
