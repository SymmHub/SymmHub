import {
    getParam,
    isDefined,
    isFunction,
    TW as twgl,
    ParamChoice, 
    ParamInt,
    ParamBool,
    ParamImage,
    ParamFunc,
    asyncTracker,
    CustomImageManager,
}
from './modules.js';
import { InterpolationNames } from './interpolation.js';
import { createImageSelector } from '../uilib/imageSelector.js';
import { FOLDER_THUMB as FOLDER_ICON, PARENT_THUMB as FOLDER_UP_ICON } from '../uilib/FileSelectionDialog.js';

const DEFAULT_TEX_INFO = [{
        name: 'orange arrow',
        path: 'images/arrow_orange.png'
    }
];

var sDefaultTexture = null;

// ------------------------------------------------------------------ //
//  Shared texture selector singleton (one window reused by all TextureFile instances)
// ------------------------------------------------------------------ //
let sSharedSelector  = null;  // the single createImageSelector instance
let sCurrentOwner   = null;  // TextureFile currently connected to the selector
let sCurrentTexInfo = null;  // root texInfo of the tree currently shown
let sNavStack        = [];   // breadcrumb: stack of texInfo arrays during folder nav



function _getOrCreateSharedSelector() {
    if (sSharedSelector) return sSharedSelector;
    sSharedSelector = createImageSelector({
        title:     'Select Texture',
        width:     '380px',
        height:    '320px',
        storageId: 'texFileSelector',
        // Delegate to whoever is currently registered as the owner.
        onSelect:  (data) => { if (sCurrentOwner) sCurrentOwner._onSelectorSelect(data); },
    });
    return sSharedSelector;
}

/**
 * Repopulates the shared selector with the current nav-stack level.
 * - Prepends a '↑ ..' folder-up entry when not at root.
 * - Renders sub-arrays as folder items; leaf entries as thumbnail items.
 */
function _populateSelectorLevel() {
    if (!sSharedSelector || !sNavStack.length) return;
    sSharedSelector.clear();

    const level = sNavStack[sNavStack.length - 1];
    const items = [];

    // Back navigation item when inside a sub-folder.
    if (sNavStack.length > 1) {
        items.push({
            tmb:  FOLDER_UP_ICON,
            data: { name: '..', isFolder: true, isBack: true, getName: () => '..' },
        });
    }

    for (const entry of level) {
        if (Array.isArray(entry.items)) {
            // Folder entry.
            items.push({
                tmb:  FOLDER_ICON,
                data: { name: entry.name, isFolder: true, items: entry.items, getName: () => entry.name },
            });
        } else {
            // Leaf texture entry.
            items.push({
                url:  entry.thumb || entry.path,
                data: { name: entry.name, getName: () => entry.name },
            });
        }
    }

    sSharedSelector.addItems(items, { noSort: true });
    // Highlight the active leaf if it lives at this level.
    if (sCurrentOwner) sCurrentOwner._syncSelectorSelection();
}

function _navigateInto(subItems) {
    sNavStack.push(subItems);
    _populateSelectorLevel();
}

