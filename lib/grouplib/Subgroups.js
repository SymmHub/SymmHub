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
    presentationText,
    tableUpTo,
    checkPermutations,
    entryPermutations,
    NO_TABLE,
} from './modules.js';

const MYNAME = 'Subgroups';
const SELECT = '[select]';

//
//  The subgroups folder of a colour layer: a table of the subgroups of the group
//  drawn, to pick the layer's permutations from.
//
//  The table is the group's, one for all the layers (SubgroupTables.js): it is
//  calculated when the presentation changes, in a worker, and the layer hears of it
//  through onPresentationChanged(). The layer's max index only cuts it. While the table
//  is being calculated nothing is offered.
//
//  The layer's permutations are its own: it keeps them, typed or picked, a document
//  saves them, and neither a document load nor the table of a document's group touches
//  them. They are written when the user picks a subgroup and in two more cases:
//   - the group changed, and the catalogue name of the subgroup selected is in the new
//     table: the same colour group on another domain, the names survive that. So it
//     goes for permutations which would fit the new group as well, as another subgroup.
//     A sublib id does not count, in another group it is another subgroup;
//   - useOrbit changed, they do not fit and they are in the table: the other reading
//     of the subgroup (entryPermutations).
//  Permutations which came from outside, typed or in a document, wait for the next
//  table first: mPermsKey says which group the layer's permutations go with.
//
//  A document saves maxIndex and the name of the subgroup, the catalogue's G/H[n]#k
//  for a wallpaper group and the sublib id otherwise (SubgroupNames.js). Older
//  documents have groupType, groupName, fileName and index as well, which are not
//  read: the group is the one drawn.
//
//  The catalogue names of a table come later than the table, an index at a time, in a
//  worker (SubgroupNameJobs.js). Until they come a subgroup is listed and can be picked
//  under its sublib id, the first row says naming…, and what needs a name waits for it:
//  a name selected stays selected, and the group is followed when it is known.
//
//  options:
//    getGroupTables()     the renderer's makeGroupTables(), or null
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
    // a table read from a file, which is the layer's own and fits any group:
    // {data, namer, pres: null, file}
    let mFile = null;
    // the group's table cut at the layer's max index: {info, maxIndex, data, namer, pres, key}
    let mOffer = null;
    // the info the panel shows, to leave it alone on most group changes
    let mShown = null;
    // the key of the group the layer's permutations go with, undefined until a table
    // of the group has come when they came from outside: a table is then only taken
    // note of, and they stay
    let mPermsKey;
    // a document is coming in: the table there is the one of the group before it
    let mWaiting = false;
    // a subgroup is being written to the layer: the chooser is right as it is
    let mApplying = false;
    // the subgroup selected before its name came, {info, entry}: mConfig.subgroup has
    // its sublib id until then, which means nothing in another table
    let mUnnamed = null;
    // takeTable() waits for a name
    let mTakeWaits = false;
    // the promises of names this panel waits for
    const mAwaited = new WeakSet();

    function groupTable() {
        const tables = options.getGroupTables ? options.getGroupTables() : null;
        return tables ? tables.current() : NO_TABLE;
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

    /** the table to pick from, cut at the max index, null when there is none */
    function tableOnOffer() {
        if (mFile) return mFile;
        if (mWaiting) return null;
        const info = groupTable();
        if (info.state !== 'ready') return null;
        if (!mOffer || mOffer.info !== info || mOffer.maxIndex !== mConfig.maxIndex) {
            mOffer = {
                info,
                maxIndex: mConfig.maxIndex,
                data:     tableUpTo(info.data, mConfig.maxIndex),
                namer:    info.namer,
                pres:     info.pres,
                key:      info.key,
            };
        }
        return mOffer;
    }

    /** what the first row says: {state, text}, the state being one of
     *  'none' (no presentation), 'calculating', 'failed', 'ready', 'file' */
    function tableStatus(info) {
        if (mFile) return { state: 'file', text: mFile.file };
        if (info.state === 'none') return { state: 'none', text: 'no presentation' };
        if (info.state === 'failed') return { state: 'failed', text: 'no table' };
        const table = tableOnOffer();
        if (!table) return { state: 'calculating', text: 'calculating…' };
        const data = table.data;
        const count = data.subgroups.length;
        const name = table.pres.name ? `${table.pres.name} · ` : '';
        let text = `${name}${count} to index ${data.maxIndex}`;
        if (data.stats && data.stats.aborted) text += ', stopped, may be incomplete';
        else if (data.nextIndex) text += `, more at ${data.nextIndex}`;
        if (mUI.index !== SELECT && !table.namer.hasNames(parseInt(mUI.index, 10))) text += ', naming…';
        return { state: 'ready', text };
    }

    function showStatus(info) {
        if (!mParams) return;
        const { state, text } = tableStatus(info);
        const row = mParams.status;
        const pres = info.pres;
        row.setName(text);
        row.setTitle([pres ? (pres.label || pres.name) : '', presentationText(pres), text, info.error]
            .filter(Boolean).join('\n'));
        row.setAttention(state === 'failed');
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
        const info = groupTable();
        mShown = info;
        showChoices();
        showStatus(info);
        showCheck(info.pres);
    }

    // ------------------------------------------------------------------ //
    //  The choosers
    // ------------------------------------------------------------------ //

    function subgroupName(entry) {
        return tableOnOffer().namer.nameOf(entry);
    }

    /** the names of the index are on their way: the panel comes back when they are here */
    function askNames(info, index) {
        const names = info.ensureNames(index);
        if (mAwaited.has(names)) return;
        mAwaited.add(names);
        names.then(onNames);
    }

    /** the subgroup selected, under its sublib id until the names of its index come */
    function select(entry) {
        const table = tableOnOffer();
        mConfig.subgroup = entry ? subgroupName(entry) : SELECT;
        mUnnamed = null;
        if (entry && !table.namer.hasNames(entry.index)) {
            mUnnamed = { info: table.info, entry };
            askNames(table.info, entry.index);
        }
    }

    /**
     * has the subgroup selected a name still to come? From the table it was selected in,
     * where it is known by its sublib id, or in this one, whose index has not been named
     */
    function nameComing(table) {
        if (mUnnamed) {
            const { info, entry } = mUnnamed;
            if (!info.namer.hasNames(entry.index)) {
                askNames(info, entry.index);
                return true;
            }
            mUnnamed = null;
            mConfig.subgroup = info.namer.nameOf(entry);
        }
        const index = table.namer.indexOfName(mConfig.subgroup);
        if (index === null || index > table.data.maxIndex || table.namer.hasNames(index)) return false;
        askNames(table.info, index);
        return true;
    }

    /** the entry listed under the name, or with the sublib id (older documents) */
    function findSubgroup(name) {
        const table = tableOnOffer();
        if (!table || !name || name === SELECT) return null;
        if (mUnnamed && mUnnamed.info !== table.info) return null;
        const entry = table.namer.entryByName(name);
        return (entry && !(Number(entry.index) > table.data.maxIndex)) ? entry : null;
    }

    /** the entry of the permutations: the same ones, or the same up to the numbering of the colours */
    function entryOfPermutations(perms) {
        const table = tableOnOffer();
        if (!table || !perms || !checkPermutations(null, perms).ok) return null;
        const first = table.data.subgroups[0];
        if (!first || wordsOf(perms) !== wordsOf(first.cosets)) return null;  // another count of generators
        try {
            return findByPermutations(table.data, perms) ||
                   findByPermutations(table.data, perms, { upToConjugacy: true });
        } catch (e) {
            return null;
        }
    }

    function indexChoices(data) {
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
        const table = tableOnOffer();
        if (!table || indexChoice === SELECT) return [SELECT];
        const index = parseInt(indexChoice, 10);
        const named = table.namer.hasNames(index);
        if (!named) askNames(table.info, index);
        const names = table.data.subgroups.filter(s => Number(s.index) === index).map(subgroupName);
        // catalogue names in their order: by type, then by ordinal
        if (named && table.namer.isCatalogue) names.sort(compareSubgroupNames);
        return [SELECT, ...names];
    }

    /** the choices from the table, or only the name selected when there is no table */
    function showChoices() {
        const table = tableOnOffer();
        if (table) {
            mIndexChoices = indexChoices(table.data);
            const coming = nameComing(table);
            const entry = findSubgroup(mConfig.subgroup);
            if (entry) {
                select(entry);
                mUI.index = indexChoiceOf(entry.index);
            } else if (coming) {
                const index = table.namer.indexOfName(mConfig.subgroup);
                mUI.index = (index === null) ? SELECT : indexChoiceOf(index);
            } else {
                select(null);
                if (!mIndexChoices.includes(mUI.index)) mUI.index = SELECT;
            }
            mSubgroupChoices = subgroupChoicesFor(mUI.index);
            if (!mSubgroupChoices.includes(mConfig.subgroup)) mSubgroupChoices.push(mConfig.subgroup);
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
        // without a table the list has only the name: there is nothing to apply
        const entry = findSubgroup(mConfig.subgroup);
        if (entry) applyEntry(entry);
        showStatus(groupTable());
        if (options.onChange) options.onChange();
    }

    /** the subgroup's permutations and colours go to the layer */
    function applyEntry(entry) {
        const layer = layerParams();
        if (!layer) return;
        const table = tableOnOffer();
        select(entry);
        mPermsKey = table.key;
        mApplying = true;
        try {
            layer.permutations.setValue(entryPermutations(table.pres, entry, useOrbit()));
            if (layer.count) layer.count.setValue(entry.index);
            if (layer.permIndex) layer.permIndex.setMax(entry.index - 1);
        } finally {
            mApplying = false;
        }
    }

    // ------------------------------------------------------------------ //
    //  The table comes
    // ------------------------------------------------------------------ //

    /**
     * the chooser follows the permutations; a subgroup of the group left behind is
     * written, when it is in the new table: see the head of the file
     */
    function takeTable() {
        const table = mFile ? null : tableOnOffer();
        if (!table) return;
        const changed = mPermsKey !== undefined && mPermsKey !== table.key;
        if (!changed) mPermsKey = table.key;
        mTakeWaits = nameComing(table);     // onNames() comes back here
        if (mTakeWaits) return;
        mPermsKey = table.key;
        const perms = currentPermutations();
        const found = entryOfPermutations(perms);
        const named = (table.namer.indexOfName(mConfig.subgroup) === null) ? null : findSubgroup(mConfig.subgroup);
        const entry = (changed && named) || found || named;
        select(entry);
        if (!entry || !changed) return;
        const same = found && found.subgroup === entry.subgroup;
        if (!same || !checkPermutations(table.pres, perms, useOrbit()).ok) applyEntry(entry);
    }

    /** names came: the chooser fills in, and what waited for them goes on */
    function onNames() {
        const perms = currentPermutations();
        if (mTakeWaits) takeTable();
        refresh();
        if (currentPermutations() !== perms && options.onChange) options.onChange();
    }

    /** the document is in: its group is the one drawn now */
    function endWaiting() {
        if (!mWaiting) return;
        mWaiting = false;
        takeTable();
        refresh();
    }

    // ------------------------------------------------------------------ //
    //  Commands
    // ------------------------------------------------------------------ //

    /** the table of the group once more, for all the layers */
    function recalculate() {
        const tables = options.getGroupTables ? options.getGroupTables() : null;
        if (tables) tables.recalculate();
        refresh();
    }

    /** back from a table of a file */
    function useGroupTable() {
        mFile = null;
        takeTable();
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
            mFile = { data, pres: null, file: file.name, namer: makeSubgroupNamer({ data, name: data.name }) };
            mUnnamed = null;
            const kept = entryOfPermutations(currentPermutations());
            const entry = kept || findSubgroup(mConfig.subgroup);
            select(entry);
            if (entry && !kept) applyEntry(entry);
            refresh();
            if (options.onChange) options.onChange();
        } catch (e) {
            console.error(`${MYNAME}: table of ${file.name}:`, e);
            await getPrompt().alert({ title: 'Load table', message: `${file.name}\n\n${e.message}` });
        }
    }

    async function copyPresentation() {
        const text = presentationText(groupTable().pres);
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
        const hasPresentation = groupTable().key !== null;
        const whenNone = 'This group has no presentation';
        return [
            {label: 'Load table…', action: loadTable,
             title: 'Read a table of subgroups from a JSON file, for a group with no presentation or a table made elsewhere'},
            ...(mFile ? [{label: 'Use the group\'s table', action: useGroupTable,
                          title: 'Back from the table of the file to the table of the group drawn'}] : []),
            {label: 'Copy presentation', disabled: !hasPresentation, action: copyPresentation,
             title: hasPresentation ? 'Copy the generators and relators of this group as text' : whenNone},
            {label: 'Recalculate', disabled: !hasPresentation, action: recalculate,
             title: hasPresentation ? 'Calculate the table again, for a table the clock stopped: a table comes by itself when the group changes'
                                    : whenNone},
        ];
    }

    // ------------------------------------------------------------------ //
    //  What the layer tells
    // ------------------------------------------------------------------ //

    /** the group changed. The table comes later, the permutations stay until then. */
    function onGroupChanged() {
        if (groupTable() !== mShown) refresh();
    }

    /** the message of SubgroupTables.js: the table of the group is ready, or there is none */
    function onPresentationChanged() {
        mWaiting = false;
        takeTable();
        refresh();
    }

    /** the layer's permutations changed: the chooser follows them */
    function onPermutationsChanged() {
        showCheck(groupTable().pres);
        if (mApplying) return;
        mPermsKey = undefined;
        mTakeWaits = false;
        select(entryOfPermutations(currentPermutations()));
        showChoices();
    }

    /** the max index only cuts the table */
    function onMaxIndexChanged() {
        takeTable();
        refresh();
        if (options.onChange) options.onChange();
    }

    /** the other reading of the subgroup when the layer's no longer fits */
    function mendReading() {
        const table = tableOnOffer();
        if (mFile || !table || mPermsKey === undefined) return;
        const perms = currentPermutations();
        if (checkPermutations(table.pres, perms, useOrbit()).ok) return;
        const entry = entryOfPermutations(perms);
        if (entry) {
            applyEntry(entry);
            if (options.onChange) options.onChange();
        }
    }

    /** what decides the fit changed, not the permutations (the layer's useOrbit) */
    function updateCheck() {
        showCheck(groupTable().pres);
        // a moment later: a document brings useOrbit, and what it brings stays
        queueMicrotask(mendReading);
    }

    // ------------------------------------------------------------------ //
    //  Params
    // ------------------------------------------------------------------ //

    function makeParams() {
        return {
            status:   ParamMenu({
                name:    'no table',
                status:  true,
                tooltip: 'Load a table, copy the presentation, recalculate',
                menu:    statusMenu,
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

    /**
     * a document's values. Its permutations stay, and the table of its group is only
     * taken note of; the group comes after the layers in a document, so the table
     * there now is not looked at until the whole of it is in.
     */
    function setParamsMap(params, initialize) {
        if (!params) return;
        if (initialize) {
            mFile = null;
            mPermsKey = undefined;
            mTakeWaits = false;
            mWaiting = true;
            queueMicrotask(endWaiting);
        }
        if (params.maxIndex !== undefined) mConfig.maxIndex = clampMaxIndex(params.maxIndex);
        else if (initialize) mConfig.maxIndex = DEFAULT_MAX_INDEX;
        if (params.subgroup !== undefined || initialize) mUnnamed = null;
        if (params.subgroup !== undefined) mConfig.subgroup = String(params.subgroup) || SELECT;
        else if (initialize) mConfig.subgroup = SELECT;
        if (mParams) mParams.maxIndex.updateDisplay();
        refresh();
    }

    return {
        getParams,
        setParamsMap,
        onGroupChanged,
        onPresentationChanged,
        onPermutationsChanged,
        updateCheck,
        recalculate,
        getTable:    () => {
            const table = tableOnOffer();
            return table ? table.data : null;
        },
        getStatus:   () => tableStatus(groupTable()),
        getChoices:  () => ({ index: mUI.index, subgroup: mConfig.subgroup,
                              indices: mIndexChoices.slice(), subgroups: mSubgroupChoices.slice() }),
        setIndex:    (choice) => { mUI.index = choice; onIndexChanged(); },
        setSubgroup: (choice) => { mConfig.subgroup = choice; onSubgroupChanged(); },
        getClassName: () => MYNAME,
        get enabled() { return true; },
    };
}

export { Subgroups };
