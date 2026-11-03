/*
 * Internal windows — floating, draggable, resizable panels inside the page.
 *
 * The internals here were ported from the stellation fork of this file
 * (2026-08), which rewrote them against an unchanged API. SymmHub's chrome is
 * deliberately kept: the .drag-style / .header-style / .interior-style /
 * .close-button-style classes, the --drag-header-size header, and the close
 * button as a div whose .onclick a consumer can replace — FolderPickerDialog
 * routes it into its own cancel flow, so these stay property assignments
 * rather than addEventListener. What came across is behaviour:
 *
 *  - Dragging uses Pointer Events with setPointerCapture instead of
 *    document.onmousemove globals. The old path was mouse-only, so a touch
 *    drag fought page scrolling, and any other code assigning
 *    document.onmousemove silently clobbered it. Capture also keeps the drag
 *    alive when the pointer leaves the header, with no document-level state
 *    left to clean up.
 *
 *  - Resizing is a corner grip driven by the same pointer pattern, instead of
 *    CSS `resize: both`. The CSS resizer has no touch support and its
 *    affordance is a faint corner texture nobody finds.
 *
 *  - A stored size below MIN_W/MIN_H (or the window's own params.minWidth,
 *    params.minHeight) is refused, on read and on write. A
 *    resizable window built empty and hidden measures its borders and nothing
 *    else, and writing that down is how a window comes back two pixels tall:
 *    visible, correct, and empty, with nothing in the console. Refusing on
 *    read matters as much as refusing on write, because it is the stored value
 *    that hurts and it outlives the fix that stopped it being written.
 *
 *  - Windows clamp to params.container (default document.body) rather than
 *    always to the viewport, and the clamp keeps the header reachable rather
 *    than insisting the whole window fit — a window taller than the screen is
 *    no longer pinned to the top edge.
 *
 *  - Escape closes the top-most closable dialog by clicking its close button,
 *    so a consumer that replaced button.onclick still gets its own flow. Only
 *    role:'dialog' windows answer to it; a workspace panel is not a dialog and
 *    must not vanish on a keystroke, so 'region' is the default.
 *
 *  - Clicking anywhere in a window raises it, not just the header.
 *
 * Geometry is read and written through getComputedStyle, matching what
 * style.width/left set. .drag-style is content-box, so measuring with
 * offsetWidth here and restoring into style.width would grow every window by
 * its borders on each save/restore cycle.
 *
 * Unchanged: the createInternalWindow(params) signature, the returned object
 * (isVisible, clamp, grip, canClose and setInteriorSize are added), the localStorage contract
 * (`<storageId>_params` for geometry, `<storageId>_visible` for visibility),
 * and the z-order bands — plain windows restack from Z_BASE, alwaysOnTop ones
 * restack among themselves from Z_ALWAYS_ON_TOP, above every plain window,
 * and modal ones sit in a fixed band above both. Until 2026-11-01 the
 * always-on-top windows shared one z-index, so the one built last covered
 * the others wherever they overlapped (symdraw's layers window its style
 * panel), and no click brought the covered one forward.
 */

const HDR_SIZE = '20px';
const DEFAULT_SIZE = '40%';
const DEFAULT_OFFSET = '10px';
const DEBUG = false;

const MYNAME = 'InternalWindow';

// The always-on-top band starts well below the modal band and the menus
// (popup menus 99999, or 100002 when opened from an always-on-top window;
// DragReorder's line 99998), so that a few windows restacking in it stay
// under them.
const Z_BASE = 5;
const Z_ALWAYS_ON_TOP = 90000;
const Z_MODAL = 100001;

// px — a size below these is a measurement accident, not a size anyone chose.
// The grip clamps to them, so nothing dragged by hand is ever refused.
const MIN_W = 120;
const MIN_H = 60;

// Controls a consumer injects into the header - FileSelectionDialog's hamburger
// menu, the close button - must keep their own clicks. While a pointer is
// captured the click that follows is retargeted to the capturing element, so a
// drag started from one of these would swallow it.
const HEADER_CONTROLS = 'button, a, input, select, textarea, [role="button"]';

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

// two diagonal strokes, the familiar resize texture
const GRIP_SVG =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<path d="M14 6L6 14M14 10l-4 4" fill="none" stroke="currentColor"' +
    ' stroke-width="1.5" stroke-linecap="round"/></svg>';

