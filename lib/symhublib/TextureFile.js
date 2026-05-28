import {
    getParam,
    isDefined,
    isFunction,
    TW as twgl,
    ParamChoice, 
    ParamInt,
    ParamBool,
    ParamImage,
    asyncTracker,
    CustomImageManager,
}
from './modules.js';

const DEFAULT_TEX_INFO = [{
        name: 'orange arrow',
        path: 'images/arrow_orange.png'
    }
];

var sDefaultTexture = null;

const MYNAME = 'TextureFile';

const DEBUG = false;

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

        let ti = getParam(options.texInfo, DEFAULT_TEX_INFO);

        this.gl = null;  // set later by init(glContext)
        this.onChanged = options.onChanged || noop;

        this.texInfo = ti;
        this.texNames = this.getTexNames(ti);
        this.texParams = {
            texName:   getParam(options.texName,   this.texNames[0]),
            showFrame: getParam(options.showFrame, false),
            texSize:   getParam(options.texSize,   512),
        };
        this.mParams = this.makeParams();
        this.needToDraw = false;

        if (DEBUG) console.log('texParams: ', this.texParams);
    }

    // Called by the owner once a WebGL context is available.
    init(glContext) {

        this.gl = glContext.gl ?? glContext;  // accept both {gl} and raw gl
        if (!isDefined(this.gl)) {
            console.error(`${MYNAME}.init(): gl is not defined`);
            return;
        }
        this._initGL();
    }

    _initGL() {

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
                obj:    tconf,
                key:    'texName',
                choice: this.texNames,
                name:   'name',
                onChange: onTC,
            }),
            image: ParamImage({
                name:      'image',
                id:        'texImage',
                storageId: 'texImagePicker',
                onChange:  this._onImageParamChanged.bind(this),
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
    _setParamsMap(pm) {
        
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
    _getParamsMap() {
        if (DEBUG)
            console.log(`${MYNAME}.getParamsMap()`);
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
    _initGUI(folder) {

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

    _createUI(folder) {
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

    informListeners(){
        
        if (isDefined(this.onChanged))
            this.onChanged();        
    }

    //
    //  param changed via UI -> inform listener
    //
    onParamChanged() {

        if (DEBUG)
            console.log(`${MYNAME}.onParamChanged() texName: `, this.texParams.texName);
        this.informListeners();
        
    }

    onTexChanged() {

        const texPath = this.getTexPath();

        if (texPath === null) {
            if (this._asyncToken) {
                asyncTracker.end(this._asyncToken);
                this._asyncToken = null;
            }
            this.texPath = null;
            // 'Custom' selected — delegate to image param
            this._onImageParamChanged();
            return;
        }

        if (texPath != this.texPath) {

            this.texPath = texPath;

            // End any previously pending load for this instance before
            // starting a new one (e.g. user switches texture quickly).
            if (this._asyncToken) {
                asyncTracker.end(this._asyncToken);
                this._asyncToken = null;
            }

            const expectedPath = texPath;
            this._asyncToken = asyncTracker.begin(`TextureFile:${texPath}`);
            this.img = loadImage(texPath, (msg, img) => {
                if (expectedPath !== this.getTexPath()) {
                    return;
                }
                this.onImageLoaded(msg, img);
            });

        } else {

            this.onImageLoaded(null, this.img);
        }
    }

    /**
     * Called when ParamImage reports new image data (user selected a file or
     * document loaded from BinaryLoader), OR when texName is switched to 'Custom'.
     * Sets texName to 'Custom', refreshes the dropdown UI (without re-triggering
     * onChange), then decodes the PNG bytes and uploads to the WebGL texture.
     */
    _onImageParamChanged() {
        if (!this.mParams || !this.gl) return;   // not yet fully initialised

        const data = this.mParams.image.getImageData();
        if (!data) {
            this.loadSuccess = false;
            return;
        }

        // Switch dropdown to 'Custom' and refresh the UI without firing onChange
        this.texParams.texName = 'Custom';
        this.mParams.texName.updateDisplay();

        const hash = CustomImageManager.getFastHash(data);
        this.expectedHash = hash;

        CustomImageManager.loadCustomImage(data, {
            onSuccess: (img) => {
                if (this.texParams.texName !== 'Custom' || this.expectedHash !== hash) {
                    return;
                }
                this.img = img;
                this.loadSuccess = true;
                this.needToDraw = true;
                this.drawTexture(img);
                this.informListeners();
            },
            onError: () => {
                if (this.texParams.texName !== 'Custom' || this.expectedHash !== hash) {
                    return;
                }
                this.loadSuccess = false;
            }
        });
    }

    onImageLoaded(msg, img) {

        // Always release the async token so waitForIdle() can resolve.
        if (this._asyncToken) {
            asyncTracker.end(this._asyncToken);
            this._asyncToken = null;
        }

        if (msg != null) {

            console.error('failed to load image');
            this.loadSuccess = false;
            this.informListeners();
            return;

        }

        this.loadSuccess = true;
        this.drawTexture(img);
        this.needToDraw = true;

        // Mirror the loaded URL texture in the image param thumbnail (display only —
        // does not change the serialisable custom image data).
        this.mParams?.image?.setDisplayImage(this.texPath, this.texParams.texName);

        this.informListeners();

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
        //console.log('drawing image: ', img.width, img.height);
        if( img.width >= img.height ){
            let dh = tw*img.height/img.width;
            ctx.drawImage(img, 0, (tw-dh)/2, tw, dh);
        } else {
            let dw = tw*img.width/img.height;
            ctx.drawImage(img, (tw-dw)/2, 0, dw, tw);            
        }

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

        // 'Custom' means image param data is used — no URL
        if (this.texParams.texName === 'Custom') return null;

        let index = Math.max(0, this.texNames.indexOf(this.texParams.texName));
        // Guard: 'Custom' at end of texNames array is beyond texInfo bounds
        if (index >= this.texInfo.length) return null;
        return this.texInfo[index].path;
    }

    /**
     * Extract names from texInfo and append 'Custom' for the image-param slot.
     */
    getTexNames(info) {

        if (DEBUG)
            console.log('getTextNames()', info);
        const names = [];
        for (let i = 0; i < info.length; i++) {
            names.push(info[i].name);
        }
        names.push('Custom');   // user-selected image via ParamImage
        if (DEBUG)
            console.log('getTextNames() return: ', names);
        return names;
    }

    getParams() {
        return this.mParams;
    }
    
    getClassName(){
        return MYNAME;
    }
    

} // class TextureFile
