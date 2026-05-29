/**
 * exportImage.js
 *
 * Slices large canvas resolution into smaller sequential tiles and exports them,
 * or saves a single full-resolution frame if it is under the tile threshold.
 */

import { writeFile } from './modules.js';

const TMB_WIDTH = 256;

export async function exportTiledImage(chosenName, folderHandle, exportWidth, exportHeight, exportTileSize, origSize, origZoom, origCenter, renderer) {
    let writer;
    try {
        exportTileSize = Math.max(16, Math.round(exportTileSize / 16) * 16);
        const pixelSize_orig = 2.0 / (exportWidth * origZoom);

        // Write parameter files
        const writeParamPromise = renderer.writeDocumentToFolder(folderHandle, chosenName + '.png');

        // Render thumbnail of the full scene by temporarily rendering at TMB_WIDTH x TMB_WIDTH
        renderer.setCanvaSize(TMB_WIDTH, TMB_WIDTH);
        renderer.canvasTransform.setZoom(origZoom);
        renderer.canvasTransform.setCenter(origCenter);
        renderer.renderFrame();
        const tmbCanvas = renderer.makeThumbnail();
        const tmbPromise = new Promise(resolve => tmbCanvas.toBlob(resolve, 'image/png'))
            .then(blob => writeFile(folderHandle, chosenName + '.png.json.png', blob));

        await Promise.all([writeParamPromise, tmbPromise]);

        // Get file handle for TIFF and create a writable stream
        const tifFileHandle = await folderHandle.getFileHandle(chosenName + '.tif', { create: true });
        writer = await tifFileHandle.createWritable();

        // 1. Write TIFF Header (8 bytes) with offset placeholder 0
        const header = new ArrayBuffer(8);
        const headerView = new DataView(header);
        headerView.setUint16(0, 0x4949, true); // 'II'
        headerView.setUint16(2, 42, true);     // 42
        headerView.setUint32(4, 0, true);      // placeholder for IFD offset
        await writer.write(header);

        // Calculate the grid of tiles
        const cols = Math.ceil(exportWidth / exportTileSize);
        const rows = Math.ceil(exportHeight / exportTileSize);

        const tileOffsets = [];
        const tileByteCounts = [];
        let currentOffset = 8;
        const tileByteCount = exportTileSize * exportTileSize * 4;

        // Resize canvas to the identical tile size
        renderer.setCanvaSize(exportTileSize, exportTileSize);

        const gl = renderer.glCanvas.getContext('webgl2') || renderer.glCanvas.getContext('webgl');
        const pixels = new Uint8Array(tileByteCount);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Calculate tile transformation
                const tile_zoom = origZoom * (exportWidth / exportTileSize);
                const tile_centerX = origCenter[0] + ((c + 0.5) * exportTileSize - exportWidth / 2) * pixelSize_orig;
                const tile_centerY = origCenter[1] + ((r + 0.5) * exportTileSize - exportHeight / 2) * pixelSize_orig;

                renderer.canvasTransform.setZoom(tile_zoom);
                renderer.canvasTransform.setCenter([tile_centerX, tile_centerY]);

                // Render tile
                renderer.renderFrame();

                // Read pixels directly from WebGL canvas
                gl.readPixels(0, 0, exportTileSize, exportTileSize, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

                // Save offset and write tile pixel data to the stream
                tileOffsets.push(currentOffset);
                tileByteCounts.push(tileByteCount);

                await writer.write(pixels);
                currentOffset += tileByteCount;
            }
        }

        // 2. Write BitsPerSample value array [8, 8, 8, 8]
        const bitsPerSampleOffset = currentOffset;
        const bpsBuffer = new ArrayBuffer(8);
        const bpsView = new DataView(bpsBuffer);
        bpsView.setUint16(0, 8, true);
        bpsView.setUint16(2, 8, true);
        bpsView.setUint16(4, 8, true);
        bpsView.setUint16(6, 8, true);
        await writer.write(bpsBuffer);
        currentOffset += 8;

        // 3. Write TileOffsets array
        const tileOffsetsOffset = currentOffset;
        const offsetsBuffer = new ArrayBuffer(cols * rows * 4);
        const offsetsView = new DataView(offsetsBuffer);
        for (let i = 0; i < tileOffsets.length; i++) {
            offsetsView.setUint32(i * 4, tileOffsets[i], true);
        }
        await writer.write(offsetsBuffer);
        currentOffset += cols * rows * 4;

        // 4. Write TileByteCounts array
        const tileByteCountsOffset = currentOffset;
        const byteCountsBuffer = new ArrayBuffer(cols * rows * 4);
        const byteCountsView = new DataView(byteCountsBuffer);
        for (let i = 0; i < tileByteCounts.length; i++) {
            byteCountsView.setUint32(i * 4, tileByteCounts[i], true);
        }
        await writer.write(byteCountsBuffer);
        currentOffset += cols * rows * 4;

        // 5. Write IFD (Image File Directory)
        const ifdOffset = currentOffset;
        const ifdBuffer = new ArrayBuffer(150);
        const ifdView = new DataView(ifdBuffer);

        ifdView.setUint16(0, 12, true); // 12 entries
        let entryOffset = 2;

        function writeEntry(tag, type, count, valOrOffset) {
            ifdView.setUint16(entryOffset, tag, true);
            ifdView.setUint16(entryOffset + 2, type, true);
            ifdView.setUint32(entryOffset + 4, count, true);
            ifdView.setUint32(entryOffset + 8, valOrOffset, true);
            entryOffset += 12;
        }

        // Tags sorted in ascending order
        writeEntry(256, 4, 1, exportWidth);                               // ImageWidth
        writeEntry(257, 4, 1, exportHeight);                              // ImageLength
        writeEntry(258, 3, 4, bitsPerSampleOffset);                       // BitsPerSample
        writeEntry(259, 3, 1, 1);                                         // Compression (1 = none)
        writeEntry(262, 3, 1, 2);                                         // PhotometricInterpretation (2 = RGB)
        writeEntry(274, 3, 1, 4);                                         // Orientation (4 = Bottom-Left)
        writeEntry(277, 3, 1, 4);                                         // SamplesPerPixel (4 = RGBA)
        writeEntry(322, 4, 1, exportTileSize);                            // TileWidth
        writeEntry(323, 4, 1, exportTileSize);                            // TileLength
        writeEntry(324, 4, cols * rows, tileOffsetsOffset);                // TileOffsets
        writeEntry(325, 4, cols * rows, tileByteCountsOffset);            // TileByteCounts
        writeEntry(338, 3, 1, 2);                                         // ExtraSamples (2 = Unassociated Alpha)

        // Next IFD Offset (0)
        ifdView.setUint32(entryOffset, 0, true);

        await writer.write(ifdBuffer);

        // 6. Write final IFD offset into the header (at position 4)
        const offsetBuf = new ArrayBuffer(4);
        new DataView(offsetBuf).setUint32(0, ifdOffset, true);
        await writer.write({ type: 'write', position: 4, data: offsetBuf });

        // Close stream successfully
        await writer.close();
        writer = null;

        renderer.exportWidth = exportWidth;
        renderer.exportHeight = exportHeight;

    } catch (err) {
        console.error("Failed to export tiled image:", err);
    } finally {
        if (writer) {
            try {
                await writer.close();
            } catch (e) {
                console.error("Failed to close writer in finally block:", e);
            }
        }
        // Restore original canvas size, zoom, center, and repaint
        renderer.setCanvaSize(origSize.width, origSize.height);
        renderer.canvasTransform.setZoom(origZoom);
        renderer.canvasTransform.setCenter(origCenter);
        renderer.setIsExporting(false);
        renderer.renderFrame();
    }
}

