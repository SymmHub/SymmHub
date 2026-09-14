/**
 * OrbifoldMenu.js
 *
 * The settings-panel layout for sympix_orbifold, forked out of the shared
 * default (lib/uilib/param.js createParamUI() driven by SymRenderer's
 * makeParams()) so this one app's menu can be reorganized without touching
 * the other ten sympix apps, which keep using the shared default.
 *
 * This is a LAYOUT fork only. Every Param object it lays out still comes
 * from SymRenderer.getParams() — same objects that back serialization,
 * presets, and scripting — so nothing about get/set/save/load changes here,
 * only where each control appears and how it's grouped.
 *
 * In particular: the orbifold group's own dynamic sub-UI (the length/twist
 * sliders that get rebuilt when the orbifold symbol changes — see
 * Group_Orbifold.createUI() / WallPaperGroup_General.rebuildGui()) manages
 * itself once handed a dat.gui folder. It doesn't care where in the tree
 * that folder sits, so it keeps working unmodified no matter how this file
 * rearranges everything else — just call params.symmetry.group.createUI(...)
 * somewhere, as below.
 *
 * Currently reproduces the shared default order/nesting 1:1 (files, display,
 * recording, pattern, visualization, misc, symmetry, tools, scripting, test)
 * as a verified-inert starting point. Reorganize from here.
 *
 * IMPORTANT — every param reachable from `params` here (every entry currently
 * laid out below, at any depth) is expected to keep behaving correctly even
 * though only some of them may end up with a control in this menu — presets,
 * serialization, and scripting all still read/write the underlying Param
 * objects regardless of whether this file calls .createUI() on them. Not
 * calling .createUI() on a param is not automatically safe:
 *   - Simply omitting a p.createUI(gui) call for an entry is fine BY ITSELF —
 *     the Param object still exists, still holds its value, and getValue()/
 *     setValue() are unaffected (they don't require a live control).
 *   - BUT: if you hide a whole subtree that something else depends on having
 *     a *live* dat.gui folder — e.g. params.symmetry.group, which
 *     Group_Orbifold/WallPaperGroup_General wires its own dynamic length/
 *     twist sliders into via createUI(folder) — check what happens when that
 *     createUI() is never called. (Group_Orbifold currently falls back to a
 *     harmless mock folder until createUI() is called, so today this
 *     particular case is safe — but re-verify this if that fallback ever
 *     changes, and check the same question for any other param with side
 *     effects in its own createUI().)
 *   - If you ever DO need a removed param to behave differently (e.g. force
 *     a specific default rather than whatever value it was last set to),
 *     add that explicitly here or on the Param's own object — don't assume
 *     removing it from the layout alone changes its value.
 */
export function buildOrbifoldMenu(gui, params) {
    for (const key of Object.keys(params)) {
        const p = params[key];
        if (p && typeof p.createUI === 'function') p.createUI(gui);
    }
}
