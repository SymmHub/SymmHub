/**
 * OrbifoldUITool — interactive editing of orbifold parameters with the mouse,
 * directly on the rendered image.
 *
 * This is a port of apps/orbifold/js/SymmetryUIController.js
 * (by Chaim Goodman-Strauss) into the SymRenderer tool pipeline.
 *
 * Interaction:
 *  - the edges of the fundamental domain are drawn on the 2D overlay canvas;
 *  - hovering over an edge which has a length/twist parameter highlights it;
 *  - dragging the highlighted edge changes its length parameter
 *    (shift+drag changes the twist parameter); the mouse wheel works too;
 *  - while a parameter changes, the view transform is corrected so that the
 *    grabbed point of the edge stays put on the screen (setShift).
 *
 * Contracts:
 *  - SymRenderer event tool:  handleEvent(evt) sets evt.isConsumed = true
 *    when the event was used (this preempts the navigator);
 *  - SymRenderer overlay:     renderUI(ctx, canvasTransform);
 *  - WallPaperGroup_General.symmetryUIController:
 *                             init / setShift / render / getUniforms / handleEvent.
 *
 * Known limitations:
 *  - the edges are drawn from the raw fundamental domain; SymRenderer's
 *    "group transform" folder (symmetry.transform) is not applied, so with a
 *    non-identity group transform the overlay is offset from the pattern;
 *  - setShift's anchoring assumes the navigator transform preserves the unit
 *    disk (true for panning; the ctrl/shift elliptic/hyperbolic gestures can
 *    produce transforms where the anchor correction is only approximate).
 */

import {
    lengthKeys, twistKeys,
    nearArcQ, iDrawSplane, getCopy,
    SHORTEPSILON,
    sign, abs, cos, sin,
    complexN,
    poincareMobiusTranslateFromToByD,
    sPlanesMovingEdge1ToEdge2,
    poincareMobiusFromSPlanesList,
    iGetFactorizationU4,
} from './modules.js';

import {
    TWISTMAXVALUE, TWISTMINVALUE,
    LENGTHMAXVALUE, LENGTHMINVALUE,
} from './WallPaperGroup_General.js';

const DEBUG = false;
const MYNAME = 'OrbifoldUITool';

// parameter change per canvas pixel of drag
const LENGTH_DRAG_SPEED = 0.005;
const TWIST_DRAG_SPEED  = 0.002;

// wheel steps
const LENGTH_WHEEL_STEP = 0.03;
const TWIST_WHEEL_STEP  = 0.01;

// hit test tolerance in canvas pixels
const HIT_TOLERANCE = 7;

// edge styles, per edge type key (see keys in OrbifoldGeometrization.js)
const DEFAULT_STYLES = {
    activeColor:     { color: "#FFFF00", width: 12 },
    handle:          { color: "#0000FF", width: 4 },
    cap:             { color: "#8C0072", width: 4 },
    conePt:          { color: "#AA00E1", width: 2 },
    conePair:        { color: "#0000E1", width: 4 },
    tube:            { color: "#EBAD00", width: 4 },
    mirror:          { color: "#DB00FF", width: 4 },
    mirrorRedundant: { color: "#DB0000", width: 4 },
    cornerPair:      { color: "#DB0000", width: 4 },
    fold:            { color: "#DB0000", width: 4 },
    band:            { color: "#EBAD00", width: 4 },
    slice:           { color: "#EBAD00", width: 4 },
    cuttingEdge:     { color: "#92C4DD", width: 2 },
    edge:            { color: "#92C4DD", width: 4 },
};

export class OrbifoldUITool {

    /**
     * options:
     *   wg        - the WallPaperGroup_General instance being edited
     *   navigator - InversiveNavigator (view transform)
     *   canvas    - overlay DOM canvas (used only for the cursor)
     *   repaint   - callback which schedules a repaint (no group rebuild)
     *   config    - shared config object; config.showDomain toggles the edges
     *   styles    - optional style overrides
     */
    constructor(options = {}) {

        this.wg        = options.wg;
        this.navigator = options.navigator;
        this.canvas    = options.canvas;
        this.repaint   = options.repaint || (() => {});
        this.config    = options.config || { showDomain: true };
        this.styles    = options.styles || DEFAULT_STYLES;

        this.FDPoints       = []; // navigator-transformed splanes drawn last frame
        this.activeFDPart   = -1; // index into [...FD.s, ...FD.i] of the hovered edge
        this.midDist        = -1000; // proportion of the hit point along the edge
        this.draggingParam  = false;
        this.stashedTransforms = [];

        this.savedMid = null; // grabbed point of the edge, in view coordinates
        this.savedPt  = null; // point at hyperbolic distance 1 from it, along the edge
    }

