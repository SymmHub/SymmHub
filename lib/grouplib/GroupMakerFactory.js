import {
    ObjectFactory,
    Group_WP,
    Group_Frieze,
    Group_Spherical,
    Group_KLM,
    Group_KLMN,    
    Group_5splanes,
    Group_KLx,
    Group_6splanes,
    Group_Cyclic,
    Group_ON,
    Group_s22222,
    Group_22222,
    Group_s222222,
    Group_Grandma,
    Group_Maskit2,
    derivedPresentation,
} from './modules.js';

import { Group_Orbifold } from '../orbilib/orbilib.js';

const DEBUG = true;
const MYNAME = 'GroupMakerFactory';

//
//  orbilib sits below grouplib and has no presentations: the domain of the group gives one
//
class Group_OrbifoldPresented extends Group_Orbifold {

    getPresentation() {
        const name = this._wg.guiParams.name;
        return derivedPresentation(this, { name, family: 'orbifold', key: name });
    }
}

const groupsData = [
    {name: 'Wallpaper',     creator: Group_WP},
    {name: 'Frieze',        creator: Group_Frieze},
    {name: 'Spherical',     creator: Group_Spherical},
    {name: 'KLM',           creator: Group_KLM},
    {name: 'KLMN',          creator: Group_KLMN},
    {name: 'KLx',           creator: Group_KLx},
    {name: '5 Splanes',     creator: Group_5splanes},
    {name: '6 Splanes',     creator: Group_6splanes},
    {name: 'Orbifold',      creator: Group_OrbifoldPresented},
    // groups imported from the Orb repo: inversive parametrizations with bends and twists
    {name: 'Cyclic',        creator: Group_Cyclic},
    {name: 'oN',            creator: Group_ON},
    {name: '*22222',        creator: Group_s22222},
    {name: '22222',         creator: Group_22222},
    {name: '*222222',       creator: Group_s222222},
    // the two-generator groups of Grandma's recipe (Indra's Pearls, Box 21)
    {name: 'Grandma',       creator: Group_Grandma},
    // Maskit's twice punctured torus groups (Indra's Pearls p. 367)
    {name: 'Maskit 2-torus', creator: Group_Maskit2},
]
    
    
function GroupMakerFactory(args={}){    

    let defName = (args.defaultName)?args.defaultName : groupsData[0].name;
    
    return ObjectFactory({infoArray: groupsData, defaultName: defName});
}


export {
    GroupMakerFactory
}

