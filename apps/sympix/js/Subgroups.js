import {
    ParamChoice,
    ParamString,
    ParamFunc,
    ParamInt,
    openFile,
    subgroupsData,
} from './modules.js';

const DEBUG = true;
const MYNAME = 'Subgroups';
const SELECT = '[select]';

// Subgroups are enumerated on demand with sublib rather than loaded from the
// shipped color_groups tables.  The tables were produced by hand from GAP for
// one fixed presentation per group; computing them here keeps the subgroup data
// tied to the presentation actually in use, which matters as soon as a group can
// be given more than one fundamental domain.
//
// Verified against the shipped tables: all 17 wallpaper groups reproduce exactly
// (same counts, same coset strings); klm / *klm reproduce the same conjugacy
// classes, sometimes naming a class by a different representative.
//
// A colouring can use at most MAX_COLORS_COUNT (24) colours, so there is no
// point enumerating past index 24.
const DEFAULT_MAX_INDEX = 24;
const MAX_MAX_INDEX = 24;

/** sublib preset key for a (family, group name) pair from the manifests */
function presetKeyFor(family, name) {
    if (family === 'wallpaper') return 'wallpaper:' + name;
    if (family === 'klm')       return 'klm:' + name;
    if (family === '*klm')      return 'sklm:' + name;
    return null;
}

