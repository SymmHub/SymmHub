import {
    getParam,
    isDefined,
    isFunction,
    TW as twgl,
    ParamChoice, 
    ParamInt,
    ParamBool,
}
from './modules.js';

const DEFAULT_TEX_INFO = [{
        name: 'orange arrow',
        path: 'images/arrow_orange.png'
    }
];

var sDefaultTexture = null;

const MYNAME = 'TextureFile';

const DEBUG = true;

function noop() {}

//
// load image from URL and call callback when loaded
//
function loadImage(url, callback) {
    
    if(DEBUG) console.log('loadImage: ', url);
    callback = callback || noop;
    let img = new Image();

    const clearEventHandlers = function clearEventHandlers() {
        img.removeEventListener('error', onError);
        img.removeEventListener('load', onLoad);
        img = null;
    };

    const onError = function onError() {
        const msg = "couldn't load image: " + url;
        console.error(msg);
        callback(msg, img);
        clearEventHandlers();
    };

    const onLoad = function onLoad() {
        //console.log('image loaded:', url);
        callback(null, img);
        clearEventHandlers();
    };

    img.addEventListener('error', onError);
    img.addEventListener('load', onLoad);
    img.src = url;
    return img;

}

//
//  handles texture generated from image file
//
export class TextureFile {

    constructor(options) {

        this.gl = options.gl;
        if (!isDefined(this.gl)) {
            console.error('gl is not defined');
            return;
        }
        let ti = getParam(options.texInfo, DEFAULT_TEX_INFO);

        this.onChanged = options.onChanged;

        this.texInfo = ti;
        this.texNames = this.getTexNames(ti);
        this.texParams = {
            texName: getParam(options.texName, this.texNames[0]),
            showFrame: getParam(options.showFrame, false),
            texSize: getParam(options.texSize, 512),
        };
        this.mParams = this.makeParams();

        this.init();
        this.needToDraw = false;
        if (DEBUG)
            console.log('texParams: ', this.texParams);

    }

    
    init(){

        this.createDefaultTexture();
        this.createTexture();
        this.onTexChanged();
        
    }

    //
    //  make UI params
    //
    makeParams() {

        let tconf = this.texParams;
        let onTC = this.onTexChanged.bind(this);
        return {
            texName: ParamChoice({
                obj: tconf,
                key: 'texName',
                choice: this.texNames,
                name: 'name',
                onChange: onTC,
            }),
            showFrame: ParamBool({
                obj: tconf,
                key: 'showFrame',
                name: 'frame',
                onChange: onTC,
            }),
            texSize: ParamInt({
                obj: tconf,
                key: 'texSize',
                name: 'size',
                min: 64,
                max: 4096,
                onChange: onTC,
            }),
        };
    }

    //
    //
    //
    getCopy() {

        return new TextureFile({
            texInfo: this.texInfo,
            showFrame: this.texParams.showFrame,
            texSize: this.texParams.texSize,
            texName: this.texParams.texName
        });
    }

    //
    // set values of parameter from the map
    //
    setParamsMap(pm) {
        
        if(DEBUG) console.log(`${MYNAME}.setParamsMap: `, pm);
        if (isDefined(pm.texInfo)) {
            // re-init GUI
            this.texInfo = pm.texInfo;
            this.texNames = this.getTexNames(pm.texInfo);

            this.folder.remove(this.texControls.texName);
            this.folder.remove(this.texControls.showFrame);
            this.folder.remove(this.texControls.texSize);

            let onTexChanged = this.onTexChanged.bind(this);

            this.texControls.texName = this.folder.add(this.texParams, 'texName', this.texNames).name('name').onChange(onTexChanged);
            this.texControls.showFrame = this.folder.add(this.texParams, 'showFrame').name('frame').onChange(onTexChanged);
            this.texControls.texSize = this.folder.add(this.texParams, 'texSize').name('size').onChange(onTexChanged);

            //refreshGUI();

        }
        if (isDefined(pm.texName))
            this.texControls.texName.setValue(pm.texName);
        if (isDefined(pm.showFrame))
            this.texControls.showFrame.setValue(pm.showFrame);

    }

    //
    // return map of parameter values for saving
    //
    getParamsMap() {
        if (DEBUG)
            console.log("getParamsMap()");
        return {
            texInfo: this.texInfo,
            texName: this.texParams.texName,
            showFrame: this.texParams.showFrame,
            texSize: this.texParams.texSize,
        };
    }

