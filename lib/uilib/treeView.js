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
    
    let topUL = doc.createElement('ul');
    topUL.setAttribute('id', 'myUL');
    
    let li = doc.createElement('li');    
    let lis = doc.createElement('span');
    let lit = doc.createTextNode(treeNode.getText());
    //lis.setAttribute('class','caret');
    
    lis.appendChild(lit);
    li.appendChild(lis);
    
    topUL.appendChild(li);

    let ul2 = doc.createElement('ul');    
    ul2.setAttribute('class', 'nested');
    li.appendChild(ul2);

    appendChildren(treeNode, li);
    
    console.log('done: ', li);
    
    lis.addEventListener(toggleEvent, onTreeToggle);
    
    
    function appendChildren(node, elem){
        
        //console.log('appendChildren()', node, ' to ', elem);
        
        let ul  = doc.createElement('ul');
        //ul.setAttribute('class', 'nested');
        elem.appendChild(ul);
        let count = node.getChildrenCount();
        
        for(let i = 0; i < count; i++){
            
            let child = node.getChild(i);
            if(child instanceof Element)
            {
                ul.appendChild(child);
                continue;
            }

            //console.log('child: ', child);
            let li = doc.createElement('li');
            if(child.hasChildren()){
                let arrow = doc.createElement('span');                
                arrow.setAttribute('class', 'folder-arrow-right');
                let arrowTxt = doc.createTextNode('\u25B6')
                arrow.addEventListener(toggleEvent, onArrowToggle);
                arrow.appendChild(arrowTxt);
                
                //arrow.setAttribute('class', 'caret');
                li.appendChild(arrow);
            } else {
                let dash = doc.createElement('span');                
                dash.setAttribute('class', 'folder-arrow-right');
                dash.appendChild(doc.createTextNode('-'));                
                li.appendChild(dash);
                
            }
            
            let lis = doc.createElement('span');
            let litxt = doc.createTextNode(child.getText());        
            lis.appendChild(litxt);
            li.appendChild(lis);

            if(child.getCallback()){
                lis.setAttribute('class', 'tree_node_clickable');
                // store tree node as treeNode on the element
                lis.treeNode = child; 
                //lis.addEventListener(actionEvent, child.getCallback());
                lis.addEventListener(actionEvent, onTreeAction);
            }
            ul.appendChild(li); 
            if(child.hasChildren()){
                //lis.setAttribute('class', 'caret');
                //lis.addEventListener(toggleEvent, onTreeToggle);
                let ul  = doc.createElement('ul');
                ul.setAttribute('class', 'nested');
                li.appendChild(ul);
                appendChildren(child, ul);
            }
                    
        }
        
    }
    
    function onTreeAction(evt){
        
        console.log('onTreeAction():', this); 
        console.log('classList:', this.classList); 
        if(selectedElement)console.log('selectedElement.classList:', selectedElement.classList); 
        
        let cb = this.treeNode.getCallback();
        if(selectedElement) 
            selectedElement.classList.remove('selected-node');
        selectedElement = this;
        selectedElement.classList.add('selected-node');
        if(cb){
            cb(evt);
        }
    }
    
    function onTreeToggle() {
        //console.log('onTreeToggle()', this);
        if(this.parentElement){
            this.parentElement.querySelector(".nested").classList.toggle("active");
        }
        this.classList.toggle("caret-down");
    }

    function onArrowToggle() {
        console.log('onArrowToggle()', this);
        if(this.parentElement){
            this.parentElement.querySelector(".nested").classList.toggle("active");
        }
        this.classList.toggle("folder-arrow-down");
    }

    return topUL;

}
