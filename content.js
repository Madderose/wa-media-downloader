// Safe shim for standalone/Playwright injection environments
if (typeof chrome === 'undefined' || !chrome.runtime) {
  window.chrome = window.chrome || {};
  window.chrome.runtime = {
    lastError: null,
    onMessage: {
      listeners: [],
      addListener(fn) { this.listeners.push(fn); },
      dispatch(msg, sendResponse) {
        this.listeners.forEach(fn => fn(msg, {}, sendResponse || (() => {})));
      }
    },
    sendMessage(msg, cb) {
      if (typeof cb === 'function') cb();
    }
  };
}

// Development debug logging flag — must remain FALSE in production/AMO releases
const DEBUG_SERVER_LOGS = false;

let cancelDownload = false;
let selectionModeActive = false;
let lastCheckedIndex = -1;
let observerAttached = false;
const selectedMessageIds = new Set();
const selectedMediaCache = new Map(); // msgId -> mediaItem

// Unified Logger: writes to console and optionally forwards to background logger
function remoteLog(...args) {
  console.log('[WA-Downloader]', ...args);
  if (!DEBUG_SERVER_LOGS) return;
  try {
    const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    chrome.runtime.sendMessage({ action: 'log', message: `[CONTENT] ${text}` }, () => {
      if (chrome.runtime.lastError) {}
    });
  } catch (e) {}
}

// Inject In-Page Styles for Selection Mode & Floating UI
function ensureInPageStyles() {
  if (document.getElementById('wa-downloader-inpage-styles')) return;
  const style = document.createElement('style');
  style.id = 'wa-downloader-inpage-styles';
  style.textContent = `
    /* Floating trigger badge in WhatsApp header */
    .wa-dl-header-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      margin-right: 8px;
      background: linear-gradient(135deg, rgba(0, 168, 132, 0.2), rgba(0, 168, 132, 0.35));
      border: 1px solid rgba(0, 168, 132, 0.5);
      border-radius: 20px;
      color: #00a884;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s ease;
      z-index: 100;
    }
    .wa-dl-header-badge:hover {
      background: rgba(0, 168, 132, 0.3);
      box-shadow: 0 2px 8px rgba(0, 168, 132, 0.3);
      transform: translateY(-1px);
    }
    .wa-dl-header-badge.active {
      background: #00a884;
      color: #ffffff;
      border-color: #00a884;
      box-shadow: 0 0 12px rgba(0, 168, 132, 0.5);
    }

    /* Message Selection Checkbox Overlay */
    .wa-dl-checkbox-wrap {
      position: absolute;
      top: 6px;
      left: 6px;
      z-index: 999;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: rgba(17, 27, 33, 0.9);
      border: 1.5px solid #00a884;
      box-shadow: 0 2px 8px rgba(0,0,0,0.45);
      cursor: pointer;
      transition: transform 0.15s ease;
    }
    .wa-dl-checkbox-wrap:hover {
      transform: scale(1.12);
    }
    .wa-dl-checkbox-wrap input[type="checkbox"] {
      cursor: pointer;
      width: 16px;
      height: 16px;
      accent-color: #00a884;
      margin: 0;
    }

    /* Highlight on selected message row */
    .wa-dl-selected-row {
      outline: 2px solid #00a884 !important;
      outline-offset: 2px;
      box-shadow: 0 0 14px rgba(0, 168, 132, 0.35) !important;
      border-radius: 8px !important;
      transition: all 0.2s ease;
    }

    /* Bottom Floating Action Bar */
    .wa-dl-action-bar {
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(17, 27, 33, 0.94);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 168, 132, 0.45);
      border-radius: 18px;
      padding: 12px 20px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65), 0 0 20px rgba(0, 168, 132, 0.15);
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 12px;
      color: #e9edef;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      box-sizing: border-box;
      max-width: 95vw;
      animation: waDlSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes waDlSlideUp {
      from { transform: translate(-50%, 30px); opacity: 0; }
      to { transform: translate(-50%, 0); opacity: 1; }
    }

    .wa-dl-bar-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      color: #ffffff;
      padding-right: 8px;
      border-right: 1px solid rgba(255, 255, 255, 0.15);
      white-space: nowrap;
    }

    .wa-dl-bar-badge {
      background: #00a884;
      color: #ffffff;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
    }

    .wa-dl-btn {
      padding: 8px 14px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
      white-space: nowrap;
      color: #ffffff;
    }

    .wa-dl-btn-primary {
      background: linear-gradient(135deg, #00a884, #008f6f);
      border-color: #00a884;
      box-shadow: 0 4px 12px rgba(0, 168, 132, 0.3);
    }
    .wa-dl-btn-primary:hover {
      background: linear-gradient(135deg, #00c298, #00a884);
      transform: translateY(-1px);
    }

    .wa-dl-btn-secondary {
      background: rgba(255, 255, 255, 0.08);
    }
    .wa-dl-btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: translateY(-1px);
    }

    .wa-dl-btn-cancel {
      background: rgba(255, 68, 68, 0.15);
      color: #ff6b6b;
      border-color: rgba(255, 68, 68, 0.3);
    }
    .wa-dl-btn-cancel:hover {
      background: rgba(255, 68, 68, 0.25);
    }

    /* Timestamp tag displayed next to checkbox */
    .wa-dl-time-tag {
      position: absolute;
      top: 7px;
      left: 38px;
      background: rgba(17, 27, 33, 0.88);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(0, 168, 132, 0.4);
      color: #00a884;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 10px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* Master checkbox in floating action bar */
    .wa-dl-master-cb-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 14px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 12px;
      cursor: pointer;
      user-select: none;
      font-size: 13px;
      font-weight: 600;
      color: #ffffff;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .wa-dl-master-cb-label:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: #00a884;
    }
    .wa-dl-master-checkbox {
      cursor: pointer;
      width: 17px;
      height: 17px;
      accent-color: #00a884;
      margin: 0;
    }
  `;
  document.head.appendChild(style);
}

