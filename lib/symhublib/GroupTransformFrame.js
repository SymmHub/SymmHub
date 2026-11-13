/*
  GroupTransformFrame.js — the group transform as a frame on the canvas, the
  math of the Symmetry tool's transform handles (GroupTransformTool.js,
  docs/symmetry_tool_plan.md sections 4 and 15). No DOM, no imports.

  SymRenderer applies the similarity g(p) = s R(θ) (p + t) to the maker's
  group (sym_utils transformGroup: the translation t, then the rotation θ,
  then the scale s), from the stored numbers of symmetry.transform:
  translationX, translationY (t), rotation (θ in degrees), scale (s).

  The frame is a box in the maker's coordinates, the box round the maker's
  fundamental domain (GeneratorElements domainBox) with a margin, carried to
  the world by g: a rectangle turned by θ and scaled by s. Its centre is
  c = g(a), the image of the box's centre a (the anchor). The frame edits c,
  θ and s and writes the stored numbers back, t = R(-θ) c / s - a, so a turn
  or a scaling of the frame keeps its centre.

    groupTransformMaps(conf)    {toWorld(p), fromWorld(w), centre (g(0)), angle (radians), scale}
    transformFromFrame(c, angleDeg, s, anchor)
                                the stored numbers of the frame: its centre c (world),
                                its angle in degrees, its scale, about the anchor a (the
                                maker's coordinates, the origin by default)
    frameBox(box, opt)          the frame's box in the maker's coordinates: the domain's
                                box widened by opt.pad on every side, opt.minHalf at
                                least from the centre to a side (the maker's units; the
                                tool gives them in pixels at the frame's centre, so the
                                frame keeps its margin at any zoom, as the select
                                tool's box does)
    transformFrame(conf, box)   the frame of the box under g: {anchor, centre, corners
                                (world, counterclockwise from (x0, y0)), angle (radians),
                                scale}
    startFrameDrag(conf, kind, w0, anchor)
                                a drag of the centre ('centre') or of a corner ('corner')
                                grabbed at the world point w0, about the frame's centre
                                g(anchor)
    frameDragTo(drag, w, mods)  the stored numbers with the pointer at w: the centre
                                follows the pointer; a corner turns and scales the frame
                                about its centre by the pointer's turn about it (followed
                                through the whole drag, so a turn past half a circle goes
                                on) and the ratio of its distances from it, so the corner
                                grabbed stays under the pointer; mods.turnOnly: the turn
                                alone, the angle in steps of mods.stepDeg (15 by
                                default); mods.scaleOnly: the scale alone
*/

const TORAD = Math.PI/180;
const TODEG = 180/Math.PI;
// the scale's bounds (the panel's)
const MIN_SCALE = 0.000001;
const MAX_SCALE = 1000000;

function num(v, dflt) {
    return (typeof v === 'number' && isFinite(v)) ? v : dflt;
}

/** the maps of the stored numbers {translationX, translationY, rotation (degrees), scale} */
export function groupTransformMaps(conf) {
    const tx = num(conf.translationX, 0), ty = num(conf.translationY, 0);
    const a = num(conf.rotation, 0)*TORAD;
    const s = num(conf.scale, 1);
    const cs = Math.cos(a), sn = Math.sin(a);
    const toWorld = (p) => {
        const x = p[0] + tx, y = p[1] + ty;
        return [s*(cs*x - sn*y), s*(sn*x + cs*y)];
    };
    const fromWorld = (w) => {
        const x = (cs*w[0] + sn*w[1])/s, y = (-sn*w[0] + cs*w[1])/s;
        return [x - tx, y - ty];
    };
    return { toWorld, fromWorld, centre: toWorld([0, 0]), angle: a, scale: s };
}

