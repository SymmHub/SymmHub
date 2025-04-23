
import {
    createInternalWindow,
    TreeNode, 
    createTreeView,
} from '../modules.js';



function onNodeClicked(evt){
   console.log('onNodeClicked(), this.treeNode.userData: ', evt.target.treeNode.getUserData());
}


function onFolderClicked(evt){
   console.log('onFolderClicked(), this.treeNode.userData: ', evt.target.treeNode.getUserData());
}


function appendChildren2(node, count){
    for(let i = 0; i < count; i++){
        let child = new TreeNode({txt:`level 2 item [${i}]`});        
        child.setCallback(onNodeClicked);
        child.setUserData(`child [${i}]`);
        node.appendChild(child);
    }
}


function appendChildren1(node, count){
    
    for(let i = 0; i < count; i++){
        let child = new TreeNode({txt:`level 1 item [${i}]`});        
        child.setCallback(onFolderClicked);
        node.appendChild(child);
        appendChildren2(child, count);        
    }
}

function makeTestTree(count){
    
    let root = new TreeNode({txt:'tree root'});
    let item1 = new TreeNode({txt:'level 0 item 1'});
    let item2 = new TreeNode({txt:'level 0 item 2'});
    let item3 = new TreeNode({txt:'level 0 item 3'});
    root.appendChild(item1);
    root.appendChild(item2);
    root.appendChild(item3);

    appendChildren1(item1, count);
    appendChildren1(item2, count);
    appendChildren1(item3, count);
    return root;
}

function testTreeNode(){
    let node = makeTestTree(10);
    console.log('node: ', node);
}


function testTree(){
    
    console.log('testTree()');

    let mWindow = createInternalWindow({
                                    width:  '50%',
                                    height: '50%',
                                    left:   '5%',
                                    top:    '5%',
                                    title:  'tree viewer',
                                    canClose: true,
                                    canResize: true,
                                    //onResize:  onResize,
                                    storageId: 'testTreeStorage',
                                    });    
    
    let tree = makeTestTree(10);
    
    let treeView = createTreeView(tree);
    
    
    mWindow.interior.appendChild(treeView);      
    
    mWindow.setVisible(true);
    
}

testTree();
//testTreeNode();
