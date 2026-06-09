const HDR_SIZE = '20px';
const PX = 'px';
const IMG_BTN_CLOSE = 'images/ui/btn_close.svg';
const DEFAULT_SIZE = '40%';
const DEFAULT_OFFSET = '10px';
const DEBUG = false;

const MYNAME = 'InternalWindow';

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
    width: `calc(100% - 2 * ${HDR_SIZE})`,
    'font-size':  '0.8em',
    'font-family': 'Verdana,sans-serif',
    // Ellipsis for long titles; tooltip shows the full text on hover.
    'white-space':   'nowrap',
    'overflow':      'hidden',
    'text-overflow': 'ellipsis',
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
    
    if(DEBUG)console.log(`${MYNAME}.setStyle() `, style);
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

function clampWindowPosition(elmnt) {
    let el = elmnt.wnd;
    if (!el || !el.parentNode) return;
    let st = window.getComputedStyle(el);
    let left = parseInt(st.left) || 0;
    let top = parseInt(st.top) || 0;

    let maxLeft = Math.max(0, window.innerWidth - el.offsetWidth);
    let maxTop = Math.max(0, window.innerHeight - el.offsetHeight);

    let newLeft = Math.min(Math.max(0, left), maxLeft);
    let newTop = Math.min(Math.max(0, top), maxTop);

    if (newLeft !== left || newTop !== top) {
        el.style.left = newLeft + 'px';
        el.style.top = newTop + 'px';
        if (elmnt.onMove) {
            elmnt.onMove();
        }
    }
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
        if (iwnd.modal) {
            iwnd.wnd.style.zIndex = '100001';
            return;
        }
        for(let k = 0; k < count; k++){
            console.log('   windows[k]:', windows[k]);            
            if(iwnd == windows[k]){
                console.log('   found!', windows[k]);                            
                for(let j = k; j < count-1; j++){
                    windows[j] = windows[j+1];
                    if (!windows[j].modal) {
                        windows[j].wnd.style.zIndex = j + 5;
                    }
                }
                windows[count-1] = iwnd;
                iwnd.wnd.style.zIndex = count + 5;
                return;
            }
        }
        console.warn('   window not found!', iwnd);
    }
    
    window.addEventListener('resize', () => {
        windows.forEach(w => {
            if (w && w.wnd) {
                if (w.wnd.style.visibility !== 'hidden') {
                    clampWindowPosition(w);
                }
            }
        });
    });
    
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
    let modal = (params.modal || false);
    
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
            if(DEBUG)console.log(`${MYNAME}.storedStyle: `, storageName, ss);
            ss.top = Math.max(parseInt(ss.top), 0)+ 'px';
            ss.left = Math.max(parseInt(ss.left), 0) + 'px';
            
            
            setStyle(mWindow,ss);
        }
    }
    let startVisible = true;
    if (storageId) {
        try {
            let vis = window.localStorage.getItem(storageId + '_visible');
            if (vis === 'false') {
                startVisible = false;
            }
        } catch (e) {
            console.warn('localStorage error in createInternalWindow:', e);
        }
    }
    if (!startVisible) {
        mWindow.style.visibility = 'hidden';
    }
    let storage = window.localStorage;
    
    if (modal) {
        mWindow.style.zIndex = '100001';
    } else {
        mWindow.zIndex = manager.getZIndex();
        mWindow.style.zIndex = mWindow.zIndex;
    }
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
        if(DEBUG)console.log('setting ResizeObserver for : ', titleText, storageId);
        resizeObserver = new ResizeObserver(myOnResize);
        resizeObserver.observe(mWindow);
    }
    
    let myself = {
        header:   hdr,
        button:   btn,
        wnd:      mWindow,
        interior: interior,
        titleDiv:  titleP,   // exposed so callers can apply flex/overflow tweaks
        setTitle:   setTitle,
        setVisible: setVisible,
        onMove:     myOnMove,
        modal:      modal,
    };

    document.body.appendChild(mWindow);
    clampWindowPosition(myself);
    
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
    
        let st = window.getComputedStyle(mWindow);
        let position = {
            top:  Math.max(0,parseInt(st.top))+'px',
            left: Math.max(0, parseInt(st.left))+'px',
            width: st.width,
            height: st.height,
        };
        //setStyle(mWindow,position);        
        let jsontxt = JSON.stringify(position, null, 4)
        //console.log('saving to:', storageName,jsontxt);
        let storage = window.localStorage;
        //console.log('   localStorage: ', storage);
        storage.setItem(storageName, jsontxt);
        
    }
    
    
    function setTitle(newTitle){
        title.nodeValue = newTitle;
        titleP.title    = newTitle;  // tooltip shows full path when text is truncated
    }
    
    function setVisible(visible){
        
        if(visible) {
            mWindow.style.visibility = 'visible';
            gWindowManager.toTop(myself);
            clampWindowPosition(myself);
        } else {
            mWindow.style.visibility = 'hidden';
        }
        if (storageId) {
            try {
                window.localStorage.setItem(storageId + '_visible', visible ? 'true' : 'false');
            } catch (e) {
                console.warn('localStorage error in setVisible:', e);
            }
        }
    }
    

    
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
        let left = (el.offsetLeft - dx);
        let top = (el.offsetTop - dy);
        
        let maxLeft = Math.max(0, window.innerWidth - el.offsetWidth);
        let maxTop = Math.max(0, window.innerHeight - el.offsetHeight);
        
        left = Math.min(Math.max(0, left), maxLeft);
        top = Math.min(Math.max(0, top), maxTop);
        
        el.style.top = top + "px";
        el.style.left = left + "px";
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