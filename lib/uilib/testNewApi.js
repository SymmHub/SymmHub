/* jshint esversion: 6 */

import {
    ParamGui,
    InstantHelp,
    BooleanButton
}
from "./modules.js";

const gui = new ParamGui({
    name: "gui with new api",
    closed: false
});

gui.addParagraph("This is a <strong>demo</strong> for the new gui API. See the source code");

gui.add({
    type: 'textarea',
    rows: 4,
    columns: 20,
    labelText: "new textarea",
    initialValue: "We can write long texts\nwith multiple lines"
});

gui.addParagraph("The ui for numbers is basically only a text input field interacting with the mouse, mouse wheel, keyboard (arrows too). We can have a range slider.");
gui.changeDesign({
    usePopup: false
});

const parameters = {};
parameters.nn = 3.4;

const nc = gui.add({
    type: "number",
    params: parameters,
    property: "nn",
    step: 0.1,
    min: 0,
    max: 8
});

nc.createVeryLongRange();

gui.addParagraph("You can add an indicator in the background.");
parameters.indi = 1;
gui.add({
        type: "number",
        params: parameters,
        property: "indi",
        min: 0,
        max: 10,
        step: 0.01
    })
    .createIndicatorMain();

parameters.plusMin = 2;
gui.add({
        type: "number",
        params: parameters,
        property: "plusMin",
        min: -2,
        max: 12,
        step: 1
    })
    .createPlusMinusButtons()
    .createIndicatorMain()
    .createMaxMinButtons();
gui.addParagraph("The additional buttons can go to a popup, appears when changing the number.");
gui.changeDesign({
    usePopup: true
});
gui.addParagraph("No parameter object together with property string required. A callback can be added directly. We can have many digits.");
const popController = gui.add({
        type: "number",
        labelText: "pi",
        min: 1,
        initialValue: 3.1415926535,
        width: 200,
        onChange: function(value) {
            console.log("pop value: " + value);
        }
    })
    .createPlusMinusButtons()
    .createIndicatorMain()
    .createMulDivButtons()
    .createSuggestButton(500)
    .createLongRange();
gui.addParagraph("The indicator can go to the popup:");
parameters.popIn = 10;
gui.add(parameters, "popIn", 0, 20)
    .createPlusMinusButtons()
    .createIndicator()
    .createMaxMinButtons();
gui.addParagraph("We can use both API styles. We can have several controls on a line:");
parameters.width = 300;
parameters.height = 200;
gui.add({
        type: "number",
        params: parameters,
        property: "width",
        min: 100,
        max: 10000,
        step: 1
    })
    .add(parameters, "height", 100, 10000, 1);

gui.addParagraph("The new API is more verbose, but easier to use and debug.");

parameters.heat = false;
parameters.sound = true;
parameters.light = true;

// simplify, using multiple parameter objects
const boo = {
    type: 'boolean',
    params: parameters,
    minLabelWidth: 30
};
BooleanButton.whiteBackground();
const heatController = gui.add(boo, {
    property: "heat",
    buttonText: ['high', 'low']
});
BooleanButton.greenRedBackground();
const lightController = heatController.add(boo, {
    property: "light"
});
const soundController = lightController.add(boo, {
    property: "sound"
});

const haeckel = "./haeckel/haeckel_";

const choices = {};
for (var i = 1; i < 10; i++) {
    choices["haeckel0" + i] = haeckel + "0" + i + ".png";
}
for (var i = 10; i < 20; i++) {
    choices["haeckel" + i] = haeckel + i + ".png";
}

parameters.inputImage = haeckel + "0" + 5 + ".png";

const imageController = gui.add({
    type: "image",
    params: parameters,
    property: "inputImage",
    labelText: "use image",
    options: choices
});
imageController.addDragAndDropWindow();

parameters.rgba = "#ff0000ff";
gui.addParagraph("addColor(...) not needed anymore as with type:COLOR there is no confusion with type: TEXT controllers:");
const co = gui.add({
    type: "color",
    params: parameters,
    property: "rgba"
});
parameters.text = "edit some text";
gui.add({
    type: "text",
    params: parameters,
    property: "text"
});

gui.add({
    type: "button",
    labelText: "button",
    buttonText: "say hello",
    onClick: function() {
        console.log("hello");
    }
});

parameters.selection = "beta";
const sele = gui.add({
    type: "selection",
    params: parameters,
    property: "selection",
    options: ["alpha", "beta", "gamma", "delta", "epsilon"]
});

sele.addOption("zeta");

gui.setActive(false);
gui.setActive(true);