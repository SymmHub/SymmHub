
const DEBUG = false;
const MYNAME = 'ObjectsCreator';

// utility method which makes creator of arbitrary objects using objects names
// 
//  objInfo - array: [{name:'name', creator: creator}, ...]
//
function ObjectsCreator(objInfo){
    
    const names = []; 
    const creators = {};
    init(objInfo);

    const defName = names[0];
    
    function getObject(name){
        
        console.log(`${MYNAME}.getObject()`, name);
        let creator = creators[name];
        if(!creator) {
            console.warn(`${MYNAME}.getObject(), ounknow name: ${name}, returning default: ${defName}`)
            creator = creators[defName];
        }
        let obj = creator();
        console.log(`${MYNAME}.getObject() returning `, obj);        
        return obj;
    }
    
    function init(objInfo){

        for(let i=0; i < objInfo.length; i++){
            let info = objInfo[i];
            names[i] = info.name;
            creators[info.name] = info.creator;
        }
    }
    
    return {
        getNames:       ()=>names,
        getObject:      getObject,
        getDefaultName: ()=>names[0],
    }
}


export {
    ObjectsCreator
}
