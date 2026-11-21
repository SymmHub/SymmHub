import {
    ParamBool,
    ParamObjArray,
    ObjArray,
    setParamValues,
    ConformalMapFactory,
    ConformalMapKinds,
    getConformalMapKind,
    packViewChain,
    viewChainRoom,
    VIEW_CHAIN_MAX_STEPS,
    VIEW_CHAIN_DATA_SIZE,
    BAND_DEFAULTS,
    PERIODIC_DEFAULTS,
    SCALE_DEFAULTS,
    RATIONAL_DEFAULTS,
} from './modules.js';

/*
  ProjectionTransform — the list of conformal transformations the picture is seen
  through (docs/conformal_transforms_plan.md, outside the repository): the
  navigator's param `projection`, the folder "transforms".

  The list (the param `maps`, a ParamObjArray as the visualization layers are)
  holds rows of the kinds of conformal/ConformalMapFactory.js: fixed points, band,
  periodic, scale, loxodromic, exponent, upper half plane, rational, power. Rows are
  added, removed, renamed and moved through the list; a kind may be in it more
  than once. A row has its switch (`enabled`); `enabled` here switches the whole.

  The rows are in the direct order: the first acts on the pattern first, the last
  is nearest the screen. The shaders go the other way, from a pixel to the world
  point it shows: they get the rows that are on from the last to the first
  (getChain), each as the steps of conformal/ConformalKinds.js, packed as
  uniforms for the loop of lib/shaders/projection_v2.glsl.mjs (getUniforms).
  The CPU runs the same steps (ViewChain.js). The navigation's Moebius transform,
  the sphere view and the canvas act after the list, at the screen's end.

  The list is part of the document and is saved as it is:

    { enabled: true,
      maps: { className: 'ObjArray', params: { id: 'maps', children: [
          { className: 'FixedPointTransform', params: { id: 'fixedPoints', enabled: true, word: 'ac', ... } },
          { className: 'ConformalBand',       params: { id: 'band', enabled: true, fraction: 1 } } ] } } }

  Before the list (until 2026-11-19) the maps were a fixed set, each under its own
  key (fpdMap, bandMap, periodicMap, scaleMap, expMap, loxMap, uhpMap, rationalMap,
  and logMap, which did nothing), applied in one order. A value of that shape is
  made a list when it is set (upgradeProjectionValue).
*/

const MYNAME = 'ProjectionTransform';

const DEBUG = false;

// the values of the fixed points map a user sets; its other values (the points,
// the translation, the rotation) are found again from the word and the group
const FIXED_POINTS_OWN = { showUI: false, animate: false, word: 'ac', orientation: 'none', basex: 0, basey: 0, loopTime: 5 };

// the defaults of the fixed maps by their old keys, to tell a map that was touched
const OLD_DEFAULTS = {
    fpdMap:      FIXED_POINTS_OWN,
    bandMap:     BAND_DEFAULTS,
    periodicMap: PERIODIC_DEFAULTS,
    scaleMap:    SCALE_DEFAULTS,
    rationalMap: RATIONAL_DEFAULTS,
};

// (a kind added after the list has no key of an old document)
const OLD_KEYS = ['logMap', 'sphereMap', ...ConformalMapKinds.map(k => k.oldKey).filter(Boolean)];

/** a value of the shape the fixed maps had: one of their keys in it, no list */
function isOldProjectionValue(value) {
    return !!value && typeof value === 'object' && !('maps' in value) && OLD_KEYS.some(k => k in value);
}

/**
 *  a projection value with the list: the value itself when it has one (or is
 *  no value of the fixed maps); else the list made of the fixed maps:
 *    - a map that is on becomes a row, in the order the fixed maps acted in
 *      (fixed points, band, periodic, scale, loxodromic, exponent, upper half
 *      plane, rational), so the picture is the same;
 *    - a map that is off but has values changed from the defaults becomes a row
 *      that is off, so no document loses values (the fixed points map by the
 *      values a user sets: its points are found again from its word);
 *    - logMap, which did nothing, goes; the switch of the whole stays.
 *  A key a map lacks is the row's default.
 *  @param {object} value  the params of a ProjectionTransform, as a document holds them
 */
export function upgradeProjectionValue(value) {
    if (!isOldProjectionValue(value)) return value;
    const children = [];
    for (const kind of ConformalMapKinds) {
        if (!kind.oldKey) continue;
        let v = value[kind.oldKey];
        if (!v || typeof v !== 'object') continue;
        if (v.params && typeof v.params === 'object') v = v.params;      // the fixed points map was an object with its class
        const defaults = OLD_DEFAULTS[kind.oldKey] || {};
        const changed = Object.keys(defaults).some(k => (k in v) && v[k] !== defaults[k]);
        if (!v.enabled && !changed) continue;
        children.push({ className: kind.name, params: { id: kind.baseId, ...v, enabled: !!v.enabled } });
    }
    const out = { maps: { className: 'ObjArray', params: { id: 'maps', children } } };
    if ('enabled' in value) out.enabled = value.enabled;
    return out;
}

