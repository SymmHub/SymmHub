/**
 * linear_motion.js — Linear (periodic) motion script for SymRenderer.
 *
 * Moves the pattern transform center in a straight line, looping with a
 * configurable period.  Controls exposed via the 'script params' GUI folder.
 *
 *   centerX(t) = originX + speedX * t_wrapped
 *   centerY(t) = originY + speedY * t_wrapped
 *
 *   t_wrapped = t mod period
 */

/**
 * @param {import('../../lib/symhublib/ScriptAPI.js').ScriptAPI} api
 * @returns {{ setTime(t: number): void }}
 */
export default function linearMotion(api) {

    // ── UI panel ─────────────────────────────────────────────────────────────

    const { gui } = api.createScriptUI();

    const cfg = {
        originX: 0,       // starting X position (world units)
        originY: 0,       // starting Y position (world units)
        speedX:  0,       // X displacement per second
        speedY:  0.1,     // Y displacement per second
        period:  10,      // loop period in seconds (0 = no loop)
    };

    gui.add(cfg, 'originX', -2, 2,  0.0001).name('Origin X');
    gui.add(cfg, 'originY', -2, 2,  0.0001).name('Origin Y');
    gui.add(cfg, 'speedX',  -2, 2,  0.0001).name('Speed X');
    gui.add(cfg, 'speedY',  -2, 2,  0.0001).name('Speed Y');
    gui.add(cfg, 'period',   0, 30, 0.01  ).name('Period (s)');

    // ── Animation controller ─────────────────────────────────────────────────

    return {
        setTime(t) {
            // Wrap time within period (skip wrapping if period == 0)
            const tWrapped = cfg.period > 0
                ? cfg.period * ((t / cfg.period) - Math.floor(t / cfg.period))
                : t;

            const x = cfg.originX + cfg.speedX * tWrapped;
            const y = cfg.originY + cfg.speedY * tWrapped;

            api.setParam('pattern.patternTransform.centerX', x);
            api.setParam('pattern.patternTransform.centerY', y);
        }
    };
}
