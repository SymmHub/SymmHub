
const MYNAME= 'SymRendererUpgradeData';

const DEBUG = false;

export function SymRendererUpgradeData(data, args){
    
    if(DEBUG)console.log('SymRendererUpgradeData()', data);

    let appInfo = (data.appInfo)?(data.appInfo): {};

    if(!appInfo.fileFormatRelease){ // format release 0 
        upgrade_0_1(data, args);
    }

    upgradeSymmetry(data, args.groupMakerFactory);
    upgradePattern(data);
}


const PRJ_LOX = 'exp [-1, 1]';
const PRJ_EXP = 'exp';
const PRJ_BAND = 'band';

function upgrade_0_1(data, args){
        
    if(DEBUG)console.log(`${MYNAME}.upgrade_0_1()`, data);
    
    moveObj(data,'params.visualization.options','expScale', data, 'params.tools.transform.params.projection.params','scaleMap');    
    moveObj(data,'params.visualization.options','rational', data, 'params.tools.transform.params.projection.params','rationalMap');    
    moveObj(data,'params.visualization.options','periodic', data, 'params.tools.transform.params.projection.params','periodicMap');    
    // TODO add to transform "className": "InversiveNavigator_v1",

    
    let opt = getObject(data,'params.visualization.options');
    if(DEBUG)console.log(`${MYNAME} options:`, opt);
    let key = undefined;
    let proj = opt['projection'];
    if(DEBUG)console.log(`${MYNAME} projection: `, proj);
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
    if(DEBUG)console.log(`${MYNAME} projection key: `, key);
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

    if(DEBUG)console.log(`${MYNAME}.upgrade_0_1() result`, data);
        
}

function upgradeSymmetry(data, groupMakerFactory){
    if(!groupMakerFactory) return;
    let sym = getObject(data,'params.symmetry');
    if(!sym.groupType){
        console.warn(`${MYNAME}.upgradeSymmetry()`, sym);
        console.log(`${MYNAME} group.className: `, sym.group.className);
        let groupType = groupMakerFactory.class2name(sym.group.className);
        console.log(`${MYNAME} group.groupType: `, groupType);
        let updatedSym = {groupType: groupType, ...sym};
        console.log(`${MYNAME} updatedSym: `, updatedSym);  
        assignObjectData(updatedSym, sym);
        console.log(`${MYNAME} updated sym: `, sym);  
    }
}

function upgradePattern(data){
    
    const params = data.params;
    
    if(params.pattern) {
        // we already have pattern
        return;
    }
    const pattern = {};
    params.pattern = pattern;
    
    if(params.simulation){
        console.warn(`${MYNAME}.upgradePattern()`, params.simulation);        
        pattern.patternParams = params.simulation;
        delete params.simulation;
    }
    if(params.simTransform){
        pattern.patternTransform = upgadeSimTransform(params.simTransform);
        delete params.patternTransform;    
    }    
    
}

function upgadeSimTransform(simTrans){
    
    return {
        centerX:    simTrans.simCenterX,
        centerY:    simTrans.simCenterY,
        scale:      simTrans.simScale,
        angle:      simTrans.simAngle,
    }
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
    
    if(DEBUG)console.log(`${MYNAME}.setValue() baseObj:`, baseObj);
    if(DEBUG)console.log(`${MYNAME}.setValue() path:`, path);
    if(DEBUG)console.log(`${MYNAME}.setValue() key:`, key);
    if(DEBUG)console.log(`${MYNAME}.setValue() value:`, value);

    let obj = getObject(baseObj, path, true);
    if(DEBUG)console.log(`${MYNAME}.setValue() obj: `, obj);        
    if(obj) obj[key] = value;
}

function moveObj(fromObj, fromPath, fromKey, toObj, toPath, toKey){
    if(DEBUG)console.log(`${MYNAME}.moveData() fromObj: `, fromObj);
    if(DEBUG)console.log(`${MYNAME}.moveData() fromPath: `,fromPath);
    if(DEBUG)console.log(`${MYNAME}.moveData() fromKey:`, fromKey);
    if(DEBUG)console.log(`${MYNAME}.moveData() toPath:`, toPath);
    if(DEBUG)console.log(`${MYNAME}.moveData() toKey:`, toKey);
    let objIn = getObject(fromObj, fromPath);
    if(DEBUG)console.log(`${MYNAME}.moveData() objIn: `, objIn);
    if(objIn && objIn[fromKey]){
        let objOut = getObject(toObj, toPath, true);
        if(DEBUG)console.log(`${MYNAME}.objOut: `, objOut);
        if(objOut){
            objOut[toKey] = objIn[fromKey];
        } else {
            if(DEBUG)console.warn(`${MYNAME}. can't move Obj to: `, objOut);            
        }
        //delete objIn[fromKey];  // do we need that 
    }
}

// return existing objects 
function getObject(obj, path, createNew = false){
    const debug = false;
    if(debug)console.log(`${MYNAME}.getObject()`, path);
    let keys = path.split('.');
    if(debug)console.log(`${MYNAME}.keys: `, keys);
    
    let opath = obj;
    
    for(let i = 0; i < keys.length; i++){
        let value = opath[keys[i]];
        if(debug)console.log(`${MYNAME}.value: `, value, (typeof value), (typeof value === 'object'));
        if((typeof value !== "object")) {
            if(createNew){
                if(debug)console.log(`${MYNAME}.creating new {}`);
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
    
     if(DEBUG)console.log(`${MYNAME}.deleteKey`, path, key);
     let opath = getObject(obj, path);
     if(opath) {
         if(DEBUG)console.log(`${MYNAME} found opath: `, opath);
         delete opath[key]; 
     } else {
         if(DEBUG)console.log(`${MYNAME} opath not found: `, opath);         
     }
}

function assignObjectData(source, target){
    
    // 1. remove keys from target
    for (const key in target) {
        delete target[key];
    }

    // 2. Assign all keys from source
    Object.assign(target, source);
}