import {
   isDefined,
   isFunction, 
   compileShader,
   Program, 
} from './modules.js';


const DEBUG = false;

//
//   asynchronously fetch a list of text files 
//   files is array of objects 
//      {url: fileUrl, txt: fileContent}
//     
// https://developer.mozilla.org/en-US/docs/Web/API/Cache 
function fetchTextFiles(files, cbSuccess, cbFailure){
  
  function onFetchSuccess(response){
    
    if(response.ok) {
      if(DEBUG)console.log('success:', response.url);
      return response.text();
    } else {
      console.error(`failed to fetch: ${response.url}`);
      return `file ${response.url} not found`;
    }
    
  }
    
  let proms = [];
  for(const prop in files){    
  
    let file = files[prop]; 
         
    if(true){
    //if(!isDefined(file.txt)){
      
      if(DEBUG)console.log('fetching: ', file.url);
      let prom = fetch(new Request(file.url)).
                      then(onFetchSuccess).
                      then(txt => {file.txt = txt; 
                           return txt;});//.catch(onError);
      proms.push(prom);    
    }
  }
  
  Promise.all(proms).then(cbSuccess, cbFailure);
    
} // function fetchTextFiles




const fetchedFilesCache = {};
//
//
//  
//
function fetchTextFilesCached(files, cbSuccess, cbFailure){
  
  //const DEBUG = false;
  function onFetchSuccess(response){
    
    if(response.ok) {
      if(DEBUG)console.log('success:', response.url);
      return response.text();
    } else {
      if(DEBUG)console.error(`failed to fetch: ${response.url}`);
      return `file ${response.url} not found`;
    }
    
  }
    
  let proms = [];
  for(const prop in files){    
  
    let file = files[prop]; 
             
    if(DEBUG)console.log('fetching: ', file.url);
    let oldFile = fetchedFilesCache[file.url];    
    
    if(isDefined(oldFile)){
      
      let oldProm = oldFile.prom;
      oldProm.then(txt => {file.txt = txt; return txt;});
      proms.push(oldProm);   
      if(DEBUG)console.log('old file:', file.url);
    } else {
     // new file 
      if(DEBUG)console.log('new file: ', file.url);
      let prom1 = fetch(new Request(file.url));
      if(DEBUG)console.log('prom1:', prom1);
      let prom2 = prom1.then(onFetchSuccess);
      prom2.then(txt => {file.txt = txt; return txt;});//.catch(onError);
      proms.push(prom2); 
      if(DEBUG)console.log('saving to cache: ', file.url);
      fetchedFilesCache[file.url] = {prom: prom2};
    }
  }
  
  Promise.all(proms).then(cbSuccess, cbFailure);
    
} // function fetchTextFilesCached()



const MIMETYPE_TEXT = 'text/plain';
const MIMETYPE_APP = 'application/octet-stream';
//
//   different version of file fetching, uses await 
//   it is about twice as slow 
//
async function fetchTextFragments(files, onSuccess, onError){

  let errCount = 0;
  for(const prop in files){    
    let file = files[prop]; 
    if(DEBUG)console.log(`fetching "${file.url}"`); 
    let res = await fetch(file.url);
    
    if(res.status == 200){     
      const contentType = res.headers.get('Content-Type');
      if( (MIMETYPE_TEXT == contentType ||  MIMETYPE_APP == contentType)) {
        file.txt = (await res.text());
      } else {
        console.error(`  error: unrecognized mimeType "${contentType}" for file "${file.url}"`);        
      }
    } else {
      console.error(`  error: ${res.status} (${res.statusText}) while reading "${file.url}"`);
      errCount++;
    }       
  }  
  if(errCount == 0){
    if(isDefined(onSuccess)) onSuccess();
  } else {
    if(isDefined(onError)) onError();    
  }
} // function fetchTextFragments 
 

const shadersCache = {};

