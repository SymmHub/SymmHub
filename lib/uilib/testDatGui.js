import {
    DatGUI,
    InstantHelp
}
from "./modules.js";

//ParamGui.logConversion = true;


const DGUI = true;



function testDatGui(){
    

//    const gui = new DatGUI({
//        name: "datGui API",
//        closed:false,
//        width: 200,
//    });

    
    // Initialise the left GUI.
    //let leftGUI = new dat.GUI({ closeOnTop: true, autoPlace: false });
    
    let leftGUI = new DatGUI({ closeOnTop: false, autoPlace: false });
    console.log('leftGUI: ', leftGUI);
    leftGUI.domElement.id = "leftGUI";
    document.getElementById("leftGUIContainer").appendChild(leftGUI.domElement);
    leftGUI.open();

    
    let rightGUI = new DatGUI({ closeOnTop: false, autoPlace: false });
    rightGUI.domElement.id = "rightGUI";
    document.getElementById("rightGUIContainer").appendChild(rightGUI.domElement);
    rightGUI.open();
         
    initGUI(leftGUI);
    initGUI(rightGUI);


    console.log('leftGUI: ', leftGUI);
    console.log('rightGUI: ', rightGUI);

    
}

function initGUI(gui){
    
   
    const parameters = {};


    parameters.number = 3.4;
    parameters.indi = 1;
    parameters.width = 300;
    parameters.height = 200;
    parameters.heat = false;
    parameters.sound = true;
    parameters.light = true;

    const haeckel = "./haeckel/haeckel_";
    const choices = {};
    for (var i = 1; i < 10; i++) {
        choices["haeckel0" + i] = haeckel + "0" + i + ".png";
    }
    for (var i = 10; i < 20; i++) {
        choices["haeckel" + i] = haeckel + i + ".png";
    }

    parameters.image = haeckel + "0" + 5 + ".png";    
    parameters.rgba = "#ff0000ff";

    parameters.text = "edit some text";
    parameters.sayHello = function() {
        console.log("hello");
    };
    parameters.selection = "beta";


    addFolder2(gui);

    let folder1 = gui.addFolder('Folder 1');
    addFolder(folder1);
        
    let folder2 = gui.addFolder('Folder 2');    
    addFolder(folder2);

    gui.open();
    
    
    function addFolder(folder){
        
        folder.add(parameters, "width", 100, 10000,1);
        folder.add(parameters, "height", 100, 10000,1);
        folder.add(parameters, "selection", ["alpha", "beta", "gamma", "delta", "epsilon"]);
        folder.add(parameters, "image", choices);
        folder.add(parameters, "heat");
        folder.add(parameters, "sayHello");
        folder.add(parameters, "width", 100, 10000,1);
        folder.addColor(parameters, "rgba");

        let folder3 = folder.addFolder('folder 3');
        addFolder2(folder3);
        
    }
    
    function addFolder2(folder){
        folder.add(parameters, "width", 100, 10000,1);
        folder.add(parameters, "height", 100, 10000,1);
        folder.add(parameters, "selection", ["alpha", "beta", "gamma", "delta", "epsilon"]);
        folder.add(parameters, "image", choices);
        folder.add(parameters, "heat");
        folder.add(parameters, "sayHello");
        folder.add(parameters, "width", 100, 10000,1);
        folder.addColor(parameters, "rgba");
    }    

} // function testDatGUI();

function modifyDG(gui){
    
    const EMPTY_FUNC = ()=>{};
    gui.addHelp = EMPTY_FUNC;
    gui.addParagraph = EMPTY_FUNC;
    gui.changeDesign = EMPTY_FUNC;
    
    replaceAdd(gui);
    
    
    function replaceAdd(origE){
        
        const origAdd = origE.add;
        origE.add = newAdd;
        
        function newAdd(){
            
            let el = origAdd.apply(origE, arguments);
            const F = ()=>{return el;};

            el.createIndicatorMain = F;
            el.createPlusMinusButtons = F;
            el.createIndicatorMain = F;
            el.createMaxMinButtons = F;
            el.createMulDivButtons = F;
            el.createSuggestButton = F;
            el.createIndicator = F;
            el.setLabelText = F;
            replaceAdd(el);
            return el;
        }
        return origE;
    }
    
}

testDatGui();
