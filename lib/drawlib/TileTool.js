//
//  TileTool - adds the tile of the group's fundamental domain (Tiles.js)
//
//  A SymRenderer pattern tool (pattern.createUITool). The tile has the
//  domain's place, so where a click lands only tells a new tile from a pick:
//    click            on a tile (any copy): it selected; elsewhere a new
//                     tile of the domain on top of the active layer, selected
//    Delete           the selection removed
//    Escape           the selection dropped
//    Ctrl+Z, Ctrl+Y   undo, redo
//  The bar has the same as a button. The edges of a selected tile are drawn
//  with the polyline tool, freehand from one corner to the next.
//

const ICON = new URL('./res/btn_tile.svg', import.meta.url).pathname;
const HELP = 'a click adds the tile of the fundamental domain (its edges follow their pairs), a click on a tile selects it; ' +
             'draw its edges freehand with the polyline tool, corner to corner; Escape drops the selection';

function TileTool(par) {

    const mEditor = par.editor;
    const mRepaint = mEditor.repaint;

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
            { kind: 'button', icon: ICON, title: 'Add the tile of the fundamental domain, its edges following their pairs',
              action: () => mEditor.addTileFromDomain() },
        ],
        setActive: (active) => { if (!active) mPress = null; },
    };

} // function TileTool()

export { TileTool };
