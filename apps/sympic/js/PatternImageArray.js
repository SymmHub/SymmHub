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
        addEventListener,
        setGroup,
        init,
        getParams,
        getPatternData,
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
