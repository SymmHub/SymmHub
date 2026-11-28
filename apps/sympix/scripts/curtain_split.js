/**
 * curtain_split.js — Animatable World Curtain Split script for SymRenderer.
 *
 * Sweeps a straight line, expanding circle, or exact Poincare-disk orthogonal
 * geodesic across the canvas:
 *   - 'placements' mode: splits one color layer between placement1 and placement2.
 *   - 'two-layers' mode: clips two visualization layers on opposite sides of the
 *     curtain (e.g., comparing cosets vs. orbits or two different subgroups live).
 */

function applyEasing(t, kind) {
    t = Math.max(0, Math.min(1, t));
    if (kind === 'linear') return t;
    if (kind === 'smooth') return t * t * (3 - 2 * t);
    if (kind === 'cubic')  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    if (kind === 'midpause') {
        if (t < 0.34) { const u = t / 0.34; return 0.5 * u * u * (3 - 2 * u); }
        if (t < 0.66) return 0.5;
        const u = (t - 0.66) / 0.34;
        return 0.5 + 0.5 * u * u * (3 - 2 * u);
    }
    return t;
}

function progressAtTime(t, duration, hold, repeatType) {
    const leg = Math.max(0.1, duration) + Math.max(0, hold);
    if (repeatType === 'once') {
        return Math.max(0, Math.min(1, t / Math.max(0.1, duration)));
    }
    if (repeatType === 'repeat') {
        const u = ((t % leg) + leg) % leg;
        return Math.min(1, u / Math.max(0.1, duration));
    }
    // ping-pong with endpoint holds
    const cycle = 2 * leg;
    const u = ((t % cycle) + cycle) % cycle;
    if (u < leg) {
        return Math.min(1, u / Math.max(0.1, duration));
    }
    const back = u - leg;
    return 1 - Math.min(1, back / Math.max(0.1, duration));
}

function colorLayers(api) {
    const vis = api.getVisualization();
    if (!vis || !vis.getLayers) return [];
    return vis.getLayers().filter(l => {
        const cls = l.getClassName ? l.getClassName() : '';
        return cls === 'VisualizationColorSym' || cls === 'VisualizationColorTiles';
    });
}

export default function curtainSplit(api) {
    const { gui } = api.createScriptUI();

    const detected = colorLayers(api).filter(l => l.enabled);
    const cfg = {
        splitMode:   detected.length >= 2 ? 'placements' : 'placements',
        splane:      'line',        // 'line' | 'circle' | 'geodesic'
        angle:       0,             // degrees (0 = vertical left-to-right curtain)
        placement1:  0,
        placement2:  1,
        layerA:      detected[0]?.getId() || 'colorTiles',
        layerB:      detected[1]?.getId() || 'imageColorSym',
        clipLayerA:  false,         // false = Layer A unclipped underlayer (zero seam for opaque layers)
        duration:    3.0,           // seconds per sweep
        hold:        0.8,           // seconds held at endpoints
        easing:      'midpause',    // 'midpause' | 'cubic' | 'smooth' | 'linear'
        repeat:      'ping-pong',   // 'ping-pong' | 'repeat' | 'once'
        softness:    0.0,
        divider:     true,
        invert:      false,
    };

    gui.add(cfg, 'splitMode',  ['placements', 'two-layers']).name('Split Mode');
    gui.add(cfg, 'splane',     ['line', 'circle', 'geodesic']).name('SPlane');
    gui.add(cfg, 'angle',      -180, 180, 1).name('Angle°');
    gui.add(cfg, 'placement1', 0, 23, 1).name('Placement 1');
    gui.add(cfg, 'placement2', 0, 23, 1).name('Placement 2');
    gui.add(cfg, 'layerA').name('Layer A id');
    gui.add(cfg, 'layerB').name('Layer B id');
    gui.add(cfg, 'clipLayerA').name('Clip Layer A too');
    gui.add(cfg, 'duration',   0.2, 30, 0.1).name('Duration (s)');
    gui.add(cfg, 'hold',       0, 10, 0.1).name('Hold (s)');
    gui.add(cfg, 'easing',     ['midpause', 'cubic', 'smooth', 'linear']).name('Easing');
    gui.add(cfg, 'repeat',     ['ping-pong', 'repeat', 'once']).name('Repeat');
    gui.add(cfg, 'softness',   0, 0.25, 0.002).name('Softness');
    gui.add(cfg, 'divider').name('Divider Line');
    gui.add(cfg, 'invert').name('Invert');

    function setLayerTransition(layerId, patch) {
        for (const [k, v] of Object.entries(patch)) {
            api.setParam(`visualization.layers.${layerId}.transition.${k}`, v);
        }
    }

    function setTime(t) {
        const raw = progressAtTime(t, cfg.duration, cfg.hold, cfg.repeat);
        const prog = applyEasing(raw, cfg.easing);

        if (cfg.splitMode === 'two-layers') {
            const idA = cfg.layerA.trim();
            const idB = cfg.layerB.trim();
            if (idA) {
                setLayerTransition(idA, {
                    mode:     cfg.clipLayerA ? 'clip' : 'none',
                    splane:   cfg.splane,
                    progress: prog,
                    angle:    cfg.angle,
                    blur:     cfg.softness,
                    invert:   cfg.invert,
                    showLine: false,
                });
            }
            if (idB) {
                setLayerTransition(idB, {
                    mode:     'clip',
                    splane:   cfg.splane,
                    progress: prog,
                    angle:    cfg.angle,
                    blur:     cfg.softness,
                    invert:   !cfg.invert,
                    showLine: cfg.divider,
                });
            }
            return;
        }

        // Single-layer mode: apply curtain split between placement1 & placement2 to all enabled color layers
        const layers = colorLayers(api).filter(l => l.enabled);
        for (const layer of layers) {
            const id = layer.getId();
            api.setParam(`visualization.layers.${id}.permIndex`, cfg.placement1 | 0);
            setLayerTransition(id, {
                mode:       'curtain',
                placement2: cfg.placement2 | 0,
                splane:     cfg.splane,
                progress:   prog,
                angle:      cfg.angle,
                blur:       cfg.softness,
                invert:     cfg.invert,
                showLine:   cfg.divider,
            });
        }
    }

    function dispose() {
        for (const layer of colorLayers(api)) {
            setLayerTransition(layer.getId(), { mode: 'none' });
        }
    }

    return { setTime, dispose };
}
