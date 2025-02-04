import {
    
    createInternalWindow,
    createImageButton,
    
} from './modules.js';

const DEBUG=false;

const defaultBackgroundColor = '#EEE';
const dragBackgroundColor = '#FFA';
const IMG_MARGIN = '10';
const DEFAULT_TMB_SIZE = 128;
const PX = 'px';
const DEFAULT_TITLE = 'images';
const DEFAULT_WIDTH = '400px';
const DEFAULT_HEIGHT = '400px';
const DEFAULT_LEFT = '10px';
const DEFAULT_TOP = '10px';
const EXT_JSON = '.json';
const EXT_PNG = '.png';
const DEFAULT_THUMB_URL = 'images/ui/btn_no_image.png';

//  
//  param.onSelect - call back when image is selected 
//  param.height   in string in CSS format 
//  param.height 
//  param.left
//  param.top 
//  param.title
// 
//
function createImageSelector(param = {}){
    
    let myself = {
       addItems:      addItems,
       updateItem:    updateItem,
       findItem:      findItem,
       addFiles:      addFiles,
       setVisible:    setVisible,
       selectItem:    selectItem,
    };
    
    let onSelect = param.onSelect || onSelectDefault;
    let docWidth = (document.body.clientWidth || 200);
    let width = (param.width) || DEFAULT_WIDTH;
    let height = (param.height) || DEFAULT_HEIGHT;
    let top = (param.top) || DEFAULT_TOP;
    let left = (param.left) || DEFAULT_LEFT;
    let title = (param.title) || DEFAULT_TITLE;
    let tmbSize = DEFAULT_TMB_SIZE;
    let mFilesFilter = (param.filesFilter )? (param.filesFilter) : createDefaultImageFilesFilter();
    
    let intWin = createInternalWindow({
                                        width:width, 
                                        height: height,
                                        left: left, 
                                        top: top,
                                        title: title,
                                        canClose: true,
                                        canResize: true,
                                        storageId: param.storageId,
                                        });    
    
    let div = document.createElement('div');
    let ds = div.style;
    ds.position = 'absolute';
    ds.backgroundColor = defaultBackgroundColor;
    ds.width = '100%';
    ds.height = '100%';
    ds.overflow = 'auto'; 
    
    div.addEventListener('dragover',  onDragOver);
    div.addEventListener('drop',      onDragDrop);
    div.addEventListener('dragenter', onDragEnter);
    div.addEventListener('dragleave', onDragLeave);
    //makeMouseHandler(canvas);
    
    
    //console.log('imageSelectorDiv:', div);
    let mCurrentSelect = null;
    intWin.interior.appendChild(div);
    
    //let clientDiv = document.createElement('div');
    let interior = intWin.interior;
    
    interior.style.overflowY = "auto";
    interior.style.overflowX = "hidden";


    let mainDiv = div;
    
    interior.appendChild(mainDiv);
    
    let mImages = [];  
    
    
    function setVisible(visible){
       intWin.setVisible(visible);
    }
    
    function onDragDrop(evt){
        
        if(DEBUG)console.log('ImageSelector.onDragDrop():', evt);        
        div.style.backgroundColor = defaultBackgroundColor;
        evt.stopPropagation();
        evt.preventDefault();
        
        var dt = evt.dataTransfer;
        var files = dt.files;
        addFiles(files)
                        
    }

    function addFiles(files){
        if(mFilesFilter){
           let imgItems = mFilesFilter.getImageItems(files);
           addItems(imgItems);
        }  else {
           console.warn("can't add files because mFilesFilter isn't defined"); 
        }            
    }

    async function addImageFromTmb(tmb, userData){
            
        if(DEBUG)console.log('addImageFromTmb(): ', tmb.substring(0, 30), userData);          
        let btn = createImageButton({
                                    src: tmb, 
                                    onClick: onImageClick, 
                                    userData: userData, 
                                    width:tmbSize, 
                                    height:tmbSize, 
                                    });                      
        mainDiv.appendChild(btn.img);
        mImages.push(btn);
        
    }

    async function addImageFromURL(imgUrl, userData){
            
        if(DEBUG)console.log('addImageFromURL(): ', imgUrl, userData);          
        let blob = await fetch(imgUrl).then(r => r.blob());
        createImageBitmap(blob).then(onBlobLoaded);
        
        function onBlobLoaded(img){ 
        
            if(DEBUG)console.log('onBlobLoaded(): ', img); 
            let tmb = drawThmb(img);        
            let btn = createImageButton({
                                        src: tmb, 
                                        onClick: onImageClick, 
                                        userData: userData, 
                                        width:tmbSize, 
                                        height:tmbSize, 
                                        });                      
            mainDiv.appendChild(btn.img);
            mImages.push(btn);
        }
        
    }

    function addImageFromFile(file, data){
            
        if(DEBUG)console.log('addImageFromFile(): ', file, data);  
        createImageBitmap(file).then(onImageLoaded);
        
        function onImageLoaded(img){ 
        
            if(DEBUG)console.log('onImageLoaded(): ', img); 
            let tmb = drawThmb(img);        
            let btn = createImageButton({
                                    src:      tmb, 
                                    onClick:  onImageClick, 
                                    userData: data,
                                    width:    tmbSize, 
                                    height:   tmbSize,                                     
                                    });          
            mainDiv.appendChild(btn.img);
            mImages.push(btn);
        }
        
    }
    
    function drawThmb(img){
    
        const canvas = document.createElement("canvas");
        const size = tmbSize;
        
        canvas.width = size; // the size, not the style
        canvas.height = size;
        let sizeX = size;
        let sizeY = size;
        let offsetX = 0;
        let offsetY = 0;
        if(img.width >= img.height){
            sizeY = ((size*img.height)/img.width);
            offsetY = (size - sizeY)/2;
        } else {
            sizeX = ((size*img.width)/img.height);
            offsetX = (size - sizeX)/2;            
        }
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(img, offsetX, offsetY, sizeX, sizeY);
        
        let url = canvas.toDataURL();
        canvas.remove();
        return url;
    }

    function onDragOver(evt){
        //console.log('ImageSelectorDragOver():', evt);
        evt.stopPropagation();
        evt.preventDefault();        
    }
    
    function onDragEnter(evt){
        if(DEBUG)console.log('ImageSelectorDragEnter():', evt);
        div.style.backgroundColor = dragBackgroundColor;
        evt.stopPropagation();
        evt.preventDefault();
    }
    function onDragLeave(evt){
        if(DEBUG)console.log('ImageSelectorDragLeave():', evt);
        div.style.backgroundColor = defaultBackgroundColor;
        evt.stopPropagation();
        evt.preventDefault();
    }
    
    //
    // imageItems is array of imageItem 
    // imageItem : {tmb: bitmap, data: userData}
    //     
    // 
    function addItems(imageItems){
        
        if(DEBUG)console.log('ImageSelector.addItems(), count: ', imageItems.length);

        var count = imageItems.length;
        if(DEBUG)console.log("File Count: " + count + "\n");
        
        for (var i = 0; i < imageItems.length; i++) {
            let item = imageItems[i];
            if(DEBUG)console.log('imageItem: ', item);
            if(item.file){
                let file = item.file;
                if(DEBUG)console.log("image from file:", file);
                addImageFromFile(file, item.data);
            } else if(item.url){
                addImageFromURL(item.url, item.data);
            } else if(item.tmb){
                addImageFromTmb(item.tmb, item.data);
            } 
            if(item.data){
                if(DEBUG)console.log("item.data:", item.data);                
            }
            
        }         
        
    }

    function updateItem(imageItem){
        
        if(DEBUG)console.log('updateItem(): ', imageItem);
        let item = findItem(imageItem.data);
        if(item) {
            if(DEBUG)console.log('found item: ', item); 
            item.img.src = imageItem.tmb;
        }            
        
    }

    function findItem(userData){
        
        for(let i = 0; i < mImages.length; i++){
            let item = mImages[i];
            if(item.userData == userData)
                return item;
        }
        console.warn('imageItem not found for ', userData);
        return null;
        
    }
    
    function onImageClick(imgButton){
        
        if(DEBUG)console.log('ImageSelector.onImageClick():', imgButton);
        if(mCurrentSelect != null) {
            mCurrentSelect.setSelected(false);
        } 
        mCurrentSelect = imgButton;
        mCurrentSelect.setSelected(true);
        
        onSelect(imgButton.userData);
    }

    function selectItem(imageItem){
        if(DEBUG)console.log('ImageSelector.selectItem():', imageItem);
        if(mCurrentSelect != null) {
            mCurrentSelect.setSelected(false);
        } 
        //TODO - which button represents item
        mCurrentSelect = imageItem;
        mCurrentSelect.setSelected(true);
        
    }

    function onSelectDefault(imageData){
        if(DEBUG)console.log('onSelectDefault():', imageData);
    }
    
    return myself;

} // function createImageSelector()

