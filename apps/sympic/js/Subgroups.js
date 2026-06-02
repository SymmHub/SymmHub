import {
    ParamChoice,
    ParamString,
    ParamFunc,
    openFile,
} from './modules.js';

const DEBUG = true;
const MYNAME = 'Subgroups';

function Subgroups(options = {}) {
    const mConfig = {
        groupType: '',
        groupName: '',
        fileName: '',
        index: '',
        subgroup: '',
    };

    let mGroupTypes = [];
    let mGroupTypeChoices = [''];
    let mGroupNames = [];
    let mGroupNameChoices = [''];
    let mIndexChoices = [];
    let mSubgroupChoices = [];
    let mSubgroupsData = [];
    let mParams = null;

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
            mGroupTypeChoices = ['', ...mGroupTypes.map(t => t.name)];
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
            mGroupNameChoices = [''];
            if (mParams && mParams.groupName) {
                mParams.groupName.updateChoices(['']);
                mParams.groupName.setValue('');
            }
            mConfig.groupName = '';
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
            mGroupNameChoices = ['', ...mGroupNames.map(g => g.name)];
            if (mParams && mParams.groupName) {
                mParams.groupName.updateChoices(mGroupNameChoices);
            }

            const activeGroupName = (preferredGroupName !== undefined && mGroupNameChoices.includes(preferredGroupName))
                ? preferredGroupName
                : (mGroupNameChoices.length > 0 ? mGroupNameChoices[0] : '');

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

        await loadSubgroupFileByName(fileRelativePath, preferredSubgroup);
        if (options.onChange) {
            options.onChange();
        }
    }

    function onSubgroupChanged() {
        const subgroupData = mSubgroupsData.find(s => String(s.subgroup) === mConfig.subgroup);
        if (options.onSubgroupSelected) {
            options.onSubgroupSelected(subgroupData || null);
        }
    }

    function getActualIndex(displayIndex) {
        if (!displayIndex) return '';
        const idx = displayIndex.indexOf('(');
        return idx !== -1 ? displayIndex.substring(0, idx) : displayIndex;
    }

    function onIndexChanged(preferredSubgroup) {
        const actualIndex = getActualIndex(mConfig.index);
        const subgroupsWithIndex = mSubgroupsData.filter(s => String(s.index) === actualIndex);
        mSubgroupChoices = subgroupsWithIndex.map(s => String(s.subgroup));
        if (mParams && mParams.subgroup) {
            mParams.subgroup.updateChoices(mSubgroupChoices);
        }
        const activeSubgroup = (preferredSubgroup !== undefined && mSubgroupChoices.includes(preferredSubgroup))
            ? preferredSubgroup
            : (mSubgroupChoices.length > 0 ? mSubgroupChoices[0] : '');

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
            mIndexChoices = data.countPerIndex.map(item => `${item.index}(${item.count})`);
        } else {
            const counts = {};
            mSubgroupsData.forEach(s => {
                counts[s.index] = (counts[s.index] || 0) + 1;
            });
            const indices = Object.keys(counts).map(Number).sort((a, b) => a - b);
            mIndexChoices = indices.map(idx => `${idx}(${counts[idx]})`);
        }

        if (mParams && mParams.index) {
            mParams.index.updateChoices(mIndexChoices);
        }

        const prefSub = mSubgroupsData.find(s => String(s.subgroup) === preferredSubgroup);
        const preferredIdxVal = prefSub ? String(prefSub.index) : '';
        const preferredIndexChoice = mIndexChoices.find(c => getActualIndex(c) === preferredIdxVal)
            || (mIndexChoices.length > 0 ? mIndexChoices[0] : '');

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
            mConfig.groupType = '';
            mConfig.groupName = '';
            if (mParams && mParams.groupType) mParams.groupType.setValue('');
            if (mParams && mParams.groupName) mParams.groupName.setValue('');
            parseSubgroupsData(data, file.name);
            if (options.onChange) {
                options.onChange();
            }
        } catch (e) {
            console.error('Error parsing subgroups file:', e);
            alert('Failed to load subgroups file: ' + e.message);
        }
    }

    function makeParams() {
        return {
            load:      ParamFunc({ name: 'Load Subgroups', func: loadSubgroupFile }),
            groupType: ParamChoice({ obj: mConfig, key: 'groupType', choice: mGroupTypeChoices, name: 'Type', onChange: () => { onGroupTypeChanged(); } }),
            groupName: ParamChoice({ obj: mConfig, key: 'groupName', choice: mGroupNameChoices, name: 'Group', onChange: () => { onGroupNameChanged(); } }),
            fileName:  ParamString({ obj: mConfig, key: 'fileName', readOnly: true, name: 'File Name' }),
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

        // Wait for group types to finish loading
        await mInitPromise;

        let targetGroupType = params.groupType !== undefined ? params.groupType : (initialize ? '' : mConfig.groupType);
        let targetGroupName = params.groupName !== undefined ? params.groupName : (initialize ? '' : mConfig.groupName);
        let targetFileName = params.fileName !== undefined ? params.fileName : (initialize ? '' : mConfig.fileName);
        const targetIndexVal = params.index !== undefined ? String(params.index) : (initialize ? '' : getActualIndex(mConfig.index));
        const targetSubgroup = params.subgroup !== undefined ? String(params.subgroup) : (initialize ? '' : mConfig.subgroup);
        const targetIndexChoice = mIndexChoices.find(c => getActualIndex(c) === targetIndexVal) || '';

        // Deduce groupType and groupName from fileName if they are missing
        if (!targetGroupType && targetFileName) {
            const parts = targetFileName.split('/');
            const folder = parts[parts.length - 2];
            if (folder === 'klm') {
                targetGroupType = 'klm';
            } else if (folder === 'sklm') {
                targetGroupType = '*klm';
            }
        }

        if (targetGroupType) {
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
                        mGroupNameChoices = ['', ...mGroupNames.map(g => g.name)];
                        if (mParams && mParams.groupName) {
                            mParams.groupName.updateChoices(mGroupNameChoices);
                        }

                        // Deduce groupName from fileName if missing
                        if (!targetGroupName && targetFileName) {
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

            if (targetGroupName) {
                mConfig.groupName = targetGroupName;
                if (mParams && mParams.groupName) {
                    mParams.groupName.setValue(targetGroupName);
                }

                const groupEntry = mGroupNames.find(g => g.name === targetGroupName);
                if (groupEntry && typeInfo) {
                    const folder = typeInfo.path.substring(0, typeInfo.path.lastIndexOf('/'));
                    const fileRelativePath = folder + '/' + groupEntry.file;
                    await loadSubgroupFileByName(fileRelativePath, targetSubgroup);
                }
            }
        } else if (targetFileName) {
            mConfig.groupType = '';
            mConfig.groupName = '';
            if (mParams && mParams.groupType) mParams.groupType.setValue('');
            if (mParams && mParams.groupName) mParams.groupName.setValue('');
            await loadSubgroupFileByName(targetFileName, targetSubgroup);
        } else {
            mConfig.groupType = '';
            mConfig.groupName = '';
            mConfig.fileName = '';
            if (mParams && mParams.groupType) mParams.groupType.setValue('');
            if (mParams && mParams.groupName) mParams.groupName.setValue('');
            if (mParams && mParams.fileName) mParams.fileName.setValue('');
            mSubgroupsData = [];
            mIndexChoices = [];
            mSubgroupChoices = [];
            if (mParams && mParams.index) mParams.index.updateChoices([]);
            if (mParams && mParams.subgroup) mParams.subgroup.updateChoices([]);
        }

        // Apply final index / subgroup choices if they are different
        const currentActualIndex = getActualIndex(mConfig.index);
        if (targetIndexVal !== undefined && targetIndexVal !== currentActualIndex) {
            mConfig.index = targetIndexChoice;
            if (mParams && mParams.index) {
                mParams.index.setValue(targetIndexChoice);
            }
            onIndexChanged(targetSubgroup);
        } else if (targetSubgroup !== undefined && targetSubgroup !== mConfig.subgroup) {
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
        getClassName: () => MYNAME,
        get enabled() { return true; }
    };
}

export { Subgroups };