function Subgroups(options = {}) {
    const mConfig = {
        groupType: '',
        groupName: '',
        fileName: '',
        index: '',
        subgroup: '',
        maxIndex: DEFAULT_MAX_INDEX,
    };

    let mGroupTypes = [];
    let mGroupTypeChoices = [SELECT];
    let mGroupNames = [];
    let mGroupNameChoices = [SELECT];
    let mIndexChoices = [SELECT];
    let mSubgroupChoices = [SELECT];
    let mSubgroupsData = [];
    let mParams = null;
    // Selecting a subgroup normally pushes its permutations onto the parent
    // layer.  During a document restore that would clobber the permutations the
    // document itself carries, so the callback is suppressed for the duration.
    // (The old code got away with it by accident: it awaited a fetch, which let
    // the rest of the layer restore first.)
    let mRestoring = 0;
    // the presentation the tables were computed with, see presentationKey()
    let mPresentationKey = null;
    let mCustomLabel = null;

    const mInitPromise = loadGroupTypes();

    async function loadGroupTypes() {
        try {
            const url = 'color_groups/group_types.json';
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
            }
            const data = await response.json();
            mGroupTypes = data.types || [];
            mGroupTypeChoices = [SELECT, ...mGroupTypes.map(t => t.name)];
            if (mParams && mParams.groupType) {
                mParams.groupType.updateChoices(mGroupTypeChoices);
            }
        } catch (e) {
            console.error('Error loading group types:', e);
        }
    }

    async function onGroupTypeChanged(preferredGroupName) {
        const typeInfo = mGroupTypes.find(t => t.name === mConfig.groupType);
        if (!typeInfo) {
            mGroupNames = [];
            mGroupNameChoices = [SELECT];
            if (mParams && mParams.groupName) {
                mParams.groupName.updateChoices([SELECT]);
                mParams.groupName.setValue(SELECT);
            }
            mConfig.groupName = SELECT;
            return;
        }

        try {
            const url = 'color_groups/' + typeInfo.path;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
            }
            const data = await response.json();
            mGroupNames = data.groups || [];
            mGroupNameChoices = [SELECT, ...mGroupNames.map(g => g.name)];
            if (mParams && mParams.groupName) {
                mParams.groupName.updateChoices(mGroupNameChoices);
            }

            const activeGroupName = (preferredGroupName !== undefined && mGroupNameChoices.includes(preferredGroupName))
                ? preferredGroupName
                : (mGroupNameChoices.length > 0 ? mGroupNameChoices[0] : SELECT);

            mConfig.groupName = activeGroupName;
            if (mParams && mParams.groupName) {
                mParams.groupName.setValue(mConfig.groupName);
            }
            await onGroupNameChanged();
        } catch (e) {
            console.error('Error loading group manifest:', e);
        }
    }

    async function onGroupNameChanged(preferredSubgroup) {
        const typeInfo = mGroupTypes.find(t => t.name === mConfig.groupType);
        if (!typeInfo) return;
        const groupEntry = mGroupNames.find(g => g.name === mConfig.groupName);
        if (!groupEntry) return;

        const folder = typeInfo.path.substring(0, typeInfo.path.lastIndexOf('/'));
        const fileRelativePath = folder + '/' + groupEntry.file;

        const computed = computeSubgroups(mConfig.groupType, mConfig.groupName);
        if (computed) {
            parseSubgroupsData(computed, describeSource(mConfig.groupName), preferredSubgroup);
        } else {
            // no preset for this group: fall back to the shipped table
            await loadSubgroupFileByName(fileRelativePath, preferredSubgroup);
        }
        if (options.onChange) {
            options.onChange();
        }
    }

    function describeSource(name) {
        return (mCustomLabel || name) + '  (computed, index <= ' + mConfig.maxIndex + ')';
    }

    /**
     * Enumerate the subgroups of the named group with sublib.
     *
     * options.getPresentation, when supplied, wins over the catalogue preset:
     * it should return {gens, relators} for the group as currently presented.
     * That is the hook for fundamental-domain dependent presentations - a group
     * given a different domain has different pairing transforms, hence different
     * generators and relators, hence a different subgroup table.
     *
     * @returns {object|null} data in the color_groups shape, or null if the
     *                        group is not in sublib's catalogue
     */
    function computeSubgroups(family, name) {
        const maxIndex = Math.min(mConfig.maxIndex || DEFAULT_MAX_INDEX, MAX_MAX_INDEX);
        try {
            const custom = options.getPresentation && options.getPresentation();
            mPresentationKey = presentationKey(custom);
            mCustomLabel = (custom && custom.label) ? custom.label : null;
            if (custom && custom.gens && custom.relators) {
                const t0 = Date.now();
                const data = subgroupsData({ name: custom.name || name, gens: custom.gens,
                                             relators: custom.relators, maxIndex });
                if (DEBUG) console.log(MYNAME + ': ' + (mCustomLabel || name) + ' <' + custom.gens + ' | ' + custom.relators + '>' +
                                       ' -> ' + data.subgroups.length + ' subgroups to index ' + maxIndex + ' in ' + (Date.now()-t0) + 'ms');
                return data;
            }
            const preset = presetKeyFor(family, name);
            if (!preset) return null;
            const t0 = Date.now();
            const data = subgroupsData({ preset, maxIndex });
            if (DEBUG) console.log(`${MYNAME}: ${preset} -> ${data.subgroups.length}` +
                                   ` subgroups to index ${maxIndex} in ${Date.now()-t0}ms`);
            return data;
        } catch (e) {
            console.warn(`${MYNAME}.computeSubgroups(${family}, ${name}):`, e.message);
            return null;
        }
    }

    function onSubgroupChanged() {
        const subgroupData = mSubgroupsData.find(s => String(s.subgroup) === mConfig.subgroup);
        if (options.onSubgroupSelected && mRestoring === 0) {
            options.onSubgroupSelected(subgroupData || null);
        }
    }

    function getActualIndex(displayIndex) {
        if (!displayIndex || displayIndex === SELECT) return '';
        const idx = displayIndex.indexOf('(');
        return idx !== -1 ? displayIndex.substring(0, idx) : displayIndex;
    }

    function normalizePerms(str) {
        if (!str) return '';
        return str.trim().split(/\s+/).join(' ');
    }

    function onIndexChanged(preferredSubgroup) {
        const actualIndex = getActualIndex(mConfig.index);
        if (actualIndex === '') {
            mSubgroupChoices = [SELECT];
            if (mParams && mParams.subgroup) {
                mParams.subgroup.updateChoices(mSubgroupChoices);
            }
            mConfig.subgroup = SELECT;
            if (mParams && mParams.subgroup) {
                mParams.subgroup.setValue(SELECT);
            }
            onSubgroupChanged();
            return;
        }

        const subgroupsWithIndex = mSubgroupsData.filter(s => String(s.index) === actualIndex);
        mSubgroupChoices = [SELECT, ...subgroupsWithIndex.map(s => String(s.subgroup))];
        if (mParams && mParams.subgroup) {
            mParams.subgroup.updateChoices(mSubgroupChoices);
        }
        const firstValidSubgroup = mSubgroupChoices.find(s => s !== SELECT) || SELECT;
        const activeSubgroup = (preferredSubgroup !== undefined && mSubgroupChoices.includes(preferredSubgroup))
            ? preferredSubgroup
            : firstValidSubgroup;

        mConfig.subgroup = activeSubgroup;
        if (mParams && mParams.subgroup) {
            mParams.subgroup.setValue(mConfig.subgroup);
        }
        onSubgroupChanged();
    }

    async function loadSubgroupFileByName(name, preferredSubgroup) {
        try {
            const url = 'color_groups/' + name;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
            }
            const data = await response.json();
            parseSubgroupsData(data, name, preferredSubgroup);
        } catch (e) {
            console.error('Error auto-loading subgroup file:', e);
        }
    }

    function parseSubgroupsData(data, name, preferredSubgroup) {
        mConfig.fileName = name;
        if (mParams && mParams.fileName) {
            mParams.fileName.setValue(name);
        }

        if (data && Array.isArray(data.subgroups)) {
            mSubgroupsData = data.subgroups;
        } else if (Array.isArray(data)) {
            mSubgroupsData = data;
        } else {
            mSubgroupsData = [];
        }

        if (data && Array.isArray(data.countPerIndex)) {
            mIndexChoices = [SELECT, ...data.countPerIndex.map(item => `${item.index}(${item.count})`)];
        } else {
            const counts = {};
            mSubgroupsData.forEach(s => {
                counts[s.index] = (counts[s.index] || 0) + 1;
            });
            const indices = Object.keys(counts).map(Number).sort((a, b) => a - b);
            mIndexChoices = [SELECT, ...indices.map(idx => `${idx}(${counts[idx]})`)];
        }

        if (mParams && mParams.index) {
            mParams.index.updateChoices(mIndexChoices);
        }

        // Prioritize matching by permutations string if parent visualizer provides it
        let matchedSubgroup = null;
        if (options.getParentPermutations) {
            const parentPerms = normalizePerms(options.getParentPermutations());
            if (parentPerms) {
                matchedSubgroup = mSubgroupsData.find(s => normalizePerms(s.invcos) === parentPerms);
            }
        }

        if (matchedSubgroup) {
            preferredSubgroup = String(matchedSubgroup.subgroup);
        }

        if (preferredSubgroup === '' || preferredSubgroup === SELECT) {
            mConfig.index = SELECT;
            mConfig.subgroup = SELECT;
            mSubgroupChoices = [SELECT];
            if (mParams && mParams.index) {
                mParams.index.setValue(SELECT);
            }
            if (mParams && mParams.subgroup) {
                mParams.subgroup.updateChoices(mSubgroupChoices);
                mParams.subgroup.setValue(SELECT);
            }
            return;
        }

        const prefSub = mSubgroupsData.find(s => String(s.subgroup) === preferredSubgroup);
        const preferredIdxVal = prefSub ? String(prefSub.index) : '';
        const firstValidIndexChoice = mIndexChoices.find(c => c !== SELECT) || SELECT;
        const preferredIndexChoice = mIndexChoices.find(c => getActualIndex(c) === preferredIdxVal)
            || firstValidIndexChoice;

        mConfig.index = preferredIndexChoice;
        if (mParams && mParams.index) {
            mParams.index.setValue(mConfig.index);
        }

        onIndexChanged(preferredSubgroup);
    }

    async function loadSubgroupFile() {
        const file = await openFile([{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]);
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            mConfig.groupType = SELECT;
            mConfig.groupName = SELECT;
            if (mParams && mParams.groupType) mParams.groupType.setValue(SELECT);
            if (mParams && mParams.groupName) mParams.groupName.setValue(SELECT);
            parseSubgroupsData(data, file.name);
            if (options.onChange) {
                options.onChange();
            }
        } catch (e) {
            console.error('Error parsing subgroups file:', e);
            alert('Failed to load subgroups file: ' + e.message);
        }
    }

    /** identifies the presentation the tables are computed with */
    function presentationKey(custom) {
        return (custom && custom.gens && custom.relators)
            ? custom.gens + ' | ' + custom.relators
            : 'catalogue';
    }

    /**
     * The renderer's group changed.  Another fundamental domain of the same
     * group has other generators, so tables computed for the previous
     * presentation no longer apply: recompute them when the presentation
     * differs, keeping the selected subgroup when it still exists.
     */
    function onGroupChanged() {
        if (!options.getPresentation) return;
        if (mRestoring > 0) return;
        if (!mConfig.groupType || mConfig.groupType === SELECT) return;
        if (!mConfig.groupName || mConfig.groupName === SELECT) return;
        if (presentationKey(options.getPresentation()) === mPresentationKey) return;
        onGroupNameChanged(mConfig.subgroup);
    }

    function makeParams() {
        return {
            load:      ParamFunc({ name: 'Load Subgroups', func: loadSubgroupFile }),
            groupType: ParamChoice({ obj: mConfig, key: 'groupType', choice: mGroupTypeChoices, name: 'Type', onChange: () => { onGroupTypeChanged(); } }),
            groupName: ParamChoice({ obj: mConfig, key: 'groupName', choice: mGroupNameChoices, name: 'Group', onChange: () => { onGroupNameChanged(); } }),
            fileName:  ParamString({ obj: mConfig, key: 'fileName', readOnly: true, name: 'File Name' }),
            maxIndex:  ParamInt({ obj: mConfig, key: 'maxIndex', min: 1, max: MAX_MAX_INDEX, step: 1, name: 'Max Index', onChange: () => { onGroupNameChanged(mConfig.subgroup); } }),
            index:     ParamChoice({ obj: mConfig, key: 'index', choice: mIndexChoices, name: 'Index', onChange: () => { onIndexChanged(); if (options.onChange) options.onChange(); } }),
            subgroup:  ParamChoice({ obj: mConfig, key: 'subgroup', choice: mSubgroupChoices, name: 'Subgroup', onChange: () => { onSubgroupChanged(); if (options.onChange) options.onChange(); } }),
        };
    }

    function getParams() {
        if (!mParams) {
            mParams = makeParams();
        }
        return mParams;
    }

    async function setParamsMap(params, initialize) {
        if (!params) return;

        mRestoring++;
        try {
            await _setParamsMap(params, initialize);
        } finally {
            mRestoring--;
        }
    }

    async function _setParamsMap(params, initialize) {

        // Wait for group types to finish loading
        await mInitPromise;

        let targetGroupType = params.groupType !== undefined ? params.groupType : (initialize ? SELECT : mConfig.groupType);
        let targetGroupName = params.groupName !== undefined ? params.groupName : (initialize ? SELECT : mConfig.groupName);
        let targetFileName = params.fileName !== undefined ? params.fileName : (initialize ? '' : mConfig.fileName);
        const targetIndexVal = params.index !== undefined ? getActualIndex(String(params.index)) : (initialize ? '' : getActualIndex(mConfig.index));
        let targetSubgroup = params.subgroup !== undefined ? String(params.subgroup) : (initialize ? '' : mConfig.subgroup);
        if (targetSubgroup === SELECT) targetSubgroup = '';

        // restore the enumeration depth first: the table is computed from it
        if (params.maxIndex !== undefined) {
            mConfig.maxIndex = Math.min(Number(params.maxIndex) || DEFAULT_MAX_INDEX, MAX_MAX_INDEX);
            if (mParams && mParams.maxIndex) mParams.maxIndex.setValue(mConfig.maxIndex);
        }

        if (targetGroupType === '') targetGroupType = SELECT;
        if (targetGroupName === '') targetGroupName = SELECT;

        // Deduce groupType and groupName from fileName if they are missing
        if ((!targetGroupType || targetGroupType === SELECT) && targetFileName) {
            const parts = targetFileName.split('/');
            const folder = parts[parts.length - 2];
            if (folder === 'klm') {
                targetGroupType = 'klm';
            } else if (folder === 'sklm') {
                targetGroupType = '*klm';
            }
        }

        if (targetGroupType && targetGroupType !== SELECT) {
            mConfig.groupType = targetGroupType;
            if (mParams && mParams.groupType) {
                mParams.groupType.setValue(targetGroupType);
            }

            // Load the corresponding groups manifest
            const typeInfo = mGroupTypes.find(t => t.name === targetGroupType);
            if (typeInfo) {
                try {
                    const url = 'color_groups/' + typeInfo.path;
                    const response = await fetch(url);
                    if (response.ok) {
                        const data = await response.json();
                        mGroupNames = data.groups || [];
                        mGroupNameChoices = [SELECT, ...mGroupNames.map(g => g.name)];
                        if (mParams && mParams.groupName) {
                            mParams.groupName.updateChoices(mGroupNameChoices);
                        }

                        // Deduce groupName from fileName if missing
                        if ((!targetGroupName || targetGroupName === SELECT) && targetFileName) {
                            const fileOnly = targetFileName.split('/').pop();
                            const matchingGroup = mGroupNames.find(g => g.file === fileOnly);
                            if (matchingGroup) {
                                targetGroupName = matchingGroup.name;
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error loading group manifest in setParamsMap:', e);
                }
            }

            if (targetGroupName && targetGroupName !== SELECT) {
                mConfig.groupName = targetGroupName;
                if (mParams && mParams.groupName) {
                    mParams.groupName.setValue(targetGroupName);
                }

                const groupEntry = mGroupNames.find(g => g.name === targetGroupName);
                if (groupEntry && typeInfo) {
                    const computed = computeSubgroups(targetGroupType, targetGroupName);
                    if (computed) {
                        parseSubgroupsData(computed, describeSource(targetGroupName), targetSubgroup);
                    } else {
                        const folder = typeInfo.path.substring(0, typeInfo.path.lastIndexOf('/'));
                        await loadSubgroupFileByName(folder + '/' + groupEntry.file, targetSubgroup);
                    }
                }
            }
        } else if (targetFileName) {
            mConfig.groupType = SELECT;
            mConfig.groupName = SELECT;
            if (mParams && mParams.groupType) mParams.groupType.setValue(SELECT);
            if (mParams && mParams.groupName) mParams.groupName.setValue(SELECT);
            await loadSubgroupFileByName(targetFileName, targetSubgroup);
        } else {
            mConfig.groupType = SELECT;
            mConfig.groupName = SELECT;
            mConfig.fileName = '';
            mConfig.index = SELECT;
            mConfig.subgroup = SELECT;
            if (mParams && mParams.groupType) mParams.groupType.setValue(SELECT);
            if (mParams && mParams.groupName) mParams.groupName.setValue(SELECT);
            if (mParams && mParams.fileName) mParams.fileName.setValue('');
            mSubgroupsData = [];
            mIndexChoices = [SELECT];
            mSubgroupChoices = [SELECT];
            if (mParams && mParams.index) {
                mParams.index.updateChoices(mIndexChoices);
                mParams.index.setValue(SELECT);
            }
            if (mParams && mParams.subgroup) {
                mParams.subgroup.updateChoices(mSubgroupChoices);
                mParams.subgroup.setValue(SELECT);
            }
        }

        // Apply final index / subgroup choices if they are different
        const currentActualIndex = getActualIndex(mConfig.index);
        if (targetIndexVal && targetIndexVal !== currentActualIndex) {
            const targetIndexChoice = mIndexChoices.find(c => getActualIndex(c) === targetIndexVal) || SELECT;
            mConfig.index = targetIndexChoice;
            if (mParams && mParams.index) {
                mParams.index.setValue(targetIndexChoice);
            }
            onIndexChanged(targetSubgroup || SELECT);
        } else if (targetSubgroup && targetSubgroup !== mConfig.subgroup) {
            mConfig.subgroup = targetSubgroup;
            if (mParams && mParams.subgroup) {
                mParams.subgroup.setValue(targetSubgroup);
            }
            onSubgroupChanged();
        }
    }

    return {
        getParams,
        setParamsMap,
        onGroupChanged,
        getClassName: () => MYNAME,
        get enabled() { return true; }
    };
}

export { Subgroups };
