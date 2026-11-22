//
//  ToolPaletteBar.js: the tools in a palette of their own, and the active tool's
//  settings (tool.getProperties()) and help in a property bar; a key the tools leave
//  alone picks a tool of the palette. A part of the UI builders
//  (docs/symrenderer_refactor_plan.md phase 4). The pattern's tools come first, then
//  the renderer's named in opt.tools; the pattern's parts of this UI (symdraw: the
//  stroke and fill swatches under the palette, the layers window) are made here too
//  (pattern.createToolUI)
//
//  opt.skin      the images (a pattern tool without an icon shows images.draw)
//  opt.tools     the renderer's tools in the palette, by name
//  opt.toolbox   the toolbox (ToolboxPart.js): the bar goes on its right, the palette
//                under it
//
import {
    createToolPalette,
    createPropertyBar,
} from '../../modules.js';

const DEFAULT_PALETTE_TOOLS = ['move', 'patternTransform', 'symmetry'];

// keys typed into a text field, a menu or an editable element pick no tool; a
// focused button (the toolbox's image inputs) or checkbox takes no keys
const NOT_TYPED_INPUTS = /^(button|image|submit|reset|checkbox|radio|color|file)$/;

function isTypingTarget(t) {
    if (!t) return false;
    if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
    return t.tagName === 'INPUT' && !NOT_TYPED_INPUTS.test(t.type);
}

// a tool's help line in the bar: its hint where it has one (the Orientation tool's
// follows the navigation mode), else its help
function toolHint(tool) {
    return tool.getHint ? tool.getHint() : (tool.help || tool.title || '');
}

export function createToolPaletteBar(host, opt = {}) {

    const skin = opt.skin;
    const all = host.getTools();
    const tools = [];
    (opt.tools || DEFAULT_PALETTE_TOOLS).forEach(name => {
        const entry = all.find(t => t.name === name && t.owner === 'renderer');
        if (!entry) return;
        const t = entry.tool;
        tools.push({ name, label: t.label, key: t.key, icon: t.icon, group: t.group || 'view' });
    });
    // the pattern's tools come first, the view's after them
    const patternTools = all.filter(t => t.owner === 'pattern').map(({ name, tool }) => ({
        name,
        label: tool.label || tool.name,
        key:   tool.key,
        icon:  tool.icon || skin.images.draw,
        group: tool.group || 'pattern',
    }));
    tools.unshift(...patternTools);

    // the bar on the right of the toolbox, the palette under it
    const tbWnd = opt.toolbox && opt.toolbox.intWin ? opt.toolbox.intWin.wnd : null;
    const tbRight  = tbWnd ? tbWnd.offsetLeft + tbWnd.offsetWidth : 0;
    const tbBottom = tbWnd ? tbWnd.offsetTop + tbWnd.offsetHeight : 0;
    const bar = createPropertyBar({
        title:     'tool',
        storageId: 'tool_bar',
        left:      (tbRight + 6) + 'px',
        top:       '1px',
    });
    // a place saved beside a narrower toolbox covers its last buttons: the bar goes to its right
    const barWnd = bar.window.wnd;
    if (tbWnd && barWnd.offsetLeft < tbRight && barWnd.offsetLeft + barWnd.offsetWidth > tbWnd.offsetLeft &&
                 barWnd.offsetTop < tbBottom && barWnd.offsetTop + barWnd.offsetHeight > tbWnd.offsetTop) {
        barWnd.style.left = (tbRight + 6) + 'px';
    }
    const palette = createToolPalette({
        title:     'tools',
        storageId: 'tool_palette',
        left:      '1px',
        top:       (tbBottom + 4) + 'px',
        tools,
        onSelect:  (name) => host.setTool(name, true),
    });
    // the pattern's parts: under the tools and windows of its own
    const pattern = host.getPattern();
    const toolUI = pattern.createToolUI ? pattern.createToolUI({ paletteBottom: palette.bottom }) : null;
    palette.fit();

    // the bar shows the active tool: its name in the bar's title ('tool: Rectangle'),
    // its settings and its help
    host.addEventListener('toolChanged', (e) => {
        palette.setActive(e.name);
        const tool = host.getTool(e.name);
        bar.setName(tool ? (tool.label || tool.name) : e.name);
        bar.setControls(tool && tool.getProperties ? tool.getProperties() : []);
        bar.setHint(tool ? toolHint(tool) : '');
    });
    host.addEventListener('toolBarRefresh', () => bar.refresh());
    host.addEventListener('toolHintChanged', () => {
        const tool = host.getActiveTool();
        if (tool) bar.setHint(toolHint(tool));
    });
    host.addEventListener('toolStateChanged', () => {
        bar.refresh();
        if (toolUI && toolUI.refresh) toolUI.refresh();
    });

    // a key the tools left alone (the renderer saw it first) may pick a tool; Space is
    // the view's (a drag moves it while Space is held)
    window.addEventListener('keydown', (e) => {
        if (isTypingTarget(e.target) || e.isConsumed || e.repeat) return;
        if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey) return;
        const name = palette.toolForKey(e);
        if (!name) return;
        if (name !== host.getToolName()) host.setTool(name, true);
        e.isConsumed = true;
        e.preventDefault();
        host.refreshToolUI();
    });

    host.refreshToolUI();

    return {
        palette,
        bar,
        toolUI,
        // the windows menu's entries: the palette, the bar, the pattern's windows
        entries: () => [
            { label: 'Tools', title: 'the tool palette', window: palette.window },
            { label: 'Tool', title: 'the settings of the active tool, and its help', window: bar.window },
            ...(toolUI?.windows || []),
        ],
    };
}
