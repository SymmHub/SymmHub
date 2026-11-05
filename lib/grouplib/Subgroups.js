import {
    ParamChoice,
    ParamInt,
    ParamMenu,
    openFile,
    createPromptDialog,
    writeClipboardText,
    findByPermutations,
    makeSubgroupNamer,
    compareSubgroupNames,
    DEFAULT_MAX_INDEX,
    MAX_MAX_INDEX,
    clampMaxIndex,
    presentationKey,
    presentationText,
    subgroupTable,
    checkPermutations,
    entryPermutations,
} from './modules.js';

const MYNAME = 'Subgroups';
const SELECT = '[select]';

//
//  The subgroups folder of a colour layer: a table of the subgroups of the group
//  drawn, to pick the layer's permutations from.
//
//  The group comes with its presentation (options.getPresentation, a group maker's
//  getPresentation(), see SubgroupTable.js), and the table is calculated from it when
//  the user asks and only then: not when a document loads and not when the group
//  changes. A table of another presentation or max index stays, but its subgroups
//  are not offered, as they do not fit; it is good again when the presentation
//  comes back.
//
//  The layer's permutations are its own: it keeps them, typed or picked, a document
//  saves them, and neither a change of the group nor a document load touches them.
//  They are written only when the user picks a subgroup, and by Recalculate when the
//  subgroup selected is in the new table under its name and the permutations are
//  not (the same colour group after a change of the domain: the catalogue names
//  survive it), or are there and do not fit. Whether they fit the group is said by a
//  mark on their row.
//
//  A document saves maxIndex and the name of the subgroup, the catalogue's G/H[n]#k
//  for a wallpaper group and the sublib id otherwise (SubgroupNames.js). Older
//  documents have groupType, groupName, fileName and index as well, which are not
//  read: the group is the one drawn.
//
//  options:
//    getPresentation()    the presentation of the group drawn, or null
//    getLayerParams()     the layer's params {permutations, permIndex, useOrbit, count}
//    onChange()           the layer has to be repainted
//

// one dialog for all the layers
let sPrompt = null;
function getPrompt() {
    if (!sPrompt) sPrompt = createPromptDialog();
    return sPrompt;
}

const wordsOf = (str) => String(str).trim().split(/\s+/).length;

