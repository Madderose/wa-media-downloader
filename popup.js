const scanBtn = document.getElementById('scanBtn');
const downloadBtn = document.getElementById('downloadBtn');
const cancelBtn = document.getElementById('cancelBtn');
const countEl = document.getElementById('count');
const doneEl = document.getElementById('done');
const statusEl = document.getElementById('status');
const progressWrap = document.getElementById('progress-wrap');
const progressFill = document.getElementById('progress-fill');
const progressLabel = document.getElementById('progress-label');
const filtersEl = document.getElementById('filters');

let scanned = null;
let currentTab = null;
let selected = { docs: false, images: false, videos: false, audio: false };
let selectedDocExts = {};
let cancelRequested = false;
let doneCount = 0;
let currentScope = 'all'; // 'all' or 'visible'

const scopeAllBtn = document.getElementById('scopeAll');
const scopeVisibleBtn = document.getElementById('scopeVisible');
const toggleSelectBtn = document.getElementById('toggleSelectBtn');
const includeTranscriptsCb = document.getElementById('includeTranscriptsCb');
const modeZipRadio = document.getElementById('modeZip');
const modeIndividualRadio = document.getElementById('modeIndividual');

let currentDownloadMode = 'zip'; // 'zip' (default) or 'individual'

// --- Storage & Download Mode Initialization ---
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get({ downloadMode: 'zip', includeTranscripts: true }, (res) => {
    currentDownloadMode = (res && res.downloadMode) || 'zip';
    if (currentDownloadMode === 'individual') {
      if (modeIndividualRadio) modeIndividualRadio.checked = true;
    } else {
      if (modeZipRadio) modeZipRadio.checked = true;
    }
    if (includeTranscriptsCb && res && typeof res.includeTranscripts === 'boolean') {
      includeTranscriptsCb.checked = res.includeTranscripts;
    }
  });
}

if (includeTranscriptsCb) {
  includeTranscriptsCb.addEventListener('change', () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ includeTranscripts: includeTranscriptsCb.checked });
    }
  });
}

if (modeZipRadio) {
  modeZipRadio.addEventListener('change', () => {
    if (modeZipRadio.checked) {
      currentDownloadMode = 'zip';
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ downloadMode: 'zip' });
      }
    }
  });
}

if (modeIndividualRadio) {
  modeIndividualRadio.addEventListener('change', () => {
    if (modeIndividualRadio.checked) {
      currentDownloadMode = 'individual';
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ downloadMode: 'individual' });
      }
    }
  });
}

// --- Synchronized Live In-Page Selection ---
const liveSelectionCard = document.getElementById('liveSelectionCard');
const liveSelectionCount = document.getElementById('liveSelectionCount');
const liveDownloadBtn = document.getElementById('liveDownloadBtn');
const liveClearBtn = document.getElementById('liveClearBtn');

async function getTargetWhatsAppTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes('web.whatsapp.com')) {
      return tab;
    }
    const waTabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' });
    return (waTabs && waTabs.length > 0) ? waTabs[0] : null;
  } catch (e) {
    return null;
  }
}

async function checkLiveSelection() {
  if (!liveSelectionCard || typeof chrome === 'undefined' || !chrome.tabs) return;
  try {
    const tab = await getTargetWhatsAppTab();
    if (!tab || !tab.id) {
      liveSelectionCard.style.display = 'none';
      return;
    }
    currentTab = tab;
    chrome.tabs.sendMessage(tab.id, { action: 'getSelectionState' }, (res) => {
      if (chrome.runtime.lastError || !res) {
        liveSelectionCard.style.display = 'none';
        return;
      }
      updateLiveSelectionUI(res);
    });
  } catch (e) {
    liveSelectionCard.style.display = 'none';
  }
}

function updateLiveSelectionUI(state) {
  if (!liveSelectionCard) return;
  if (state && state.active && state.selectedCount > 0) {
    liveSelectionCard.style.display = 'block';
    if (liveSelectionCount) {
      const countMsg = chrome.i18n?.getMessage('popupLiveSelectionCount', [String(state.selectedCount)]);
      const chatSuffix = state.chatTitle ? ` (${state.chatTitle})` : '';
      liveSelectionCount.textContent = (countMsg || `${state.selectedCount} selected`) + chatSuffix;
    }
  } else {
    liveSelectionCard.style.display = 'none';
  }
}

