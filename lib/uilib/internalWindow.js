const HDR_SIZE = '20px';
const PX = 'px';
const IMG_BTN_CLOSE = 'images/ui/btn_close.svg';
const DEFAULT_SIZE = '40%';
const DEFAULT_OFFSET = '10px';
const DEBUG=false;

const interiorStyle = {

  position: 'absolute',
  height: `calc(100% - ${HDR_SIZE})`,
  width: '100%',
  top: HDR_SIZE,  
  cursor: 'crosshair',  
  'background-color': '#eee',
  overflow: 'auto',
  
};

const dragStyle = {
    position: 'absolute',
    'overflow-x': 'auto',
    border:           '1px solid #aaa',
    'background-color': '#800f',
};

const resizeStyle = {
    resize:       'both',
};

const hideOverflow = {
    'overflow-x':       'hidden',
    'overflow-y':       'hidden',
};

const headerStyle = {
    
    position : 'absolute',
    top : '0px',
    height : HDR_SIZE,
    width : '100%',
    cursor :'move',
    'background-color': '#bbbbbb',//'#2196F388',
};
const titleStyle = {
    position: 'relative',
    left: '10px',
    width: `calc(100% - ${HDR_SIZE} - 10px)`,
    //font: 'italic small-caps bold 12px/30px Georgia, serif;',
    //'font-style': 'italic',
    //'font-weight': 'bold',
    'font-size':  '0.8em',
    'font-family': 'Verdana,sans-serif',
    //'background-color': '#ffffff',
};

const closeButtonStyle = {
  
  position: 'absolute',
  top:    '0px',
  right:   '0px',
  height: HDR_SIZE,
  width:  HDR_SIZE,
  cursor:  'default',  
  'background-color': '#ddd',
  'background-image': `url('${IMG_BTN_CLOSE}')`, 
  'background-size':  HDR_SIZE,
};


function setStyle(el, style){
    
    if(DEBUG)console.log('setStyle: ', style);
    let estyle = el.style;
    //let keys = Object.keys(style); 
    let entries = Object.entries(style);
    //console.log('entries:',entries);
    entries.forEach(([prop,value]) => {estyle.setProperty(prop, value);});
    //entries.forEach(([prop,value]) => {estyle[prop] = value;});
    //console.log('estyle:',estyle);
    
}

let gWindowManager = null;



function getWindowManager(){
    if(!gWindowManager) 
        gWindowManager = createWindowManager();
    return gWindowManager;
}

function createWindowManager(){
    
    let count = 0;
    
    let windows = [];
    
    function addElement(elmnt){
       windows[count] = elmnt;
       count++;
    }
    
    function toTop(iwnd){
        console.log('WindowManager.toTop()', iwnd);
        for(let k = 0; k < count; k++){
            console.log('   windows[k]:', windows[k]);            
            if(iwnd == windows[k]){
                console.log('   found!', windows[k]);                            
                for(let j = k; j < count-1; j++){
                    windows[j] = windows[j+1];
                    windows[j].wnd.style.zIndex = j + 5;
                }
                windows[count-1] = iwnd;
                iwnd.wnd.style.zIndex = count + 5;
                return;
            }
        }
        console.warn('   window not found!', iwnd);
    }
    
    return {
        getCount: ()=> {return count;},
        toTop: toTop,
        getZIndex: ()=>{return count + 5;},
        addElement: addElement,
        nextIndex: ()=>{return count;}
    }
}


