import {
    resources as tex_haeckel_kunst
} from './tex_haeckel_kunst.js';

import {
    resources as tex_haeckel_challenger
} from './tex_haeckel_challenger.js';

import {
    resources as misc
} from './misc.js';
import {
    resources as arrow
} from './arrow.js';
import {
    resources as latin
} from './latin.js';
import {
    resources as greek
} from './greek.js';
import {
    resources as cyrillic
} from './cyrillic.js';


const MYPATH = new URL('./', import.meta.url).pathname;


console.log('textures MYPATH: ', MYPATH);

export const textures = {
    arrow:              getTexInfoArray(arrow, MYPATH + 'arrow/'),
    latin:              getTexInfoArray(latin, MYPATH + 'latin/'),
    cyrillic:           getTexInfoArray(cyrillic, MYPATH + 'cyrillic/'),
    greek:              getTexInfoArray(greek, MYPATH + 'greek/'),
    haeckel_kunst:      getTexInfoArray(tex_haeckel_kunst, MYPATH + 'haeckel_kunst/'),
    haeckel_challenger: getTexInfoArray(tex_haeckel_challenger, MYPATH + 'haeckel_challenger/'),
    misc:               getTexInfoArray(misc, MYPATH + 'misc/'),
    
};


function getTexInfoArray(str, path){

    let sa = str.split('\n');
    let pa = [];

    // remove empty strings 
    function appendTexInfo(e){

        if(e.length > 0) {
            let ti = {
                name: e.split('.')[0],
                path: path + e,
            }
            pa.push(ti)
        }
    }

    sa.forEach(appendTexInfo);
    
   // console.log('textures: ', pa);
    return pa;
}

