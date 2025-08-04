/*! loadJS: load a JS file asynchronously. [c]2014 @scottjehl, Filament Group, Inc. (Based on http://goo.gl/REQGQ by Paul Irish). Licensed MIT */

export function loadJS( src, cb, ordered ){
  console.log('loadJS(', src, ')');
  var tmp;
  var ref = window.document.getElementsByTagName( "script" )[ 0 ];
  var script = window.document.createElement( "script" );

  if (typeof(cb) === 'boolean') {
    tmp = ordered;
    ordered = cb;
    cb = tmp;
  }

  script.src = src;
  script.async = !ordered;
  ref.parentNode.insertBefore( script, ref );

  if (cb && typeof(cb) === "function") {
    script.onload = cb;
  }
  return script;
}
 

export function loadScripts(pathPrefix, scripts, callback){

  for(var i = 0; i < scripts.length-1; i++){
    loadJS(pathPrefix + scripts[i], true);
  }
  // add callback on the last script
  loadJS(pathPrefix + scripts[scripts.length-1], true, callback);
  
}