// Check if element is currently in viewport ("Page Actuelle")
function isElementInViewport(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const vHeight = window.innerHeight || document.documentElement.clientHeight;
  const vWidth = window.innerWidth || document.documentElement.clientWidth;
  return rect.bottom > 60 && rect.top < (vHeight - 70) && rect.right > 0 && rect.left < vWidth;
}

// Validate if a string looks like a legitimate message timestamp
function isValidTimestamp(str) {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  // Filter out DOM element names, testids, or tail indicators
  if (/tail|msg-|container|button|icon|thumb/i.test(s)) return false;
  // Must contain digits and a time separator (: or .)
  return /\b\d{1,2}[:.]\d{2}(?:\s*[ap]m)?\b/i.test(s);
}

// Check if an image is a contact avatar, emoji, reaction, or UI icon (NOT chat media)
function isAvatarOrIcon(img) {
  if (!img || img.tagName !== 'IMG') return false;

  // If clearly inside a WhatsApp media container, it's NOT an avatar
  if (img.closest('[data-testid="image-thumb"], [data-testid="media-content"], [data-testid="media-canvas"]')) {
    return false;
  }

  // Check URL signatures
  const src = img.src || '';
  if (!src) return true;
  if (src.includes('pps.whatsapp.net') || src.includes('/avatar') || src.includes('profile')) return true;

  // Check parent / ancestor avatar containers
  if (img.closest(`
    header,
    [data-testid="avatar"],
    [data-testid="chat-avatar"],
    [data-testid="round-avatar"],
    [data-testid="profile-pic"],
    [data-testid="default-user"],
    [data-testid="status-v3-avatar"],
    [data-testid="cell-frame-container"],
    [data-testid="reactions"],
    [data-testid="reaction"],
    [data-testid="emoji"],
    div[style*="border-radius: 50%"],
    div[style*="border-radius:50%"]
  `)) {
    return true;
  }

  // Check alt attribute
  const alt = (img.getAttribute('alt') || '').toLowerCase();
  if (alt.includes('avatar') || alt.includes('profile') || alt.includes('profil') || alt.startsWith('emoji')) return true;

  // Check dimensions (avatars/emojis/icons are <= 64px, shared media is >= 100px)
  const w = img.naturalWidth || img.width || img.offsetWidth || 0;
  const h = img.naturalHeight || img.height || img.offsetHeight || 0;
  if ((w > 0 && w <= 64) || (h > 0 && h <= 64)) return true;

  // Check if image is styled with rounded circle (avatars are round)
  const style = window.getComputedStyle ? window.getComputedStyle(img) : null;
  if (style) {
    const br = style.borderRadius;
    if (br === '50%' || parseFloat(br) >= 16) {
      if (w < 90 && h < 90) return true;
    }
  }

  return false;
}

// Validate if an element represents real chat media (not avatars, emojis, or UI decorations)
function isValidMediaElement(el) {
  if (!el) return false;
  const tag = el.tagName ? el.tagName.toUpperCase() : '';

  if (tag === 'IMG') {
    if (isAvatarOrIcon(el)) return false;
    const src = el.src || '';
    if (!src.startsWith('blob:') && !src.includes('whatsapp.net')) return false;
    return true;
  }

  if (tag === 'VIDEO' || (tag === 'SOURCE' && el.parentElement?.tagName === 'VIDEO')) {
    const src = el.src || '';
    return src.startsWith('blob:') || src.includes('whatsapp.net');
  }

  if (tag === 'AUDIO') {
    const src = el.src || '';
    return src.startsWith('blob:') || src.includes('whatsapp.net');
  }

  if (el.matches && (el.matches('[data-testid="document-thumb"]') || el.matches('[data-testid="msg-doc"]'))) {
    return true;
  }

  return false;
}

// Extract message timestamp, sender, and text/transcript
function extractMessageMetadata(mediaEl) {
  const msgRow = mediaEl.closest('[data-id], [role="row"], .message-in, .message-out') || mediaEl.parentElement;
  if (!msgRow) return { timestamp: '', sender: '', text: '', row: null };

  let timestamp = '';
  let sender = '';
  let text = '';

  // 1. WhatsApp's standard data-pre-plain-text attribute
  const copyable = msgRow.querySelector('[data-pre-plain-text]') || (msgRow.hasAttribute('data-pre-plain-text') ? msgRow : null);
  if (copyable) {
    const preText = copyable.getAttribute('data-pre-plain-text') || '';
    const match = preText.match(/\[(.*?)\]\s*(.*?):\s*$/);
    if (match) {
      const candidateTime = match[1].trim();
      if (isValidTimestamp(candidateTime)) {
        timestamp = candidateTime;
      }
      sender = match[2].trim();
    }
  }

  // 2. Fallback to msg-meta (STRICT: only extract actual time, NEVER tail-in/tail-out)
  if (!timestamp) {
    const meta = msgRow.querySelector('[data-testid="msg-meta"]');
    if (meta) {
      const candidate = (meta.textContent || '').trim();
      const m = candidate.match(/\b\d{1,2}[:.]\d{2}(?:\s*[ap]m)?\b/i);
      if (m) {
        timestamp = m[0];
      }
    }
  }

  // 3. Fallback: scan text spans inside row for time pattern (e.g. 14:32)
  if (!timestamp) {
    const spans = msgRow.querySelectorAll('span[dir="auto"], span');
    for (const span of spans) {
      const t = (span.textContent || '').trim();
      const m = t.match(/^\d{1,2}[:.]\d{2}(\s*[ap]m)?$/i);
      if (m) {
        timestamp = m[0];
        break;
      }
    }
  }

  // Double check validity: if still not a valid timestamp, reset to empty
  if (!isValidTimestamp(timestamp)) {
    timestamp = '';
  }

  // 4. Extract text content, caption, or voice transcription
  const textEl = msgRow.querySelector('.selectable-text, [data-testid="selectable-text"], [data-testid="audio-transcript"]');
  if (textEl) {
    text = (textEl.textContent || '').trim();
  }

  return { timestamp, sender, text, row: msgRow };
}

