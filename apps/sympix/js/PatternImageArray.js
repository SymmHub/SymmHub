import {
    EventDispatcher,
    makeMultiComponentPatternData,
    ObjArray,
    ObjectFactory,
    ParamObjArray,
    ParamString,
    ParamBool,
    ParamFloat,
    setParamValues,
    PatternImage,
    PatternImageCreator,
} from './modules.js';

const MYNAME = 'PatternImageArray';
const DEBUG = false;

// ─────────────────────────────────────────────────────────────────────────────
//  PatternImageArray
//
//  A pattern producer that owns an ordered collection of PatternImage
//  instances and packages them as a single-layer, multi-component PatternData.
//
//  options:
//    images : Array of image descriptors.  Each entry is forwarded to
//             PatternImage() as its construction options, plus a mandatory
//             'name' field that becomes the component name in the PatternData.
//
//             Example:
//               images: [
//                   { name: 'base',   /* ...PatternImage options... */ },
//                   { name: 'detail', /* ... */ },
//               ]
//
// ─────────────────────────────────────────────────────────────────────────────
function PatternImageArray(options = {}) {

    const mEventDispatcher = new EventDispatcher();

    const mPatternFactory = ObjectFactory({
        infoArray: [
            { name: 'PatternImage', creator: PatternImage },
        ],
        defaultName: 'PatternImage',
    });

    let mConfig = {
        id: 'imgarray',
        active: true,
        transparency: 0,
        images: ObjArray({
            children: [
                PatternImage(),
                PatternImage(),
            ],
        }),
    }
    let mParams  = null;
    let mGLCtx   = null;

    // Factory wrapper: initializes and subscribes each newly created child.
    // Built lazily in init() once the GL context is available.
    let mInitializingFactory = null;

    function makeInitializingFactory(glContext) {
        return {
            getNames:         mPatternFactory.getNames,
            getDefaultName:   mPatternFactory.getDefaultName,
            getDefaultObject: mPatternFactory.getDefaultObject,
            class2name:       mPatternFactory.class2name,
            getObject: (name) => {
                const image = mPatternFactory.getObject(name);
                image.init(glContext);
                applyPlacement(image);
                image.addEventListener('imageChanged', onImageChanged);
                return image;
            },
        };
    }

    // ── event interface ──────────────────────────────────────────────────────

    function addEventListener(evtType, listener) {
        if (DEBUG) console.log(`${MYNAME}.addEventListener()`, evtType);
        mEventDispatcher.addEventListener(evtType, listener);
    }

    function informListeners() {
        mEventDispatcher.dispatchEvent({ type: 'imageChanged', target: myself });
    }

    function onImageChanged() {
        informListeners();
    }

    // ── lifecycle ────────────────────────────────────────────────────────────

    function init(glContext) {

        if (DEBUG) console.log(`${MYNAME}.init()`, glContext);

        mGLCtx = glContext;
        mInitializingFactory = makeInitializingFactory(glContext);

        // Initialize every child PatternImage with the GL context
        // and subscribe to its changes so we can propagate them upward.
        mConfig.images.getChildren().forEach(image => {
            image.init(glContext);
            image.addEventListener('imageChanged', onImageChanged);
        });

        mParams = makeParams();

    }

    // ── group propagation ─────────────────────────────────────────────────────

    function setGroup(group) {
        if (DEBUG) console.log(`${MYNAME}.setGroup()`, group);
        mConfig.images.getChildren().forEach(image => image.setGroup(group));
        informListeners();
    }

    // Geometric placement, forwarded to each child: the curvature of the plane
    // the images are placed in and the pattern transform relating buffer
    // coordinates to world. A null curvature restores flat
    // (Euclidean-similarity) placement. Children created later pick the
    // current setting up in makeInitializingFactory().
    let mCurvature = null;
    let mPatternTransform = null;

    function setPlacement(k, patternTransform) {
        mCurvature = (typeof k === 'number' && isFinite(k)) ? k : null;
        mPatternTransform = patternTransform || null;
        mConfig.images.getChildren().forEach(applyPlacement);
        informListeners();
    }

    function applyPlacement(image) {
        if (image.setPlacement) image.setPlacement(mCurvature, mPatternTransform);
    }

    // ── params ────────────────────────────────────────────────────────────────
    //
    //  Each PatternImage's params are nested under its component name.

    function onParamChanged() {
        informListeners();
    }

    function makeParams() {
            return {
            id:             ParamString({ obj: mConfig, key: 'id', onChange: onParamChanged }),
            active:         ParamBool({ obj: mConfig, key: 'active', onChange: onParamChanged }),
            transparency:   ParamFloat({ obj: mConfig, key: 'transparency', onChange: onParamChanged }),
            images:         ParamObjArray({obj: mConfig, key: 'images', onChange: onParamChanged, factory: mInitializingFactory}),
        }
    }

    function getParams() {
        return mParams;
    }

    // ── serialization / backward-compat ──────────────────────────────────────
    //
    //  ParamObj calls setParamsMap() with the saved `params` object whenever an
    //  object exposes it. We use it purely to migrate legacy presets, then hand
    //  off to the normal key-matched param apply.
    //
    function setParamsMap(values, initialize = false) {
        setParamValues(mParams, upgradeData(values), initialize);
    }

    //
    //  Old presets serialized the pattern as a bare PatternImage:
    //      { id, transparency, useCrown, transform:{…}, texture:{…}, adjust:{…} }
    //  The current format nests each image inside an `images` ObjArray. Detect
    //  the old shape (per-image keys at top level, no `images`) and wrap the
    //  whole thing as images.children[0] so nothing is silently dropped.
    //
    function upgradeData(v) {
        if (!v || typeof v !== 'object') return v;

        const PER_IMAGE_KEYS = ['texture', 'transform', 'useCrown', 'adjust', 'flipX', 'flipY'];
        const ARRAY_KEYS     = ['id', 'active'];
        const looksLegacy = !v.images && PER_IMAGE_KEYS.some(k => k in v);
        if (!looksLegacy) return v;

        if (DEBUG) console.log(`${MYNAME}.upgradeData(): wrapping legacy single-image preset`);

        const childParams = {};
        for (const k of Object.keys(v)) {
            if (ARRAY_KEYS.includes(k)) continue;          // stays on the array
            childParams[k] = v[k];
            delete v[k];
        }
        if (v.id && childParams.id === undefined) childParams.id = v.id;

        v.images = {
            className: 'ObjArray',
            params: { id: '', children: [ { className: 'PatternImage', params: childParams } ] },
        };
        return v;
    }

    // ── overlay geometry ─────────────────────────────────────────────────────
    //
    //  One entry per child image, describing its texture box in buffer/pattern
    //  space so an overlay can outline it. Consumed by PatternTransformRenderer
    //  via SymRenderer when the pattern-transform tool is active.
    //
    function getImageBoxes() {
        return mConfig.images.getChildren().map((img, i) => {
            const t = img.getTransform ? img.getTransform() : { centerX: 0, centerY: 0, scale: 1, angle: 0 };
            return {
                id:      img.getId ? img.getId() : `image_${i}`,
                centerX: t.centerX,
                centerY: t.centerY,
                scale:   t.scale,
                angle:   t.angle,
            };
        });
    }

    // Editable handles for the interactive transform tool: one per child,
    // each a live get/set pair over that image's placement transform.
    //  Per-image report of what the shader is doing with the placement.
    //  For tests and debugging; see PatternImage.getPlacementInfo().
    function getPlacementInfo() {
        return mConfig.images.getChildren().map((img, i) => ({
            id: img.getId ? img.getId() : `image_${i}`,
            ...(img.getPlacementInfo ? img.getPlacementInfo() : { geometric: false }),
        }));
    }

    function getImageTransforms() {
        return mConfig.images.getChildren().map((img, i) => ({
            id:  img.getId ? img.getId() : `image_${i}`,
            get: () => (img.getTransform ? img.getTransform() : { centerX: 0, centerY: 0, scale: 1, angle: 0 }),
            set: (partial) => { if (img.setTransform) img.setTransform(partial); },
        }));
    }

    // ── PatternData ───────────────────────────────────────────────────────────

    function getPatternData() {

        if (DEBUG) console.log(`${MYNAME}.getPatternData()`);

        const components = mConfig.images.getChildren().map((image, i) => ({
            name:   image.getId ? image.getId() : `image_${i}`,
            buffer: image.getPatternData().getMainBuffer(),
        }));

        return makeMultiComponentPatternData({ components });

    }

    // ── public interface ──────────────────────────────────────────────────────

    const myself = {
        getName:        () => MYNAME,
        getClassName:   () => MYNAME,
        addEventListener,
        setGroup,
        setPlacement,
        init,
        getParams,
        setParamsMap,
        getPatternData,
        getImageBoxes,
        getImageTransforms,
        getPlacementInfo,
    };

    return myself;

} // PatternImageArray()


// ─────────────────────────────────────────────────────────────────────────────
//  Factory / creator
// ─────────────────────────────────────────────────────────────────────────────
const PatternImageArrayCreator = {
    create:       (options) => PatternImageArray(options),
    getName:      () => `${MYNAME}-factory`,
    getClassName: () => MYNAME,
};

export { PatternImageArray, PatternImageArrayCreator };
