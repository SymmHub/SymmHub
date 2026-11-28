/*
  node tests/uilib/export_image_fallback.mjs

  Tests for export image reliability & browser-download fallback:
  1. sanitizeFileName: strips path separators and OS-illegal characters (catalog titles like 632/333[2].1, *632/*332[2].1)
  2. supportsDirectoryPicker: detects missing showDirectoryPicker and iframe contexts
  3. exportImage with folderHandle=null (PNG/JPG/WEBP): downloads sanitized filename via <a download> and restores canvas state
  4. exportImage with folderHandle=null (TIFF): generates valid little-endian tiled TIFF Blob and downloads it
  5. exportImage with folderHandle (mock): writes sanitized filenames (no / or * passed to getFileHandle)
*/

// Minimal DOM/URL shims for Node
const downloads = [];
const banners = [];
const revokedUrls = [];
const blobStore = new Map();
let urlSeq = 0;

globalThis.URL.createObjectURL = (blob) => {
    const u = `blob:mock-${++urlSeq}`;
    blobStore.set(u, blob);
    return u;
};
globalThis.URL.revokeObjectURL = (u) => {
    revokedUrls.push(u);
    blobStore.delete(u);
};

const mockHead = { appendChild() {}, insertBefore() {} };
globalThis.document = {
    head: mockHead,
    getElementsByTagName(tag) { return tag === 'head' ? [mockHead] : []; },
    body: {
        appendChild(el) {
            if (el._isBanner) banners.push(el.textContent);
        },
    },
    createElement(tag) {
        const el = {
            tagName: tag.toUpperCase(),
            style: {},
            _isBanner: tag === 'div',
            _listeners: {},
            setAttribute() {},
            appendChild() {},
            addEventListener(ev, fn) { this._listeners[ev] = fn; },
            remove() {},
            click() {
                if (tag === 'a') {
                    downloads.push({
                        download: this.download,
                        href: this.href,
                        blob: blobStore.get(this.href) || null,
                    });
                }
            },
        };
        return el;
    },
};

const topWin = { addEventListener() {} };
globalThis.window = topWin;
topWin.self = topWin;
topWin.top = topWin;

const { sanitizeFileName, supportsDirectoryPicker } = await import('../../lib/uilib/files.js');
const { exportImage } = await import('../../lib/symhublib/exportImage.js');

let failed = 0, checks = 0;
function check(ok, what) {
    checks++;
    if (!ok) {
        failed++;
        console.log('FAIL:', what);
    } else {
        console.log('ok  ', what);
    }
}

// 1. sanitizeFileName
{
    check(sanitizeFileName('632/333[2].1') === '632-333[2].1', 'slashes replaced with dashes');
    check(sanitizeFileName('*632/*332[2].1') === '_632-_332[2].1', 'asterisks and slashes sanitized');
    check(sanitizeFileName('22/1[2].o') === '22-1[2].o', 'orbit suffix preserved');
    check(sanitizeFileName('a\\b:c?d"e<f>g|h') === 'a-b_c_d_e_f_g_h', 'all OS-forbidden chars sanitized');
    check(sanitizeFileName('  ...foo...  ') === 'foo', 'leading/trailing dots and spaces stripped');
    check(sanitizeFileName('..', 'fallback') === 'fallback', 'dot-dot falls back');
    check(sanitizeFileName('', 'fallback') === 'fallback', 'empty falls back');
    check(sanitizeFileName('CON') === 'CON_', 'Windows reserved device name escaped');
}

// 2. supportsDirectoryPicker
{
    delete topWin.showDirectoryPicker;
    check(supportsDirectoryPicker() === false, 'false when showDirectoryPicker is absent (HTTP / mobile / Firefox / Safari)');

    topWin.showDirectoryPicker = () => {};
    check(supportsDirectoryPicker() === true, 'true in top-level window with showDirectoryPicker');

    topWin.top = {};
    check(supportsDirectoryPicker() === false, 'false inside iframe (window.self !== window.top)');
    topWin.top = topWin;
}