// Extract stable unique ID for a message in WhatsApp Web
function getMessageId(mediaEl) {
  if (!mediaEl) return null;
  const row = mediaEl.closest('[data-id]') 
    || mediaEl.closest('.message-in, .message-out') 
    || mediaEl.closest('[role="row"]') 
    || mediaEl.parentElement;
  if (!row) return null;

  // 1. WhatsApp standard data-id (e.g. "false_1234567890@c.us_3EB0...")
  const rawId = row.getAttribute('data-id') || row.querySelector('[data-id]')?.getAttribute('data-id');
  if (rawId) return rawId;

  // 2. Stable fallback using pre-plain-text (timestamp + sender) + file name/src
  const meta = extractMessageMetadata(mediaEl);
  const src = mediaEl.src || mediaEl.getAttribute('title') || '';
  const srcHash = src.slice(-40);
  if (meta.timestamp || meta.sender) {
    return `msg_${meta.sender}_${meta.timestamp}_${srcHash}`;
  }

  return `media_${srcHash || Math.random().toString(36).slice(2)}`;
}

// Session tracking for unique filename generation
const sessionUsedFilenames = new Set();
const sessionBaseCounts = new Map();

// Helper to look backwards for a date bubble in the chat stream
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

// Convert raw WhatsApp timestamp into human-readable, filesystem-safe format (YYYY-MM-DD_HHhmm)
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
        const lang = (navigator.language || 'fr').toLowerCase();
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

// Assign unique filenames to a batch of media items, with sequential numbering for duplicate timestamps
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
      const cleanBase = (dotIdx > 0 ? orig.slice(0, dotIdx) : orig).replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40);
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

// Build standardized media item object for persistent caching
function buildMediaItem(mediaEl) {
  const meta = extractMessageMetadata(mediaEl);
  const tag = mediaEl.tagName ? mediaEl.tagName.toUpperCase() : '';
  const humanTimestamp = formatHumanTimestamp(meta.timestamp, mediaEl);

  if (tag === 'IMG') {
    return {
      type: 'image',
      url: mediaEl.src,
      humanTimestamp,
      timestamp: meta.timestamp,
      sender: meta.sender,
      text: meta.text,
      docBtn: null,
      element: mediaEl,
      row: meta.row
    };
  }

  if (tag === 'VIDEO' || (tag === 'SOURCE' && mediaEl.parentElement?.tagName === 'VIDEO')) {
    return {
      type: 'video',
      url: mediaEl.src,
      humanTimestamp,
      timestamp: meta.timestamp,
      sender: meta.sender,
      text: meta.text,
      docBtn: null,
      element: mediaEl,
      row: meta.row
    };
  }

  if (tag === 'AUDIO') {
    return {
      type: 'audio',
      url: mediaEl.src,
      humanTimestamp,
      timestamp: meta.timestamp,
      sender: meta.sender,
      text: meta.text,
      docBtn: null,
      element: mediaEl,
      row: meta.row
    };
  }

  // Document
  const docBtn = (mediaEl.matches && (mediaEl.matches('[data-testid="document-thumb"]') || mediaEl.matches('[data-testid="msg-doc"]')))
    ? mediaEl
    : mediaEl.closest('[data-testid="document-thumb"], [data-testid="msg-doc"]');
  const title = docBtn?.getAttribute('title') || '';
  const match = title.match(/"(.+?)"/);
  const rawFilename = match ? match[1] : (title.trim() || 'attached_document');

  return {
    type: 'doc',
    url: '',
    rawFilename,
    filename: rawFilename,
    humanTimestamp,
    timestamp: meta.timestamp,
    sender: meta.sender,
    text: meta.text,
    docBtn,
    element: docBtn,
    row: meta.row
  };
}

// Extract ALL valid media items inside a target container (supports multi-image albums)
function extractMediaItemsFromTarget(target) {
  if (!target) return [];
  const mediaEls = Array.from(target.querySelectorAll('img[src], video[src], video source[src], audio[src], [data-testid="document-thumb"], [data-testid="msg-doc"]'))
    .filter(isValidMediaElement);
  if (mediaEls.length === 0) return [];
  return mediaEls.map(el => buildMediaItem(el));
}

// Download companion text file (transcriptions and message index)
function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 2000);
}

// Scan messages containing media
function scanMediaInChat(options = {}) {
  const visibleOnly = !!options.visibleOnly;
  const results = { docs: [], images: [], videos: [], audio: [] };
  const seenUrls = new Set();
  const root = document.querySelector('#main') || document;

  // 1. Scan documents
  const docButtons = root.querySelectorAll('[data-testid="document-thumb"], [data-testid="msg-doc"]');
  docButtons.forEach(btn => {
    if (visibleOnly && !isElementInViewport(btn)) return;
    let rawFilename = '';
    const title = btn.getAttribute('title') || '';
    const match = title.match(/"(.+?)"/);
    if (match) {
      rawFilename = match[1];
    } else {
      const titleEl = btn.querySelector('[title]');
      if (titleEl && titleEl.getAttribute('title')) {
        rawFilename = titleEl.getAttribute('title');
      } else {
        const textMatches = (btn.textContent || '').match(/[\w\-. ]+\.[a-zA-Z0-9]{2,5}/);
        rawFilename = textMatches ? textMatches[0].trim() : (title.trim() || 'unknown_file');
      }
    }
    const meta = extractMessageMetadata(btn);
    results.docs.push({
      type: 'doc',
      rawFilename,
      filename: rawFilename,
      timestamp: meta.timestamp,
      sender: meta.sender,
      text: meta.text,
      element: btn,
      row: meta.row
    });
  });

  // 2. Scan images
  root.querySelectorAll('img[src]').forEach(img => {
    if (!isValidMediaElement(img)) return;
    const src = img.src;
    if (!src || seenUrls.has(src)) return;
    if (visibleOnly && !isElementInViewport(img)) return;
    seenUrls.add(src);
    const meta = extractMessageMetadata(img);
    results.images.push({
      type: 'image',
      url: src,
      timestamp: meta.timestamp,
      sender: meta.sender,
      text: meta.text,
      element: img,
      row: meta.row
    });
  });

  // 3. Scan videos
  root.querySelectorAll('video[src], video source[src]').forEach(el => {
    const src = el.src;
    if (!src || seenUrls.has(src)) return;
    if (src.startsWith('blob:') || src.includes('whatsapp.net')) {
      if (visibleOnly && !isElementInViewport(el)) return;
      seenUrls.add(src);
      const meta = extractMessageMetadata(el);
      results.videos.push({
        type: 'video',
        url: src,
        timestamp: meta.timestamp,
        sender: meta.sender,
        text: meta.text,
        element: el,
        row: meta.row
      });
    }
  });

  // 4. Scan audio
  root.querySelectorAll('audio[src]').forEach(el => {
    const src = el.src;
    if (!src || seenUrls.has(src)) return;
    if (src.startsWith('blob:') || src.includes('whatsapp.net')) {
      if (visibleOnly && !isElementInViewport(el)) return;
      seenUrls.add(src);
      const meta = extractMessageMetadata(el);
      results.audio.push({
        type: 'audio',
        url: src,
        timestamp: meta.timestamp,
        sender: meta.sender,
        text: meta.text,
        element: el,
        row: meta.row
      });
    }
  });

  // Assign batch filenames with human-readable timestamps and sequential numbering
  assignBatchFilenames([...results.images, ...results.videos, ...results.audio, ...results.docs]);

  return results;
}

