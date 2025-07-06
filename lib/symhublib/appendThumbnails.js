export function appendThumbnails(elem, appPage, presetsFolder, presets, thumb_class='thumbnail'){
    if(typeof presets === 'string'){
        presets = getPresetsArray(presets);
    }
    if(!(presets instanceof Array)){
        throw new Error('presets should be array but got this: ' + presets);
    }
    //console.log('presets type: ', typeof presets);
    for(let i = 0; i < presets.length; i++){
        appendEntry(elem, appPage, presetsFolder,presets[i],thumb_class);
    }
}


function appendEntry(elem, appPage, folder, name, thumb_class){
    let doc = document;
    let a = doc.createElement('a');
    let href = appPage + '#';
    href += '{"preset":"' + folder + name + '.json"}';        
    a.setAttribute('href', href);
    a.setAttribute('target', 'SYMSIM');
    elem.appendChild(a);
    let img = doc.createElement('img');
    img.setAttribute('src',folder + name + '.json.png');
    img.setAttribute('class', thumb_class);
    a.appendChild(img);
}

/*
    <a href='symsim_gray_scott_klm.html#{"preset":"presets/gray-scott/klm/par-24-08-27-17-59-17-062.json"}' 
        target='SYMSIM'>
        <img src = 'presets/gray-scott/klm/par-24-08-27-17-59-17-062.json.png'>
    </a>
*/

//
//  extended with of thumbnails generator 
//
export function appendThumbnails2(options){
    let elem = options.elem;
    if(!elem) elem = document.body;
        
    let presetsString = options.presetsString;
    let presets = null;
    if(presetsString){
        presets = getPresetsArray(presetsString);
    }
    if(!presets && options.presets){
        presets = options.presets;
    }
    if(!(presets instanceof Array)){
        throw new Error('presets should be array but got this: ' + presets);
    }
    
    let page = options.page;
    if(!page) page = 'application.html';
    let target = options.target;
    if(!target) target = '_blank';
    let folder = options.folder;
    
    
    for(let i = 0; i < presets.length; i++){
        appendEntry2(elem, page, folder, target, presets[i]);
    }    
}

function appendEntry2(elem, page, folder, target, name){
    let doc = document;    
    
    let container = doc.createElement('div');
    container.setAttribute('class', 'thumbnail-container');
        
    let a = doc.createElement('a');
    
    let href = page + '#';
    href += '{"preset":"' + folder + name + '.json"}';        
    a.setAttribute('href', href);
    a.setAttribute('target', target);
    
    container.appendChild(a);
    
    let img = doc.createElement('img');
    img.setAttribute('src',folder + name + '.json.png');
    img.setAttribute('class', 'thumbnail-image');
    a.appendChild(img);
    
    let caption = doc.createElement('div');
    caption.setAttribute('class', 'thumbnail-caption');
    caption.appendChild(doc.createTextNode(getShortName(name, 18)));
    
    container.appendChild(caption);
    elem.appendChild(container);
    
}

function getShortName(name, maxLength){
    if(name.length > maxLength){
        return name.substring(0, maxLength) + '...';
    } else {
        return name;
    }
}
/*
<div class="thumbnail-container">
    <a href='symsim_gray_scott_klm.html' target='SYMSIM'>
    <img src = 'img/par-25-05-02-14-45-10-789.json.png' class = "thumbnail-image">
    </a>
    <div class="thumbnail-caption">par-25-05-02-14-45...</div>
</div>            
*/
//
// convert directory list in template string into array of file names without extensions
//
function getPresetsArray(str){
    let sa = str.split('\n');
    let pa = [];
    // remove empty strings 
    sa.forEach((e)=>{if(e.length > 0) pa.push(e.split('.')[0]);});
    return pa;
}


export function makeSamplesArray(preStr, folder=''){

    let pa = getPresetsArray(preStr);
    
    function smp(name){
        
        let preFile = folder + name + '.json';
        return {
            name: name,
            url:  preFile + '.png',
            data: {
                jsonUrl:  preFile, isSample: true,
            }
        }
    }
    
    let s = [];
    for(let i = 0; i < pa.length; i++){
        s.push(smp(pa[i]));
    }
   return s; 
}