if (liveDownloadBtn) {
  liveDownloadBtn.addEventListener('click', async () => {
    const tab = await getTargetWhatsAppTab();
    if (!tab || !tab.id) return;
    liveDownloadBtn.disabled = true;
    chrome.tabs.sendMessage(tab.id, {
      action: 'downloadSelectedInPage',
      includeTranscripts: !!(includeTranscriptsCb && includeTranscriptsCb.checked),
      downloadMode: currentDownloadMode
    }, () => {
      setTimeout(() => {
        liveDownloadBtn.disabled = false;
        checkLiveSelection();
      }, 1200);
    });
  });
}

if (liveClearBtn) {
  liveClearBtn.addEventListener('click', async () => {
    const tab = await getTargetWhatsAppTab();
    if (!tab || !tab.id) return;
    chrome.tabs.sendMessage(tab.id, { action: 'clearSelection' }, () => {
      checkLiveSelection();
    });
  });
}

// --- Internationalization (i18n) Helper ---
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (chrome && chrome.i18n && chrome.i18n.getMessage) {
      const msg = chrome.i18n.getMessage(key);
      if (msg) el.textContent = msg;
    }
  });
}
document.addEventListener('DOMContentLoaded', () => {
  applyI18n();
  checkLiveSelection();
});
applyI18n();
checkLiveSelection();

// --- Scope Selector: All Chat vs Visible Screen ---
if (scopeAllBtn && scopeVisibleBtn) {
  scopeAllBtn.addEventListener('click', () => {
    currentScope = 'all';
    scopeAllBtn.classList.add('active');
    scopeAllBtn.setAttribute('aria-pressed', 'true');
    scopeVisibleBtn.classList.remove('active');
    scopeVisibleBtn.setAttribute('aria-pressed', 'false');
  });

  scopeVisibleBtn.addEventListener('click', () => {
    currentScope = 'visible';
    scopeVisibleBtn.classList.add('active');
    scopeVisibleBtn.setAttribute('aria-pressed', 'true');
    scopeAllBtn.classList.remove('active');
    scopeAllBtn.setAttribute('aria-pressed', 'false');
  });
}

// --- Toggle In-Page Selection Mode on WhatsApp Web ---
if (toggleSelectBtn) {
  toggleSelectBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || (tab.url && !tab.url.includes('web.whatsapp.com'))) {
      statusEl.textContent = chrome.i18n?.getMessage('statusOpenWA') || 'Please open WhatsApp Web first.';
      return;
    }
    chrome.tabs.sendMessage(tab.id, { action: 'toggleSelectionMode' }, (res) => {
      if (chrome.runtime.lastError || !res) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            'lib/zip-packager.js',
            'lib/naming-service.js',
            'lib/media-detector.js',
            'lib/selection-manager.js',
            'lib/download-pipeline.js',
            'lib/ui-controller.js',
            'content.js'
          ]
        }).then(() => {
          chrome.tabs.sendMessage(tab.id, { action: 'toggleSelectionMode' }, (retryRes) => {
            const enabledMsg = chrome.i18n?.getMessage('statusSelectionEnabled') || '✅ Selection enabled on WhatsApp!';
            const disabledMsg = chrome.i18n?.getMessage('statusSelectionDisabled') || 'Selection disabled.';
            statusEl.textContent = retryRes?.active ? enabledMsg : disabledMsg;
          });
        }).catch(() => {
          statusEl.textContent = 'Error: Please reload WhatsApp Web.';
        });
        return;
      }
      const enabledMsg = chrome.i18n?.getMessage('statusSelectionEnabled') || '✅ Selection enabled on WhatsApp!';
      const disabledMsg = chrome.i18n?.getMessage('statusSelectionDisabled') || 'Selection disabled.';
      statusEl.textContent = res.active ? enabledMsg : disabledMsg;
    });
  });
}

