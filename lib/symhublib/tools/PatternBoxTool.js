import {
    PatternTransformHandler,
    PatternTransformRenderer,
} from '../modules.js';

//
//  The Pattern box tool: moves, turns and scales the pattern's box
//  (docs/symrenderer_refactor_plan.md phase 3c). Its handler takes the
//  pointer (PatternTransformHandler), its renderer draws the box
//  (PatternTransformRenderer), both made when the tool is first taken up. It
//  works through the host's patternBox part, the view and the skin's icons
//  and cursors.
//

const HELP = 'drag moves the box of the pattern, drag near its corners turns and scales it';

function PatternBoxTool(host, options = {}) {

    const skin = options.skin;
    const box = host.patternBox;
    let mHandler = null;
    let mRenderer = null;

    function make() {
        if (!mHandler) {
            mHandler = PatternTransformHandler({
                config: box.getConfig(),
                onChanged: box.changed,
                canvasTransform: host.canvasTransform,
                overlay: host.canvas.overlay,
                cursorMove: skin.cursors.move,
                cursorTransform: skin.cursors.patternTransform,
                getGroup: host.getGroup,
                // the pattern box may be placed by a bent pose: the drags move in the geometry of the group
                canBend: box.canBend,
                // the handles are found by pixels at the pointer, by the view's local scale there
                scaleAt: (cpnt) => host.view.scaleAt(cpnt),
                // the images of a pattern of several, the shown ones: each can be selected and moved
                getImageTransforms: box.imageTransforms,
            });
        }
        if (!mRenderer) {
            mRenderer = PatternTransformRenderer({
                config: box.getConfig(),
                handler: mHandler,
            });
        }
    }

    //
    //  the bar
    //
    function getProperties() {
        const ptc = box.getConfig();
        const num = (key, label, title, min, max, step) => ({ kind: 'number', key, label, title, min, max, step,
            get: () => ptc[key], set: (v) => { ptc[key] = v; box.changed(); } });
        // the centre, and the size and turn: two groups the bar may put in two rows;
        // an image pattern (one that can take a bent placement) moves in the geometry of
        // the group when the toggle is on
        const controls = [
            { kind: 'group', title: 'centre', controls: [
                num('centerX', 'x', 'centre of the pattern box, x', -10, 10, 0.001),
                num('centerY', 'y', 'centre of the pattern box, y', -10, 10, 0.001),
            ] },
            { kind: 'group', title: 'size and turn', controls: [
                num('scale', 'scale', 'size of the pattern box', 0.0001, 100, 0.001),
                num('angle', 'angle', 'turn of the pattern box, degrees', -360, 360, 0.1),
            ] },
        ];
        if (box.canBend()) {
            controls.push({ kind: 'toggle', icon: skin.icons.geometry,
                title: 'move, turn and scale the pattern in the geometry of the group (the hyperbolic plane, the sphere, ' +
                       'the local disks of a Kleinian group): the picture keeps its size in the pattern and bends; ' +
                       'off: in the plane, as before',
                get: () => ptc.geometric !== false, set: (v) => { ptc.geometric = v; box.changed(); } });
        }
        return controls;
    }

    return {
        name:  'patternTransform',
        label: 'Pattern box',
        key:   'M',
        icon:  skin.images.patternTransform,
        group: 'view',
        help:  HELP,
        cursor: skin.cursors.move,
        getProperties,
        setActive: (on) => { if (on) make(); },
        // the world point the screen shows there, through the view's chain of maps
        handleEvent: (e) => {
            e.wpnt = host.view.toWorld([e.canvasX, e.canvasY]).pnt;
            mHandler.handleEvent(e);
        },
        // the box, drawn by the GPU pass through the view's chain or on the 2D canvas
        getOverlayGeometry: () => mRenderer ? mRenderer.getOverlayGeometry() : null,
        renderUI: (ctx, canvasTransform) => { if (mRenderer) mRenderer.renderUI(ctx, canvasTransform); },
    };
}

export {
    PatternBoxTool,
};
