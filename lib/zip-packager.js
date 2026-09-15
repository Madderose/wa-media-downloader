/**
 * WA Media Downloader — ZipPackager
 * Pure JavaScript PKZIP STORE (no compression) archive builder.
 * 
 * Compliant with PKZIP specification 2.0.
 * 100% Zero-Data: runs entirely client-side in memory with 0 network calls and 0 third-party dependencies.
 */

(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.ZipPackager = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this || {}), function () {
  'use strict';

  // Precomputed CRC-32 IEEE 802.3 lookup table
  const CRC_TABLE = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    CRC_TABLE[i] = c >>> 0;
  }

  /**
   * Calculate 32-bit Cyclic Redundancy Check (CRC-32)
   * @param {Uint8Array} bytes
   * @returns {number}
   */
  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    const len = bytes.length;
    for (let i = 0; i < len; i++) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /**
   * Convert JavaScript Date to MS-DOS date and time formats
   * @param {Date} [date]
   * @returns {{ time: number, date: number }}
   */
  function dosDateTime(date = new Date()) {
    const d = (date instanceof Date && !isNaN(date.getTime())) ? date : new Date();
    const time = ((d.getHours() & 0x1F) << 11) |
                 ((d.getMinutes() & 0x3F) << 5) |
                 ((Math.floor(d.getSeconds() / 2)) & 0x1F);

    const year = Math.max(1980, d.getFullYear());
    const dt = (((year - 1980) & 0x7F) << 9) |
               (((d.getMonth() + 1) & 0x0F) << 5) |
               (d.getDate() & 0x1F);

    return { time, date: dt };
  }

  /**
   * Sanitize filename to ensure validity inside zip archives
   * @param {string} filename
   * @returns {string}
   */
  function sanitizeZipFilename(filename) {
    if (!filename) return 'unnamed_file';
    return filename
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/[:*?"<>|]/g, '_');
  }

  /**
   * Normalize various data inputs into a Uint8Array
   * @param {string|Uint8Array|ArrayBuffer|Blob} data
   * @returns {Promise<Uint8Array>}
   */
  async function toUint8Array(data) {
    if (typeof data === 'string') {
      return new TextEncoder().encode(data);
    }
    if (data instanceof Uint8Array) {
      return data;
    }
    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      const buffer = await data.arrayBuffer();
      return new Uint8Array(buffer);
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    return new Uint8Array(0);
  }

  /**
   * Build an in-memory ZIP archive from a list of files
   * @param {Array<{ name: string, data: string|Uint8Array|ArrayBuffer|Blob, date?: Date }>} files
   * @param {Function} [onProgress] - Optional callback: (completed, total, currentFileName) => void
   * @returns {Promise<Blob>}
   */
  async function createZipBlob(files, onProgress) {
    const parts = [];
    const centralDirectoryParts = [];
    let currentOffset = 0;
    const encoder = new TextEncoder();
    const total = files.length;

    for (let index = 0; index < total; index++) {
      const file = files[index];
      const safeName = sanitizeZipFilename(file.name);
      const nameBytes = encoder.encode(safeName);
      const fileBytes = await toUint8Array(file.data);
      const fileCrc = crc32(fileBytes);
      const { time: dosTime, date: dosDate } = dosDateTime(file.date || new Date());
      const fileSize = fileBytes.length;

      // 1. Local File Header (30 bytes + filename)
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(localHeader.buffer);

      lv.setUint32(0, 0x04034b50, true); // Local file header signature
      lv.setUint16(4, 20, true);          // Version needed to extract (2.0)
      lv.setUint16(6, 0x0800, true);      // General purpose bit flag (Bit 11: UTF-8 filename)
      lv.setUint16(8, 0, true);           // Compression method (0 = STORE, uncompressed)
      lv.setUint16(10, dosTime, true);    // Last mod file time
      lv.setUint16(12, dosDate, true);    // Last mod file date
      lv.setUint32(14, fileCrc, true);    // CRC-32
      lv.setUint32(18, fileSize, true);   // Compressed size
      lv.setUint32(22, fileSize, true);   // Uncompressed size
      lv.setUint16(26, nameBytes.length, true); // Filename length
      lv.setUint16(28, 0, true);          // Extra field length
      localHeader.set(nameBytes, 30);     // Filename

      // 2. Central Directory Header (46 bytes + filename)
      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(centralHeader.buffer);

      cv.setUint32(0, 0x02014b50, true);      // Central directory header signature
      cv.setUint16(4, 0x0014, true);          // Version made by (DOS 2.0)
      cv.setUint16(6, 20, true);              // Version needed to extract (2.0)
      cv.setUint16(8, 0x0800, true);          // General purpose bit flag (Bit 11: UTF-8)
      cv.setUint16(10, 0, true);              // Compression method (0 = STORE)
      cv.setUint16(12, dosTime, true);        // Last mod file time
      cv.setUint16(14, dosDate, true);        // Last mod file date
      cv.setUint32(16, fileCrc, true);        // CRC-32
      cv.setUint32(20, fileSize, true);       // Compressed size
      cv.setUint32(24, fileSize, true);       // Uncompressed size
      cv.setUint16(28, nameBytes.length, true); // Filename length
      cv.setUint16(30, 0, true);              // Extra field length
      cv.setUint16(32, 0, true);              // File comment length
      cv.setUint16(34, 0, true);              // Disk number start
      cv.setUint16(36, 0, true);              // Internal file attributes
      cv.setUint32(38, 0, true);              // External file attributes
      cv.setUint32(42, currentOffset, true);  // Relative offset of local header
      centralHeader.set(nameBytes, 46);       // Filename

      // Append local header and file data
      parts.push(localHeader);
      parts.push(fileBytes);
      currentOffset += localHeader.length + fileBytes.length;

      // Store central directory entry
      centralDirectoryParts.push(centralHeader);

      if (typeof onProgress === 'function') {
        onProgress(index + 1, total, safeName);
      }
    }

    // Offset of start of central directory
    const centralDirectoryStart = currentOffset;
    let centralDirectorySize = 0;
    for (const part of centralDirectoryParts) {
      parts.push(part);
      centralDirectorySize += part.length;
    }

    // 3. End of Central Directory Record (EOCD, 22 bytes)
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);            // EOCD signature
    ev.setUint16(4, 0, true);                     // Number of this disk
    ev.setUint16(6, 0, true);                     // Disk where central directory starts
    ev.setUint16(8, files.length, true);          // Number of central directory records on this disk
    ev.setUint16(10, files.length, true);         // Total number of central directory records
    ev.setUint32(12, centralDirectorySize, true); // Size of central directory
    ev.setUint32(16, centralDirectoryStart, true);// Offset of start of central directory
    ev.setUint16(20, 0, true);                    // Comment length

    parts.push(eocd);

    return new Blob(parts, { type: 'application/zip' });
  }

  /**
   * Helper to build a Uint8Array containing the entire ZIP binary (useful in Node.js/unit tests)
   * @param {Array<{ name: string, data: string|Uint8Array|ArrayBuffer|Blob, date?: Date }>} files
   * @param {Function} [onProgress]
   * @returns {Promise<Uint8Array>}
   */
  async function createZipBuffer(files, onProgress) {
    const blob = await createZipBlob(files, onProgress);
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  return {
    crc32,
    dosDateTime,
    sanitizeZipFilename,
    createZipBlob,
    createZipBuffer
  };
});
