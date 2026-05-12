/**
 * orblib.js — public entry point for the orbilib library.
 *
 * External consumers (GroupMakerFactory, apps) import from here.
 * Internal files import from ./modules.js instead.
 */

// GroupMaker-compatible adapter — primary export for GroupMakerFactory
export { Group_Orbifold } from './Group_Orbifold.js';

// Lower-level API for apps / tools that drive the geometrization directly
export {
    WallPaperGroup_General,
    TWISTMAXVALUE, TWISTMINVALUE,
    LENGTHMAXVALUE, LENGTHMINVALUE,
} from './WallPaperGroup_General.js';

export {
    produceGenerators,
    willOrbifoldFitQ,
    hashOrbifoldString,
    assembleFundamentalDomain,
    calcCrownTransformsDataFromTransform,
    getTransformsForTexture,
    resetTransformfromPtAndTransform,
    getAngleOfTransform,
    getAngleOfTurn,
    lengthKeys,
    twistKeys,
} from './OrbifoldGeometrization.js';
