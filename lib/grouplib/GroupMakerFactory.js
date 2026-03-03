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
} from './modules.js';

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
]
    
    
function GroupMakerFactory(args={}){    

    let defName = (args.defaultName)?args.defaultName : groupsData[0].name;
    
    return ObjectFactory({infoArray: groupsData, defaultName: defName});
}


export {
    GroupMakerFactory
}

