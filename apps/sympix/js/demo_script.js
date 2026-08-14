/**
 * demo_script.js — Example animation script for SymRenderer.
 *
 * Demonstrates:
 *   - api.createScriptUI()  →  floating panel with DatGUI controls
 *   - api.setParam()        →  driving pattern params from setTime(t)
 */

/**
 * @param {import('../../lib/symhublib/ScriptAPI.js').ScriptAPI} api
 * @returns {{ setTime(t: number): void }}
 */
export default function demoScript(api) {

    console.log('[demo_script] loaded. ScriptAPI:', api);

    // ── Subscribe to renderer events ─────────────────────────────────────────

    api.events.on('groupChanged', (group) => {
        console.log('[demo_script] group changed:', group);
    });

    // ── Create a floating script UI panel ────────────────────────────────────
    //
    //  api.createScriptUI() returns:
    //    { gui        — DatGUI instance (use gui.add() for raw dat.gui controls)
    //      window     — InternalWindow instance (setVisible, setTitle, …)
    //      addParams  — convenience: createParamUI(gui, paramMap) wrapper }

    const { gui, addParams } = api.createScriptUI({
        title:    'Demo Script',
        width:    240,
        height:   160,
        left:     '10px',
        top:      '60px',
    });

    // Use the raw dat.gui API to add sliders:
    const cfg = {
        speedX:     0,   // animation speed multiplier
        speedY:     1, 
        originX:    0, 
        originY:    0, 
        period:    10,   // period of animaiton
    };
    gui.add(cfg, 'speedX',     0, 5,   0.0001).name('Speed X');
    gui.add(cfg, 'speedY',     0, 5,   0.0001).name('Speed Y');
    gui.add(cfg, 'originX',     0, 5,   0.0001).name('Origin X');
    gui.add(cfg, 'originY',     0, 5,   0.0001).name('Origin Y');
    gui.add(cfg, 'period', 0, 10, 0.005).name('Period');

    // ── Return the animation controller ─────────────────────────────────────

    return {
        setTime(t) {
            let tt = t/cfg.period;
            t = cfg.period*(tt - Math.floor(tt))
            let x = cfg.originX + cfg.speedX*t;
            let y = cfg.originY + cfg.speedY*t;

            api.setParam('pattern.patternTransform.centerX',x);
            api.setParam('pattern.patternTransform.centerY',y);
        }
    };

}
