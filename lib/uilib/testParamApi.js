import {
    DatGUI,
    ParamGui,
    ParamBool, 
    ParamFunc, 
    ParamFloat,
    ParamInt,
    ParamGroup,
    ParamObj,
    createParamUI,
    getParamValues,
    setParamValues,
    saveFileAs,
    openFile,
} from './modules.js';


const APP_NAME = 'TestParamApi';
//let guiName = DatGUI;
let guiName = ParamGui;


function TestObj1(){
    const OBJ_NAME  = "TestObj1";
    let par = {
        w: 10,
        h: 30,
    }
    let uip = {
        w:  ParamInt ({obj:par, key:'w'}),    
        h: ParamInt ({obj:par, key:'h'}),                
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
            let params = value.params;
            setParamValues(uip, params);
        } else {
            console.error(`got wrong value.className: ${value.className}, expected ${OBJ_NAME} instead`);
        }
    }
    
    return {
        setValue: setValue,
        getValue: getValue,
        createUI: createUI        
    }
}

function TestObj2(){
    
    const OBJ_NAME  = "TestObj2";
    let par = {
        gg: 40,
        dd: 70.2,
        bb: false,
    }
    let uip = {
        gg:  ParamInt ({obj:par, key:'gg'}),    
        dd:  ParamFloat ({obj:par, key:'dd'}),   
        bb:  ParamBool({obj: par, key:'bb'}),
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
            let params = value.params;
            setParamValues(uip, params);
        } else {
            console.error(`got wrong value.className: ${value.className}, expected ${OBJ_NAME} instead`);
        }
    }
    
    return {
        setValue: setValue,
        getValue: getValue,
        createUI: createUI
    }
}


let params = {
    
    heat: true,
    cold: false,
    width: 100,
    height: 200,
    depth: 1.245,
    breadth: 5.765,
    obj1: TestObj1(),
    obj2: TestObj2(),
}

function TestApp(){
    
    const APP_NAME = 'TestApp';
    
    let uiparams = {
        
        saveParams:  ParamFunc({func:onSaveParams, name:'saveParams'}),
        readParams:  ParamFunc({func:onReadParams, name:'readParams'}),
        cold:   ParamBool({obj:params, key:'cold'}),
        heat:   ParamBool({obj:params, key:'heat'}),
        width:  ParamInt ({obj:params, key:'width', min: 10, max: 8000}),    
        height: ParamInt ({obj:params, key:'height'}),        
        action: ParamFunc ({func: onAction, name: 'perform action'}),     
        group1:  ParamGroup({
                    name:  'group 1',
                    params: {
                        depth:   ParamFloat({obj:params, key:'depth'}),                
                        breadth: ParamFloat({obj:params, key:'breadth'}),
                    }
                }), // group:
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
      };
      
    function createUI(gui){
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
            console.error('wrong className: ', params.classNam, ' expecting: ', APP_NAME);
        } else {
            setParamValues(uiparams, params.params);
        }
    }
    
    return {
        getValue: getValue,
        setValue: setValue,
        createUI: createUI
    }
}

let app = TestApp();

let gui = new guiName({
    width: 200,
    name: "test app",
    closed:false});

app.createUI(gui);

//createParamUI(gui, uiparams);


function onAction(){
    console.log('onAction()');
}

const setName = 'set01';
const JSON_OFFSET = 4;

function onSaveParams(){
    console.log('onSaveParams()');
    
    let pset = {name:setName, params: app.getValue()};
    var jsontxt = JSON.stringify(pset, null, JSON_OFFSET);        
    console.log("json: ", jsontxt);
    let fileName = setName + '.json';  
    saveFileAs(fileName, new Blob([jsontxt]),  'text/plain');
    
    
}

function loadFile(file){
    console.log('loadFile(file): ', file);
    if ( !file )
        return;
    
    function onLoad(){
        
        console.log('onLoad()');
        const fileText = reader.result;
        if ( fileText ) {
            try {
                let jsonObj = JSON.parse(fileText);
                console.log('JSONobj: ', jsonObj);
                app.setValue(jsonObj);
            } catch(e) {
                console.error("Input file not in correct format. "); // error in the above string
                console.error("Error reading file: " + e);
            }
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



