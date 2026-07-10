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
 * Wrap t into [0, period).  Returns t unchanged when period === 0.
 * Uses floor (fract-style) so negatives wrap correctly.
 * @param {number} t
 * @param {number} period
 * @returns {number}
 */
function repeat(t, period) {
    if (period === 0) return t;
    return t - period * Math.floor(t / period);
}

/**
 * Triangular (ping-pong) wave in [0, period].
 * Bounces t back and forth: 0 → period → 0 → period …
 * Returns t unchanged when period === 0.
 * @param {number} t
 * @param {number} period
 * @returns {number}
 */
function ping_pong(t, period) {
    if (period === 0) return t;
    const t2 = repeat(t, 2 * period);
    return t2 < period ? t2 : 2 * period - t2;
}

const RT_NONE      = 'none';
const RT_REPEAT    = 'repeat';
const RT_PING_PONG = 'ping-pong';

export default function linearMotion(api) {

    // ── UI panel ─────────────────────────────────────────────────────────────

    const { gui } = api.createScriptUI();

    const cfg = {
        originX:    0,          // starting X position (world units)
        originY:    0,          // starting Y position (world units)
        speedX:     0,          // X displacement per second
        speedY:     0.1,        // Y displacement per second
        period:     10,         // loop period in seconds (0 = no loop)
        repeatType: RT_REPEAT,   // RT_NONE | RT_REPEAT | RT_PING_PONG
    };

    gui.add(cfg, 'originX',    -2, 2,    0.0001).name('Origin X');
    gui.add(cfg, 'originY',    -2, 2,    0.0001).name('Origin Y');
    gui.add(cfg, 'speedX',     -2, 2,    0.0001).name('Speed X');
    gui.add(cfg, 'speedY',     -2, 2,    0.0001).name('Speed Y');
    gui.add(cfg, 'period',      0, 3000, 0.0001).name('Period (s)');
    gui.add(cfg, 'repeatType', [RT_NONE, RT_REPEAT, RT_PING_PONG]).name('Repeat');

    // ── Animation controller ─────────────────────────────────────────────────

    return {
        setTime(t) {
            let tWrapped;
            switch (cfg.repeatType) {
                case RT_REPEAT:    tWrapped = repeat(t,    cfg.period); break;
                case RT_PING_PONG: tWrapped = ping_pong(t, cfg.period); break;
                default:           tWrapped = t; // RT_NONE
            }

            const x = cfg.originX + cfg.speedX * tWrapped;
            const y = cfg.originY + cfg.speedY * tWrapped;

            api.setParam('pattern.patternTransform.centerX', x);
            api.setParam('pattern.patternTransform.centerY', y);
        }
    };
}
