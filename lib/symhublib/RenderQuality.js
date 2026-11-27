/**
 * RenderQuality.js
 *
 * Automatic low-end / integrated / mobile / 4K-display live resolution scaling
 * for SymRenderer, paired with gesture-safe adaptive frame-time stepping.
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
const RE_DISCRETE = /\b(NVIDIA|GeForce|RTX|GTX|Quadro|TITAN|Radeon\s+RX|Radeon\s+Pro|FirePro|Radeon\s+VII|Radeon\s+R9|Apple\s+M\d)\b/i;
const RE_INTEL_ARC = /\bIntel\b.*\bArc\b/i;
const RE_INTEL = /\bIntel\b/i;
const RE_AMD_IGPU = /\b(AMD\s+Radeon\(TM\)\s+Graphics|Radeon\(TM\)\s+Vega|Radeon\s+Vega|Radeon\s+R[2-8]|Radeon\s+HD\s+[2-8]\d{3}|Picasso|Raven|Renoir|Lucienne|Cezanne|Barcelo|Rembrandt|Phoenix)\b/i;

/**
 * Inspect WebGL renderer metadata + browser hardware hints to classify device GPU tier.
 *
 * @param {WebGL2RenderingContext|WebGLRenderingContext|null} gl
 * @param {object} [env] optional overrides for unit testing
 * @returns {{ tier: 'software'|'mobile'|'integrated'|'discrete', renderer: string, vendor: string, reason: string }}
 */
export function detectDeviceTier(gl, env = {}) {
    let renderer = typeof env.renderer === 'string' ? env.renderer : '';
    let vendor = typeof env.vendor === 'string' ? env.vendor : '';

    if (!renderer && gl) {
        try {
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            if (dbg) {
                renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
                vendor = String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || '');
            }
            if (!renderer) renderer = String(gl.getParameter(gl.RENDERER) || '');
            if (!vendor) vendor = String(gl.getParameter(gl.VENDOR) || '');
        } catch (e) { /* restricted context */ }
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
    if (RE_DISCRETE.test(renderer) || RE_INTEL_ARC.test(renderer)) {
        return { tier: 'discrete', renderer, vendor, reason: 'discrete GPU' };
    }
    if (RE_INTEL.test(renderer) || RE_INTEL.test(vendor) || RE_AMD_IGPU.test(renderer)) {
        return { tier: 'integrated', renderer, vendor, reason: 'integrated GPU' };
    }
    if ((cores > 0 && cores <= 4) || (mem > 0 && mem <= 4)) {
        return { tier: 'integrated', renderer, vendor, reason: 'low-core / low-memory device' };
    }
    return { tier: 'discrete', renderer, vendor, reason: 'standard desktop GPU' };
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

    const cfg = MODE_BUDGETS[mode] || { ...(TIER_BUDGETS[tier] || TIER_BUDGETS.discrete), adaptive: true };
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
 * Tracks continuous interactive render frame intervals (panning / dragging / animations)
 * and steps down live render scale when sustained frame times exceed slowMs (~22 FPS).
 * Pending changes are only committed via applyPending() when no gesture is active so
 * AnimatedPointer coordinates never jump mid-drag.
 */
export function createAdaptiveScaler(options = {}) {
    const slowMs = options.slowMs ?? 45;
    const slowFramesNeeded = options.slowFramesNeeded ?? 4;
    const stepFactor = options.stepFactor ?? 0.78;
    const minScale = options.minScale ?? 0.45;

    let active = 1;
    let pending = 1;
    let slowStreak = 0;

    return {
        recordFrame(deltaMs, continuous) {
            if (!continuous || !Number.isFinite(deltaMs) || deltaMs <= 0 || deltaMs >= 1000) {
                slowStreak = 0;
                return false;
            }
            if (deltaMs > slowMs) {
                slowStreak++;
                if (slowStreak >= slowFramesNeeded) {
                    slowStreak = 0;
                    const next = Math.max(minScale, Math.round(pending * stepFactor * 1000) / 1000);
                    if (next < pending - 1e-4) {
                        pending = next;
                        return true;
                    }
                }
            } else if (deltaMs < slowMs * 0.65) {
                slowStreak = 0;
            } else if (slowStreak > 0) {
                slowStreak--;
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
        reset() {
            active = 1;
            pending = 1;
            slowStreak = 0;
        },
    };
}
