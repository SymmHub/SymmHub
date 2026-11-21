import {
    createInternalWindow,
} from './modules.js';

//
//  represents tree node
//    params.txt       the row's text
//    params.note      a grey text after it (a count, a kind)
//    params.title     the row's tooltip
//    params.dim       the row greyed (an empty folder)
//    params.userData  anything the callback wants
//
export class TreeNode {

    constructor(params){

        this.txt = (params.txt) ? params.txt:'[no name]';
        this.note = params.note || '';
        this.title = params.title || '';
        this.dim = !!params.dim;
        if (params.userData !== undefined) this.userData = params.userData;

    }


    appendChild(child){
        if(! this.children ){
            this.children = [];
        }
        this.children.push(child);
    }

    getText(){
        return this.txt;
    }

    getNote(){
        return this.note;
    }

    getChild(index){
        return (this.children)? this.children[index] : null;
    }

    getChildrenCount(){

        return (this.children)? this.children.length: 0;

    }

    getCallback(){
        return this.callback;
    }

    setCallback(callback){
       this.callback = callback;
    }

    getUserData(){
        return this.userData;

    }

    setUserData(userData){

        this.userData = userData;

    }

    hasChildren(){

        return (this.children)?true:false;

    }
} // class TreeNode

// the indent of a level of the tree, px
const INDENT = 14;

/**
    creates HTML tree view which can be attached to any element, in the look
    of the dat.gui panels (tree.css): rows of the panels' height with a line
    under each, the folders' arrows, a grey note after the text

    params.actionEvent  the event of a row with a callback (default 'click'):
                        it selects the row and calls callback(evt, node);
                        a folder row with a callback also opens
    params.toggleEvent  the event of the arrow (default 'click'): opens or
                        closes the folder
    params.showRoot     false: the root's children are the top rows (default true)

    a folder's rows are made when it is first opened
*/
export function createTreeView(treeNode, params={}){

    let doc = document;
    let selectedElement = null;

    let actionEvent = (params.actionEvent)?params.actionEvent:'click';
    let toggleEvent = (params.toggleEvent)?params.toggleEvent:'click';
    let showRoot = (params.showRoot !== false);

    function onTreeAction(evt) {

        let node = this.treeNode;
        let cb = node.getCallback();
        if (selectedElement) {
            selectedElement.classList.remove('selected-node');
        }
        selectedElement = this;
        selectedElement.classList.add('selected-node');
        if (node.hasChildren() && this.expand) this.expand(true);
        if (cb) {
            cb(evt, node);
        }
    }

    // the rows of the children of node under ul, a level deeper
    function renderChildren(node, ul, depth) {
        let count = node.getChildrenCount();
        for (let i = 0; i < count; i++) {
            let child = node.getChild(i);
            if (child instanceof Element) {
                ul.appendChild(child);
            } else {
                ul.appendChild(renderNode(child, depth, false));
            }
        }
    }

    function renderNode(node, depth, expanded) {
        let li = doc.createElement('li');
        li.className = 'tree-li';

        let row = doc.createElement('div');
        row.className = 'tree-row';
        row.style.paddingLeft = (4 + depth * INDENT) + 'px';
        if (node.dim) row.classList.add('tree-row--dim');
        if (node.title) row.title = node.title;
        li.appendChild(row);

        // Arrow span
        let arrow = doc.createElement('span');
        arrow.className = 'folder-arrow-right';
        row.appendChild(arrow);

        // Text/Label span
        let lis = doc.createElement('span');
        lis.className = 'tree-label';
        lis.appendChild(doc.createTextNode(node.getText()));
        row.appendChild(lis);

        let note = null;
        if (node.note) {
            note = doc.createElement('span');
            note.className = 'tree-note';
            note.textContent = node.note;
            row.appendChild(note);
        }

        if (node.hasChildren()) {
            let ul = null;
            // open (true), close (false) or switch the folder; its rows are made the first time
            const expand = (open) => {
                if (!ul) {
                    ul = doc.createElement('ul');
                    ul.className = 'nested';
                    renderChildren(node, ul, depth + 1);
                    li.appendChild(ul);
                }
                const now = (open === undefined) ? !ul.classList.contains('active') : open;
                ul.classList.toggle('active', now);
                arrow.classList.toggle('folder-arrow-down', now);
            };
            row.expand = expand;
            arrow.addEventListener(toggleEvent, (e) => {
                e.stopPropagation();
                expand();
            });
            if (expanded) expand(true);
        } else {
            arrow.classList.add('folder-arrow-hidden');
        }

        // Setup click handler/styling if clickable
        if (node.getCallback()) {
            row.classList.add('tree_node_clickable');
            // the node on the row and its parts, for the event's target (as before the callback's node argument)
            row.treeNode = node;
            lis.treeNode = node;
            if (note) note.treeNode = node;
            row.addEventListener(actionEvent, onTreeAction);
        } else if (node.hasChildren()) {
            // Folders that don't have a callback can toggle expansion when clicking the row
            row.classList.add('tree-folder-row');
            row.addEventListener('click', () => row.expand());
        }

        return li;
    }

    let topUL = doc.createElement('ul');
    topUL.className = 'tree-view';

    if (showRoot) {
        topUL.appendChild(renderNode(treeNode, 0, true));
    } else {
        renderChildren(treeNode, topUL, 0);
    }

    return topUL;
}

/**
 *  a window with a tree view in it (the look of the dat.gui panels), made
 *  once and filled again: show(tree, {note, title}) puts a new tree in, a note
 *  above it, and brings the window up
 *    options: title, storageId, left, top, width, height,
 *             treeOptions (createTreeView's params; showRoot false by default)
 */
export function createTreeWindow(options = {}){

    const win = createInternalWindow({
        title:     options.title || 'tree',
        width:     options.width || '300px',
        height:    options.height || '420px',
        left:      options.left || '60px',
        top:       options.top || '120px',
        canClose:  true,
        canResize: true,
        storageId: options.storageId,
    });
    win.interior.classList.add('tree-window');
    const note = document.createElement('div');
    note.className = 'tree-window__note';
    const body = document.createElement('div');
    body.className = 'tree-window__body';
    win.interior.append(note, body);

    function show(tree, opt = {}){
        note.textContent = opt.note || '';
        note.style.display = opt.note ? '' : 'none';
        body.replaceChildren(createTreeView(tree, { showRoot: false, ...options.treeOptions, ...opt.treeOptions }));
        body.scrollTop = 0;
        if (opt.title) win.setTitle(opt.title);
        if (win.isVisible()) win.raise();
        else win.setVisible(true);
    }

    return { window: win, show };
}