// -------------------------------------------------------------
// IN-PAGE INTERACTIVE SELECTION MODE (Checkboxes + Shift+Click)
// -------------------------------------------------------------

function toggleSelectionMode(forceState) {
  selectionModeActive = typeof forceState === 'boolean' ? forceState : !selectionModeActive;
  remoteLog(`🎯 Selection mode toggled -> active: ${selectionModeActive}`);
  ensureInPageStyles();

  const existingBar = document.getElementById('wa-dl-action-bar');
  const existingBadges = document.querySelectorAll('.wa-dl-checkbox-wrap, .wa-dl-time-tag');

  if (!selectionModeActive) {
    selectedMessageIds.clear();
    selectedMediaCache.clear();
    if (existingBar) existingBar.remove();
    existingBadges.forEach(b => b.remove());
    document.querySelectorAll('.wa-dl-selected-row').forEach(r => r.classList.remove('wa-dl-selected-row'));
    document.querySelectorAll('.wa-dl-bubble-container').forEach(r => r.classList.remove('wa-dl-bubble-container'));
    const headerBtn = document.getElementById('wa-dl-header-badge');
    if (headerBtn) headerBtn.classList.remove('active');
    remoteLog('Selection mode disabled, UI cleaned up');
    return false;
  }

  const headerBtn = document.getElementById('wa-dl-header-badge');
  if (headerBtn) headerBtn.classList.add('active');

  renderSelectionCheckboxes();
  renderFloatingActionBar();
  attachScrollObserver();
  return true;
}

let isInternallyMutatingDOM = false;
let renderDebounceTimer = null;

function scheduleSelectionRender() {
  if (isInternallyMutatingDOM) return;
  if (renderDebounceTimer) return;
  renderDebounceTimer = setTimeout(() => {
    renderDebounceTimer = null;
    if (selectionModeActive) {
      renderSelectionCheckboxes();
    }
    injectHeaderBadge();
  }, 250);
}

// Render checkboxes on every message containing media
function renderSelectionCheckboxes() {
  isInternallyMutatingDOM = true;
  try {
    const root = document.querySelector('#main') || document;
    const mediaElements = root.querySelectorAll('img[src], video[src], video source[src], audio[src], [data-testid="document-thumb"], [data-testid="msg-doc"]');

    const processedContainers = new Set();
    let newCheckboxesCount = 0;

    mediaElements.forEach(media => {
      // Filter avatars, emojis, and icons
      if (!isValidMediaElement(media)) return;

      const row = media.closest('[data-id], [role="row"], .message-in, .message-out') || media.parentElement;
      if (!row) return;

      // Anchor to the visual bubble container inside the row (so checkbox is placed on bubble, not edge of screen)
      const bubble = media.closest('.message-in, .message-out, [data-testid="msg-container"]')
        || media.closest('[data-id] > div')
        || media.parentElement;

      const target = bubble || row;
      if (processedContainers.has(target) || target.querySelector('.wa-dl-checkbox-wrap')) return;
      processedContainers.add(target);

      row.classList.add('wa-dl-message-row');
      target.classList.add('wa-dl-bubble-container');
      target.style.position = 'relative';

      const meta = extractMessageMetadata(media);
      const msgId = getMessageId(media);

      const wrap = document.createElement('div');
      wrap.className = 'wa-dl-checkbox-wrap';
      wrap.title = `Select message (${meta.timestamp || 'No timestamp'})`;
      if (msgId) wrap.dataset.msgId = msgId;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'wa-dl-msg-cb';
      if (msgId) cb.dataset.msgId = msgId;

      // Restore checked state from in-memory cache if message was previously selected
      const isSelected = msgId ? selectedMessageIds.has(msgId) : false;
      cb.checked = isSelected;
      if (isSelected) {
        target.classList.add('wa-dl-selected-row');
        const items = extractMediaItemsFromTarget(target);
        if (items.length > 0) selectedMediaCache.set(msgId, items);
      }

      wrap.appendChild(cb);
      target.appendChild(wrap);
      newCheckboxesCount++;

      if (meta.timestamp && isValidTimestamp(meta.timestamp)) {
        const timeTag = document.createElement('span');
        timeTag.className = 'wa-dl-time-tag';
        const displayTime = meta.timestamp.split(',')[0].trim();
        timeTag.textContent = `🕒 ${displayTime}`;
        timeTag.title = `Timestamp: ${meta.timestamp}`;
        target.appendChild(timeTag);
      }

      // Shift + Click Range Selection
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCheckboxClick(cb, e.shiftKey);
      });

      wrap.addEventListener('click', (e) => {
        if (e.target !== cb) {
          e.stopPropagation();
          cb.checked = !cb.checked;
          handleCheckboxClick(cb, e.shiftKey);
        }
      });
    });

    if (newCheckboxesCount > 0) {
      remoteLog(`✅ ${newCheckboxesCount} new message checkboxes added (Total mounted: ${processedContainers.size}, Total selected in memory: ${selectedMessageIds.size})`);
    }
    updateSelectionActionBar();
  } finally {
    setTimeout(() => {
      isInternallyMutatingDOM = false;
    }, 60);
  }
}

