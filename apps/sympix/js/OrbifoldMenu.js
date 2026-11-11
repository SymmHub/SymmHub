//
//  OrbifoldMenu.js - the settings panel of sympix_orbifold (SymRenderer's option
//  menuBuilder), forked from the shared layout (uilib createParamUI) so that this
//  page's menu can be reorganized without touching the other sympix pages.
//
//  Only the layout: every Param comes from SymRenderer.getParams(), the same objects
//  that save, load presets and serve scripts, whether or not a control is made for
//  them here. A param left out of the panel keeps its value and still saves. Check
//  params whose createUI does more than make a control: the orbifold group builds its
//  length and twist sliders into the folder it is given (WallPaperGroup_General
//  rebuildGui) and works on a stand-in folder until then.
//
//  For now the same order and nesting as the shared layout (by Chaim Goodman-Strauss,
//  branch sympix-orbifold2, 2026-09-14).
//
export function buildOrbifoldMenu(gui, params) {
    for (const key of Object.keys(params)) {
        const p = params[key];
        if (p && typeof p.createUI === 'function') p.createUI(gui);
    }
}
