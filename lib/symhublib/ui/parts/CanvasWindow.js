//
//  CanvasWindow.js: the window the canvas is in, 'visualization', three quarters of
//  the page; its title is the document's name (the host's 'titleChanged'), and a
//  resize of it is the canvas's (host.canvasResized). A part of the UI builders
//  (docs/symrenderer_refactor_plan.md phase 4)
//
import {
    createInternalWindow,
} from '../../modules.js';

export function createCanvasWindow(host, opt = {}) {
    const win = createInternalWindow({
        width:      opt.width || '75%',
        height:     opt.height || '75%',
        left:       opt.left || '1px',
        top:        opt.top || '1px',
        title:      'visualization',
        background: true,
        canResize:  true,
        storageId:  opt.storageId || 'visualization',
        onResize:   () => host.canvasResized(),
    });
    host.addEventListener('titleChanged', (e) => win.setTitle(e.title));
    return win;
}
