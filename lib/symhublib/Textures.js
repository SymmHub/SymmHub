import {
    TEX_CAMERA
}    from './modules.js';


//const LIB = 'resources/';
//const LIB = 'resources/';
//function resPath(name){    
//    const RESFOLDER = 'res/ui/'; // folder with buttons 
//    return new URL(RESFOLDER + name, import.meta.url).pathname;
//}

const TEXFOLDER = new URL('res/textures/', import.meta.url).pathname;

//const LIB = (Globals.LIBRARY_PATH === undefined)?'/LIBRARY_PATH/':Globals.LIBRARY_PATH;
const LI = TEXFOLDER;
const LH = TEXFOLDER + 'haeckel/';
const LA = TEXFOLDER + 'arrows/';
const LV = TEXFOLDER + 'video/';


export const Textures = {
    //
    // list of texures to use
    // each texture entry has is array object {name:diplay_name, path:path} 
    // name is optional, if missing it will be constructed from path 
    //
    t1:[
      {name:'maroon arrow', path:LA+'arrow_maroon.png'},
      {name:'red arrow',    path:LA+'arrow_red.png'},
      {name:'olive arrow',  path:LA+'arrow_olive.png'},
      {name:'yellow arrow', path:LA+'arrow_yellow.png'},
      {name:'green arrow',  path:LA+'arrow_green.png'},
      {name:'lime arrow',   path:LA+'arrow_lime.png'},
      {name:'teal arrow',   path:LA+'arrow_teal.png'},
      {name:'aqua arrow',   path:LA+'arrow_aqua.png'},
      {name:'navy arrow',   path:LA+'arrow_navy.png'},
      {name:'blue arrow',   path:LA+'arrow_blue.png'},
      {name:'purple arrow', path:LA+'arrow_purple.png'},
      {name:'magenta arrow',path:LA+'arrow_magenta.png'},
      {name:'orange arrow', path:LA+'arrow_orange.png'},
      {name:'black arrow',  path:LA+'arrow_black.png'},
      {name:'gray arrow',   path:LA+'arrow_gray.png'},
      {name:'silver arrow', path:LA+'arrow_silver.png'},
      {name:'white arrow',  path:LA+'arrow_white.png'},
      {name:'pink arrow',   path:LA+'arrow_pink.png'},
      
      {name:'empty',path:LI+'empty.png'},
      
      {name:'web cam',path:TEX_CAMERA},      
    ],
    t2: [
      {name:'haeckel 01',path:LH + 'haeckel_01.png'},
      {name:'haeckel 02',path:LH + 'haeckel_02.png'},
      {name:'haeckel 03',path:LH + 'haeckel_03.png'},
      {name:'haeckel 04',path:LH + 'haeckel_04.png'},
      {name:'haeckel 05',path:LH + 'haeckel_05.png'},
      {name:'haeckel 06',path:LH + 'haeckel_06.png'},
      {name:'haeckel 07',path:LH + 'haeckel_07.png'},
      {name:'haeckel 08',path:LH + 'haeckel_08.png'},
      {name:'haeckel 09',path:LH + 'haeckel_09.png'},
      {name:'haeckel 10',path:LH + 'haeckel_10.png'},
      {name:'haeckel 11',path:LH + 'haeckel_11.png'},
      {name:'haeckel 12',path:LH + 'haeckel_12.png'},
      {name:'haeckel 13',path:LH + 'haeckel_13.png'},
      {name:'haeckel 14',path:LH + 'haeckel_14.png'},
      {name:'haeckel 15',path:LH + 'haeckel_15.png'},
      {name:'haeckel 16',path:LH + 'haeckel_16.png'},
      {name:'haeckel 17',path:LH + 'haeckel_17.png'},
      {name:'haeckel 18',path:LH + 'haeckel_18.png'},
      {name:'haeckel 19',path:LH + 'haeckel_19.png'},
      {name:'haeckel 20',path:LH + 'haeckel_20.png'},
      {name:'haeckel 21',path:LH + 'haeckel_21.png'},
      {name:'haeckel 22',path:LH + 'haeckel_22.png'},
      {name:'haeckel 23',path:LH + 'haeckel_23.png'},
      {name:'haeckel 24',path:LH + 'haeckel_24.png'},
      {name:'haeckel 25',path:LH + 'haeckel_25.png'},
      {name:'haeckel 26',path:LH + 'haeckel_26.png'},
      {name:'haeckel 27',path:LH + 'haeckel_27.png'},
      {name:'haeckel 28',path:LH + 'haeckel_28.png'},
      {name:'haeckel 29',path:LH + 'haeckel_29.png'},
    ],
    
    vt1: [
      {name:'video 1', path:LV + 'horo_lambert_333_01.mp4'},
      {name:'video 2', path:LV + 'horo_lambert_433_01b.mp4'},      
      {name:'video 3', path:LV + 'horo_lambert_433_01d.mp4'},      
      {name:'video 4', path:LV + 'horo_lambert_433_01f.mp4'},      
      {name:'video 5', path:LV + 'horo_tetra_07a.mp4'},      
      {name:'video 6', path:LV + 'horo_tetra_07b.mp4'},  
      {name:'video 7', path:LV + 'horo_tetra_07h.webm'},  
      
    ],
    experimental:  [
        {name:'circles',path: 'images/circles.png'},
        {name:'tiling 0',path: 'images/tiling_00.png'},
        {name:'mandelbrot',path: 'images/mandelbrot.png'},
        {name:'quadrants',path: 'images/quadrants.png'},
        
    ]
}

Textures.all = Textures.t1.concat(Textures.t2, Textures.vt1);
