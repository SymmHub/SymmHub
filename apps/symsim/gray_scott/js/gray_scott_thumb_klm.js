import {
    appendThumbnails
} from './modules.js'
let presets = [
"par-24-08-27-17-00-39-163",
"par-24-08-27-17-03-38-963",
"par-24-08-27-17-43-34-741",
"par-24-08-27-17-44-57-455",
"par-24-08-27-17-45-55-004",
"par-24-08-27-17-53-23-644",
"par-24-08-27-17-54-06-720",
"par-24-08-27-17-58-27-765",
"par-24-08-27-17-59-17-062",
"par-24-08-27-18-03-06-634",
"par-24-08-27-18-04-11-697",
"par-24-08-28-07-06-23-178",
"par-24-08-28-07-07-19-009",
"par-24-08-28-07-11-23-531",
"par-24-08-28-07-13-13-043",
"par-24-09-03-11-06-36-631",
"par-24-09-03-11-07-40-419",
"par-24-09-03-11-08-47-174",
"par-24-09-03-11-09-57-196",
];

export function init(){
     let list = document.getElementById('list');
     let appPage = 'symsim_gray_scott_klm.html';
     let presetsFolder = 'presets/klm/';
     appendThumbnails(list, appPage, presetsFolder, presets);
}