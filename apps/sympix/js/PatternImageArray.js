import {
    EventDispatcher,
    makeMultiComponentPatternData,
    ObjArray,
    ObjectFactory,
    ParamObjArray,
    ParamString,
    ParamBool,
    ParamFloat,
    PatternImage,
    PatternImageCreator,
    setParamValues,
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

    // ── old documents ─────────────────────────────────────────────────────────
    //
    //  ParamObj hands a saved pattern to setParamsMap. A document saved by a
    //  page whose pattern was a single PatternImage (the orbifold page before
    //  2026-11-11) has the image's keys at the top and no `images`: it becomes
    //  the array's one image.
    //
    function setParamsMap(values, initialize = false) {
        setParamValues(mParams, upgradeData(values), initialize);
    }

    const IMAGE_KEYS = ['texture', 'transform', 'useCrown', 'adjust', 'flipX', 'flipY'];

    function upgradeData(v) {
        if (!v || typeof v !== 'object' || v.images || !IMAGE_KEYS.some(k => k in v)) return v;
        if (DEBUG) console.log(`${MYNAME}.upgradeData(): a single image document`);
        const image = {};
        for (const k of Object.keys(v)) {
            if (k === 'active') continue;
            image[k] = v[k];
        }
        return {
            ...(('active' in v) ? { active: v.active } : {}),
            images: { className: 'ObjArray', params: { id: '', children: [{ className: 'PatternImage', params: image }] } },
        };
    }

    // ── the images' places, for the pattern transform tool ───────────────────
    //
    //  one entry per image: its id and its place in the pattern box
    //  (PatternImage.getTransform / setTransform)
    //
    function getImageTransforms() {
        return mConfig.images.getChildren().filter(img => img.getTransform).map((img, i) => ({
            id:  img.getId ? img.getId() : `image_${i}`,
            get: () => img.getTransform(),
            set: (t) => img.setTransform(t),
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
        init,
        getParams,
        setParamsMap,
        getPatternData,
        getImageTransforms,
        // the pattern box may be placed by a bent pose (PatternPose.js): the pattern
        // transform tool then moves the images in the geometry of the group
        canBend: () => true,
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
