export const colorUtils =
/*glsl*/`
vec3 srgbToLinear(vec3 c) {
    vec3 low = c / 12.92;
    vec3 high = pow((c + vec3(0.055)) / 1.055, vec3(2.4));
    return mix(high, low, lessThanEqual(c, vec3(0.04045)));
}

vec3 linearToSrgb(vec3 c) {
    vec3 low = c * 12.92;
    vec3 high = 1.055 * pow(c, vec3(1.0 / 2.4)) - vec3(0.055);
    return mix(high, low, lessThanEqual(c, vec3(0.0031308)));
}

vec3 rgb2oklch(vec3 rgb) {
    vec3 rgbL = srgbToLinear(rgb);

    mat3 M_RGB_to_LMS = mat3(
        0.4122214708, 0.2119034982, 0.0883024619,
        0.5363325363, 0.6806995451, 0.2817188376,
        0.0514459929, 0.1073969566, 0.6299787005
    );
    vec3 lms = M_RGB_to_LMS * rgbL;

    vec3 lms_ = sign(lms) * pow(abs(lms), vec3(1.0 / 3.0));

    mat3 M_LMS_to_Lab = mat3(
        0.2104542553, 1.9779984951, 0.0259040371,
        0.7936177850, -2.4285922050, 0.7827717662,
        -0.0040720468, 0.4505937099, -0.8086758033
    );
    vec3 lab = M_LMS_to_Lab * lms_;

    float C = length(lab.yz);
    float H = atan(lab.z, lab.y) / 6.283185307179586;
    if (H < 0.0) H += 1.0;

    return vec3(lab.x, C, H);
}

vec3 oklch2rgb(vec3 oklch) {
    float hRad = oklch.z * 6.283185307179586;
    vec3 lab = vec3(oklch.x, oklch.y * cos(hRad), oklch.y * sin(hRad));

    mat3 M_Lab_to_LMS = mat3(
        1.0, 1.0, 1.0,
        0.3963377774, -0.1055613458, -0.0894841775,
        0.2158037573, -0.0638541728, -1.2914855480
    );
    vec3 lms_ = M_Lab_to_LMS * lab;

    vec3 lms = lms_ * lms_ * lms_;

    mat3 M_LMS_to_RGB = mat3(
        4.0767416621, -1.2684380046, -0.0041960863,
        -3.3077115913, 2.6097574011, -0.7034186147,
        0.2309699292, -0.3413193965, 1.7076147010
    );
    vec3 rgbL = M_LMS_to_RGB * lms;

    return clamp(linearToSrgb(rgbL), 0.0, 1.0);
}

vec3 rgb2hsl(vec3 color) {
    float maxVal = max(max(color.r, color.g), color.b);
    float minVal = min(min(color.r, color.g), color.b);
    float h = 0.0;
    float s = 0.0;
    float l = (maxVal + minVal) * 0.5;

    if (maxVal != minVal) {
        float d = maxVal - minVal;
        s = l > 0.5 ? d / (2.0 - maxVal - minVal) : d / (maxVal + minVal);
        if (maxVal == color.r) {
            h = (color.g - color.b) / d + (color.g < color.b ? 6.0 : 0.0);
        } else if (maxVal == color.g) {
            h = (color.b - color.r) / d + 2.0;
        } else if (maxVal == color.b) {
            h = (color.r - color.g) / d + 4.0;
        }
        h /= 6.0;
    }
    return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
    if (t < 0.5) return q;
    if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    return p;
}

vec3 hsl2rgb(vec3 hsl) {
    vec3 rgb;
    if (hsl.y == 0.0) {
        rgb = vec3(hsl.z); // Achromatic
    } else {
        float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
        float p = 2.0 * hsl.z - q;
        rgb.r = hue2rgb(p, q, hsl.x + 1.0 / 3.0);
        rgb.g = hue2rgb(p, q, hsl.x);
        rgb.b = hue2rgb(p, q, hsl.x - 1.0 / 3.0);
    }
    return rgb;
}
`;