//
//
//  combine text of shaders into single txt property 
//
function combineShaderFragments(shader){
  
    if(DEBUG)console.log('combineShaderFragments:', shader);
    let frags = shader.frags;
    if(!isDefined(shader.id)){
      let id = "[";
      for(let i = 0; i < frags.length; i++){
        id += frags[i].url;
        if(i < frags.length-1)
          id += ',';      
      }
      id += ']';    
      shader.id = id;
    }
    if(DEBUG)console.log('looking for shader:', shader.id);
    let oldShader = shadersCache[shader.id];
    if(isDefined(oldShader)){
      if(DEBUG)console.log('old shader found:', shader.id);
      shader.id = oldShader.id;
      shader.txt = oldShader.txt;
      shader.shader = oldShader.shader;
      return;
    }
    if(DEBUG)console.log('  making new shader:', shader.id);    
    let txt = '';
    for(let k = 0; k < frags.length; k++){
      let fr = frags[k];
      if(!isDefined(fr.txt)) {
        console.error('undefined fragment:', fr);
        txt += `// undefined fragment ${fr.url}\n`;              
      } else {
        txt += `\n`;        
        txt += `/********* fragment: '${fr.url}' *********/\n`;        
        txt += `\n`;        
        txt += fr.txt;
      }
      
    }  
    shader.txt = txt;
    shadersCache[shader.id] = shader;
}

const programsCache = {};
//
//  build program from preloaded fragments
//
function buildProgramCached(gl, program){
  
    if(DEBUG)console.log(`buildProgramCached(${program.name})`);
    //return  true;
    
    if(DEBUG)console.log('joining vertex shader for:', program.name);
    combineShaderFragments(program.vs);
    if(DEBUG)console.log('joining fragment shader for:', program.name);
    combineShaderFragments(program.fs); 
    if(!isDefined(program.id)){
      program.id = program.vs.id + "," + program.fs.id;
    }
    let oldProgram = programsCache[program.id];
    if(isDefined(oldProgram)){
      if(DEBUG)console.log('old program found: ', oldProgram.id);
      program.program = oldProgram.program;
      program.result = oldProgram.result;
      return program.result;
    }
    if(!isDefined(program.vs.shader)){
      if(DEBUG)console.log('compiling vertex shader: ', program.vs.id);
      program.vs.shader = compileShader(gl, gl.VERTEX_SHADER, program.vs.txt);
    }
    if(program.vs.shader == null){
      program.result = false;
      programsCache[program.id] = program;
      return false;
    }
    if(!isDefined(program.fs.shader)){
      if(DEBUG)console.log('compiling fragment shader: ', program.fs.id);
      program.fs.shader = compileShader(gl, gl.FRAGMENT_SHADER, program.fs.txt);
    }
    if(program.fs.shader == null){
      program.result = false;
      programsCache[program.id] = program;
      return program.result;
    }
    
    //console.log('vs: ', program.vs.shader);
    //console.log('fs: ', program.fs.shader);
    program.program = new Program(gl, program.vs.shader, program.fs.shader); 
    
    program.result = true; // ?? 
    if(DEBUG)console.log('program build: ', program);    
    programsCache[program.id] = program;
    
    return program.result;
      
}

function buildProgramsCached(gl, programs){
  
  for(const prop in programs){    
  
    let result = buildProgramCached(gl, programs[prop]); 
    if(! result) 
      return false;    
  }
  
  return true;
  
}

function initFragments(fragments){
    
    if(DEBUG)console.log(`initFragments(fragments.length: ${fragments.length})`);
    let result = true;
    for(let i= 0; i < fragments.length; i++){
        let frag = fragments[i];
        //console.log('frag: ', frag.id, 'obj.name: ', frag.obj.name);
        if(!isDefined(frag.obj)) 
            throw new Error('undefined fragments object:\n' + JSON.stringify(frag,null,2));
        frag.txt = frag.obj[frag.id];
        if(!isDefined(frag.txt))
            throw new Error(`undefined fragment frag.id:"${frag.id}" frag: ${JSON.stringify(frag,null,2)}`);
        if(!isFunction(frag.obj.getName))
            throw new Error(`undefined obj.getName() frag.id:"${frag.id}" obj.name: ${frag.obj.name}`);                        
        frag.url = frag.obj.getName() + '.' + frag.id;
        let url = frag.url;
        if(DEBUG)console.log(`fragment" "${frag.id}" (${frag.txt.length} bytes) url:${url}`);                    
            ;//console.log('fragment txt:', frag.txt);                    
    }
    return result;
}


export {
  initFragments,
  fetchTextFiles,
  fetchTextFilesCached,
  fetchTextFragments,
  buildProgramsCached,
};
