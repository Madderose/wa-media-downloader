/**
 * WA Media Downloader — Content Script (Orchestrator)
 * Lightweight coordinator connecting modular services:
 * - NamingService (lib/naming-service.js)
 * - MediaDetector (lib/media-detector.js)
 * - SelectionManager (lib/selection-manager.js)
 * - DownloadPipeline (lib/download-pipeline.js)
 * - UIController (lib/ui-controller.js)
 * - ZipPackager (lib/zip-packager.js)
 * 
 * 100% Zero-Data: runs entirely client-side in browser session.
 */

// Development debug logging flag — must remain FALSE in production/AMO releases
const DEBUG_SERVER_LOGS = false;

function remoteLog(...args) {
  if (!DEBUG_SERVER_LOGS) return;
  try {
    const text = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'log', message: text }, () => {
        if (chrome.runtime.lastError) {}
      });
    }
  } catch (e) {}
}

// Service references
const Naming = (typeof NamingService !== 'undefined' ? NamingService : (typeof globalThis !== 'undefined' ? globalThis.NamingService : null));
const Detector = (typeof MediaDetector !== 'undefined' ? MediaDetector : (typeof globalThis !== 'undefined' ? globalThis.MediaDetector : null));
const Selection = (typeof SelectionManager !== 'undefined' ? SelectionManager : (typeof globalThis !== 'undefined' ? globalThis.SelectionManager : null));
const Downloader = (typeof DownloadPipeline !== 'undefined' ? DownloadPipeline : (typeof globalThis !== 'undefined' ? globalThis.DownloadPipeline : null));
const UI = (typeof UIController !== 'undefined' ? UIController : (typeof globalThis !== 'undefined' ? globalThis.UIController : null));

// Backward compatibility properties & aliases
let cancelDownload = false;
let selectionModeActive = false;
let currentDownloadMode = 'zip';
let currentIncludeTranscripts = true;

// Expose state references for legacy callers
const selectedMessageIds = Selection ? Selection.selectedMessageIds : new Set();
const selectedMediaCache = Selection ? Selection.selectedMediaCache : new Map();

function notifySelectionState() {
  if (Selection) Selection.notifySelectionState();
}

function clearSelection() {
  if (Selection) {
    Selection.clearSelection();
    Selection.setSelectionModeActive(false);
  }
  if (UI) UI.removeInjectedUI();
}

function toggleSelectionMode(forceState) {
  if (UI) {
    const active = UI.toggleSelectionMode(forceState);
    selectionModeActive = active;
    return active;
  }
  return false;
}

async function downloadSelectedInPage(includeTranscripts = false) {
  if (UI) {
    await UI.triggerDownloadFromBar(includeTranscripts);
  }
}

// React to selection state changes
if (Selection) {
  Selection.subscribe((state) => {
    selectionModeActive = state.active;
    currentDownloadMode = state.downloadMode;
    currentIncludeTranscripts = state.includeTranscripts;
  });
}

// Synchronize options with chrome.storage.local
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get({ downloadMode: 'zip', includeTranscripts: true }, (res) => {
    if (res) {
      if (res.downloadMode && Selection) Selection.setDownloadMode(res.downloadMode);
      if (typeof res.includeTranscripts === 'boolean' && Selection) Selection.setIncludeTranscripts(res.includeTranscripts);
      if (UI) UI.updateSelectionActionBar();
    }
  });

  if (chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        let changed = false;
        if (changes.downloadMode && Selection) {
          Selection.setDownloadMode(changes.downloadMode.newValue || 'zip');
          changed = true;
        }
        if (changes.includeTranscripts && Selection) {
          Selection.setIncludeTranscripts(changes.includeTranscripts.newValue);
          changed = true;
        }
        if (changed && UI) UI.updateSelectionActionBar();
      }
    });
  }
}

