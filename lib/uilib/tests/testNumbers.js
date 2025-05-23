import {
    ParamGui,
    InstantHelp,
}
from "../modules.js";

const gui = new ParamGui({
    name: "gui with new api",
    closed:false
});

gui.addParagraph("This is a <strong>demo</strong> for the new interface for numbers");

gui.addParagraph("it's always a controller of type 'number'");

gui.addParagraph('Without a step argument we get up to 9 digits after the decimal point. You can add digits with the scroll wheel, if it is at the right of the number. You can type a lot of digits. Deletes trailing zeros.')

gui.addParagraph('Make its width large enough. With argument "width:150":')

gui.add({
	type:'number',
	initialValue:0.123456789,
	labelText:'high precision',
	width:150
});

gui.addParagraph('Showing another value (still no step given) with the same precision. No trailing zeros.');

gui.add({
	type:'number',
	initialValue:100.1,
	width:150
});

gui.addParagraph('With a smaller step value you can get more digits.')

gui.add({
	type:'number',
	initialValue:1.00000000001,
	step:1e-12,
	width:180
});

gui.addParagraph('Would you like to have "scientific" numbers ?')

gui.addParagraph("Sometimes we want to be more specific and have a better layout.");

gui.addParagraph('With argument "step: 1" you get integers:');
gui.add({
	type:'number',
	step:1,
	initialValue:10,
	labelText:'all integers'
});

gui.addParagraph('With argument "step: 2, offset:1" you get odd integers:');
gui.add({
	type:'number',
	step:2,
	offset:1,
	initialValue:11,
	labelText:'odd integers'
});

gui.addParagraph('With "step: 0.001" you get numbers with up to 3 digits after the decimal point:"');
gui.add({
	type:'number',
	step:0.001,
	initialValue:1.234,
	labelText:'"millis"'
});

gui.addParagraph('With "step: 0.5" you get half integer numbers:');
gui.add({
	type:'number',
	step:0.5,
	initialValue:3/2,
	min:0,
	labelText:'particle spin'
});
