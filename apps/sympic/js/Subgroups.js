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
        fileName: '',
        subgroup: '',
    };

    let mChoices = [];
    let mSubgroupsData = [];
    let mParams = null;

    function onSubgroupChanged() {
        const subgroupData = mSubgroupsData.find(s => String(s.subgroup) === mConfig.subgroup);
        if (options.onSubgroupSelected) {
            options.onSubgroupSelected(subgroupData || null);
        }
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

        const newChoices = mSubgroupsData.map(s => String(s.subgroup));
        mChoices = newChoices;

        if (mParams && mParams.subgroup) {
            mParams.subgroup.updateChoices(mChoices);
        }

        const activeSubgroup = (preferredSubgroup !== undefined && mChoices.includes(preferredSubgroup))
            ? preferredSubgroup
            : (mChoices.length > 0 ? mChoices[0] : '');

        mConfig.subgroup = activeSubgroup;
        if (mParams && mParams.subgroup) {
            mParams.subgroup.setValue(mConfig.subgroup);
        }
        onSubgroupChanged();
    }

    async function loadSubgroupFile() {
        const file = await openFile([{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]);
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
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
            fileName: ParamString({ obj: mConfig, key: 'fileName', readOnly: true, name: 'File Name' }),
            subgroup: ParamChoice({ obj: mConfig, key: 'subgroup', choice: mChoices, name: 'Subgroup', onChange: () => { onSubgroupChanged(); if (options.onChange) options.onChange(); } }),
            load:     ParamFunc({ name: 'Load Subgroups', func: loadSubgroupFile })
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
        let targetSubgroup = params.subgroup !== undefined ? String(params.subgroup) : mConfig.subgroup;
        if (params.fileName) {
            mConfig.fileName = params.fileName;
            if (mParams && mParams.fileName) {
                mParams.fileName.setValue(params.fileName);
            }
            await loadSubgroupFileByName(params.fileName, targetSubgroup);
        }
        if (targetSubgroup !== undefined) {
            mConfig.subgroup = targetSubgroup;
            if (mParams && mParams.subgroup) {
                mParams.subgroup.setValue(mConfig.subgroup);
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
