/*
  OverlaySymmetry.js — the symmetry an overlay item is drawn with: the
  renderer's group, or a finite index subgroup of it.

  The items drawn from group data (fundamental domain, tiling, generators, the
  folding of isolines and limit set) may use, instead of the renderer's group
  G, a subgroup H given by its coset table: the sublib string 'acb bca cab',
  one permutation per generator of G.  H is built with makeSubgroupGroup()
  from the renderer's transformed group (the group render() receives), packed
  into the item's own group sampler and set as uGroupData after renderUni, so
  the shaders need nothing new.  A table which does not give a usable group
  leaves the item on the renderer's group, with a warning.

  Serialized under the item's `symmetry` key:

     { type: 'renderer' | 'subgroup', maxIndex: 8, cosets: '' }

  The index and subgroup choices of the folder are a convenience over the
  table of subgroups sublib computes from the presentation of the current
  group (init par.getGroupPresentation: gens and relators, or the catalogue
  preset for a default domain); they are not serialized, `cosets` is.  Without
  a presentation the table stays empty and `cosets` is typed by hand.
*/

import {
    ParamGroup,
    ParamChoice,
    ParamString,
    ParamInt,
    DataPacking,
} from '../modules.js';
import { makeSubgroupGroup } from '../../grouplib/SubgroupDomain.js';
import { subgroupsData } from '../../sublib/src/sublib.js';

const MYNAME = 'OverlaySymmetry';
const DEBUG = false;

export const SYMMETRY_RENDERER = 'renderer';
export const SYMMETRY_SUBGROUP = 'subgroup';
export const SYMMETRY_TYPES = [SYMMETRY_RENDERER, SYMMETRY_SUBGROUP];

const SELECT = '[select]';
const DEFAULT_MAX_INDEX = 8;
const MAX_MAX_INDEX = 24;

/** defaults of the serialized config */
export function makeSymmetryConfig() {
    return { type: SYMMETRY_RENDERER, maxIndex: DEFAULT_MAX_INDEX, cosets: '' };
}

function normalizeCosets(str) {
    return (str || '').trim().split(/\s+/).filter(Boolean).join(' ');
}

/**
 * @param {object}   arg
 * @param {object}   arg.config      the item's config.symmetry object
 * @param {Function} arg.onChange    repaint request
 * @param {Function} arg.getInitPar  () => the init arguments of the item (null before init)
 * @param {Function} arg.getGLCtx    () => the GL context (null before init)
 */
