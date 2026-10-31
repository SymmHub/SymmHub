//
//  DrawingCommands - the commands on the selected shapes, in one list: the
//  select tool's property bar shows them as buttons and menus (uilib
//  PropertyBar controls, PopupMenu items), with the keys that do the same
//  in their tooltips.
//
//  A command: { id, label, title, key, icon, enabled(), run() }.
//    commands.get(id)            the command
//    commands.button(id, opt)    a property bar button running it
//    commands.menuItems(ids)     popup menu items ('-' for a separator)
//

const STROKE = 'fill="none" stroke="#303030" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const svg = (body) => `<svg viewBox="0 0 24 24">${body}</svg>`;

// the icons of the buttons: the same line weight as the tools' icons
const ICONS = {
    group:       svg(`<rect x="2.5" y="2.5" width="19" height="19" rx="1" fill="none" stroke="#303030" stroke-width="1.2" stroke-dasharray="2.5 2"/>` +
                     `<rect x="5.5" y="6" width="8" height="7" ${STROKE}/><circle cx="15" cy="15" r="4" ${STROKE}/>`),
    ungroup:     svg(`<rect x="2.5" y="3.5" width="9" height="8" ${STROKE}/><circle cx="16.5" cy="16.5" r="4.5" ${STROKE}/>`),
    flipH:       svg(`<path d="M12 3 V21" fill="none" stroke="#303030" stroke-width="1.2" stroke-dasharray="2 2"/>` +
                     `<path d="M9.5 6 L3 18 H9.5 Z" ${STROKE}/><path d="M14.5 6 L21 18 H14.5 Z" fill="#303030" stroke="#303030" stroke-width="1.2" stroke-linejoin="round"/>`),
    flipV:       svg(`<path d="M3 12 H21" fill="none" stroke="#303030" stroke-width="1.2" stroke-dasharray="2 2"/>` +
                     `<path d="M6 9.5 L18 3 V9.5 Z" ${STROKE}/><path d="M6 14.5 L18 21 V14.5 Z" fill="#303030" stroke="#303030" stroke-width="1.2" stroke-linejoin="round"/>`),
    rotateLeft:  svg(`<path d="M7 7 A7.5 7.5 0 1 1 5 14" ${STROKE}/><path d="M3 4 V9 H8" ${STROKE}/>`),
    rotateRight: svg(`<path d="M17 7 A7.5 7.5 0 1 0 19 14" ${STROKE}/><path d="M21 4 V9 H16" ${STROKE}/>`),
    raise:       svg(`<rect x="5" y="14" width="14" height="7" ${STROKE}/><path d="M12 11 V3 M8 7 L12 3 L16 7" ${STROKE}/>`),
    lower:       svg(`<rect x="5" y="3" width="14" height="7" ${STROKE}/><path d="M12 13 V21 M8 17 L12 21 L16 17" ${STROKE}/>`),
    toTop:       svg(`<path d="M4 3 H20" ${STROKE}/><path d="M12 21 V7 M7 12 L12 7 L17 12" ${STROKE}/>`),
    toBottom:    svg(`<path d="M4 21 H20" ${STROKE}/><path d="M12 3 V17 M7 12 L12 17 L17 12" ${STROKE}/>`),
    align:       svg(`<path d="M4 2 V22" ${STROKE}/><rect x="6" y="5" width="13" height="5" ${STROKE}/><rect x="6" y="14" width="8" height="5" ${STROKE}/>`),
    menu:        svg(`<path d="M4 7 H20 M4 12 H20 M4 17 H20" fill="none" stroke="#303030" stroke-width="2" stroke-linecap="round"/>`),
};

