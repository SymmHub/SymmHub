/**
 * PatternData.js
 *
 * Provides the PatternData structure, which encapsulates one or more layers
 * of multi-component simulation/rendering buffers (DoubleFBOs).
 *
 * A layer is an object:
 *   { name: string, buffers: DoubleFBO[] }
 *
 * PatternData exposes:
 *   layers          — ordered array of layer objects
 *   getMainBuffer() — convenience accessor: returns layers[0].buffers[0]
 *                     (the primary / legacy single-component buffer)
 *
 * Usage:
 *   import { makePatternData } from './PatternData.js';
 *   const pd = makePatternData({mainBuffer: myDoubleFBO});
 *   const mainBuf = pd.getMainBuffer();   // the DoubleFBO
 *   pd.layers[0].buffers[0] === mainBuf;  // true
 */

/**
 * Wraps a single DoubleFBO as the "main" layer of a PatternData object.
 *
 * @param {object} args            - Arguments object
 * @param {object} args.mainBuffer - A DoubleFBO (has .read, .write, .width, .height)
 * @returns {PatternData}
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


export { makePatternData };
