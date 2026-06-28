
function img(fname){
    
    const ORIG = 'images/orig/';
    const TMB = 'images/orig_tmb/';
    let eind = fname.lastIndexOf('.');
    // check for negative 
    if(eind < 0) eind = fname.length;
    
    let name = fname.substring(0,eind);
    return {
        name: name,
        url:  ORIG + fname,
        tmb:  TMB + fname,
    }
}

let ImgSamples = [
    img('p099_02.png'),
    img('Tafel_075_01.png'),
];


export {
    ImgSamples
}
