/**
 * dat-gui JavaScript Controller Library
 * http://code.google.com/p/dat-gui
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

import NumberController from './NumberController.js';
import dom from '../dom/dom.js';
import common from '../utils/common.js';

const DEBUG = false;
const MYNAME = 'NumberControllerBox';

const LEFT_ARROW = 37;
const UP_ARROW = 38;
const RIGHT_ARROW = 39;
const DOWN_ARROW = 40;
const KEY_ENTER = 13;

function roundToDecimal(value, decimals) {
  const tenTo = Math.pow(10, decimals);
  return Math.round(value * tenTo) / tenTo;
}

/**
 * @class Represents a given property of an object that is a number and
 * provides an input element with which to manipulate it.
 *
 * @extends dat.controllers.Controller
 * @extends dat.controllers.NumberController
 *
 * @param {Object} object The object to be manipulated
 * @param {string} property The name of the property to be manipulated
 * @param {Object} [params] Optional parameters
 * @param {Number} [params.min] Minimum allowed value
 * @param {Number} [params.max] Maximum allowed value
 * @param {Number} [params.step] Increment by which to change value
 */
class NumberControllerBox extends NumberController {


  constructor(object, property, params) {
    super(object, property, params);

    this.__truncationSuspended = true;// false;
    this.hasFocus = false;
    const _this = this;

    _this.__impliedStep = 0.001; // default increment 

    /**
     * {Number} Previous mouse y position
     * @ignore
     */
    let prevY;

    function onChange() {
    if(DEBUG)console.log(`{MYNAME}.onChange()`);
      const attempted = parseFloat(_this.__input.value);
      if (!common.isNaN(attempted)) {
        _this.setValue(attempted);
      }
    }


    function onFinish() {
      if (_this.__onFinishChange) {
        _this.__onFinishChange.call(_this, _this.getValue());
      }
    }

    function onBlur() {
      _this.hasFocus = false;
      onFinish();
    }

    function onMouseDrag(e) {
      const diff = (prevY - e.clientY);
      //_this.setValue(_this.getValue() + diff * _this.__impliedStep/5);
      prevY = e.clientY;
    }

    function onMouseUp() {
      dom.unbind(window, 'mousemove', onMouseDrag);
      dom.unbind(window, 'mouseup', onMouseUp);
      //onFinish();
    }

    function onMouseDown(e) {
      dom.bind(window, 'mousemove', onMouseDrag);
      dom.bind(window, 'mouseup', onMouseUp);
      getIncrement();
      prevY = e.clientY;
    }

    function onFocus(e) {
      _this.hasFocus = true;
      if(DEBUG)console.log(`${MYNAME}.focus()`);      
    }

    function onWheel(evt) {

      if (!_this.hasFocus)
        return;
      evt.preventDefault();
      evt.stopPropagation();
      evt.stopImmediatePropagation();
      var delta = evt.deltaY;

      if (evt.deltaY < 0) {
        doIncrement();
      } else {
        doDecrement();
      }
      //var delta = evt.deltaY;        
    }

    function doDecrement() {

      var caret = _this.__input.selectionStart;
      var value = _this.getValue() - _this.__impliedStep;
      if(DEBUG) console.log(`${MYNAME}.doDecrement() value:`, value);      
      _this.setValue(value);
      setCaret();

    }

    function doIncrement() {

      var caret = _this.__input.selectionStart;

      var value = _this.getValue() + _this.__impliedStep;
      if(DEBUG)console.log(`${MYNAME}.doIncrement() value:`, value);      
      _this.setValue(value);
      setCaret();

    }

    function setCaret() {
      var dotIndex = getDotIndex();
      var caret = Math.max(0, (dotIndex - _this.caretIndex));

      _this.__input.setSelectionRange(caret, caret);
    }

    function getDotIndex() {

      var svalue = _this.getValue().toString();
      var dotIndex = svalue.indexOf('.');
      if (dotIndex < 0) dotIndex = svalue.length;
      return dotIndex;

    }
    function getIncrement() {
      // let UI to set caret 
      setTimeout(_getIncrement, 1);
    }

    function _getIncrement() {

      var caret = _this.__input.selectionStart;
      var dotIndex = getDotIndex();
      var pw = (dotIndex - caret);
      if (pw >= 0) pw -= 1;
      var inc = Math.pow(10, pw);
      _this.caretIndex = (dotIndex - caret);
      _this.__impliedStep = inc;
      if(DEBUG) console.log(`${MYNAME}._getIncrtement() {caret:${caret} dot: ${dot}, inc:{inc}`);
      return inc;
    }

    this.__input = document.createElement('input');
    this.__input.setAttribute('type', 'text');

    dom.bind(this.__input, 'change', onChange);
    dom.bind(this.__input, 'blur', onBlur);
    dom.bind(this.__input, 'focus', onFocus);
    dom.bind(this.__input, 'mousedown', onMouseDown);
    dom.bind(this.__input, 'mouseup', onFocus);
    dom.bind(this.__input, 'wheel', onWheel);
    dom.bind(this.__input, 'keydown', function (e) {
      // When pressing enter, you can be as precise as you want.
      if(DEBUG) console.log(`${MYNAME}.keyDown(${e.keyCode})`);
      switch (e.keyCode) {

        case UP_ARROW: doIncrement(); break;
        case DOWN_ARROW: doDecrement(); break;

        case LEFT_ARROW:
        case RIGHT_ARROW: getIncrement(); break;

        case KEY_ENTER: onChange(); break;
      }
      //_this.__input.setSelectionRange(2,2);
      // if (e.keyCode === 13) {
      //_this.__truncationSuspended = true;
      //this.blur();
      //_this.__truncationSuspended = false;
      //onFinish();
      //}
    });

    this.updateDisplay();

    this.domElement.appendChild(this.__input);
  }

  updateDisplay() {

    //this.__input.value = this.getValue();
    this.__input.value = roundToDecimal(this.getValue(), 10);

    return super.updateDisplay();
  }
}

export default NumberControllerBox;
