/**
 * BinaryStoreUtils.js
 *
 * Helpers for saving/loading Float32 simulation buffers to/from the binary
 * sidecar (.json.bin) managed by BinaryStore / BinaryLoader.
 *
 * Intended for use inside ParamCustom getValue/setValue implementations in
 * simulation objects that back their state with GPU framebuffer data.
 */

import { getCurrentDocument } from './document.js';

/**
 * Saves a Float32 GPU buffer to the binary sidecar when available,
 * falling back to legacy base64 encoding.
 *
 * Usage in a simulation's getBufferData():
 *
 *   return saveBufferData({
 *       name:          `${MYNAME}.simData`,
 *       width:         gSimBuffer.width,
 *       height:        gSimBuffer.height,
 *       components:    2,
 *       useBinary:     useBinaryData,
 *       readData:      readSimBuffer,       // () => Float32Array
 *       getLegacyData: getInternalBufferData, // () => base64 string
 *   });
 *
 * @param {object}           params
 * @param {string}           params.name           - Chunk identifier, e.g. 'Gray-Scott.simData'
 * @param {number}           params.width          - Buffer width in pixels
 * @param {number}           params.height         - Buffer height in pixels
 * @param {number}           params.components     - Float components per pixel (e.g. 2 for RG)
 * @param {boolean}          params.useBinary      - Whether to prefer binary sidecar
 * @param {()=>Float32Array} params.readData       - Reads raw Float32 data from the GPU buffer
 * @param {()=>string}       params.getLegacyData  - Encodes buffer to base64 string (legacy fallback)
 * @returns {{ width, height, binaryData: string } | { width, height, buffer: string }}
 */
export function saveBufferData({ name, width, height, components, useBinary, readData, getLegacyData }) {
    const store = getCurrentDocument()?.getBinaryStore();
    if (useBinary && store) {
        const fa        = readData();
        const chunkName = store.getChunkName(name);
        store.append({ name: chunkName, data: fa, dataInfo: { type: 'Float32', width, height, components } });
        return { width, height, binaryData: chunkName };
    } else {
        return { width, height, buffer: getLegacyData() };
    }
}

/**
 * Loads a Float32 GPU buffer from the binary sidecar when the saved data
 * references a binary chunk, falling back to legacy base64 decoding.
 *
 * Usage in a simulation's setBufferData(data):
 *
 *   loadBufferData(data, {
 *       name:        MYNAME,
 *       writeData:   writeSimBuffer,       // (Float32Array, w, h) => void
 *       writeLegacy: setInternalBufferData, // (data) => void
 *   });
 *
 * @param {object} data                                        - Serialized preset data field
 * @param {object} params
 * @param {string} params.name                                 - Name used in error messages
 * @param {(fa:Float32Array, w:number, h:number)=>void} params.writeData   - Uploads Float32 to GPU
 * @param {(data:object)=>void}                         params.writeLegacy - Decodes base64 and uploads
 */
export function loadBufferData(data, { name, writeData, writeLegacy }) {
    const { width, height } = data;
    if (data.binaryData) {
        const loader = getCurrentDocument()?.getBinaryLoader();
        if (!loader) {
            console.error(`${name}: simulation buffer "${data.binaryData}" could not be loaded — binary sidecar (.bin) file is missing or was not provided. The simulation will start from its default initial state.`);
            return;
        }
        const chunkRef = loader.getChunkRef(data.binaryData);
        if (!chunkRef) {
            console.error(`${name}: chunk "${data.binaryData}" not found in binary sidecar manifest.`);
            return;
        }
        if (!chunkRef.isValid()) {
            console.error(`${name}: binary sidecar is incomplete or corrupt — chunk "${data.binaryData}" declares ${chunkRef.byteLength} bytes but the .bin file only has ${chunkRef._buffer.byteLength} bytes. The simulation will start from its default initial state.`);
            return;
        }
        console.log(`${name}: setBufferData (binary): [${width} x ${height}]`);
        writeData(chunkRef.asFloat32Array(), width, height);
    } else {
        writeLegacy(data);
    }
}
