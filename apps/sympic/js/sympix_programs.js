
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
const fragPermutations      = {obj:LocalShaders, id: 'permutations'};
const colorImageArrayFrag   = {obj:LocalShaders, id: 'colorImageArray'};






const renderImageProgram = {
    name: 'renderImage', 
    vs: {frags: [renderImageVertMain]}, 
    fs: {frags: [complexFrag, utilsFrag, isplaneFrag, inversiveFrag, renderImageFragMain]},
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
        frags: [fragIsplane, inversiveFrag, fragComplex, utilsFrag, fragTexUtils, fragProjection, fragPermutations, colorImageArrayFrag]
    }
};

const programs = 
{
    'renderImage':              renderImageProgram, 
    'bufferToScreenImageArray': progBufferToScreenImageArray,
    'colorImageArray':          colorImageArrayProgram,
};

export const Sympix_programs = programBuilder(programs);


