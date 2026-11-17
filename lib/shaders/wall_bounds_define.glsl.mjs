/**
 * A one-line fragment which turns on the bounded-wall code in inversiveSampler.
 *
 * Place it FIRST in a program's fragment list: everything after it compiles
 * with USE_WALL_BOUNDS defined, so the fundamental-domain reduction, the
 * interior density and the distance-to-domain all check each wall's bounds, and
 * the program gains a uWallBoundsData sampler (see
 * DataPacking.packWallBoundsToSampler).
 *
 * Only an orbifold group has bounded walls; every other program leaves this
 * fragment out and the preprocessor strips the bounds code entirely, so those
 * shaders are unchanged - not merely equivalent.
 */
export const wall_bounds_define =
/*glsl*/`
#define USE_WALL_BOUNDS 1
`;
