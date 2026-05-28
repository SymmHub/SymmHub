/**
 * CustomImageManager.js
 * 
 * Manages caching, deduplication, and coalesced loading of custom images/textures.
 */

// Initialize the global cache on window if not already present.
if (!window.__symCustomImageCache) {
    window.__symCustomImageCache = {
        blobUrls: new Map(),
        decodedImages: new Map(),
        loadingImages: new Map()
    };
}
const gImageCache = window.__symCustomImageCache;

const MAX_CACHED_IMAGES_COUNT = 50;

/**
 * Computes a fast, collision-resistant hash of a Uint8Array by sampling up to 200 bytes.
 * @param {Uint8Array} array 
 * @returns {string}
 */
export function getFastHash(array) {
    if (!array) return '';
    const len = array.length;
    let hash = 0;
    const step = Math.max(1, Math.floor(len / 200));
    for (let i = 0; i < len; i += step) {
        hash = (hash * 31 + array[i]) | 0;
    }
    return `${len}_${hash}`;
}

/**
 * Gets or creates a Blob URL for the given Uint8Array and mimeType.
 * Caches the result to avoid duplicate Blob URLs.
 * 
 * @param {Uint8Array} data 
 * @param {string} mimeType 
 * @returns {string}
 */
export function getOrCreateBlobUrl(data, mimeType = 'image/png') {
    const hash = getFastHash(data);
    let url = gImageCache.blobUrls.get(hash);
    if (!url) {
        const blob = new Blob([data], { type: mimeType });
        url = URL.createObjectURL(blob);
        gImageCache.blobUrls.set(hash, url);
    }
    return url;
}

/**
 * Checks if a Blob URL belongs to the CustomImageManager cache.
 * Used to prevent revoking globally cached Blob URLs.
 * 
 * @param {string} url 
 * @returns {boolean}
 */
export function isCachedBlobUrl(url) {
    for (const cachedUrl of gImageCache.blobUrls.values()) {
        if (cachedUrl === url) return true;
    }
    return false;
}

/**
 * Promotes the cached image for the given hash to the end of the Map (Most Recently Used).
 * @param {string} hash 
 */
function touch(hash) {
    if (gImageCache.decodedImages.has(hash)) {
        const img = gImageCache.decodedImages.get(hash);
        gImageCache.decodedImages.delete(hash);
        gImageCache.decodedImages.set(hash, img);
    }
}

/**
 * Adds a decoded image to the cache. Evicts the Least Recently Used (oldest) 
 * image and revokes its Blob URL if the cache size exceeds MAX_CACHED_IMAGES_COUNT.
 * @param {string} hash 
 * @param {HTMLImageElement} img 
 */
function addToCache(hash, img) {
    if (gImageCache.decodedImages.has(hash)) {
        gImageCache.decodedImages.delete(hash);
    }
    gImageCache.decodedImages.set(hash, img);

    // Evict if we exceeded the cap
    if (gImageCache.decodedImages.size > MAX_CACHED_IMAGES_COUNT) {
        const oldestHash = gImageCache.decodedImages.keys().next().value;
        gImageCache.decodedImages.delete(oldestHash);
        
        // Retrieve and revoke the Blob URL corresponding to this evicted image
        const url = gImageCache.blobUrls.get(oldestHash);
        if (url) {
            URL.revokeObjectURL(url);
            gImageCache.blobUrls.delete(oldestHash);
        }
    }
}

/**
 * Loads a custom image by hash and data.
 * - If already decoded/cached, calls onSuccess synchronously.
 * - If currently loading, registers a completion callback on the active load.
 * - If not loaded, starts a new load, caches it, and calls completion callbacks.
 * 
 * Returns the HTMLImageElement (either decoded, loading, or newly created).
 * 
 * @param {Uint8Array} data 
 * @param {object} callbacks 
 * @param {function} callbacks.onSuccess - (img) => void
 * @param {function} callbacks.onError   - () => void
 * @returns {HTMLImageElement}
 */
export function loadCustomImage(data, { onSuccess, onError }) {
    const hash = getFastHash(data);

    // 1. Hit decoded cache
    if (gImageCache.decodedImages.has(hash)) {
        const cachedImg = gImageCache.decodedImages.get(hash);
        touch(hash);
        onSuccess?.(cachedImg);
        return cachedImg;
    }

    // 2. Hit loading cache (coalesce concurrent load)
    if (gImageCache.loadingImages.has(hash)) {
        const loadingImg = gImageCache.loadingImages.get(hash);
        
        const onLoad = () => {
            loadingImg.removeEventListener('load', onLoad);
            loadingImg.removeEventListener('error', onErrorWrapper);
            touch(hash);
            onSuccess?.(loadingImg);
        };
        const onErrorWrapper = () => {
            loadingImg.removeEventListener('load', onLoad);
            loadingImg.removeEventListener('error', onErrorWrapper);
            onError?.();
        };

        loadingImg.addEventListener('load', onLoad);
        loadingImg.addEventListener('error', onErrorWrapper);
        return loadingImg;
    }

    // 3. Cache Miss
    const url = getOrCreateBlobUrl(data);
    const img = new Image();
    gImageCache.loadingImages.set(hash, img);

    const onLoad = () => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onErrorWrapper);
        gImageCache.loadingImages.delete(hash);
        addToCache(hash, img);
        onSuccess?.(img);
    };

    const onErrorWrapper = () => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onErrorWrapper);
        gImageCache.loadingImages.delete(hash);
        onError?.();
    };

    img.addEventListener('load', onLoad);
    img.addEventListener('error', onErrorWrapper);
    img.src = url;
    return img;
}

export const CustomImageManager = {
    getFastHash,
    getOrCreateBlobUrl,
    isCachedBlobUrl,
    loadCustomImage
};
