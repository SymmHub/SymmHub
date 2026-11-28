/**
 * RenderQuality.js
 *
 * Automatic low-end / integrated / mobile / masked-GPU / 4K-display live resolution
 * scaling for SymRenderer, paired with gesture-safe adaptive frame-time stepping
 * and WebGL diagnostic metadata collection.
 *
 * Only governs the interactive on-screen canvas when CanvasSize is "Fit To Window"
 * and sizeMultiplier === 1. Image exports, thumbnails, video recording, and explicit
 * custom canvas sizes always render at their full requested resolution.
 */

export const QUALITY_MODES = ['auto', 'high', 'medium', 'low'];

export const TIER_BUDGETS = {
    software:   { dprCap: 1.0,      maxPixels: 750_000 },
    integrated: { dprCap: 1.0,      maxPixels: 1_200_000 },
    mobile:     { dprCap: 1.5,      maxPixels: 1_500_000 },
    // Masked / unidentified WebGL renderer (e.g. Firefox privacy masking):
    // keeps standard 1080p/1600x900 screens at 100% native while preventing 4K (~8.3M px) stalls.
    unknown:    { dprCap: 1.5,      maxPixels: 1_600_000 },
    discrete:   { dprCap: Infinity, maxPixels: Infinity },
};

const MODE_BUDGETS = {
    high:   { dprCap: Infinity, maxPixels: Infinity,  adaptive: false },
    medium: { dprCap: 1.0,      maxPixels: 1_200_000, adaptive: false },
    low:    { dprCap: 1.0,      maxPixels: 550_000,   adaptive: false },
};

const RE_SOFTWARE = /(swiftshader|llvmpipe|softpipe|basic render driver|software rasterizer|mesa offscreen|microsoft basic)/i;
const RE_MOBILE_UA = /\b(Android|iPad|iPhone|iPod)\b/i;
const RE_MOBILE_GPU = /\b(Mali|Adreno|PowerVR|Immortalis|Xclipse|Tegra|VideoCore)\b/i;
const RE_WEAK_LAPTOP_GPU = /\b(GeForce\s+(MX\d{3}|GT\s+[1-9]\d{2}M?|\d{3}MX?)|NVS\s+\d+|Quadro\s+(K|M|P)[1-6]00M?)\b/i;
const RE_DISCRETE = /\b(NVIDIA|GeForce|RTX|GTX|Quadro|TITAN|Radeon\s+RX|Radeon\s+Pro|FirePro|Radeon\s+VII|Radeon\s+R9|Apple\s+M\d)\b/i;
const RE_INTEL_ARC = /\bIntel\b.*\bArc\b/i;
const RE_INTEL = /\b(Intel|UHD\s+Graphics|HD\s+Graphics|Iris(\(R\))?\s+(Xe|Plus|Pro)?\s*Graphics)\b/i;
const RE_AMD_IGPU = /\b(Radeon\s*(\(TM\)\s*)?Graphics|Radeon\s*(\(TM\)\s*)?Vega|Radeon\s+[678]\d0M|Radeon\s+R[2-8]|Radeon\s+HD\s+[2-8]\d{3}|Picasso|Raven|Renoir|Lucienne|Cezanne|Barcelo|Rembrandt|Phoenix|Mendocino)\b/i;

/**
 * Collect detailed WebGL context capabilities & masked/unmasked GPU strings for diagnostics.
 * Safe against restricted or null contexts.
 */
export function collectWebGLInfo(gl) {
    const out = {
        webglVersion: '',
        version: '',
        shadingLanguageVersion: '',
        vendor: '',
        renderer: '',
        unmaskedVendor: '',
        unmaskedRenderer: '',
        maxTextureSize: 0,
        maxViewportDims: null,
        maxRenderbufferSize: 0,
    };
    if (!gl) return out;

    const isWebGL2 = (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext)
        || (typeof gl.drawBuffers === 'function' && typeof gl.createVertexArray === 'function');
    out.webglVersion = isWebGL2 ? 'WebGL 2.0' : 'WebGL 1.0';

    const safeParam = (pname) => {
        try { return gl.getParameter(pname); } catch (_) { return null; }
    };

    out.version = String(safeParam(gl.VERSION) || '');
    out.shadingLanguageVersion = String(safeParam(gl.SHADING_LANGUAGE_VERSION) || '');
    out.vendor = String(safeParam(gl.VENDOR) || '');
    out.renderer = String(safeParam(gl.RENDERER) || '');
    out.maxTextureSize = Number(safeParam(gl.MAX_TEXTURE_SIZE)) || 0;
    out.maxRenderbufferSize = Number(safeParam(gl.MAX_RENDERBUFFER_SIZE)) || 0;
    const vp = safeParam(gl.MAX_VIEWPORT_DIMS);
    if (vp && vp.length >= 2) {
        out.maxViewportDims = [Number(vp[0]) || 0, Number(vp[1]) || 0];
    }

    try {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
            out.unmaskedVendor = String(safeParam(dbg.UNMASKED_VENDOR_WEBGL) || '');
            out.unmaskedRenderer = String(safeParam(dbg.UNMASKED_RENDERER_WEBGL) || '');
        }
    } catch (_) { /* restricted context */ }

    return out;
}