    // ── WallPaperGroup_General.symmetryUIController contract ─────────────

    init() {}

    render() { return []; }

    getUniforms(u) { return u; }

    // ── helpers ──────────────────────────────────────────────────────────

    resetHover() {
        this.midDist = -1000;
        this.activeFDPart = -1;
    }

    isActive() {
        // parameter edges are only produced (and drawn) for hyperbolic groups
        return !!(this.config.showDomain && this.wg && this.wg.curvature < 0 && this.wg.FD);
    }

    //
    // fd parts in drawing order: exterior boundaries then interior edges
    //
    getFDParts() {
        const fd = this.wg.getGroup();
        return [...fd.s, ...fd.i];
    }

    //
    // label ([key, index]) of the currently active edge, or null
    //
    getActiveEdgeLabel() {
        const ap = this.activeFDPart;
        if (ap < 0) return null;
        const parts = this.getFDParts();
        const changing = parts[ap];
        if (changing == undefined || changing[0] == undefined) return null;
        return changing[0].label;
    }

    setCursor(cur) {
        if (this.canvas) this.canvas.style.cursor = cur;
    }

    //
    //  commit a new value of parameter ls (e.g. "tube_1_l").
    //  Restores the transform stashed when the edge was grabbed, so that
    //  setShift() re-anchors the grabbed point instead of accumulating error.
    //
    applyParamValue(ls, newvalue) {
        const wg = this.wg;
        const item = wg.paramGuiFolderItems ? wg.paramGuiFolderItems[ls] : undefined;
        if (item == undefined) return;
        this.navigator.setInversiveTransform(getCopy(this.stashedTransforms));
        wg.needsShiftQ = true;
        // forces a call to our setShift() from wg.groupParamsChanged()
        item.setValue(newvalue);
    }

    // ── event handling (SymRenderer tool contract) ───────────────────────

    handleEvent(evt) {

        if (!this.isActive()) return;

        switch (evt.type) {
        case 'pointermove':
            if (this.draggingParam) {
                this.onParamDrag(evt);
            } else if (evt.buttons) {
                // some other drag is in progress (navigation) — don't interfere
            } else {
                this.onHover(evt);
            }
            break;
        case 'pointerdown':
            this.onPointerDown(evt);
            break;
        case 'pointerup':
        case 'pointerleave':
        case 'pointerout':
            this.onPointerUp(evt);
            break;
        case 'wheel':
            this.onWheel(evt);
            break;
        }
    }

    onHover(evt) {

        const oldAp = this.activeFDPart;
        this.resetHover();

        const parts = this.getFDParts();
        let i = 0;
        let found = false;

        while (i < this.FDPoints.length && !found) {
            const part = parts[i];
            const label = part && part[0] ? part[0].label : null;
            // only edges with a length parameter can be manipulated
            if (label && lengthKeys.includes(label[0])) {
                // note: not getCanvasPnt(evt) — it throws on a legitimate 0 coordinate
                this.midDist = nearArcQ([evt.canvasX, evt.canvasY], this.FDPoints[i], this.navigator, HIT_TOLERANCE);
                found = (this.midDist != -1000);
            }
            if (!found) i++;
        }

        if (!found) {
            this.activeFDPart = -1;
            this.setCursor('');
            if (oldAp != this.activeFDPart) this.repaint();
            return;
        }

        this.activeFDPart = i;
        this.captureGrabPoint(i);

        this.setCursor('grab');
        if (oldAp != this.activeFDPart) this.repaint();
        // note: hover does not consume the event
    }

