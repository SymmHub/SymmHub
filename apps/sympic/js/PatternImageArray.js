import {
    EventDispatcher,
    makeMultiComponentPatternData,
} from './modules.js';

import { PatternImage } from './PatternImage.js';

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

    // [{name: string, image: PatternImage}]
    let mImages = [];
    let mParams = null;

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

        const imageDescs = options.images || [];

        mImages = imageDescs.map(desc => {
            const img = PatternImage(desc);
            img.addEventListener('imageChanged', onImageChanged);
            img.init(glContext);
            return { name: desc.name, image: img };
        });

        mParams = makeParams();

    }

    // ── group propagation ─────────────────────────────────────────────────────

    function setGroup(group) {
        if (DEBUG) console.log(`${MYNAME}.setGroup()`, group);
        mImages.forEach(({ image }) => image.setGroup(group));
        informListeners();
    }

    // ── params ────────────────────────────────────────────────────────────────
    //
    //  Each PatternImage's params are nested under its component name.

    function makeParams() {
        const params = {};
        mImages.forEach(({ name, image }) => {
            params[name] = image.getParams();
        });
        return params;
    }

    function getParams() {
        return mParams;
    }

    // ── PatternData ───────────────────────────────────────────────────────────

    function getPatternData() {

        if (DEBUG) console.log(`${MYNAME}.getPatternData()`);

        const components = mImages.map(({ name, image }) => ({
            name,
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
