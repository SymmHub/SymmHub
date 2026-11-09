import {
    ObjArray,
    ObjectFactory,
    isShape,
    normalShape,
    shapeGeometry,
    flattenNodes,
    withImagesFramed,
    savedItem,
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
//               opacity: 1 },
//      children: [items],                     optional: items drawn inside a
//                                             closed item, clipped by its
//                                             outline, moved with it
//      pivot: [x, y],                         optional: the pivot of the
//                                             transform box (world), moved
//                                             with the item
//      axes: [ux, uy, vx, vy],                optional: the transform box's
//                                             axes (unit vectors) once a
//                                             transform turned them, mapped
//                                             with the item
//      colorWord: 'aB',                       optional: the word of the
//                                             symmetry taking the item back
//                                             to where it was seen before it
//                                             was carried (a group made of
//                                             copies): the colour layers
//                                             colour it as it was there, so
//                                             its copies keep their colours
//                                             (sprites)
//      shape: {kind, cx, cy, rx, ry, angle, ...},  optional (Shapes.js): a
//                                             rect, ellipse, polygon, star or
//                                             spiral kept by its numbers for
//                                             good, its outline made from
//                                             them here
//      visible: false }                       optional, true when absent
//                                             (and not saved then): a hidden
//                                             item is not drawn, picked,
//                                             snapped to or exported, nor
//                                             what it holds
//  'path' (Paths.js): cubic Bezier segments between nodes [{p, h1, h2}],
//  points being the outline flattened; with geodesic: true its segments
//  without handles are the straight lines of the group's geometry, and it is
//  drawn by its outline, an ordinary cubic path made from its nodes by the
//  outliner the document is given (setOutliner: {key, outline(nodes, closed)
//  -> {nodes, source}, space}, from the geometry in force; made again when
//  that changes, and never saved); a shape with geodesic: true is built in
//  that geometry (Shapes.js, in the outliner's space), its sizes lengths of
//  the metric, and drawn the same way; 'image' (ImageItems.js): a raster
//  image on a quad, src a data URL, held by a closed item (a frame,
//  Frames.js: an image on a layer or in a group is put in one); and 'group':
//  children only, drawn as they are (no outline, no clipping), moved and
//  transformed together, its points the corners of the box round them. A
//  closed item with a tile (Tiles.js) has its edges paired by the group.
//
//  An item stays where it was drawn: group changes and moves of the pattern
//  box never change the document (the nodes of a geodesic path stay too; its
//  outline is what the geometry in force makes of them). Item ids are unique
//  in the document, and
//  differ from the layers' ids: both are names a colour layer's images list
//  can give (ImageList.js), a layer's id for all it holds, a group's for its
//  members, an item's for itself.
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

/**
 * the item as the document keeps it; outliner ({key, outline(nodes, closed)},
 * or null) makes the outlines of the geodesic paths, the item's and those of
 * the items it holds
 */
function normalizeItem(item, outliner = null){
    const it = {
        type:   item.type || 'polyline',
        id:     item.id,
        closed: !!item.closed,
        points: Array.from(item.points || []),
        style:  { ...DEFAULT_STYLE, ...(item.style || {}) },
    };
    // a shape's colour class (motifClass, until 2026-11-07) is no longer
    // read: a colour layer's images list says what each coset shows
    delete it.style.motifClass;
    if (item.src) it.src = item.src;
    if (item.pivot) it.pivot = [item.pivot[0], item.pivot[1]];
    if (item.axes) it.axes = [item.axes[0], item.axes[1], item.axes[2], item.axes[3]];
    if (item.colorWord) it.colorWord = String(item.colorWord);
    if (item.visible === false) it.visible = false;
    if (item.nodes && item.nodes.length) {
        it.type = 'path';
        it.nodes = item.nodes.map(n => ({ p: [n.p[0], n.p[1]], h1: n.h1 ? [n.h1[0], n.h1[1]] : null, h2: n.h2 ? [n.h2[0], n.h2[1]] : null,
                                          ...(n.smooth ? { smooth: true } : {}), ...(n.ringEnd ? { ringEnd: true } : {}) }));
        it.points = flattenNodes(it.nodes, it.closed);
    }
    if (isShape(item.shape)) {
        // a shape's outline comes from its numbers; a geodesic shape's is the
        // skeleton of a geodesic path, built where the outliner's space says
        // (the Euclidean shape of the same numbers in the plane, or without one)
        it.shape = normalShape(item.shape);
        const g = shapeGeometry(it.shape, (item.geodesic && outliner && outliner.space) || null);
        it.closed = g.closed !== false;
        if (g.nodes) { it.type = 'path'; it.nodes = g.nodes; it.points = flattenNodes(g.nodes, it.closed); }
        else { it.type = 'polyline'; delete it.nodes; it.points = g.points; }
    }
    // a geodesic path or shape: drawn by its outline, the points flattened
    // from it; its outline carries the key of the outliner that made it (one
    // with no outline of its own, a shape of points, the key alone)
    if (item.geodesic && (it.nodes || it.shape)) {
        it.geodesic = true;
        if (outliner) {
            const o = it.nodes ? outliner.outline(it.nodes, it.closed) : null;
            it.outline = o ? { nodes: o.nodes, source: o.source, key: outliner.key } : { key: outliner.key };
            if (o) it.points = flattenNodes(o.nodes, it.closed);
        }
    }
    if (item.tile) it.tile = JSON.parse(JSON.stringify(item.tile));
    if (item.children && item.children.length) it.children = item.children.map(c => normalizeItem(c, outliner));
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
    // makes the outlines of the geodesic paths: {key, outline(nodes, closed)}, or null
    let mOutliner = null;
    const normalize = (item) => normalizeItem(item, mOutliner);
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
        ensureOutlines();
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
    // (and an item named as a layer is named again: the names are one list's)
    function ensureUniqueIds(){
        const layerIds = new Set(getLayers().map(l => l.getId()));
        const seen = new Set();
        const all = allItems();
        for (const it of all) {
            if (!it.id || seen.has(it.id) || layerIds.has(it.id)) {
                let id;
                do { id = 'p' + (mNextId++); } while (seen.has(id) || layerIds.has(id) || all.some(o => o !== it && o.id === id));
                it.id = id;
            }
            seen.add(it.id);
        }
    }

    /** does the geodesic path or shape lack the outline of the outliner in force */
    const unresolved = (it) => !!it.geodesic && (!it.outline || it.outline.key !== mOutliner.key);

    /** the items with the geodesic paths among them, and inside them, resolved; the same array when all are */
    function resolvedItems(items){
        let out = null;
        items.forEach((it, i) => {
            let next = it;
            if (unresolved(it)) {
                next = normalize(it);
            } else if (it.children) {
                const children = resolvedItems(it.children);
                if (children !== it.children) {
                    next = { ...it, children };
                    if (next.type === 'group') next.points = groupPoints(children);
                }
            }
            if (next !== it) { out = out || items.slice(); out[i] = next; }
        });
        return out || items;
    }

    // items loaded into a layer are as they were saved, without outlines, and
    // a new outliner leaves the outlines of the old one: the geodesic paths
    // are resolved here (new objects, so that the sprites draw them again);
    // true when some were
    function ensureOutlines(){
        if (!mOutliner) return false;
        let any = false;
        for (const layer of getLayers()) {
            const items = layer.getItems(), next = resolvedItems(items);
            if (next === items) continue;
            layer.setItems(next);
            mLayerVersions.set(layer, (mLayerVersions.get(layer) || 0) + 1);
            any = true;
        }
        return any;
    }

    /**
     * the maker of the geodesic paths' outlines, {key, outline(nodes, closed)
     * -> {nodes, source}, space} (DrawingGeometry.geodesicOutliner;
     * PatternDrawing gives the one of the group's geometry and another when
     * that changes; key tells them apart; space is where the geodesic shapes
     * are built); the geodesic paths and shapes are resolved by it, and the
     * listeners hear when some were
     */
    function setOutliner(outliner){
        mOutliner = outliner || null;
        if (ensureOutlines()) changed();
    }

    function freeLayerId(){
        const used = new Set([...getLayers().map(l => l.getId()), ...allItems().map(it => it.id)]);
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
        const items = layer.getItems().filter(it => it.visible !== false);
        if (a >= 1) return items;
        return items.map(it => ({ ...it, style: { ...it.style, opacity: (it.style.opacity ?? 1)*a } }));
    }

    /** the items of the visible layers, bottom to top, each with its layer's opacity applied; hidden ones left out */
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
        return getLayers().filter(l => l.isVisible() && !l.isLocked()).flatMap(layer => layer.getItems().filter(it => it.visible !== false));
    }

    /** every item of every layer, each parent before its children */
    function allItems(){
        const out = [];
        const walk = items => { for (const it of items) { out.push(it); if (it.children) walk(it.children); } };
        for (const layer of getLayers()) walk(layer.getItems());
        return out;
    }

    function nextId(){
        const used = new Set([...allItems().map(it => it.id), ...getLayers().map(l => l.getId())]);
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

    /** the items holding the item with the id, from the top of its layer down, then the item; none when it is gone */
    function itemChain(id){
        const at = findItem(id);
        if (!at) return [];
        const chain = [];
        let items = at.layer.getItems();
        for (const i of at.path) { chain.push(items[i]); items = items[i].children || []; }
        return chain;
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
                if (parent.type === 'group') parent.points = groupPoints(parent.children || []);
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
     * the added item (an image outside a closed item: its frame)
     */
    function insertItem(item, layerId = null, index = null, parentId = null){
        const at = parentId ? findItem(parentId) : null;
        const parent = at ? itemAt(at.layer, at.path) : null;
        const it = normalize(parent && parent.type !== 'group' ? item : withImagesFramed(item));
        if (!it.id || getItem(it.id)) it.id = nextId();
        if (at) {
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
        const it = normalize({ ...newItem, id });
        replaceAt(at.layer, at.path, it);
        changed(at.layer);
        return it;
    }

    /** does a layer or an item have the name */
    function isNameTaken(name){
        return !!getLayer(name) || !!findItem(name);
    }

    /** the item with the id named to (a free name); true when it was */
    function renameItem(id, to){
        const at = findItem(id);
        if (!at || !to || isNameTaken(to)) return false;
        replaceAt(at.layer, at.path, { ...itemAt(at.layer, at.path), id: to });
        changed(at.layer);
        return true;
    }

    /** the item with the id shown or hidden (it and all it holds); true when it changed */
    function setItemVisible(id, visible){
        const at = findItem(id);
        if (!at) return false;
        const item = itemAt(at.layer, at.path);
        if ((item.visible !== false) === !!visible) return false;
        // visible is the default: only a hidden item carries it
        const it = { ...item };
        if (visible) delete it.visible; else it.visible = false;
        replaceAt(at.layer, at.path, it);
        changed(at.layer);
        return true;
    }

    /** is the item with the id drawn: it, the items holding it and its layer shown */
    function isItemShown(id){
        const at = findItem(id);
        return !!at && at.layer.isVisible() && itemChain(id).every(it => it.visible !== false);
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
                items:   layer.getItems().map(savedItem),
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
            items:   (l.items || []).map(normalize),
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
        itemChain,
        addItem,
        insertItem,
        removeItem,
        updateItem,
        renameItem,
        setItemVisible,
        isItemShown,
        isNameTaken,
        clear,
        // all of it
        toJSON,
        fromJSON,
        layersChanged:   () => changed(),
        getLayerVersion,
        // the outlines of the geodesic paths
        setOutliner,
        getOutliner:     () => mOutliner,
        normalizeItem:   normalize,
        getVersion:      () => mVersion,
        onChange:        (cb) => { mListeners.push(cb); },
        getDefaultStyle: () => JSON.parse(JSON.stringify(DEFAULT_STYLE)),
    };

} // function DrawingDocument()

export { DrawingDocument };