export function makeOverlaySymmetry({ config, onChange, getInitPar, getGLCtx }) {

    let mParams   = null;
    let mSampler  = null;    // the item's group sampler
    let mGroup    = null;    // H, or null when the renderer's group is used
    let mLastG    = null;    // the renderer's group H was built from
    let mDirty    = true;    // H has to be rebuilt
    let mCheckConvex = true; // check the union of the coset cells on the next build (once per table)
    let mTable    = null;    // sublib result for the current presentation
    let mTableKey = null;
    let mIndexChoices    = [SELECT];
    let mSubgroupChoices = [SELECT];
    const mUI = { index: SELECT, subgroup: SELECT };   // transient choices

    // ── the table of subgroups ────────────────────────────────────────────────

    function presentation() {
        const ip = getInitPar();
        return (ip && ip.getGroupPresentation) ? ip.getGroupPresentation() : null;
    }

    function tableKey(pres) {
        if (!pres) return null;
        const maxIndex = Math.min(Math.max(1, config.maxIndex | 0), MAX_MAX_INDEX);
        if (pres.gens && pres.relators) return `${pres.gens} | ${pres.relators} | ${maxIndex}`;
        if (pres.preset)                return `${pres.preset} | ${maxIndex}`;
        return null;
    }

    /** compute the table for the current presentation when it changed; returns the table or null */
    function ensureTable() {
        const pres = presentation();
        const key  = tableKey(pres);
        if (key === mTableKey) return mTable;
        mTableKey = key;
        mTable    = null;
        if (key) {
            const maxIndex = Math.min(Math.max(1, config.maxIndex | 0), MAX_MAX_INDEX);
            try {
                const t0 = Date.now();
                mTable = (pres.gens && pres.relators)
                    ? subgroupsData({ name: pres.name, gens: pres.gens, relators: pres.relators, maxIndex })
                    : subgroupsData({ preset: pres.preset, maxIndex });
                if (DEBUG) console.log(`${MYNAME}: ${key} -> ${mTable.subgroups.length} subgroups in ${Date.now() - t0}ms`);
            } catch (e) {
                console.warn(`${MYNAME}: no subgroup table for ${key}: ${e.message}`);
            }
        }
        refreshChoices();
        return mTable;
    }

    function indexChoiceOf(index) {
        return mIndexChoices.find(c => c !== SELECT && parseInt(c, 10) === index) || SELECT;
    }

    function subgroupChoicesFor(indexChoice) {
        if (!mTable || indexChoice === SELECT) return [SELECT];
        const index = parseInt(indexChoice, 10);
        return [SELECT, ...mTable.subgroups.filter(s => s.index === index).map(s => String(s.subgroup))];
    }

    function findEntryByCosets() {
        if (!mTable) return null;
        const cosets = normalizeCosets(config.cosets);
        return cosets ? mTable.subgroups.find(s => normalizeCosets(s.cosets) === cosets) || null : null;
    }

    /** the choices follow the table and the current cosets */
    function refreshChoices() {
        mIndexChoices = [SELECT, ...(mTable ? mTable.countPerIndex.map(c => `${c.index}(${c.count})`) : [])];
        const entry = findEntryByCosets();
        mUI.index = entry ? indexChoiceOf(entry.index) : SELECT;
        mSubgroupChoices = subgroupChoicesFor(mUI.index);
        mUI.subgroup = entry ? String(entry.subgroup) : SELECT;
        if (mParams) {
            mParams.index.updateChoices(mIndexChoices);
            mParams.subgroup.updateChoices(mSubgroupChoices);
            mParams.index.updateDisplay();
            mParams.subgroup.updateDisplay();
        }
    }

    // ── param handlers ────────────────────────────────────────────────────────

    function onTypeChanged() {
        if (config.type === SYMMETRY_SUBGROUP) ensureTable();
        mDirty = true;
        onChange();
    }

    function onMaxIndexChanged() {
        mTableKey = null;
        if (config.type === SYMMETRY_SUBGROUP) ensureTable();
    }

    function onIndexChanged() {
        mSubgroupChoices = subgroupChoicesFor(mUI.index);
        if (mParams) mParams.subgroup.updateChoices(mSubgroupChoices);
        mUI.subgroup = mSubgroupChoices.find(c => c !== SELECT) || SELECT;
        if (mParams) mParams.subgroup.updateDisplay();
        applySubgroupChoice();
    }

    function onSubgroupChanged() {
        applySubgroupChoice();
    }

    /** the chosen subgroup of the table becomes the cosets */
    function applySubgroupChoice() {
        if (!mTable || mUI.subgroup === SELECT) return;
        const entry = mTable.subgroups.find(s => String(s.subgroup) === mUI.subgroup);
        if (!entry) return;
        setCosets(entry.cosets);
    }

    function onCosetsChanged() {
        setCosets(config.cosets);
    }

    function setCosets(cosets) {
        const norm = normalizeCosets(cosets);
        const changed = (norm !== normalizeCosets(config.cosets)) || mDirty === false;
        config.cosets = norm;
        if (mParams) mParams.cosets.updateDisplay();
        if (mTable) {
            const entry = findEntryByCosets();
            mUI.index    = entry ? indexChoiceOf(entry.index) : SELECT;
            mSubgroupChoices = subgroupChoicesFor(mUI.index);
            mUI.subgroup = entry ? String(entry.subgroup) : SELECT;
            if (mParams) {
                mParams.subgroup.updateChoices(mSubgroupChoices);
                mParams.index.updateDisplay();
                mParams.subgroup.updateDisplay();
            }
        }
        mDirty = true;
        mCheckConvex = true;
        if (changed) onChange();
    }

    // ── the subgroup as a group ───────────────────────────────────────────────

    /**
     * Build H from the renderer's (transformed) group and pack it into the sampler.
     * @param {object} group  the renderer's group
     */
    function rebuild(group) {
        mLastG = group;
        mDirty = false;
        mGroup = null;
        const cosets = normalizeCosets(config.cosets);
        if (!group || !cosets) return;
        try {
            mGroup = makeSubgroupGroup({ group, cosets, checkConvex: mCheckConvex });
            mCheckConvex = false;
        } catch (e) {
            console.warn(`${MYNAME}: no subgroup for cosets '${cosets}': ${e.message}`);
            mGroup = null;
        }
        const ctx = getGLCtx();
        if (mGroup && mSampler && ctx) DataPacking.packGroupToSampler(ctx.gl, mSampler, mGroup);
    }

    /**
     * Uniforms of the item's symmetry, set after renderUni: the item's own
     * group data when a subgroup is in use, nothing otherwise.
     * @param {object} par  the render arguments (par.group is the renderer's group)
     */
    function getUniforms(par) {
        if (config.type !== SYMMETRY_SUBGROUP) return {};
        const ctx = getGLCtx();
        if (!mSampler && ctx) mSampler = DataPacking.createGroupDataSampler(ctx.gl);
        if (mDirty || par.group !== mLastG) rebuild(par.group);
        return (mGroup && mSampler) ? { uGroupData: mSampler } : {};
    }

    /** the renderer's group changed: H is rebuilt on the next frame, the table follows the presentation */
    function onGroupChanged() {
        mDirty = true;
        if (config.type === SYMMETRY_SUBGROUP) ensureTable();
    }

    function init(par) {
        const ctx = getGLCtx();
        if (ctx && !mSampler) mSampler = DataPacking.createGroupDataSampler(ctx.gl);
        mDirty = true;
    }

    // ── params ────────────────────────────────────────────────────────────────

    function makeParams() {
        if (!mParams) {
            mParams = {
                type:     ParamChoice({ obj: config, key: 'type', choice: SYMMETRY_TYPES, onChange: onTypeChanged }),
                maxIndex: ParamInt({ obj: config, key: 'maxIndex', min: 1, max: MAX_MAX_INDEX, onChange: onMaxIndexChanged }),
                index:    ParamChoice({ obj: mUI, key: 'index', choice: mIndexChoices, serializable: false, onChange: onIndexChanged }),
                subgroup: ParamChoice({ obj: mUI, key: 'subgroup', choice: mSubgroupChoices, serializable: false, onChange: onSubgroupChanged }),
                cosets:   ParamString({ obj: config, key: 'cosets', onChange: onCosetsChanged }),
            };
        }
        return ParamGroup({ name: 'symmetry', params: mParams });
    }

    return {
        makeParams,
        init,
        getUniforms,
        onGroupChanged,
        rebuild,
        ensureTable,
        getGroup:    () => mGroup,
        getTable:    () => mTable,
        getChoices:  () => ({ index: mUI.index, subgroup: mUI.subgroup, indices: mIndexChoices.slice(), subgroups: mSubgroupChoices.slice() }),
        setIndex:    (choice) => { mUI.index = choice; onIndexChanged(); },
        setSubgroup: (choice) => { mUI.subgroup = choice; onSubgroupChanged(); },
        get usesSubgroup() { return config.type === SYMMETRY_SUBGROUP; },
    };
}
