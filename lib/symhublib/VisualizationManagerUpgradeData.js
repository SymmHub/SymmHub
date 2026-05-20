import { VisualizationOptions } from './VisualizationOptions.js';

const MYNAME = 'VisualizationManager';
const DEBUG  = true;

const DataSourceNames = VisualizationOptions.dataSourceNames;

// Default mapping from old flat keys to layer class names.
// Each entry: { key: string, cls: string }.
// Callers may override via options.upgradeMapping.
export const defaultUpgradeMapping = [
    { key: 'colormap',  cls: 'VisualizationColormap' },
    { key: 'colormap2', cls: 'VisualizationColormap' },
    { key: 'texmap',    cls: 'VisualizationTexmap'   },
    { key: 'bumpmap',   cls: 'VisualizationBumpmap'  },
    { key: 'overlay',   cls: 'VisualizationOverlay'  },
];

// ── debug: layer-name integrity check ─────────────────────────────────────
//
// Reports three classes of name anomaly that appear after a corrupted load:
//
//  EMPTY    — getId() returns '' or null.  The layer has no id at all,
//             which causes indexedFolderName() to fall back to "N.ClassName".
//
//  INDEXED  — folder name looks like "1.VisualizationColormap".
//             This is the indexedFolderName() fallback and means getId() was
//             empty at the moment the folder was renamed (rename fired before
//             the id value was written, or the id was never restored).
//
//  ORPHAN   — name has a numeric suffix but lower-numbered siblings are
//             missing.  E.g. "colormap3" is present but neither "colormap"
//             nor "colormap2" exist.  This happens when makeUniqueName()
//             in VisualizationLayerFactory runs against a stale children list
//             that already contains entries from a previous load, so the
//             grow-phase assigns a collision-avoiding name instead of the
//             canonical one expected by the JSON.
//
export function checkLayerNames(tag, mParams, mLayerArray) {
    tag = tag || '';
    // Primary source: mParams.layers.getItems() — this is the array that
    // Phase 3 updates (mItems[i].obj = newObj).  mLayerArray.getChildren()
    // was previously used but is only updated by Phase 1/2 and replaceChild;
    // using getItems() gives the post-Phase-3 authoritative state.
    const paramItems = mParams ? mParams.layers.getItems() : null;
    if (!paramItems) {
        console.warn(`${MYNAME}.checkLayerNames(${tag}): mParams not yet initialized`);
        return [];
    }
    const layers = paramItems.map(it => it.obj);
    const ids    = layers.map(l => l.getId ? l.getId() : null);
    const label  = `${MYNAME}.checkLayerNames(${tag})`;
    const issues = [];

    ids.forEach((id, i) => {
        const cls = layers[i].getClassName ? layers[i].getClassName() : '?';

        // 1. Empty / missing id.
        if (!id) {
            issues.push({
                index: i,
                kind:  'EMPTY',
                id,
                cls,
                msg: `layer[${i}] (${cls}) has no id — folder will show as "${i+1}.${cls}"`,
            });
            return;
        }

        // 2. Indexed-fallback name:  /^\d+\./  — e.g. "1.VisualizationColormap"
        if (/^\d+\./.test(id)) {
            issues.push({
                index: i,
                kind:  'INDEXED',
                id,
                cls,
                msg: `layer[${i}] id looks like an indexed fallback: "${id}" (expected a plain name like "colormap")`,
            });
            return;
        }

        // 3. Orphaned suffix: id ends with a digit, but the lower-numbered
        //    siblings are absent.  E.g. "colormap3" with no "colormap".
        const suffixMatch = id.match(/^(.+?)(\d+)$/);
        if (suffixMatch) {
            const base   = suffixMatch[1];
            const suffix = parseInt(suffixMatch[2], 10);
            const missing = [];
            if (!ids.includes(base)) missing.push(base);
            for (let n = 2; n < suffix; n++) {
                if (!ids.includes(base + n)) missing.push(base + n);
            }
            if (missing.length > 0) {
                issues.push({
                    index: i,
                    kind:  'ORPHAN',
                    id,
                    cls,
                    msg: `layer[${i}] id "${id}" implies siblings [${missing.join(', ')}] which are absent`,
                });
            }
        }
    });

    // Cross-check: mLayerArray.getChildren() should match mParams.layers.getItems().
    // A mismatch means Phase 3 replaced an object in mItems without updating
    // mObjArray (the bug this session fixed via replaceChild).  Keep the check
    // in place to catch any future regressions.
    const rawIds = mLayerArray.getChildren().map(l => l.getId ? l.getId() : null);
    if (JSON.stringify(rawIds) !== JSON.stringify(ids)) {
        issues.push({
            index: -1,
            kind:  'SYNC',
            id:    null,
            cls:   null,
            msg:   `mLayerArray vs mParams.layers diverge!\n` +
                   `  mLayerArray ids: [${rawIds.join(', ')}]\n` +
                   `  mParams ids:     [${ids.join(', ')}]`,
        });
    }

    if (issues.length === 0) {
        console.log(`%c✓ ${label}: all ${ids.length} layer names are clean [${ids.join(', ')}]`,
                    'color:#4caf50');
    } else {
        console.group(`%c✗ ${label}: ${issues.length} issue(s) — layers: [${ids.join(', ')}]`,
                      'color:#e53935;font-weight:bold');
        issues.forEach(iss => {
            const style = iss.kind === 'EMPTY'   ? 'color:#ff5722' :
                          iss.kind === 'INDEXED' ? 'color:#ff9800' :
                          iss.kind === 'SYNC'    ? 'color:#2196f3' :
                                                   'color:#9c27b0';
            console.warn(`%c[${iss.kind}] ${iss.msg}`, style);
        });
        console.groupEnd();
    }

    return issues;  // caller can assert issues.length === 0 in tests
}

