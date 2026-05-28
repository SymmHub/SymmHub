/**
 * ParamImage.js
 *
 * A custom param that:
 *  - Renders a 128×128 thumbnail inside a dat.gui folder row
 *  - Lets the user pick an image file via FileSelectionDialog (filter:'image')
 *  - Saves raw image bytes as a named binary chunk in BinaryStore
 *  - Restores from BinaryLoader on load
 *
 * Usage:
 *   ParamImage({
 *       name:      'image',          // label shown in dat.gui
 *       id:        'texImage',       // suggested BinaryStore chunk name
 *       storageId: 'texImagePicker', // IDB key for the image FileSelectionDialog
 *       onChange:  () => { ... },    // called when image data changes
 *   })
 */

import { createFileSelectionDialog } from './FileSelectionDialog.js';
import { getCurrentDocument }        from './document.js';
import { BinaryLoader }              from './BinaryStore.js';
import { CustomImageManager }          from './CustomImageManager.js';

const THUMB_SIZE = 128;

/**
 * @param {object}   arg
 * @param {string}   [arg.name='image']           label in dat.gui
 * @param {string}   [arg.id='image']             suggested BinaryStore chunk name
 * @param {string}   [arg.storageId]              IDB key for image FileSelectionDialog
 * @param {function} [arg.onChange]               called when image data changes
 * @param {boolean}  [arg.serializable=true]
 */
