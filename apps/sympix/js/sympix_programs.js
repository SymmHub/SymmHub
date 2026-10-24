
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
const fragColorUtils        = {obj:LibShaders, id: 'colorUtils'};

const renderImageFragMain   = {obj:LocalShaders, id:'renderImage'};
const fragBaseVertex        = {obj:LocalShaders, id: 'canvasVertexShader'};






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

// the programs of Color Images and Color Tiles are in lib/symhublib/ColorSymPrograms.js

const programs =
{
    'renderImage':              renderImageProgram,
    'bufferToScreenImageArray': progBufferToScreenImageArray,
};

export const Sympix_programs = programBuilder(programs);