// --- Media type toggles ---
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    selected[type] = !selected[type];
    btn.classList.toggle('inactive', !selected[type]);
    btn.setAttribute('aria-pressed', selected[type] ? 'true' : 'false');

    if (type === 'docs') {
      const extWrap = document.getElementById('doc-ext-filters');
      if (extWrap) extWrap.style.display = selected.docs ? 'flex' : 'none';
    }

    updateDownloadLabel();
  });
});

function getSelectedDocExts() {
  return Object.keys(selectedDocExts).filter(ext => selectedDocExts[ext]);
}

function countSelectedDocs() {
  if (!scanned) return 0;
  const exts = getSelectedDocExts();
  if (!selected.docs || exts.length === 0) return 0;
  return scanned.docs.filter(d => {
    const ext = d.filename.split('.').pop().toLowerCase();
    return exts.includes(ext);
  }).length;
}

function updateDownloadLabel() {
  if (!scanned) return;
  let total = countSelectedDocs();
  if (selected.images) total += scanned.images.length;
  if (selected.videos) total += scanned.videos.length;
  if (selected.audio) total += scanned.audio.length;
  countEl.textContent = total;
  downloadBtn.textContent = `Download Selected (${total})`;
}

function handleScanResult(res) {
  scanned = res;

  filtersEl.style.display = 'flex';
  const types = ['docs', 'images', 'videos', 'audio'];
  types.forEach(type => {
    const count = (res[type] && res[type].length) || 0;
    const countSpan = document.getElementById(`f${type}`);
    if (countSpan) countSpan.textContent = count;
    const btn = document.getElementById(`filter-${type}`);
    if (btn) {
      if (count === 0) {
        btn.style.display = 'none';
        selected[type] = false;
      } else {
        btn.style.display = '';
      }
    }
  });

  if (res.docs && res.docs.length > 0) {
    const extCount = {};
    res.docs.forEach(d => {
      const ext = d.filename.split('.').pop().toLowerCase();
      extCount[ext] = (extCount[ext] || 0) + 1;
    });

    selectedDocExts = {};
    Object.keys(extCount).forEach(ext => { selectedDocExts[ext] = false; });

    let extWrap = document.getElementById('doc-ext-filters');
    if (!extWrap) {
      extWrap = document.createElement('div');
      extWrap.id = 'doc-ext-filters';
      extWrap.style.cssText = 'display:none; flex-wrap:wrap; gap:6px; margin-bottom:12px; padding-left:8px;';
      filtersEl.insertAdjacentElement('afterend', extWrap);
    }
    extWrap.innerHTML = '';

    Object.keys(extCount).forEach(ext => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn inactive';
      btn.style.fontSize = '11px';
      btn.textContent = `.${ext.toUpperCase()} (${extCount[ext]})`;
      btn.addEventListener('click', () => {
        selectedDocExts[ext] = !selectedDocExts[ext];
        btn.classList.toggle('inactive', !selectedDocExts[ext]);
        updateDownloadLabel();
      });
      extWrap.appendChild(btn);
    });
  }

  updateDownloadLabel();
  const scopeText = currentScope === 'visible' ? 'on current screen' : 'in entire chat';
  statusEl.textContent = `Scan completed (${scopeText}). Choose media types.`;
  scanBtn.style.display = 'none';
  downloadBtn.style.display = 'block';
}

