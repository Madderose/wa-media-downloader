/**
 * WA Media Downloader — MediaDetector
 * DOM inspection, media element validation, avatar/icon filtering, and chat scanning.
 * 
 * 100% Zero-Data: runs entirely client-side in browser DOM.
 */

(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(require('./naming-service.js'));
  } else if (typeof define === 'function' && define.amd) {
    define(['./naming-service.js'], factory);
  } else {
    root.MediaDetector = factory(root.NamingService);
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this || {}), function (NamingService) {
  'use strict';

  function getNamingService() {
    if (NamingService) return NamingService;
    if (typeof globalThis !== 'undefined' && globalThis.NamingService) return globalThis.NamingService;
    if (typeof window !== 'undefined' && window.NamingService) return window.NamingService;
    return null;
  }

  /**
   * Check if element is currently in viewport ("Page Actuelle")
   * @param {Element} el
   * @returns {boolean}
   */
  function isElementInViewport(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const vHeight = (typeof window !== 'undefined' && window.innerHeight) || document.documentElement.clientHeight;
    const vWidth = (typeof window !== 'undefined' && window.innerWidth) || document.documentElement.clientWidth;
    return rect.bottom > 60 && rect.top < (vHeight - 70) && rect.right > 0 && rect.left < vWidth;
  }

  /**
   * Validate if a string looks like a legitimate message timestamp
   * @param {string} str
   * @returns {boolean}
   */
  function isValidTimestamp(str) {
    if (!str || typeof str !== 'string') return false;
    const s = str.trim();
    if (/tail|msg-|container|button|icon|thumb/i.test(s)) return false;
    return /\b\d{1,2}[:.]\d{2}(?:\s*[ap]m)?\b/i.test(s);
  }

  /**
   * Check if an image is a contact avatar, emoji, reaction, or UI icon (NOT chat media)
   * @param {Element} img
   * @returns {boolean}
   */
  function isAvatarOrIcon(img) {
    if (!img || img.tagName !== 'IMG') return false;

    if (img.closest('[data-testid="image-thumb"], [data-testid="media-content"], [data-testid="media-canvas"]')) {
      return false;
    }

    const src = img.src || '';
    if (!src) return true;
    if (src.includes('pps.whatsapp.net') || src.includes('/avatar') || src.includes('profile')) return true;

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

    const alt = (img.getAttribute('alt') || '').toLowerCase();
    if (alt.includes('avatar') || alt.includes('profile') || alt.includes('profil') || alt.startsWith('emoji')) return true;

    const w = img.naturalWidth || img.width || img.offsetWidth || 0;
    const h = img.naturalHeight || img.height || img.offsetHeight || 0;
    if ((w > 0 && w <= 64) || (h > 0 && h <= 64)) return true;

    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const style = window.getComputedStyle(img);
      if (style) {
        const br = style.borderRadius;
        if (br === '50%' || parseFloat(br) >= 16) {
          if (w < 90 && h < 90) return true;
        }
      }
    }

    return false;
  }

  /**
   * Validate if an element represents real chat media
   * @param {Element} el
   * @returns {boolean}
   */
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

  /**
   * Extract message timestamp, sender, and text/transcript
   * @param {Element} mediaEl
   * @returns {{ timestamp: string, sender: string, text: string, row: Element | null }}
   */
  function extractMessageMetadata(mediaEl) {
    const msgRow = mediaEl.closest('[data-id], [role="row"], .message-in, .message-out') || mediaEl.parentElement;
    if (!msgRow) return { timestamp: '', sender: '', text: '', row: null };

    let timestamp = '';
    let sender = '';
    let text = '';

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

    if (!isValidTimestamp(timestamp)) {
      timestamp = '';
    }

    const textEl = msgRow.querySelector('.selectable-text, [data-testid="selectable-text"], [data-testid="audio-transcript"]');
    if (textEl) {
      text = (textEl.textContent || '').trim();
    }

    return { timestamp, sender, text, row: msgRow };
  }

  /**
   * Extract stable unique ID for a message in WhatsApp Web
   * @param {Element} mediaEl
   * @returns {string|null}
   */
  function getMessageId(mediaEl) {
    if (!mediaEl) return null;
    const row = mediaEl.closest('[data-id]') 
      || mediaEl.closest('.message-in, .message-out') 
      || mediaEl.closest('[role="row"]') 
      || mediaEl.parentElement;
    if (!row) return null;

    const rawId = row.getAttribute('data-id') || row.querySelector('[data-id]')?.getAttribute('data-id');
    if (rawId) return rawId;

    const meta = extractMessageMetadata(mediaEl);
    const src = mediaEl.src || mediaEl.getAttribute('title') || '';
    const srcHash = src.slice(-40);
    if (meta.timestamp || meta.sender) {
      return `msg_${meta.sender}_${meta.timestamp}_${srcHash}`;
    }

    return `media_${srcHash || Math.random().toString(36).slice(2)}`;
  }

  /**
   * Build standardized media item object
   * @param {Element} mediaEl
   * @returns {Object}
   */
  function buildMediaItem(mediaEl) {
    const meta = extractMessageMetadata(mediaEl);
    const tag = mediaEl.tagName ? mediaEl.tagName.toUpperCase() : '';
    const ns = getNamingService();
    const humanTimestamp = ns ? ns.formatHumanTimestamp(meta.timestamp, mediaEl) : meta.timestamp;

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
    let rawFilename = '';
    const title = docBtn?.getAttribute('title') || '';
    const match = title.match(/"(.+?)"/);
    if (match) {
      rawFilename = match[1];
    } else if (title.trim()) {
      rawFilename = title.trim();
    } else if (docBtn) {
      const titleEl = docBtn.querySelector('[title]');
      if (titleEl) rawFilename = titleEl.getAttribute('title') || '';
      if (!rawFilename) {
        const strongEl = docBtn.querySelector('strong, span[dir="auto"]');
        const strongText = strongEl ? (strongEl.textContent || '').trim() : '';
        if (strongText && /\.[a-zA-Z0-9]{2,5}$/.test(strongText)) {
          rawFilename = strongText;
        }
      }
      if (!rawFilename) {
        const textMatches = (docBtn.textContent || '').match(/[\w\-. ]+\.[a-zA-Z0-9]{2,5}/);
        if (textMatches) rawFilename = textMatches[0].trim();
      }
    }
    if (!rawFilename) rawFilename = 'attached_document';

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

  /**
   * Extract ALL valid media items inside a target container
   * @param {Element} target
   * @returns {Array<Object>}
   */
  function extractMediaItemsFromTarget(target) {
    if (!target) return [];
    const mediaEls = Array.from(target.querySelectorAll('img[src], video[src], video source[src], audio[src], [data-testid="document-thumb"], [data-testid="msg-doc"]'))
      .filter(isValidMediaElement);
    if (mediaEls.length === 0) return [];
    return mediaEls.map(el => buildMediaItem(el));
  }

  /**
   * Scan messages containing media
   * @param {{ visibleOnly?: boolean }} [options]
   * @returns {{ docs: Array<Object>, images: Array<Object>, videos: Array<Object>, audio: Array<Object> }}
   */
  function scanMediaInChat(options = {}) {
    const visibleOnly = !!options.visibleOnly;
    const results = { docs: [], images: [], videos: [], audio: [] };
    const seenUrls = new Set();
    const root = (typeof document !== 'undefined' && (document.querySelector('#main') || document)) || null;
    if (!root) return results;

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

    const ns = getNamingService();
    if (ns && ns.assignBatchFilenames) {
      ns.assignBatchFilenames([...results.images, ...results.videos, ...results.audio, ...results.docs]);
    }

    return results;
  }

  /**
   * Extract current active chat contact or group name from WhatsApp Web header
   * @param {Element} [rootEl]
   * @returns {string}
   */
  function getChatTitle(rootEl = null) {
    try {
      if (typeof document === 'undefined') return '';
      const header = (rootEl && rootEl.querySelector('header'))
        || document.querySelector('#main header')
        || document.querySelector('[data-testid="conversation-header"]')
        || (rootEl && rootEl.matches?.('header') ? rootEl : null);

      if (!header) return '';

      // 1. Primary WhatsApp Web title element
      const titleEl = header.querySelector('[data-testid="conversation-info-header-chat-title"]');
      if (titleEl && titleEl.textContent) {
        return titleEl.textContent.trim();
      }

      // 2. Span with title attribute inside header
      const titleSpan = header.querySelector('span[dir="auto"][title]');
      if (titleSpan) {
        const titleAttr = titleSpan.getAttribute('title');
        if (titleAttr && titleAttr.trim()) return titleAttr.trim();
        if (titleSpan.textContent && titleSpan.textContent.trim()) return titleSpan.textContent.trim();
      }

      // 3. Fallback to mock fixture or standard chat-title class
      const classTitle = header.querySelector('.chat-title') || document.querySelector('.chat-title');
      if (classTitle && classTitle.textContent) {
        return classTitle.textContent.trim();
      }

      // 4. Any clickable title wrapper inside header
      const btnTitle = header.querySelector('div[role="button"] span[title]');
      if (btnTitle) {
        const t = btnTitle.getAttribute('title') || btnTitle.textContent;
        if (t && t.trim()) return t.trim();
      }
    } catch (e) {}
    return '';
  }

  return {
    isElementInViewport,
    isValidTimestamp,
    isAvatarOrIcon,
    isValidMediaElement,
    extractMessageMetadata,
    getMessageId,
    buildMediaItem,
    extractMediaItemsFromTarget,
    scanMediaInChat,
    getChatTitle
  };
});
