import {
    DatGUI,
    ParamColorExt,
    createParamUI,
    ParamChoice,
    ParamFunc,
    ParamFloat,
    ParamString,
    getWebGLContext,
    getPixelRatio,
    hexToPremult,
    hexToColor,
    createInternalWindow,
    createImageSelector,
    createExportImageDialog,
    createFileSelectionDialog,
    canvasToLocalFile,
} from './modules.js'

import { Overlay_programs } from './OverlayExtractorPrograms.js';



const DEBUG = true;
const TYPE_PNG = 'image/png';
const EXT_PNG = '.png';
const PX='px';
const BGRND_CHECKER = 'url("images/checker_bgrnd_10.png"'
const COLOR_WHITE = '#FFFFFF';
const COLOR_BLACK = '#000000';
const overlayTypes = ['lighter', 'darker', 'flexible'];
const outputTypes = ['original','overlay','alpha','1-alpha'];
const overlayBgrndNames = ['transparent', 'white', 'black', 
                        'color1','color2','color3', 'color4'];
const imgBgrndNames = overlayBgrndNames.slice(1);

function OverlayExtractor(arg){
    
    console.log('OverlayExtractor(): ', arg);
    
    const glCont = createGLCanvas();
    const glCanvas = glCont.canvas;
    const glContainer = glCont.container;
    const imgCont = createImgCanvas();
    const imgCanvas = imgCont.canvas;
    const imgWindow = imgCont.wnd;
    
    const imgSelector = createImageSelector({onSelect: onImageSelect, storageId: 'oe_imgSelector'});
    const overlayCanvas = document.getElementById('overlay');

    let mExportDialog      = null;  // lazily created on first Export click
    let mFileBrowserDialog = null;  // created in init(); visibility auto-restored via localStorage


    let mGUI = null;
    let mParams = null;
   // console.log('canvasContainer: ', canvasContainer);
    console.log('glCanvas: ', glCanvas);

    let glCtx = getWebGLContext(glCanvas, {
        preserveDrawingBuffer: true
    });
    console.log('glCtx:', glCtx);

    const config = {
        overlayBgrnd: 'transparent',
        imgBgrnd:  'white',
        overlayType: 'darker',
        imgWidth: 1000,
        imgHeight: 800,
        imgName:  '[none]',
        imgSize:  '[]',
        bgrndColor: '#000000',
        color1: '#FFAAAA',
        color2: '#FFFFAA',
        color3: '#AAFFFF',
        color4: '#AAAAFF',
        zoom: 1.0,
        outputType: outputTypes[1],
    };

    // ── Config persistence ────────────────────────────────────────────────────
    const CONFIG_KEY  = 'oe_config';
    const CONFIG_KEYS = ['imgBgrnd', 'overlayType', 'outputType', 'overlayBgrnd',
                         'color1', 'color2', 'color3', 'color4', 'zoom'];

    function saveConfig() {
        try {
            const saved = {};
            for (const k of CONFIG_KEYS) saved[k] = config[k];
            localStorage.setItem(CONFIG_KEY, JSON.stringify(saved));
        } catch(e) {
            console.warn('OverlayExtractor: could not save config', e);
        }
    }

    function loadConfig() {
        try {
            const txt = localStorage.getItem(CONFIG_KEY);
            if (!txt) return;
            const saved = JSON.parse(txt);
            for (const k of CONFIG_KEYS) {
                if (saved[k] !== undefined) config[k] = saved[k];
            }
        } catch(e) {
            console.warn('OverlayExtractor: could not load config', e);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

    
    init();
    
    function createGLCanvas(){
        
        let docWidth = (document.body.clientWidth || 200);
        
        let opt = {width:  (0.4*docWidth)+'px', 
                   height: (0.5*docWidth)+'px',
                   left:'10px', top:'10px',
                   title: 'overlay',
                   canResize: true,
                   storageId: 'oe_overlay'};
        console.log('opt: ', opt)           
        let wnd = createInternalWindow(opt);
                            
        let cnvCont = document.createElement('div');
        let style = cnvCont.style;
        style.position = 'absolute';
        style.width = '100%';
        style.height = '100%';
        style.overflow = 'auto'; 
        style.backgroundImage = BGRND_CHECKER;
        style.backgroundColor = '#FFF';        
        style.backgroundSize = '15px';
        wnd.interior.appendChild(cnvCont);
        
        let cnv = document.createElement('canvas');
        cnv.style.position = 'absolute';
        cnv.style.width = '100%';
        cnv.style.height = '100%';
        cnv.style.backgroundColor = '#fff0';
        cnvCont.appendChild(cnv);
        
        return {wnd: wnd, container: cnvCont, canvas: cnv};
    }

    //
    //  called when user select image in ImageSelector 
    //
    function onImageSelect(imgData){
        
        console.log('OverlayExtractor.onImageSelect(): ',imgData);
        if(imgData.file)      
            loadImageFromFile(imgData.file);
        else if(imgData.url){  
            gOrigImageName = imgData.name;
            loadImageFromURL(imgData.url);
        }
        
    }

    
    function onDragDrop(evt){
        
        console.log('onDrop():', evt);        
        evt.stopPropagation();
        evt.preventDefault();
                
        var dt = evt.dataTransfer;
        var files = dt.files;
        addFiles(files);
        /*
        // add imgItems to imageSelector 
        let imgItems = [];
        for (var i = 0; i < files.length; i++) {
          console.log("File:", files[i]);
          let file = files[i];
          imgItems.push({file: file, data:file});
        }   
        imgSelector.addImageItems(imgItems);
        */
    }
    function onDragOver(evt){
        console.log('onDragOver():', evt);
        evt.stopPropagation();
        evt.preventDefault();
    }
    
    function onDragEnter(evt){
        console.log('onDragEnter():', evt);
        evt.stopPropagation();
        evt.preventDefault();
    }
    function onDragLeave(evt){
        console.log('onDragLeave():', evt);
        evt.stopPropagation();
        evt.preventDefault();
    }

    
    function createImgCanvas(){
        
        let docWidth = (document.body.clientWidth || 200);
        
        let opt = {width:  (0.4*docWidth)+'px', 
                   height: (0.5*docWidth)+'px',
                   left:(0.4*docWidth + 20) + 'px', 
                   top:'10px',
                   title: 'original image',
                   canResize: true,
                   storageId: 'oe_origImage'};
        let wnd = createInternalWindow(opt);
        let canvas = document.createElement('canvas');
        let style = canvas.style;
        style.position = 'absolute';
        style.backgroundColor = '#dfd';
        style.width = '100%';
        style.height = '100%';        

        canvas.addEventListener('dragover', onDragOver);
        canvas.addEventListener('drop', onDragDrop);
        canvas.addEventListener('dragenter', onDragEnter);
        canvas.addEventListener('dragleave', onDragLeave);
        //window.
        makeMouseHandler(canvas);
        console.log('canvas:', canvas);
        wnd.interior.appendChild(canvas);
        return {wnd: wnd, canvas:canvas};
    }
    
    function init(){

        loadConfig();     // restore saved params before building the UI
        onBgrndChanged(); // apply restored overlayBgrnd to the canvas background

        // Control panel: a draggable internalWindow containing a DatGUI panel.
        const ctrlWin = createInternalWindow({
            title:     'controls',
            width:     '300px',
            height:    '420px',
            left:      '10px',
            top:       '10px',
            canResize: true,
            storageId: 'oe_controls',
        });
        const interior = ctrlWin.interior;
        interior.style.overflow       = 'auto';
        interior.style.backgroundColor = 'var(--background-color, #1a1a1a)';

        mGUI = new DatGUI({ autoPlace: false, width: 290 });
        mGUI.domElement.style.cssText = 'position:relative; width:100%;';
        interior.appendChild(mGUI.domElement);
        createParamUI(mGUI, getParams());

        // Image browser dialog — created eagerly so its InternalWindow can
        // restore its saved visibility from localStorage on startup.
        mFileBrowserDialog = createFileSelectionDialog({
            title:     'Select Image',
            filter:    'image',
            storageId: 'oe_imageBrowser',
            width:     '520px',
            height:    '480px',
            onSelect:  async (item) => {
                if (!item.imageHandle) return;
                const file = await item.imageHandle.getFile();
                loadImageFromFile(file);
            },
        });

        // If the dialog was open when the app last closed, the InternalWindow
        // is already visible (restored from localStorage), but the folder
        // content hasn't been populated yet. Call show() to restore it.
        if (localStorage.getItem('oe_imageBrowser_visible') === 'true') {
            mFileBrowserDialog.show();
        }

        // Programs are compiled lazily on first getProgram() call —
        // no explicit initFragments / buildProgramsCached needed.

    }

    function makeParams() {

        return {
            loadImage:
            ParamFunc({
                func: onLoadImageFile,
                name: 'Browse Images...',
            }),
            imgName: 
            ParamString({
                obj: config,
                key: 'imgName',
                name: 'image',
            }),            
            imgSize: 
            ParamString({
                obj: config,
                key: 'imgSize',
                name: 'size',
            }),
            zoom:
            ParamFloat({
                obj: config,
                key: 'zoom',
                name: 'zoom',
                min: 0.001,
                max: 8.0,
                step: 0.001,
                onChange: onZoomChanged,
            }),            
            imgBgrnd: 
                ParamChoice({
                    obj: config,
                    key: 'imgBgrnd',
                    name: 'background',
                    choice: imgBgrndNames,
                    onChange: onMakeOverlay,
                }
                ),
            overlayType:
            ParamChoice({
                obj: config,
                key: 'overlayType',
                name: 'algorithm',
                choice: overlayTypes,                
                onChange:onMakeOverlay,
            }),
            outputType:
            ParamChoice({
                obj: config,
                key: 'outputType',
                name: 'output type',
                choice: outputTypes,
                onChange:onMakeOverlay,
            }),
            overlayBgrnd: 
                ParamChoice({
                    obj: config,
                    key: 'overlayBgrnd',
                    name: 'output bgrnd',
                    choice: overlayBgrndNames,
                    onChange: onBgrndChanged,
                }
                ),
            color1:
            ParamColorExt({
                obj: config,
                key: 'color1',
                name: 'color 1',
                onChange: onColoringChanged,
            }),
            color2:
            ParamColorExt({
                obj: config,
                key: 'color2',
                name: 'color 2',
                onChange: onColoringChanged,
            }),
            color3:
            ParamColorExt({
                obj: config,
                key: 'color3',
                name: 'color 3',
                onChange: onColoringChanged,
            }),
            color4:
            ParamColorExt({
                obj: config,
                key: 'color4',
                name: 'color 4',
                onChange: onColoringChanged,
            }),
            exportOverlay:
            ParamFunc({
                func: onSaveOverlay,
                name: 'Export Overlay...',
            }),
        };
    }
    
    function onZoomChanged() {
        // Only update the CSS display size; pixel dimensions (= render/export
        // resolution) stay at full image size regardless of zoom level.
        if (config.imgWidth && config.imgHeight) {
            const pr   = getPixelRatio();
            const zoom = config.zoom ?? 1.0;
            glCanvas.style.width   = (config.imgWidth  * zoom / pr) + 'px';
            glCanvas.style.height  = (config.imgHeight * zoom / pr) + 'px';
            imgCanvas.style.width  = (config.imgWidth  * zoom / pr) + 'px';
            imgCanvas.style.height = (config.imgHeight * zoom / pr) + 'px';
        }
        saveConfig();
    }

    function onColoringChanged(){
        onBgrndChanged();
        onMakeOverlay();
    }


    function onBgrndChanged(){
        let style = glContainer.style;
        if(config.overlayBgrnd === 'transparent'){
            style.backgroundImage = BGRND_CHECKER;
            style.backgroundColor = '#FFF';
            saveConfig();
            return;
        }
        style.backgroundImage = null;
        
        switch(config.overlayBgrnd){
            case 'black':  style.backgroundColor = COLOR_BLACK; break;
            case 'white':  style.backgroundColor = COLOR_WHITE; break;
            case 'color1': style.backgroundColor = config.color1; break;
            case 'color2': style.backgroundColor = config.color2; break;
            case 'color3': style.backgroundColor = config.color3; break;
            case 'color4': style.backgroundColor = config.color4; break;           
        }
        saveConfig();
    }
    
    
    let gImage = null;
    let gTex = null;
    let gOrigImageName = 'image.png';
    
    //
    //  Open the image folder browser.
    //  The dialog's open/closed state is persisted by its InternalWindow
    //  (storageId + '_visible' in localStorage), so it reopens automatically
    //  on the next app start if it was visible when the app was closed.
    //
    function onLoadImageFile() {
        mFileBrowserDialog.show();
    } 

    function addFiles(files){
        
        console.log('OverlayExtractor.handleFiles(): ', files);
        let imgItems = [];
        for(let i = 0; i < files.length; i++){
            // Wrap in {file:} so onImageSelect receives {file, url, name} shape.
            imgItems.push({file: files[i], data: {file: files[i], name: files[i].name}});
        }
        imgSelector.addItems(imgItems);
    }

    //
    //  accepts array of {name, url, tmb}
    //
    function addImages(imags){
        
        console.log('OverlayExtractor.addImages(): ', imags);
        let imgItems = [];
        for(let i = 0; i < imags.length; i++){
            let img = imags[i];
            // getName() is required by imageSelector for the thumbnail caption.
            imgItems.push({tmb: img.tmb, data: {url: img.url, name: img.name, getName: () => img.name}});
        }
        imgSelector.addItems(imgItems);
        
    }
    
    
    async function loadImageFromURL(url){
        console.log('loadImageFromURL: ', url);  
        let blob = await fetch(url).then(r => r.blob());
        createImageBitmap(blob).then(onImageLoaded);
        
    }
    
    function loadImageFromFile(file){
        console.log('loadImageFromFile: ', file);
        gOrigImageName = file.name;
        createImageBitmap(file).then(onImageLoaded);
        
    }

    function onImageLoaded(img){
        config.imgWidth  = img.width;
        config.imgHeight = img.height;

        // Auto-fit: compute zoom so the image fills the overlay window interior.
        // Must be done BEFORE drawImage() so the original canvas is sized correctly.
        const interior = glCont.wnd.interior;
        const availW   = interior.clientWidth  || img.width;
        const availH   = interior.clientHeight || img.height;
        const pr       = getPixelRatio();
        const fitZoom  = Math.min(
            availW * pr / img.width,
            availH * pr / img.height,
            4.0   // cap: don't upscale tiny images beyond 4×
        );
        config.zoom = Math.round(fitZoom * 100) / 100;
        if (mParams?.zoom) mParams.zoom.updateDisplay();

        drawImage(img);  // uses the already-updated config.zoom

        // Flip Y for correct WebGL orientation
        createImageBitmap(img, {imageOrientation: 'flipY'}).then(procImg);
    }
    
    function procImg(img){
        console.log('procImg: ', img);  
        // img is imageBitmap 
        let size = `[${img.width} x ${img.height}]`;
        //console.log('info: ');
        mParams.imgName.setValue(gOrigImageName);
        mParams.imgSize.setValue(size);
        //mParams.imgWidth.setValue(img.width);
        //mParams.imgHeight.setValue(img.height); 
        
        let gl = glCtx.gl;
        
        let level = 0;
        const target = gl.TEXTURE_2D;
        let internalFormat = gl.RGBA;
        let format = internalFormat;
        const texType = gl.UNSIGNED_BYTE;
        
        const tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(target, tex);  
        //gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        //gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        // this flip seems to be has no effect on loading images 
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); 
        
        gl.texImage2D(target, level, internalFormat, format, texType, img);
        //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        //  new Uint8Array([0, 0, 255, 255]));
        gImage = img;
        gTex = tex;
        console.log('gImage: ', gImage);
        console.log('gTex: ', gTex);                       
        onMakeOverlay();
    }

     function getOverlayName(){
         let overlay = gOrigImageName;
         let dotIndex = overlay.lastIndexOf('.');
         if(dotIndex > 0) 
             overlay = overlay.substring(0, dotIndex);
         overlay+= '_over.png';
         console.log('getOverlayName() return: ', overlay);
         return overlay;
     }

    function drawImage(img){
        
        imgCanvas.width = img.width;
        imgCanvas.height = img.height;
        const pr   = getPixelRatio();
        const zoom = config.zoom ?? 1.0;
        imgCanvas.style.width  = (img.width  * zoom / pr) + PX;
        imgCanvas.style.height = (img.height * zoom / pr) + PX;
        let ctx = imgCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

    }

    function resizeCanvases(width, height) {

        // WebGL pixel dimensions = full image resolution
        // (used for correct rendering and lossless export)
        glCanvas.width  = width;
        glCanvas.height = height;

        // CSS display size = pixel size × zoom / devicePixelRatio
        const pr   = getPixelRatio();
        const zoom = config.zoom ?? 1.0;
        glCanvas.style.width  = (width  * zoom / pr) + 'px';
        glCanvas.style.height = (height * zoom / pr) + 'px';

    }
    
    function getImgBackgroundColor(){
        
        if(config[config.imgBgrnd])
            return config[config.imgBgrnd];
        
        switch(config.imgBgrnd){
            default: 
            case 'white': return COLOR_WHITE;
            case 'black': return COLOR_BLACK;
        }
    }
    function onMakeOverlay(){
        
        resizeCanvases(config.imgWidth, config.imgHeight);
        console.log('glCanvas: ', glCanvas.width, glCanvas.height);
        const gl = glCtx.gl;
        
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);

        const renderProg = Overlay_programs.getProgram(gl, 'overlayExtractor');
        if (!renderProg) {
            console.error('OverlayExtractor.onMakeOverlay(): failed to get program');
            return;
        }
        renderProg.bind();
        
        const bgrndColor = hexToPremult(getImgBackgroundColor());
        console.log('bgrndColor:', config.bgrndColor, bgrndColor);

        const uni = {            
            u_Img: gTex,
            u_overlayType: overlayTypes.findIndex((e) => (config.overlayType == e)),
            u_outputType:  outputTypes.findIndex((e) => (config.outputType  == e)),
            u_backgroundColor: bgrndColor,
        };
        renderProg.setUniforms(uni);
        renderProg.blit(null);   // null → render to screen
        saveConfig();

    }
    
    //
    //  Open the Export Image dialog. The dialog remembers the last folder
    //  in IndexedDB and lets the user change it via FolderPickerDialog.
    //
    function onSaveOverlay() {

        if (!mExportDialog) {
            mExportDialog = createExportImageDialog({ storageId: 'oe_exportImage' });
        }

        // Build a stem from the current image name: "photo.png" → "photo_over"
        let stem = gOrigImageName ?? 'overlay';
        const dotIdx = stem.lastIndexOf('.');
        if (dotIdx > 0) stem = stem.substring(0, dotIdx);
        stem += '_over';

        mExportDialog.show({
            suggestedName:   stem,
            suggestedWidth:  config.imgWidth,
            suggestedHeight: config.imgHeight,
            onSave: async (name, folderHandle, width, height, format) => {
                const MIME = { PNG: 'image/png', JPG: 'image/jpeg', WEBP: 'image/webp' };
                const EXT  = { PNG: '.png',      JPG: '.jpg',       WEBP: '.webp'      };
                const mime = MIME[format] ?? 'image/png';
                const ext  = EXT[format]  ?? '.png';

                // Re-render at the requested export size
                resizeCanvases(width, height);
                onMakeOverlay();

                await canvasToLocalFile(glCanvas, folderHandle, name + ext, mime);
                console.log(`OverlayExtractor: saved '${name + ext}' → ${folderHandle.name}`);
            },
        });
    }

        
    function getParams() {

        if (!mParams) {
            mParams = makeParams();
        }
        return mParams;

    }
    
    function run(){        
    
        console.log('run()');
        
    }
    

    return {
        run: run,
        addFiles:  addFiles,
        addImages: addImages,
    };
}


function makeMouseHandler(elm){
    
    let myself = {
        handleEvent: handleEvent,        
    };
    elm.addEventListener('pointerdown', myself);
    elm.addEventListener('pointerup', myself);
    elm.addEventListener('pointermove', myself);
    elm.addEventListener('wheel', myself);
    elm.addEventListener('click', myself);
    elm.addEventListener('pointeroutout', myself);
    
    function handleEvent(evt){
        //console.log(evt);
    }

}


export {OverlayExtractor};
