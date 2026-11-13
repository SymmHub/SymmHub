/**
 * OrbifoldUITool — interactive editing of orbifold parameters with the mouse,
 * directly on the rendered image.
 *
 * This is a port of apps/orbifold/js/SymmetryUIController.js
 * (by Chaim Goodman-Strauss) into the SymRenderer tool pipeline.
 *
 * Interaction:
 *  - the edges of the fundamental domain are drawn by the GPU editing overlay
 *    (getOverlayGeometry, symhublib EditingOverlay.js) through the view's chain
 *    of maps, or on the 2D overlay canvas (renderUI) where there is no such pass;
 *  - hovering over an edge which has a length/twist parameter highlights it;
 *  - dragging the highlighted edge changes its length parameter
 *    (shift+drag changes the twist parameter); the mouse wheel works too;
 *  - while a parameter changes, the view transform is corrected so that the
 *    grabbed point of the edge stays put on the screen (setShift).
 *
 * Contracts:
 *  - SymRenderer event tool:  handleEvent(evt) sets evt.isConsumed = true
 *    when the event was used (this preempts the navigator);
 *  - SymRenderer overlay:     getOverlayGeometry() for the GPU pass, else
 *                             renderUI(ctx, canvasTransform);
 *  - WallPaperGroup_General.symmetryUIController:
 *                             init / setShift / render / getUniforms / handleEvent.
 *
 * The group transform: the maker's domain is in the maker's coordinates, where the
 * absolute is the unit circle; SymRenderer's group transform g (symmetry.transform, a
 * similarity) carries it to the world (options toWorld, fromWorld, toWorldSplane).
 * The edges are drawn and hit through g; the grabbed point and its proportion along
 * the edge are kept in the maker's coordinates, and the view's correction (setShift)
 * is an isometry K of the maker's disk carried to the world, V' = V g K g^-1, so the
 * view keeps the group's absolute.
 *
 * Known limitations:
 *  - setShift's anchoring assumes the navigator transform preserves the group's
 *    absolute (true for the hyperbolic moves; the ctrl/shift elliptic/hyperbolic
 *    gestures of other modes can produce transforms where the anchor correction is
 *    only approximate).
 */

import {
    lengthKeys, twistKeys,
    nearArcQ, iDrawSplane, iViewSplane, getCopy,
    SPLANE_SPHERE, SPLANE_PLANE,
    SHORTEPSILON,
    sign, abs, cos, sin,
    complexN,
    poincareMobiusTranslateFromToByD,
    sPlanesMovingEdge1ToEdge2,
    iFactorizeU4,
    TWISTMAXVALUE,
    TWISTMINVALUE,
    LENGTHMAXVALUE,
    LENGTHMINVALUE,
} from './modules.js';

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

// the translucent band along the edges (the 2D canvas' shadow), as the GPU pass' halo
const EDGE_HALO = [0, 0, 0x77/255, 0x33/255];
const EDGE_HALO_EXTRA = 4;      // pixels wider than the edge
const ACTIVE_HALO_EXTRA = 5;
const TWO_PI = 2*Math.PI;

/** '#RRGGBB' or '#RRGGBBAA' as rgba in 0..1 */
function rgba(css){
    const h = css.replace('#', '');
    const n = k => parseInt(h.slice(k, k + 2), 16)/255;
    return [n(0), n(2), n(4), h.length >= 8 ? n(6) : 1];
}

/**
 * the arc of an iSphere's bounds as an angle range about the centre, u0 in [-PI, PI),
 * u1 > u0: the bounds are negated angles drawn anticlockwise on the canvas from the
 * first to the second (iDrawSplane), the short arc between the ends (ISplane.iSphere)
 */
function arcRange(bounds){
    let u0 = -bounds[0], u1 = -bounds[1];
    while (u1 <= u0) u1 += TWO_PI;
    const k = Math.floor((u0 + Math.PI)/TWO_PI);
    return [u0 - k*TWO_PI, u1 - k*TWO_PI];
}

/**
 * an edge (an iSplane in the world) as a splane of the overlay geometry, a line cut
 * to the disk of the group's absolute {c, r} (the unit disk without a group transform;
 * the edges are drawn for hyperbolic groups only); null when it has no trace in the
 * plane. A line's range is the position along it from the foot of its normal through
 * the origin, along t = (-ny, nx) (EditingOverlay.js)
 */