// --- STEP 1: Scan ---
scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  statusEl.textContent = 'Scanning...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  if (!tab || (tab.url && !tab.url.includes('web.whatsapp.com'))) {
    statusEl.textContent = 'Please open WhatsApp Web first.';
    scanBtn.disabled = false;
    return;
  }

  const scanPayload = {
    action: 'scanMedia',
    visibleOnly: currentScope === 'visible'
  };

  chrome.tabs.sendMessage(tab.id, scanPayload, async (res) => {
    if (chrome.runtime.lastError || !res) {
      try {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          files: ['lib/page-interceptor.js']
        }).catch(() => {});
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            'lib/zip-packager.js',
            'lib/naming-service.js',
            'lib/media-detector.js',
            'lib/selection-manager.js',
            'lib/download-pipeline.js',
            'lib/ui-controller.js',
            'content.js'
          ]
        });
        chrome.tabs.sendMessage(tab.id, scanPayload, (retryRes) => {
          if (chrome.runtime.lastError || !retryRes) {
            statusEl.textContent = 'Error: Reload WhatsApp Web and try again.';
            scanBtn.disabled = false;
            return;
          }
          handleScanResult(retryRes);
        });
      } catch (e) {
        statusEl.textContent = 'Error: Reload WhatsApp Web and try again.';
        scanBtn.disabled = false;
      }
      return;
    }

    handleScanResult(res);
  });
});

// --- STEP 2: Download ---
downloadBtn.addEventListener('click', () => {
  downloadBtn.disabled = true;
  cancelRequested = false;
  cancelBtn.style.display = 'block';
  cancelBtn.disabled = false;
  cancelBtn.textContent = '✕ Cancel';
  progressWrap.style.display = 'block';
  progressWrap.setAttribute('aria-valuenow', '0');
  progressLabel.style.display = 'block';
  progressLabel.textContent = '';
  progressFill.style.width = '0%';
  doneEl.textContent = '0';
  doneCount = 0;

  const allowedExt = getSelectedDocExts();
  const includeTranscripts = !!(includeTranscriptsCb && includeTranscriptsCb.checked);

  if (selected.docs && allowedExt.length > 0) {
    chrome.tabs.sendMessage(currentTab.id, {
      action: 'clickDocs',
      allowedExt,
      visibleOnly: currentScope === 'visible'
    }, () => {});
  }

  const mediaItems = [
    ...(selected.images ? scanned.images : []),
    ...(selected.videos ? scanned.videos : []),
    ...(selected.audio ? scanned.audio : [])
  ];

  if (mediaItems.length > 0) {
    chrome.tabs.sendMessage(currentTab.id, {
      action: 'downloadMediaInPage',
      media: mediaItems,
      includeTranscripts,
      downloadMode: currentDownloadMode
    }, () => {});
  }

  const total = parseInt(countEl.textContent || '0');
  if (currentDownloadMode === 'zip') {
    statusEl.textContent = chrome.i18n?.getMessage('statusZipping') || `Packaging ${total} file(s) into .zip...`;
  } else {
    statusEl.textContent = `Downloading ${total} file(s)...`;
  }
});

// --- Cancel ---
cancelBtn.addEventListener('click', async () => {
  cancelRequested = true;
  cancelBtn.disabled = true;
  cancelBtn.textContent = 'Cancelling...';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'cancelDownload' }, () => {});
  }
  statusEl.textContent = 'Cancelling...';
});

// --- Progress ---
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'docProgress' || msg.action === 'progress') {
    doneCount = (msg.completed !== undefined) ? msg.completed : doneCount + 1;
    doneEl.textContent = doneCount;
    const total = msg.total || parseInt(countEl.textContent || '1');
    const pct = Math.min(100, Math.round((doneCount / total) * 100));
    progressFill.style.width = `${pct}%`;
    progressWrap.setAttribute('aria-valuenow', String(pct));
    progressLabel.textContent = `${doneCount} / ${total}`;

    if (msg.cancelled || doneCount >= total || msg.zipCompleted) {
      cancelBtn.style.display = 'none';
      cancelBtn.disabled = false;
      cancelBtn.textContent = '✕ Cancel';
      if (msg.cancelled) {
        statusEl.textContent = `Stopped at ${doneCount} / ${total} file(s).`;
      } else if (msg.zipCompleted || currentDownloadMode === 'zip') {
        statusEl.textContent = chrome.i18n?.getMessage('statusZipDone') || '✅ Done! Single .zip archive downloaded.';
      } else {
        statusEl.textContent = `✅ Done! ${doneCount} file(s) downloaded.`;
      }
      downloadBtn.disabled = false;
    }
  }

  if (msg.action === 'selectionStateChanged') {
    updateLiveSelectionUI(msg);
  }
});

