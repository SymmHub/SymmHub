/**
 * Group_OrbifoldWP — thin GroupMaker adapter for WallPaperGroup_General.
 *
 * Wraps the orbifold-based wallpaper group in the standard GroupMaker
 * interface expected by GroupMakerFactory / SymRenderer:
 *
 *   constructor(opt)    opt.orbifold — initial orbifold string (default '*442')
 *   getClassName()      → 'Group_OrbifoldWP'
 *   setOptions({onChanged})
 *   getGroup()          → Group  (FD.s flattened to one sPlane per face)
 *   getParams()         → param map (ParamString for orbifold symbol)
 *   getCopy()           → new Group_OrbifoldWP
 *
 * NOTE — FD.s compatibility:
 *   WallPaperGroup_General produces FD.s as [[sPlane, …], …] (one array per
 *   face, possibly with extra bounding sPlanes).  Group.constructor expects a
 *   flat array of sPlanes.  This adapter takes FD.s[i][0] for each face, which
 *   gives correct geometry for single-bounded faces; multi-bounded faces lose
 *   their secondary walls (acceptable for a thin adapter).
 *
 * NOTE — dat.gui:
 *   WallPaperGroup_General normally builds its length/twist sliders via
 *   dat.gui.  This adapter stubs the gui so those sliders are not created;
 *   the underlying guiParams defaults (length=2, twist=0) are still used for
 *   the initial geometry computation.
 */

import {
    WallPaperGroup_General,
    TWISTMAXVALUE, TWISTMINVALUE, LENGTHMAXVALUE, LENGTHMINVALUE,
} from './WallPaperGroup_General.js';

import {
    Group,
    EventProcessor,
    ParamString,
} from './modules.js';

const MYNAME   = 'Group_Orbifold';
const DEBUG    = false;

// ── Mock dat.gui objects ──────────────────────────────────────────────────
// WallPaperGroup_General calls paramGui.addFolder(), addFolder.add(), etc.
// We supply no-op stubs so its updateTheGroup() can run without a real GUI.

function makeMockController() {
    const ctrl = {
        setValue:    () => ctrl,
        onChange:    () => ctrl,
        updateDisplay: () => ctrl,
    };
    return ctrl;
}

function makeMockFolder() {
    const folder = {
        add:          () => makeMockController(),
        addFolder:    () => makeMockFolder(),
        removeFolder: () => {},
        open:         () => {},
        close:        () => {},
        gpname:       makeMockController(),   // used in initGUI()
    };
    return folder;
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

        this.params = {
            orbifold: opt.orbifold || '*442',
        };

        // Internal WallPaperGroup_General instance.
        this._wg = new WallPaperGroup_General({
            symmetryUI:   symmetryUIStub,
            patternMaker: null,
        });

        // Wire the mock GUI so updateTheGroup() doesn't throw.
        const mockFolder = makeMockFolder();
        this._wg.paramGui        = mockFolder;
        this._wg.paramGuiFolder  = null;
        this._wg.guiParams       = { name: this.params.orbifold };

        // Compute initial group geometry.
        this._compute();

        this._mParams = this._makeParams();
    }

    // ── GroupMaker interface ──────────────────────────────────────────────

    getClassName() { return MYNAME; }

    setOptions(opt = {}) {
        if (opt.onChanged) {
            this._onChanged      = opt.onChanged;
            this._wg.onChanged   = opt.onChanged;
        }
    }

    /**
     * Returns a Group whose fundDomain is the first sPlane of each FD face.
     * Transforms are taken directly from the orbifold generators.
     */
    getGroup() {
        const fd = this._wg.FD;
        if (!fd) return null;

        // Flatten FD.s: take the primary sPlane from each face.
        const flatS = fd.s.map(face => face[0]);

        return new Group({ s: flatS, t: fd.t });
    }

    getParams()  { return this._mParams; }

    getCopy() {
        const copy = new Group_Orbifold({ orbifold: this.params.orbifold });
        return copy;
    }

    // ── Internal ──────────────────────────────────────────────────────────

    _compute() {
        this._wg.guiParams.name = this.params.orbifold;
        const ok = this._wg.updateTheGroup();
        if (ok) {
            this._wg.updateTheGroupGeometry();
            if (DEBUG) console.log(`${MYNAME}._compute() ok, FD:`, this._wg.FD);
        } else {
            if (DEBUG) console.warn(`${MYNAME}._compute() failed for '${this.params.orbifold}':`, this._wg.errorLog);
        }
    }

    _makeParams() {
        const opc = () => {
            this._compute();
            if (this._onChanged) this._onChanged();
        };
        return {
            orbifold: ParamString({
                obj:      this.params,
                key:      'orbifold',
                name:     'orbifold',
                onChange: opc,
            }),
        };
    }

} // class Group_Orbifold