export async function exportImage(chosenName, folderHandle, exportWidth, exportHeight, renderer) {
    renderer.setIsExporting(true);
    const origSize = renderer.getCanvasSize();
    const origZoom = renderer.canvasTransform.getZoom()[0];
    const origCenter = renderer.canvasTransform.getCenter();

    let exportTileSize = renderer.exportTileSize || 2048;
    exportTileSize = Math.max(16, Math.round(exportTileSize / 16) * 16);

    if (exportWidth > exportTileSize || exportHeight > exportTileSize) {
        await exportTiledImage(chosenName, folderHandle, exportWidth, exportHeight, exportTileSize, origSize, origZoom, origCenter, renderer);
    } else {
        // Normal export flow
        renderer.setCanvaSize(exportWidth, exportHeight);

        renderer.renderFrame();

        const tmbCanvas = renderer.makeThumbnail();
        const tmbPromise = new Promise(resolve => tmbCanvas.toBlob(resolve, 'image/png'))
            .then(blob => writeFile(folderHandle, chosenName + '.png.json.png', blob));

        Promise.all([
            renderer.saveImageTo(
                renderer.glCanvas,
                folderHandle,
                chosenName,
                null
            ),
            renderer.writeDocumentToFolder(folderHandle, chosenName + '.png'),
            tmbPromise
        ]).then(() => {
            renderer.exportWidth = exportWidth;
            renderer.exportHeight = exportHeight;

            renderer.setCanvaSize(origSize.width, origSize.height);
            renderer.canvasTransform.setZoom(origZoom);
            renderer.canvasTransform.setCenter(origCenter);

            renderer.setIsExporting(false);
            renderer.renderFrame();
        }).catch(err => {
            console.error("Failed to export image:", err);
            renderer.setCanvaSize(origSize.width, origSize.height);
            renderer.canvasTransform.setZoom(origZoom);
            renderer.canvasTransform.setCenter(origCenter);

            renderer.setIsExporting(false);
            renderer.renderFrame();
        });
    }
}
