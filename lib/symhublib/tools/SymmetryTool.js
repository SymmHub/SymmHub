//
//  The Symmetry tool: edits the symmetry on the canvas (docs/symmetry_tool_plan.md,
//  docs/symrenderer_refactor_plan.md phase 3b). While it is active the renderer's
//  sets of handles take the pointer, each as its toggle says: the Dirichlet
//  domain's, the group transform's frame (a Euclidean group's), the group's.
//  They get the events in turn, each as a tool of its own (getHandlers), and
//  belong to the renderer, which draws them; the tool turns them on and holds
//  their toggles and the group transform's numbers in its bar. It works through
//  the host's symmetry part and the skin's icons; options.openWindow opens the
//  UI's window of the symmetry when the tool is taken up.
//

const HELP = 'edits the symmetry on the canvas, each set of handles by its toggle: the group\'s handles ' +
                                      '(drag an edge of the orbifold\'s domain: its length, Shift: its twist); the group transform of ' +
                                      'a Euclidean group (a frame round the fundamental domain: drag its centre: moves the group, a corner: turns and ' +
                                      'scales it about the centre, Shift: turn only, Alt: scale only, Escape: back); the Dirichlet domain ' +
                                      '(drag the yellow disc: the base, D: the base to the pointer, a click on a point, an arc or a ' +
                                      'cell adds or removes its side); a drag elsewhere moves the view; Ctrl+Z, Ctrl+Y: undo, redo ' +
                                      'of the symmetry\'s edits';

function SymmetryTool(host, options = {}) {

    const skin = options.skin;
    const openWindow = options.openWindow || (() => {});
    const sym = host.symmetry;

    // the Dirichlet domain's switch 'edit' asks for the tool
    host.addEventListener('symmetryEditRequested', () => host.setTool('symmetry'));

    //
    //  the bar: a toggle for each set of handles on the canvas, the
    //  group's (shown when the group maker has them) and the Dirichlet domain's, and the
    //  help button
    //
    function getProperties() {
        const toggle = (key, icon, title) => ({ kind: 'toggle', icon, title,
            get: () => sym.getHandles()[key], set: (v) => sym.setHandle(key, !!v) });
        return [
            { ...toggle('group', skin.icons.groupHandles,
                'the group\'s handles on the canvas: the orders at the corners of the domain (the wheel over a label, ' +
                'its − and +, the keys - and +, or a drag up and down on it), the sizes and angles (drag the discs and ' +
                'diamonds; Shift: fine; Escape: back as at the press); the orbifold: drag an edge of its domain to ' +
                'change its length, Shift+drag its twist, or turn the wheel over it'),
              visible: () => sym.hasGroupHandles() },
            { ...toggle('transform', skin.icons.transformHandles,
                'the group transform on the canvas, a frame round the fundamental domain: drag its centre to move the ' +
                'group, a corner to turn and scale it about the centre (Shift: turn only, in steps of 15°; Alt: scale ' +
                'only; Escape: back as at the press). For the groups of the Euclidean plane; the transform of the ' +
                'others is in the symmetry panel'),
              visible: () => sym.groupIsEuclidean() },
            { kind: 'toggle', icon: skin.icons.dirichlet, get: () => sym.getHandles().dirichlet, set: (v) => sym.editDirichlet(!!v),
              title: 'the Dirichlet domain on the canvas, as the switch edit of its settings: drag the yellow disc to move ' +
                'the base (D: the base to the pointer); a click on a point, an arc or a cell adds or removes its side, ' +
                'Ctrl+Z undoes; on, the base shows also before the domain has a side, and the settings open' },
            { kind: 'hint' },
            groupTransformControls(),
        ];
    }

    //
    //  the group transform's numbers in the bar, with its frame on: the
    //  frame's centre c = g(a) (in the world; a the centre of the box of the maker's
    //  fundamental domain), its angle and its scale; the angle and the scale turn and
    //  scale the group about c. Written back as the stored numbers
    //  (GroupTransformFrame.js transformFromFrame)
    //
    function groupTransformControls() {
        const conf = sym.getTransform();
        const frame = () => sym.getTransformFrame();
        const setFrame = (c, angle, scale) => sym.setTransformFrame(c, angle, scale);
        const num = (label, title, min, max, step, width, get, set) => ({ kind: 'number', label, title, min, max, step, width, get, set });
        return { kind: 'group', title: 'the group transform', visible: () => sym.transformFrameOn(), controls: [
            num('x', 'the frame\'s centre, x: where the centre of the fundamental domain\'s box goes', -1000, 1000, 0.001, 7,
                () => frame().centre[0], (v) => { const f = frame(); setFrame([v, f.centre[1]], conf.rotation, f.scale); }),
            num('y', 'the frame\'s centre, y: where the centre of the fundamental domain\'s box goes', -1000, 1000, 0.001, 7,
                () => frame().centre[1], (v) => { const f = frame(); setFrame([f.centre[0], v], conf.rotation, f.scale); }),
            num('angle', 'the turn of the group about the centre, degrees', -360, 360, 0.1, 6,
                () => conf.rotation, (v) => { const f = frame(); setFrame(f.centre, v, f.scale); }),
            num('scale', 'the scale of the group about the centre', 0.000001, 1000000, 0.001, 7,
                () => conf.scale, (v) => { const f = frame(); setFrame(f.centre, conf.rotation, v); }),
            { kind: 'menu', icon: skin.icons.menu, title: 'commands of the group transform: Reset, Centre to 0, Origin to 0', items: sym.transformMenu },
        ] };
    }

    return {
        name:  'symmetry',
        label: 'Symmetry',
        key:   'Y',
        icon:  skin.images.symmetry,
        group: 'view',
        help:  HELP,
        cursor: 'default',
        getProperties,
        // taken up, the handles are on (and the symmetry's window opens); left, they drop
        // what they were in the middle of
        setActive: (on) => {
            sym.setEditing(!!on);
            if (on) openWindow();
        },
        // the sets of handles that are on, in the order they get the events
        getHandlers: () => sym.handlers(),
    };
}

export {
    SymmetryTool,
};
