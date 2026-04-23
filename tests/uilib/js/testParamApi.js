import {
    DatGUI,
    ParamGui,
    ParamBool, 
    ParamFunc, 
    ParamFloat,
    ParamInt,
    ParamGroup,
    ParamObj,
    ParamObjArray,
    ParamString,
    ParamChoice, 
    createParamUI,
    getParamValues,
    setParamValues,
    saveFileAs,
    openFile,
    Obj,
    ObjArray,
    ObjectFactory,
} from '../../../lib/uilib/modules.js';


const APP_NAME = 'TestParamApi';
let guiName = DatGUI;
//let guiName = ParamGui;

// Objects factory — maps class name → constructor.
// factory.getObject('TestObj1')  → new TestObj1 instance
// factory.getObject('TestObj2')  → new TestObj2 instance
const objFactory = ObjectFactory({
    infoArray: [
        { name: 'TestObj1', creator: TestObj1 },
        { name: 'TestObj2', creator: TestObj2 },
        { name: 'ObjArray', creator: ObjArray  },
    ],
    defaultName: 'TestObj1',
});


function TestObj1(args){
    const OBJ_NAME = "TestObj1";
    let par = {
        id: (args && args.id) ? args.id : 'obj1',
        w:  10,
        h:  30,
    }
    let uip = {
        id: ParamString({obj: par, key: 'id'}),
        w:  ParamInt({obj: par, key: 'w'}),    
        h:  ParamInt({obj: par, key: 'h'}),                
    }
    function createUI(gui){
        createParamUI(gui, uip);
    }

    function getValue(){
        return {
            className: OBJ_NAME,
            params: getParamValues(uip),
        };
    }
    
    function setValue(value){
        console.log(`${OBJ_NAME}.setValue()`, value);
        if(OBJ_NAME === value.className){
            setParamValues(uip, value.params);
        } else {
            console.error(`got wrong value.className: ${value.className}, expected ${OBJ_NAME} instead`);
        }
    }
    
    return {
        getId:       () => par.id,
        getClassName:() => OBJ_NAME,
        setValue,
        getValue,
        createUI,
    }
}

function TestObj2(args){
        
    const OBJ_NAME = "TestObj2";
    let par = {
        id: (args && args.id) ? args.id : 'obj2',
        gg: 40,
        dd: 70.2,
        bb: false,
    }
    let uip = {
        id: ParamString({obj: par, key: 'id'}),
        gg: ParamInt  ({obj: par, key: 'gg'}),    
        dd: ParamFloat({obj: par, key: 'dd'}),   
        bb: ParamBool ({obj: par, key: 'bb'}),
    }
    function createUI(gui){
        createParamUI(gui, uip);
    }
    
    function getValue(){
        return {
            className: OBJ_NAME,
            params: getParamValues(uip),
        };
    }
    
    function setValue(value){
        console.log(`${OBJ_NAME}.setValue()`, value);
        if(OBJ_NAME === value.className){
            setParamValues(uip, value.params);
        } else {
            console.error(`got wrong value.className: ${value.className}, expected ${OBJ_NAME} instead`);
        }
    }
    
    return {
        getId:       () => par.id,
        getClassName:() => OBJ_NAME,
        setValue,
        getValue,
        createUI,
    }
}



