import {
    resources as tex_haeckel_kunst
} from './tex_haeckel_kunst.js';

import {
    resources as tex_haeckel_challenger
} from './tex_haeckel_challenger.js';
const MYPATH = new URL('./', import.meta.url).pathname;

console.log('textures MYPATH: ', MYPATH);

export const textures = {
   haeckel_kunst: getTexInfoArray(tex_haeckel_kunst, MYPATH + 'haeckel_kunst/'),
   haeckel_challenger: getTexInfoArray(tex_haeckel_challenger, MYPATH + 'haeckel_challenger/'),
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

