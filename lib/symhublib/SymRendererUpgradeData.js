
const MYNAME= 'SymRendererUpgradeData';

const DEBUG = false;

export function SymRendererUpgradeData(data){
    
    if(DEBUG)console.log('SymRendererUpgradeData()', data);

    let appInfo = (data.appInfo)?(data.appInfo): {};

    if(!appInfo.fileFormatRelease){ // format release 0 
            upgrade_0_1(data);
    }
    
}


const PRJ_LOX = 'exp [-1, 1]';
const PRJ_EXP = 'exp';
const PRJ_BAND = 'band';

function upgrade_0_1(data){
        
    if(DEBUG)console.log(`${MYNAME}.upgrade_0_1()`, data);
    
    moveObj(data,'params.visualization.options','expScale', data, 'params.tools.transform.params.projection.params','scaleMap');    
    moveObj(data,'params.visualization.options','rational', data, 'params.tools.transform.params.projection.params','rationalMap');    
    moveObj(data,'params.visualization.options','periodic', data, 'params.tools.transform.params.projection.params','periodicMap');    

    
    let opt = getObject(data,'params.visualization.options');
    if(DEBUG)console.log(`${MYNAME} options:`, opt);
    let key = undefined;
    let proj = opt['projection'];
    switch(proj){
        default: break;
        case 'uhp':    key = 'uhpMap'; break;
        case 'sphere': key = 'sphereMap'; break;
        case 'band':   key = 'bandMap'; break;
        case 'uhp':    key = 'uhpMap';  break;
        case 'exp':    key = 'expMap';  break;
        case 'log':    key = 'logMap';  break;
        case PRJ_LOX: key = 'loxMap'; break;
    } 
    if(key){
        setValue(data, 'params.tools.transform.params.projection.params', key, {enabled:true});
    }
    if(!(
        proj == PRJ_EXP || 
        proj == PRJ_LOX ||
        proj == PRJ_BAND 
        )) {
        setValue(data, 'params.tools.transform.params.projection.params.scaleMap', 'enabled', false);   
    }
    data.appInfo = {fileFormanRelease: 1};
        
}

// params.visualization.options.projection.
// 'circle'       => nothing
// 'uhp'          => params.tools.transform.params.projection.uhpMap:  {enabled: true}
// 'log'          => params.tools.transform.params.projection.logMap:  {enabled: true}
// 'band'         => params.tools.transform.params.projection.bandMap: {enabled: true}
// 'exp'          => params.tools.transform.params.projection.expMap:  {enabled: true}
// 'exp [-1, 1]'  => params.tools.transform.params.projection.loxMap:  {enabled:true}' 
// 'sphere'       => params.tools.transform.params.projection.sphereMap: {enabled: true}



function setValue(baseObj, path, key, value){
    let obj = getObject(baseObj, path, true);
    if(obj) obj[key] = value;
}

function moveObj(fromObj, fromPath, fromKey, toObj, toPath, toKey){
    if(DEBUG)console.log('moveData: ', fromObj, fromPath, fromKey, toPath, toKey)
    let objIn = getObject(fromObj, fromPath);
    if(objIn && objIn[fromKey]){
        let objOut = getObject(toObj, toPath, true);
        if(DEBUG)console.log('objIn: ', objIn);
        if(DEBUG)console.log('objOut: ', objOut);
        if(objOut){
            objOut[toKey] = objIn[fromKey];
        }
        //delete objIn[fromKey];  // do we need that 
    }
}

// return existing objects 
function getObject(obj, path, createNew = false){
    
    if(DEBUG)console.log('getObject()', path);
    let keys = path.split('.');
    if(DEBUG)console.log('keys: ', keys);
    
    let opath = obj;
    
    for(let i = 0; i < keys.length; i++){
        let value = opath[keys[i]];
        if(DEBUG)console.log('value: ', value, (typeof value), (typeof value === 'object'));
        if((typeof value !== "object")) {
            if(createNew){
                if(DEBUG)console.log('creating new {}');
                value = {};
                opath[keys[i]] = value;
            } else {
                return undefined;
            }
        }
        opath = value;
    }
    return opath;
}

function deleteKey(obj, path, key){
    
     if(DEBUG)console.log('deleteKey', path, key);
     let opath = getObject(obj, path);
     if(opath) {
         if(DEBUG)console.log('found opath: ', opath);
         delete opath[key]; 
     } else {
         if(DEBUG)console.log('opath not found: ', opath);         
     }
}