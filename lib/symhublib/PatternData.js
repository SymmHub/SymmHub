/**
 * PatternData.js
 *
 * Provides the PatternData structure, which encapsulates one or more layers
 * of multi-component simulation/rendering buffers (DoubleFBOs).
 *
 * A layer is an object with one of two shapes:
 *   { name, buffers: DoubleFBO[] }              — single-component (makePatternData)
 *   { name, components: {name, buffer}[] }      — named multi-component (makeMultiComponentPatternData)
 *
 * PatternData exposes:
 *   layers                   — ordered array of layer objects
 *   getMainBuffer()          — first buffer (layers[0] buffer or component[0].buffer)
 *   getComponentBuffer(name) — find a named component buffer (multi-component only)
 */

/**
 * Wraps a single DoubleFBO as the "main" layer of a PatternData object.
 *
 * @param {object} args            - Arguments object
 * @param {object} args.mainBuffer - A DoubleFBO (has .read, .write, .width, .height)
 * @returns {PatternData}
 *
 * Usage:
 *   const pd = makePatternData({mainBuffer: myDoubleFBO});
 *   const buf = pd.getMainBuffer();
 */
function makePatternData(args) {

    const { mainBuffer } = args;

    const layers = [
        {
            name:    'main',
            buffers: [ mainBuffer ],
        }
    ];

    /** @returns {object} The primary DoubleFBO (layers[0].buffers[0]) */
    function getMainBuffer() {
        return layers[0].buffers[0];
    }

    return {
        layers,
        getMainBuffer,
    };

} // makePatternData()


/**
 * Builds a PatternData with a single layer that holds N named component buffers.
 *
 * @param {object}   args              - Arguments object
 * @param {Array}    args.components   - Array of {name: string, buffer: DoubleFBO}
 * @param {string}  [args.layerName]   - Name for the layer (default: 'main')
 * @returns {PatternData}
 *
 * Usage:
 *   const pd = makeMultiComponentPatternData({
 *       components: [
 *           { name: 'albedo',  buffer: buf0 },
 *           { name: 'normals', buffer: buf1 },
 *       ]
 *   });
 *   const buf = pd.getComponentBuffer('albedo');
 *   const first = pd.getMainBuffer();
 */
function makeMultiComponentPatternData(args) {

    const { components, layerName = 'main' } = args;

    const layers = [
        {
            name:       layerName,
            components, // [{name, buffer}]
        }
    ];

    /** @returns {object} The first component's DoubleFBO */
    function getMainBuffer() {
        return layers[0].components[0]?.buffer ?? null;
    }

    /**
     * Look up a component buffer by name.
     * @param {string} name
     * @returns {object|null} DoubleFBO or null if not found
     */
    function getComponentBuffer(name) {
        const found = layers[0].components.find(c => c.name === name);
        return found ? found.buffer : null;
    }

    return {
        layers,
        getMainBuffer,
        getComponentBuffer,
    };

} // makeMultiComponentPatternData()


export { makePatternData, makeMultiComponentPatternData };

