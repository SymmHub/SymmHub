/**
 * BinaryStore.js
 *
 * GLTF-style binary sidecar support for ParamCustom.
 *
 * BinaryStore  — save side: collects named binary chunks into one .bin ArrayBuffer.
 * BinaryLoader — load side: wraps the loaded .bin + manifest, yields ChunkRefs.
 * ChunkRef     — handle passed to setBinaryValue(); call .asFloat32Array() etc.
 *
 * .bin file format (SYMM):
 *   [0-3]   Magic 'SYMM'        (4 ASCII bytes)
 *   [4-7]   TEXT_OFFSET         (uint32 LE) — byte offset of JSON text chunk
 *   [8-11]  TEXT_SIZE           (uint32 LE) — byte length of JSON text chunk
 *   [12-15] BIN_OFFSET          (uint32 LE) — byte offset of raw binary chunk (4-byte aligned)
 *   [16-19] BIN_SIZE            (uint32 LE) — byte length of raw binary chunk
 *   [TEXT_OFFSET..] TEXT_DATA   UTF-8 JSON (binary_data manifest)
 *   [BIN_OFFSET..]  BIN_DATA    raw chunk bytes
 *
 * Usage (inside a ParamCustom getValue / setValue):
 *
 *   import { getCurrentDocument } from './document.js';  // or via modules.js
 *
 *   // Save:
 *   const store = getCurrentDocument()?.getBinaryStore();
 *   if (store) {
 *       const sentinel = store.register('myParam', 'Float32', myFloat32Array);
 *       return sentinel;           // stored in JSON instead of raw data
 *   }
 *   return myFallbackValue;
 *
 *   // Load:
 *   const loader = getCurrentDocument()?.getBinaryLoader();
 *   if (loader && BinaryLoader.isChunkSentinel(value)) {
 *       const ref = loader.getChunkRef(BinaryLoader.chunkName(value));
 *       myFloat32Array = ref.asFloat32Array();
 *   }
 */

// ── Magic / header ────────────────────────────────────────────────────────────

const SYMM_MAGIC  = [0x53, 0x59, 0x4D, 0x4D]; // 'SYMM'
const HEADER_SIZE = 20; // 4 (magic) + 4 × uint32

// ── Alignment helper ─────────────────────────────────────────────────────────

/** Round up `n` to the next multiple of `align` (must be power-of-two). */
function alignUp(n, align = 4) {
    return (n + align - 1) & ~(align - 1);
}

// ── ChunkRef ─────────────────────────────────────────────────────────────────

/**
 * Passed to `setBinaryValue(chunkRef)` by the param system.
 * Provides lazy typed-array views over a slice of the loaded BIN_DATA buffer.
 */
class ChunkRef {

    constructor({ name, type, byteOffset, byteLength, meta = {} }, binaryBuffer) {
        this.name       = name;
        this.type       = type;
        this.byteOffset = byteOffset;
        this.byteLength = byteLength;
        this.meta       = meta;
        this._buffer    = binaryBuffer;
    }

    /**
     * True when the backing buffer is large enough to satisfy this chunk's
     * declared byteOffset + byteLength.
     */
    isValid() {
        return this._buffer.byteLength >= this.byteOffset + this.byteLength;
    }

    /** Returns an ArrayBuffer slice (copy) for this chunk. */
    resolve() {
        return this._buffer.slice(this.byteOffset, this.byteOffset + this.byteLength);
    }

    /** Float32Array view (no copy). Throws if chunk is invalid — check isValid() first. */
    asFloat32Array() {
        return new Float32Array(this._buffer, this.byteOffset, this.byteLength / 4);
    }

    /** Uint8Array view (no copy). */
    asUint8Array() {
        return new Uint8Array(this._buffer, this.byteOffset, this.byteLength);
    }

    /** Int32Array view (no copy). */
    asInt32Array() {
        return new Int32Array(this._buffer, this.byteOffset, this.byteLength / 4);
    }
}

// ── BinaryStore ───────────────────────────────────────────────────────────────