// Handle checkbox click with Shift+Click range support and persistent memory
function handleCheckboxClick(targetCb, isShift) {
  const allCbs = Array.from(document.querySelectorAll('.wa-dl-msg-cb'));
  const currentIndex = allCbs.indexOf(targetCb);

  if (isShift && lastCheckedIndex !== -1 && lastCheckedIndex !== currentIndex) {
    const start = Math.min(lastCheckedIndex, currentIndex);
    const end = Math.max(lastCheckedIndex, currentIndex);
    const checkState = targetCb.checked;

    for (let i = start; i <= end; i++) {
      const c = allCbs[i];
      c.checked = checkState;
      const target = c.closest('.wa-dl-bubble-container, .wa-dl-message-row, [data-id]') || c.parentElement;
      if (target) target.classList.toggle('wa-dl-selected-row', checkState);

      const id = c.dataset.msgId;
      if (id) {
        if (checkState) {
          selectedMessageIds.add(id);
          const items = extractMediaItemsFromTarget(target);
          if (items.length > 0) selectedMediaCache.set(id, items);
        } else {
          selectedMessageIds.delete(id);
          selectedMediaCache.delete(id);
        }
      }
    }
  } else {
    const checkState = targetCb.checked;
    const target = targetCb.closest('.wa-dl-bubble-container, .wa-dl-message-row, [data-id]') || targetCb.parentElement;
    if (target) target.classList.toggle('wa-dl-selected-row', checkState);
    lastCheckedIndex = currentIndex;

    const id = targetCb.dataset.msgId;
    if (id) {
      if (checkState) {
        selectedMessageIds.add(id);
        const items = extractMediaItemsFromTarget(target);
        if (items.length > 0) selectedMediaCache.set(id, items);
      } else {
        selectedMessageIds.delete(id);
        selectedMediaCache.delete(id);
      }
    }
  }

  updateSelectionActionBar();
}

// Floating action bar
function renderFloatingActionBar() {
  const existing = document.getElementById('wa-dl-action-bar');
  if (existing) existing.remove(); // Re-create to ensure fresh event listeners

  const bar = document.createElement('div');
  bar.id = 'wa-dl-action-bar';
  bar.className = 'wa-dl-action-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'WhatsApp Media Downloader floating control bar');
  bar.innerHTML = `
    <div class="wa-dl-bar-info">
      <span>Selection:</span>
      <span class="wa-dl-bar-badge" id="wa-dl-count-badge" role="status" aria-live="polite">0 / 0</span>
    </div>
    <label class="wa-dl-master-cb-label" id="wa-dl-master-wrap" title="Select all / Deselect all">
      <input type="checkbox" id="wa-dl-master-cb" class="wa-dl-master-checkbox" aria-label="Select all or deselect all media messages" aria-checked="false">
      <span id="wa-dl-master-text">Select all</span>
    </label>
    <button class="wa-dl-btn wa-dl-btn-secondary" id="wa-dl-btn-none" title="Deselect all messages" aria-label="Deselect all messages">✕ None</button>
    <button class="wa-dl-btn wa-dl-btn-secondary" id="wa-dl-btn-vis" title="Select only messages currently visible on screen" aria-label="Select only messages currently visible on screen">👁️ Visible on screen</button>
    <button class="wa-dl-btn wa-dl-btn-primary" id="wa-dl-btn-dl-media" title="Download selected media files" aria-label="Download selected media files">📥 Media</button>
    <button class="wa-dl-btn wa-dl-btn-primary" id="wa-dl-btn-dl-transcripts" title="Download media with companion text transcripts & captions file" aria-label="Download media with companion transcripts file">📝 Media + Transcripts</button>
    <button class="wa-dl-btn wa-dl-btn-cancel" id="wa-dl-btn-close" title="Exit selection mode" aria-label="Exit selection mode">✕</button>
  `;

  document.body.appendChild(bar);

  // Master Checkbox handler (persistent union memory)
  const masterCb = document.getElementById('wa-dl-master-cb');
  masterCb.addEventListener('change', () => {
    const shouldCheck = masterCb.checked;
    const allCbs = Array.from(document.querySelectorAll('.wa-dl-msg-cb'));

    if (shouldCheck) {
      // Add all currently mounted messages to memory
      allCbs.forEach(cb => {
        cb.checked = true;
        const target = cb.closest('.wa-dl-bubble-container, .wa-dl-message-row, [data-id]') || cb.parentElement;
        if (target) target.classList.add('wa-dl-selected-row');
        const id = cb.dataset.msgId;
        if (id) {
          selectedMessageIds.add(id);
          const items = extractMediaItemsFromTarget(target);
          if (items.length > 0) selectedMediaCache.set(id, items);
        }
      });
    } else {
      // Deselect all
      selectedMessageIds.clear();
      selectedMediaCache.clear();
      allCbs.forEach(cb => {
        cb.checked = false;
        const target = cb.closest('.wa-dl-bubble-container, .wa-dl-message-row, [data-id]') || cb.parentElement;
        if (target) target.classList.remove('wa-dl-selected-row');
      });
    }
    updateSelectionActionBar();
  });

  // "✕ None" handler
  document.getElementById('wa-dl-btn-none').addEventListener('click', () => {
    selectedMessageIds.clear();
    selectedMediaCache.clear();
    const allCbs = Array.from(document.querySelectorAll('.wa-dl-msg-cb'));
    allCbs.forEach(cb => {
      cb.checked = false;
      const target = cb.closest('.wa-dl-bubble-container, .wa-dl-message-row, [data-id]') || cb.parentElement;
      if (target) target.classList.remove('wa-dl-selected-row');
    });
    updateSelectionActionBar();
  });

  // "👁️ Visible on screen" handler
  document.getElementById('wa-dl-btn-vis').addEventListener('click', () => {
    const allCbs = Array.from(document.querySelectorAll('.wa-dl-msg-cb'));
    allCbs.forEach(cb => {
      const target = cb.closest('.wa-dl-bubble-container, .wa-dl-message-row, [data-id]') || cb.parentElement;
      const inView = isElementInViewport(target);
      cb.checked = inView;
      if (target) target.classList.toggle('wa-dl-selected-row', inView);

      const id = cb.dataset.msgId;
      if (id) {
        if (inView) {
          selectedMessageIds.add(id);
          const items = extractMediaItemsFromTarget(target);
          if (items.length > 0) selectedMediaCache.set(id, items);
        } else {
          selectedMessageIds.delete(id);
          selectedMediaCache.delete(id);
        }
      }
    });
    updateSelectionActionBar();
  });

  // Close / exit button
  document.getElementById('wa-dl-btn-close').addEventListener('click', () => {
    toggleSelectionMode(false);
  });

  // Download media button
  document.getElementById('wa-dl-btn-dl-media').addEventListener('click', () => {
    downloadSelectedInPage(false);
  });

  // Download media + transcripts button
  document.getElementById('wa-dl-btn-dl-transcripts').addEventListener('click', () => {
    downloadSelectedInPage(true);
  });

  updateSelectionActionBar();
}

