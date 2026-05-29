/**
 * tiff_util.js
 *
 * Custom uncompressed RGBA TIFF encoder utility.
 */

export function createTiffBlob(width, height, rgbaData) {
    const pixelDataSize = width * height * 4;
    const bitsPerSampleOffset = 8 + pixelDataSize;
    const ifdOffset = bitsPerSampleOffset + 8; // 8 bytes for sample array [8, 8, 8, 8]
    const fileSize = ifdOffset + 2 + 132 + 4; // count(2) + 11 entries(132) + nextIFD(4)

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    // 1. Write Header
    view.setUint16(0, 0x4949, true); // Little endian 'II'
    view.setUint16(2, 42, true);     // Magic 42
    view.setUint32(4, ifdOffset, true); // Offset to first IFD

    // 2. Write pixel data
    uint8.set(rgbaData, 8);

    // 3. Write BitsPerSample value array [8, 8, 8, 8]
    view.setUint16(bitsPerSampleOffset, 8, true);
    view.setUint16(bitsPerSampleOffset + 2, 8, true);
    view.setUint16(bitsPerSampleOffset + 4, 8, true);
    view.setUint16(bitsPerSampleOffset + 6, 8, true);

    // 4. Write IFD
    let offset = ifdOffset;
    view.setUint16(offset, 11, true); // Number of entries (11)
    offset += 2;

    function writeEntry(tag, type, count, valOrOffset) {
        view.setUint16(offset, tag, true);
        view.setUint16(offset + 2, type, true);
        view.setUint32(offset + 4, count, true);
        view.setUint32(offset + 8, valOrOffset, true);
        offset += 12;
    }

    // Tags sorted in ascending order
    writeEntry(256, 4, 1, width);                     // ImageWidth
    writeEntry(257, 4, 1, height);                    // ImageLength
    writeEntry(258, 3, 4, bitsPerSampleOffset);        // BitsPerSample
    writeEntry(259, 3, 1, 1);                         // Compression (1 = None)
    writeEntry(262, 3, 1, 2);                         // PhotometricInterpretation (2 = RGB)
    writeEntry(273, 4, 1, 8);                         // StripOffsets
    writeEntry(274, 3, 1, 4);                         // Orientation (4 = Bottom-Left)
    writeEntry(277, 3, 1, 4);                         // SamplesPerPixel (4 = RGBA)
    writeEntry(278, 4, 1, height);                    // RowsPerStrip
    writeEntry(279, 4, 1, pixelDataSize);             // StripByteCounts
    writeEntry(338, 3, 1, 2);                         // ExtraSamples (2 = Unassociated Alpha)

    // Next IFD offset (0)
    view.setUint32(offset, 0, true);

    return new Blob([buffer], { type: 'image/tiff' });
}
