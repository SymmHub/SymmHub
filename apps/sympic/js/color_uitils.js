function fract(x) {
    return x - Math.floor(x);
}

/**
 * Applies perceptual adjustments to a single color's channels.
 * @param {number} h - Base Hue normalized to [0, 1]
 * @param {number} s - Base Saturation or Chroma (0.0 - 1.0)
 * @param {number} l - Base Lightness (0.0 - 1.0)
 * @param {Object} adj - The transformation parameters
 * @param {number} adj.hueShift - Normalized hue rotation [-1, 1] (1 = full 360° rotation)
 * @param {number} adj.satMult - Multiplier for saturation
 * @param {number} adj.lightOffset - Additive offset for lightness
 * @param {number} adj.contrastMult - Multiplier pushing lightness away from 0.5
 * @returns {Object} { h, s, l } The adjusted color components
 */
function adjustColorHSL(h, s, l, adj) {
    // 1. Hue Shift (normalized [-1, 1])
    let newH = fract(h + (adj.hueShift || 0));

    // 2. Saturation / Chroma (Multiplicative)
    let newS = s * (adj.satMult ?? 1.0);
    // If using OKLCH, you may want to remove the Math.min clamp, 
    // as OKLCH Chroma can occasionally exceed 1.0 depending on the gamut.
    newS = Math.max(0, Math.min(1, newS));

    // 3. Lightness & Contrast
    let newL = l;
    
    // Apply contrast first (scaling away from the 0.5 perceptual midpoint)
    if (adj.contrastMult !== undefined) {
        newL = ((newL - 0.5) * adj.contrastMult) + 0.5;
    }
    
    // Then apply the additive brightness/lightness offset
    if (adj.lightOffset !== undefined) {
        newL += adj.lightOffset;
    }
    
    // Clamp final lightness
    newL = Math.max(0, Math.min(1, newL));

    return { h: newH, s: newS, l: newL };
}

/**
 * Converts an RGB color value to HSL.
 * @param {number} r - Red channel (0.0 to 1.0)
 * @param {number} g - Green channel (0.0 to 1.0)
 * @param {number} b - Blue channel (0.0 to 1.0)
 * @returns {Object} { h: [0.0-1.0], s: [0.0-1.0], l: [0.0-1.0] }
 */
function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        // Achromatic (gray)
        h = 0; 
        s = 0; 
    } else {
        const d = max - min;
        // Calculate saturation based on lightness
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        // Calculate hue based on dominant color channel
        switch (max) {
            case r: 
                h = (g - b) / d + (g < b ? 6 : 0); 
                break;
            case g: 
                h = (b - r) / d + 2; 
                break;
            case b: 
                h = (r - g) / d + 4; 
                break;
        }
        h /= 6; // Convert to [0.0 - 1.0]
    }

    return { h, s, l };
}

/**
 * Converts an HSL color value to RGB.
 * @param {number} h - Hue normalized to [0, 1]
 * @param {number} s - Saturation (0.0 to 1.0)
 * @param {number} l - Lightness (0.0 to 1.0)
 * @returns {Object} { r: [0.0-1.0], g: [0.0-1.0], b: [0.0-1.0] }
 */
function hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
        // Achromatic (gray)
        r = g = b = l; 
    } else {
        const hue2rgb = function(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const normalizedH = h; // Already normalized back to 0.0 - 1.0

        r = hue2rgb(p, q, normalizedH + 1/3);
        g = hue2rgb(p, q, normalizedH);
        b = hue2rgb(p, q, normalizedH - 1/3);
    }

    return { r, g, b };
}

/**
 * Converts an RGB color to HSL, applies perceptual adjustments, and converts back to RGB.
 * @param {number} r - Red channel (0.0 to 1.0)
 * @param {number} g - Green channel (0.0 to 1.0)
 * @param {number} b - Blue channel (0.0 to 1.0)
 * @param {Object} adj - Adjustment parameters (see adjustColorHSL)
 * @returns {Object} { r, g, b } adjusted color in linear RGB
 */
function adjustColorRGB(r, g, b, adj) {
    const hsl = rgbToHsl(r, g, b);
    const aHsl = adjustColorHSL(hsl.h, hsl.s, hsl.l, adj);
    return hslToRgb(aHsl.h, aHsl.s, aHsl.l);
}


// ==========================================
// GAMMA COMPANDING UTILITIES
// ==========================================

