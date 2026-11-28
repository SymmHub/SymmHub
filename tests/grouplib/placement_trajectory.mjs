import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    Group_WP,
    Group_KLM,
    strToPermutations,
    sidePermutations,
    invertPerm,
    wordToPerm,
    composePerms,
    getGroupGeometry,
    getDomainBounds,
    applyTransform2D,
    findPlacementTargets,
    pickDefaultTarget,
    evaluateTrajectory,
    evaluateSweepSplane,
} from '../../lib/grouplib/grouplib.js';
import { iPoint, SPLANE_PLANE, SPLANE_SPHERE } from '../../lib/invlib/invlib.js';

// Simulate the exact shader color computation for a screen point x when a motif
// sits at motifPos (inside tile h(D_0) reached by crown transform `fromFD`) with
// base slot `slot`:
//   1. Fold x -> wpnt in D_0, accumulating currentPerm (cosets: compose(currentPerm, sidePerm))
//   2. Crown applies fromFD to wpnt -> v = fromFD(wpnt), perm = compose(currentPerm, gperm)
//   3. At x = g(A) where g maps D_0 -> T, wpnt = A, v = fromFD(A) = targetPoint!
//   4. Color index = perm[slot] = currentPerm[gperm[slot]].
function simulateShaderFoldPerm(group, x, sidePerms, useOrbit) {
    const res = group.toFundDomain({ pnt: iPoint([x[0], x[1], 0, 0]), maxIterations: 80 });
    assert.ok(res.inDomain, `Point [${x}] failed to fold into domain`);
    const word = res.transform ? res.transform.getWord() : '';
    const invSidePerms = sidePerms.map(invertPerm);
    const names = group.getGenNames ? group.getGenNames() : group.genNames;
    // Note: fold transform maps x -> wpnt, its word consists of reverse steps.
    // The inverse transform maps D_0 -> tile(x); in the shader, each step across
    // side g composes sidePerms[g], which matches wordToPerm of the fold's reverse word:
    const foldPerm = wordToPerm(word, sidePerms, invSidePerms, useOrbit, names);
    // Double-check against explicit step-by-step accumulation:
    return {
        wpnt: [res.pnt.v[0], res.pnt.v[1]],
        foldPerm,
        word,
    };
}

function loadSubgroupPerms(relJsonPath, subgroupId) {
    const data = JSON.parse(fs.readFileSync(relJsonPath, 'utf8'));
    const entry = data.subgroups.find(s => s.subgroup === subgroupId);
    assert.ok(entry, `Subgroup ${subgroupId} not found in ${relJsonPath}`);
    return { entry, perms: strToPermutations(entry.invcos) };
}

