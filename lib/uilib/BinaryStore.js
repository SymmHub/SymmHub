/**
 * BinaryStore.js
 *
 * GLTF-style binary sidecar support for ParamCustom.
 *
 * BinaryStore  — save side: collects named binary chunks into one .bin ArrayBuffer.
 * BinaryLoader — load side: wraps the loaded .bin + manifest, yields ChunkRefs.
 * ChunkRef     — handle passed to setBinaryValue(); call .asFloat32Array() etc.
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

// ── Alignment helper ─────────────────────────────────────────────────────────

/** Round up `n` to the next multiple of `align` (must be power-of-two). */
function alignUp(n, align = 4) {
    return (n + align - 1) & ~(align - 1);
}

// ── ChunkRef ─────────────────────────────────────────────────────────────────

/**
 * Passed to `setBinaryValue(chunkRef)` by the param system.
 * Provides lazy typed-array views over a slice of the loaded .bin buffer.
 */
class ChunkRef {

    constructor({ name, type, byteOffset, byteLength, meta = {} }, binaryBuffer) {
        this.name       = name;
        this.type       = type;
        this.byteOffset = byteOffset;
        this.byteLength = byteLength;
        this.meta       = meta;
        this._buffer    = binaryBuffer; // full .bin ArrayBuffer
    }

    /**
     * True when the backing buffer is large enough to satisfy this chunk's
     * declared byteOffset + byteLength.  Returns false when the .bin sidecar
     * was missing, empty, or truncated.
     */
    isValid() {
        return this._buffer.byteLength >= this.byteOffset + this.byteLength;
    }

    /** Returns an ArrayBuffer slice (copy) for this chunk. */
    resolve() {
        return this._buffer.slice(this.byteOffset, this.byteOffset + this.byteLength);
    }

    /** Float32Array view (no copy). Throws if the chunk is invalid — check isValid() first. */
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
 *   toArrayBuffer()      → the combined .bin content
 */
class BinaryStore {

    constructor() {
        this._chunks   = [];   // [{name, type, byteOffset, byteLength, meta, data}]
        this._bytePos  = 0;
    }

    /**
     * Register a typed-array / ArrayBuffer chunk.
     * @param {string} name - unique key (becomes the chunk name in binary_data.chunks)
     * @param {string} type - "Float32", "Uint8", "image/png", …
     * @param {TypedArray|ArrayBuffer} data
     * @param {object} [meta] - optional JSON-safe metadata (e.g. {width, height})
     * @returns {{ __chunk: string }} sentinel object to embed in the JSON param value
     */
    register(name, type, data, meta = {}) {
        // Normalise to ArrayBuffer
        const ab = (data instanceof ArrayBuffer) ? data : data.buffer;
        // Byte slice for this chunk's data within `ab`
        const byteOffset_in_src = (data instanceof ArrayBuffer) ? 0        : data.byteOffset;
        const byteLength        = (data instanceof ArrayBuffer) ? ab.byteLength : data.byteLength;

        this._chunks.push({
            name,
            type,
            byteOffset: this._bytePos,
            byteLength,
            meta,
            srcBuffer:      ab,
            srcByteOffset:  byteOffset_in_src,
        });

        this._bytePos = alignUp(this._bytePos + byteLength, 4);

        return { __chunk: name };
    }

    /**
     * Build the `binary_data` object to embed at the top level of the JSON file.
     * @param {string} filename - the .bin filename (e.g. "mypreset.json.bin")
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
     * Concatenate all registered chunks into a single ArrayBuffer (the .bin file).
     * Gaps between chunks are zero-padded (4-byte alignment).
     */
    toArrayBuffer() {
        const totalBytes = this._bytePos; // already aligned
        const out = new Uint8Array(totalBytes);
        for (const c of this._chunks) {
            const src = new Uint8Array(c.srcBuffer, c.srcByteOffset, c.byteLength);
            out.set(src, c.byteOffset);
        }
        return out.buffer;
    }

    /**
     * Returns a unique chunk name based on `suggested`.
     * If `suggested` is already taken, appends _1, _2, … until unique.
     * @param {string} [suggested='chunk']
     * @returns {string}
     */
    getChunkName(suggested = 'chunk') {
        const used = new Set(this._chunks.map(c => c.name));
        if (!used.has(suggested)) return suggested;
        let counter = 1;
        while (used.has(`${suggested}_${counter}`)) counter++;
        return `${suggested}_${counter}`;
    }

    /**
     * Register a chunk using the structured dataInfo convention.
     * @param {{ name: string, data: TypedArray|ArrayBuffer, dataInfo?: { type?: string, [key: string]: any } }} arg
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
 * Created from the `binary_data` section of the JSON plus the fetched .bin
 * ArrayBuffer.  Provides getChunkRef() for the param system.
 */
class BinaryLoader {

    /**
     * @param {object} manifest     - the `binary_data` value from the JSON file
     * @param {ArrayBuffer} buffer  - the full .bin file content
     */
    constructor(manifest, buffer) {
        this._manifest = manifest; // { file, chunks: {name: {type, byteOffset, byteLength, meta?}} }
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

    /**
     * True when the value is a {"__chunk": "name"} sentinel.
     * Static so callers don't need a loader instance.
     */
    static isChunkSentinel(value) {
        return (
            value !== null &&
            typeof value === 'object' &&
            typeof value[CHUNK_SENTINEL] === 'string'
        );
    }

    /**
     * Extract the chunk name from a sentinel.
     */
    static chunkName(sentinel) {
        return sentinel[CHUNK_SENTINEL];
    }

    /**
     * Load a BinaryLoader asynchronously from a fetch Response or Blob.
     * @param {object} manifest
     * @param {Response|Blob} source
     */
    static async fromSource(manifest, source) {
        const buffer = source instanceof Blob
            ? await source.arrayBuffer()
            : await source.arrayBuffer();
        return new BinaryLoader(manifest, buffer);
    }
}

// ── Exports ───────────────────────────────────────────────────────────────────

export {
    BinaryStore, BinaryLoader, ChunkRef,
};
