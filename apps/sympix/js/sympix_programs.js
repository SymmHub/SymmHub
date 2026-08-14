
import {
    LibShaders,
    ImgShaders as LocalShaders,
    programBuilder,
} from './modules.js';



const renderImageVertMain   = {obj:LibShaders, id:'canvasVertexShader'};
const complexFrag           = {obj:LibShaders, id:'complex'};
const isplaneFrag           = {obj:LibShaders, id:'isplane'};
const inversiveFrag         = {obj:LibShaders, id:'inversiveSampler'};
const utilsFrag             = {obj:LibShaders, id:'utils'};
const fragIsplane           = {obj:LibShaders, id: 'isplane'};
const fragComplex           = {obj:LibShaders, id: 'complex'};
const fragTexUtils          = {obj:LibShaders, id: 'texUtils'};
const fragProjection        = {obj:LibShaders, id: 'projection'};
const fragBufferToScreenImageArray = {obj:LibShaders, id: 'bufferToScreenImageArray'};

const renderImageFragMain   = {obj:LocalShaders, id:'renderImage'};
const fragBaseVertex        = {obj:LocalShaders, id: 'canvasVertexShader'};
const fragPermutations24    = {obj:LocalShaders, id: 'permutations24'};
const colorImageArrayFrag   = {obj:LocalShaders, id: 'colorImageArray'};
const colorTilesFrag        = {obj:LocalShaders, id: 'colorTiles'};
const fragColorUtils        = {obj:LocalShaders, id: 'colorUtils'};






const renderImageProgram = {
    name: 'renderImage', 
    vs: {frags: [renderImageVertMain]}, 
    fs: {frags: [complexFrag, utilsFrag, isplaneFrag, inversiveFrag, fragColorUtils, renderImageFragMain]},
};

const progBufferToScreenImageArray = {
    name: 'BufferToScreenImageArray',
    vs: {frags: [renderImageVertMain]}, 
    fs: {
        frags: [fragIsplane, inversiveFrag, fragComplex, utilsFrag, fragTexUtils, fragProjection, fragBufferToScreenImageArray]
    }
};

const colorImageArrayProgram = {
    name: 'ColorImageArray',
    vs: {frags: [renderImageVertMain]}, 
    fs: {
        frags: [fragIsplane, inversiveFrag, fragComplex, utilsFrag, fragTexUtils, fragProjection, fragPermutations24, fragColorUtils, colorImageArrayFrag]
    }
};

const colorTilesProgram = {
    name: 'ColorTiles',
    vs: {frags: [renderImageVertMain]}, 
    fs: {
        frags: [fragIsplane, inversiveFrag, fragComplex, utilsFrag, fragProjection, fragPermutations24, colorTilesFrag]
    }
};

const programs = 
{
    'renderImage':              renderImageProgram, 
    'bufferToScreenImageArray': progBufferToScreenImageArray,
    'colorImageArray':          colorImageArrayProgram,
    'colorTiles':               colorTilesProgram,
};

export const Sympix_programs = programBuilder(programs);


