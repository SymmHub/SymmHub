
import {
    LibShaders,
    ImgShaders,
    buildProgramsCached
} from './modules.js';

const MYNAME = 'att_programs';

const complexFrag = {obj:LibShaders, id:'complex'};
const renderImageVertMain = {obj:LibShaders, id:'canvasVertexShader'};
const isplaneFrag = {obj:LibShaders, id:'isplane'};
const inversiveFrag = {obj:LibShaders, id:'inversiveSampler'};
const utilsFrag = {obj:LibShaders, id:'utils'};


const renderImageFragMain = {obj:ImgShaders, id:'renderImage'};

const renderImageProgram = {
    name: 'renderImage', 
    vs: {frags: [renderImageVertMain]}, 
    fs: {frags: [complexFrag, utilsFrag, isplaneFrag, inversiveFrag, renderImageFragMain]},
};


function programBuilder(){

    const programs = {
       renderImage:  renderImageProgram,
    };
 
    
    function getProgram(gl, progName){
        
        if(false)console.log(`${MYNAME}.getProgram()`, gl, progName);
        
        if(!programs.isReady){
            
            let result = buildProgramsCached(gl, programs);            
            console.log('ready: ', programs);
            programs.isReady = true;            
        }
        let pr = programs[progName];
        if(pr) return pr.program;
        else throw new Error('progrma ${progName} not found');
    }
    
    return  {
        getProgram: getProgram,
    }
} // programBuilder


export const PatternImage_programs = programBuilder();
