/**
 * circular_motion.js — Orbital + spin motion script for SymRenderer.
 *
 * The pattern pivot traces an ellipse (the "orbit") while spinning around
 * its own pivot point.  The ellipse can be tilted by orbitTilt.
 *
 *   orbitAngle  = 2π * (orbitSpeed * t + orbitPhase)
 *   orbitTilted = rotate(orbitW * cos(orbitAngle), orbitH * sin(orbitAngle), orbitTilt)
 *   pivotPos    = (orbitX, orbitY) + orbitTilted
 *   spinAngle   = 2π * (spinSpeed * t + spinOffset)
 *   center      = pivotPos + rotate(patternScale * pivotX, patternScale * pivotY, spinAngle)
 */

const TWO_PI = 2 * Math.PI;
const TODEGREE = 360 / TWO_PI;

/** Wrap any angle (degrees) into (−180, 180] and round to 4 decimal places. */
function normAngle(deg) {
    const NORM = 1e8;
    const a = deg - 360 * Math.floor((deg + 180) / 360);
    return Math.round(a * NORM) / NORM;
}

/**
 * @param {import('../../lib/symhublib/ScriptAPI.js').ScriptAPI} api
 * @returns {{ setTime(t: number): void }}
 */
export default function circularMotion(api) {

    // ── UI panel ─────────────────────────────────────────────────────────────
    const { gui } = api.createScriptUI();

    const cfg = {
        pivotX: 0,          // X-offset of pattern center from pivot (pattern-local units)
        pivotY: 0,          // Y-offset of pattern center from pivot
        patternScale: 0.1,  // scale multiplier for pivotX/Y (1 = pattern [-1,1] box)
        orbitX:   0,        // X center of the elliptical orbit (world units)
        orbitY:   0,        // Y center of the elliptical orbit (world units)
        orbitW:   0.15,     // semi-width  of the orbit ellipse
        orbitH:   0.15,     // semi-height of the orbit ellipse
        orbitTilt: 0,       // tilt of orbit ellipse major axis (turns, [−0.5, 0.5])
        orbitPeriod: 5,     // orbital period in seconds (negative = reverse, 0 = stopped)
        orbitOffset:  0,    // orbital phase offset (turns)
        spinPeriod: 0,      // spin period in seconds (negative = reverse, 0 = stopped)
        spinOffset: 0,      // initial spin phase (turns)
    };

    initUI();

    function initUI() {
        const INC = 0.001;
        const MP  = 300;  // max period in seconds
        gui.add(cfg, 'pivotX',       -100, 100, INC);
        gui.add(cfg, 'pivotY',       -100, 100, INC);
        gui.add(cfg, 'patternScale',    0, 100, INC);
        gui.add(cfg, 'orbitX',       -100, 100, INC);
        gui.add(cfg, 'orbitY',       -100, 100, INC);
        gui.add(cfg, 'orbitW',       -100, 100, INC);
        gui.add(cfg, 'orbitH',       -100, 100, INC);
        gui.add(cfg, 'orbitTilt',    -0.5, 0.5, INC);
        gui.add(cfg, 'orbitPeriod',   -MP,  MP, INC);
        gui.add(cfg, 'orbitOffset',  -2,   2,   INC);
        gui.add(cfg, 'spinPeriod',    -MP,  MP, INC);
        gui.add(cfg, 'spinOffset',   -2,   2,   INC);
    }

    function setTime(t) {
        const orbitT    = cfg.orbitPeriod !== 0 ? t / cfg.orbitPeriod : 0;
        const orbitAngle = TWO_PI * (orbitT + cfg.orbitOffset);
        const tiltAngle  = TWO_PI * cfg.orbitTilt;

        // Ellipse point before tilt
        const ex = cfg.orbitW * Math.cos(orbitAngle);
        const ey = cfg.orbitH * Math.sin(orbitAngle);

        // Rotate ellipse by orbitTilt to get pivot world position
        const cosT = Math.cos(tiltAngle);
        const sinT = Math.sin(tiltAngle);
        const px = cfg.orbitX + ex * cosT - ey * sinT;
        const py = cfg.orbitY + ex * sinT + ey * cosT;

        // Spin the pattern-local pivot offset and add to orbit position
        const spinPhase = cfg.spinPeriod !== 0 ? t / cfg.spinPeriod : 0;
        const spinAngle = TWO_PI * (spinPhase + cfg.spinOffset);
        const pcx  = -cfg.patternScale * cfg.pivotX;  
        const pcy  = -cfg.patternScale * cfg.pivotY;
        const cosS = Math.cos(spinAngle);
        const sinS = Math.sin(spinAngle);
        const cx = px + (pcx * cosS - pcy * sinS);
        const cy = py + (pcx * sinS + pcy * cosS);

        api.setParam('pattern.patternTransform.centerX', cx);
        api.setParam('pattern.patternTransform.centerY', cy);
        api.setParam('pattern.patternTransform.angle',   normAngle(spinAngle * TODEGREE));
        api.setParam('pattern.patternTransform.pivotX',  cfg.pivotX);
        api.setParam('pattern.patternTransform.pivotY',  cfg.pivotY);
        api.setParam('pattern.patternTransform.scale',  cfg.patternScale);
    }

    // ── Animation controller ─────────────────────────────────────────────────
    return { setTime };
}
