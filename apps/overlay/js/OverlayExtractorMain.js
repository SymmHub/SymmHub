import {
    OverlayExtractor,
    ImgSamples,
} from './modules.js';         

let overlayExtractor = undefined;

try {
    overlayExtractor = OverlayExtractor({});
    overlayExtractor.run();        

} catch(err){
    console.error('error: ', err);
}

console.log('OverlayExtractorMain()');

let samples = ImgSamples;
setTimeout(()=>overlayExtractor.addImages(samples));
;

window.ondragover = onWinDragOver;
window.ondrop = onWinDragDrop;

function onWinDragDrop(evt){
    console.log('onWinDragDrop()',evt);
    evt.preventDefault();
    var dt = evt.dataTransfer;
    var files = dt.files;
    overlayExtractor.addFiles(files);
}
function onWinDragOver(evt){
    //console.log('onWinDragOver():', evt);        
    evt.preventDefault();
}

            