/**
 * Inspect WebGL renderer metadata + browser hardware hints to classify device GPU tier.
 *
 * @param {WebGL2RenderingContext|WebGLRenderingContext|null} gl
 * @param {object} [env] optional overrides for unit testing
 * @returns {{ tier: 'software'|'mobile'|'integrated'|'unknown'|'discrete', renderer: string, vendor: string, reason: string }}
 */
export function detectDeviceTier(gl, env = {}) {
    let renderer = typeof env.renderer === 'string' ? env.renderer : '';
    let vendor = typeof env.vendor === 'string' ? env.vendor : '';

    if (!renderer && gl) {
        const glInfo = collectWebGLInfo(gl);
        renderer = glInfo.unmaskedRenderer || glInfo.renderer || '';
        vendor = glInfo.unmaskedVendor || glInfo.vendor || '';
    }

    const ua = typeof env.userAgent === 'string'
        ? env.userAgent
        : (globalThis.navigator?.userAgent || '');
    const isCoarseTouch = typeof env.isCoarseTouch === 'boolean'
        ? env.isCoarseTouch
        : !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
    const cores = typeof env.hardwareConcurrency === 'number'
        ? env.hardwareConcurrency
        : (globalThis.navigator?.hardwareConcurrency || 0);
    const mem = typeof env.deviceMemory === 'number'
        ? env.deviceMemory
        : (globalThis.navigator?.deviceMemory || 0);

    if (RE_SOFTWARE.test(renderer)) {
        return { tier: 'software', renderer, vendor, reason: 'software WebGL renderer' };
    }
    if (isCoarseTouch || RE_MOBILE_UA.test(ua) || RE_MOBILE_GPU.test(renderer)) {
        return { tier: 'mobile', renderer, vendor, reason: 'mobile / touch GPU' };
    }
    if (RE_WEAK_LAPTOP_GPU.test(renderer)) {
        return { tier: 'integrated', renderer, vendor, reason: 'entry-level laptop GPU' };
    }
    if (RE_DISCRETE.test(renderer) || RE_INTEL_ARC.test(renderer)) {
        return { tier: 'discrete', renderer, vendor, reason: 'discrete GPU' };
    }
    if (RE_INTEL.test(renderer) || RE_INTEL.test(vendor) || RE_AMD_IGPU.test(renderer)) {
        return { tier: 'integrated', renderer, vendor, reason: 'integrated GPU' };
    }
    if ((cores > 0 && cores <= 4) || (mem > 0 && mem <= 4)) {
        return { tier: 'integrated', renderer, vendor, reason: 'low-core / low-memory device' };
    }
    return { tier: 'unknown', renderer, vendor, reason: 'unidentified / masked WebGL renderer' };
}

/**
 * Compute multiplicative live render scale in (0, 1] relative to native backing pixels
 * (clientWidth * dpr x clientHeight * dpr).
 */
export function computeLiveRenderScale({
    clientWidth,
    clientHeight,
    dpr = 1,
    mode = 'auto',
    tier = 'discrete',
    adaptiveScale = 1,
}) {
    const pr = (Number.isFinite(dpr) && dpr > 0) ? dpr : 1;
    const rawW = Math.floor((clientWidth || 0) * pr);
    const rawH = Math.floor((clientHeight || 0) * pr);
    if (rawW <= 0 || rawH <= 0) return 1;

    const cfg = MODE_BUDGETS[mode] || { ...(TIER_BUDGETS[tier] || TIER_BUDGETS.unknown), adaptive: true };
    let scale = 1;

    if (pr > cfg.dprCap) {
        scale = Math.min(scale, cfg.dprCap / pr);
    }

    if (Number.isFinite(cfg.maxPixels) && cfg.maxPixels > 0) {
        const pixels = (rawW * scale) * (rawH * scale);
        if (pixels > cfg.maxPixels) {
            scale *= Math.sqrt(cfg.maxPixels / pixels);
        }
    }

    if (cfg.adaptive && Number.isFinite(adaptiveScale) && adaptiveScale > 0 && adaptiveScale < 1) {
        scale *= adaptiveScale;
    }

    // Never collapse below 360px on the shorter side (or 1.0 if window itself is smaller) or 0.25x
    const minSide = Math.min(rawW, rawH);
    const minFloor = Math.max(0.25, Math.min(1, 360 / Math.max(1, minSide)));
    return Math.max(minFloor, Math.min(1, scale));
}

