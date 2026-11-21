/*
  TransformHandles.js — a conformal transformation's own handles and marks on the
  canvas (docs/conformal_transforms_plan.md 5.3 and section 15, outside the
  repository): the points of a rational map with their exponents, the cell of a
  periodic wrap with its vectors and centre, the fixed points of a word.

  A row of the list (conformal/ConformalMaps.js, FixedPointsTransform.js) gives
  them in the coordinates of a plane between two rows: getHandles() (the kinds
  of grouplib/GroupHandles.js), getMarks() (a geometry of the editing overlay,
  drawn and not picked), handlesPlane: 'screen', the plane on the screen's side
  of the row (the default), or 'world', the one on the pattern's side.

  That plane is what the canvas shows through the view's chain cut at the row
  (InversiveNavigator.viewChainAt): the sphere, the navigation's Moebius
  transform and the rows nearer the screen, with the row's own steps for the
  'world' plane. So nothing here inverts a map to draw:

    - the GPU's editing overlay draws the geometry with the cut chain as its
      view (getOverlayPass: SymRenderer packs the chain as the shader's
      uniforms), on every copy of the plane the canvas shows;
    - the pointer goes to the plane by the same cut chain on the CPU, and a
      handle is found by the distance there, in pixels of the cut chain's
      scale; a drag gives the handle the pointer's point of the plane;
    - only the labels (an exponent, a dragged point's values) are placed by a
      point: the cut chain the other way, on the copy at the pointer
      (ViewChain.js viewChainToScreen).

  The handles are those of the row getRow() gives (the row selected in the
  transformations window), run by a GroupHandlesTool. A drag changes the row's
  values as its controls would: one change of the list a move, so the picture
  follows and the moves of one drag are one undo step.

  Usage (SymRenderer):
    const th = createTransformHandles({ navigator, getRow, pointer, canvas, repaint });
    th.setActive(on)          shown and taking events
    th.handleEvent(e)         e.canvasX, e.canvasY: canvas pixels; sets e.isConsumed
    th.handleKey(e)
    th.getOverlayPass()       {chain, geometry} for the GPU pass, or null
    th.renderText(ctx)        the labels, on the 2D canvas
    th.renderUI(ctx)          the handles too, where there is no GPU pass
*/

import {
    GroupHandlesTool,
    mergeGeometry,
} from './modules.js';

/**
 * @param {object}   arg
 * @param {object}   arg.navigator  the InversiveNavigator (viewChainAt, screenToWorld,
 *                                  screenScale, worldToScreenPlace, whereShown, getProjection)
 * @param {function} arg.getRow     () => the row whose handles and marks show, or null
 * @param {function} [arg.pointer]  () => the pointer's last place on the canvas [x, y], or null
 * @param {object}   [arg.canvas]   the canvas the cursor and tooltip are set on
 * @param {function} [arg.repaint]
 */
export function createTransformHandles(arg) {

    const navigator = arg.navigator;
    const pointer = arg.pointer || (() => null);
    const repaint = arg.repaint || (() => {});

    /** the row with something to show, or null */
    function rowNow() {
        const row = arg.getRow ? arg.getRow() : null;
        return (row && (row.getHandles || row.getMarks)) ? row : null;
    }

    // the cut chain is asked many times in one event or frame: made once for it, and
    // again after any change of the list (a drag changes the row under it)
    let mChain = null;
    let mChainRow = null;
    function chain() {
        const row = rowNow();
        if (mChain && mChainRow === row) return mChain;
        mChainRow = row;
        mChain = row ? navigator.viewChainAt(row, row.handlesPlane === 'world') : navigator.viewChain(true);
        if (typeof queueMicrotask === 'function') queueMicrotask(() => { mChain = null; });
        return mChain;
    }
    const list = navigator.getProjection ? navigator.getProjection() : null;
    if (list && list.addListener) list.addListener(() => { mChain = null; });

    // the view of the row's plane: the canvas through the cut chain
    const view = {
        toWorld: (c) => {
            const r = navigator.screenToWorld(c, chain());
            return r.exact ? r.pnt : null;
        },
        scaleAt: (c) => navigator.screenScale(c, chain()),
        toCanvas: (w, seed) => {
            const r = navigator.worldToScreenPlace(w, seed || pointer() || undefined, chain());
            return r ? r.pnt : null;
        },
        shownAt: (w) => navigator.whereShown(w, pointer() || undefined, chain()),
    };

    const mTool = GroupHandlesTool({
        getHandles: () => { const row = rowNow(); return (row && row.getHandles) ? row.getHandles() : []; },
        view,
        canvas: arg.canvas || null,
        repaint,
    });

    let mActive = false;

    function setActive(on) {
        mActive = !!on;
        mChain = null;
        mTool.setActive(mActive);
    }

    /**
     * what the GPU's editing overlay draws for the row: the marks, then the handles,
     * in the plane's coordinates, and the chain that is its view; null with nothing
     * to draw
     */
    function getOverlayPass() {
        if (!mActive) return null;
        const row = rowNow();
        if (!row) return null;
        const geometry = mergeGeometry(row.getMarks ? row.getMarks() : null, mTool.getOverlayGeometry());
        if (!geometry.polylines.length && !geometry.points.length && !geometry.splanes.length) return null;
        return { chain: chain(), geometry };
    }

    return {
        setActive,
        isActive:    () => mActive,
        isShown:     () => mActive && !!rowNow(),
        isDragging:  () => mTool.isDragging(),
        getHover:    () => mTool.getHover(),
        handleEvent: (e) => { if (mActive && rowNow()) mTool.handleEvent(e); },
        handleKey:   (e) => { if (mActive && rowNow()) mTool.handleKey(e); },
        getOverlayPass,
        renderText:  (ctx) => { if (mActive && rowNow()) mTool.renderText(ctx); },
        renderUI:    (ctx) => { if (mActive && rowNow()) mTool.renderUI(ctx); },
        // for tests
        view,
    };
}
