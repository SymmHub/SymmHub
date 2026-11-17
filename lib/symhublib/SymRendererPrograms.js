import {
    ShaderFragments as SF,
    programBuilder,
    ColormapFragments,
} from './modules.js';

const ColormapShaderObj = {
    name: 'ColormapsFragments',
    getName: () => 'ColormapsFragments',
    'colormap': ColormapFragments.cm_fragment
};

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

const fragColormap = {
    obj: ColormapShaderObj,
    id: 'colormap'
};

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
const fragBufferToScreenImageArray = {
    obj: SF,
    id: 'bufferToScreenImageArray'
};
//
//  Placed FIRST in a fragment list it turns on the bounded-wall code in
//  inversiveSampler - see wall_bounds_define.glsl.mjs.  Only the programs a
//  group with bounded walls (an orbifold with a handle or a second crosscap)
//  asks for carry it; every other program compiles exactly as before.
//
const fragWallBoundsDefine = {
    obj: SF,
    id: 'wall_bounds_define'
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

const progBufferToScreenImageArray = {
    name: 'BufferToScreenImageArray',
    vs: baseVertexShader,
    fs: {
        frags: [fragIsplane, fragInversiveSampler, fragComplex, fragUtils, fragTexUtils, fragProjection, fragBufferToScreenImageArray]
    }
};

//
//  Same program, compiled with the wall bounds switched on.  Used in place of
//  the above when the group's sides are bounded stretches of a wall, which
//  only an orbifold's are - see VisualizationImage.
//
const progBufferToScreenImageArrayWalled = {
    name: 'BufferToScreenImageArrayWalled',
    vs: baseVertexShader,
    fs: {
        frags: [fragWallBoundsDefine, fragIsplane, fragInversiveSampler, fragComplex, fragUtils, fragTexUtils, fragProjection, fragBufferToScreenImageArray]
    }
};

const progBufferVisColormap = {
    name: 'BufferVisColormap',
    vs: baseVertexShader,
    fs: {
        frags: [fragComplex, fragTexUtils, fragColormap, fragBufferVisColormap]
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

//
//  overlay items (VisualizationOverlay): one program per item kind, made of the
//  shared fragments, the shared prologue, the subgroup symmetry, the kind's
//  fragment and the shared main
//
const fragOverlayPre  = {obj: SF, id: 'overlay_pre'};
const fragOverlaySub  = {obj: SF, id: 'overlay_subgroup'};
const fragOverlayMain = {obj: SF, id: 'overlay_main'};

function overlayItemProgram(name, kindFragId, walled = false){
    const frags = [fragIsplane, fragUtils, fragInversiveSampler, fragComplex, fragTexUtils,
                   fragProjection, fragIsoUtil, fragGridUtil,
                   fragOverlayPre, fragOverlaySub, {obj: SF, id: kindFragId}, fragOverlayMain];
    return {
        name: name,
        vs: baseVertexShader,
        fs: {
            frags: walled ? [fragWallBoundsDefine, ...frags] : frags
        }
    };
}

let gPrograms = {

    'bufferToScreenImage':      progBufferToScreenImage,    // used 
    'bufferToScreenImageArray': progBufferToScreenImageArray, // used
    'bufferToScreenImageArrayWalled': progBufferToScreenImageArrayWalled, // bounded walls (orbifold)
    'bufferToScreenColormap':   progBufferToScreenColormap, // used
    'bufferToScreenTextured':   progBufferToScreenTextured, // used 
    'bufferToScreenBumpmap' :   progBufferToScreenBumpmap,  // used 
    'copy':                     progCopy,
    'bufferVisColormap':        progBufferVisColormap,  // used 
    'bufferVisHieghtmap':       progBufferVisHeightmap, // used 
    'bufferVisTextured':        progBufferVisTextured,  // used 
    'overlay':                  progOverlay,            // legacy single pass overlay, unused since the overlay items
    // overlay items
    'overlayIsolines':          overlayItemProgram('OverlayIsolines',   'overlay_isolines'),
    'overlayTiling':            overlayItemProgram('OverlayTiling',     'overlay_tiling'),
    'overlayLimitset':          overlayItemProgram('OverlayLimitset',   'overlay_limitset'),
    'overlayFundDomain':        overlayItemProgram('OverlayFundDomain', 'overlay_funddomain'),
    'overlayGenerators':        overlayItemProgram('OverlayGenerators', 'overlay_generators'),
    'overlayBuffer':            overlayItemProgram('OverlayBuffer',     'overlay_buffer'),
    'overlayWorldGrid':         overlayItemProgram('OverlayWorldGrid',  'overlay_worldgrid'),
    'overlayScreenGrid':        overlayItemProgram('OverlayScreenGrid', 'overlay_screengrid'),

    // ── bounded-wall variants, compiled only if an orbifold group asks for one.
    //    Just the items which read the domain: the three which fold a point
    //    into it, and the one which measures its distance to it.  The rest
    //    (generators, buffer, grids) never touch the sides.
    'overlayTilingWalled':      overlayItemProgram('OverlayTilingWalled',     'overlay_tiling',     true),
    'overlayIsolinesWalled':    overlayItemProgram('OverlayIsolinesWalled',   'overlay_isolines',   true),
    'overlayLimitsetWalled':    overlayItemProgram('OverlayLimitsetWalled',   'overlay_limitset',   true),
    'overlayFundDomainWalled':  overlayItemProgram('OverlayFundDomainWalled', 'overlay_funddomain', true),

};

//
//  Programs which have a bounded-wall twin: name -> walled name.  A caller with
//  a group whose sides carry bounds asks for the twin instead.
//
const gWalledPrograms = {
    'bufferToScreenImageArray': 'bufferToScreenImageArrayWalled',
    'overlayTiling':            'overlayTilingWalled',
    'overlayIsolines':          'overlayIsolinesWalled',
    'overlayLimitset':          'overlayLimitsetWalled',
    'overlayFundDomain':        'overlayFundDomainWalled',
};

/**
  The program to use for `name` when the group's walls are bounded.

  `walled` is normally `group.getFundDomainWalls() !== undefined` - true only
  for an orbifold whose fundamental domain has sides sharing a wall.  A program
  with no walled twin, and every caller with an ordinary group, gets `name`
  back unchanged.
*/
function walledProgramName(name, walled){
    if(!walled) return name;
    return gWalledPrograms[name] || name;
}

const MYNAME = 'SymRendererPrograms';


function createProgramsInstance(){

    const pb = programBuilder(gPrograms, /* compileAll = */ false);
    let mGL = null;

    function init(gl){
        if(mGL) {
            console.error(`${MYNAME}.init() multiple calls`);
            return;
        }
        mGL = gl;
        // Lazy compilation: each program is compiled on its first getProgram() call.
    }

    function getProgram(name){
        if(!mGL) {
            console.error(`${MYNAME} getProgram(${name}) mGL is not defined`);
            return null;
        }
        return pb.getProgram(mGL, name);
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
    walledProgramName,
};
