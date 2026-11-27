/*
  Unit tests for lib/symhublib/RenderQuality.js & resizeCanvas integer rounding:
    node tests/symhublib/render_quality.mjs
*/

import assert from 'node:assert/strict';
import {
    detectDeviceTier,
    computeLiveRenderScale,
    createAdaptiveScaler,
} from '../../lib/symhublib/RenderQuality.js';
import { resizeCanvas } from '../../lib/uilib/utils.js';

let passed = 0;
function check(cond, msg) {
    assert.ok(cond, msg);
    passed++;
}

// 1. GPU tier detection
const cases = [
    [{ renderer: 'ANGLE (Intel, Intel(R) HD Graphics 520 Direct3D11 vs_5_0 ps_5_0, D3D11)', hardwareConcurrency: 4, deviceMemory: 8 }, 'integrated'],
    [{ renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)', hardwareConcurrency: 8, deviceMemory: 16 }, 'integrated'],
    [{ renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)', hardwareConcurrency: 8, deviceMemory: 16 }, 'integrated'],
    [{ renderer: 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)', hardwareConcurrency: 8, deviceMemory: 16 }, 'integrated'],
    [{ renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', hardwareConcurrency: 8, deviceMemory: 16 }, 'integrated'],
    [{ renderer: 'ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics Direct3D11)', hardwareConcurrency: 8, deviceMemory: 16 }, 'integrated'],
    [{ renderer: 'ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11)', hardwareConcurrency: 16, deviceMemory: 32 }, 'discrete'],
    [{ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)', hardwareConcurrency: 16, deviceMemory: 32 }, 'discrete'],
    [{ renderer: 'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11)', hardwareConcurrency: 16, deviceMemory: 32 }, 'discrete'],
    [{ renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)', hardwareConcurrency: 10, deviceMemory: 16 }, 'discrete'],
    [{ renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))', hardwareConcurrency: 8, deviceMemory: 16 }, 'software'],
    [{ renderer: 'Microsoft Basic Render Driver', hardwareConcurrency: 8, deviceMemory: 16 }, 'software'],
    [{ renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)', hardwareConcurrency: 8, deviceMemory: 16 }, 'software'],
    [{ renderer: 'Mali-G715', isCoarseTouch: true, userAgent: 'Android' }, 'mobile'],
    [{ renderer: 'Apple GPU', isCoarseTouch: true, userAgent: 'iPhone' }, 'mobile'],
    // Masked GPU fallback: <= 4 cores -> integrated, >= 8 cores -> discrete
    [{ renderer: 'ANGLE', hardwareConcurrency: 4, deviceMemory: 8 }, 'integrated'],
    [{ renderer: 'ANGLE', hardwareConcurrency: 8, deviceMemory: 4 }, 'integrated'],
    [{ renderer: 'ANGLE', hardwareConcurrency: 8, deviceMemory: 16 }, 'discrete'],
];
for (const [env, expected] of cases) {
    const res = detectDeviceTier(null, { isCoarseTouch: false, userAgent: 'Windows NT 10.0', ...env });
    check(res.tier === expected, `${env.renderer} (cores=${env.hardwareConcurrency}, mem=${env.deviceMemory}) -> ${res.tier} (expected ${expected})`);
}

// 2. 4K display pixel budget on integrated laptop (100%, 150%, 200% Windows scaling)
for (const [cssW, cssH, dpr] of [[3840, 2000, 1], [2560, 1333, 1.5], [1920, 1000, 2]]) {
    const s = computeLiveRenderScale({ clientWidth: cssW, clientHeight: cssH, dpr, mode: 'auto', tier: 'integrated' });
    const outW = Math.round(s * Math.floor(cssW * dpr));
    const outH = Math.round(s * Math.floor(cssH * dpr));
    const outPx = outW * outH;
    check(outPx <= 1_250_000 && outPx >= 1_100_000, `4K integrated (${cssW}x${cssH}@${dpr}x) -> ${outW}x${outH} (${(outPx/1e6).toFixed(2)}M px)`);
}

// 3. Normal 1280x800 screen on integrated laptop stays full native resolution (1.02M <= 1.2M)
{
    const s = computeLiveRenderScale({ clientWidth: 1280, clientHeight: 800, dpr: 1, mode: 'auto', tier: 'integrated' });
    check(s === 1, `1280x800 integrated stays 1.0 (got ${s})`);
}

// 4. Discrete GPU on 4K stays full native resolution
{
    const s = computeLiveRenderScale({ clientWidth: 1920, clientHeight: 1080, dpr: 2, mode: 'auto', tier: 'discrete' });
    check(s === 1, `4K discrete stays 1.0 (got ${s})`);
}

// 5. Explicit modes: high ignores caps, medium caps ~1.2M, low caps ~0.55M
{
    const sHigh = computeLiveRenderScale({ clientWidth: 1920, clientHeight: 1080, dpr: 2, mode: 'high', tier: 'integrated' });
    const sMed  = computeLiveRenderScale({ clientWidth: 1920, clientHeight: 1080, dpr: 2, mode: 'medium', tier: 'discrete' });
    const sLow  = computeLiveRenderScale({ clientWidth: 1920, clientHeight: 1080, dpr: 2, mode: 'low', tier: 'discrete' });
    check(sHigh === 1, 'high mode stays 1.0 on integrated');
    check(sMed < 0.5 && sLow < sMed, `medium (${sMed.toFixed(3)}) > low (${sLow.toFixed(3)}) on 4K`);
}

// 6. Adaptive frame-time scaler: ignores isolated spikes, steps down on 4 continuous slow frames, holds until applyPending
{
    const sc = createAdaptiveScaler({ slowMs: 45, slowFramesNeeded: 4, stepFactor: 0.78, minScale: 0.45 });
    check(sc.recordFrame(120, false) === false, 'ignores non-continuous frame');
    check(sc.recordFrame(1200, true) === false, 'ignores tab-switch stall >= 1000ms');
    for (let i = 0; i < 3; i++) check(sc.recordFrame(80, true) === false, 'does not trigger before 4 slow frames');
    check(sc.recordFrame(80, true) === true, 'triggers on 4th consecutive slow frame');
    check(sc.getScale() === 1 && sc.hasPending(), 'holds pending until gesture ends');
    check(sc.applyPending() === true && sc.getScale() === 0.78 && !sc.hasPending(), 'applyPending commits 0.78');
    sc.reset();
    check(sc.getScale() === 1 && !sc.hasPending(), 'reset restores 1.0');
}

// 7. resizeCanvas integer rounding: fractional scale does NOT reallocate on subsequent calls
{
    globalThis.window = { devicePixelRatio: 2.625 };
    const fakeCanvas = { clientWidth: 390, clientHeight: 800, width: 0, height: 0 };
    const first = resizeCanvas(fakeCanvas, 1.5 / 2.625);
    const second = resizeCanvas(fakeCanvas, 1.5 / 2.625);
    check(first === true && second === false, `resizeCanvas allocates once (${fakeCanvas.width}x${fakeCanvas.height}), not every frame`);
}

console.log(`ALL ${passed} RENDER QUALITY CHECKS PASSED`);
