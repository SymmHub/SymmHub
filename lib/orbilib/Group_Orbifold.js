/**
 * Group_Orbifold — GroupMaker adapter for WallPaperGroup_General.
 *
 * UI strategy:
 *   ParamObj calls createUI(folder) with the real dat.gui folder.
 *   We wire it into WallPaperGroup_General so its existing rebuildGui() /
 *   updateTheGroup() creates the dynamic length-twist slider sub-folder.
 *
 * Serialization:
 *   getParamsMap() / setParamsMap() delegate to WallPaperGroup_General,
 *   which already handles orbifold name + all numeric params.
 */

import {
    WallPaperGroup_General,
    TWISTMAXVALUE, TWISTMINVALUE,
    LENGTHMAXVALUE, LENGTHMINVALUE,
} from './WallPaperGroup_General.js';

import { Group } from './modules.js';

const MYNAME = 'Group_Orbifold';
const DEBUG  = false;

// ── Minimal mock so constructor-time updateTheGroup() doesn't throw ────────

function makeMockController() {
    const c = { setValue: () => c, onChange: () => c, updateDisplay: () => c };
    return c;
}
function makeMockFolder() {
    const f = {
        add:          () => makeMockController(),
        addFolder:    () => makeMockFolder(),
        removeFolder: () => {},
        open:         () => {},
        close:        () => {},
        gpname:       makeMockController(),
    };
    return f;
}

// ── No-op symmetryUI stub ─────────────────────────────────────────────────

const symmetryUIStub = {
    init:        () => {},
    setShift:    () => {},
    render:      () => [],
    getUniforms: (u) => u,
    handleEvent: () => {},
};

// ── Adapter class ─────────────────────────────────────────────────────────

export class Group_Orbifold {

    constructor(opt = {}) {

        this._wg = new WallPaperGroup_General({
            symmetryUI:   symmetryUIStub,
            patternMaker: null,
        });

        // Use mock until createUI() wires in the real folder.
        this._wg.paramGui       = makeMockFolder();
        this._wg.paramGuiFolder = null;
        this._wg.guiParams      = { name: opt.orbifold || '*442' };

        this._compute();
    }

    // ── GroupMaker interface ──────────────────────────────────────────────

    getClassName() { return MYNAME; }

    setOptions(opt = {}) {
        if (opt.onChanged) {
            this._onChanged    = opt.onChanged;
            this._wg.onChanged = opt.onChanged;
        }
    }

    /**
     * Called by ParamObj when the UI panel is built (also on replaceObj).
     * Wires the real dat.gui folder into WallPaperGroup_General so that
     * updateTheGroup() → rebuildGui() creates real length/twist sliders.
     */
    createUI(folder) {
        this._wg.paramGui       = folder;
        this._wg.paramGuiFolder = null;

        // ── Remove any stale "Parameters for …" sub-folders left by a
        //    previous Group_Orbifold instance (happens on replaceObj).
        if (folder.__folders) {
            Object.keys(folder.__folders)
                .filter(k => k.startsWith('Parameters for'))
                .forEach(k => {
                    try { folder.removeFolder(folder.__folders[k]); } catch (_) {}
                    delete folder.__folders[k];
                });
        }

        // ── Add orbifold-name text controller (guard against duplicates).
        //    We keep track of our controller so gpname is always fresh.
        if (this._nameCtrl) {
            // Remove the previous controller row if possible.
            try {
                const idx = folder.__controllers?.indexOf(this._nameCtrl);
                if (idx >= 0) folder.__controllers.splice(idx, 1);
                this._nameCtrl.domElement?.closest('li')?.remove();
            } catch (_) {}
        }
        this._nameCtrl = folder
            .add(this._wg.guiParams, 'name')
            .name('orbifold symbol')
            .onChange(() => {
                this._wg.groupNameChanged(); // rebuilds sliders + geometry
                if (this._onChanged) this._onChanged();
            });
        this._wg.paramGui.gpname = this._nameCtrl;

        // ── Populate sub-folder with length/twist sliders.
        this._wg.updateTheGroup();

        if (DEBUG) console.log(`${MYNAME}.createUI() done`);
    }

    /**
     * Returns a Group whose fundDomain is the primary sPlane of each FD face.
     */
    getGroup() {
        const fd = this._wg.FD;
        if (!fd) return null;
        const flatS = fd.s.map(face => face[0]);
        return new Group({ s: flatS, t: fd.t });
    }

    // ── Serialization (used by ParamObj.getValue / .setValue) ────────────

    getParamsMap() {
        return this._wg.getParamsMap();
    }

    setParamsMap(paramsMap) {
        // WallPaperGroup_General.setParamsMap updates guiParams, calls
        // gpname.setValue, rebuildGui() and updateTheGroup() automatically.
        this._wg.setParamsMap(paramsMap);
    }

    getCopy() {
        const copy = new Group_Orbifold({ orbifold: this._wg.guiParams.name });
        // Copy current length/twist values into the copy's guiParams.
        Object.assign(copy._wg.guiParams, this._wg.getParamsMap());
        copy._compute();
        return copy;
    }

    // ── Internal ──────────────────────────────────────────────────────────

    _compute() {
        const ok = this._wg.updateTheGroup();
        if (ok) this._wg.updateTheGroupGeometry();
        else if (DEBUG) console.warn(`${MYNAME}._compute() failed:`, this._wg.errorLog);
    }

} // class Group_Orbifold