/**
 * Used during save.
 *
 * Call register() for each binary param; it returns the {"__chunk": name}
 * sentinel that goes into the JSON params tree.
 *
 * After all params are collected, call:
 *   toManifest(filename) → the binary_data object for the JSON file
 *   toFileBuffer(manifest) → the full .bin file content in SYMM format
 */
class BinaryStore {

    constructor() {
        this._chunks  = [];  // [{name, type, byteOffset, byteLength, meta, srcBuffer, srcByteOffset}]
        this._bytePos = 0;
    }

    /**
     * Register a typed-array / ArrayBuffer chunk.
     * @param {string} name
     * @param {string} type - "Float32", "Uint8", "image/png", …
     * @param {TypedArray|ArrayBuffer} data
     * @param {object} [meta]
     * @returns {{ __chunk: string }} sentinel for the JSON params tree
     */
    register(name, type, data, meta = {}) {
        const ab               = (data instanceof ArrayBuffer) ? data : data.buffer;
        const byteOffset_in_src = (data instanceof ArrayBuffer) ? 0 : data.byteOffset;
        const byteLength        = (data instanceof ArrayBuffer) ? ab.byteLength : data.byteLength;

        this._chunks.push({
            name,
            type,
            byteOffset:     this._bytePos,
            byteLength,
            meta,
            srcBuffer:      ab,
            srcByteOffset:  byteOffset_in_src,
        });

        this._bytePos = alignUp(this._bytePos + byteLength, 4);
        return { __chunk: name };
    }

    /**
     * Build the `binary_data` manifest object (embedded in the .json file).
     * @param {string} filename  e.g. "mypreset.json.bin"
     */
    toManifest(filename) {
        const chunks = {};
        for (const c of this._chunks) {
            chunks[c.name] = {
                type:       c.type,
                byteOffset: c.byteOffset,
                byteLength: c.byteLength,
                ...(Object.keys(c.meta).length ? { meta: c.meta } : {}),
            };
        }
        return { file: filename, chunks };
    }

    /**
     * Concatenate all registered chunks into a raw BIN_DATA ArrayBuffer.
     * Gaps are zero-padded (4-byte alignment).
     * @returns {ArrayBuffer}
     */
    toArrayBuffer() {
        const out = new Uint8Array(this._bytePos);
        for (const c of this._chunks) {
            out.set(new Uint8Array(c.srcBuffer, c.srcByteOffset, c.byteLength), c.byteOffset);
        }
        return out.buffer;
    }

    /**
     * Build the full structured .bin file in SYMM format.
     *
     * Layout:
     *   [0-3]   'SYMM' magic
     *   [4-7]   TEXT_OFFSET (uint32 LE)
     *   [8-11]  TEXT_SIZE   (uint32 LE)
     *   [12-15] BIN_OFFSET  (uint32 LE, 4-byte aligned)
     *   [16-19] BIN_SIZE    (uint32 LE)
     *   [TEXT_OFFSET..TEXT_OFFSET+TEXT_SIZE]  UTF-8 JSON of manifest
     *   [BIN_OFFSET..BIN_OFFSET+BIN_SIZE]     raw chunk bytes
     *
     * @param {object} manifest  the binary_data object from toManifest()
     * @returns {ArrayBuffer}
     */
    toFileBuffer(manifest) {
        const textBytes = new TextEncoder().encode(JSON.stringify(manifest));
        const binBuffer = this.toArrayBuffer();

        const TEXT_OFFSET = HEADER_SIZE;                              // 20
        const TEXT_SIZE   = textBytes.byteLength;
        const BIN_OFFSET  = alignUp(TEXT_OFFSET + TEXT_SIZE, 4);
        const BIN_SIZE    = binBuffer.byteLength;

        const out  = new Uint8Array(BIN_OFFSET + BIN_SIZE);
        const view = new DataView(out.buffer);

        // Magic
        out[0] = SYMM_MAGIC[0];
        out[1] = SYMM_MAGIC[1];
        out[2] = SYMM_MAGIC[2];
        out[3] = SYMM_MAGIC[3];

        // Header uint32 fields (little-endian)
        view.setUint32( 4, TEXT_OFFSET, true);
        view.setUint32( 8, TEXT_SIZE,   true);
        view.setUint32(12, BIN_OFFSET,  true);
        view.setUint32(16, BIN_SIZE,    true);

        // TEXT_DATA
        out.set(textBytes, TEXT_OFFSET);

        // BIN_DATA
        out.set(new Uint8Array(binBuffer), BIN_OFFSET);

        return out.buffer;
    }