function TestApp(){

    const array2 = ObjArray({
        id: 'test_array2',
        children: [
            TestObj1({id:'obj1.1'}),
            TestObj2({id:'obj2.1'}),
            TestObj1({id:'obj1.2'}),
        ],
    });

    const array1 = ObjArray({
        id: 'test_array1',
        children: [
            TestObj1({id:'obj1.3'}),
            TestObj2({id:'obj2.2'}),
            array2,
        ],
    });

    const params = {
        heat: true,
        cold: false,
        width: 100,
        height: 200,
        depth: 1.245,
        breadth: 5.765,
        obj1: TestObj1(),
        obj2: TestObj2(),
        objType: 'TestObj1',
        array1: array1,
    }
    
    const APP_NAME = 'TestApp';
    const activeObject = objFactory.getObject(params.objType);
    console.log(`${APP_NAME} activeObject: `, activeObject);
    let uiparams = {
        
        
        saveParams:  ParamFunc({func:onSaveParams, name:'saveParams'}),
        readParams:  ParamFunc({func:onReadParams, name:'readParams'}),
        cold:   ParamBool({obj:params, key:'cold'}),
        heat:   ParamBool({obj:params, key:'heat'}),
        width:  ParamInt ({obj:params, key:'width', min: 10, max: 8000}),    
        height: ParamInt ({obj:params, key:'height'}),        
        action: ParamFunc ({func: onAction, name: 'perform action'}),   
        objType: ParamChoice({obj: params, key: 'objType', choice: objFactory.getNames(), onChange: onObjTypeChanged}), 
        obj:        ParamObj({name: 'object', obj:activeObject}),
        group2:  ParamGroup({
                    name:  'group 2',
                    params: {
                        depth:   ParamFloat({obj:params, key:'depth'}),                
                        breadth: ParamFloat({obj:params, key:'breadth'}),
                        grp3:  ParamGroup({
                                    name:  'group 3',
                                    params: {
                                        depth:   ParamFloat({obj:params, key:'depth'}),                
                                        breadth: ParamFloat({obj:params, key:'breadth'}),
                                    }
                        }),                                   
                    }
                }),
        obj1:    ParamObj({name: 'object 1', obj: params.obj1}),
        obj2:    ParamObj({name: 'object 2', obj: params.obj2}),

        // ── ParamObjArray demo (using ObjArray + Obj) ──────────────────────
        array1: ParamObjArray({
            obj:     params,
            key:     'array1',
            name:    'array of obj',
            factory: objFactory,
        }),
      };
    
    function createUI(gui){
        console.log(`${APP_NAME}.createUI()`);
        createParamUI(gui, uiparams); 
    }
    
    
    
    function getValue(){
        return {
            className: APP_NAME,
            params: getParamValues(uiparams),
        };
    }

    function setValue(value){
        let params = value.params;
        console.log(`${APP_NAME}.setValue()`, value);            
        if(APP_NAME !== params.className){
            console.error('wrong className: ', params.className, ' expecting: ', APP_NAME);
        } else {
            setParamValues(uiparams, params.params);
        }
    }
    
    function onObjTypeChanged(){
        let newObj = objFactory.getObject(params.objType);
        uiparams.obj.replaceObj(newObj);
    }
    
    return {
        getValue: getValue,
        setValue: setValue,
        createUI: createUI
    }
}

function onAction(){
    console.log('onAction()');
}

const setName = 'set';
let filesCount = 0;
const JSON_OFFSET = 4;

function onSaveParams(){
    console.log('onSaveParams()');
    
    let pset = {name:setName, params: app.getValue()};
    var jsontxt = JSON.stringify(pset, null, JSON_OFFSET);        
    //console.log("json: ", jsontxt);
    let fileName = setName + filesCount + '.json';  
    saveFileAs(fileName, new Blob([jsontxt]),  'text/plain');
    filesCount++;
        
}

function loadFile(file){
    console.log('loadFile(file): ', file);
    if ( !file )
        return;
    
    function onLoad(){
        
        console.log('onLoad()');
        const fileText = reader.result;
        if ( fileText ) {
            let jsonObj = null;
            try {
                jsonObj = JSON.parse(fileText);
                console.log('JSONobj: ', jsonObj);
            } catch(e) {
                console.error("Input file not in correct format. "); // error in the above string
                console.error("Error reading file: " + e);
            }
            app.setValue(jsonObj);
        }       
    }
    
    const reader = new FileReader();
    reader.onload = onLoad;
    
    console.log('reader.readAsText()');
    reader.readAsText( file );
    
    
}

function onReadParams(){
    
    console.log('onReadParams()');
    let prom = openFile();
    console.log('result: ', prom);
    prom.then(file => loadFile( file ));
    
    
}

let app = TestApp();

let gui = new guiName({
    width: 200,
    name: "test app",
    closed:false});

app.createUI(gui);


