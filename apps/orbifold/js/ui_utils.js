import {
    createInternalWindow  
} from './modules.js';

//
//    creates layered canvas for GL rendering and 2D rendering
//
export function createLayeredCanvas(options){
    
    let canvasContainer = document.createElement('div');
    canvasContainer.id = 'canvasContainer';
    let glCanvas = document.createElement('canvas');
    glCanvas.className = 'layeredCanvas';
    let overlay = document.createElement('canvas');
    overlay.className = 'layeredCanvas';
    canvasContainer.appendChild(glCanvas);
    canvasContainer.appendChild(overlay);
   // document.body.appendChild(canvasContainer);
                    
    let btnWidth = 40;
    let btnCount = 9;
    let extra = 22;
    let titleHeight = 22;
    
    // floating window
    let intWin = createInternalWindow({
                                    width: '50%', 
                                    height: '50%',
                                    left: '1px', 
                                    top:  '1px',
                                    title:    (options.title)?(options.title) : 'visualization',
                                    canResize: true,
                                    storageId: (options.storageId)? options.storageId: 'orbifold_visualization',
                                    onResize:  (options.onresize)?(options.onresize):(()=>{}),
                                    });  
    let interior = intWin.interior;
    
    interior.style.overflowY = "auto";
    interior.style.overflowX = "auto";
    //interior.style.width = 'max-content';
    //interior.style.height = 'max-content';
    
    //document.body.appendChild(toolbox);
    interior.appendChild(canvasContainer);
                    
                    
    return {
        container: canvasContainer,
        glCanvas:  glCanvas,
        overlay:   overlay,            
    };
}