function updateSelectionActionBar() {
  const badge = document.getElementById('wa-dl-count-badge');
  const masterCb = document.getElementById('wa-dl-master-cb');
  const masterText = document.getElementById('wa-dl-master-text');

  const totalSelected = selectedMessageIds.size;
  const allCbs = Array.from(document.querySelectorAll('.wa-dl-msg-cb'));
  const mountedCheckedCbs = allCbs.filter(cb => cb.checked);

  let totalFiles = 0;
  for (const list of selectedMediaCache.values()) {
    totalFiles += Array.isArray(list) ? list.length : (list ? 1 : 0);
  }

  if (badge) {
    if (totalSelected > 0) {
      badge.textContent = totalFiles > totalSelected ? `${totalSelected} msgs (${totalFiles} files)` : `${totalSelected} selected`;
    } else {
      badge.textContent = `0 / ${allCbs.length}`;
    }
  }

  if (masterCb && masterText) {
    if (totalSelected === 0) {
      masterCb.checked = false;
      masterCb.indeterminate = false;
      masterCb.setAttribute('aria-checked', 'false');
      masterText.textContent = 'Select all';
    } else if (allCbs.length > 0 && mountedCheckedCbs.length === allCbs.length) {
      masterCb.checked = true;
      masterCb.indeterminate = false;
      masterCb.setAttribute('aria-checked', 'true');
      masterText.textContent = 'Deselect all';
    } else {
      masterCb.checked = false;
      masterCb.indeterminate = true;
      masterCb.setAttribute('aria-checked', 'mixed');
      masterText.textContent = `Select all (${totalSelected} total)`;
    }
  }
}