    //
    // remember the grabbed point of edge i (at proportion midDist along it)
    // and a companion point, both in view coordinates — setShift() moves the
    // new edge so the grabbed point returns to this location.
    //
    captureGrabPoint(i) {

        // keep the grabbed point and a point at hyperbolic distance 1 along
        // the edge, both in view (navigator-transformed) coordinates
        const savedEdge = this.FDPoints[i];
        const end1 = new complexN(
            savedEdge.v[0] + cos(savedEdge.bounds[0]) * abs(savedEdge.v[3]),
            savedEdge.v[1] - sin(savedEdge.bounds[0]) * abs(savedEdge.v[3]));
        const end2 = new complexN(
            savedEdge.v[0] + cos(savedEdge.bounds[1]) * abs(savedEdge.v[3]),
            savedEdge.v[1] - sin(savedEdge.bounds[1]) * abs(savedEdge.v[3]));
        this.savedMid = end1.applyMobius(
            poincareMobiusTranslateFromToByD(
                end1, end2, this.midDist * (end1.poincareDiskDistanceTo(end2))));
        this.savedPt = this.savedMid.applyMobius(poincareMobiusTranslateFromToByD(
            this.savedMid, end1, 1));

        this.stashedTransforms = getCopy(this.navigator.getInversiveTransform());
    }

    onPointerDown(evt) {

        // only the primary button starts a parameter drag
        if (evt.button !== undefined && evt.button !== 0) return;

        // the hover state may be stale (e.g. the pointer teleported without
        // move events) — re-validate the hit at the press position
        this.onHover(evt);

        if (this.activeFDPart >= 0 && this.midDist != -1000) {
            const label = this.getActiveEdgeLabel();
            if (label == null) return;
            this.draggingParam = true;
            this.dragStart = [evt.canvasX, evt.canvasY];
            const ls = label[0] + "_" + label[1].toString();
            this.dragStartValues = {};
            this.dragStartValues[ls + "_l"] = this.wg.guiParams[ls + "_l"];
            this.dragStartValues[ls + "_t"] = this.wg.guiParams[ls + "_t"];
            this.stashedTransforms = getCopy(this.navigator.getInversiveTransform());
            // stop a still-gliding pan animation: it would keep mutating the
            // view transform every frame while we anchor against the stash
            if (this.navigator.mAnimatedPointer) this.navigator.mAnimatedPointer.stop();
            this.setCursor('grabbing');
            evt.isConsumed = true; // the navigator must not start panning
            evt.preventDefault();
        }
    }

    onPointerUp(evt) {

        if (this.draggingParam) {
            this.draggingParam = false;
            this.setCursor(this.activeFDPart >= 0 ? 'grab' : '');
            if (evt.type == 'pointerup') {
                evt.isConsumed = true;
            }
        }
    }

    //
    //  dragging a highlighted edge: horizontal/vertical mouse movement
    //  changes the length parameter (shift: the twist parameter) of the edge.
    //
    onParamDrag(evt) {

        if (!evt.buttons) {
            // the pointerup was lost (e.g. released outside the window)
            this.draggingParam = false;
            return;
        }

        const label = this.getActiveEdgeLabel();
        if (label == null) {
            this.draggingParam = false;
            return;
        }

        // dragging right or up increases the value
        const d = (evt.canvasX - this.dragStart[0]) - (evt.canvasY - this.dragStart[1]);
        const twistQ = evt.shiftKey && twistKeys.includes(label[0]);
        const lengthQ = !twistQ && lengthKeys.includes(label[0]);
        let ls = label[0] + "_" + label[1].toString();
        let newvalue;

        if (twistQ) {
            ls += "_t";
            newvalue = this.dragStartValues[ls] + d * TWIST_DRAG_SPEED;
            while (newvalue > TWISTMAXVALUE) newvalue -= TWISTMAXVALUE - TWISTMINVALUE;
            while (newvalue < TWISTMINVALUE) newvalue += TWISTMAXVALUE - TWISTMINVALUE;
        } else if (lengthQ) {
            ls += "_l";
            newvalue = this.dragStartValues[ls] + d * LENGTH_DRAG_SPEED;
            newvalue = Math.min(Math.max(newvalue, LENGTHMINVALUE), LENGTHMAXVALUE);
        } else {
            return;
        }

        this.applyParamValue(ls, newvalue);
        evt.isConsumed = true;
        evt.preventDefault();
    }

