//
//  ToolboxPart.js: the toolbox of the UI builders (docs/symrenderer_refactor_plan.md
//  phase 4), uilib's createToolbox filled with the renderer's commands: the settings,
//  the files menu, the windows menu, run and restart, initialize, the pattern's own
//  commands, recording, export, full screen, and the tools' buttons. It follows the
//  host's events: the active tool pressed, run and stop, the recording, the buttons a
//  script loaded later asks for, the pattern's commands enabled
//
//  opt.skin          the images and the titles (ui/SymRendererSkin.js)
//  opt.settings      the settings window (SettingsWindow.js): its button shows it
//  opt.windowsMenu   () => the windows menu's items
//  opt.fileMenu      the documents' commands in a menu of their own
//  opt.documents     the documents' windows (DocumentWindows.js), for the files menu
//  opt.commands      the pattern's toolbox commands (pattern.getToolboxCommands)
//  opt.exportMenu    the image export and the pattern's exports in a menu (when the
//                    pattern has some), else the button exports the image
//  opt.toolButtons   a button per tool, the renderer's and the pattern's
//  opt.inWindow      false: no window, the builder places the row
//
import {
    createToolbox,
    showCommandMenu,
    fileMenuItems,
    exportMenuItems,
} from '../../modules.js';

// the renderer's tools with a toolbox button, in its order
const TOOL_BUTTONS = ['move', 'symmetry', 'patternTransform', 'draw', 'pick'];

export function createToolboxPart(host, opt = {}) {

    const skin = opt.skin;
    const labels = skin.labels;
    const images = skin.images;
    const pattern = host.getPattern();
    let box = null;
    const menuAt = (name, items) => showCommandMenu(host, { anchor: box.buttons[name] }, items);

    const runButtons = [
        { name: 'run',     title: labels.run,     src: images.run,     action: () => host.toggleRun() },
        { name: 'restart', title: labels.restart, src: images.restart, action: () => host.restart() },
    ];

    const specs = [];
    specs.push({ name: 'settings', title: labels.settings, src: images.settings, action: () => opt.settings.toggle() });
    if (opt.fileMenu) {
        specs.push({ name: 'file', title: labels.fileMenu, src: images.fileMenu,
                     action: () => menuAt('file', fileMenuItems(host, opt.documents)) });
    }
    // the windows and panels shown, hidden and brought to the top from one menu
    if (opt.windowsMenu) {
        specs.push({ name: 'windows', title: labels.windows, src: images.windows,
                     action: () => menuAt('windows', opt.windowsMenu()) });
    }
    // run and restart when the pattern or a script animates
    if (host.canAnimate()) specs.push(...runButtons);
    if (pattern.initSimulation) {
        specs.push({ name: 'init', title: labels.initialize, src: images.initialize, action: () => host.initSimulation() });
    }
    // the pattern's own commands (symdraw: undo, redo, the add menu)
    const commands = (opt.commands && pattern.getToolboxCommands) ? pattern.getToolboxCommands() : [];
    commands.forEach(cmd => specs.push({ name: cmd.name, title: cmd.title, src: cmd.icon, action: () => {
        if (cmd.items) { menuAt(cmd.name, cmd.items()); return; }
        cmd.action();
        host.refreshToolUI();
        host.scheduleRepaint();
    } }));
    if (opt.recording !== false) {
        specs.push({ name: 'recording', title: labels.recording, src: images.recordStart, action: () => host.toggleRecording() });
    }
    const exportMenu = !!(opt.exportMenu && pattern.getExportItems);
    specs.push({ name: 'download', title: exportMenu ? labels.exportMenu : labels.exportImage, src: images.download,
                 action: exportMenu ? () => menuAt('download', exportMenuItems(host)) : () => host.exportImage() });
    specs.push({ name: 'full_screen', title: labels.fullScreen, src: images.fullScreen, action: () => host.fullscreen() });

    // the tools' buttons, after a bar: the renderer's (taken up as a load would), then
    // the pattern's (taken up by the user)
    const toolNames = [];
    if (opt.toolButtons) {
        specs.push({ separator: true, src: images.separator });
        const tools = host.getTools();
        TOOL_BUTTONS.forEach(name => {
            if (!tools.some(t => t.name === name && t.owner === 'renderer')) return;
            specs.push({ name, title: labels[name], src: images[name], action: () => host.setTool(name) });
            toolNames.push(name);
        });
        tools.filter(t => t.owner === 'pattern').forEach(({ name, tool }) => {
            specs.push({ name, title: tool.title || tool.name, src: tool.icon || images.draw,
                         action: () => host.setTool(name, true) });
            toolNames.push(name);
        });
    }

    box = createToolbox({ buttons: specs, inWindow: opt.inWindow !== false });

    function showSettingsState() {
        box.setPressed('settings', opt.settings.isVisible());
    }
    opt.settings.onChange(showSettingsState);
    setTimeout(showSettingsState, 0);

    host.addEventListener('toolChanged', (e) => {
        toolNames.forEach(name => box.setPressed(name, name === e.name));
    });
    host.addEventListener('runChanged', (e) => {
        const run = box.buttons.run;
        if (!run) return;
        run.src = e.running ? images.stop : images.run;
        run.title = e.running ? labels.stop : labels.run;
    });
    host.addEventListener('recordingChanged', (e) => {
        const btn = box.buttons.recording;
        if (btn) btn.src = e.recording ? images.recordStop : images.recordStart;
    });
    // a script loaded later (Files > Open Script…): run and restart after the settings
    host.addEventListener('canAnimateChanged', () => {
        if (box.buttons.run || !host.canAnimate()) return;
        box.add(runButtons[0], { after: 'settings' });
        box.add(runButtons[1], { after: 'run' });
    });
    host.addEventListener('toolStateChanged', () => {
        commands.forEach(cmd => {
            const btn = box.buttons[cmd.name];
            if (btn && cmd.enabled) btn.disabled = !cmd.enabled();
        });
    });

    return box;
}
