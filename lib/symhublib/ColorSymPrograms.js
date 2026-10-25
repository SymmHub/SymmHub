import {
    ShaderFragments as SF,
    programBuilder,
} from './modules.js';

//
//  programs of the color symmetry layers: Color Images (VisualizationColorSym)
//  and Color Tiles (VisualizationColorTiles)
//

const fragBaseVertex     = {obj: SF, id: 'canvasVertexShader'};
const fragIsplane        = {obj: SF, id: 'isplane'};
const fragInversive      = {obj: SF, id: 'inversiveSampler'};
const fragComplex        = {obj: SF, id: 'complex'};
const fragUtils          = {obj: SF, id: 'utils'};
const fragTexUtils       = {obj: SF, id: 'texUtils'};
const fragProjection     = {obj: SF, id: 'projection'};
const fragPermutations24 = {obj: SF, id: 'permutations24'};
const fragColorUtils     = {obj: SF, id: 'colorUtils'};
const fragColorImageArray = {obj: SF, id: 'colorImageArray'};
const fragColorImageSprites = {obj: SF, id: 'colorImageSprites'};
const fragColorTiles     = {obj: SF, id: 'colorTiles'};

const colorImageArrayProgram = {
    name: 'ColorImageArray',
    vs: {frags: [fragBaseVertex]},
    fs: {
        frags: [fragIsplane, fragInversive, fragComplex, fragUtils, fragTexUtils, fragProjection, fragPermutations24, fragColorUtils, fragColorImageArray]
    }
};

// Color Images of sprites (a drawing's items in buffers of their own)
const colorImageSpritesProgram = {
    name: 'ColorImageSprites',
    vs: {frags: [fragBaseVertex]},
    fs: {
        frags: [fragIsplane, fragInversive, fragComplex, fragUtils, fragTexUtils, fragProjection, fragPermutations24, fragColorUtils, fragColorImageSprites]
    }
};

const colorTilesProgram = {
    name: 'ColorTiles',
    vs: {frags: [fragBaseVertex]},
    fs: {
        frags: [fragIsplane, fragInversive, fragComplex, fragUtils, fragProjection, fragPermutations24, fragColorTiles]
    }
};

const programs = {
    'colorImageArray':  colorImageArrayProgram,
    'colorImageSprites': colorImageSpritesProgram,
    'colorTiles':       colorTilesProgram,
};

export const ColorSymPrograms = programBuilder(programs);