//
// makes imageItem array out of array of files 
// this filter tests if the file is image file 
//
function createDefaultImageFilesFilter(){
    
    function getImageItems(files){
        
        //var count = files.length;
        if(DEBUG)console.log("DefaultImageFilesFilter.getImageItems(), files: ", files);
        
        let items = [];
        for (var i = 0; i < files.length; i++) {
            let file = files[i];
          if(DEBUG)console.log("file:", file);
          if(file.type.startsWith('image/'))
            items.push({file: file, data: file});
        } 

        return items;
               
    }
    
    return {
        getImageItems: getImageItems,
    }
} // function createDefaultImageFilesFilter(){ 

// used to filter dropped files into sensible data 
// 
// this filter pairs .json file and corresponding thumbnail .json.png file into 
// single ImageItem 
// if json file has no thumbnail it creates default thumbnail 
// 
function createPresetsFilesFilter(){

    function getImageItems(fileList){
        
        var count = fileList.length;
        if(DEBUG)console.log("PresetsFileFilter.getIageItems(), fileList: ", fileList);
        let files = [];
        for (var i = 0; i < fileList.length; i++) {
            files.push(fileList[i]);
        }
        
        let items = [];
        for (var i = 0; i < files.length; i++) {
            let file = files[i];
            if(DEBUG)console.log("file:", file);
            if(file.name.endsWith(EXT_JSON)){
                
                let tmbName = file.name + EXT_PNG;
                
                let tmbFile = files.find((elem) => {return (elem.name === tmbName);});
                
                if(tmbFile) 
                    items.push({file: tmbFile, data: {jsonFile:file, tmbFile:tmbFile}});
                else 
                    items.push({tmb: DEFAULT_THUMB_URL, data: {jsonFile:file}});
            }
        } 

        return items;
               
    }
    
    return {
        getImageItems: getImageItems,
    }    
} // function createPresetsFilesFilter()



export {
    createImageSelector,
    createPresetsFilesFilter,
    createDefaultImageFilesFilter,
}