    /**
     * Returns a unique chunk name derived from `suggested`.
     * Appends _1, _2, … if already taken.
     */
    getChunkName(suggested = 'chunk') {
        const used = new Set(this._chunks.map(c => c.name));
        if (!used.has(suggested)) return suggested;
        let n = 1;
        while (used.has(`${suggested}_${n}`)) n++;
        return `${suggested}_${n}`;
    }

    /**
     * Register a chunk using the structured dataInfo convention.
     * @param {{ name, data, dataInfo? }} arg
     */
    append({ name, data, dataInfo = {} }) {
        const { type = 'Float32', ...meta } = dataInfo;
        this.register(name, type, data, meta);
    }
}

// ── BinaryLoader ──────────────────────────────────────────────────────────────

const CHUNK_SENTINEL = '__chunk';

/**
 * Used during load.
 *
 * Wraps the binary_data manifest and BIN_DATA buffer.
 * Provides getChunkRef() for the param system.
 */
class BinaryLoader {

    /**
     * @param {object}      manifest  the `binary_data` object (from JSON or parsed from SYMM file)
     * @param {ArrayBuffer} buffer    the BIN_DATA portion (raw chunk bytes)
     */
    constructor(manifest, buffer) {
        this._manifest = manifest;
        this._buffer   = buffer;
    }

    /**
     * Returns a ChunkRef for the named chunk, or null if not found.
     * @param {string} name
     * @returns {ChunkRef|null}
     */
    getChunkRef(name) {
        const desc = this._manifest.chunks?.[name];
        if (!desc) return null;
        return new ChunkRef({ name, ...desc }, this._buffer);
    }

    /** True when `value` is a {"__chunk": "name"} sentinel. */
    static isChunkSentinel(value) {
        return (
            value !== null &&
            typeof value === 'object' &&
            typeof value[CHUNK_SENTINEL] === 'string'
        );
    }

    /** Extract the chunk name from a sentinel. */
    static chunkName(sentinel) {
        return sentinel[CHUNK_SENTINEL];
    }

    /**
     * Parse a raw ArrayBuffer from a SYMM-format .bin file.
     *
     * Throws if the SYMM magic is not found — only SYMM format is supported.
     *
     * @param {ArrayBuffer} arrayBuffer  full .bin file content
     * @returns {{ manifest: object, binData: ArrayBuffer }}
     * @throws {Error} if the file does not start with the SYMM magic
     */
    static parseFileBuffer(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);

        if (
            bytes.byteLength < HEADER_SIZE ||
            bytes[0] !== SYMM_MAGIC[0] ||
            bytes[1] !== SYMM_MAGIC[1] ||
            bytes[2] !== SYMM_MAGIC[2] ||
            bytes[3] !== SYMM_MAGIC[3]
        ) {
            throw new Error('BinaryLoader.parseFileBuffer: not a SYMM file (magic mismatch)');
        }

        const view       = new DataView(arrayBuffer);
        const textOffset = view.getUint32( 4, true);
        const textSize   = view.getUint32( 8, true);
        const binOffset  = view.getUint32(12, true);
        const binSize    = view.getUint32(16, true);

        const manifest = JSON.parse(
            new TextDecoder().decode(new Uint8Array(arrayBuffer, textOffset, textSize))
        );
        const binData = arrayBuffer.slice(binOffset, binOffset + binSize);

        return { manifest, binData };
    }

    /**
     * Load a BinaryLoader asynchronously from a fetch Response or Blob.
     * @param {object} manifest
     * @param {Response|Blob} source
     */
    static async fromSource(manifest, source) {
        const buffer = await source.arrayBuffer();
        return new BinaryLoader(manifest, buffer);
    }
}

// ── Exports ───────────────────────────────────────────────────────────────────

export {
    BinaryStore, BinaryLoader, ChunkRef,
};