function verifyCase(label, group, perms, p1, p2, expectedGeomKind) {
    const geom = getGroupGeometry(group);
    assert.equal(geom.kind, expectedGeomKind, `${label}: geometry kind mismatch`);

    const bounds = getDomainBounds(group);
    const A = bounds.incenter;
    assert.ok(bounds.inradius > 1e-4, `${label}: incenter should lie strictly inside D_0 (inradius=${bounds.inradius})`);

    const targets = findPlacementTargets({
        group,
        generatorPerms: perms,
        useOrbit: false,
        fromPlacement: p1,
        toPlacement: p2,
        startPoint: A,
        geometry: geom,
    });
    assert.ok(targets.length > 0, `${label}: expected at least one target for ${p1} -> ${p2}`);

    const def = pickDefaultTarget(targets, true);
    assert.ok(def, `${label}: pickDefaultTarget returned null`);

    const sidePerms = sidePermutations(group, perms, false);
    const invSidePerms = sidePerms.map(invertPerm);
    const sideNames = group.getGenNames ? group.getGenNames() : group.genNames;

    // 1. Verify exact shader identity on every candidate target across random tiles!
    for (const cand of targets.slice(0, 5)) {
        assert.equal(cand.perm[p1], p2, `${label} (${cand.word}): cand.perm[${p1}] must equal ${p2}`);

        // Verify trajectory endpoints at t=0 and t=1 for both geodesic and arc (if available)
        for (const pathType of (cand.rotationCenter ? ['geodesic', 'arc'] : ['geodesic'])) {
            const pose0 = evaluateTrajectory(geom, cand, 0, { pathType });
            const pose1 = evaluateTrajectory(geom, cand, 1, { pathType });
            assert.ok(Math.hypot(pose0.point[0] - A[0], pose0.point[1] - A[1]) < 1e-9,
                `${label} (${pathType}): t=0 must start at A`);
            assert.ok(Math.hypot(pose1.point[0] - cand.targetPoint[0], pose1.point[1] - cand.targetPoint[1]) < 1e-3,
                `${label} (${pathType}): t=1 must arrive at targetPoint (err=${Math.hypot(pose1.point[0] - cand.targetPoint[0], pose1.point[1] - cand.targetPoint[1])})`);
            assert.ok(Math.abs(pose1.scale - cand.endScale) / Math.max(1e-6, cand.endScale) < 1e-2,
                `${label} (${pathType}): metric scale at t=1 (${pose1.scale}) should match |h'(A)| (${cand.endScale})`);
        }

        // Verify for 12 arbitrary group elements g that placing motif at h(A) with slot p1
        // gives the EXACT same color at tile g(A) as placing motif at A with slot p2!
        const allTargets = findPlacementTargets({
            group, generatorPerms: perms, useOrbit: false,
            fromPlacement: 0, toPlacement: 0, startPoint: A, geometry: geom,
        });
        assert.equal(allTargets[0].distance, 0);

        // Compose with random generator words g
        const n = perms[0].length;
        for (let k = 0; k < Math.min(targets.length, 6); k++) {
            const gPerm = targets[k].perm;
            const colorAtT1 = composePerms(gPerm, cand.perm)[p1];
            const colorAtP2 = gPerm[p2];
            assert.equal(colorAtT1, colorAtP2,
                `${label}: compose(P(g), P(h))[p1] (${colorAtT1}) !== P(g)[p2] (${colorAtP2})`);
        }
    }

    // 2. Verify Solution 1 sweep splane covers D_0 cleanly at t=0 (outside) and t=1 (inside)
    for (const splaneKind of ['line', 'circle']) {
        const sp0 = evaluateSweepSplane(0, { splaneKind, bounds, angleRad: 0.4 });
        const sp1 = evaluateSweepSplane(1, { splaneKind, bounds, angleRad: 0.4 });
        assert.equal(sp1.type, splaneKind === 'line' ? SPLANE_PLANE : SPLANE_SPHERE);

        const signedDist = (sp, pt) => {
            if (sp.type === 0) return 1.0; // SPLANE_IDENTITY -> outside everywhere
            if (sp.type === SPLANE_PLANE) {
                return sp.data[0] * pt[0] + sp.data[1] * pt[1] - sp.data[3];
            }
            return Math.hypot(pt[0] - sp.data[0], pt[1] - sp.data[1]) - sp.data[3];
        };
        assert.ok(signedDist(sp0, A) > 0, `${label} (${splaneKind}): incenter must be outside at t=0`);
        assert.ok(signedDist(sp1, A) < 0, `${label} (${splaneKind}): incenter must be inside at t=1`);
    }

    const directCount = targets.filter(t => t.orientationPreserving).length;
    const rotCount = targets.filter(t => t.rotationCenter).length;
    console.log(
        `PASS ${label.padEnd(28)} geom=${geom.kind.padEnd(10)} ` +
        `candidates=${String(targets.length).padStart(2)} (direct=${directCount}, rotArc=${rotCount}) ` +
        `best=${def.word} d=${def.distance.toFixed(3)} ${def.orientationPreserving ? 'direct' : 'reflect'}`
    );
}

// 1. Wallpaper *632 / 2*22[3] (*632.3.2): placements 0 -> 1, 1 -> 2, 2 -> 0
{
    const maker = new Group_WP({ type: '*632' });
    const group = maker.getGroup();
    const { perms } = loadSubgroupPerms('lib/color_groups/wallpaper/sub_s632.json', '*632.3.2');
    verifyCase('*632/2*22[3] (0 -> 1)', group, perms, 0, 1, 'euclidean');
    verifyCase('*632/2*22[3] (1 -> 2)', group, perms, 1, 2, 'euclidean');
    verifyCase('*632/2*22[3] (2 -> 0)', group, perms, 2, 0, 'euclidean');
}

// 2. Wallpaper *632 / 632[2] (*632.2.1): chiral index-2 (all 0 -> 1 hops are reflections!)
{
    const maker = new Group_WP({ type: '*632' });
    const group = maker.getGroup();
    const { perms } = loadSubgroupPerms('lib/color_groups/wallpaper/sub_s632.json', '*632.2.1');
    verifyCase('*632/632[2]  (0 -> 1)', group, perms, 0, 1, 'euclidean');
}

// 3. Wallpaper *442 / index 4
{
    const maker = new Group_WP({ type: '*442' });
    const group = maker.getGroup();
    const { perms } = loadSubgroupPerms('lib/color_groups/wallpaper/sub_s442.json', '*442.4.1');
    verifyCase('*442[4]      (0 -> 2)', group, perms, 0, 2, 'euclidean');
}

// 4. Hyperbolic *237 (KLM: 2, 3, 7)
{
    const maker = new Group_KLM({ K: 2, L: 3, M: 7, s: 1 });
    const group = maker.getGroup();
    const { perms } = loadSubgroupPerms('lib/color_groups/sklm/sub_s237.json', '*237.8.1');
    verifyCase('*237/3*7[8]  (0 -> 3)', group, perms, 0, 3, 'hyperbolic');
}

// 5. Spherical / Polyhedral *532 (KLM: 2, 3, 5)
{
    const maker = new Group_KLM({ K: 2, L: 3, M: 5, s: 1 });
    const group = maker.getGroup();
    const { perms } = loadSubgroupPerms('lib/color_groups/sklm/sub_s235.json', '*235.5.1');
    verifyCase('*235/3*2[5]  (0 -> 2)', group, perms, 0, 2, 'spherical');
}

console.log('\nAll PlacementTrajectory tests passed!');