/** the stored numbers of the frame: its centre c (world), its angle in degrees, its scale, about the anchor */
export function transformFromFrame(c, angleDeg, s, anchor = [0, 0]) {
    const a = angleDeg*TORAD;
    const cs = Math.cos(a), sn = Math.sin(a);
    // g(anchor) = c: t = R(-θ) c / s - anchor
    return {
        translationX: (cs*c[0] + sn*c[1])/s - anchor[0],
        translationY: (-sn*c[0] + cs*c[1])/s - anchor[1],
        rotation:     angleDeg,
        scale:        s,
    };
}

/** the frame's box (the maker's coordinates): the domain's box widened by pad, at least minHalf from the centre to a side */
export function frameBox(box, opt = {}) {
    const pad = Math.max(0, num(opt.pad, 0)), minHalf = Math.max(0, num(opt.minHalf, 0));
    const cx = (box[0] + box[2])/2, cy = (box[1] + box[3])/2;
    const w = Math.max(Math.abs(box[2] - box[0])/2 + pad, minHalf);
    const h = Math.max(Math.abs(box[3] - box[1])/2 + pad, minHalf);
    return [cx - w, cy - h, cx + w, cy + h];
}

/** the frame of the box (the maker's coordinates) under the transform: its anchor, centre and corners */
export function transformFrame(conf, box) {
    const m = groupTransformMaps(conf);
    const anchor = [(box[0] + box[2])/2, (box[1] + box[3])/2];
    return {
        anchor,
        centre:  m.toWorld(anchor),
        corners: [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]].map(m.toWorld),
        angle:   m.angle,
        scale:   m.scale,
    };
}

/** a drag of the frame's centre or of a corner grabbed at the world point w0, about the frame's centre g(anchor) */
export function startFrameDrag(conf, kind, w0, anchor = [0, 0]) {
    const m = groupTransformMaps(conf);
    const centre = m.toWorld(anchor);
    return {
        kind,
        anchor: [anchor[0], anchor[1]],
        w0:     [w0[0], w0[1]],
        centre,
        angle:  num(conf.rotation, 0),             // degrees, as stored
        scale:  m.scale,
        start:  { translationX: num(conf.translationX, 0), translationY: num(conf.translationY, 0),
                  rotation: num(conf.rotation, 0), scale: m.scale },
        // the pointer's direction from the centre, and its turn so far (radians)
        last:   Math.atan2(w0[1] - centre[1], w0[0] - centre[0]),
        turn:   0,
        dist0:  Math.hypot(w0[0] - centre[0], w0[1] - centre[1]),
    };
}

/** an angle in degrees kept within the panel's bounds, ±360 */
function keepAngle(deg) {
    while (deg > 360) deg -= 360;
    while (deg < -360) deg += 360;
    return deg;
}

/** the stored numbers for the pointer at the world point w during the drag (which follows the turn) */
export function frameDragTo(drag, w, mods = {}) {
    const c = drag.centre;
    if (drag.kind === 'centre') {
        return transformFromFrame([c[0] + w[0] - drag.w0[0], c[1] + w[1] - drag.w0[1]], drag.angle, drag.scale, drag.anchor);
    }
    const dx = w[0] - c[0], dy = w[1] - c[1];
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
        // the turn since the last point, the short way round
        const dir = Math.atan2(dy, dx);
        let d = dir - drag.last;
        while (d > Math.PI) d -= 2*Math.PI;
        while (d < -Math.PI) d += 2*Math.PI;
        drag.turn += d;
        drag.last = dir;
    }
    let angle = drag.angle, scale = drag.scale;
    if (!mods.scaleOnly) {
        angle = drag.angle + drag.turn*TODEG;
        if (mods.turnOnly) {
            const step = num(mods.stepDeg, 15);
            angle = Math.round(angle/step)*step;
        }
        angle = keepAngle(angle);
    }
    if (!mods.turnOnly && drag.dist0 > 0) {
        scale = Math.min(Math.max(drag.scale*dist/drag.dist0, MIN_SCALE), MAX_SCALE);
    }
    return transformFromFrame(c, angle, scale, drag.anchor);
}
