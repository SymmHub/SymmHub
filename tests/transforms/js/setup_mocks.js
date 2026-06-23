const noop = () => {};

const dummyElement = {
    style: {},
    appendChild: () => dummyElement,
    classList: { add: noop, remove: noop },
    getElementsByTagName: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    remove: noop,
    setAttribute: noop,
    getAttribute: noop,
    insertBefore: noop,
};
dummyElement.parentNode = dummyElement;

globalThis.window = {
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    addEventListener: noop,
    removeEventListener: noop,
    document: {
        createElement: () => dummyElement,
        body: {
            appendChild: () => dummyElement,
            addEventListener: noop,
            removeEventListener: noop,
        },
        documentElement: {
            clientHeight: 1000,
            clientWidth: 1000,
        },
        getElementsByTagName: (name) => {
            if (name === 'head' || name === 'script') {
                return [dummyElement];
            }
            return [];
        },
        addEventListener: noop,
        removeEventListener: noop,
    }
};
globalThis.document = globalThis.window.document;
globalThis.navigator = {
    userAgent: 'node',
};
globalThis.FileReader = class FileReader {
    constructor() {}
    readAsText() {}
};
