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
} from './modules.js';

import { Group_Orbifold } from '../orbilib/orbilib.js';

const DEBUG = true;
const MYNAME = 'GroupMakerFactory';

const groupsData = [
    {name: 'Wallpaper',     creator: Group_WP},
    {name: 'Frieze',        creator: Group_Frieze},
    {name: 'Spherical',     creator: Group_Spherical},
    {name: 'KLM',           creator: Group_KLM},
    {name: 'KLMN',          creator: Group_KLMN},
    {name: 'KLx',           creator: Group_KLx},
    {name: '5 Splanes',     creator: Group_5splanes},
    {name: '6 Splanes',     creator: Group_6splanes},
    {name: 'Orbifold',      creator: Group_Orbifold},
    // groups imported from the Orb repo: inversive parametrizations with bends and twists
    {name: 'Cyclic',        creator: Group_Cyclic},
    {name: 'oN',            creator: Group_ON},
    {name: '*22222',        creator: Group_s22222},
    {name: '22222',         creator: Group_22222},
    {name: '*222222',       creator: Group_s222222},
]
    
    
function GroupMakerFactory(args={}){    

    let defName = (args.defaultName)?args.defaultName : groupsData[0].name;
    
    return ObjectFactory({infoArray: groupsData, defaultName: defName});
}


export {
    GroupMakerFactory
}

