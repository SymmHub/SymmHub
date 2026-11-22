import {
    DrawingToolHandler,
} from '../modules.js';

//
//  Draw and Pick: paint into the pattern, pick the colour under the pointer
//  (docs/symrenderer_refactor_plan.md phase 3c). Each has a
//  DrawingToolHandler of its own over the renderer's drawing renderer
//  (host.getDrawingRenderer(), whose settings are in the tools panel); Ctrl+click
//  picks in Draw too. They work through the host's transforms and the skin's
//  icons and cursors.
//

//  the drawing tool: the press paints a dot, the drag a stroke, in pattern space
function DrawTool(host, options = {}) {

    const skin = options.skin;
    let mHandler = null;

    return {
        name:  'draw',
        label: 'Draw',
        icon:  skin.images.draw,
        group: 'view',
        help:  'paints into the pattern',
        cursor: skin.cursors.draw,
        // a new handler each time the tool is taken up, its renderer ready
        setActive: (on) => {
            if (!on) return;
            const renderer = host.getDrawingRenderer();
            renderer.init({ ctx: host.getGLContext() });
            mHandler = DrawingToolHandler({ renderer, getToolName: () => 'draw' });
        },
        handleEvent: (e) => {
            // world-space coordinate, as the Pattern box tool's, so the navigator
            // (zoom / pan) works as a fallback
            const wpnt = [0, 0];
            host.canvasTransform.invTransform([e.canvasX, e.canvasY], wpnt);
            e.wpnt = wpnt;
            // the pattern-space coordinate for the drawing itself
            const simPnt = [0, 0];
            host.patternTransform.invTransform(wpnt, simPnt);
            e.simPnt = simPnt;
            mHandler.handleEvent(e);
        },
    };
}

//  the eyedropper: a click picks the pattern's value under the pointer
function PickTool(host, options = {}) {

    const skin = options.skin;
    let mHandler = null;

    return {
        name:  'pick',
        label: 'Pick',
        icon:  skin.images.pick,
        group: 'view',
        help:  'a click picks the colour under the pointer',
        cursor: skin.cursors.pick,
        setActive: (on) => {
            if (!on || mHandler) return;
            const renderer = host.getDrawingRenderer();
            renderer.init({ ctx: host.getGLContext() });
            mHandler = DrawingToolHandler({ renderer, getToolName: () => 'pick' });
        },
        handleEvent: (e) => {
            // the point in pattern space
            e.wpnt = host.canvasToPattern([e.canvasX, e.canvasY]);
            mHandler.handleEvent(e);
        },
    };
}

export {
    DrawTool,
    PickTool,
};