    onWheel(evt) {

        if (this.activeFDPart < 0) return;
        const label = this.getActiveEdgeLabel();
        if (label == null) return;

        const delta = sign(evt.deltaY);
        const twistQ = evt.shiftKey && twistKeys.includes(label[0]);
        const lengthQ = !twistQ && lengthKeys.includes(label[0]);
        let ls = label[0] + "_" + label[1].toString();
        let newvalue;

        if (twistQ) {
            ls += "_t";
            newvalue = this.wg.guiParams[ls] + delta * TWIST_WHEEL_STEP;
            while (newvalue > TWISTMAXVALUE) newvalue -= TWISTMAXVALUE - TWISTMINVALUE;
            while (newvalue < TWISTMINVALUE) newvalue += TWISTMAXVALUE - TWISTMINVALUE;
        } else if (lengthQ) {
            ls += "_l";
            newvalue = this.wg.guiParams[ls] + delta * LENGTH_WHEEL_STEP;
            newvalue = Math.min(Math.max(newvalue, LENGTHMINVALUE), LENGTHMAXVALUE);
        } else {
            return;
        }

        this.applyParamValue(ls, newvalue);
        evt.isConsumed = true;
        evt.preventDefault();
    }

    //
    //  keep the grabbed point of the modified edge fixed on the screen:
    //  called from WallPaperGroup_General.groupParamsChanged() when
    //  needsShiftQ is set (i.e. after applyParamValue).
    //
    setShift() {

        const ap = this.activeFDPart;
        if (ap < 0 || this.midDist == -1000 || this.savedMid == null) return;

        const parts = this.getFDParts();
        const edge = parts[ap];
        if (edge == undefined || !(Array.isArray(edge)) || edge[0] == undefined) return;
        if (edge[0].type != 1) return; // only circular arcs are supported

        // the grabbed point on the NEW edge, in untransformed coordinates
        const end1 = new complexN(
            edge[0].v[0] + cos(edge[0].bounds[0]) * abs(edge[0].v[3]),
            edge[0].v[1] - sin(edge[0].bounds[0]) * abs(edge[0].v[3]));
        const end2 = new complexN(
            edge[0].v[0] + cos(edge[0].bounds[1]) * abs(edge[0].v[3]),
            edge[0].v[1] - sin(edge[0].bounds[1]) * abs(edge[0].v[3]));
        const dist = end1.poincareDiskDistanceTo(end2);
        let mid = end1.applyMobius(poincareMobiusTranslateFromToByD(end1, end2, dist * this.midDist));
        let pt = mid.applyMobius(poincareMobiusTranslateFromToByD(mid, end1, 1));

        // into view coordinates:
        const trans = poincareMobiusFromSPlanesList(this.navigator.getInversiveTransform());
        mid = mid.applyMobius(trans);
        pt = pt.applyMobius(trans);

        if (abs(mid.re - this.savedMid.re) > SHORTEPSILON && abs(mid.im - this.savedMid.im) > SHORTEPSILON) {

            const newTransforms = sPlanesMovingEdge1ToEdge2(
                [mid, pt],
                [this.savedMid, this.savedPt]);

            let combined = [...this.navigator.getInversiveTransform(), ...newTransforms];
            if (combined.length >= 6) {
                // keep the transform list bounded
                combined = iGetFactorizationU4(combined);
            }
            this.navigator.setInversiveTransform(combined);
            this.navigator.informListener();
        }
    }

    // ── overlay drawing (SymRenderer contract) ───────────────────────────

    renderUI(ctx, canvasTransform) {

        if (DEBUG) console.log(`${MYNAME}.renderUI()`);

        if (!this.isActive()) {
            this.FDPoints = [];
            return;
        }

        const parts = this.getFDParts();
        const ap = this.activeFDPart;

        // highlight under the active edge
        if (ap >= 0 && parts[ap] && parts[ap][0]) {
            const st = this.styles.activeColor;
            iDrawSplane(parts[ap][0], ctx, this.navigator, {
                lineStyle: st.color,
                shadowStyle: "#00007733",
                lineWidth: st.width,
                shadowWidth: 5,
            });
        }

        this.FDPoints = [];
        for (let i = 0; i < parts.length; i++) {
            const label = parts[i][0].label;
            const st = (label && this.styles[label[0]]) || { color: "#92C4DD", width: 2 };
            this.FDPoints.push(
                iDrawSplane(parts[i][0], ctx, this.navigator, {
                    lineStyle: st.color,
                    shadowStyle: "#00007733",
                    lineWidth: st.width,
                    shadowWidth: 4,
                }));
        }
    }
}
