import {
    isFunction
} from './modules.js';


const DEBUG = false;
const MYNAME = 'ObjectFactory';

function isClass(obj) {
  return typeof obj === 'function' && 
         /^class\s/.test(Function.prototype.toString.call(obj));
}

// utility method which makes creator of arbitrary objects using objects names
// 
//  objInfo - array: [{name:'name', creator: creator}, ...]
//
function ObjectFactory(creatorInfo){
    
    const names = []; 
    const cinfos = {};
    const class2name = {};
    init(creatorInfo.infoArray);

    const defaultName = (creatorInfo.defaultName)? creatorInfo.defaultName: names[0];
    
    function getObject(name){
        
        console.log(`${MYNAME}.getObject()`, name);
        let cinfo = cinfos[name];
        if(!cinfo) {
            console.warn(`${MYNAME}.getObject(), ounknow name: ${name}, returning default: ${defaultName}`)
            cinfo = cinfos[defaultName];
        }
        let obj = null;
        if(cinfo.creator.getClassName){
            // creator is the object itself
            if(DEBUG) console.log('');
            obj = cinfo.creator;
        } else if(isClass(cinfo.creator)){
            obj = new cinfo.creator(cinfo.args);
        } else if(isFunction(cinfo.creator)){
            obj = cinfo.creator(cinfo.args);
        }
        console.log(`${MYNAME}.getObject() returning `, obj);        
        return obj;
    }
    
    function init(infoArray){

        for(let i=0; i < infoArray.length; i++){
            let info = infoArray[i];
            names[i] = info.name;
            let creator = info.creator;
            //console.log(creator.name);
            let cinfo = {creator:creator, args: info.args};
            cinfos[info.name] = cinfo;
            class2name[creator.name] = info.name;
        }
    }
    
    function getDefaultObject(){
        return getObject(defaultName);
    }
    
    function mapClass2name(className){
        return class2name[className];
    }
    
    return {
        getNames:       ()=>names,
        getObject:      getObject,
        getDefaultName: ()=>defaultName,
        getDefaultObject: getDefaultObject,
        class2name:       mapClass2name,
    }
}


export {
    ObjectFactory
}
