
// Local aggregator for tests/uilib/
// Re-exports everything from the uilib public API.

export {
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
    ParamColor,
    ParamCustom,
    Obj,
    ObjArray,
    createParamUI,
    getParamValues,
    setParamValues,
    updateParamDisplay,
    initParamValues,
    openFile,
    saveFileAs,
    saveTextFile,
    saveTextFileAs,
    ObjectFactory,
    createInternalWindow,
} from '../../../lib/uilib/uilib.js';