function setStyle(el, style){

    if(DEBUG)console.log(`${MYNAME}.setStyle() `, style);
    let estyle = el.style;
    let entries = Object.entries(style);
    entries.forEach(([prop,value]) => {estyle.setProperty(prop, value);});

}

let gWindowManager = null;


function getWindowManager(){
    if(!gWindowManager)
        gWindowManager = createWindowManager();
    return gWindowManager;
}

function createWindowManager(){

    const windows = [];

    function addElement(iwnd){
       windows.push(iwnd);
    }

    // the always-on-top windows built so far
    const onTopCount = () => windows.filter(w => w.alwaysOnTop && !w.modal).length;

    function toTop(iwnd){
        // modal windows live in a fixed band and never restack; the
        // always-on-top ones restack among themselves, in a band above the
        // plain ones
        if(iwnd.modal){ iwnd.wnd.style.zIndex = Z_MODAL; return; }
        const i = windows.indexOf(iwnd);
        if(i < 0){
            console.warn(`${MYNAME}: window not found`, iwnd);
            return;
        }
        windows.splice(i, 1);
        windows.push(iwnd);
        let plain = 0, onTop = 0;
        windows.forEach(w => {
            if(w.modal) return;
            w.wnd.style.zIndex = w.alwaysOnTop ? Z_ALWAYS_ON_TOP + onTop++ : Z_BASE + plain++;
        });
    }

    // the top-most visible dialog that can close - what Escape acts on. A
    // workspace panel (role 'region', the default) is deliberately not a
    // candidate: Escape must not take away the Documents or samples panel.
    // The bands decide first: a modal dialog is above everything and an
    // always-on-top one above the plain ones, wherever they sit in the array -
    // a plain window shown after them moves to the end, yet stays under them.
    // Walking the array alone made Escape in the folder picker opened from a
    // re-shown Save As close the Save As dialog beneath it (2026-10-30).
    function topClosable(){
        const closable = windows.filter(w => w.canClose && w.isDialog && w.isVisible());
        const modal = closable.filter(w => w.modal);
        if(modal.length) return modal[modal.length - 1];
        const onTop = closable.filter(w => w.alwaysOnTop);
        if(onTop.length) return onTop[onTop.length - 1];
        return closable.length ? closable[closable.length - 1] : null;
    }

    window.addEventListener('resize', () => {
        // a window left near the edge must not be stranded off-screen by a
        // narrower viewport, or by rotating a tablet
        windows.forEach(w => { if(w.isVisible()) w.clamp(); });
    });

    /*
     * Escape closes the top dialog, matching what every floating-panel UI
     * teaches - but only a dialog, never a workspace panel like Documents or
     * samples, which the user expects to stay put. Two further abstentions:
     * an event another handler already claimed, and native <dialog>s, which
     * own Escape in the top layer. The close goes through the button rather
     * than setVisible, so a consumer that replaced button.onclick gets its
     * cancel flow instead of a bare hide.
     */
    window.addEventListener('keydown', (e) => {
        if(e.key !== 'Escape') return;
        if(e.defaultPrevented) return;
        if(document.querySelector('dialog[open]')) return;
        const w = topClosable();
        if(!w) return;
        /*
         * A text field outside the dialog keeps its Escape - there the key
         * means "abandon my edit". A field inside it does not: closing on
         * Escape is what a dialog is for, and its own inputs are part of it.
         * Export Image opens with focus already in a dat.gui field, so an
         * abstention that ignored where the field lives made Escape do
         * nothing there at all.
         */
        const t = e.target;
        if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
             && !w.wnd.contains(t)) return;
        e.preventDefault();
        w.button.click();
    });

    return {
        getCount: ()=> {return windows.length;},
        toTop: toTop,
        getZIndex: ()=>{return Z_BASE + windows.length;},
        getTopZIndex: ()=>{return Z_ALWAYS_ON_TOP + onTopCount();},
        addElement: addElement,
        nextIndex: ()=>{return windows.length;}
    }
}


