/**
 * circular_motion.js — Circular (elliptical) motion script for SymRenderer.
 *
 * Moves the pattern transform center along a circle (or ellipse) in world space:
 *
 *   centerX(t) = cx + radiusX * cos(2π * speed * t + phase)
 *   centerY(t) = cy + radiusY * sin(2π * speed * t + phase)
 *
 * Setting radiusX == radiusY gives a circle.
 * Setting them differently gives an ellipse.
 * Controls exposed via a floating script UI panel.
 */

const TWO_PI = 2 * Math.PI;
const TODEGREE = 360/TWO_PI;
/**
 * @param {import('../../../lib/symhublib/ScriptAPI.js').ScriptAPI} api
 * @returns {{ setTime(t: number): void }}
 */
export default function circularMotion(api) {

    // ── UI panel ─────────────────────────────────────────────────────────────

    const { gui } = api.createScriptUI();

    const cfg = {
        cx:      0,     // center X of the circular orbit (world units)
        cy:      0,     // center Y of the circular orbit (world units)
        radiusX: 0.15,  // horizontal radius
        radiusY: 0.15,  // vertical radius (== radiusX → circle)
        speed:   0.2,   // revolutions per second
        phase:   0,     // initial phase offset in turns [0..1]
        angle:   0,     //pattern angle 
    };

    gui.add(cfg, 'cx',      -5, 5,    0.0001).name('Center X');
    gui.add(cfg, 'cy',      -5, 5,    0.0001).name('Center Y');
    gui.add(cfg, 'radiusX',  0, 10,    0.0001).name('Radius X');
    gui.add(cfg, 'radiusY',  0, 10,    0.0001).name('Radius Y');
    gui.add(cfg, 'speed',   -5, 5,    0.0001).name('Speed (rev/s)');
    gui.add(cfg, 'phase',    -2, 2,    0.0001).name('Phase (turns)');
    gui.add(cfg, 'angle',    -720, 720,    0.0001).name('angle (deg)');

    // ── Animation controller ─────────────────────────────────────────────────

    return {
        setTime(t) {
            const angle = TWO_PI * (cfg.speed * t + cfg.phase);

            const x = cfg.cx + cfg.radiusX * Math.cos(angle);
            const y = cfg.cy + cfg.radiusY * Math.sin(angle);
            const phi = angle*TODEGREE + cfg.angle;
            api.setParam('pattern.patternTransform.centerX', x);
            api.setParam('pattern.patternTransform.centerY', y);
            api.setParam('pattern.patternTransform.angle', phi);

        }
    };
}
