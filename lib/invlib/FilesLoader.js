function FilesLoader(){
	this.name = "FilesLoader";
}

//
//  called when file is loaded 
//
function xhrSuccess(event) { 
	//console.log("xhrSuccess() status:%s ", this.status);
	//console.log("    arguments[]:",this.arg[0]);
	// callback scope is XMLHttpRequest, pass this as an argument 	
	if(this.status == 200) 
		this.onFileLoaded.call(this.scope, this, this.arg[0]); 
	else 
		this.onFileError.call(this.scope, this, this.arg[0]); 	
}

function xhrError() { 
	//console.error(this.statusText, this.); 
	//console.error("failed to load:", this.url); 
	this.onFileError.call(this.scope, this, this.arg[0]); 
	//this.onerror.apply(this, this.arguments); 
}


(function() {
	
	
	//console.log("FilesLoader prototype initialization");
	
	FilesLoader.prototype.onFileLoaded = function(request, index){		
		//console.log("loaded %s", this.files[index]);
		this.text[index] = request.responseText;
		this.count--;
		if(this.count == 0) 
		this.callbackObject.onLoadSuccess();		
	}

	FilesLoader.prototype.onFileError = function(request, index){
		//console.error("failed to load %s", this.files[index]);
		this.callbackObject.onLoadError(this.files[index]);		
	}
	//
	//  loads single file 
	//
	FilesLoader.prototype.loadFile = function(url, onLoad, onError /*, opt_arg1 ... */) {
		var xhr = new XMLHttpRequest();
		xhr.onFileLoaded = onLoad;		
		xhr.onFileError = onError;
		xhr.onerror = xhrError;
		xhr.scope = this;
		xhr.arg = Array.prototype.slice.call(arguments, 3);
		xhr.onload = xhrSuccess;
		xhr.open("GET", url, true);
		xhr.responseType="text";
		xhr.send(null);
	}
	
	//
	//  loads array of files 
	//  callbackObject.onLoadSuccess() is called if all files were loaded successfully
	//  callbackObject.onLoadError() is called if there were loading errors 
	FilesLoader.prototype.loadFiles = function(files, callbackObject){
		
		this.callbackObject = callbackObject;
		this.files = files;
		var len = files.length;
		this.text = [];
		this.count = len;
		for(var i = 0; i < len; i++) {
			//console.log("files[%d]: %s", i, files[i]);
			this.loadFile(files[i], this.onFileLoaded, this.onFileError, i);
		}
	}
	
	
})();


export {FilesLoader};