// Observe chat scroll & DOM virtualization recycling
let scrollObserverAttached = false;
let currentScrollTarget = null;
function attachScrollObserver() {
  const target = document.querySelector('#main') || document.body;
  if (!target) {
    setTimeout(attachScrollObserver, 1000);
    return;
  }

  const scrollPane = target.querySelector('.copyable-area') || target;
  if (scrollPane !== currentScrollTarget) {
    currentScrollTarget = scrollPane;
    scrollPane.addEventListener('scroll', () => {
      if (UI) UI.scheduleSelectionRender();
    }, { passive: true });
  }

  if (!scrollObserverAttached) {
    const obs = new MutationObserver(() => {
      const newTarget = document.querySelector('#main') || document.body;
      const newPane = newTarget ? (newTarget.querySelector('.copyable-area') || newTarget) : null;
      if (newPane && newPane !== currentScrollTarget) {
        currentScrollTarget = newPane;
        newPane.addEventListener('scroll', () => {
          if (UI) UI.scheduleSelectionRender();
        }, { passive: true });
      }
      if (UI) UI.scheduleSelectionRender();
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    scrollObserverAttached = true;
  }
}

// A11y: Escape key dismisses in-page selection mode cleanly (only physical user keypress, ignore synthetic events)
window.addEventListener('keydown', (e) => {
  if (e.isTrusted && e.key === 'Escape' && Selection && Selection.isSelectionModeActive()) {
    toggleSelectionMode(false);
  }
});

// Setup on WhatsApp Web page load
setTimeout(() => {
  if (UI) UI.injectHeaderBadge();
  attachScrollObserver();
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
    try {
      document.documentElement.dataset.waExtensionId = chrome.runtime.id;
    } catch (e) {}
  }
  remoteLog('🚀 content.js initialized successfully on WhatsApp Web! URL: ' + window.location.href);
}, 1500);

// -------------------------------------------------------------
// RUNTIME MESSAGE HANDLER (Extension Popup & Background)
// -------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'cancelDownload') {
    cancelDownload = true;
    if (Downloader) Downloader.cancel();
    sendResponse({ ok: true });
    return false;
  }

  if (msg.action === 'toggleSelectionMode') {
    const state = toggleSelectionMode();
    sendResponse({ active: state });
    return false;
  }

  if (msg.action === 'getSelectionState') {
    if (Selection) {
      sendResponse(Selection.getState());
    } else {
      sendResponse({ active: false, selectedCount: 0, totalFiles: 0 });
    }
    return false;
  }

  if (msg.action === 'clearSelection') {
    clearSelection();
    sendResponse({ ok: true });
    return false;
  }

  if (msg.action === 'downloadSelectedInPage') {
    if (typeof msg.downloadMode === 'string' && Selection) {
      Selection.setDownloadMode(msg.downloadMode);
    }
    const incl = typeof msg.includeTranscripts === 'boolean' 
      ? msg.includeTranscripts 
      : (Selection ? Selection.getIncludeTranscripts() : true);
    downloadSelectedInPage(incl);
    sendResponse({ ok: true, started: true });
    return false;
  }

  if (msg.action === 'scanMedia') {
    if (Detector) {
      const results = Detector.scanMediaInChat({ visibleOnly: !!msg.visibleOnly });
      sendResponse(results);
    } else {
      sendResponse({ docs: [], images: [], videos: [], audio: [] });
    }
    return false;
  }

  if (msg.action === 'downloadMediaInPage') {
    const items = msg.media || [];
    const mode = msg.downloadMode || (Selection ? Selection.getDownloadMode() : 'zip');
    const incl = !!msg.includeTranscripts;
    const chatTitle = (Selection && Selection.getChatTitle()) || (Detector ? Detector.getChatTitle() : '');

    cancelDownload = false;
    sendResponse({ started: true, total: items.length });

    if (Downloader) {
      Downloader.downloadBatch(items, {
        mode,
        chatTitle,
        includeTranscripts: incl,
        onProgress: (p) => {
          try {
            chrome.runtime.sendMessage({ action: 'progress', ...p });
          } catch (e) {}
        }
      });
    }
    return false;
  }

  if (msg.action === 'clickDocs') {
    const allowed = msg.allowedExt || [];
    const root = document.querySelector('#main') || document;
    const allButtons = root.querySelectorAll('[data-testid="document-thumb"], [data-testid="msg-doc"]');

    const buttons = Array.from(allButtons).filter(btn => {
      if (msg.visibleOnly && Detector && !Detector.isElementInViewport(btn)) return false;
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

    if (Downloader) {
      Downloader.automateDocumentDownloads(buttons, {
        onProgress: (p) => {
          try {
            chrome.runtime.sendMessage({ action: 'docProgress', ...p });
          } catch (e) {}
        }
      });
    }
    return false;
  }

  return false;
});
