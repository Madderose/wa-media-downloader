/**
 * WA Media Downloader — UIController
 * Presentation and DOM interaction layer: header badge, floating control bar,
 * message checkboxes, tri-state master checkbox, keyboard shortcuts (Escape, Shift+Click).
 * 
 * Complies with strict A11y & ARIA standards.
 */

(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(
      require('./media-detector.js'),
      require('./selection-manager.js'),
      require('./download-pipeline.js')
    );
  } else if (typeof define === 'function' && define.amd) {
    define(['./media-detector.js', './selection-manager.js', './download-pipeline.js'], factory);
  } else {
    root.UIController = factory(root.MediaDetector, root.SelectionManager, root.DownloadPipeline);
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this || {}), function (MediaDetector, SelectionManager, DownloadPipeline) {
  'use strict';

  function getMediaDetector() {
    if (MediaDetector) return MediaDetector;
    if (typeof globalThis !== 'undefined' && globalThis.MediaDetector) return globalThis.MediaDetector;
    if (typeof window !== 'undefined' && window.MediaDetector) return window.MediaDetector;
    return null;
  }

  function getSelectionManager() {
    if (SelectionManager) return SelectionManager;
    if (typeof globalThis !== 'undefined' && globalThis.SelectionManager) return globalThis.SelectionManager;
    if (typeof window !== 'undefined' && window.SelectionManager) return window.SelectionManager;
    return null;
  }

  function getDownloadPipeline() {
    if (DownloadPipeline) return DownloadPipeline;
    if (typeof globalThis !== 'undefined' && globalThis.DownloadPipeline) return globalThis.DownloadPipeline;
    if (typeof window !== 'undefined' && window.DownloadPipeline) return window.DownloadPipeline;
    return null;
  }

  function getI18nMsg(key, substitutions, fallback) {
    try {
      if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
        const msg = chrome.i18n.getMessage(key, substitutions);
        if (msg) return msg;
      }
    } catch (e) {}
    return fallback || key;
  }

  let isInternallyMutatingDOM = false;
  let renderDebounceTimer = null;

  function removeInjectedCheckboxes() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.wa-dl-checkbox-wrap, .wa-dl-time-tag').forEach(el => el.remove());
    document.querySelectorAll('.wa-dl-selected-row').forEach(el => el.classList.remove('wa-dl-selected-row'));
  }

  function scheduleSelectionRender() {
    if (isInternallyMutatingDOM) return;
    if (renderDebounceTimer) return;
    renderDebounceTimer = setTimeout(() => {
      renderDebounceTimer = null;
      const sm = getSelectionManager();
      const md = getMediaDetector();
      if (sm && md) {
        const title = md.getChatTitle();
        if (title) {
          const switched = sm.setChatContext(title);
          if (switched) {
            removeInjectedCheckboxes();
            updateSelectionActionBar();
          }
        }
      }
      if (sm && sm.isSelectionModeActive()) {
        renderSelectionCheckboxes();
      }
      injectHeaderBadge();
    }, 250);
  }

  /**
   * Render checkboxes on every message containing media
   */
  function renderSelectionCheckboxes() {
    const sm = getSelectionManager();
    const md = getMediaDetector();
    if (!sm || !md || typeof document === 'undefined') return;

    isInternallyMutatingDOM = true;
    try {
      const root = document.querySelector('#main') || document;
      const mediaElements = root.querySelectorAll('img[src], video[src], video source[src], audio[src], [data-testid="document-thumb"], [data-testid="msg-doc"]');

      const processedContainers = new Set();
      let newCheckboxesCount = 0;

      mediaElements.forEach(media => {
        if (!md.isValidMediaElement(media)) return;

        const row = media.closest('[data-id], [role="row"], .message-in, .message-out') || media.parentElement;
        if (!row) return;

        const bubble = media.closest('.message-in, .message-out, [data-testid="msg-container"]')
          || media.closest('[data-id] > div')
          || media.parentElement;

        const target = bubble || row;
        if (processedContainers.has(target) || target.querySelector('.wa-dl-checkbox-wrap')) return;
        processedContainers.add(target);

        row.classList.add('wa-dl-message-row');
        target.classList.add('wa-dl-bubble-container');
        target.style.position = 'relative';

        const meta = md.extractMessageMetadata(media);
        const msgId = md.getMessageId(media);

        const wrap = document.createElement('div');
        wrap.className = 'wa-dl-checkbox-wrap';
        wrap.title = `Select message (${meta.timestamp || 'No timestamp'})`;
        if (msgId) wrap.dataset.msgId = msgId;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'wa-dl-msg-cb';
        if (msgId) cb.dataset.msgId = msgId;

        const isSelected = msgId ? sm.hasMessage(msgId) : false;
        cb.checked = isSelected;
        if (isSelected) {
          target.classList.add('wa-dl-selected-row');
          const items = md.extractMediaItemsFromTarget(target);
          if (items.length > 0) sm.addMessageMedia(msgId, items);
        }

        wrap.appendChild(cb);
        target.appendChild(wrap);
        newCheckboxesCount++;

        if (meta.timestamp && md.isValidTimestamp(meta.timestamp)) {
          const timeTag = document.createElement('span');
          timeTag.className = 'wa-dl-time-tag';
          const displayTime = meta.timestamp.split(',')[0].trim();
          timeTag.textContent = `🕒 ${displayTime}`;
          timeTag.title = `Timestamp: ${meta.timestamp}`;
          target.appendChild(timeTag);
        }

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

      updateSelectionActionBar();
    } finally {
      setTimeout(() => {
        isInternallyMutatingDOM = false;
      }, 60);
    }
  }

  /**
   * Handle checkbox click with Shift+Click range support and persistent memory
   * @param {HTMLInputElement} targetCb
   * @param {boolean} isShift
   */
  function handleCheckboxClick(targetCb, isShift) {
    const sm = getSelectionManager();
    const md = getMediaDetector();
    if (!sm || !md || typeof document === 'undefined') return;

    const allCbs = Array.from(document.querySelectorAll('.wa-dl-msg-cb'));
    const currentIndex = allCbs.indexOf(targetCb);
    const lastCheckedIndex = sm.getLastCheckedIndex();

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
            const items = md.extractMediaItemsFromTarget(target);
            sm.addMessageMedia(id, items);
          } else {
            sm.removeMessage(id);
          }
        }
      }
    } else {
      const checkState = targetCb.checked;
      const target = targetCb.closest('.wa-dl-bubble-container, .wa-dl-message-row, [data-id]') || targetCb.parentElement;
      if (target) target.classList.toggle('wa-dl-selected-row', checkState);
      sm.setLastCheckedIndex(currentIndex);

      const id = targetCb.dataset.msgId;
      if (id) {
        if (checkState) {
          const items = md.extractMediaItemsFromTarget(target);
          sm.addMessageMedia(id, items);
        } else {
          sm.removeMessage(id);
        }
      }
    }

    updateSelectionActionBar();
  }

  /**
   * Render floating action bar
   */
  function renderFloatingActionBar() {
    if (typeof document === 'undefined') return;
    const sm = getSelectionManager();
    const md = getMediaDetector();
    const dp = getDownloadPipeline();

    const existing = document.getElementById('wa-dl-action-bar');
    if (existing) existing.remove();

    const bar = document.createElement('div');
    bar.id = 'wa-dl-action-bar';
    bar.className = 'wa-dl-action-bar wam-action-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'WhatsApp Media Downloader floating control bar');
    bar.innerHTML = `
      <div class="wa-dl-bar-info wam-bar-info">
        <span id="wa-dl-info-label"></span>
        <span class="wa-dl-bar-badge wam-bar-badge" id="wa-dl-count-badge" role="status" aria-live="polite">0 / 0</span>
      </div>
      <label class="wa-dl-master-cb-label wam-master-cb-label" id="wa-dl-master-wrap">
        <input type="checkbox" id="wa-dl-master-cb" class="wa-dl-master-checkbox wam-master-checkbox" aria-checked="false">
        <span id="wa-dl-master-text"></span>
      </label>
      <div class="wam-filter-pills" role="group" aria-label="Media category filter">
        <button type="button" class="wam-filter-pill active" data-filter="all" aria-pressed="true" id="wa-dl-filter-all"></button>
        <button type="button" class="wam-filter-pill" data-filter="image" aria-pressed="false" id="wa-dl-filter-images"></button>
        <button type="button" class="wam-filter-pill" data-filter="video" aria-pressed="false" id="wa-dl-filter-videos"></button>
        <button type="button" class="wam-filter-pill" data-filter="doc" aria-pressed="false" id="wa-dl-filter-docs"></button>
        <button type="button" class="wam-filter-pill" data-filter="audio" aria-pressed="false" id="wa-dl-filter-audio"></button>
      </div>
      <button type="button" class="wa-dl-btn wam-btn wa-dl-btn-secondary wam-btn-secondary" id="wa-dl-btn-none"></button>
      <button type="button" class="wa-dl-btn wam-btn wa-dl-btn-secondary wam-btn-secondary" id="wa-dl-btn-vis"></button>
      <button type="button" class="wa-dl-btn wam-btn wam-btn-toggle" id="wa-dl-btn-transcripts" role="switch"></button>
      <button type="button" class="wa-dl-btn wam-btn wa-dl-btn-primary wam-btn-primary" id="wa-dl-btn-download-main" aria-label="Download selected media"></button>
      <button type="button" id="wa-dl-btn-dl-media" style="display:none;" aria-hidden="true"></button>
      <button type="button" id="wa-dl-btn-dl-transcripts" style="display:none;" aria-hidden="true"></button>
      <button type="button" class="wa-dl-btn wam-btn wa-dl-btn-cancel wam-btn-cancel" id="wa-dl-btn-close">✕</button>
    `;

    const infoLabel = bar.querySelector('#wa-dl-info-label');
    if (infoLabel) infoLabel.textContent = getI18nMsg('barSelectionLabel', null, 'Selection:');

    const masterWrap = bar.querySelector('#wa-dl-master-wrap');
    if (masterWrap) masterWrap.title = getI18nMsg('barMasterTooltip', null, 'Select all / Deselect all (Ctrl + A)');

    const masterCb = bar.querySelector('#wa-dl-master-cb');
    if (masterCb) masterCb.setAttribute('aria-label', getI18nMsg('barMasterTooltip', null, 'Select all or deselect all media messages'));

    const masterText = bar.querySelector('#wa-dl-master-text');
    if (masterText) masterText.textContent = getI18nMsg('barSelectAll', null, 'Select all');

    const fAll = bar.querySelector('#wa-dl-filter-all');
    if (fAll) fAll.textContent = getI18nMsg('barFilterAll', null, 'All');

    const fImages = bar.querySelector('#wa-dl-filter-images');
    if (fImages) fImages.textContent = getI18nMsg('barFilterImages', null, '🖼️ Photos');

    const fVideos = bar.querySelector('#wa-dl-filter-videos');
    if (fVideos) fVideos.textContent = getI18nMsg('barFilterVideos', null, '🎥 Videos');

    const fDocs = bar.querySelector('#wa-dl-filter-docs');
    if (fDocs) fDocs.textContent = getI18nMsg('barFilterDocs', null, '📄 Docs');

    const fAudio = bar.querySelector('#wa-dl-filter-audio');
    if (fAudio) fAudio.textContent = getI18nMsg('barFilterAudio', null, '🎵 Audio');

    const btnNone = bar.querySelector('#wa-dl-btn-none');
    if (btnNone) {
      const noneText = getI18nMsg('barNone', null, '✕ None');
      btnNone.textContent = noneText;
      btnNone.title = noneText;
      btnNone.setAttribute('aria-label', getI18nMsg('barNone', null, 'Deselect all'));
    }

    const btnVis = bar.querySelector('#wa-dl-btn-vis');
    if (btnVis) {
      const visText = getI18nMsg('barVisibleOnScreen', null, '👁️ Visible');
      btnVis.textContent = visText;
      btnVis.title = visText;
      btnVis.setAttribute('aria-label', getI18nMsg('barVisibleOnScreen', null, 'Select visible messages'));
    }

    const inclTrans = sm ? sm.getIncludeTranscripts() : true;
    const btnTranscripts = bar.querySelector('#wa-dl-btn-transcripts');
    if (btnTranscripts) {
      btnTranscripts.textContent = getI18nMsg('barTranscriptsToggle', null, '📝 .txt');
      btnTranscripts.title = getI18nMsg('barTranscriptsTitle', null, 'Include transcripts (.txt)');
      btnTranscripts.classList.toggle('active', inclTrans);
      btnTranscripts.setAttribute('aria-checked', inclTrans ? 'true' : 'false');
    }

    const btnClose = bar.querySelector('#wa-dl-btn-close');
    if (btnClose) {
      btnClose.title = getI18nMsg('barClose', null, 'Exit selection mode (Esc)');
      btnClose.setAttribute('aria-label', getI18nMsg('barClose', null, 'Exit selection mode'));
    }

    document.body.appendChild(bar);

    // Master Checkbox handler
    if (masterCb) {
      masterCb.addEventListener('change', () => {
        const shouldCheck = masterCb.checked;
        const allCbs = Array.from(document.querySelectorAll('.wa-dl-msg-cb'));

        if (shouldCheck) {
          allCbs.forEach(cb => {
            cb.checked = true;
            const target = cb.closest('.wa-dl-bubble-container, .wa-dl-message-row, [data-id]') || cb.parentElement;
            if (target) target.classList.add('wa-dl-selected-row');
            const id = cb.dataset.msgId;
            if (id && sm && md) {
              const items = md.extractMediaItemsFromTarget(target);
              sm.addMessageMedia(id, items);
            }
          });
        } else {
          if (sm) sm.clearSelection();
          allCbs.forEach(cb => {
            cb.checked = false;
            const target = cb.closest('.wa-dl-bubble-container, .wa-dl-message-row, [data-id]') || cb.parentElement;
            if (target) target.classList.remove('wa-dl-selected-row');
          });
        }
        updateSelectionActionBar();
      });
    }

    // Category filter pills handler
    const pills = bar.querySelectorAll('.wam-filter-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        const filter = pill.dataset.filter;
        pills.forEach(p => {
          const isThis = p === pill;
          p.classList.toggle('active', isThis);
          p.setAttribute('aria-pressed', isThis ? 'true' : 'false');
        });

        const allCbs = Array.from(document.querySelectorAll('.wa-dl-msg-cb'));
        if (filter === 'all') {
          allCbs.forEach(cb => {
            cb.checked = true;
            const target = cb.closest('.wa-dl-bubble-container, .wa-dl-message-row, [data-id]') || cb.parentElement;
            if (target) target.classList.add('wa-dl-selected-row');
            const id = cb.dataset.msgId;
            if (id && sm && md) {
              const items = md.extractMediaItemsFromTarget(target);
              sm.addMessageMedia(id, items);
            }
          });
        } else {
          allCbs.forEach(cb => {
            const target = cb.closest('.wa-dl-bubble-container, .wa-dl-message-row, [data-id]') || cb.parentElement;
            const items = md ? md.extractMediaItemsFromTarget(target) : [];
            const matches = items.some(item => {
              if (filter === 'image') return item.type === 'image';
              if (filter === 'video') return item.type === 'video';
              if (filter === 'doc') return item.type === 'doc';
              if (filter === 'audio') return item.type === 'audio';
              return false;
            });

            cb.checked = matches;
            if (target) target.classList.toggle('wa-dl-selected-row', matches);
            const id = cb.dataset.msgId;
            if (id && sm) {
              if (matches) {
                sm.addMessageMedia(id, items);
              } else {
                sm.removeMessage(id);
              }
            }
          });
        }
        updateSelectionActionBar();
      });
    });

    // "✕ None" handler
    document.getElementById('wa-dl-btn-none').addEventListener('click', () => {
      if (sm) sm.clearSelection();
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
        const inView = md ? md.isElementInViewport(target) : false;
        cb.checked = inView;
        if (target) target.classList.toggle('wa-dl-selected-row', inView);

        const id = cb.dataset.msgId;
        if (id && sm && md) {
          if (inView) {
            const items = md.extractMediaItemsFromTarget(target);
            sm.addMessageMedia(id, items);
          } else {
            sm.removeMessage(id);
          }
        }
      });
      updateSelectionActionBar();
    });

    // Transcripts switch handler
    if (btnTranscripts) {
      btnTranscripts.addEventListener('click', () => {
        if (!sm) return;
        const newState = !sm.getIncludeTranscripts();
        sm.setIncludeTranscripts(newState);
        btnTranscripts.classList.toggle('active', newState);
        btnTranscripts.setAttribute('aria-checked', newState ? 'true' : 'false');
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ includeTranscripts: newState });
        }
      });
    }

    // Unified Main Download Button handler
    const dlMainBtn = document.getElementById('wa-dl-btn-download-main');
    if (dlMainBtn) {
      dlMainBtn.addEventListener('click', () => {
        triggerDownloadFromBar();
      });
    }

    // Close button
    document.getElementById('wa-dl-btn-close').addEventListener('click', () => {
      toggleSelectionMode(false);
    });

    // Legacy buttons
    const legacyMediaBtn = document.getElementById('wa-dl-btn-dl-media');
    if (legacyMediaBtn) legacyMediaBtn.addEventListener('click', () => triggerDownloadFromBar(false));
    const legacyTranscriptsBtn = document.getElementById('wa-dl-btn-dl-transcripts');
    if (legacyTranscriptsBtn) legacyTranscriptsBtn.addEventListener('click', () => triggerDownloadFromBar(true));

    updateSelectionActionBar();
  }

  /**
   * Update counters and states in the floating action bar
   */
  function updateSelectionActionBar() {
    if (typeof document === 'undefined') return;
    const sm = getSelectionManager();
    const badge = document.getElementById('wa-dl-count-badge');
    const masterCb = document.getElementById('wa-dl-master-cb');
    const masterText = document.getElementById('wa-dl-master-text');
    const dlMainBtn = document.getElementById('wa-dl-btn-download-main');
    const transcriptsBtn = document.getElementById('wa-dl-btn-transcripts');

    const totalSelected = sm ? sm.getSelectedCount() : 0;
    const totalFiles = sm ? sm.getTotalFilesCount() : 0;
    const allCbs = Array.from(document.querySelectorAll('.wa-dl-msg-cb'));
    const mountedCheckedCbs = allCbs.filter(cb => cb.checked);
    const downloadMode = sm ? sm.getDownloadMode() : 'zip';
    const inclTrans = sm ? sm.getIncludeTranscripts() : true;

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
        masterText.textContent = getI18nMsg('barSelectAll', null, 'Select all');
      } else if (allCbs.length > 0 && mountedCheckedCbs.length === allCbs.length) {
        masterCb.checked = true;
        masterCb.indeterminate = false;
        masterCb.setAttribute('aria-checked', 'true');
        masterText.textContent = getI18nMsg('barDeselectAll', null, 'Deselect all');
      } else {
        masterCb.checked = false;
        masterCb.indeterminate = true;
        masterCb.setAttribute('aria-checked', 'mixed');
        masterText.textContent = getI18nMsg('barSelectAllCount', [String(totalSelected)], `Select all (${totalSelected} total)`);
      }
    }

    if (dlMainBtn) {
      const count = totalFiles > 0 ? totalFiles : totalSelected;
      if (count === 0) {
        dlMainBtn.textContent = getI18nMsg('btnDownload', null, 'Download Selected');
      } else if (downloadMode === 'zip') {
        dlMainBtn.textContent = getI18nMsg('barDownloadZip', [String(count)], `📦 Download .zip (${count})`);
      } else {
        dlMainBtn.textContent = getI18nMsg('barDownloadIndividual', [String(count)], `📥 Download (${count})`);
      }
    }

    if (transcriptsBtn) {
      transcriptsBtn.classList.toggle('active', inclTrans);
      transcriptsBtn.setAttribute('aria-checked', inclTrans ? 'true' : 'false');
    }
  }

  /**
   * Trigger download directly from in-page floating bar
   * @param {boolean} [includeTranscriptsOverride]
   */
  async function triggerDownloadFromBar(includeTranscriptsOverride) {
    const sm = getSelectionManager();
    const md = getMediaDetector();
    const dp = getDownloadPipeline();
    if (!sm || !md || !dp || typeof document === 'undefined') return;

    // Sync any currently mounted checked boxes to ensure cache is completely up to date
    document.querySelectorAll('.wa-dl-msg-cb:checked').forEach(cb => {
      const id = cb.dataset.msgId;
      const target = cb.closest('.wa-dl-bubble-container, .wa-dl-message-row, [data-id]') || cb.parentElement;
      if (id && target) {
        const items = md.extractMediaItemsFromTarget(target);
        if (items.length > 0) sm.addMessageMedia(id, items);
      }
    });

    if (sm.getSelectedCount() === 0) {
      const badge = document.getElementById('wa-dl-count-badge');
      if (badge) {
        const orig = badge.textContent;
        badge.textContent = getI18nMsg('barSelectPrompt', null, '⚠️ Select a message!');
        badge.style.background = '#ea4335';
        setTimeout(() => {
          badge.textContent = orig;
          badge.style.background = '';
        }, 2000);
      }
      return;
    }

    const items = sm.getAllSelectedItems();
    const mode = sm.getDownloadMode();
    const inclTrans = (typeof includeTranscriptsOverride === 'boolean') ? includeTranscriptsOverride : sm.getIncludeTranscripts();
    const chatTitle = (sm && sm.getChatTitle()) || (md ? md.getChatTitle() : '');

    const badge = document.getElementById('wa-dl-count-badge');
    await dp.downloadBatch(items, {
      mode,
      chatTitle,
      includeTranscripts: inclTrans,
      onStatus: (statusText) => {
        if (badge) badge.textContent = statusText;
      }
    });

    if (badge) {
      badge.style.background = '#25d366';
      setTimeout(() => {
        updateSelectionActionBar();
        badge.style.background = '';
      }, 3000);
    }
  }

  /**
   * Inject persistent header button into WhatsApp Web chat header
   */
  function injectHeaderBadge() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('wa-dl-header-badge')) return;
    const chatHeader = document.querySelector('#main header') || document.querySelector('[data-testid="conversation-header"]');
    if (!chatHeader) return;

    const sm = getSelectionManager();
    isInternallyMutatingDOM = true;
    try {
      const active = sm ? sm.isSelectionModeActive() : false;
      const badge = document.createElement('button');
      badge.id = 'wa-dl-header-badge';
      badge.className = `wa-dl-header-badge ${active ? 'active' : ''}`;
      badge.textContent = getI18nMsg('headerSelectMedia', null, '📥 Select Media');
      badge.title = getI18nMsg('headerSelectMediaTooltip', null, 'Enable message selection mode (Shift + Click to select range)');
      badge.setAttribute('aria-pressed', active ? 'true' : 'false');
      badge.setAttribute('aria-label', getI18nMsg('headerSelectMediaTooltip', null, 'Enable message selection mode (Shift + Click to select range)'));

      badge.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSelectionMode();
      });

      const lastChild = chatHeader.lastElementChild;
      if (lastChild) {
        chatHeader.insertBefore(badge, lastChild);
      } else {
        chatHeader.appendChild(badge);
      }
    } finally {
      setTimeout(() => {
        isInternallyMutatingDOM = false;
      }, 60);
    }
  }

  /**
   * Toggle interactive in-page selection mode and render UI
   * @param {boolean} [forceState]
   * @returns {boolean}
   */
  function toggleSelectionMode(forceState) {
    const sm = getSelectionManager();
    if (!sm) return false;
    const active = sm.toggleSelectionMode(forceState);
    if (active) {
      renderFloatingActionBar();
      renderSelectionCheckboxes();
    } else {
      removeInjectedUI();
    }
    const badge = document.getElementById('wa-dl-header-badge');
    if (badge) {
      badge.setAttribute('aria-pressed', active ? 'true' : 'false');
      badge.classList.toggle('active', active);
    }
    return active;
  }

  function removeInjectedUI() {
    if (typeof document === 'undefined') return;
    const bar = document.getElementById('wa-dl-action-bar');
    if (bar) bar.remove();
    removeInjectedCheckboxes();
    const badge = document.getElementById('wa-dl-header-badge');
    if (badge) {
      badge.setAttribute('aria-pressed', 'false');
      badge.classList.remove('active');
    }
  }

  return {
    getI18nMsg,
    injectHeaderBadge,
    toggleSelectionMode,
    renderFloatingActionBar,
    updateSelectionActionBar,
    renderSelectionCheckboxes,
    scheduleSelectionRender,
    handleCheckboxClick,
    triggerDownloadFromBar,
    removeInjectedCheckboxes,
    removeInjectedUI
  };
});
