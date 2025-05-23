import {
    ParamGui,
    InstantHelp
}
from "../modules.js";

//ParamGui.logConversion = true;


const gui = new ParamGui({
    name: "datGui API compatible",
    closed:false
});

gui.addHelp("This is a <strong>demo</strong> for the datGui API with some extensions.");

gui.addParagraph("This demo shows that gui.add() is still backwards compatible with datGui.js");
gui.addParagraph("<strong>Open the console:<br>You will see the equivalent args-object of the new API.</strong>");

const parameters = {};

gui.addParagraph("The ui for numbers is basically only a text input field interacting with the mouse, mouse wheel, keyboard (arrows too)");

gui.changeDesign({
    usePopup: false
});
parameters.number = 3.4;

const nc = gui.add(parameters, "number", 0, 8);
nc.createVeryLongRange();

gui.addParagraph("You can add an indicator in the background.");
parameters.indi = 1;
gui.add(parameters, "indi", 0, 10, 0.01)
    .createIndicatorMain();

parameters.plusMin = 2;
gui.add(parameters, "plusMin", -2, 12,1)
    .createPlusMinusButtons()
    .createIndicatorMain()
    .createMaxMinButtons();

gui.addParagraph("The additional buttons can go to a popup, appears when changing the number.");
gui.changeDesign({
    usePopup: true
});
parameters.pop = 1;
gui.add(parameters, "pop", 1)
    .createPlusMinusButtons()
    .createIndicatorMain()
    .createMulDivButtons()
    .createSuggestButton(500);
gui.addParagraph("The indicator can go to the popup:");
parameters.popIn = 10;
gui.add(parameters, "popIn", 0, 20)
    .createPlusMinusButtons()
    .createIndicator()
    .createMaxMinButtons();
gui.addParagraph("We can have several controls on a line:");

parameters.width = 300;
parameters.height = 200;
gui.add(parameters, "width", 100, 10000,1)
    .add(parameters, "height", 100, 10000,1);

parameters.heat = false;
parameters.sound = true;
parameters.light = true;
gui.add(parameters, "heat")
    .add(parameters, "sound")
    .add(parameters, "light");
const haeckel = "./haeckel/haeckel_";

const choices = {};
for (var i = 1; i < 10; i++) {
    choices["haeckel0" + i] = haeckel + "0" + i + ".png";
}
for (var i = 10; i < 20; i++) {
    choices["haeckel" + i] = haeckel + i + ".png";
}

parameters.image = haeckel + "0" + 5 + ".png";

gui.add(parameters, "image", choices);
parameters.rgba = "#ff0000ff";
const co = gui.addColor(parameters, "rgba");

parameters.text = "edit some text";
gui.add(parameters, "text");

parameters["say hello"] = function() {
    console.log("hello");
};
gui.add(parameters, "say hello").setLabelText("button");

parameters.selection = "beta";
gui.add(parameters, "selection", ["alpha", "beta", "gamma", "delta", "epsilon"]);