//
//  creates internal window with optional params 
//
//  param.height   in string in CSS format 
//  param.height 
//  param.left
//  param.top 
//  param.title
//
function createInternalWindow(params = {}){

    let manager = getWindowManager();
    
    let mWindow = document.createElement('div');
    
   // mWindow.setAttribute('class', 'dragdiv1');
    let height = (params.height || DEFAULT_SIZE);
    let width  = (params.width || DEFAULT_SIZE);
    let left   = (params.left || DEFAULT_OFFSET);
    let top = (params.top || DEFAULT_OFFSET);
    let titleText = (params.title || '');
    let canClose =  (params.canClose || false);
    let canResize = (params.canResize || false);
    let onResize = (params.onResize);
    let storageId = (params.storageId);
    let storageName = (storageId)? storageId + '_params': null;
    
    //setStyle(mWindow,dragStyle);
    mWindow.classList.add('drag-style');
    //setStyle(mWindow,hideOverflow);
    mWindow.classList.add('hide-overflow');
    
    if(canResize)setStyle(mWindow,resizeStyle);
    
    let sizeStyle = {
        width:  width, 
        height: height, 
        left:   left, 
        top:    top,
    };
    setStyle(mWindow,sizeStyle);
    if(storageName){
        let txt = window.localStorage.getItem(storageName);
        if(txt) {
            let ss = JSON.parse(txt);
            console.log('storedStyle: ', storageName, ss);
            setStyle(mWindow,ss);
        }
    }
    let storage = window.localStorage;
    
    mWindow.zIndex = manager.getZIndex();
    let hdr = document.createElement('div');
    //setStyle(hdr,headerStyle);
    hdr.classList.add('header-style');
    
    let interior = document.createElement('div');
    //setStyle(interior, interiorStyle);
    interior.classList.add('interior-style');
           
    mWindow.appendChild(interior);
    mWindow.appendChild(hdr);

    let btn = document.createElement('div');
    //setStyle(btn, closeButtonStyle);
    btn.classList.add('close-button-style');
    let titleP = document.createElement('div');
    setStyle(titleP, titleStyle);
    
    let title = document.createTextNode(titleText);
    titleP.appendChild(title);
    
    hdr.appendChild(titleP);
    
    if(canClose)hdr.appendChild(btn);
    let resizeObserver = null;
    if(onResize || storageId) {
        console.log('setting ResizeObserver for : ', titleText, storageId);
        resizeObserver = new ResizeObserver(myOnResize);
        resizeObserver.observe(mWindow);
    }
    
    document.body.appendChild(mWindow);
    
   
    
    function myOnResize(entries){
        if(DEBUG)console.log('resized: ', storageId);
        if(onResize)
            onResize(entries);
        if(storageName){
            saveSize();
        }
        
    }

    function myOnMove(entries){
        if(DEBUG)console.log('moved: ', storageId);
        if(storageName){
            saveSize();
        }        
    }

    function saveSize(){
    
        let st = mWindow.style;
        let position = {
            top:  st.top,
            left: st.left,
            width: st.width,
            height: st.height,
        };
        let jsontxt = JSON.stringify(position, null, 4)
        //console.log('saving to:', storageName,jsontxt);
        let storage = window.localStorage;
        //console.log('   localStorage: ', storage);
        storage.setItem(storageName, jsontxt);
        
    }
    
    
    function setTitle(newTitle){
        title.nodeValue = newTitle;
    }
    
    function setVisible(visible){
        
        if(visible) {
            mWindow.style.visibility = 'visible';
            gWindowManager.toTop(myself);
        } else {
            mWindow.style.visibility = 'hidden';
        }
    }
    
    let myself = {
        header: hdr,
        button: btn,
        wnd:    mWindow,
        interior: interior,
        setTitle: setTitle,
        setVisible: setVisible,
        onMove:     myOnMove,
    };
    
    manager.addElement(myself);
    dragElement(myself);
    
    return myself;
}

function dragElement(elmnt) {

    var dx = 0, dy = 0, x0 = 0, y0 = 0;
    var el = elmnt.wnd;

    let hdr = elmnt.header;//elmnt.getElementsByClassName('dragheader');
    if(DEBUG)console.log('hdr: ', hdr);
    hdr.onmousedown = dragMouseDown;     
    let btn = elmnt.button;
    btn.onclick = closeElement;
    btn.onmousedown = buttonDown;
    
    function buttonDown(e){
        if(DEBUG)console.log('buttonDown(e)');
        e.stopPropagation();
    }
    function closeElement(e){
        e.preventDefault();        
        if(DEBUG)console.log('closeElement()', elmnt);
        elmnt.setVisible(false);
    }
    function dragMouseDown(e) {
        if(DEBUG)console.log('dragMouseDown(e)');
        e = e || window.event;
        e.preventDefault();
        gWindowManager.toTop(elmnt);
        // get the mouse cursor position at startup:
        x0 = e.clientX;
        y0 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        dx = x0 - e.clientX;
        dy = y0 - e.clientY;
        x0 = e.clientX;
        y0 = e.clientY;
        // set the element's new position:
        el.style.top = (el.offsetTop - dy) + "px";
        el.style.left = (el.offsetLeft - dx) + "px";
        elmnt.onMove();
    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

export {
    createInternalWindow
};