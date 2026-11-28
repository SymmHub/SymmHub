/*
  Unit tests for lib/symhublib/RenderQuality.js & resizeCanvas integer rounding:
    node tests/symhublib/render_quality.mjs
*/

import assert from 'node:assert/strict';
import {
    collectWebGLInfo,
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

// 1. GPU tier detection (Chrome, Edge, Firefox masked/generic, AMD iGPU, weak MX/GT, discrete, software, mobile)
const cases = [
    [{ renderer: 'ANGLE (Intel, Intel(R) HD Graphics 520 Direct3D11 vs_5_0 ps_5_0, D3D11)', hardwareConcurrency: 4, deviceMemory: 8 }, 'integrated'],
    [{ renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)', hardwareConcurrency: 8, deviceMemory: 16 }, 'integrated'],
    [{ renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)', hardwareConcurrency: 8, deviceMemory: 16 }, 'integrated'],
    [{ renderer: 'Mesa Intel(R) UHD Graphics 620 (KBL GT2)', hardwareConcurrency: 8, deviceMemory: 16 }, 'integrated'],
    [{ renderer: 'UHD Graphics 620', hardwareConcurrency: 8, deviceMemory: 0 }, 'integrated'],
    [{ renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)', hardwareConcurrency: 8, deviceMemory: 16 }, 'integrated'],
    [{ renderer: 'ANGLE (AMD, Radeon Graphics Direct3D11 vs_5_0 ps_5_0)', hardwareConcurrency: 8, deviceMemory: 0 }, 'integrated'],
    [{ renderer: 'ANGLE (AMD, AMD Radeon 680M Graphics Direct3D11)', hardwareConcurrency: 16, deviceMemory: 16 }, 'integrated'],
    [{ renderer: 'ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics Direct3D11)', hardwareConcurrency: 8, deviceMemory: 16 }, 'integrated'],
    [{ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce MX250 Direct3D11)', hardwareConcurrency: 8, deviceMemory: 16 }, 'integrated'],
    [{ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GT 730 Direct3D11)', hardwareConcurrency: 8, deviceMemory: 16 }, 'integrated'],
    [{ renderer: 'ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11)', hardwareConcurrency: 16, deviceMemory: 32 }, 'discrete'],
    [{ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)', hardwareConcurrency: 16, deviceMemory: 32 }, 'discrete'],
    [{ renderer: 'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11)', hardwareConcurrency: 16, deviceMemory: 32 }, 'discrete'],
    [{ renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)', hardwareConcurrency: 10, deviceMemory: 16 }, 'discrete'],
    [{ renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))', hardwareConcurrency: 8, deviceMemory: 16 }, 'software'],
    [{ renderer: 'Microsoft Basic Render Driver', hardwareConcurrency: 8, deviceMemory: 16 }, 'software'],
    [{ renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)', hardwareConcurrency: 8, deviceMemory: 16 }, 'software'],
    [{ renderer: 'Mali-G715', isCoarseTouch: true, userAgent: 'Android' }, 'mobile'],
    [{ renderer: 'Apple GPU', isCoarseTouch: true, userAgent: 'iPhone' }, 'mobile'],
    // Firefox masked / unidentified GPU fallback: <= 4 cores -> integrated, > 4 cores -> unknown (capped on 4K!)
    [{ renderer: 'ANGLE', hardwareConcurrency: 4, deviceMemory: 0 }, 'integrated'],
    [{ renderer: 'Mozilla', hardwareConcurrency: 8, deviceMemory: 0 }, 'unknown'],
    [{ renderer: 'ANGLE (Generic, Direct3D11 vs_5_0 ps_5_0)', hardwareConcurrency: 8, deviceMemory: 0 }, 'unknown'],
    [{ renderer: '', hardwareConcurrency: 8, deviceMemory: 4 }, 'integrated'],
    [{ renderer: '', hardwareConcurrency: 8, deviceMemory: 16 }, 'unknown'],
];
for (const [env, expected] of cases) {
    const res = detectDeviceTier(null, { isCoarseTouch: false, userAgent: 'Windows NT 10.0', ...env });
    check(res.tier === expected, `${env.renderer || '(empty)'} (cores=${env.hardwareConcurrency}, mem=${env.deviceMemory}) -> ${res.tier} (expected ${expected})`);
}

// 2. 4K display pixel budget on integrated laptop (100%, 150%, 200% Windows scaling)
for (const [cssW, cssH, dpr] of [[3840, 2000, 1], [2560, 1333, 1.5], [1920, 1000, 2]]) {
    const s = computeLiveRenderScale({ clientWidth: cssW, clientHeight: cssH, dpr, mode: 'auto', tier: 'integrated' });
    const outW = Math.round(s * Math.floor(cssW * dpr));
    const outH = Math.round(s * Math.floor(cssH * dpr));
    const outPx = outW * outH;
    check(outPx <= 1_250_000 && outPx >= 1_100_000, `4K integrated (${cssW}x${cssH}@${dpr}x) -> ${outW}x${outH} (${(outPx/1e6).toFixed(2)}M px)`);
}

// 3. Firefox masked GPU ('unknown') on 4K display caps around ~1.6M px instead of 8.3M px, while 1280x800 stays 1.0
{
    const s4k = computeLiveRenderScale({ clientWidth: 1920, clientHeight: 1080, dpr: 2, mode: 'auto', tier: 'unknown' });
    const outW = Math.round(s4k * 3840);
    const outH = Math.round(s4k * 2160);
    const outPx = outW * outH;
    check(outPx <= 1_650_000 && outPx >= 1_500_000, `4K unknown/Firefox -> ${outW}x${outH} (${(outPx/1e6).toFixed(2)}M px)`);

    const sHd = computeLiveRenderScale({ clientWidth: 1280, clientHeight: 800, dpr: 1, mode: 'auto', tier: 'unknown' });
    check(sHd === 1, `1280x800 unknown stays 1.0 (got ${sHd})`);
}

// 4. Normal 1280x800 screen on integrated laptop stays full native resolution (1.02M <= 1.2M)
{
    const s = computeLiveRenderScale({ clientWidth: 1280, clientHeight: 800, dpr: 1, mode: 'auto', tier: 'integrated' });
    check(s === 1, `1280x800 integrated stays 1.0 (got ${s})`);
}

// 5. Discrete GPU on 4K stays full native resolution
{
    const s = computeLiveRenderScale({ clientWidth: 1920, clientHeight: 1080, dpr: 2, mode: 'auto', tier: 'discrete' });
    check(s === 1, `4K discrete stays 1.0 (got ${s})`);
}

// 6. Explicit modes: high ignores caps, medium caps ~1.2M, low caps ~0.55M
{
    const sHigh = computeLiveRenderScale({ clientWidth: 1920, clientHeight: 1080, dpr: 2, mode: 'high', tier: 'integrated' });
    const sMed  = computeLiveRenderScale({ clientWidth: 1920, clientHeight: 1080, dpr: 2, mode: 'medium', tier: 'discrete' });
    const sLow  = computeLiveRenderScale({ clientWidth: 1920, clientHeight: 1080, dpr: 2, mode: 'low', tier: 'discrete' });
    check(sHigh === 1, 'high mode stays 1.0 on integrated');
    check(sMed < 0.5 && sLow < sMed, `medium (${sMed.toFixed(3)}) > low (${sLow.toFixed(3)}) on 4K`);
}

// 7. Adaptive frame-time scaler: handles 1-2 FPS (700-1500ms) rapidly, mild slow frames over 4 frames, ignores >= 8000ms
{
    const sc = createAdaptiveScaler({ slowMs: 45, slowFramesNeeded: 4, stepFactor: 0.78, minScale: 0.25 });
    check(sc.recordFrame(120, false) === false, 'ignores non-continuous frame');
    check(sc.recordFrame(9000, true) === false, 'ignores extreme pause >= 8000ms');
    for (let i = 0; i < 3; i++) check(sc.recordFrame(80, true) === false, 'does not trigger before 4 mild slow frames');
    check(sc.recordFrame(80, true) === true, 'triggers on 4th consecutive mild slow frame');
    check(sc.getScale() === 1 && sc.hasPending(), 'holds pending until gesture ends');
    check(sc.applyPending() === true && sc.getScale() === 0.78 && !sc.hasPending(), 'applyPending commits 0.78');

    // Extreme 1 FPS frame (~1100ms, e.g. Firefox 4K on old laptop) steps down immediately by severe factor (0.55)
    sc.reset();
    check(sc.recordFrame(1100, true) === true, '1100ms (~1 FPS) frame triggers immediate severe step-down');
    check(sc.applyPending() === true && sc.getScale() === 0.55, `severe step commits 0.55 (got ${sc.getScale()})`);
    check(sc.recordFrame(700, true) === true, 'second 700ms frame steps down again');
    check(sc.applyPending() === true && sc.getScale() < 0.35, `second severe step reaches ${sc.getScale()}`);
    const stats = sc.getStats();
    check(stats.estFps > 0 && stats.estFps < 2 && stats.sampleCount === 2, `stats report ~1 FPS (${stats.estFps.toFixed(2)})`);
    sc.reset();
    check(sc.getScale() === 1 && !sc.hasPending(), 'reset restores 1.0');
}

// 8. collectWebGLInfo safely reads mock GL context
{
    const mockGL = {
        VERSION: 1, SHADING_LANGUAGE_VERSION: 2, VENDOR: 3, RENDERER: 4,
        MAX_TEXTURE_SIZE: 5, MAX_VIEWPORT_DIMS: 6, MAX_RENDERBUFFER_SIZE: 7,
        drawBuffers: () => {}, createVertexArray: () => {},
        getExtension: () => ({ UNMASKED_VENDOR_WEBGL: 8, UNMASKED_RENDERER_WEBGL: 9 }),
        getParameter: (p) => ({
            1: 'WebGL 2.0', 2: 'WebGL GLSL ES 3.00', 3: 'Mozilla', 4: 'Mozilla',
            5: 16384, 6: new Int32Array([16384, 16384]), 7: 16384,
            8: 'Mozilla', 9: 'ANGLE (Intel, Direct3D11)',
        }[p]),
    };
    const info = collectWebGLInfo(mockGL);
    check(info.webglVersion === 'WebGL 2.0' && info.maxTextureSize === 16384 && info.unmaskedRenderer.includes('Intel'), 'collectWebGLInfo extracts WebGL 2.0 + limits + unmasked renderer');
}

// 9. resizeCanvas integer rounding: fractional scale does NOT reallocate on subsequent calls
{
    globalThis.window = { devicePixelRatio: 2.625 };
    const fakeCanvas = { clientWidth: 390, clientHeight: 800, width: 0, height: 0 };
    const first = resizeCanvas(fakeCanvas, 1.5 / 2.625);
    const second = resizeCanvas(fakeCanvas, 1.5 / 2.625);
    check(first === true && second === false, `resizeCanvas allocates once (${fakeCanvas.width}x${fakeCanvas.height}), not every frame`);
}

console.log(`ALL ${passed} RENDER QUALITY CHECKS PASSED`);
