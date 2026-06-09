//
//  represents tree node 
//
export class TreeNode {
    
    constructor(params){
        
        this.txt = (params.txt) ? params.txt:'[no name]';
        
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


/**
    creates HTML tree view whch can be attached to any element 
*/
export function createTreeView(treeNode, params={}){
    
    let doc = document;
    let selectedElement = null;
    
    let actionEvent = (params.actionEvent)?params.actionEvent:'click';
    let toggleEvent = (params.toggleEvent)?params.toggleEvent:'click';
    
    function toggleExpand(li, arrow) {
        let nestedUL = li.querySelector(':scope > .nested');
        if (nestedUL) {
            nestedUL.classList.toggle('active');
            arrow.classList.toggle('folder-arrow-down');
        }
    }

    function onTreeAction(evt) {
        console.log('onTreeAction():', this); 
        
        let cb = this.treeNode.getCallback();
        if (selectedElement) {
            selectedElement.classList.remove('selected-node');
        }
        selectedElement = this;
        selectedElement.classList.add('selected-node');
        if (cb) {
            cb(evt);
        }
    }
    
    function renderNode(node, isRoot = false) {
        let li = doc.createElement('li');
        li.className = 'tree-li';
        
        let row = doc.createElement('div');
        row.className = 'tree-row';
        li.appendChild(row);
        
        // Arrow span
        let arrow = doc.createElement('span');
        if (node.hasChildren()) {
            arrow.className = 'folder-arrow-right';
            if (isRoot) {
                arrow.classList.add('folder-arrow-down');
            }
            arrow.addEventListener(toggleEvent, (e) => {
                e.stopPropagation();
                toggleExpand(li, arrow);
            });
        } else {
            arrow.className = 'folder-arrow-right folder-arrow-hidden';
        }
        row.appendChild(arrow);
        
        // Text/Label span
        let lis = doc.createElement('span');
        lis.className = 'tree-label';
        let litxt = doc.createTextNode(node.getText());
        lis.appendChild(litxt);
        row.appendChild(lis);
        
        // Setup click handler/styling if clickable
        if (node.getCallback()) {
            row.classList.add('tree_node_clickable');
            row.treeNode = node;
            lis.treeNode = node; // Also attach to label for event.target backwards compatibility
            row.addEventListener(actionEvent, onTreeAction);
        } else if (node.hasChildren()) {
            // Folders that don't have a callback can toggle expansion when clicking the row
            row.classList.add('tree-folder-row');
            row.addEventListener('click', (e) => {
                toggleExpand(li, arrow);
            });
        }
        
        if (node.hasChildren()) {
            let ul = doc.createElement('ul');
            ul.className = 'nested';
            if (isRoot) {
                ul.classList.add('active');
            }
            
            let count = node.getChildrenCount();
            for (let i = 0; i < count; i++) {
                let child = node.getChild(i);
                if (child instanceof Element) {
                    ul.appendChild(child);
                } else {
                    ul.appendChild(renderNode(child, false));
                }
            }
            li.appendChild(ul);
        }
        
        return li;
    }
    
    let topUL = doc.createElement('ul');
    topUL.setAttribute('id', 'myUL');
    
    let rootLi = renderNode(treeNode, true);
    topUL.appendChild(rootLi);
    
    return topUL;
}
