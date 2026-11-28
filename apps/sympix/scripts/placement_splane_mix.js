/**
 * placement_splane_mix.js — Solution 1 animation script for SymRenderer.
 *
 * Continuously transitions between discrete placements by mixing regions of
 * placement1 (outside) and placement2 (inside) across an animated iSPlane
 * (line or expanding circle) in either:
 *   - 'domain' space: every fundamental domain D_0 splits synchronously
 *   - 'shape' space:  every pattern/sprite splits internally across its own box
 *
 * Supports ping-pong between two placements or seamless cycling across all
 * placements (0 -> 1 -> ... -> n-1 -> 0).
 */

import { strToPermutations } from '../../../lib/grouplib/grouplib.js';

function applyEasing(t, kind) {
    t = Math.max(0, Math.min(1, t));
    if (kind === 'linear') return t;
    if (kind === 'smooth') return t * t * (3 - 2 * t);
    if (kind === 'cubic')  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    return t;
}

function colorLayers(api) {
    const vis = api.getVisualization();
    if (!vis || !vis.getLayers) return [];
    return vis.getLayers().filter(l => {
        const cls = l.getClassName ? l.getClassName() : '';
        return cls === 'VisualizationColorSym' || cls === 'VisualizationColorTiles';
    });
}

function detectColorCount(api) {
    for (const l of colorLayers(api)) {
        if (!l.enabled) continue;
        const pStr = api.getParam(`visualization.layers.${l.getId()}.permutations`);
        const perms = strToPermutations(pStr);
        if (perms.length && perms[0].length > 1) return perms[0].length;
    }
    return 3;
}

export default function placementSplaneMix(api) {
    const { gui } = api.createScriptUI();

    const cfg = {
        space:       'domain',     // 'domain' (FD) | 'shape' (motif/sprite box)
        splane:      'circle',     // 'circle' | 'line'
        angle:       0,            // line sweep angle (degrees)
        cycleAll:    true,         // true: 0 -> 1 -> ... -> n-1 -> 0; false: placement1 <-> placement2
        placement1:  0,
        placement2:  1,
        duration:    2.5,          // seconds per transition leg
        hold:        0.6,          // seconds held at each placement
        easing:      'cubic',      // 'cubic' | 'smooth' | 'linear'
        softness:    0.0,
        divider:     false,
        invert:      false,
    };

    gui.add(cfg, 'space',      ['domain', 'shape']).name('Mix Space');
    gui.add(cfg, 'splane',     ['circle', 'line']).name('SPlane');
    gui.add(cfg, 'angle',      -180, 180, 1).name('Angle°');
    gui.add(cfg, 'cycleAll').name('Cycle All Placements');
    gui.add(cfg, 'placement1', 0, 23, 1).name('Placement 1');
    gui.add(cfg, 'placement2', 0, 23, 1).name('Placement 2');
    gui.add(cfg, 'duration',   0.2, 30, 0.1).name('Duration (s)');
    gui.add(cfg, 'hold',       0, 10, 0.1).name('Hold (s)');
    gui.add(cfg, 'easing',     ['cubic', 'smooth', 'linear']).name('Easing');
    gui.add(cfg, 'softness',   0, 0.35, 0.002).name('Softness');
    gui.add(cfg, 'divider').name('Divider Line');
    gui.add(cfg, 'invert').name('Invert');

    function setTime(t) {
        const layers = colorLayers(api).filter(l => l.enabled);
        if (!layers.length) return;

        const dur = Math.max(0.1, cfg.duration);
        const hold = Math.max(0, cfg.hold);
        const leg = dur + hold;
        const n = detectColorCount(api);

        let p1 = cfg.placement1 % n;
        let p2 = cfg.placement2 % n;
        let prog = 0;

        if (cfg.cycleAll && n > 1) {
            const safeT = Math.max(0, t);
            const legIdx = Math.floor(safeT / leg);
            const inLeg = safeT - legIdx * leg;
            p1 = legIdx % n;
            p2 = (p1 + 1) % n;
            prog = applyEasing(Math.min(1, inLeg / dur), cfg.easing);
        } else {
            const cycle = 2 * leg;
            const u = ((t % cycle) + cycle) % cycle;
            const raw = (u < leg)
                ? Math.min(1, u / dur)
                : 1 - Math.min(1, (u - leg) / dur);
            prog = applyEasing(raw, cfg.easing);
        }

        for (const layer of layers) {
            const id = layer.getId();
            const isTiles = layer.getClassName && layer.getClassName() === 'VisualizationColorTiles';
            const mode = (isTiles && cfg.space === 'shape') ? 'domain' : cfg.space;
            api.setParam(`visualization.layers.${id}.permIndex`, p1);
            api.setParam(`visualization.layers.${id}.transition.mode`, mode);
            api.setParam(`visualization.layers.${id}.transition.placement2`, p2);
            api.setParam(`visualization.layers.${id}.transition.splane`, cfg.splane);
            api.setParam(`visualization.layers.${id}.transition.progress`, prog);
            api.setParam(`visualization.layers.${id}.transition.angle`, cfg.angle);
            api.setParam(`visualization.layers.${id}.transition.blur`, cfg.softness);
            api.setParam(`visualization.layers.${id}.transition.invert`, cfg.invert);
            api.setParam(`visualization.layers.${id}.transition.showLine`, cfg.divider);
        }
    }

    function dispose() {
        for (const layer of colorLayers(api)) {
            api.setParam(`visualization.layers.${layer.getId()}.transition.mode`, 'none');
        }
    }

    return { setTime, dispose };
}
