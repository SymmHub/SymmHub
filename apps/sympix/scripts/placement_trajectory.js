/**
 * placement_trajectory.js — Solution 2 animation script for SymRenderer.
 *
 * Continuously moves the pattern/motif center from a starting point A in D_0
 * to a target point B = h(A) of another placement along an exact geodesic or
 * orbital rotation arc in the group's geometry (Euclidean, hyperbolic, or
 * spherical), keeping intrinsic metric scale constant and without flipping
 * chirality on reflections.
 *
 * In 'Cycle All Placements' mode, atomically re-anchors back to A while
 * advancing permIndex at the end of every leg for seamless infinite cycling.
 */

import {
    strToPermutations,
    getGroupGeometry,
    getDomainBounds,
    findPlacementTargets,
    pickDefaultTarget,
    evaluateTrajectory,
} from '../../../lib/grouplib/grouplib.js';

const TODEG = 180 / Math.PI;

function applyEasing(t, kind) {
    t = Math.max(0, Math.min(1, t));
    if (kind === 'linear') return t;
    if (kind === 'smooth') return t * t * (3 - 2 * t);
    if (kind === 'cubic')  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    return t;
}

function findColorSymLayer(api) {
    const vis = api.getVisualization();
    if (!vis || !vis.getLayers) return null;
    const layers = vis.getLayers();
    return layers.find(l => l.enabled && l.getClassName?.() === 'VisualizationColorSym')
        || layers.find(l => l.getClassName?.() === 'VisualizationColorSym')
        || null;
}

export default function placementTrajectory(api) {
    const { gui } = api.createScriptUI();

    const cfg = {
        cycleAll:       true,
        placement1:     0,
        placement2:     1,
        pathType:       'geodesic',   // 'geodesic' | 'arc'
        preferDirect:   true,
        candidateIndex: 0,
        matchRotation:  true,
        autoCrown:      true,
        duration:       2.5,
        hold:           0.6,
        easing:         'cubic',
        captureStart:   () => captureCurrentPose(),
    };

    gui.add(cfg, 'cycleAll').name('Cycle All Placements');
    gui.add(cfg, 'placement1',     0, 23, 1).name('Placement 1');
    gui.add(cfg, 'placement2',     0, 23, 1).name('Placement 2');
    gui.add(cfg, 'pathType',       ['geodesic', 'arc']).name('Path Type');
    gui.add(cfg, 'preferDirect').name('Prefer Direct (G+)');
    gui.add(cfg, 'candidateIndex', 0, 11, 1).name('Candidate #');
    gui.add(cfg, 'matchRotation').name('Match Direct Rot');
    gui.add(cfg, 'autoCrown').name('Auto Enable Crown');
    gui.add(cfg, 'duration',       0.2, 30, 0.1).name('Duration (s)');
    gui.add(cfg, 'hold',           0, 10, 0.1).name('Hold (s)');
    gui.add(cfg, 'easing',         ['cubic', 'smooth', 'linear']).name('Easing');
    gui.add(cfg, 'captureStart').name('Capture Start Pose');

    // Anchor pose of the pattern at t = 0
    let basePose = null;
    // Cached trajectory search keyed by group + perms + pair + startPoint
    let cache = { key: '', geom: null, targets: [] };

    function captureCurrentPose() {
        const cx = api.getParam('pattern.patternTransform.centerX');
        const cy = api.getParam('pattern.patternTransform.centerY');
        const sc = api.getParam('pattern.patternTransform.scale');
        const ang = api.getParam('pattern.patternTransform.angle');
        const group = api.getGroup();
        if (typeof cx === 'number' && typeof cy === 'number') {
            basePose = {
                center: [cx, cy],
                scale:  typeof sc === 'number' && sc > 0 ? sc : 0.25,
                angle:  typeof ang === 'number' ? ang : 0,
            };
        } else if (group) {
            const b = getDomainBounds(group);
            basePose = { center: b.incenter.slice(), scale: Math.max(0.05, b.inradius), angle: 0 };
        }
        cache.key = '';
    }

    api.events.on('groupChanged', () => {
        cache.key = '';
    });

    function getTarget(group, permStr, useOrbit, p1, p2) {
        if (!basePose) captureCurrentPose();
        if (!group || !basePose) return null;
        const perms = strToPermutations(permStr);
        if (!perms.length || !perms[0].length) return null;

        const key = `${permStr}|${useOrbit ? 1 : 0}|${p1}|${p2}|${basePose.center[0].toFixed(4)},${basePose.center[1].toFixed(4)}|${group.getFundDomain?.()?.length || 0}`;
        if (cache.key !== key) {
            const geom = getGroupGeometry(group);
            const targets = findPlacementTargets({
                group,
                generatorPerms: perms,
                useOrbit,
                fromPlacement: p1,
                toPlacement: p2,
                startPoint: basePose.center,
                geometry: geom,
                maxTiles: 420,
                maxCandidates: 12,
            });
            cache = { key, geom, targets };
        }
        if (!cache.targets.length) return null;
        if (cfg.candidateIndex === 0) {
            return pickDefaultTarget(cache.targets, cfg.preferDirect);
        }
        return cache.targets[Math.min(cfg.candidateIndex, cache.targets.length - 1)];
    }

    function setTime(t) {
        const layer = findColorSymLayer(api);
        const group = api.getGroup();
        if (!layer || !group) return;

        const layerId = layer.getId();
        const permStr = api.getParam(`visualization.layers.${layerId}.permutations`) || '';
        const useOrbit = !!api.getParam(`visualization.layers.${layerId}.useOrbit`);
        const perms = strToPermutations(permStr);
        const n = perms.length && perms[0].length ? perms[0].length : 1;
        if (n < 2) return;

        if (cfg.autoCrown && !api.getParam(`visualization.layers.${layerId}.useCrown`)) {
            api.setParam(`visualization.layers.${layerId}.useCrown`, true);
        }

        const dur = Math.max(0.1, cfg.duration);
        const hold = Math.max(0, cfg.hold);
        const leg = dur + hold;

        let p1 = cfg.placement1 % n;
        let p2 = cfg.placement2 % n;
        let prog = 0;

        if (cfg.cycleAll) {
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

        const target = getTarget(group, permStr, useOrbit, p1, p2);
        if (!target || !basePose) return;

        const pose = evaluateTrajectory(cache.geom, target, prog, {
            pathType: cfg.pathType,
            matchRotation: cfg.matchRotation,
        });

        api.setParam(`visualization.layers.${layerId}.permIndex`, p1);
        api.setParam('pattern.patternTransform.centerX', pose.point[0]);
        api.setParam('pattern.patternTransform.centerY', pose.point[1]);
        api.setParam('pattern.patternTransform.scale',   basePose.scale * pose.scale);
        api.setParam('pattern.patternTransform.angle',   basePose.angle + pose.angle * TODEG);
    }

    function dispose() {
        if (basePose) {
            api.setParam('pattern.patternTransform.centerX', basePose.center[0]);
            api.setParam('pattern.patternTransform.centerY', basePose.center[1]);
            api.setParam('pattern.patternTransform.scale',   basePose.scale);
            api.setParam('pattern.patternTransform.angle',   basePose.angle);
        }
    }

    return { setTime, dispose };
}
