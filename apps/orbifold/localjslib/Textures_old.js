import {TEX_CAMERA} from '../../library/jslibm/PatternTextures.js';



export const Textures = {
    //
    // list of texures to use
    // each texture entry has is array object {name:diplay_name, path:path} 
    // name is optional, if missing it will be constructed from path 
    //
    t1:[
      {name:'maroon arrow',path:'../library/images/arrows/'+'arrow_maroon.png'},
      {name:'red arrow',path:'../library/images/arrows/'+'arrow_red.png'},
      {name:'olive arrow',path:'../library/images/arrows/'+'arrow_olive.png'},
      {name:'yellow arrow',path:'../library/images/arrows/'+'arrow_yellow.png'},
      {name:'green arrow',path:'../library/images/arrows/'+'arrow_green.png'},
      {name:'lime arrow',path:'../library/images/arrows/'+'arrow_lime.png'},
      {name:'teal arrow',path: '../library/images/arrows/'+'arrow_teal.png'},
      {name:'aqua arrow',path:'../library/images/arrows/'+'arrow_aqua.png'},
      {name:'navy arrow',path:'../library/images/arrows/'+'arrow_navy.png'},
      {name:'blue arrow',path:'../library/images/arrows/'+'arrow_blue.png'},
      {name:'purple arrow',path:'../library/images/arrows/'+'arrow_purple.png'},
      {name:'magenta arrow',path:'../library/images/arrows/'+'arrow_magenta.png'},
      {name:'orange arrow',path:'../library/images/arrows/'+'arrow_orange.png'},
      {name:'black arrow',path:'../library/images/arrows/'+'arrow_black.png'},
      {name:'gray arrow',path:'../library/images/arrows/'+'arrow_gray.png'},
      {name:'silver arrow',path:'../library/images/arrows/'+'arrow_silver.png'},
      {name:'white arrow',path:'../library/images/arrows/'+'arrow_white.png'},
      {name:'pink arrow',path:'../library/images/arrows/'+'arrow_pink.png'},
      
    ],
    t2:[
      {name:'web cam',path:'[camera]'},            
      {name:'haeckel 01',path:'../library/images/haeckel/haeckel_01.png'},
      {name:'haeckel 02',path:'../library/images/haeckel/haeckel_02.png'},
      {name:'haeckel 03',path:'../library/images/haeckel/haeckel_03.png'},
      {name:'haeckel 04',path:'../library/images/haeckel/haeckel_04.png'},
      {name:'haeckel 05',path:'../library/images/haeckel/haeckel_05.png'},
      {name:'haeckel 06',path:'../library/images/haeckel/haeckel_06.png'},
      {name:'haeckel 07',path:'../library/images/haeckel/haeckel_07.png'},
      {name:'haeckel 08',path:'../library/images/haeckel/haeckel_08.png'},
      {name:'haeckel 09',path:'../library/images/haeckel/haeckel_09.png'},
      {name:'haeckel 10',path:'../library/images/haeckel/haeckel_10.png'},
      {name:'haeckel 11',path:'../library/images/haeckel/haeckel_11.png'},
      {name:'haeckel 12',path:'../library/images/haeckel/haeckel_12.png'},
      {name:'haeckel 13',path:'../library/images/haeckel/haeckel_13.png'},
      {name:'haeckel 14',path:'../library/images/haeckel/haeckel_14.png'},
      {name:'haeckel 15',path:'../library/images/haeckel/haeckel_15.png'},
      {name:'haeckel 16',path:'../library/images/haeckel/haeckel_16.png'},
      {name:'haeckel 17',path:'../library/images/haeckel/haeckel_17.png'},
      {name:'haeckel 18',path:'../library/images/haeckel/haeckel_18.png'},
      {name:'haeckel 19',path:'../library/images/haeckel/haeckel_19.png'},
      {name:'haeckel 20',path:'../library/images/haeckel/haeckel_20.png'},
      {name:'haeckel 21',path:'../library/images/haeckel/haeckel_21.png'},
      {name:'haeckel 22',path:'../library/images/haeckel/haeckel_22.png'},
      {name:'haeckel 23',path:'../library/images/haeckel/haeckel_23.png'},
      {name:'haeckel 24',path:'../library/images/haeckel/haeckel_24.png'},
      {name:'haeckel 25',path:'../library/images/haeckel/haeckel_25.png'},
      {name:'haeckel 26',path:'../library/images/haeckel/haeckel_26.png'},
      {name:'haeckel 27',path:'../library/images/haeckel/haeckel_27.png'},
      {name:'haeckel 28',path:'../library/images/haeckel/haeckel_28.png'},
      {name:'haeckel 29',path:'../library/images/haeckel/haeckel_29.png'},
      {name:'video 1', path:'../library/video/horo_lambert_333_01.mp4'},
      {name:'video 2', path:'../library/video/horo_lambert_433_01b.mp4'},      
      {name:'video 3', path:'../library/video/horo_lambert_433_01d.mp4'},      
      {name:'video 4', path:'../library/video/horo_lambert_433_01f.mp4'},      
      {name:'video 5', path:'../library/video/horo_tetra_07a.mp4'},      
      {name:'video 6', path:'../library/video/horo_tetra_07b.mp4'},  
      {name:'video 7', path:'../library/video/horo_tetra_07h.webm'},  
    ]
}


Textures.all = Textures.t1.concat(Textures.t2);
