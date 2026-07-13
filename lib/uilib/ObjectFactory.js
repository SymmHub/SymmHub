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
    const class2name = {};  // maps creator.name (JS class/fn name) → factory key; used by upgrade code
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
            names[i] = info.name;  // name MUST be the className (used as serialization key)
            let creator = info.creator;
            let cinfo = {creator:creator, args: info.args, label: info.label ?? info.name};
            cinfos[info.name] = cinfo;
            // Build creator-name → factory-key map for legacy upgrade code (named-function creators only)
            if (creator.name) class2name[creator.name] = info.name;
        }
    }
    
    function getDefaultObject(){
        return getObject(defaultName);
    }
    
    function mapClass2name(className){
        const normalized = className && className.endsWith('-class')
            ? className.slice(0, -6)   // remove trailing '-class'
            : className;
        return class2name[normalized];
    }

    function getLabel(name) {
        return cinfos[name]?.label ?? name;
    }

    function mapClass2name(className) {
        const normalized = className && className.endsWith('-class')
            ? className.slice(0, -6)
            : className;
        return class2name[normalized] ?? null;
    }

    
    return {
        getNames:         ()=>names,
        getObject:        getObject,
        getDefaultName:   ()=>defaultName,
        getDefaultObject: getDefaultObject,
        getLabel:         getLabel,
        class2name:       mapClass2name,
    }
}


export {
    ObjectFactory
}