// Download media from checked messages (using persistent memory cache)
async function downloadSelectedInPage(includeTranscripts = false) {
  // Sync any currently mounted checked boxes to ensure cache is completely up to date
  document.querySelectorAll('.wa-dl-msg-cb:checked').forEach(cb => {
    const id = cb.dataset.msgId;
    const target = cb.closest('.wa-dl-bubble-container, .wa-dl-message-row, [data-id]') || cb.parentElement;
    if (id && target) {
      const items = extractMediaItemsFromTarget(target);
      if (items.length > 0) {
        selectedMediaCache.set(id, items);
        selectedMessageIds.add(id);
      }
    }
  });

  if (selectedMediaCache.size === 0) {
    const badge = document.getElementById('wa-dl-count-badge');
    if (badge) {
      const orig = badge.textContent;
      badge.textContent = '⚠️ Select a message!';
      badge.style.background = '#ea4335';
      setTimeout(() => {
        badge.textContent = orig;
        badge.style.background = '';
      }, 2000);
    }
    return;
  }

  const rawItems = [];
  for (const [, mediaOrList] of selectedMediaCache.entries()) {
    const list = Array.isArray(mediaOrList) ? mediaOrList : [mediaOrList];
    for (const item of list) {
      if (item) rawItems.push(item);
    }
  }

  // Assign unique filenames with human-readable timestamp and sequential numbering for duplicate timestamps
  assignBatchFilenames(rawItems);

  const itemsToDownload = [];
  const transcriptLines = [
    '====================================================================',
    'MEDIA AND TRANSCRIPTS EXPORT - WHATSAPP WEB',
    `Export Date: ${new Date().toLocaleString()}`,
    `Total Selected Messages: ${selectedMediaCache.size}`,
    `Total Media Files: ${rawItems.length}`,
    '====================================================================\n'
  ];

  let docButtonsToClick = [];

  for (const item of rawItems) {
    const filename = item.assignedFilename || item.filename;
    const timeDisplay = item.timestamp || item.humanTimestamp || 'No date';

    if (item.type === 'image') {
      itemsToDownload.push({ url: item.url, filename });
      transcriptLines.push(`[${timeDisplay}] ${item.sender || 'Unknown Sender'}:`);
      transcriptLines.push(`  📎 File: ${filename}`);
      if (item.text) transcriptLines.push(`  💬 Caption / Text: "${item.text}"`);
      transcriptLines.push('--------------------------------------------------------------------');
    } else if (item.type === 'video') {
      itemsToDownload.push({ url: item.url, filename });
      transcriptLines.push(`[${timeDisplay}] ${item.sender || 'Unknown Sender'}:`);
      transcriptLines.push(`  🎥 Video: ${filename}`);
      if (item.text) transcriptLines.push(`  💬 Caption / Text: "${item.text}"`);
      transcriptLines.push('--------------------------------------------------------------------');
    } else if (item.type === 'audio') {
      itemsToDownload.push({ url: item.url, filename });
      transcriptLines.push(`[${timeDisplay}] ${item.sender || 'Unknown Sender'}:`);
      transcriptLines.push(`  🎵 Audio: ${filename}`);
      if (item.text) transcriptLines.push(`  🎙️ Transcript / Text: "${item.text}"`);
      transcriptLines.push('--------------------------------------------------------------------');
    } else if (item.type === 'doc') {
      if (item.docBtn && document.body.contains(item.docBtn)) {
        docButtonsToClick.push(item.docBtn);
      }
      transcriptLines.push(`[${timeDisplay}] ${item.sender || 'Unknown Sender'}:`);
      transcriptLines.push(`  📄 Document: ${filename}`);
      if (item.text) transcriptLines.push(`  💬 Text: "${item.text}"`);
      transcriptLines.push('--------------------------------------------------------------------');
    }
  }

  // 1. Download media directly
  if (itemsToDownload.length > 0) {
    for (const item of itemsToDownload) {
      try {
        let downloadUrl = item.url;
        let revoke = false;
        if (!item.url.startsWith('blob:')) {
          try {
            const res = await fetch(item.url);
            const blob = await res.blob();
            downloadUrl = URL.createObjectURL(blob);
            revoke = true;
          } catch (e) {
            downloadUrl = item.url;
          }
        }
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = item.filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          a.remove();
          if (revoke) URL.revokeObjectURL(downloadUrl);
        }, 1500);
      } catch (e) {
        console.error('Download error for', item.filename, e);
      }
      await new Promise(r => setTimeout(r, 350));
    }
  }

  // 2. Click document preview buttons if any documents selected
  if (docButtonsToClick.length > 0) {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const findButton = (keywords, iconNames) => {
      for (const icon of iconNames) {
        const el = document.querySelector(`[data-icon="${icon}"]`);
        if (el) return el.closest('[role="button"],button,div[role="button"]') || el;
      }
      const allWithAria = document.querySelectorAll('[aria-label]');
      for (const el of allWithAria) {
        const label = (el.getAttribute('aria-label') || '').toLowerCase();
        if (keywords.some(kw => label.includes(kw))) {
          return el.closest('[role="button"],button,div[role="button"]') || el;
        }
      }
      return null;
    };

    for (const btn of docButtonsToClick) {
      btn.click();
      let dl = null;
      for (let i = 0; i < 40; i++) {
        await wait(300);
        dl = findButton(['download', 'télécharger', 'descargar', 'herunterladen', 'baixar', 'scarica'], ['ic-download', 'download', 'download-refreshed']);
        if (dl) break;
      }
      if (dl) {
        dl.click();
        await wait(1800);
      }
      let x = null;
      for (let i = 0; i < 20; i++) {
        x = findButton(['close', 'fermer', 'cerrar', 'schließen', 'fechar', 'chiudi'], ['x-refreshed', 'x', 'close', 'cancel']);
        if (x) break;
        await wait(200);
      }
      if (x) {
        x.click();
      } else {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      }
      await wait(1200);
    }
  }

  // 3. Download transcripts text file if requested
  if (includeTranscripts) {
    const exportTime = formatHumanTimestamp(new Date());
    downloadTextFile(transcriptLines.join('\n'), `WA_Transcripts_${exportTime}.txt`);
  }
}

// Keep checkboxes rendered as user scrolls the chat
function attachScrollObserver() {
  if (observerAttached) return;
  observerAttached = true;
  const target = document.body || document.documentElement;
  const obs = new MutationObserver((mutations) => {
    if (isInternallyMutatingDOM) return;
    
    // Ignore mutations triggered on our own custom UI
    const isOurMutation = mutations.every(m => {
      const el = m.target;
      return el && (
        el.id === 'wa-dl-action-bar' ||
        el.id === 'wa-dl-header-badge' ||
        el.id === 'wa-dl-count-badge' ||
        (el.closest && el.closest('#wa-dl-action-bar, .wa-dl-checkbox-wrap, #wa-dl-header-badge'))
      );
    });
    if (isOurMutation) return;

    scheduleSelectionRender();
  });
  obs.observe(target, { childList: true, subtree: true });
}

// Inject persistent header button into WhatsApp Web chat header
function injectHeaderBadge() {
  if (document.getElementById('wa-dl-header-badge')) return;
  const chatHeader = document.querySelector('#main header') || document.querySelector('[data-testid="conversation-header"]');
  if (!chatHeader) return;

  isInternallyMutatingDOM = true;
  try {
    const badge = document.createElement('button');
    badge.id = 'wa-dl-header-badge';
    badge.className = `wa-dl-header-badge ${selectionModeActive ? 'active' : ''}`;
    badge.textContent = '📥 Select Media';
    badge.title = 'Enable message selection mode (Shift + Click to select range)';

    badge.addEventListener('click', (e) => {
      e.preventDefault();
      remoteLog('🖱️ Clicked selection badge in WhatsApp header');
      toggleSelectionMode();
    });

    // Insert before the action icons in header
    const lastChild = chatHeader.lastElementChild;
    if (lastChild) {
      chatHeader.insertBefore(badge, lastChild);
    } else {
      chatHeader.appendChild(badge);
    }
    remoteLog('✅ Badge [📥 Select Media] successfully injected into chat header!');
  } finally {
    setTimeout(() => {
      isInternallyMutatingDOM = false;
    }, 60);
  }
}

// Initial setup on page
setTimeout(() => {
  ensureInPageStyles();
  injectHeaderBadge();
  attachScrollObserver();
  remoteLog('🚀 content.js initialized successfully on WhatsApp Web! URL: ' + window.location.href);
}, 1500);

