export function appendThumbnails(elem, appPage, presetsFolder, presets){
    if(typeof presets === 'string'){
        presets = getPresetsArray(presets);
    }
    if(!(presets instanceof Array)){
        throw new Error('presets should be array but got this: ' + presets);
    }
    //console.log('presets type: ', typeof presets);
    for(let i = 0; i < presets.length; i++){
        appendEntry(elem, appPage, presetsFolder,presets[i]);
    }
}

function appendEntry(elem, appPage, folder, name){
    let doc = document;
    let a = doc.createElement('a');
    let href = appPage + '#';
    href += '{"preset":"' + folder + name + '.json"}';        
    a.setAttribute('href', href);
    a.setAttribute('target', 'SYMSIM');
    elem.appendChild(a);
    let img = doc.createElement('img');
    img.setAttribute('src',folder + name + '.json.png');
    img.setAttribute('class', 'thumbnail');
    a.appendChild(img);
}

/*
    <a href='symsim_gray_scott_klm.html#{"preset":"presets/gray-scott/klm/par-24-08-27-17-59-17-062.json"}' 
        target='SYMSIM'>
        <img src = 'presets/gray-scott/klm/par-24-08-27-17-59-17-062.json.png'>
    </a>
*/


function getPresetsArray(str){
    let sa = str.split('\n');
    let pa = [];
    // remove empty strings 
    sa.forEach((e)=>{if(e.length > 0) pa.push(e.split('.')[0]);});
    return pa;
}


