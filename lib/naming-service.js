/**
 * WA Media Downloader — NamingService
 * Chronological timestamp parsing, human-readable file naming, and collision prevention.
 * 
 * 100% Zero-Data: runs entirely client-side in memory.
 */

(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.NamingService = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this || {}), function () {
  'use strict';

  const sessionUsedFilenames = new Set();
  const sessionBaseCounts = new Map();

  /**
   * Helper to look backwards in DOM for a date bubble in the chat stream
   * @param {Element} el
   * @returns {{ year: string, month: string, day: string } | null}
   */
  function findPrecedingChatDate(el) {
    try {
      const row = el.closest('[data-id], [role="row"], .message-in, .message-out') || el;
      let prev = row.previousElementSibling;
      let count = 0;
      while (prev && count < 50) {
        count++;
        const dateBubble = prev.querySelector('[data-testid="chat-date-bubble"]') 
          || (prev.getAttribute('data-testid') === 'chat-date-bubble' ? prev : null);
        const text = (dateBubble ? dateBubble.textContent : (prev.matches?.('[data-id]') ? '' : prev.textContent)) || '';
        const clean = text.trim();
        
        if (clean) {
          const lower = clean.toLowerCase();
          if (lower === 'today' || lower === "aujourd'hui" || lower === 'hoy' || lower === 'heute') {
            const now = new Date();
            return {
              year: String(now.getFullYear()),
              month: String(now.getMonth() + 1).padStart(2, '0'),
              day: String(now.getDate()).padStart(2, '0')
            };
          }
          if (lower === 'yesterday' || lower === 'hier' || lower === 'ayer' || lower === 'gestern') {
            const yest = new Date(Date.now() - 86400000);
            return {
              year: String(yest.getFullYear()),
              month: String(yest.getMonth() + 1).padStart(2, '0'),
              day: String(yest.getDate()).padStart(2, '0')
            };
          }
          const dm = clean.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b/);
          if (dm) {
            return {
              year: dm[3],
              month: String(parseInt(dm[2], 10)).padStart(2, '0'),
              day: String(parseInt(dm[1], 10)).padStart(2, '0')
            };
          }
        }
        prev = prev.previousElementSibling;
      }
    } catch (e) {}
    return null;
  }

  /**
   * Convert raw WhatsApp timestamp into human-readable, filesystem-safe format (YYYY-MM-DD_HHhmm)
   * @param {string|Date} rawTimestamp
   * @param {Element} [contextEl]
   * @returns {string}
   */
  function formatHumanTimestamp(rawTimestamp, contextEl = null) {
    if (rawTimestamp instanceof Date) {
      const y = rawTimestamp.getFullYear();
      const mo = String(rawTimestamp.getMonth() + 1).padStart(2, '0');
      const da = String(rawTimestamp.getDate()).padStart(2, '0');
      const ho = String(rawTimestamp.getHours()).padStart(2, '0');
      const mi = String(rawTimestamp.getMinutes()).padStart(2, '0');
      return `${y}-${mo}-${da}_${ho}h${mi}`;
    }

    let str = (rawTimestamp || '').trim().replace(/^\[|\]$/g, '').trim();
    let year = null;
    let month = null;
    let day = null;
    let hour = null;
    let minute = null;
    let second = null;

    // 1. Extract Time: HH:mm[:ss] [AM|PM]
    const timeMatch = str.match(/\b(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(AM|PM)?\b/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      const s = timeMatch[3] ? parseInt(timeMatch[3], 10) : null;
      const ampm = timeMatch[4] ? timeMatch[4].toUpperCase() : null;

      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;

      hour = String(h).padStart(2, '0');
      minute = String(m).padStart(2, '0');
      if (s !== null) second = String(s).padStart(2, '0');
    }

    // 2. Extract Date: YYYY[-/.]MM[-/.]DD or DD[-/.]MM[-/.]YYYY or MM[-/.]DD[-/.]YYYY
    const yfirstMatch = str.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
    if (yfirstMatch) {
      year = yfirstMatch[1];
      month = String(parseInt(yfirstMatch[2], 10)).padStart(2, '0');
      day = String(parseInt(yfirstMatch[3], 10)).padStart(2, '0');
    } else {
      const ylastMatch = str.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|[12]\d|3[01])[-/.](20\d{2})\b/);
      if (ylastMatch) {
        const part1 = parseInt(ylastMatch[1], 10);
        const part2 = parseInt(ylastMatch[2], 10);
        year = ylastMatch[3];
        if (part1 > 12) {
          day = String(part1).padStart(2, '0');
          month = String(part2).padStart(2, '0');
        } else if (part2 > 12) {
          month = String(part1).padStart(2, '0');
          day = String(part2).padStart(2, '0');
        } else {
          const lang = (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'fr').toLowerCase();
          if (lang.startsWith('en-us')) {
            month = String(part1).padStart(2, '0');
            day = String(part2).padStart(2, '0');
          } else {
            day = String(part1).padStart(2, '0');
            month = String(part2).padStart(2, '0');
          }
        }
      }
    }

    // 3. Fallback for date if not in timestamp
    if (!year || !month || !day) {
      let chatDate = null;
      if (contextEl) chatDate = findPrecedingChatDate(contextEl);
      if (chatDate) {
        year = chatDate.year;
        month = chatDate.month;
        day = chatDate.day;
      } else {
        const now = new Date();
        year = String(now.getFullYear());
        month = String(now.getMonth() + 1).padStart(2, '0');
        day = String(now.getDate()).padStart(2, '0');
      }
    }

    // 4. Fallback for time
    if (!hour || !minute) {
      const now = new Date();
      hour = String(now.getHours()).padStart(2, '0');
      minute = String(now.getMinutes()).padStart(2, '0');
    }

    const timePart = second ? `${hour}h${minute}m${second}` : `${hour}h${minute}`;
    return `${year}-${month}-${day}_${timePart}`;
  }

  /**
   * Safely sanitize a filename while preserving international Unicode characters (accents, non-Latin scripts)
   * Removes only illegal filesystem characters: \ / : * ? " < > | and control characters.
   * @param {string} name
   * @param {number} [maxLength=40]
   * @returns {string}
   */
  function sanitizeFilename(name, maxLength = 40) {
    if (!name || typeof name !== 'string') return 'unnamed';
    const cleaned = name
      .replace(/[\\/:*?"<>|\x00-\x1F]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    return (cleaned.slice(0, maxLength) || 'document');
  }

  /**
   * Assign unique filenames to a batch of media items, with sequential numbering for duplicate timestamps
   * @param {Array<Object>} items
   * @returns {Array<Object>}
   */
  function assignBatchFilenames(items) {
    if (!items || items.length === 0) return items;

    const countMap = new Map();

    // 1. Determine baseKey and ext for each item
    for (const item of items) {
      const ts = item.humanTimestamp || formatHumanTimestamp(item.timestamp, item.element || item.row);
      item.humanTimestamp = ts;

      if (item.type === 'image') {
        item._prefix = 'WA_IMG_';
        item._ext = 'jpg';
        item._baseKey = `WA_IMG_${ts}`;
      } else if (item.type === 'video') {
        item._prefix = 'WA_VID_';
        item._ext = 'mp4';
        item._baseKey = `WA_VID_${ts}`;
      } else if (item.type === 'audio') {
        item._prefix = 'WA_AUD_';
        item._ext = 'ogg';
        item._baseKey = `WA_AUD_${ts}`;
      } else if (item.type === 'doc') {
        const orig = (item.rawFilename || item.filename || 'document').trim();
        const dotIdx = orig.lastIndexOf('.');
        const ext = dotIdx > 0 ? orig.slice(dotIdx + 1).toLowerCase() : 'bin';
        const rawBase = dotIdx > 0 ? orig.slice(0, dotIdx) : orig;
        const cleanBase = sanitizeFilename(rawBase, 40);
        item._prefix = 'WA_DOC_';
        item._ext = ext;
        item._docBase = cleanBase;
        item._baseKey = `WA_DOC_${ts}_${cleanBase}`;
      } else {
        item._prefix = 'WA_FILE_';
        item._ext = 'bin';
        item._baseKey = `WA_FILE_${ts}`;
      }

      const fullKey = `${item._baseKey}.${item._ext}`;
      countMap.set(fullKey, (countMap.get(fullKey) || 0) + 1);
    }

    // 2. Assign unique filenames, numbering duplicates sequentially (_01, _02, etc.)
    const batchIndexMap = new Map();
    for (const item of items) {
      const fullKey = `${item._baseKey}.${item._ext}`;
      const totalInBatch = countMap.get(fullKey) || 1;
      const priorCount = sessionBaseCounts.get(fullKey) || 0;

      let filename = '';
      if (totalInBatch > 1 || priorCount > 0) {
        const idx = (batchIndexMap.get(fullKey) || 0) + 1;
        batchIndexMap.set(fullKey, idx);
        const seqNum = String(priorCount + idx).padStart(2, '0');
        filename = `${item._baseKey}_${seqNum}.${item._ext}`;
      } else {
        filename = `${item._baseKey}.${item._ext}`;
      }

      // Failsafe: if filename was already used in this session, increment until unique
      let collisionCounter = 2;
      while (sessionUsedFilenames.has(filename)) {
        const seqNum = String(collisionCounter++).padStart(2, '0');
        filename = `${item._baseKey}_${seqNum}.${item._ext}`;
      }

      sessionUsedFilenames.add(filename);
      item.assignedFilename = filename;
      item.filename = filename;
    }

    // 3. Update session base counts for cross-batch deduplication
    for (const [key, count] of countMap.entries()) {
      sessionBaseCounts.set(key, (sessionBaseCounts.get(key) || 0) + count);
    }

    return items;
  }

  function resetSessionNaming() {
    sessionUsedFilenames.clear();
    sessionBaseCounts.clear();
  }

  return {
    findPrecedingChatDate,
    formatHumanTimestamp,
    sanitizeFilename,
    assignBatchFilenames,
    resetSessionNaming,
    sessionUsedFilenames,
    sessionBaseCounts
  };
});
