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

    function getProperties() {
        const renderer = host.getDrawingRenderer();
        const p = () => renderer.getParams();
        return [
            { kind: 'toggle', text: 'Sym', title: 'Paint symmetrically across the group',
              get: () => !!p().symmetry.getValue(), set: (v) => p().symmetry.setValue(!!v) },
            { kind: 'separator' },
            { kind: 'number', label: 'radius', title: 'Brush radius', min: 0.001, max: 1, step: 0.005, width: 6,
              get: () => p().brushRadius.getValue(), set: (v) => p().brushRadius.setValue(v) },
            { kind: 'number', label: 'blur', title: 'Brush blur', min: 0, max: 1, step: 0.01, width: 5,
              get: () => p().brushBlur.getValue(), set: (v) => p().brushBlur.setValue(v) },
            { kind: 'separator' },
            { kind: 'group', title: 'Brush values (RGBA)', controls: [
                { kind: 'number', label: 'R', title: 'Brush R / channel 0', min: -10, max: 10, step: 0.05, width: 5,
                  get: () => p().brushR.getValue(), set: (v) => p().brushR.setValue(v) },
                { kind: 'number', label: 'G', title: 'Brush G / channel 1', min: -10, max: 10, step: 0.05, width: 5,
                  get: () => p().brushG.getValue(), set: (v) => p().brushG.setValue(v) },
                { kind: 'number', label: 'B', title: 'Brush B / channel 2', min: -10, max: 10, step: 0.05, width: 5,
                  get: () => p().brushB.getValue(), set: (v) => p().brushB.setValue(v) },
                { kind: 'number', label: 'A', title: 'Brush A / channel 3', min: -10, max: 10, step: 0.05, width: 5,
                  get: () => p().brushA.getValue(), set: (v) => p().brushA.setValue(v) },
            ] },
            { kind: 'separator' },
            { kind: 'button', text: 'Draw Dot', title: 'Stamp a dot at the current brush (x, y)',
              action: () => {
                  renderer.init({ ctx: host.getGLContext() });
                  renderer.drawDot([p().brushX.getValue(), p().brushY.getValue()]);
              } },
            { kind: 'hint' },
        ];
    }

    return {
        name:  'draw',
        label: 'Draw',
        key:   'D',
        icon:  skin.images.draw,
        group: 'view',
        help:  'click paints a dot, drag paints a stroke in pattern space; Ctrl+click picks value; Space+drag pans',
        cursor: skin.cursors.draw,
        getProperties,
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
        key:   'K',
        icon:  skin.images.pick,
        group: 'view',
        help:  'click picks the colour/value under the pointer; Space+drag pans',
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
