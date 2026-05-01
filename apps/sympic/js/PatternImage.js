import {
    getParam,
    isDefined,
    isFunction,
    TW as twgl,
    ParamChoice, 
    ParamInt,
    ParamBool,
    ParamFloat,
    ParamGroup,
    ParamObj,
    ParamString,
    setParamValues,
    getParamValues,
    EventDispatcher,
    createDoubleFBO,
    TextureFile,
    Textures,
    DataPacking,
    Sympix_programs,

    makePatternData,
}
from './modules.js';

import {
    textures as Tex2
} from '../res/textures.js';

const MYNAME='PatternImage';
const DEBUG = true;

const TORADIANS = Math.PI/180.;

const MyTextures = Textures.t2.concat(Tex2.haeckel_challenger).concat(Tex2.haeckel_kunst).concat(Tex2.misc);

if(false)console.log('Tex2:', Tex2);

// Monotonically increasing counter — gives each new instance a unique default id.
let _nextId = 1;

//
// PatternImage 
//
function PatternImage(options){

    let mConfig = {
        id:           `img${_nextId++}`,
        bufferWidth:  1024,
        centerX:      0,
        centerY:      0,
        scale:        1,
        angle:        0,
        transparency: 0,
        useCrown:     false,
    };

    let mOnIdChange = null;

    let mGL = null;
    let mRenderedBuffer = null;
    let mBufferWidth = 1024;
    let mEventDispatcher = new EventDispatcher();
    let mNeedToRender = true;
    let mPrograms = Sympix_programs;

    let mGroupData = null;
    let mGroup = null;

    // Created eagerly; GL init is deferred to mTextureMaker.init(glContext).
    const mTextureMaker = new TextureFile({
        texInfo:   MyTextures,
        onChanged: onTextureChange,
    });

    let mParams = makeParams(mConfig);  // initialized eagerly so getParams() is never null

    function addEventListener( evtType, listener ){        
        if(DEBUG)console.log(`${MYNAME}.addEventListener()`, evtType);
        mEventDispatcher.addEventListener( evtType, listener );      
    }

    function init(glContext) {

        if(DEBUG)console.log(`${MYNAME}.init()`, glContext);
        mGL = glContext.gl;
        let gl = mGL;

        mRenderedBuffer = createImageBuffer(gl, mBufferWidth);
        clearImageBuffer(mRenderedBuffer, [0.5, 0.7, 0.8, 0.9]);

        mTextureMaker.init(glContext);

        mGroupData = DataPacking.createGroupDataSampler(mGL);

    }


    function setGroup(group){
        if(DEBUG)console.log(`${MYNAME}.setGroup()`, group);
        mGroup = group;
        DataPacking.packGroupToSampler(mGL, mGroupData, mGroup); 
        informListeners();
        mNeedToRender = true;
    }

    function onTextureChange(){

       if(DEBUG)console.log(`${MYNAME}.onTextureChanged()`);
        informListeners();
        mNeedToRender = true;

    }
    function onParamChanged(){

        if(DEBUG)console.log(`${MYNAME}.onParamChanged()`);
        informListeners();
        mNeedToRender = true;
    }

    function makeParams(cfg){
        let onc = onParamChanged;
        return {
            id:           ParamString({obj: cfg, key: 'id', onChange: () => { if (mOnIdChange) mOnIdChange(); }}),
            transparency: ParamFloat ({obj: cfg, key: 'transparency', onChange: onc}),
            useCrown:     ParamBool  ({obj: cfg, key: 'useCrown',     onChange: onc}),
            transform:    ParamGroup ({
                name:   'transform',
                params: {
                    centerX: ParamFloat({obj: cfg, key: 'centerX', onChange: onc}),
                    centerY: ParamFloat({obj: cfg, key: 'centerY', onChange: onc}),
                    scale:   ParamFloat({obj: cfg, key: 'scale',   onChange: onc}),
                    angle:   ParamFloat({obj: cfg, key: 'angle',   onChange: onc}),
                },
            }),
            texture:      ParamObj   ({name: 'texture', obj: mTextureMaker}),
        };
    }

    //
    // 
    //
    function setParamsMap(values, initialize = false) {
        values = upgradeData(values);
        setParamValues(mParams, values, initialize);
    }

    // ── backward-compat migration ─────────────────────────────────────────────
    //
    //  Old preset files store centerX/centerY/scale/angle flat at the top level.
    //  New format nests them inside a 'transform' object.
    //
    function upgradeData(v) {
        const TRANSFORM_KEYS = ['centerX', 'centerY', 'scale', 'angle'];
        const hasOldFlat = !v.transform && TRANSFORM_KEYS.some(k => k in v);
        if (hasOldFlat) {
            if (DEBUG) console.log(`${MYNAME}.upgradeData(): migrating old transform format`);
            const transform = {};
            TRANSFORM_KEYS.forEach(k => {
                if (k in v) { transform[k] = v[k]; delete v[k]; }
            });
            v.transform = transform;
        }
        return v;
    }

    function informListeners(){


        mEventDispatcher.dispatchEvent({type: 'imageChanged', target: myself});
      
    }

    /**
     * @deprecated Use getPatternData().getMainBuffer() instead.
     */
    function getSimBuffer(){

        console.warn(`${MYNAME}.getSimBuffer() is deprecated. Use getPatternData().getMainBuffer() instead.`);
        if(false)console.log(`${MYNAME}.getSimBuffer()`, mRenderedBuffer);
        if(mNeedToRender){
            renderBuffer();
            mNeedToRender = false;
        }   

        return mRenderedBuffer;

    }

    function getPatternData(){

        if(false)console.log(`${MYNAME}.getPatternData()`, mRenderedBuffer);
        if(mNeedToRender){
            renderBuffer();
            mNeedToRender = false;
        }
        return makePatternData({mainBuffer: mRenderedBuffer});

    }
    
    //
    //  render buffer if needed 
    // 
    function renderBuffer(){
    
       let ubi = {
            uColorTexture:  mTextureMaker.getTexture(),
        }

        let program = mPrograms.getProgram(mGL, 'renderImage');
        program.bind();
        let buf = mRenderedBuffer.read;

        mGL.viewport(0, 0, buf.width, buf.height);              
        clearImageBuffer(buf, [0.2, 0.7, 0.2, 1.]);

        let ctUni = { u_aspect: 1., u_scale: 1., u_center: [0.,0.], u_pixelSize: 2./buf.width};
        program.setUniforms(ctUni);
        let cfg = mConfig;
        let a = -cfg.angle*TORADIANS;
        let scale = 0.5/cfg.scale;

        let imgUni = {
            uImageScale: [scale * Math.cos(a), scale*Math.sin(a)],
            uImageCenter: [cfg.centerX, cfg.centerY],
            uImageTransparency: cfg.transparency,
            uImage:             mTextureMaker.getTexture(),
            uCrownData:         mGroupData, 
            uUseCrown:          cfg.useCrown,
        };

        program.setUniforms(imgUni);
        
        program.blit(buf);

    }

    function clearImageBuffer(buffer, color){

        let gl = mGL;
        if(DEBUG)console.log(`${MYNAME}.clearImageBuffer() buffer: `, buffer, ' color: ', color);
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.fbo);
        gl.disable(gl.BLEND);        
        gl.clearColor(color[0], color[1],color[2],color[3]);    
        gl.clear(gl.COLOR_BUFFER_BIT);

    }

    function createImageBuffer(gl, width) {

      const filtering = gl.LINEAR;
      const format = gl.RGBA, intFormat = gl.RGBA32F, texType = gl.FLOAT;              
      return createDoubleFBO( gl, width, width, intFormat, format, texType, filtering );

    }

    function getValue() {
        return {
            className: MYNAME,
            params:    getParamValues(mParams),
        };
    }

    function getParams(){
        return mParams;
    }

    function getImage(){
        if(mNeedToRender){
            renderBuffer();
            mNeedToRender = false;
        }
        return mRenderedBuffer;
    }
        
    let myself = {
        getClassName    : () => MYNAME,
        getName         : () => MYNAME,
        getId           : () => mConfig.id,
        setOnIdChange   : (cb) => { mOnIdChange = cb; },
        addEventListener: addEventListener, 
        setGroup        : setGroup, 
        init            : init,
        getValue        : getValue,
        getParams       : getParams,
        setParamsMap    : setParamsMap,
        getSimBuffer    : getSimBuffer,
        getPatternData  : getPatternData,
    };

    return myself;
}

//
//  factory of PatternImages
//
export const PatternImageCreator = {
        //
        create:         ()=> {return PatternImage();},
        getName:        () => {return `${MYNAME}-factory`;},
        getClassName:   ()=>{return `${MYNAME}`;}    
};

    

export { PatternImage };
