//
// to run 
// node tests/transforms/js/benchmark_crown.mjs
//
import './setup_mocks.js';
import { Group_KLM } from '../../../lib/grouplib/modules.js';
import { CrownCalculator } from '../../../lib/symhublib/modules.js';
const patternTransform = {
    centerX: 0.15, 
    centerY: 0.0,
    scale: 0.31,
    angle: 30, // degrees
};

const configs = [
    { name: "Hyperbolic (K=3, L=3, M=4)", params: { K: 3, L: 3, M: 4 } },
    { name: "Euclidean (K=4, L=4, M=2)", params: { K: 4, L: 4, M: 2 } },
    { name: "Spherical (K=2, L=3, M=5)", params: { K: 2, L: 3, M: 5 } },
];

const gridRadius = 10;
const numPoints = (2 * gridRadius + 1) ** 2;

console.log(`=== Crown Transform Calculation Benchmarks (grid_radius = ${gridRadius}, points = ${numPoints}) ===`);

for (const config of configs) {
    let groupMaker = new Group_KLM();
    groupMaker.setParamsMap(config.params);
    let group = groupMaker.getGroup();

    // Warmup
    CrownCalculator.calculate(group, patternTransform, { gridRadius });

    // Run 50 times for more accurate average
    const runs = 50;
    const times = [];
    let directCount = 0;
    for (let r = 0; r < runs; r++) {
        const start = performance.now();
        const directTransforms = CrownCalculator.calculate(group, patternTransform, { gridRadius });
        const end = performance.now();
        times.push(end - start);
        directCount = directTransforms.length;
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / runs;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    console.log(`\nGroup: ${config.name}`);
    console.log(`- FD length: ${group.getFundDomain().length}`);
    console.log(`- Direct transforms count: ${directCount}`);
    console.log(`- Avg calculation time: ${avgTime.toFixed(3)} ms (min: ${minTime.toFixed(3)} ms, max: ${maxTime.toFixed(3)} ms)`);
}
