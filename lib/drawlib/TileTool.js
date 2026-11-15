//
//  TileTool - adds the tile of the group's fundamental domain (Tiles.js)
//
//  A SymRenderer pattern tool (pattern.createUITool). The tile has the
//  domain's place, so where a click lands only tells a new tile from a pick:
//    click            on a tile (any copy): it selected; elsewhere a new
//                     tile of the domain on top of the active layer, selected
//    Curved sides     a toggle in the bar: new tiles are curved tiles
//                     (Tiles.js), paths whose sides take handles in the node
//                     tool, their pairs following (not in a Kleinian group)
//    To path          the selected tiles curved, their pairing kept
//                     (Ctrl+Shift+C); To polyline: a curved tile as a tile of
//                     the points of its outline
//    Release tile     the selected tiles as plain outlines, their pairing
//                     dropped
//    Delete           the selection removed
//    Escape           the selection dropped
//    Ctrl+Z, Ctrl+Y   undo, redo
//  The bar has the same as a button. The edges of a selected tile are drawn
//  with the polyline tool, freehand from one corner to the next (with Fit
//  curves, a curved edge), or with the pen tool, corner to corner.
//

import {
    convertProperties,
    DrawingCommands,
} from './modules.js';

const ICON = new URL('./res/btn_tile.svg', import.meta.url).pathname;
// a tile of four curved sides, each the turned image of the one before
const ICON_CURVED = '<svg viewBox="0 0 24 24"><path d="M4 4 C9 1 15 7 20 4 C23 9 17 15 20 20 C15 23 9 17 4 20 C1 15 7 9 4 4 Z" ' +
                    'fill="#e8e8e8" stroke="#303030" stroke-width="1.5" stroke-linejoin="round"/>' +
                    ['4,4', '20,4', '20,20', '4,20'].map(q => { const [x, y] = q.split(','); return `<rect x="${x - 2}" y="${y - 2}" width="4" height="4" fill="#fff" stroke="#303030" stroke-width="1.2"/>`; }).join('') +
                    '</svg>';
const HELP = 'a click adds the tile of the fundamental domain (its edges follow their pairs), a click on a tile selects it; ' +
             'Curved sides: new tiles are curved, their sides taking handles in the node tool (To path curves a selected tile); ' +
             'draw its edges freehand with the polyline tool (Fit curves: curved) or with the pen tool, corner to corner; To polyline makes a curved tile a tile of points; ' +
             'Release tile makes the selected tiles plain outlines, their edges no longer following each other; Escape drops the selection';

function TileTool(par) {

    const mEditor = par.editor;
    const mRepaint = mEditor.repaint;
    // To polyline and To path in the bar
    const mCommands = DrawingCommands(mEditor);

    let mPress = null;      // {w, canvas} while the button is down

    /** a tile under w selected on that copy: true, else false */
    function pick(w, canvas){
        const hit = mEditor.hitTest(w, canvas);
        if (!hit || !hit.item.tile) return false;
        mEditor.setSelection([{ id: hit.item.id, frame: hit.frame, frameInv: hit.frameInv }]);
        return true;
    }

    function handleEvent(e){
        if (!e.wpnt) return;
        const canvas = [e.canvasX, e.canvasY];
        switch (e.type) {
        case 'pointerdown':
            if (e.button !== 0) break;
            e.preventDefault();
            e.isConsumed = true;
            mPress = { w: e.wpnt, canvas };
            break;
        case 'pointerup':
            if (!mPress || e.button !== 0) break;
            e.isConsumed = true;
            if (!pick(mPress.w, mPress.canvas)) mEditor.addTileFromDomain();
            mPress = null;
            mRepaint();
            break;
        default:
            break;
        }
    }

    function handleKey(e){
        if (e.type !== 'keydown') return;
        if (e.key === 'Escape') {
            if (!mEditor.getSelection().length) return;
            mEditor.clearSelection();
            e.isConsumed = true;
            return;
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && mEditor.getSelection().length) {
            mEditor.removeItems(mEditor.getSelection().map(s => s.id));
            e.isConsumed = true;
            return;
        }
        if (mEditor.handleCommonKey(e)) e.isConsumed = true;
    }

    /** the selection's outlines, in world coordinates for the GPU pass */
    function getOverlayGeometry(){
        const geo = mEditor.newGeometry();
        mEditor.containerGeometry(geo);
        for (const sel of mEditor.getSelection()) {
            const item = mEditor.document.getItem(sel.id);
            if (item) mEditor.outlineGeometry(geo, mEditor.itemWorldPath(item, sel.frameInv));
        }
        return geo;
    }

    function renderUI(ctx){
        mEditor.drawContainer(ctx);
        for (const sel of mEditor.getSelection()) {
            const item = mEditor.document.getItem(sel.id);
            if (item) mEditor.drawOutline(ctx, mEditor.itemCanvasPath(item, sel.frameInv));
        }
    }

    return {
        name:      'tile',
        label:     'Tile from domain',
        key:       'T',
        group:     'shapes',
        title:     'tile from domain: ' + HELP,
        help:      HELP,
        icon:      ICON,
        cursor:    'crosshair',
        handleEvent,
        handleKey,
        renderUI,
        getOverlayGeometry,
        getProperties: () => [
            { kind: 'group', controls: [
                { kind: 'button', icon: ICON, title: 'Add the tile of the fundamental domain, its edges following their pairs',
                  action: () => mEditor.addTileFromDomain() },
                { kind: 'toggle', icon: ICON_CURVED, enabled: () => mEditor.canCurveTiles(),
                  title: 'Curved sides: new tiles are curved tiles, paths whose sides take handles in the node tool, their pairs following ' +
                         '(geodesic paths in the hyperbolic plane and on the sphere; not in a Kleinian group)',
                  get: () => !!mEditor.getStyleConfig().curvedTiles, set: (v) => mEditor.setStyleValue('curvedTiles', v) },
            ] },
            convertProperties(mCommands),
            mCommands.button('releaseTile'),
        ],
        setActive: (active) => { if (!active) mPress = null; },
    };

} // function TileTool()

export { TileTool };