//
//
//
export function ProjectionTransform(options = {}){

    if(DEBUG)console.log(`${MYNAME} ProjectionTransform() options: `, options);

    let mGroupMaker = options.groupMaker || null;
    let onChange = options.onChange || null;

    const mConfig = {
        enabled: true,
    };

    // ── listeners ─────────────────────────────────────────────────────────────

    const mListeners = new Set();
    const mOwnListeners = new Set();
    // inside a change the list makes itself, and inside a load
    let mOwn = 0;
    let mLoading = 0;

    //
    //  a change the list makes itself, no edit of the user: a value loaded, the
    //  group changed, what a row finds again from the group, the frame of an
    //  animated row. Those who keep the user's edits apart (the undo steps,
    //  TransformsUndo.js) are told before it starts and after it is done
    //  (addOwnListener); a change inside another is a part of it
    //
    function own(fn) {
        const outer = mOwn === 0;
        if (outer) for (const l of mOwnListeners) if (l.before) l.before();
        mOwn++;
        try {
            return fn();
        } finally {
            mOwn--;
            if (outer) {
                const info = { load: mLoading > 0 };
                for (const l of mOwnListeners) if (l.after) l.after(info);
            }
        }
    }

    /**
     * fn(info) is called after any change of the list: one of the rows' values,
     * the list itself (add, remove, move, rename), a value set as a whole.
     * info.system: the list's own change (a value loaded, the group changed), no
     * edit of the user; info.load: a value loaded (a document)
     */
    function addListener(fn) { mListeners.add(fn); }
    function removeListener(fn) { mListeners.delete(fn); }
    function notify() {
        const info = { system: mOwn > 0, load: mLoading > 0 };
        for (const fn of mListeners) fn(info);
    }

    /**
     * l.before() is called before a change the list makes itself, l.after(info)
     * when it is done (info.load: a value was loaded); the changes between the
     * two are the list's, whether its listeners heard of them or not
     * @param {{before?: function, after?: function}} l
     */
    function addOwnListener(l) { mOwnListeners.add(l); }
    function removeOwnListener(l) { mOwnListeners.delete(l); }

    function onParamChanged(p){
        if (onChange) onChange(p);
        notify();
    }

    // the next frame is asked for (an animated row), nothing of the list changed
    function onFrame(){
        if (onChange) onChange();
    }

    // ── the list ──────────────────────────────────────────────────────────────

    function getGroup(){
        return mGroupMaker ? mGroupMaker.getGroup() : null;
    }

    // what a row's init() gets: onChange for an edit of its values, own(fn) to
    // run a change it makes itself (found again from the group, a frame of its
    // animation), onFrame to ask for the next frame
    const mInitPar = { onChange: onParamChanged, own, onFrame, groupMaker: { getGroup } };

    const mFactory = ConformalMapFactory(() => mInitPar, () => mMapArray.getChildren());

    const mMapArray = ObjArray({ id: 'maps', children: [], factory: mFactory });
    // ParamObjArray needs obj[key] access
    const mMapHolder = { maps: mMapArray };

    const mParams = {
        enabled: ParamBool({ obj: mConfig, key: 'enabled', onChange: onParamChanged }),
        maps:    ParamObjArray({ obj: mMapHolder, key: 'maps', name: 'list', factory: mFactory, onChange: onParamChanged }),
    };

    /** the rows, the first acting on the pattern first */
    function getMaps(){
        return mMapArray.getChildren();
    }

    /** the kinds a new row can be: [{name, label}], name the class name */
    function getMapKinds(){
        return mFactory.getNames().map(name => ({ name, label: mFactory.getLabel(name) }));
    }

    //
    //  a value set as a whole (a document, a view kept before the list, an undo
    //  step): one of the shape of the fixed maps is made a list first. A document
    //  (initialize) without any maps has an empty list.
    //
    function setParamsMap(value, initialize = false){
        if (!value || typeof value !== 'object') return;
        value = upgradeProjectionValue(value);
        if (initialize && !('maps' in value))
            value = { ...value, maps: { className: 'ObjArray', params: { id: 'maps', children: [] } } };
        // a row of a kind this build has not is left out (the factory would make its default kind of it)
        const rows = value.maps && value.maps.params && value.maps.params.children;
        if (Array.isArray(rows) && rows.some(c => !c || !getConformalMapKind(c.className))) {
            const known = rows.filter(c => c && getConformalMapKind(c.className));
            console.warn(`${MYNAME}: ${rows.length - known.length} transformation(s) of an unknown kind left out:`,
                         rows.filter(c => !known.includes(c)).map(c => c && c.className));
            value = { ...value, maps: { ...value.maps, params: { ...value.maps.params, children: known } } };
        }
        mLoading++;
        try {
            own(() => setParamValues(mParams, value, initialize));
        } finally {
            mLoading--;
        }
    }

    // ── the chain ─────────────────────────────────────────────────────────────

    //
    //  the rows that act: those that are on, from the first, as far as the
    //  shader's loop has room (VIEW_CHAIN_MAX_STEPS steps, VIEW_CHAIN_DATA_SIZE
    //  vec4s of numbers); the rows on past that are told by getOverLimit().
    //  [{row, steps}], steps in the shaders' order
    //
    function activeRows(timestamp){
        const rows = [];
        const over = [];
        if (mConfig.enabled) {
            let steps = 0, data = 0;
            for (const row of getMaps()) {
                if (!row.enabled) continue;
                const s = row.getSteps() || [];
                const room = viewChainRoom(s);
                if (over.length || steps + room.steps > VIEW_CHAIN_MAX_STEPS || data + room.data > VIEW_CHAIN_DATA_SIZE) {
                    over.push(row);
                    continue;
                }
                steps += room.steps;
                data += room.data;
                rows.push({ row, steps: s });
            }
        }
        mOverLimit = over;
        return rows;
    }

    let mOverLimit = [];
    let mTimestamp = 0;

    /** the rows that are on but past the room of the shader's loop (in the last chain made) */
    function getOverLimit(){
        return mOverLimit.slice();
    }

    /**
     * the chain the shaders and the CPU apply to a point of the screen's side
     * (after the canvas, the sphere and the navigation's Moebius transform):
     * the steps of the rows that are on, from the last row to the first
     * (conformal/ConformalKinds.js); [] with the whole switched off
     * @param {number} [timestamp]  the frame's time (the animated rows); the last frame's without it
     */
    function getChain(timestamp){
        if (timestamp === undefined) timestamp = mTimestamp;
        const rows = activeRows(timestamp);
        const chain = [];
        for (let i = rows.length - 1; i >= 0; i--) chain.push(...rows[i].steps);
        return chain;
    }

    /**
     * the chain cut at a row, for what lives in a plane between two rows (the row's
     * own handles and marks, TransformHandles.js): the steps of the rows after it, the
     * ones nearer the screen, that act, in the shaders' order; with withRow its own
     * steps too (the plane on its pattern's side; the same plane while the row is off
     * or without room). A row that is not in the list: the whole chain
     * @param {object}  row
     * @param {boolean} [withRow]
     */
    function getChainAt(row, withRow = false, timestamp){
        if (timestamp === undefined) timestamp = mTimestamp;
        const all = getMaps();
        const k = all.indexOf(row);
        if (k < 0) return getChain(timestamp);
        const rows = activeRows(timestamp);
        const chain = [];
        for (let i = rows.length - 1; i >= 0; i--) {
            const at = all.indexOf(rows[i].row);
            if (at > k || (withRow && at === k)) chain.push(...rows[i].steps);
        }
        return chain;
    }

    //
    //  the uniforms of a frame at the time stamp: the rows that follow the time
    //  (an animated fixed points row) take their step of it first
    //
    function getUniforms(un, timestamp){

        if (timestamp !== undefined) {
            mTimestamp = timestamp;
            if (mConfig.enabled) for (const row of getMaps()) if (row.enabled && row.tick) row.tick(timestamp);
        }
        const packed = packViewChain(getChain(timestamp));
        un.uViewChainCount = packed.count;
        un.uViewChainStep = packed.steps;
        un.uViewChainData = packed.data;
        if(DEBUG) console.log(`${MYNAME}.getUniforms() returns `, un);
        return un;
    }

    function setGroupMaker(groupMaker){
        mGroupMaker = groupMaker;
    }

    /** the group the picture is folded by changed: the rows that depend on it (the fixed points) are told */
    function onGroupChanged(group){
        own(() => {
            for (const row of getMaps()) if (row.onGroupChanged) row.onGroupChanged(group);
        });
    }

    //
    //  true when no row acts, i.e. the shaders' makeProjection() leaves the point
    //  as the navigation's Moebius transform made it
    //
    function isIdentity(){
        return !mConfig.enabled || !getMaps().some(row => row.enabled);
    }

    return {
        getParams:      ()=> {return mParams},
        getClassName:   ()=> {return MYNAME},
        setParamsMap:   setParamsMap,
        getUniforms:    getUniforms,
        getChain:       getChain,
        getChainAt:     getChainAt,
        getMaps:        getMaps,
        getMapKinds:    getMapKinds,
        getOverLimit:   getOverLimit,
        setGroupMaker:  setGroupMaker,
        onGroupChanged: onGroupChanged,
        isIdentity:     isIdentity,
        addListener:    addListener,
        removeListener: removeListener,
        addOwnListener:    addOwnListener,
        removeOwnListener: removeOwnListener,
    };
}