function DrawingCommands(editor){

    const doc = editor.document;

    /** the selected items */
    const selected = () => editor.getSelection().map(s => doc.getItem(s.id)).filter(Boolean);
    // tiles stay where they are: they follow the domain
    const movable = () => selected().filter(it => !it.tile);
    const shapes = () => selected().filter(it => it.type !== 'image' && it.type !== 'group' && !it.tile);
    const any = () => selected().length > 0;

    const align = (id, label, mode) => ({ id, label, enabled: () => movable().length >= 2, run: () => editor.alignSelection(mode) });

    const LIST = [
        { id: 'group', label: 'Group', key: 'Ctrl+G', title: 'the selection as one group; a double click edits inside it',
          enabled: any, run: () => editor.groupSelection() },
        { id: 'ungroup', label: 'Ungroup', key: 'Ctrl+Shift+G', title: 'the selected groups taken apart',
          enabled: () => selected().some(it => it.type === 'group'), run: () => editor.ungroupSelection() },
        { id: 'flipH', label: 'Flip horizontal', title: 'left and right swapped about the centre of the selection',
          enabled: () => movable().length > 0, run: () => editor.flipSelection('x') },
        { id: 'flipV', label: 'Flip vertical', title: 'top and bottom swapped about the centre of the selection',
          enabled: () => movable().length > 0, run: () => editor.flipSelection('y') },
        { id: 'rotateLeft', label: 'Rotate 90° left', enabled: () => movable().length > 0, run: () => editor.rotateSelection(Math.PI/2) },
        { id: 'rotateRight', label: 'Rotate 90° right', enabled: () => movable().length > 0, run: () => editor.rotateSelection(-Math.PI/2) },
        { id: 'raise', label: 'Raise', key: 'PageUp', title: 'one step up in the drawing order', enabled: any, run: () => editor.reorderSelection('up') },
        { id: 'lower', label: 'Lower', key: 'PageDown', title: 'one step down in the drawing order', enabled: any, run: () => editor.reorderSelection('down') },
        { id: 'toTop', label: 'Raise to top', key: 'Home', enabled: any, run: () => editor.reorderSelection('top') },
        { id: 'toBottom', label: 'Lower to bottom', key: 'End', enabled: any, run: () => editor.reorderSelection('bottom') },
        { id: 'duplicate', label: 'Duplicate', key: 'Ctrl+D', title: 'copies in place, selected', enabled: any, run: () => editor.duplicateSelection() },
        { id: 'copy', label: 'Copy', key: 'Ctrl+C', title: 'kept for pasting', enabled: any, run: () => editor.copySelection() },
        { id: 'paste', label: 'Paste', key: 'Ctrl+V', title: 'the copies where new items go', enabled: () => editor.hasClipboard(), run: () => editor.pasteClipboard() },
        { id: 'delete', label: 'Delete', key: 'Delete', title: 'the selected shapes removed', enabled: any,
          run: () => editor.removeItems(editor.getSelection().map(s => s.id)) },
        { id: 'selectAll', label: 'Select all', key: 'Ctrl+A', title: 'every shape of the visible, unlocked layers',
          enabled: () => doc.getEditableItems().length > 0,
          run: () => editor.setSelection(doc.getEditableItems().map(it => ({ id: it.id, frame: null, frameInv: null }))) },
        { id: 'toPath', label: 'To path', title: 'curves: polylines as Bezier paths, a shape kept by its numbers as a plain path (its nodes then take handles)',
          enabled: () => shapes().some(it => !it.nodes || it.shape), run: () => editor.convertSelection(true) },
        { id: 'toPolyline', label: 'To polyline', title: 'the paths as polylines through their outlines',
          enabled: () => shapes().some(it => it.nodes), run: () => editor.convertSelection(false) },
        { id: 'fitCurves', label: 'Fit curves', title: 'the polylines as paths of curves fitted to their vertices',
          enabled: () => shapes().some(it => it.type === 'polyline' && it.points.length >= 6), run: () => editor.fitSelection() },
        align('alignLeft', 'Align left', 'left'),
        align('alignCentre', 'Align centre', 'hcentre'),
        align('alignRight', 'Align right', 'right'),
        align('alignTop', 'Align top', 'top'),
        align('alignMiddle', 'Align middle', 'vcentre'),
        align('alignBottom', 'Align bottom', 'bottom'),
        { id: 'spreadH', label: 'Spread horizontally', title: 'equal gaps between them, the outer two staying',
          enabled: () => movable().length >= 3, run: () => editor.distributeSelection('x') },
        { id: 'spreadV', label: 'Spread vertically', title: 'equal gaps between them, the outer two staying',
          enabled: () => movable().length >= 3, run: () => editor.distributeSelection('y') },
    ];
    const BY_ID = new Map(LIST.map(c => [c.id, c]));

    /** "Group (Ctrl+G): the selection as one group" */
    function tooltip(c){
        return c.label + (c.key ? ` (${c.key})` : '') + (c.title ? ': ' + c.title : '');
    }

    /** a property bar button for the command; opt: visible() */
    function button(id, opt = {}){
        const c = BY_ID.get(id);
        return { kind: 'button', icon: ICONS[id], title: tooltip(c), enabled: c.enabled, action: c.run, ...opt };
    }

    /** popup menu items for the commands, '-' between groups */
    function menuItems(ids){
        return ids.map(id => (id === '-' ? { separator: true } : (() => {
            const c = BY_ID.get(id);
            return { label: c.label + (c.key ? `  ${c.key}` : ''), title: c.title, disabled: !c.enabled(), action: c.run };
        })()));
    }

    return {
        list:  LIST,
        get:   (id) => BY_ID.get(id),
        icon:  (name) => ICONS[name],
        button,
        menuItems,
        anySelected: any,
    };

} // function DrawingCommands()

export { DrawingCommands };