/**
 * Tracks live interactive render frame durations (renderStart -> next rAF wall-clock)
 * and steps down live render scale proportionally when frames exceed target latency:
 *  - Mildly slow (> 45 ms / < 22 FPS): steps by 0.78 after ~4 slow frames.
 *  - Very slow  (> 130 ms / < 7.5 FPS): steps by 0.68 after ~2-3 slow frames.
 *  - Severe     (> 300 ms / < 3.3 FPS, e.g. 1-2 FPS on 4K Firefox): steps by 0.55 after 2 frames
 *    (or immediately after 1 frame if > 600 ms).
 *
 * Pending changes are only committed via applyPending() when no gesture is active so
 * AnimatedPointer coordinates never jump mid-drag.
 */
export function createAdaptiveScaler(options = {}) {
    const slowMs = options.slowMs ?? 45;
    const verySlowMs = options.verySlowMs ?? 130;
    const severeMs = options.severeMs ?? 300;
    const extremeMs = options.extremeMs ?? 600;
    const maxValidMs = options.maxValidMs ?? 8000;
    const slowFramesNeeded = options.slowFramesNeeded ?? 4;
    const stepFactor = options.stepFactor ?? 0.78;
    const verySlowStepFactor = options.verySlowStepFactor ?? 0.68;
    const severeStepFactor = options.severeStepFactor ?? 0.55;
    const minScale = options.minScale ?? 0.25;

    let active = 1;
    let pending = 1;
    let slowScore = 0;
    let lastFrameMs = 0;
    let avgFrameMs = 0;
    let sampleCount = 0;

    return {
        recordFrame(deltaMs, continuous = true) {
            if (!continuous || !Number.isFinite(deltaMs) || deltaMs <= 0 || deltaMs >= maxValidMs) {
                slowScore = 0;
                return false;
            }
            lastFrameMs = deltaMs;
            sampleCount++;
            avgFrameMs = sampleCount === 1 ? deltaMs : (avgFrameMs * 0.75 + deltaMs * 0.25);

            if (deltaMs > slowMs) {
                let weight = 1;
                let factor = stepFactor;
                if (deltaMs > extremeMs) {
                    weight = slowFramesNeeded; // 1 frame at < 1.6 FPS steps down immediately
                    factor = severeStepFactor;
                } else if (deltaMs > severeMs) {
                    weight = slowFramesNeeded / 2; // 2 frames at 1.6-3.3 FPS
                    factor = severeStepFactor;
                } else if (deltaMs > verySlowMs) {
                    weight = slowFramesNeeded / 2.5; // 2-3 frames at 3.3-7.5 FPS
                    factor = verySlowStepFactor;
                }
                slowScore += weight;
                if (slowScore >= slowFramesNeeded) {
                    slowScore = 0;
                    const next = Math.max(minScale, Math.round(pending * factor * 1000) / 1000);
                    if (next < pending - 1e-4) {
                        pending = next;
                        return true;
                    }
                }
            } else if (deltaMs < slowMs * 0.65) {
                slowScore = 0;
            } else if (slowScore > 0) {
                slowScore = Math.max(0, slowScore - 0.5);
            }
            return false;
        },
        hasPending: () => pending !== active,
        applyPending() {
            if (pending === active) return false;
            active = pending;
            return true;
        },
        getScale: () => active,
        getPendingScale: () => pending,
        getStats: () => ({
            scale: active,
            pendingScale: pending,
            lastFrameMs,
            avgFrameMs,
            estFps: avgFrameMs > 0 ? Math.min(240, 1000 / avgFrameMs) : 0,
            sampleCount,
        }),
        reset() {
            active = 1;
            pending = 1;
            slowScore = 0;
            lastFrameMs = 0;
            avgFrameMs = 0;
            sampleCount = 0;
        },
    };
}