function Subgroups(options = {}) {

    const mConfig = {
        maxIndex: DEFAULT_MAX_INDEX,
        subgroup: SELECT,           // the name of the subgroup selected
    };
    const mUI = { index: SELECT };  // only a way to the subgroup, not saved

    let mParams = null;
    let mIndexChoices = [SELECT];
    let mSubgroupChoices = [SELECT];
    // the table, null until the user asks for one:
    // {data, namer, pres, presKey, maxIndex, file}, file for a table read from a file
    let mTable = null;
    // the presentation key the panel shows, to leave it alone on most group changes
    let mShownKey;
    // a subgroup is being written to the layer: the chooser is right as it is
    let mApplying = false;

    function presentation() {
        return options.getPresentation ? options.getPresentation() : null;
    }

    function layerParams() {
        return options.getLayerParams ? options.getLayerParams() : null;
    }

    function useOrbit() {
        const layer = layerParams();
        return !!(layer && layer.useOrbit && layer.useOrbit.getValue());
    }

    function currentPermutations() {
        const layer = layerParams();
        return layer ? layer.permutations.getValue() : '';
    }

    // ------------------------------------------------------------------ //
    //  The state of the table
    // ------------------------------------------------------------------ //

    /** can the subgroups of the table be offered for the group with this key? */
    function tableFits(key) {
        if (!mTable) return false;
        return !!mTable.file || (mTable.presKey === key && mTable.maxIndex === mConfig.maxIndex);
    }

    /** what the first row says: {state, text}, the state being one of
     *  'none' (no presentation), 'empty' (no table), 'changed', 'fits', 'file' */
    function tableStatus(pres, key) {
        if (mTable && mTable.file) return { state: 'file', text: mTable.file };
        if (key === null) return { state: 'none', text: 'no presentation' };
        if (!mTable) return { state: 'empty', text: 'no table' };
        if (mTable.presKey !== key) return { state: 'changed', text: 'group changed' };
        if (mTable.maxIndex !== mConfig.maxIndex) return { state: 'changed', text: 'max index changed' };
        const data = mTable.data;
        const count = data.subgroups.length;
        const name = pres.name ? `${pres.name} · ` : '';
        if (data.stats && data.stats.aborted) {
            return { state: 'fits', text: `${name}${count} to index ${data.maxIndex}, stopped, may be incomplete` };
        }
        if (data.nextIndex) {
            return { state: 'fits', text: `${name}${count} to index ${data.maxIndex}, more at ${data.nextIndex}` };
        }
        return { state: 'fits', text: `${name}${count} to index ${mTable.maxIndex}` };
    }

    function showStatus(pres, key) {
        if (!mParams) return;
        const { state, text } = tableStatus(pres, key);
        const row = mParams.status;
        row.setName(text);
        row.setTitle([pres ? (pres.label || pres.name) : '', presentationText(pres), text].filter(Boolean).join('\n'));
        row.setAttention(state === 'empty' || state === 'changed');
        row.setActionEnabled(key !== null);
    }

    /** the mark on the row of the layer's permutations */
    function showCheck(pres) {
        const layer = layerParams();
        if (!layer || !layer.permutations.setMark) return;
        const result = checkPermutations(pres, layer.permutations.getValue(), useOrbit());
        layer.permutations.setMark(result.ok ? null : result.reason);
    }

    /** the panel from the state */
    function refresh() {
        const pres = presentation();
        const key = presentationKey(pres);
        mShownKey = key;
        showStatus(pres, key);
        showChoices(key);
        showCheck(pres);
    }

    // ------------------------------------------------------------------ //
    //  The choosers
    // ------------------------------------------------------------------ //

    function subgroupName(entry) {
        return mTable.namer.nameOf(entry);
    }

    /** the entry listed under the name, or with the sublib id (older documents) */
    function findSubgroup(name) {
        if (!mTable || !name || name === SELECT) return null;
        return mTable.namer.entryByName(name) || null;
    }

    /** the entry of the permutations: the same ones, or the same up to the numbering of the colours */
    function entryOfPermutations(perms) {
        if (!mTable || !perms || !checkPermutations(null, perms).ok) return null;
        const first = mTable.data.subgroups[0];
        if (!first || wordsOf(perms) !== wordsOf(first.cosets)) return null;  // another count of generators
        try {
            return findByPermutations(mTable.data, perms) ||
                   findByPermutations(mTable.data, perms, { upToConjugacy: true });
        } catch (e) {
            return null;
        }
    }

    function indexChoices() {
        const data = mTable.data;
        if (Array.isArray(data.countPerIndex)) {
            return [SELECT, ...data.countPerIndex.map(c => `${c.index}(${c.count})`)];
        }
        const counts = new Map();
        for (const s of data.subgroups) counts.set(Number(s.index), (counts.get(Number(s.index)) || 0) + 1);
        return [SELECT, ...[...counts.keys()].sort((a, b) => a - b).map(i => `${i}(${counts.get(i)})`)];
    }

    function indexChoiceOf(index) {
        return mIndexChoices.find(c => c !== SELECT && parseInt(c, 10) === Number(index)) || SELECT;
    }

    function subgroupChoicesFor(indexChoice) {
        if (!mTable || indexChoice === SELECT) return [SELECT];
        const index = parseInt(indexChoice, 10);
        const names = mTable.data.subgroups.filter(s => Number(s.index) === index).map(subgroupName);
        // catalogue names in their order: by type, then by ordinal
        if (mTable.namer.isCatalogue) names.sort(compareSubgroupNames);
        return [SELECT, ...names];
    }

    /** the choices from the table, or only the name selected when the table does not fit */
    function showChoices(key) {
        if (tableFits(key)) {
            mIndexChoices = indexChoices();
            const entry = findSubgroup(mConfig.subgroup);
            if (entry) {
                mConfig.subgroup = subgroupName(entry);
                mUI.index = indexChoiceOf(entry.index);
            } else {
                mConfig.subgroup = SELECT;
                if (!mIndexChoices.includes(mUI.index)) mUI.index = SELECT;
            }
            mSubgroupChoices = subgroupChoicesFor(mUI.index);
        } else {
            mIndexChoices = [SELECT];
            mUI.index = SELECT;
            mSubgroupChoices = (mConfig.subgroup === SELECT) ? [SELECT] : [SELECT, mConfig.subgroup];
        }
        if (mParams) {
            // the values are in the lists: updateChoices() would change them otherwise
            mParams.index.updateChoices(mIndexChoices);
            mParams.subgroup.updateChoices(mSubgroupChoices);
            mParams.index.updateDisplay();
            mParams.subgroup.updateDisplay();
        }
    }

    function onIndexChanged() {
        mSubgroupChoices = subgroupChoicesFor(mUI.index);
        mConfig.subgroup = mSubgroupChoices.find(c => c !== SELECT) || SELECT;
        if (mParams) {
            mParams.subgroup.updateChoices(mSubgroupChoices);
            mParams.subgroup.updateDisplay();
        }
        onSubgroupChanged();
    }

    function onSubgroupChanged() {
        // the list of a table which does not fit has only the name: there is nothing to apply
        const fits = tableFits(presentationKey(presentation()));
        const entry = fits ? findSubgroup(mConfig.subgroup) : null;
        if (entry) applyEntry(entry);
        if (options.onChange) options.onChange();
    }

    /** the subgroup's permutations and colours go to the layer */
    function applyEntry(entry) {
        const layer = layerParams();
        if (!layer) return;
        mApplying = true;
        try {
            layer.permutations.setValue(entryPermutations(mTable.pres, entry, useOrbit()));
            if (layer.count) layer.count.setValue(entry.index);
            if (layer.permIndex) layer.permIndex.setMax(entry.index - 1);
        } finally {
            mApplying = false;
        }
    }

    // ------------------------------------------------------------------ //
    //  Commands
    // ------------------------------------------------------------------ //

    /**
     * the subgroup selected in a new table: the one of the layer's permutations, which
     * stay, else the one of that name, whose permutations go to the layer, else none.
     * The layer's can be in the table and not fit: the other reading of the same
     * subgroup after useOrbit changed (entryPermutations). Then the table's replace them.
     */
    function selectInTable(name) {
        const perms = currentPermutations();
        const kept = entryOfPermutations(perms);
        const entry = kept || findSubgroup(name);
        mConfig.subgroup = entry ? subgroupName(entry) : SELECT;
        if (entry && (!kept || !checkPermutations(mTable.pres, perms, useOrbit()).ok)) applyEntry(entry);
    }

    /** the table of the group drawn, the command of the first row */
    function recalculate() {
        const pres = presentation();
        const key = presentationKey(pres);
        if (key === null) return;
        const name = mConfig.subgroup;
        let data = null;
        try {
            data = subgroupTable(pres, { maxIndex: mConfig.maxIndex });
        } catch (e) {
            console.warn(`${MYNAME}: no table for ${presentationText(pres)}: ${e.message}`);
        }
        mTable = !data ? null : {
            data,
            pres,
            presKey:  key,
            maxIndex: mConfig.maxIndex,
            file:     null,
            namer:    makeSubgroupNamer({ data, presentation: pres, family: pres.family }),
        };
        if (mTable) selectInTable(name);
        refresh();
        if (options.onChange) options.onChange();
    }

    /** a table from a file, in the shape of a subgroupsData() result */
    async function loadTable() {
        const file = await openFile([{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]);
        if (!file) return;
        try {
            const parsed = JSON.parse(await file.text());
            const data = Array.isArray(parsed) ? { subgroups: parsed } : parsed;
            if (!Array.isArray(data.subgroups)) throw new Error('The file has no subgroups.');
            mTable = {
                data,
                pres:     null,
                presKey:  null,
                maxIndex: null,
                file:     file.name,
                namer:    makeSubgroupNamer({ data, name: data.name }),
            };
            selectInTable(mConfig.subgroup);
            refresh();
            if (options.onChange) options.onChange();
        } catch (e) {
            console.error(`${MYNAME}: table of ${file.name}:`, e);
            await getPrompt().alert({ title: 'Load table', message: `${file.name}\n\n${e.message}` });
        }
    }

    async function copyPresentation() {
        const text = presentationText(presentation());
        if (await writeClipboardText(text)) {
            mParams?.status.flash();
            return;
        }
        // this page may not use the clipboard: show the text selected, to copy by hand
        await getPrompt().prompt({
            title:   'Copy presentation',
            label:   'Presentation:',
            value:   text,
            okLabel: 'Close',
            message: 'The browser did not let this page use the clipboard. Press Ctrl+C to copy the text.',
        });
    }

    function statusMenu() {
        const hasPresentation = presentationKey(presentation()) !== null;
        return [
            {label: 'Load table…', action: loadTable,
             title: 'Read a table of subgroups from a JSON file, for a group with no presentation or a table made elsewhere'},
            {label: 'Copy presentation', disabled: !hasPresentation, action: copyPresentation,
             title: hasPresentation ? 'Copy the generators and relators of this group as text'
                                    : 'This group has no presentation'},
        ];
    }

    // ------------------------------------------------------------------ //
    //  What the layer tells
    // ------------------------------------------------------------------ //

    /** the group changed. Nothing is calculated and the permutations stay. */
    function onGroupChanged() {
        if (presentationKey(presentation()) !== mShownKey) refresh();
    }

    /** the layer's permutations changed: the chooser follows them */
    function onPermutationsChanged() {
        const pres = presentation();
        showCheck(pres);
        if (mApplying) return;
        const key = presentationKey(pres);
        const entry = tableFits(key) ? entryOfPermutations(currentPermutations()) : null;
        mConfig.subgroup = entry ? subgroupName(entry) : SELECT;
        showChoices(key);
    }

    /** a table of another max index stays, and fits again when the value comes back */
    function onMaxIndexChanged() {
        refresh();
        if (options.onChange) options.onChange();
    }

    /** what decides the fit changed, not the permutations (the layer's useOrbit) */
    function updateCheck() {
        showCheck(presentation());
    }

    // ------------------------------------------------------------------ //
    //  Params
    // ------------------------------------------------------------------ //

    function makeParams() {
        return {
            status:   ParamMenu({
                name:    'no table',
                tooltip: 'Load a table, copy the presentation',
                menu:    statusMenu,
                action:  { func: recalculate,
                           tooltip: 'Calculate the table of subgroups of this group. It is calculated only here: not when the group changes, not when a document opens' },
            }),
            maxIndex: ParamInt({ obj: mConfig, key: 'maxIndex', min: 1, max: MAX_MAX_INDEX, step: 1, name: 'Max Index', onChange: onMaxIndexChanged }),
            index:    ParamChoice({ obj: mUI, key: 'index', choice: mIndexChoices, name: 'Index', serializable: false, onChange: onIndexChanged }),
            subgroup: ParamChoice({ obj: mConfig, key: 'subgroup', choice: mSubgroupChoices, name: 'Subgroup', onChange: onSubgroupChanged }),
        };
    }

    function getParams() {
        if (!mParams) {
            mParams = makeParams();
            refresh();
        }
        return mParams;
    }

    /** a document's values. It starts without a table and its permutations stay. */
    function setParamsMap(params, initialize) {
        if (!params) return;
        if (initialize) mTable = null;
        if (params.maxIndex !== undefined) mConfig.maxIndex = clampMaxIndex(params.maxIndex);
        else if (initialize) mConfig.maxIndex = DEFAULT_MAX_INDEX;
        if (params.subgroup !== undefined) mConfig.subgroup = String(params.subgroup) || SELECT;
        else if (initialize) mConfig.subgroup = SELECT;
        if (mParams) mParams.maxIndex.updateDisplay();
        refresh();
    }

    return {
        getParams,
        setParamsMap,
        onGroupChanged,
        onPermutationsChanged,
        updateCheck,
        recalculate,
        getTable:    () => (mTable ? mTable.data : null),
        getStatus:   () => {
            const pres = presentation();
            return tableStatus(pres, presentationKey(pres));
        },
        getChoices:  () => ({ index: mUI.index, subgroup: mConfig.subgroup,
                              indices: mIndexChoices.slice(), subgroups: mSubgroupChoices.slice() }),
        setIndex:    (choice) => { mUI.index = choice; onIndexChanged(); },
        setSubgroup: (choice) => { mConfig.subgroup = choice; onSubgroupChanged(); },
        getClassName: () => MYNAME,
        get enabled() { return true; },
    };
}

export { Subgroups };