function _navigateBack() {
    if (sNavStack.length > 1) {
        sNavStack.pop();
        _populateSelectorLevel();
    }
}

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
        this.texMap   = this._buildTexMap(ti);  // name → path for all leaves
        this.texParams = {
            texName:   getParam(options.texName,   this.texNames[0]),
            showFrame: getParam(options.showFrame, false),
            texSize:   getParam(options.texSize,   512),
            interpolation: getParam(options.interpolation, 'linear'),
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
            selectBtn: ParamFunc({
                name: 'Browse…',
                func: () => this._toggleSelector(),
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
            interpolation: ParamChoice({
                obj:    tconf,
                key:    'interpolation',
                choice: InterpolationNames,
                name:   'interpolation',
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
            texName: this.texParams.texName,
            interpolation: this.texParams.interpolation
        });
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
        this.img = img;
        this.drawTexture(img);

        // Mirror the loaded URL texture in the image param thumbnail (display only —
        // does not change the serialisable custom image data).
        this.mParams?.image?.setDisplayImage(this.texPath, this.texParams.texName);

        // Highlight the matching entry in the thumbnail selector (if open).
        this._syncSelectorSelection();

        this.informListeners();

    }

    // ------------------------------------------------------------------ //
    //  Thumbnail selector (shared singleton)
    // ------------------------------------------------------------------ //

    /**
     * Opens (or closes) the shared texture selector and connects it to this
     * TextureFile instance. If a different instance was previously connected,
     * the selector is repopulated with this instance's texInfo and shown.
     * If this instance is already connected and the selector is visible, it
     * is hidden (toggle behaviour).
     */
    _toggleSelector() {
        const sel = _getOrCreateSharedSelector();

        const wnd = sel.getInterior().parentElement;
        const isVisible = wnd && wnd.style.visibility !== 'hidden';

        // Same owner, still on root → toggle off.
        if (sCurrentOwner === this && sCurrentTexInfo === this.texInfo && isVisible) {
            sel.setVisible(false);
            return;
        }

        // Owner or texInfo changed → reset nav to root of this instance's tree.
        if (sCurrentOwner !== this || sCurrentTexInfo !== this.texInfo) {
            sCurrentTexInfo = this.texInfo;
            sNavStack = [this.texInfo];
        }

        sCurrentOwner = this;
        _populateSelectorLevel();   // repopulates and syncs highlight
        sel.setVisible(true);
    }

    /** Called when the user clicks an item in the selector. */
    _onSelectorSelect(data) {
        if (!data) return;
        if (data.isBack) {
            // Navigate to parent folder.
            _navigateBack();
        } else if (data.items) {
            // Navigate into a sub-folder.
            _navigateInto(data.items);
        } else {
            // Leaf texture selected.
            if (!data.name) return;
            this.texParams.texName = data.name;
            this.mParams?.texName?.updateDisplay();
            this.onTexChanged();
        }
    }

    /**
     * Highlights the active texture in the shared selector, but only when this
     * instance is the current owner (avoids clobbering another instance's state).
     */
    _syncSelectorSelection() {
        if (sCurrentOwner !== this || !sSharedSelector) return;
        const name = this.texParams.texName;
        const item = sSharedSelector.findItem({ name, getName: () => name }, /*silent=*/true);
        if (item) sSharedSelector.selectItem(item);
    }

    getCanvas(){
        if(!this.canvas){
            this.canvas = document.createElement("canvas");
        }
        return this.canvas;
    }

    drawTexture(img) {

        if (!this.gl) {
            this.needToDraw = true;
            return;
        }

        this.needToDraw = false;
        if (DEBUG)
            console.log('drawing texture:', this.texPath);
        let canvas = this.getCanvas();
        const ctx = canvas.getContext("2d");

        const ts = this.texParams.texSize;

        canvas.width = ts;
        canvas.height = ts;
        ctx.clearRect(0, 0, ts, ts);

        const isBox = (this.texParams.interpolation === 'box');
        if (isBox) {
            ctx.imageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
            ctx.msImageSmoothingEnabled = false;
        } else {
            ctx.imageSmoothingEnabled = true;
            ctx.mozImageSmoothingEnabled = true;
            ctx.webkitImageSmoothingEnabled = true;
            ctx.msImageSmoothingEnabled = true;
        }

        let lineWidth = 1;
        let tw = ts;
        //console.log('drawing image: ', img.width, img.height);
        if( img.width >= img.height ){
            let dh = Math.round(tw*img.height/img.width);
            ctx.drawImage(img, 0, Math.floor((tw-dh)/2), tw, dh);
        } else {
            let dw = Math.round(tw*img.width/img.height);
            ctx.drawImage(img, Math.floor((tw-dw)/2), 0, dw, tw);            
        }

        ctx.lineWidth = lineWidth;

        if (this.texParams.showFrame) {
            ctx.beginPath();
            const off = lineWidth/2;
            const w = ts - off;
            ctx.moveTo(off, off);
            ctx.lineTo(w, off);
            ctx.lineTo(w, w);
            ctx.lineTo(off, w);
            ctx.lineTo(off, off);
            ctx.moveTo(off, ts/2);
            ctx.lineTo(w, ts/2);
            ctx.moveTo(ts/2, off);
            ctx.lineTo(ts/2, w);
            //ctx.closePath();
            ctx.stroke();
        }

        const gl = this.gl;
        const minFilter = isBox ? gl.NEAREST : gl.LINEAR_MIPMAP_LINEAR;
        const magFilter = isBox ? gl.NEAREST : gl.LINEAR;

        twgl.setTextureFromElement(gl, this.texture, canvas, {
            min: minFilter,
            mag: magFilter,
        });

        canvas.width = 0;
        canvas.height = 0;

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
        const isBox = (this.texParams.interpolation === 'box');
        this.texture = twgl.createTexture(gl, {
            min: isBox ? gl.NEAREST : gl.LINEAR_MIPMAP_LINEAR,
            mag: isBox ? gl.NEAREST : gl.LINEAR,
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

        // 'Custom' means image param data is used — no URL.
        if (this.texParams.texName === 'Custom') return null;
        return this.texMap[this.texParams.texName] || null;
    }

    /**
     * Build a flat name→path lookup map from the (possibly nested) texInfo tree.
     */
    _buildTexMap(info) {
        const map = {};
        const traverse = (items) => {
            for (const entry of items) {
                if (Array.isArray(entry.items)) {
                    traverse(entry.items);
                } else if (entry.name && entry.path) {
                    map[entry.name] = entry.path;
                }
            }
        };
        traverse(info);
        return map;
    }

    /**
     * Extract leaf names from texInfo (recursive) and append 'Custom'.
     */
    getTexNames(info) {

        if (DEBUG)
            console.log('getTextNames()', info);
        const names = [];
        const traverse = (items) => {
            for (const entry of items) {
                if (Array.isArray(entry.items)) {
                    traverse(entry.items);  // recurse into folder
                } else {
                    names.push(entry.name);
                }
            }
        };
        traverse(info);
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
