import {
    ShaderFragments as SF,
    buildProgramsCached,
    Colormaps, 
}from './modules.js';


const fragGsScreen = {
    obj: SF,
    id: 'screenShader'
};
const fragBaseVertex = {
    obj: SF,
    id: 'canvasVertexShader'
};
const fragComplex = {
    obj: SF,
    id: 'complex'
};
const fragUtils = {
    obj: SF,
    id: 'utils'
};
const fragDrawTexture = {
    obj: SF,
    id: 'drawTextureShader'
};
const fragIsplane = {
    obj: SF,
    id: 'isplane'
};
const fragInversiveSampler = {
    obj: SF,
    id: 'inversiveSampler'
};
const fragDrawFdSampler = {
    obj: SF,
    id: 'fundDomainSamplerShader'
};
const fragTexture = {
    obj: SF,
    id: 'texture'
};

const fragIsoMain = {obj: SF,id: 'iso_main'};
const fragIsoUtil = {obj: SF, id: 'iso_util'};
const fragGridUtil = {obj: SF, id: 'grid_util'};

const fragColormap = Colormaps.shaders['colormap'];

const fragBufferVisColormap = {
    obj: SF,
    id: 'bufferVisColormap'
};

const fragBufferVisHeightmap = {
    obj: SF,
    id: 'bufferVisHeightmap'
};

const fragBufferVisTextured = {
    obj: SF,
    id: 'bufferVisTextured'
};

const fragBufferToScreenImage = {
    obj: SF,
    id: 'bufferToScreenImage'
};
const fragBufferToScreenColormap = {
    obj: SF,
    id: 'bufferToScreenColormap'
};
const fragBufferToScreenTextured = {
    obj: SF,
    id: 'bufferToScreenTextured'
};
const fragBufferToScreenBumpmap = {
    obj: SF,
    id: 'bufferToScreenBumpmap'
};
const fragProjection = {
    obj: SF,
    id: 'projection'
};
const fragTexUtils = {
    obj: SF,
    id: 'texUtils'
};

const fragCopyShader = {
    obj: SF,
    id: 'copyShader'
};

let baseVertexShader = {
    frags: [fragBaseVertex],
};

const progBufferToScreenColormap = {
    name: 'BufferToScreen',
    vs: baseVertexShader,
    fs: {
        frags: [fragIsplane, fragInversiveSampler, fragComplex, fragTexUtils, fragColormap, fragProjection, fragBufferToScreenColormap]
    }
};

const progBufferToScreenImage = {
    name: 'BufferToScreenImage',
    vs: baseVertexShader,
    fs: {
        frags: [fragIsplane, fragInversiveSampler, fragComplex, fragTexUtils, fragProjection, fragBufferToScreenImage]
    }
};

const progBufferVisColormap = {
    name: 'BufferVisColormap',
    vs: baseVertexShader,
    fs: {
        frags: [fragColormap, fragBufferVisColormap]
    }
};

const progBufferVisHeightmap = {
    name: 'BufferVisHeightmap',
    vs: baseVertexShader,
    fs: {
        frags: [fragComplex,fragTexUtils, fragBufferVisHeightmap]
    }
};

const progBufferVisTextured = {
    name: 'BufferVisTextured',
    vs: baseVertexShader,
    fs: {
        frags: [fragComplex,fragBufferVisTextured]
    }
};

const progBufferToScreenTextured = {
    name: 'BufferToScreenTextured',
    vs: baseVertexShader,
    fs: {
        frags: [fragIsplane, fragUtils, fragInversiveSampler, fragComplex, fragColormap, fragProjection, fragBufferToScreenTextured]
    }
};

const progBufferToScreenBumpmap = {
    name: 'BufferToScreen',
    vs: baseVertexShader,
    fs: {
        frags: [fragIsplane, fragInversiveSampler, fragComplex, fragColormap, fragTexUtils,
                fragProjection, fragBufferToScreenBumpmap]
    }
};

const progDrawFdSampler = {
    name: 'DrawFDSampler',
    vs: baseVertexShader,
    fs: {
        frags: [fragIsplane, fragInversiveSampler, fragDrawFdSampler]
    }
};

const progOverlay = {
    name: 'Overlay',
    vs: baseVertexShader,
    fs: {
        frags: [fragIsplane, fragUtils, fragInversiveSampler, fragComplex, fragTexUtils,
                fragProjection, 
                fragIsoUtil, fragGridUtil, fragIsoMain]
    }
};

const progCopy = {
    name: 'Copy',
    vs: baseVertexShader,
    fs: {
        frags: [fragCopyShader]
    }
};

let gPrograms = {

    'bufferToScreenImage':      progBufferToScreenImage,    // used 
    'bufferToScreenColormap':   progBufferToScreenColormap, // used
    'bufferToScreenTextured':   progBufferToScreenTextured, // used 
    'bufferToScreenBumpmap' :   progBufferToScreenBumpmap,  // used 
    'copy':                     progCopy,
    'bufferVisColormap':        progBufferVisColormap,  // used 
    'bufferVisHieghtmap':       progBufferVisHeightmap, // used 
    'bufferVisT3extured':       progBufferVisTextured,  // used 
    'overlay':                  progOverlay,            // used
    
};

const MYNAME = 'SymRendererPrograms';


function createProgramsInstance(){
    
    let mGL = null;
    
    function init(gl){
        
        if(mGL) {
            console.error(`${MYNAME}.init() multiple calls`);            
            return;
        }
        mGL = gl;
        
        let result = buildProgramsCached(mGL, gPrograms);
        if (!result) {
            console.error(`${MYNAME}.buildProgramsCached() result: ${result}`);
            return;
        }
                
    }

    function getProgram(name){
        
        if(!mGL) {
            console.error(`${MYNAME} getProram(${name}) mGL is not defined`);
            return null;            
        }
        let pr = gPrograms[name];
        if(!pr){
            console.error('program not found: ', name);
            return null;
        }
        return gPrograms[name].program;
        
    }
    
    return {
        init: init,
        getProgram: getProgram,
    }
}

//
// simngle instance of the programs 
//
let sProgramsInstance = null;

function SymRendererPrograms(){
    
   if(!sProgramsInstance)
       sProgramsInstance = createProgramsInstance();
   
    return sProgramsInstance;
}

export {
    SymRendererPrograms,
};