function srgbToLinear(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c) {
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// ==========================================
// COLOR SPACE CONVERSIONS (RGB <-> OKLCH)
// ==========================================

/**
 * Converts normalized RGB [0-1] to OKLCH.
 * @param {number} r - Red (0.0 to 1.0)
 * @param {number} g - Green (0.0 to 1.0)
 * @param {number} b - Blue (0.0 to 1.0)
 * @returns {Object} { L: [0-1], C: [0-~0.4], H: [0-1] }
 */
function rgbToOklch(r, g, b) {
    const rL = srgbToLinear(r);
    const gL = srgbToLinear(g);
    const bL = srgbToLinear(b);

    // Linear RGB to LMS cone space
    const l = 0.4122214708 * rL + 0.5363325363 * gL + 0.0514459929 * bL;
    const m = 0.2119034982 * rL + 0.6806995451 * gL + 0.1073969566 * bL;
    const s = 0.0883024619 * rL + 0.2817188376 * gL + 0.6299787005 * bL;

    // Perceptual non-linear cube root scaling
    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);

    // LMS to OKLab (L, okA, okB)
    const L   = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    const okA = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const okB = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086758033 * s_;

    // OKLab to OKLCH (Cylindrical coordinates)
    const C = Math.sqrt(okA * okA + okB * okB);
    let H = Math.atan2(okB, okA) / (2 * Math.PI);
    if (H < 0) H += 1;

    return { L, C, H };
}

/**
 * Converts OKLCH values back to normalized RGB [0-1].
 * @param {number} L - Lightness (0.0 to 1.0)
 * @param {number} C - Chroma (0.0 to ~0.4)
 * @param {number} H - Hue angle normalized to [0, 1]
 * @returns {Object} { r: [0-1], g: [0-1], b: [0-1] }
 */
function oklchToRgb(L, C, H) {
    // OKLCH to OKLab Cartesian coordinates
    const hRad = H * (2 * Math.PI);
    const okA = C * Math.cos(hRad);
    const okB = C * Math.sin(hRad);

    // OKLab to LMS primes
    const l_ = L + 0.3963377774 * okA + 0.2158037573 * okB;
    const m_ = L - 0.1055613458 * okA - 0.0638541728 * okB;
    const s_ = L - 0.0894841775 * okA - 1.2914855480 * okB;

    // Scale back up from cube roots
    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    // LMS to Linear RGB space
    const rL =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gL = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bL = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    // Convert Linear RGB to standard gamma-encoded sRGB, clamped to valid color gamut bounds
    const r = Math.max(0, Math.min(1, linearToSrgb(rL)));
    const g = Math.max(0, Math.min(1, linearToSrgb(gL)));
    const b = Math.max(0, Math.min(1, linearToSrgb(bL)));

    return { r, g, b };
}

// ==========================================
// PALETTE PARAMETRIC ADJUSTMENT ENGINE
// ==========================================

/**
 * Calculates parameter adjustments inside the uniform OKLCH space.
 * @param {number} L - Current Lightness
 * @param {number} C - Current Chroma
 * @param {number} H - Current Hue normalized to [0, 1]
 * @param {Object} adj - Object containing adjustment parameters
 * @param {number} adj.hueShift - Normalized hue rotation [-1, 1] (1 = full 360° rotation)
 * @param {number} adj.satMult - Scalar multiplier for chroma/saturation (e.g. 1.5)
 * @param {number} adj.lightOffset - Brightness offset (-0.5 to 0.5)
 * @param {number} adj.contrastMult - Contrast multiplier (scales distance from midplane 0.5)
 * @returns {Object} { L, C, H } The newly transformed OKLCH properties
 */
function adjustColorOKLCH(L, C, H, adj) {
    // 1. Hue shift (normalized [-1, 1])
    let newH = fract(H + (adj.hueShift || 0));

    // 2. Multiplicative chroma scaling (guarantees gray remains gray)
    let newC = C * (adj.satMult ?? 1.0);
    newC = Math.max(0, newC);

    // 3. Contrast centering around 0.5 midpoint, combined with uniform brightness offsets
    let newL = L;
    if (adj.contrastMult !== undefined) {
        newL = ((newL - 0.5) * adj.contrastMult) + 0.5;
    }
    if (adj.lightOffset !== undefined) {
        newL += adj.lightOffset;
    }
    newL = Math.max(0, Math.min(1, newL));

    return { L: newL, C: newC, H: newH };
}

function adjustColorRGB_OKLCH(r, g, b, adj) {
    const oklch = rgbToOklch(r, g, b);
    const adjustedOklch = adjustColorOKLCH(oklch.L, oklch.C, oklch.H, adj);
    return oklchToRgb(adjustedOklch.L, adjustedOklch.C, adjustedOklch.H);
}


export { adjustColorHSL, adjustColorRGB, adjustColorRGB_OKLCH, rgbToHsl, hslToRgb };
