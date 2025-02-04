import {isDefined} from './Utilities.js';

export class FileLoader {
  
  constructor(){
    this.files = {};
  }
  
  loadFile(params, _onReady){
    let url = undefined;
    let onReady = undefined;
    let returnInfo = false;
    
    switch(typeof params){
      case 'string': {
        url = params;
        onReady = _onReady;
        break;
      }
      case 'object':{
        url = params.url;
        onReady = params.onReady;
        returnInfo = params.returnInfo;
      }
    }
    //console.log('loadFile:', url);
    
    var f = this.files[url];
    
    if(isDefined(f)){
      
      if(returnInfo)
        return f;
      
      if(f.isReady){
        // file already loaded 
        if(isDefined(onReady)){
          onReady(f); 
          return f;
        }
      } else {
        // file being loaded. add onReady into the chain of future calls 
        if(isDefined(onReady)){
          f.onReady = function(){
            // call old onReady
            f.onReady(f);
            // call new onReady 
            onReady(f);
          }
        }
        return f;
      }
    } else {      
      // first time request      
      var req = new XMLHttpRequest();
      
      var result = {url:url, onReady:onReady, isLoaded:false, xhr:req, success:false};
      
      var onLoadListener = function(event){        
        result.isReady = true;
        
        if(result.xhr.status == 200){ 
          // success 
          result.content = req.responseText;
          result.success = true;
        } else {
          // failure 
          result.success = false;
          result.content= '';
          console.error('failed to load:',result.url);                  
        }
        if(isDefined(result.onReady)){
          result.onReady(result);
        }
      }

      req.addEventListener("load", onLoadListener);
      req.open("GET", url);
      req.responseType="text";
            
      this.files[url] = result;
      
      req.send();
      
      return result;
    }    
  }
} // class FileListener 