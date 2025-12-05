import {
    
    createInternalWindow,
    createImageButton,
    
} from './modules.js';

const DEBUG = false;
const MYNAME = 'ImageSelector';

const defaultBackgroundColor = '#EEE';
const dragBackgroundColor = '#FFA';
const IMG_MARGIN = '10';
const DEFAULT_TMB_SIZE = 128;
const PX = 'px';
const DEFAULT_TITLE = 'items';
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
       clear:         clear,
       removeItem:    removeItem,
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
    
    let mImageItemElems = [];  
    
    
    function setVisible(visible){
       intWin.setVisible(visible);
    }
    
    function onDragDrop(evt){
        
        if(DEBUG)console.log(`${MYNAME}.onDragDrop():`, evt);        
        div.style.backgroundColor = defaultBackgroundColor;
        evt.stopPropagation();
        evt.preventDefault();
        
        var dt = evt.dataTransfer;
        var files = dt.files;
        addFiles(files)
                        
    }

    function addFiles(files){
        if(mFilesFilter){
           if(DEBUG)console.log(`${MYNAME}.addFiles(): `, files);
           let imgItems = mFilesFilter.getImageItems(files);
           addItems(imgItems);
        }  else {
           console.warn("can't add files because mFilesFilter isn't defined"); 
        }            
    }

    function addFromTmb(tmb, userData){
            
        if(DEBUG)console.log(`${MYNAME}.addFromTmb(): `, tmb.substring(0, 30), userData);  
        let item = createImageItemElem({tmb: tmb, onClick:onImageClick, userData: userData});        
        mainDiv.appendChild(item.elem);               
        mImageItemElems.push(item);        
    }
    function addFrpomURL(imgUrl, userData){
            
        if(DEBUG)console.log(`${MYNAME}.addImageItemfromURL(): ${imgUrl}`);          
        //if(DEBUG)console.log(`    userData`, userData);          
        let item = createImageItemElem({url: imgUrl, onClick:onImageClick, userData: userData});        
        mainDiv.appendChild(item.elem);
        mImageItemElems.push(item);
        
    }

    function addFromFile(file, userData){
        if(DEBUG)console.log(`${MYNAME}.addImageItemfromFile(): ${file.name}`);          
        let item = createImageItemElem({file:file, onClick:onImageClick, userData: userData, tmbSize: tmbSize});        
        mainDiv.appendChild(item.elem);        
        mImageItemElems.push(item);
    }
    
    
    function onDragOver(evt){
        //console.log('ImageSelectorDragOver():', evt);
        evt.stopPropagation();
        evt.preventDefault();        
    }
    
    function onDragEnter(evt){
        if(DEBUG)console.log(`${MYNAME}.pnDragEnter():`, evt);
        div.style.backgroundColor = dragBackgroundColor;
        evt.stopPropagation();
        evt.preventDefault();
    }
    function onDragLeave(evt){
        if(DEBUG)console.log(`${MYNAME}.onDragLeave():`, evt);
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
        
        if(DEBUG)console.log(`${MYNAME}.ImageSelector.addItems()`, imageItems);
        for(let i = 0; i < imageItems.length; i++){
            let name = imageItems[i].data.name;
            if(imageItems[i].data.getName) name = imageItems[i].data.getName();
            if(DEBUG)console.log(`item: ${i}: `,imageItems[i]);
        }
        imageItems.sort((e,f) => {
                    let dataE = e.data;
                    let dataF = f.data;                    
                    let nameE = dataE.name;
                    if(dataE.getName)nameE = dataE.getName();
                    let nameF = dataF.name;
                    if(dataF.getName) nameF = dataF.getName();                    
                    console.log('E:', nameE, 'F:', nameF);
                    if(nameE < nameF) 
                        return -1;
                    else if(nameE > nameF) 
                        return 1;
                    else 
                        return 0;
                }
            );

        var count = imageItems.length;
        if(DEBUG)console.log(`imageItems count: ${count}`);
        
        for (var i = 0; i < imageItems.length; i++) {
            let item = imageItems[i];
            if(DEBUG)console.log('imageItem: ', item);
            if(item.file){
                let file = item.file;
                if(DEBUG)console.log("image from file:", file);
                addFromFile(file, item.data);

            } else if(item.url){
                if(DEBUG)console.log("image from url:", item.url);
                addFrpomURL(item.url, item.data)

            } else if(item.tmb){
                if(DEBUG)console.log("image from thumbnail:", item.tmb);
                addFromTmb(item.tmb, item.data);
            } else {
                if(DEBUG)console.log("unable to create imageItemElement for item:", item);                
            }
            
        }         
        
    }

    function updateItem(imageItem){
        
        if(DEBUG)console.log(`${MYNAME}.updateItem(): `, imageItem);
        let foundItem = findItem(imageItem.data);
        if(foundItem) {
            if(DEBUG)console.log('found item: ', foundItem); 
            if(DEBUG)console.log('replacing with: ', imageItem); 
            foundItem.setThumbnail(imageItem.tmb);
            foundItem.setUserData(imageItem.data);
            
        }            
        
    }

    function findItem(data){
        
        let name = data.name;
        if(data.getName)
            name = data.getName();

        let foundItem = mImageItemElems.find(compareElem);        
        
        function compareElem(e){
            let ud = e.getUserData();
            if(ud === data){
                return true;
            } else if(name && ud.getName){
                return name === ud.getName();
            } else {
                return false;
            }
        }
        if(foundItem) 
            return foundItem;
        console.warn(`${MYNAME}.imageItem not found for `, data);
        return null;
        
    }

    //
    //  remove all elements
    //
    function clear(){
        
        mainDiv.replaceChildren();
        mImageItemElems = [];
        
    }

    //
    //  remove single image item element
    // 
    function removeItem(data){
        
        let imgItemElem = findItem(data);
        
        if(imgItemElem){
            // remove from DOM
            imgItemElem.elem.remove();
            // remove from array of items 
            let index = mImageItemElems.indexOf(imgItemElem);
            mImageItemElems.splice(index, 1);
        }
    }

    //
    //  it is called by all image items in onClick event 
    //
    function onImageClick(imgItemElem){
        
        if(DEBUG)console.log(`${MYNAME}.onImageClick():`, imgItemElem);
        if(mCurrentSelect) {
            mCurrentSelect.setSelected(false);
        } 
        mCurrentSelect = imgItemElem;
        mCurrentSelect.setSelected(true);
        
        onSelect(imgItemElem.getUserData());
    }

    function selectItem(imgItemElem){
        if(DEBUG)console.log('ImageSelector.selectItem():', imgItemElem);
        if(mCurrentSelect) {
            mCurrentSelect.setSelected(false);
        } 
        //TODO - which button represents item
        mCurrentSelect = imgItemElem;
        mCurrentSelect.setSelected(true);
        
    }

    function onSelectDefault(imageData){
        if(DEBUG)console.log(`${MYNAME}.onSelectDefault():`, imageData);
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
        if(DEBUG)console.log(`${MYNAME}.DefaultImageFilesFilter.getImageItems(), files: `, files);
        
        let items = [];
        for (var i = 0; i < files.length; i++) {
            let file = files[i];
          if(DEBUG)console.log("file:", file);
          if(file.type.startsWith('image/'))
            items.push({name: file.name, file: file, data: file});
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
        if(DEBUG)console.log(`${MYNAME}.PresetsFileFilter.getImageItems(), fileList: `, fileList);
        let files = [];
        for (var i = 0; i < fileList.length; i++) {
            files.push(fileList[i]);
        }
        
        let items = [];
        for (var i = 0; i < files.length; i++) {
            let file = files[i];
            if(file.name.endsWith(EXT_JSON)){
                
                if(DEBUG)console.log(`${MYNAME}.PresetsFileFilter.getImageItems() json file:`, file);
                
                let tmbName = file.name + EXT_PNG;
                
                let fileName = stripExtension(getFileName(file.name));
                let getName = (()=>fileName);
                
                let tmbFile = files.find((f) => {return (f.name === tmbName);});
                
                if(tmbFile) {
                    
                    items.push({file: tmbFile, data: {jsonFile:file, tmbFile:tmbFile, getName:getName}});
                    
                } else {
                    
                    items.push({tmb: DEFAULT_THUMB_URL, data: {jsonFile:file, getName:getName}});
                    
                }
            }
        } 

        return items;
               
    }
    
    return {
        getImageItems: getImageItems,
    }    
} // function createPresetsFilesFilter()