// Helper: mock WebGL renderer
function makeMockRenderer(w = 64, h = 64) {
    let curW = w, curH = h, curZoom = 1.5, curCenter = [0.25, -0.5];
    let exporting = false;
    const savedCalls = [];
    const docCalls = [];

    const mockGl = {
        RGBA: 0x1908,
        UNSIGNED_BYTE: 0x1401,
        OUT_OF_MEMORY: 0x0505,
        MAX_VIEWPORT_DIMS: 0x0D3A,
        get drawingBufferWidth() { return curW; },
        get drawingBufferHeight() { return curH; },
        isContextLost: () => false,
        getParameter: () => [8192, 8192],
        getError: () => 0,
        readPixels: (x, y, rw, rh, fmt, type, out) => {
            for (let i = 0; i < out.length; i += 4) {
                out[i] = 200; out[i + 1] = 100; out[i + 2] = 50; out[i + 3] = 255;
            }
        },
    };

    const glCanvas = {
        getContext: () => mockGl,
        toBlob(cb, mime) {
            cb(new Blob([new Uint8Array([137, 80, 78, 71])], { type: mime }));
        },
    };

    const tmbCanvas = {
        width: 4,
        height: 4,
        getContext: () => ({
            getImageData: () => ({ data: new Uint8ClampedArray(4 * 4 * 4).fill(255) }),
        }),
        toBlob(cb, mime) {
            cb(new Blob([new Uint8Array([1, 2, 3, 4])], { type: mime }));
        },
    };

    return {
        savedCalls,
        docCalls,
        getState: () => ({ curW, curH, curZoom, curCenter, exporting }),
        renderer: {
            getCanvasSize: () => ({ width: curW, height: curH }),
            setCanvaSize: (nw, nh) => { curW = nw; curH = nh; },
            canvasTransform: {
                getZoom: () => [curZoom],
                setZoom: (z) => { curZoom = z; },
                getCenter: () => [...curCenter],
                setCenter: (c) => { curCenter = [...c]; },
            },
            writeDocumentToFolder: async (fh, name) => { docCalls.push({ fh, name }); },
            renderFrame: () => {},
            makeThumbnail: () => tmbCanvas,
            saveImageTo: async (canvas, fh, name, json, type) => { savedCalls.push({ fh, name, type }); },
            glCanvas,
            exportTileSize: 16,
            exportWidth: 0,
            exportHeight: 0,
            overlayCanvas: null,
            setIsExporting: (v) => { exporting = v; },
        },
    };
}

// 3. Single-frame PNG download fallback (folderHandle = null)
{
    downloads.length = 0;
    revokedUrls.length = 0;
    const m = makeMockRenderer(100, 80);
    await exportImage('*632/*332[2].1', null, 320, 240, m.renderer, 'PNG');
    check(downloads.length === 1, 'PNG download triggered via <a download>');
    check(downloads[0].download === '_632-_332[2].1.png', `PNG filename sanitized: ${downloads[0]?.download}`);
    check(downloads[0].blob && downloads[0].blob.size > 0, 'PNG blob non-empty');
    check(revokedUrls.length === 0, 'blob URL is NOT synchronously revoked on click');
    const st = m.getState();
    check(st.curW === 100 && st.curH === 80 && st.curZoom === 1.5 && st.exporting === false, 'canvas state restored after PNG download');
    check(m.renderer.exportWidth === 320 && m.renderer.exportHeight === 240, 'exportWidth/Height updated');
}

// 4. Tiled TIFF download fallback (folderHandle = null)
{
    downloads.length = 0;
    const m = makeMockRenderer(64, 64);
    await exportImage('632/333[2].1', null, 32, 32, m.renderer, 'TIFF');
    check(downloads.length === 1, 'TIFF download triggered via <a download>');
    check(downloads[0].download === '632-333[2].1.tif', `TIFF filename sanitized: ${downloads[0]?.download}`);
    const buf = await downloads[0].blob.arrayBuffer();
    const dv = new DataView(buf);
    check(dv.getUint16(0, true) === 0x4949 && dv.getUint16(2, true) === 42, 'TIFF header magic II/42 valid');
    const ifdOff = dv.getUint32(4, true);
    check(ifdOff > 8 && ifdOff + 150 <= buf.byteLength, `TIFF IFD offset valid (${ifdOff} in ${buf.byteLength} bytes)`);
    check(dv.getUint16(ifdOff, true) === 12, 'TIFF IFD has 12 entries');
    const st = m.getState();
    check(st.curW === 64 && st.curH === 64 && st.exporting === false, 'canvas state restored after TIFF download');
}

// 5. Folder export writes sanitized filenames (no / or *)
{
    const writtenFiles = [];
    const mockFolder = {
        name: 'exports',
        async getFileHandle(name) {
            if (/[\/\\*?:<>|"]/.test(name)) throw new TypeError(`Name is not allowed: ${name}`);
            writtenFiles.push(name);
            return {
                async createWritable() {
                    return { async write() {}, async close() {} };
                },
            };
        },
    };
    const m = makeMockRenderer(64, 64);
    await exportImage('632/333[2].1', mockFolder, 128, 128, m.renderer, 'PNG');
    check(m.savedCalls.length === 1 && m.savedCalls[0].name === '632-333[2].1', 'folder saveImageTo got sanitized name');
    check(m.docCalls.length === 1 && m.docCalls[0].name === '632-333[2].1.png', 'folder writeDocumentToFolder got sanitized name');
    check(writtenFiles.includes('632-333[2].1.png.json.png'), 'thumbnail written with sanitized name');
}

console.log(`${checks - failed} of ${checks} checks passed`);
process.exit(failed ? 1 : 0);