// ── upgrade paths ─────────────────────────────────────────────────────────

export function upgradeData(par, mUpgradeMapping) {
    if (par.renderStyle) par = upgradeData_v1(par);  // very old format
    if(DEBUG)console.log(`${MYNAME}.setParamsMap() after upgradeData_v1()`, JSON.parse(JSON.stringify(par)));
    if (!par.layers)     par = upgradeData_v2(par, mUpgradeMapping);  // old flat-key format → ObjArray
    return par;
}

// Convert very old format (renderStyle field) — pre-existing logic.
// Step C: guard against missing mandatory fields that would throw mid-upgrade.
function upgradeData_v1(par) {
    if (DEBUG) console.log(`${MYNAME}.upgradeData_v1() input:`, JSON.parse(JSON.stringify(par)));

    // Guard: log and return raw par if mandatory source fields are absent.
    // A crash here leaves mParams only partially applied, corrupting state.
    const missing = [
        !par.colormap && 'colormap',
        !par.texture  && 'texture',
        !par.bump     && 'bump',
    ].filter(Boolean);
    if (missing.length > 0) {
        console.error(
            `${MYNAME}.upgradeData_v1(): missing required field(s): [${missing.join(', ')}].`,
            'Skipping v1 upgrade — file will be passed to upgradeData_v2 as-is.',
            'Raw par:', JSON.parse(JSON.stringify(par)),
        );
        return par;  // fall through to upgradeData_v2
    }

    let newpar = {};
    let renderStyle = par.renderStyle;
    newpar.texmap  = par.texture;
    newpar.bumpmap = par.bump;
    newpar.colormap = par.colormap;
    newpar.colormap.enabled = false;
    newpar.bumpmap.enabled  = false;
    newpar.texmap.enabled   = false;

    let dataSource = DataSourceNames[0];
    switch (par.options?.visualComponent) {
        default: break;
        case 0: dataSource = 'u';        break;
        case 1: dataSource = 'v';        break;
        case 4: dataSource = 'mod(uv)';  break;
        case 5: dataSource = 'arg(uv)';  break;
    }

    if (par.overlayVis)  newpar.overlay = par.overlayVis;
    if (!par.overlay)    newpar.overlay = {};
    if (par.isolines)    newpar.overlay.isolines = par.isolines;

    if (newpar.colormap.transparency)
        newpar.colormap.opacity = 1 - newpar.colormap.transparency;

    let activePar = newpar.colormap;
    switch (renderStyle) {
        case 'bumpmap':  activePar = newpar.bumpmap;  break;
        case 'texture':  activePar = newpar.texmap;   break;
        case 'colormap': activePar = newpar.colormap; break;
    }
    activePar.enabled    = true;
    activePar.dataSource = dataSource;

    return newpar;
}

// Convert old flat-key format { imageColorSym:{...}, overlay:{...}, ... }
// to the new ObjArray envelope expected by ParamObjArray.setValue().
function upgradeData_v2(par, mUpgradeMapping) {
    const mappingKeys = mUpgradeMapping.map(m => m.key);
    const children = mUpgradeMapping
        .filter(({ key }) => par[key] !== undefined)
        .map(({ key, cls }) => {
            const raw = par[key];
            // par[key] may be a plain flat object (very old format) or already
            // ParamObj-serialized ({ className, params }) from the previous code.
            // Unwrap the inner params if present to avoid double-nesting.
            const flatParams = (raw && raw.params && typeof raw.params === 'object')
                ? raw.params
                : raw;
            return {
                className: cls,
                // Inject the id so it is restored as the folder name.
                params: { id: key, ...flatParams },
            };
        });

    // Step B: warn loudly when no mapping keys matched — the resulting empty
    // children array will cause ParamObjArray Phase 1 to wipe all live layers.
    if (DEBUG && children.length === 0) {
        const presentKeys = Object.keys(par).filter(k => !['renderStyle'].includes(k));
        console.error(
            `${MYNAME}.upgradeData_v2(): NO matching keys found in par!`,
            `\n  Mapping searches for: [${mappingKeys.join(', ')}]`,
            `\n  Par has:              [${presentKeys.join(', ')}]`,
            '\n  → children[] will be empty → ParamObjArray will WIPE all layers.',
            '\nRaw par:', JSON.parse(JSON.stringify(par)),
        );
    } else if (DEBUG) {
        console.log(
            `${MYNAME}.upgradeData_v2(): matched ${children.length} key(s):`,
            children.map(c => `${c.params.id} → ${c.className}`).join(', '),
        );
    }

    return {
        layers: {
            className: 'ObjArray',
            params: { id: 'layers', children },
        },
    };
}