//
//   
//
function createImageItemElem(options){
    
    let url = options.url;
    let tmb = options.tmb;
    let file = options.file;
    
    let tmbSize = options.tmbSize;
    let userData = options.userData;
    let onClick = options.onClick;
    
    
    let doc = document;        
    
    let container = doc.createElement('div');
    container.classList.add('thumbnail-container');
    
    let imgElem = doc.createElement('img');
    if(tmb){
        imgElem.setAttribute('src',tmb);        
    } else if(url){
        imgElem.setAttribute('src',url);
    } else if(file) {
        createImageBitmap(file).then(onImgLoaded);        
        function onImgLoaded(loadedImage){         
            if(DEBUG)console.log('onImgLoaded(): ', loadedImage); 
            imgElem.setAttribute('src', createTmb(loadedImage,tmbSize)); 
        }                    
    }
    
    imgElem.classList.add('thumbnail-image');
    
    imgElem.addEventListener("click", myOnClick);
    
    container.appendChild(imgElem);
    let caption = doc.createElement('div');
    caption.classList.add('thumbnail-caption');
    if(url){ 
        caption.appendChild(doc.createTextNode(getFileName(url)));
    } else if(tmb) {
        caption.appendChild(doc.createTextNode(userData.getName()));
    } else if(file){
        caption.appendChild(doc.createTextNode(file.name)); 
    }
    
    container.appendChild(caption);
    
    function myOnClick(){
        
        if(DEBUG)console.log(`${MYNAME}.onClick() userData: `, userData);
        if(onClick) onClick(myself);
        
    }
    
    function setSelected(state){
        
       if(state) container.classList.add('selected');
       else      container.classList.remove('selected');
       
    }
    
    function setUserData(data){
       if(DEBUG)console.log(`${MYNAME}.setUserData() userData: `, data);
       userData = data;
    }

    function getUserData(){
       if(DEBUG)console.log(`${MYNAME}.getUserData() userData: `, userData);
       return userData;
    }
    
    function setThumbnail(thumbnail){
        
        imgElem.setAttribute('src', thumbnail);
        
    }
    
    let myself = 
    {
        elem:           container,
        setSelected:    setSelected,
        setThumbnail:   setThumbnail,
        setUserData:    setUserData, 
        getUserData:    getUserData, 
    };
    
    return myself;
    
} // function createImageItemElem(options){
    


//
//  create thumbnail of given size and return as data url
//
function createTmb(img, tmbSize){

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

//
//  return file name without extension 
//
function stripExtension(fullName){
    
    let dotIndex = fullName.lastIndexOf('.');
    if(dotIndex >= 0) 
        return fullName.substring(0, dotIndex);
    else
        return fullName;
        
}

function getFileName(path){

  return path.split('/').pop();
    
}

export {
    createImageSelector,
    createPresetsFilesFilter,
    createDefaultImageFilesFilter,
}