export function ParamImage(arg) {

    const mName      = arg.name      ?? 'image';
    const mId        = arg.id        ?? 'image';
    const mStorageId = arg.storageId ?? 'paramImagePicker';
    const mWidth     = arg.width     ?? THUMB_SIZE;
    const mHeight    = arg.height    ?? THUMB_SIZE;
    const mStretch   = arg.stretch   ?? false;

    let mImageData  = null;   // Uint8Array — raw bytes of the selected image file
    let mImageName  = '';     // original filename (stored in chunk meta)
    let mObjectUrl  = null;   // revocable blob URL fed into mImgElement.src
    let mDisplaySrc  = null;  // display-only override src (e.g. URL texture path)
    let mDisplayName = null;  // display-only caption override
    let mImgElement     = null;   // <img class="thumbnail-image">  (created in createUI)
    let mCaptionElement = null;   // <div class="thumbnail-caption"> (created in createUI)
    let mFilePicker = null;   // FileSelectionDialog, lazily created

    // ── Display ───────────────────────────────────────────────────────────────

    function getMimeType(filename) {
        if (!filename) return 'image/png';
        const ext = filename.split('.').pop().toLowerCase();
        switch (ext) {
            case 'jpg':
            case 'jpeg':
                return 'image/jpeg';
            case 'webp':
                return 'image/webp';
            case 'gif':
                return 'image/gif';
            case 'svg':
                return 'image/svg+xml';
            default:
                return 'image/png';
        }
    }

    function updateDisplay() {
        if (!mImgElement) return;

        if (mObjectUrl) {
            if (!CustomImageManager.isCachedBlobUrl(mObjectUrl)) {
                URL.revokeObjectURL(mObjectUrl);
            }
            mObjectUrl = null;
        }

        if (mDisplaySrc !== null) {
            // Display-only override: shows a URL texture in the thumbnail without
            // touching mImageData (the serialisable custom image).
            mImgElement.src = mDisplaySrc;
        } else if (mImageData) {
            const mimeType = getMimeType(mImageName);
            const cachedUrl = CustomImageManager.getOrCreateBlobUrl(mImageData, mimeType);
            mObjectUrl = cachedUrl;
            mImgElement.src = cachedUrl;
        } else {
            mImgElement.src = '';
        }
        if (mCaptionElement) {
            mCaptionElement.textContent =
                mDisplaySrc !== null ? (mDisplayName || '') : (mImageName || '');
        }
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    async function onSelectClick() {
        if (!mFilePicker) {
            mFilePicker = createFileSelectionDialog({
                title:    'Select Image — ' + mName,
                filter:   'image',
                storageId: mStorageId,
                onSelect: async (item) => {
                    try {
                        const file   = await item.imageHandle.getFile();
                        const buffer = await file.arrayBuffer();
                        mImageData   = new Uint8Array(buffer);
                        mImageName   = item.getName();
                        mDisplaySrc  = null;   // clear URL override — show custom image
                        mDisplayName = null;
                        updateDisplay();
                        arg.onChange?.();
                    } catch (e) {
                        console.error('ParamImage: failed to read image file', e);
                    }
                },
            });
        }
        mFilePicker.show();
    }


    // ── Param interface ───────────────────────────────────────────────────────

    /**
     * Called by the param system during document save.
     * Registers raw image bytes with the active BinaryStore and returns a sentinel.
     * Returns null when no image is set or BinaryStore is unavailable.
     */
    function getValue() {
        if (!mImageData) return null;

        const store = getCurrentDocument()?.getBinaryStore();
        if (store) {
            const chunkName = store.getChunkName(mId);
            const meta      = mImageName ? { filename: mImageName } : {};
            return store.register(chunkName, 'image/png', mImageData, meta);
        }
        // No BinaryStore active — image data will be lost on this save path.
        return null;
    }

    /**
     * Called by the param system during document load.
     * Accepts a { __chunk } sentinel (resolves via BinaryLoader) or null (clear).
     */
    function setValue(value) {
        if (value === null || value === undefined) {
            mImageData   = null;
            mImageName   = '';
            mDisplaySrc  = null;
            mDisplayName = null;
            updateDisplay();
            return;
        }

        const loader = getCurrentDocument()?.getBinaryLoader();
        if (loader && BinaryLoader.isChunkSentinel(value)) {
            const ref = loader.getChunkRef(BinaryLoader.chunkName(value));
            if (ref && ref.isValid()) {
                mImageData   = ref.asUint8Array().slice(); // copy — don't hold buffer ref
                mImageName   = ref.meta?.filename ?? '';
                mDisplaySrc  = null;   // clear URL override — show restored image
                mDisplayName = null;
                updateDisplay();
                arg.onChange?.();
            }
        }
    }

    /**
     * Inject a custom <li> row into the dat.gui folder.
     * Layout mirrors imageSelector.js: thumbnail-container > thumbnail-image + thumbnail-caption.
     */
    function createUI(gui) {
        const li = document.createElement('li');
        li.className = 'cr param-image-row';
        // height is intentionally NOT set inline — dat.gui collapses by setting
        // height:0 on li via .dg .closed li { height:0 }.  The open-state
        // height:auto comes from the .param-image-row CSS rule in thumbnails.css.

        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:flex-start; padding:4px 6px 6px 6px; gap:6px;';

        // Label
        const label = document.createElement('span');
        label.textContent = mName + ':';
        label.style.cssText = 'font-size:11px; color: var(--text-color, #111); min-width:42px; flex-shrink:0; padding-top:4px;';

        // thumbnail-container (same structure as imageSelector.js)
        const container = document.createElement('div');
        container.className = 'thumbnail-container';
        container.style.cursor = 'pointer';
        container.title = 'Click to select image…';
        if (arg.width !== undefined) {
            container.style.width = mWidth + 'px';
        }
        if (mStretch) {
            container.style.width = '100%';
        }
        container.addEventListener('click', onSelectClick);

        // thumbnail-image
        mImgElement = document.createElement('img');
        mImgElement.className = 'thumbnail-image';
        mImgElement.width  = mWidth;
        mImgElement.height = mHeight;
        if (arg.width !== undefined) {
            mImgElement.style.width = mWidth + 'px';
        }
        if (arg.height !== undefined) {
            mImgElement.style.height = mHeight + 'px';
        }
        if (mStretch) {
            mImgElement.style.width = '100%';
            mImgElement.style.objectFit = 'fill';
        }

        // thumbnail-caption
        mCaptionElement = document.createElement('div');
        mCaptionElement.className = 'thumbnail-caption';

        container.append(mImgElement, mCaptionElement);
        if (mStretch) {
            row.append(container);
        } else {
            row.append(label, container);
        }
        li.appendChild(row);

        // Attach to the dat.gui folder's <ul>
        const ul = gui.__ul ?? gui.domElement?.querySelector?.('ul') ?? gui.domElement;
        ul.appendChild(li);

        updateDisplay();
    }

    /** Reset to no image (called by param system on init/load-default). */
    function init() {
        mImageData   = null;
        mImageName   = '';
        mDisplaySrc  = null;
        mDisplayName = null;
        updateDisplay();
    }

    return {
        getValue,
        setValue,
        createUI,
        updateDisplay,
        init,
        /** Returns the raw image bytes (Uint8Array | null). Used by owners (e.g. TextureFile). */
        getImageData: () => mImageData,
        /**
         * Display-only update: mirrors a URL-based texture in the thumbnail without
         * touching mImageData. Pass (null, null) to revert to the custom image display.
         */
        setDisplayImage(src, name) {
            mDisplaySrc  = src  ?? null;
            mDisplayName = name ?? null;
            updateDisplay();
        },
        serializable: (arg.serializable !== false),
    };

} // ParamImage