//
//  creates internal window with optional params
//
//  param.width      CSS length string
//  param.height
//  param.left
//  param.top
//  param.title
//  param.canClose   show the close button; Escape can close it
//  param.canResize  show the corner grip
//  param.resizeHeight  false: the grip sets the width only, and the owner
//                   fits the height to its content (default true)
//  param.minWidth / param.minHeight  px, the least size the grip gives and a
//                   stored size must have (MIN_W, MIN_H by default)
//  param.onResize(entries)     called whenever the window box changes
//  param.onClose(win, visible) called on every visibility change
//  param.storageId  persist geometry and visibility under this key
//  param.modal / param.alwaysOnTop  fixed z-bands above normal windows
//  param.alwaysVisible  setVisible(false) is ignored
//  param.container  element the window lives in and is clamped to
//                   (default document.body)
//  param.role       ARIA role, and what answers to Escape: 'dialog' for a
//                   transient picker (Escape closes it), 'region' for a
//                   workspace panel (Escape leaves it alone). Default 'region'.
//
function createInternalWindow(params = {}){

    let manager = getWindowManager();

    let container = (params.container || document.body);

    let mWindow = document.createElement('div');

    let height = (params.height || DEFAULT_SIZE);
    let width  = (params.width || DEFAULT_SIZE);
    let left   = (params.left || DEFAULT_OFFSET);
    let top = (params.top || DEFAULT_OFFSET);
    let titleText = (params.title || '');
    let canClose =  (params.canClose || false);
    let canResize = (params.canResize || false);
    let resizeHeight = (params.resizeHeight !== false);
    let minW = (params.minWidth || MIN_W);
    let minH = (params.minHeight || MIN_H);
    let onResize = (params.onResize);
    let onClose = (params.onClose);
    let storageId = (params.storageId);
    let storageName = (storageId)? storageId + '_params': null;
    let modal = (params.modal || false);
    let alwaysOnTop = (params.alwaysOnTop || false);
    let alwaysVisible = (params.alwaysVisible || false);

    mWindow.classList.add('drag-style');
    mWindow.classList.add('hide-overflow');
    // A window is a workspace panel unless the caller says otherwise. Only a
    // dialog answers to Escape - see topClosable() in the manager.
    let isDialog = (params.role || 'region') === 'dialog';
    mWindow.setAttribute('role', params.role || 'region');
    if(titleText) mWindow.setAttribute('aria-label', titleText);

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
            try {
                let ss = JSON.parse(txt);
                if(DEBUG)console.log(`${MYNAME}.storedStyle: `, storageName, ss);
                mWindow.style.left = Math.max(parseInt(ss.left) || 0, 0) + 'px';
                mWindow.style.top  = Math.max(parseInt(ss.top)  || 0, 0) + 'px';
                // Size is restored only for resizable windows, so a layout
                // change in a new version is not vetoed by an old entry — and
                // only when it is a real size, see MIN_W/MIN_H above.
                if(canResize){
                    if(parseInt(ss.width)  >= minW) mWindow.style.width  = ss.width;
                    if(resizeHeight && parseInt(ss.height) >= minH) mWindow.style.height = ss.height;
                }
            } catch (e) {
                console.warn(`${MYNAME}: ignoring corrupted geometry for ${storageName}`, e);
            }
        }
    }
    let startVisible = true;
    if (alwaysVisible) {
        startVisible = true;
    } else if (storageId) {
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

    if (modal) {
        mWindow.style.zIndex = Z_MODAL;
    } else if (alwaysOnTop) {
        mWindow.style.zIndex = manager.getTopZIndex();
    } else {
        mWindow.zIndex = manager.getZIndex();
        mWindow.style.zIndex = mWindow.zIndex;
    }
    let hdr = document.createElement('div');
    hdr.classList.add('header-style');

    let interior = document.createElement('div');
    interior.classList.add('interior-style');

    mWindow.appendChild(interior);
    mWindow.appendChild(hdr);

    let btn = document.createElement('div');
    btn.classList.add('close-button-style');
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', 'Close');

    let titleP = document.createElement('div');
    setStyle(titleP, titleStyle);

    let title = document.createTextNode(titleText);
    titleP.appendChild(title);

    hdr.appendChild(titleP);

    if(canClose)hdr.appendChild(btn);

    let grip = null;
    if(canResize){
        grip = document.createElement('div');
        grip.classList.add('drag-grip');
        if(!resizeHeight) grip.classList.add('drag-grip--width');
        grip.innerHTML = GRIP_SVG;
        mWindow.appendChild(grip);
    }

    function containerBox(){
        // For document.body use the viewport, which is what this clamped
        // against before params.container existed: body.clientWidth drops the
        // scrollbar and the body margins, and would pull every window in.
        if(container === document.body){
            return { w: window.innerWidth, h: window.innerHeight };
        }
        return {
            w: container.clientWidth  || window.innerWidth,
            h: container.clientHeight || window.innerHeight,
        };
    }

    function currentPos(){
        let st = window.getComputedStyle(mWindow);
        return { left: parseInt(st.left) || 0, top: parseInt(st.top) || 0 };
    }

    function currentSize(){
        let st = window.getComputedStyle(mWindow);
        return {
            w: parseInt(st.width)  || 0, h: parseInt(st.height) || 0,
            // raw strings so a % size round-trips exactly instead of
            // losing its fraction and shrinking a pixel on first restore
            rawW: st.width, rawH: st.height,
        };
    }

    // keep at least the header reachable: never above or left of the origin,
    // never dragged fully past the right or bottom edge
    function clamp(){
        let box = containerBox();
        let pos = currentPos();
        let newLeft = Math.min(Math.max(0, pos.left), Math.max(0, box.w - mWindow.offsetWidth));
        let newTop  = Math.min(Math.max(0, pos.top),  Math.max(0, box.h - hdr.offsetHeight));
        if (newLeft !== pos.left || newTop !== pos.top) {
            mWindow.style.left = newLeft + 'px';
            mWindow.style.top  = newTop + 'px';
            myOnMove();
        }
    }

    function myOnMove(){
        if(DEBUG)console.log('moved: ', storageId);
        saveSize();
    }

    function saveSize(){

        if(!storageName) return;
        let pos = currentPos();
        let position = {
            top:  Math.max(0, pos.top)+'px',
            left: Math.max(0, pos.left)+'px',
        };
        /*
         * Record a size only when there is a real one to record. A window
         * measured before its content exists reports its borders and nothing
         * else. When there is nothing worth recording, whatever was stored
         * before is kept: being measured at an awkward moment should not cost
         * a window the size its owner gave it. A window whose owner fits its
         * height records the width alone.
         */
        if (canResize) {
            let size = currentSize();
            let prev = null;
            try {
                prev = JSON.parse(window.localStorage.getItem(storageName) || 'null');
            } catch (e) { /* nothing worth keeping */ }
            if (size.w >= minW) position.width = size.rawW;
            else if (prev && parseInt(prev.width) >= minW) position.width = prev.width;
            if (resizeHeight) {
                if (size.h >= minH) position.height = size.rawH;
                else if (prev && parseInt(prev.height) >= minH) position.height = prev.height;
            }
        }
        try {
            window.localStorage.setItem(storageName, JSON.stringify(position, null, 4));
        } catch (e) {
            console.warn(`${MYNAME}: could not persist geometry for ${storageName}`, e);
        }

    }


    function setTitle(newTitle){
        title.nodeValue = newTitle;
        titleP.title    = newTitle;  // tooltip shows full path when text is truncated
        mWindow.setAttribute('aria-label', newTitle);
    }

    function isVisible(){
        return mWindow.style.visibility !== 'hidden';
    }

    // the window sized so that its interior is w by h pixels under the
    // header, whether the page makes .drag-style content-box or border-box;
    // w null keeps the width (a window whose width the grip sets)
    function setInteriorSize(w, h){
        const borderBox = getComputedStyle(mWindow).boxSizing === 'border-box';
        const bw = borderBox ? mWindow.offsetWidth - mWindow.clientWidth : 0;
        const bh = borderBox ? mWindow.offsetHeight - mWindow.clientHeight : 0;
        if (w !== null) mWindow.style.width = (w + bw) + 'px';
        mWindow.style.height = (h + hdr.offsetHeight + bh) + 'px';
    }

    function setVisible(visible){
        if (alwaysVisible) {
            visible = true;
        }
        if(visible) {
            mWindow.style.visibility = 'visible';
            manager.toTop(myself);
            clamp();
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
        if (onClose) {
            onClose(myself, visible);
        }
    }

    let myself = {
        header:   hdr,
        button:   btn,
        wnd:      mWindow,
        interior: interior,
        titleDiv:  titleP,   // exposed so callers can apply flex/overflow tweaks
        grip:      grip,
        setTitle:   setTitle,
        setVisible: setVisible,
        isVisible:  isVisible,
        setInteriorSize: setInteriorSize,
        clamp:      clamp,
        onMove:     myOnMove,
        canClose:   canClose,
        isDialog:   isDialog,
        modal:      modal,
        alwaysOnTop: alwaysOnTop,
        alwaysVisible: alwaysVisible,
    };

    /*
     * One pointer-capture drag helper serves both the header (move) and the
     * grip (resize). Capture means the gesture cannot be lost to the interior,
     * an iframe, or the page, and needs no document-level listeners to clean
     * up afterwards. The header and grip carry touch-action:none in CSS, so a
     * finger drags the window instead of scrolling the page; the interior
     * deliberately does not, so its content still scrolls.
     */
    function pointerDrag(el, onDrag, ignoreSelector){
        el.addEventListener('pointerdown', (e) => {
            if(e.button !== undefined && e.button !== 0) return;
            // a control living on the drag surface keeps its own click
            if(ignoreSelector && e.target !== el && e.target.closest?.(ignoreSelector)) return;
            manager.toTop(myself);
            const x0 = e.clientX, y0 = e.clientY;
            const start = onDrag(null);          // null asks for the start state
            const move = (ev) => onDrag({ dx: ev.clientX - x0, dy: ev.clientY - y0, start });
            const up = () => {
                el.removeEventListener('pointermove', move);
                el.removeEventListener('pointerup', up);
                el.removeEventListener('pointercancel', up);
                saveSize();
            };
            el.addEventListener('pointermove', move);
            el.addEventListener('pointerup', up);
            el.addEventListener('pointercancel', up);
            try { el.setPointerCapture(e.pointerId); } catch (err) { /* untracked pointer */ }
            e.preventDefault();
        });
    }

    pointerDrag(hdr, (m) => {
        if(!m) return currentPos();
        let box = containerBox();
        let newLeft = Math.min(Math.max(0, m.start.left + m.dx), Math.max(0, box.w - mWindow.offsetWidth));
        let newTop  = Math.min(Math.max(0, m.start.top  + m.dy), Math.max(0, box.h - hdr.offsetHeight));
        mWindow.style.left = newLeft + 'px';
        mWindow.style.top  = newTop + 'px';
        myOnMove();
    }, HEADER_CONTROLS);

    if(grip){
        pointerDrag(grip, (m) => {
            if(!m) return currentSize();
            let box = containerBox();
            let pos = currentPos();
            let w = Math.min(Math.max(minW, m.start.w + m.dx), Math.max(minW, box.w - pos.left));
            mWindow.style.width = w + 'px';
            if(!resizeHeight) return;
            let h = Math.min(Math.max(minH, m.start.h + m.dy), Math.max(minH, box.h - pos.top));
            mWindow.style.height = h + 'px';
        });
    }

    // clicking anywhere in a window raises it, not just the header — capture
    // phase, so it wins even when the target stops propagation
    mWindow.addEventListener('pointerdown', () => manager.toTop(myself), true);

    // Property assignments, not addEventListener: FolderPickerDialog replaces
    // button.onclick to route the close button into its own cancel flow, and
    // an assignment is what lets a consumer take the handler over rather than
    // stack a second one on top of ours.
    btn.onpointerdown = function(e){
        if(DEBUG)console.log('buttonDown(e)');
        e.stopPropagation();     // must not start a header drag
    };
    btn.onclick = function(e){
        e.preventDefault();
        if(DEBUG)console.log('closeElement()', myself);
        setVisible(false);
    };

    container.appendChild(mWindow);

    /*
     * The ResizeObserver is the one notifier for size changes however they
     * happen — the grip, a stylesheet, a programmatic set — which is how
     * consumers rely on onResize (a GUI panel re-syncing its width, a canvas
     * re-fitting). It also persists, so geometry survives without every code
     * path remembering to save.
     */
    if(onResize || storageName) {
        if(DEBUG)console.log('setting ResizeObserver for : ', titleText, storageId);
        new ResizeObserver((entries) => {
            if(onResize) onResize(entries);
            saveSize();
        }).observe(mWindow);
    }

    manager.addElement(myself);
    clamp();

    return myself;
}

/**
 * popup menu items (PopupMenu) showing and hiding windows, each checked while
 * its window shows: entries [{ label, title, window }, { separator: true }],
 * window an internal window or an object acting as one ({ isVisible(),
 * setVisible(visible) }); an entry without a window is left out, and so is a
 * separator with no item before or after it
 */
function windowMenuItems(entries){
    const items = entries.filter(e => e.separator || e.window).map(e => (e.separator ? { separator: true } : {
        label:   e.label,
        title:   e.title,
        checked: e.window.isVisible(),
        action:  () => e.window.setVisible(!e.window.isVisible()),
    }));
    return items.filter((it, i) => !it.separator || (i > 0 && i < items.length - 1 && !items[i + 1].separator));
}

export {
    createInternalWindow,
    windowMenuItems,
};