function edgeSplane(sp, style, disk = { c: [0, 0], r: 1 }){
    if (!sp || !sp.v) return null;
    const v = sp.v;
    if (sp.type === SPLANE_SPHERE) {
        const r = Math.abs(v[3]);
        if (!(r > 1.e-12)) return null;
        return { circle: [v[0], v[1], r], range: sp.bounds ? arcRange(sp.bounds) : null, ...style };
    }
    if (sp.type === SPLANE_PLANE) {
        const len = Math.hypot(v[0], v[1]);
        if (!(len > 1.e-12)) return null;
        const nx = v[0]/len, ny = v[1]/len, d = v[3]/len;
        // the chord: about the foot of the normal through the disk's centre
        const delta = d - (nx*disk.c[0] + ny*disk.c[1]);
        const h = Math.sqrt(Math.max(0, disk.r*disk.r - delta*delta));
        const u = -ny*disk.c[0] + nx*disk.c[1];
        return { line: [nx, ny, d], range: [u - h, u + h], ...style };
    }
    return null;
}

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
     *   toWorld, fromWorld - optional, the group transform g from the maker's
     *               coordinates to the world and back, on points [x, y]
     *   toWorldSplane - optional, g on an iSplane (an arc's ends with it)
     *   view      - optional, SymRenderer's view: toWorld(cpnt) -> {pnt}, for the
     *               pointer's point in the maker's coordinates
     */
    constructor(options = {}) {

        this.wg        = options.wg;
        this.navigator = options.navigator;
        this.canvas    = options.canvas;
        this.repaint   = options.repaint || (() => {});
        this.config    = options.config || { showDomain: true };
        this.styles    = options.styles || DEFAULT_STYLES;
        this.toWorld       = options.toWorld || (p => p);
        this.fromWorld     = options.fromWorld || (w => w);
        this.toWorldSplane = options.toWorldSplane || (sp => sp);
        this.view          = options.view || null;

        this.FDPoints       = []; // navigator-transformed splanes drawn last frame
        this.activeFDPart   = -1; // index into [...FD.s, ...FD.i] of the hovered edge
        this.midDist        = -1000; // proportion of the hit point along the edge
        this.draggingParam  = false;
        this.stashedTransforms = [];

        this.savedMid = null; // grabbed point of the edge, in the maker's coordinates
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
    //  the renderer's Symmetry tool with the group's handles is taken up or left
    //  (SymRenderer); left, the hover highlight and a drag end
    //
    setActive(on) {
        if (on) return;
        const hovered = this.activeFDPart >= 0;
        this.draggingParam = false;
        this.resetHover();
        if (hovered) {
            this.setCursor('');
            this.repaint();
        }
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
        // the proportion along the edge in the maker's coordinates, where the absolute is
        // the unit circle (the view's coordinates have it only without a group transform)
        const q = this.makerProportion(i, [evt.canvasX, evt.canvasY]);
        if (q !== null) this.midDist = q;
        this.captureGrabPoint(i);

        this.setCursor('grab');
        if (oldAp != this.activeFDPart) this.repaint();
        // note: hover does not consume the event
    }

    //
    //  the Poincaré proportion along the arc of edge i (the maker's) of the pointer's
    //  point, carried to the arc's circle radially, in the maker's coordinates; null
    //  without a view, for a line, or off the disk
    //
    makerProportion(i, cpnt) {

        if (!this.view || !this.view.toWorld) return null;
        const parts = this.getFDParts();
        const edge = parts[i] && parts[i][0];
        if (!edge || edge.type !== SPLANE_SPHERE || !edge.bounds) return null;
        const w = this.view.toWorld(cpnt);
        const wp = w && (w.pnt || w);
        if (!wp || !isFinite(wp[0]) || !isFinite(wp[1])) return null;
        const m = this.fromWorld([wp[0], wp[1]]);
        const r = abs(edge.v[3]);
        const phi = Math.atan2(m[1] - edge.v[1], m[0] - edge.v[0]);
        const at = (b) => new complexN(edge.v[0] + cos(b) * r, edge.v[1] - sin(b) * r);
        const end1 = at(edge.bounds[0]), end2 = at(edge.bounds[1]);
        const mid = new complexN(edge.v[0] + r * Math.cos(phi), edge.v[1] + r * Math.sin(phi));
        const q = mid.poincareDiskDistanceTo(end1) / end2.poincareDiskDistanceTo(end1);
        return isFinite(q) ? q : null;
    }

    //
    //  the point at the proportion q of the Poincaré length along the arc of an edge
    //  (an iSphere with bounds, in the maker's coordinates) and the point at hyperbolic
    //  distance 1 from it towards the arc's first end: [mid, pt], complexN
    //
    grabPointsOf(edge, q) {

        const end1 = new complexN(
            edge.v[0] + cos(edge.bounds[0]) * abs(edge.v[3]),
            edge.v[1] - sin(edge.bounds[0]) * abs(edge.v[3]));
        const end2 = new complexN(
            edge.v[0] + cos(edge.bounds[1]) * abs(edge.v[3]),
            edge.v[1] - sin(edge.bounds[1]) * abs(edge.v[3]));
        const mid = end1.applyMobius(poincareMobiusTranslateFromToByD(end1, end2, q * end1.poincareDiskDistanceTo(end2)));
        const pt = mid.applyMobius(poincareMobiusTranslateFromToByD(mid, end1, 1));
        return [mid, pt];
    }

    //
    // remember the grabbed point of edge i (at proportion midDist along it)
    // and a companion point, both in the maker's coordinates — setShift()
    // moves the view so the new edge's grabbed point shows where this one did.
    //
    captureGrabPoint(i) {

        const parts = this.getFDParts();
        const edge = parts[i] && parts[i][0];
        if (edge && edge.type === SPLANE_SPHERE && edge.bounds) {
            [this.savedMid, this.savedPt] = this.grabPointsOf(edge, this.midDist);
        } else {
            this.savedMid = null;
            this.savedPt = null;
        }
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

        // the grabbed point on the NEW edge and its companion, in the maker's coordinates
        const [mid, pt] = this.grabPointsOf(edge[0], this.midDist);

        if (abs(mid.re - this.savedMid.re) > SHORTEPSILON && abs(mid.im - this.savedMid.im) > SHORTEPSILON) {

            // K, an isometry of the maker's disk, takes the new grabbed point (and its
            // direction) back to the old one; carried to the world by the group transform
            // g it goes before the view (the stashed one): V' = V g K g^-1 shows the new
            // point where the old one was and keeps the group's absolute
            const K = sPlanesMovingEdge1ToEdge2(
                [mid, pt],
                [this.savedMid, this.savedPt]);

            let combined = [...K.map(S => this.toWorldSplane(S)), ...this.navigator.getInversiveTransform()];
            if (combined.length >= 6) {
                // keep the transform list bounded
                combined = iFactorizeU4(combined);
            }
            this.navigator.setInversiveTransform(combined);
            this.navigator.informListener();
        }
    }

    // ── overlay drawing (SymRenderer contract) ───────────────────────────

    //
    //  the edges as geometry in world coordinates for the GPU pass (the format of
    //  symhublib's OverlayGeometry.js): the active edge's highlight under the
    //  edges, each edge in the style of its type with a translucent halo. The
    //  edges as the view shows them are kept for the hit tests (FDPoints).
    //
    getOverlayGeometry() {

        const geo = { polylines: [], points: [], splanes: [] };
        if (!this.isActive()) {
            this.FDPoints = [];
            return geo;
        }
        const parts = this.getFDParts();
        const ap = this.activeFDPart;
        // the edges in the world (through the group transform), lines cut to the absolute's disk
        const c = this.toWorld([0, 0]), e1 = this.toWorld([1, 0]);
        const disk = { c, r: Math.hypot(e1[0] - c[0], e1[1] - c[1]) };
        const push = (w, st, extra) => {
            const e = edgeSplane(w, { width: st.width, color: rgba(st.color), dash: 0, gap: 0, halo: EDGE_HALO, haloWidth: st.width + extra }, disk);
            if (e) geo.splanes.push(e);
        };
        if (ap >= 0 && parts[ap] && parts[ap][0]) push(this.toWorldSplane(parts[ap][0]), this.styles.activeColor, ACTIVE_HALO_EXTRA);

        this.FDPoints = [];
        for (let i = 0; i < parts.length; i++) {
            const sp = parts[i][0];
            const label = sp && sp.label;
            const st = (label && this.styles[label[0]]) || { color: "#92C4DD", width: 2 };
            const w = sp ? this.toWorldSplane(sp) : undefined;
            push(w, st, EDGE_HALO_EXTRA);
            this.FDPoints.push(w ? iViewSplane(w, this.navigator) : undefined);
        }
        return geo;
    }

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
            iDrawSplane(this.toWorldSplane(parts[ap][0]), ctx, this.navigator, {
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
                iDrawSplane(this.toWorldSplane(parts[i][0]), ctx, this.navigator, {
                    lineStyle: st.color,
                    shadowStyle: "#00007733",
                    lineWidth: st.width,
                    shadowWidth: 4,
                }));
        }
    }
}
