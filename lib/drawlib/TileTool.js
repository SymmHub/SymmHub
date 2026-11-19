//
//  TileTool - makes the tiles of the group's fundamental domain (Tiles.js)
//  and shapes them (docs/tile_tool_ui_plan.md)
//
//  A SymRenderer pattern tool (pattern.createUITool). Its canvas is the node
//  tool's (NodeTool.js, tilesOnly) on tiles alone: other items let a click
//  through, so motifs drawn over a tile do not get in the way.
//    T, the palette      taken up: a selected tile stays selected (the rest
//                        of the selection dropped; a tile picked in the
//                        layers window too); else the topmost tile of the
//                        active layer is selected; a layer without one gets
//                        a new tile (one undo step). A load that finds the
//                        tool active adds nothing
//    New tile, Shift+T   the tile of the domain on top of the active layer,
//                        selected; the tiles beneath stay, hidden by it (a
//                        tile covers the plane)
//    the pointer         a new tile made by a key (T, Shift+T) with the
//                        pointer over the canvas is the tile whose copies
//                        cover the pointer: the sides of a bent group's
//                        domain bound a polygon in each of the two parts of
//                        the plane the group tiles, and those of a group of
//                        the hyperbolic plane the domain and its mirror
//                        image beyond the absolute. The button, and a
//                        pointer where no polygon is, give the tile of the
//                        maker's domain
//    click a tile        select it on that copy (any copy), its nodes shown
//    drag a side         bend it, its paired side following (a tile of points
//                        becomes a curved tile; in a Kleinian group a node
//                        there, dragged); its corners and the sides on
//                        mirrors stay where the group puts them
//    nodes and handles   as in the node tool: drag them, double click a side
//                        for a node, the node types, Insert, Shift+U/L, Tab,
//                        Ctrl+A, the arrows
//    Delete              the picked nodes; none picked: the selected tiles
//    Escape              the picked nodes dropped, then the selection
//    Curved sides        a toggle in the bar: new tiles are curved tiles,
//                        paths whose sides take handles (not in a Kleinian
//                        group); on by default
//    To path, To polyline  the selected tiles curved or of points, their
//                        pairing kept (Ctrl+Shift+C: To path)
//    Release tile        the selected tiles as plain outlines, their pairing
//                        dropped
//    Ctrl+Z, Ctrl+Y      undo, redo
//  An edge can also be drawn with the polyline tool, freehand from one
//  corner to the next (with Fit curves, a curved edge), or with the pen
//  tool, corner to corner.
//

import {
    DrawingCommands,
    NodeTool,
} from './modules.js';

const ICON = new URL('./res/btn_tile.svg', import.meta.url).pathname;
// the tool's tile with a plus: a new tile
const ICON_NEW = '<svg viewBox="0 0 32 32"><path d="M9 7 Q12.5 10.5 16 7 Q19.5 3.5 23 7 L28 16 L23 25 Q19.5 21.5 16 25 Q12.5 28.5 9 25 L4 16 Z" ' +
                 'fill="#e8e8e8" stroke="#202020" stroke-width="2.2" stroke-linejoin="round"/>' +
                 '<circle cx="24" cy="24" r="7" fill="#fff" stroke="#202020" stroke-width="1.6"/>' +
                 '<path d="M24 20.5 V27.5 M20.5 24 H27.5" stroke="#202020" stroke-width="2.2" stroke-linecap="round"/></svg>';
// a tile of four curved sides, each the turned image of the one before
const ICON_CURVED = '<svg viewBox="0 0 24 24"><path d="M4 4 C9 1 15 7 20 4 C23 9 17 15 20 20 C15 23 9 17 4 20 C1 15 7 9 4 4 Z" ' +
                    'fill="#e8e8e8" stroke="#303030" stroke-width="1.5" stroke-linejoin="round"/>' +
                    ['4,4', '20,4', '20,20', '4,20'].map(q => { const [x, y] = q.split(','); return `<rect x="${x - 2}" y="${y - 2}" width="4" height="4" fill="#fff" stroke="#303030" stroke-width="1.2"/>`; }).join('') +
                    '</svg>';
const HELP = 'T takes up the tile of the active layer (a selected tile stays; a layer without one gets a new tile); ' +
             'New tile (Shift+T) adds the tile of the fundamental domain on top, hiding the tiles beneath; ' +
             'made by a key with the pointer over the canvas, a new tile is the one whose copies lie under the pointer ' +
             '(a bent group has a tile in each of the two parts of the plane it tiles); ' +
             'drag a side: it bends and its paired side follows (a tile of points becomes curved; in a Kleinian group a node goes there); ' +
             'corners and sides on mirrors stay; nodes and handles as in the node tool (double click a side: a node); ' +
             'a click on a tile (any copy) selects it, other shapes let the click through; ' +
             'Curved sides: new tiles curved; To polyline, To path keep the pairing, Release tile drops it; ' +
             'Delete: the picked nodes, none picked: the tile; Escape drops the picked nodes, then the selection; ' +
             'an edge can also be drawn corner to corner with the polyline or pen tool';