// -------------------------------------------------------------
// RUNTIME MESSAGE HANDLER (Extension Popup & Background)
// -------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.action === 'cancelDownload') {
    cancelDownload = true;
    sendResponse({ ok: true });
    return false;
  }

  // Toggle selection mode from popup
  if (msg.action === 'toggleSelectionMode') {
    const state = toggleSelectionMode();
    sendResponse({ active: state });
    return false;
  }

  // --- SCAN: find all media + docs (with optional visibleOnly) ---
  if (msg.action === 'scanMedia') {
    const results = scanMediaInChat({ visibleOnly: !!msg.visibleOnly });
    sendResponse(results);
    return false;
  }

  // --- DOWNLOAD MEDIA DIRECTLY (in-page context) ---
  if (msg.action === 'downloadMediaInPage') {
    const items = msg.media || [];
    let completed = 0;
    cancelDownload = false;
    sendResponse({ started: true, total: items.length });

    // Assign unique filenames with human-readable timestamp and sequential duplicate numbering
    assignBatchFilenames(items);

    (async () => {
      // If includeTranscripts was requested, build summary text
      if (msg.includeTranscripts && items.length > 0) {
        const transcriptLines = [
          '====================================================================',
          'MEDIA AND TRANSCRIPTS EXPORT - WHATSAPP WEB',
          `Export Date: ${new Date().toLocaleString()}`,
          `Total Files: ${items.length}`,
          '====================================================================\n'
        ];
        items.forEach((it) => {
          const fn = it.assignedFilename || it.filename;
          const timeDisplay = it.timestamp || it.humanTimestamp || 'No date';
          transcriptLines.push(`[${timeDisplay}] ${it.sender || 'Unknown Sender'}:`);
          transcriptLines.push(`  📎 File: ${fn}`);
          if (it.text) transcriptLines.push(`  💬 Caption / Text: "${it.text}"`);
          transcriptLines.push('--------------------------------------------------------------------');
        });
        const exportTime = formatHumanTimestamp(new Date());
        downloadTextFile(transcriptLines.join('\n'), `WA_Transcripts_${exportTime}.txt`);
      }

      for (const item of items) {
        if (cancelDownload) {
          try {
            chrome.runtime.sendMessage({
              action: 'progress',
              completed,
              total: items.length,
              cancelled: true
            });
          } catch (e) {}
          break;
        }

        try {
          let downloadUrl = item.url;
          let revoke = false;

          if (!item.url.startsWith('blob:')) {
            try {
              const res = await fetch(item.url);
              const blob = await res.blob();
              downloadUrl = URL.createObjectURL(blob);
              revoke = true;
            } catch (fetchErr) {
              downloadUrl = item.url;
            }
          }

          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = item.assignedFilename || item.filename;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            a.remove();
            if (revoke) URL.revokeObjectURL(downloadUrl);
          }, 1500);
        } catch (e) {
          console.error('Download error for item:', item.filename, e);
        }

        completed++;
        try {
          chrome.runtime.sendMessage({
            action: 'progress',
            completed,
            total: items.length
          });
        } catch (e) {}

        await new Promise(r => setTimeout(r, 400));
      }
    })();
    return false;
  }

  // --- DOWNLOAD DOCS: open preview → click Download → close → next ---
  if (msg.action === 'clickDocs') {
    const allowed = msg.allowedExt || [];
    const root = document.querySelector('#main') || document;
    const allButtons = root.querySelectorAll('[data-testid="document-thumb"], [data-testid="msg-doc"]');

    const buttons = Array.from(allButtons).filter(btn => {
      if (msg.visibleOnly && !isElementInViewport(btn)) return false;
      const title = btn.getAttribute('title') || '';
      const match = title.match(/"(.+?)"/);
      let filename = match ? match[1] : '';
      if (!filename) {
        const titleEl = btn.querySelector('[title]');
        if (titleEl) filename = titleEl.getAttribute('title') || '';
      }
      if (!filename) {
        const textMatches = (btn.textContent || '').match(/[\w\-. ]+\.[a-zA-Z0-9]{2,5}/);
        if (textMatches) filename = textMatches[0].trim();
      }
      if (!filename) return true;
      const ext = filename.split('.').pop().toLowerCase();
      return allowed.length === 0 || allowed.includes(ext);
    });

    cancelDownload = false;
    sendResponse({ started: true, total: buttons.length });

    (async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      
      const findButton = (keywords, iconNames) => {
        for (const icon of iconNames) {
          const el = document.querySelector(`[data-icon="${icon}"]`);
          if (el) return el.closest('[role="button"],button,div[role="button"]') || el;
        }
        const allWithAria = document.querySelectorAll('[aria-label]');
        for (const el of allWithAria) {
          const label = (el.getAttribute('aria-label') || '').toLowerCase();
          if (keywords.some(kw => label.includes(kw))) {
            return el.closest('[role="button"],button,div[role="button"]') || el;
          }
        }
        return null;
      };

      let done = 0;
      for (const btn of buttons) {
        if (cancelDownload) {
          try {
            chrome.runtime.sendMessage({
              action: 'docProgress',
              completed: done,
              total: buttons.length,
              cancelled: true
            });
          } catch (e) {}
          break;
        }

        // 1) Open preview
        btn.click();

        // 2) Poll up to ~12s for the Download button
        let dl = null;
        for (let i = 0; i < 40; i++) {
          await wait(300);
          dl = findButton(
            ['download', 'télécharger', 'descargar', 'herunterladen', 'baixar', 'scarica'],
            ['ic-download', 'download', 'download-refreshed']
          );
          if (dl) break;
        }

        // 3) Click Download
        if (dl) {
          dl.click();
          await wait(1800);
        }

        // 4) Close preview
        let x = null;
        for (let i = 0; i < 20; i++) {
          x = findButton(
            ['close', 'fermer', 'cerrar', 'schließen', 'fechar', 'chiudi'],
            ['x-refreshed', 'x', 'close', 'cancel']
          );
          if (x) break;
          await wait(200);
        }
        if (x) {
          x.click();
        } else {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        }
        await wait(1500);

        // 5) Progress
        done++;
        try {
          chrome.runtime.sendMessage({
            action: 'docProgress',
            completed: done,
            total: buttons.length
          });
        } catch (e) {}
      }
    })();
    return false;
  }

  return false;
});

// A11y: Escape key closes in-page selection mode cleanly
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && selectionModeActive) {
    toggleSelectionMode(false);
  }
});