    //
    //  create User Interface
    //
    initGUI(folder) {

        this.folder = folder;

        let onParamChanged = this.onParamChanged.bind(this);
        let onTexChanged = this.onTexChanged.bind(this);

        this.texControls = {};

        this.texControls.texName = folder.add(this.texParams, 'texName', this.texNames).name('name').onChange(onTexChanged);
        this.texControls.showFrame = folder.add(this.texParams, 'showFrame').name('frame').onChange(onTexChanged);
        this.texControls.texSize = this.folder.add(this.texParams, 'texSize').name('size').onChange(onTexChanged);

        this.createDefaultTexture();
        this.createTexture();
        this.onTexChanged();

    }

    createUI(folder) {
        this.initGUI(folder);
    }

    //
    //  return webgl texture generated by this objects
    //
    getTexture(time) {

        if (this.loadSuccess) {

            if (this.needToDraw)
                this.drawTexture(this.img);
            return this.texture;
        } else {

            return sDefaultTexture;
        }

    }

    //
    //  param changed via UI -> inform listener
    //
    onParamChanged() {

        if (DEBUG)
            console.log('texName: ', this.texParams.texName);
        if (isDefined(onChanged))
            this.onChanged();

    }

    onTexChanged() {

        let texPath = this.getTexPath();

        if (texPath != this.texPath) {

            this.texPath = texPath;
            this.img = loadImage(texPath, this.onImageLoaded.bind(this));

        } else {

            this.onImageLoaded(null, this.img);
        }
    }

    onImageLoaded(msg, img) {

        if (msg != null) {

            console.error('failed to load image');
            this.loadSuccess = false;
            this.onChanged();
            return;

        }

        this.loadSuccess = true;
        this.drawTexture(img);
        this.needToDraw = true;
        this.onChanged();

    }

    
    getCanvas(){
        if(!this.canvas){
            this.canvas = document.createElement("canvas");
        }
        return this.canvas;
    }

    drawTexture(img) {

        this.needToDraw = false;
        if (DEBUG)
            console.log('drawing texture:', this.texPath);
        let canvas = this.getCanvas();
        const ctx = canvas.getContext("2d");

        const ts = this.texParams.texSize;

        canvas.width = ts;
        canvas.height = ts;
        ctx.clearRect(0, 0, ts, ts);

        let lineWidth = 3;
        let tw = ts;
        ctx.drawImage(img, 0, 0, tw, tw);
        ctx.lineWidth = lineWidth;

        if (this.texParams.showFrame) {
            ctx.beginPath();
            const off = 2 * lineWidth;
            const w = ts - 1 - off;
            ctx.moveTo(off, off);
            ctx.lineTo(w, off);
            ctx.lineTo(w, w);
            ctx.lineTo(off, w);
            //ctx.lineTo(off, off);
            ctx.closePath();
            ctx.stroke();
        }
        twgl.setTextureFromElement(this.gl, this.texture, canvas); // options

    }

    createDefaultTexture() {

        if (sDefaultTexture != null)
            return;

        const a = 32,
        b = 255;
        sDefaultTexture = twgl.createTexture(this.gl, {
            min: this.gl.NEAREST,
            mag: this.gl.NEAREST,
            src: [
                0, 0, 0, a,
                0, 0, b, a,
                0, b, 0, a,
                b, 0, 0, a,
            ],
            //width:2,
            //height:2
        });

    }

    createTexture() {

        const gl = this.gl;
        this.texture = twgl.createTexture(gl, {
            min: gl.LINEAR_MIPMAP_LINEAR,
            mag: gl.LINEAR_MIPMAP_LINEAR,
            src: [
                128, 128, 255, 255,
            ],
        });

        let canvas = this.getCanvas();
        const ts = this.texParams.texSize;
        canvas.width = ts;
        canvas.height = ts;
    }

    getTexPath() {

        let index = Math.max(0, this.texNames.indexOf(this.texParams.texName));
        return this.texInfo[index].path;
    }

    /**
    extract names from texInfo
     */
    getTexNames(info) {

        if (DEBUG)
            console.log('getTextNames()', info);
        var names = [];
        for (let i = 0; i < info.length; i++) {

            names.push(info[i].name);
        }
        if (DEBUG)
            console.log('getTextNames() return: ', names);
        return names;
    }

    getParams() {
        return this.mParams;
    }

} // class TextureFile