function TileTool(par) {

    const mEditor = par.editor;
    const mDoc = mEditor.document;
    // the canvas: the node tool's editing of tiles
    const mNodes = NodeTool({ editor: mEditor, tilesOnly: true });
    // Release tile in the bar
    const mCommands = DrawingCommands(mEditor);

    const isTile = (item) => !!(item && item.tile);

    /** may new items go on the active layer: shown and not locked */
    function activeLayerOpen(){
        const layer = mDoc.getActiveLayer();
        return !!layer && layer.isVisible() && !layer.isLocked();
    }

    /** the topmost tile shown on the active layer (open), or null */
    function layerTile(){
        if (!activeLayerOpen()) return null;
        return mDoc.getActiveLayer().getItems().slice().reverse().find(it => isTile(it) && it.visible !== false) || null;
    }

    /**
     * the tool taken up by the user (D1): a selected tile stays, the rest of
     * the selection dropped; else the active layer's topmost tile selected;
     * else (an open layer without one) a new tile, one undo step
     */
    function takeUp(){
        const sel = mEditor.getSelection();
        const tiles = sel.filter(s => isTile(mDoc.getItem(s.id)));
        if (tiles.length) {
            if (tiles.length !== sel.length) mEditor.setSelection(tiles);
            return;
        }
        while (mEditor.getContainer()) mEditor.leaveContainer();
        const tile = layerTile();
        if (tile) mEditor.setSelection([{ id: tile.id, frame: null, frameInv: null }]);
        else if (activeLayerOpen()) mEditor.addTileFromDomain(mEditor.pointer());
        else mEditor.clearSelection();
    }

    /**
     * a new tile of the domain on top of the active layer, selected (New
     * tile, Shift+T): with the pointer over the canvas (the key) the tile
     * whose copies cover the pointer, where the domain's sides bound more
     * than one polygon; else (the button) the tile of the maker's domain
     */
    function newTile(atPointer = false){
        mEditor.addTileFromDomain(atPointer ? mEditor.pointer() : null);
        mEditor.repaint();
    }

    function handleKey(e){
        if (e.type !== 'keydown') return;
        const ctrl = e.ctrlKey || e.metaKey;
        // Shift+T: a new tile, taken before the palette's key for the tool
        if ((e.key === 'T' || e.key === 't') && e.shiftKey && !ctrl && !e.altKey) {
            if (!e.repeat) newTile(true);
            e.isConsumed = true;
            return;
        }
        // Delete with no node picked: the selected tiles
        if ((e.key === 'Delete' || e.key === 'Backspace') && !ctrl && !mEditor.getSelectedVertices().length) {
            const ids = mEditor.getSelection().filter(s => isTile(mDoc.getItem(s.id))).map(s => s.id);
            if (ids.length) {
                mEditor.removeItems(ids);
                e.isConsumed = true;
                return;
            }
        }
        mNodes.handleKey(e);
    }

    /** taken up (taken: by the user, not by a load) or left */
    function setActive(active, taken = false){
        mNodes.setActive(active);
        if (active && taken) takeUp();
        mEditor.repaint();
    }

    return {
        name:      'tile',
        label:     'Tile from domain',
        key:       'T',
        group:     'shapes',
        title:     'tile from domain: ' + HELP,
        help:      HELP,
        icon:      ICON,
        cursor:    'default',
        handleEvent:        (e) => mNodes.handleEvent(e),
        handleKey,
        renderUI:           (ctx) => mNodes.renderUI(ctx),
        getOverlayGeometry: () => mNodes.getOverlayGeometry(),
        getContextMenu:     (e) => mNodes.getContextMenu(e),
        getProperties: () => [
            { kind: 'group', controls: [
                { kind: 'button', icon: ICON_NEW, title: 'New tile (Shift+T): the tile of the fundamental domain on top of the active layer, its edges following their pairs; ' +
                                                          'it hides the tiles beneath (a tile covers the plane): give it another fill, or none, to see them. ' +
                                                          'Shift+T with the pointer over the canvas: the tile whose copies lie under the pointer ' +
                                                          '(in a bent group, the tile of that part of the plane)',
                  action: () => newTile(false) },
                { kind: 'toggle', icon: ICON_CURVED, enabled: () => mEditor.canCurveTiles(),
                  title: 'Curved sides: new tiles are curved tiles, paths whose sides take handles, their pairs following ' +
                         '(geodesic paths in the hyperbolic plane and on the sphere; not in a Kleinian group); off: tiles of points, which a side drag curves',
                  get: () => !!mEditor.getStyleConfig().curvedTiles, set: (v) => mEditor.setStyleValue('curvedTiles', v) },
            ] },
            ...mNodes.getProperties(),
            mCommands.button('releaseTile'),
        ],
        setActive,
    };

} // function TileTool()

export { TileTool };
