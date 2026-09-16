/**
 * WA Media Downloader — DownloadPipeline
 * Unified downloading engine supporting PKZIP single archives, sequential individual downloads,
 * companion transcripts export, and document preview automation.
 * 
 * 100% Zero-Data: runs entirely client-side in browser session.
 */

(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(require('./zip-packager.js'), require('./naming-service.js'));
  } else if (typeof define === 'function' && define.amd) {
    define(['./zip-packager.js', './naming-service.js'], factory);
  } else {
    root.DownloadPipeline = factory(root.ZipPackager, root.NamingService);
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this || {}), function (ZipPackager, NamingService) {
  'use strict';

  let isCancelled = false;

  function getNamingService() {
    if (NamingService) return NamingService;
    if (typeof globalThis !== 'undefined' && globalThis.NamingService) return globalThis.NamingService;
    if (typeof window !== 'undefined' && window.NamingService) return window.NamingService;
    return null;
  }

  function getZipPackager() {
    if (ZipPackager) return ZipPackager;
    if (typeof globalThis !== 'undefined' && globalThis.ZipPackager) return globalThis.ZipPackager;
    if (typeof window !== 'undefined' && window.ZipPackager) return window.ZipPackager;
    return null;
  }

  function cancel() {
    isCancelled = true;
  }

  function resetCancel() {
    isCancelled = false;
  }

  function isCancelRequested() {
    return isCancelled;
  }

  /**
   * Download a companion text file
   * @param {string} text
   * @param {string} filename
   */
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

  /**
   * Build formatted transcripts text
   * @param {Array<Object>} items
   * @param {string} [chatTitle]
   * @returns {string}
   */
  function buildTranscriptText(items, chatTitle = '') {
    if (!items || items.length === 0) return '';
    const transcriptLines = [
      '====================================================================',
      'MEDIA AND TRANSCRIPTS EXPORT - WHATSAPP WEB',
      `Export Chat: ${chatTitle || 'Current Chat'}`,
      `Export Date: ${new Date().toLocaleString()}`,
      `Total Files: ${items.length}`,
      '====================================================================\n'
    ];
    items.forEach((it) => {
      const fn = it.assignedFilename || it.filename || 'media_item';
      const timeDisplay = it.timestamp || it.humanTimestamp || 'No date';
      transcriptLines.push(`[${timeDisplay}] ${it.sender || 'Unknown Sender'}:`);
      if (it.type === 'video') {
        transcriptLines.push(`  🎥 Video: ${fn}`);
      } else if (it.type === 'audio') {
        transcriptLines.push(`  🎵 Audio: ${fn}`);
      } else if (it.type === 'doc') {
        transcriptLines.push(`  📄 Document: ${fn}`);
      } else {
        transcriptLines.push(`  📎 File: ${fn}`);
      }
      if (it.text) transcriptLines.push(`  💬 Caption / Text: "${it.text}"`);
      transcriptLines.push('--------------------------------------------------------------------');
    });
    return transcriptLines.join('\n');
  }

  /**
   * Execute batch download (either as ZIP or individual files)
   * @param {Array<Object>} rawItems
   * @param {Object} [options]
   * @param {'zip'|'individual'} [options.mode='zip']
   * @param {string} [options.chatTitle='']
   * @param {boolean} [options.includeTranscripts=true]
   * @param {Function} [options.onProgress]
   * @param {Function} [options.onStatus]
   * @returns {Promise<{ completed: number, total: number, cancelled: boolean }>}
   */
  async function downloadBatch(rawItems, options = {}) {
    resetCancel();
    const items = [...(rawItems || [])];
    const mode = options.mode || 'zip';
    const chatTitle = (options.chatTitle || '').trim();
    const cleanChat = chatTitle ? chatTitle.replace(/[\\/:*?"<>|\x00-\x1F]/g, '_').replace(/\s+/g, '_').slice(0, 30) : '';
    const includeTranscripts = !!options.includeTranscripts;
    const onProgress = options.onProgress || (() => {});
    const onStatus = options.onStatus || (() => {});

    if (items.length === 0) {
      return { completed: 0, total: 0, cancelled: false };
    }

    const ns = getNamingService();
    if (ns && ns.assignBatchFilenames) {
      ns.assignBatchFilenames(items);
    }

    const transcriptText = includeTranscripts ? buildTranscriptText(items, chatTitle) : '';
    const packager = getZipPackager();

    // Separate media items (with URL) and document buttons needing preview clicks
    const urlItems = items.filter(it => it.url && it.type !== 'doc');
    const docButtons = items.filter(it => it.type === 'doc' && it.docBtn).map(it => it.docBtn);

    let completed = 0;

    if (mode === 'zip' && packager) {
      const zipFiles = [];
      const totalToFetch = urlItems.length;

      for (let i = 0; i < totalToFetch; i++) {
        if (isCancelled) {
          onProgress({ completed, total: items.length, cancelled: true });
          break;
        }

        const it = urlItems[i];
        onStatus(`📦 Zipping ${i + 1}/${totalToFetch}...`);
        try {
          const res = await fetch(it.url);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
          }
          const blob = await res.blob();
          zipFiles.push({
            name: it.assignedFilename || it.filename,
            data: blob
          });
        } catch (e) {
          console.warn('Zip media fetch error for item:', it.filename, e);
        }

        completed++;
        onProgress({ completed, total: items.length });
      }

      // Capture documents (PDFs, spreadsheets, etc.) into the unified ZIP archive
      const docItems = items.filter(it => it.type === 'doc');
      if (docItems.length > 0 && !isCancelled) {
        const docZipFiles = await captureDocumentBlobs(docItems, {
          onProgress,
          onStatus,
          initialCompleted: completed,
          totalItems: items.length
        });
        zipFiles.push(...docZipFiles);
        completed = items.length;
      }

      if (includeTranscripts && transcriptText) {
        const exportTime = ns ? ns.formatHumanTimestamp(new Date()) : `${Date.now()}`;
        const transName = cleanChat ? `WA_${cleanChat}_Transcripts_${exportTime}.txt` : `WA_Transcripts_${exportTime}.txt`;
        zipFiles.push({
          name: transName,
          data: transcriptText
        });
      }

      if (zipFiles.length > 0 && !isCancelled) {
        onStatus('📦 Finalizing .zip...');
        const zipBlob = await packager.createZipBlob(zipFiles);
        const exportTime = ns ? ns.formatHumanTimestamp(new Date()) : `${Date.now()}`;
        const zipPrefix = cleanChat ? `WA_${cleanChat}_` : 'WA_Media_';
        const zipFilename = `${zipPrefix}${exportTime}.zip`;
        const downloadUrl = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = zipFilename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          a.remove();
          URL.revokeObjectURL(downloadUrl);
        }, 3500);

        onProgress({ completed: items.length, total: items.length, zipCompleted: true });
        onStatus('✅ .zip downloaded!');
      } else if (!isCancelled) {
        onProgress({ completed: 0, total: items.length, zipCompleted: false });
        onStatus('⚠️ No valid media could be retrieved');
      }
    } else {
      // Individual file downloads
      if (includeTranscripts && transcriptText) {
        const exportTime = ns ? ns.formatHumanTimestamp(new Date()) : `${Date.now()}`;
        const transName = cleanChat ? `WA_${cleanChat}_Transcripts_${exportTime}.txt` : `WA_Transcripts_${exportTime}.txt`;
        downloadTextFile(transcriptText, transName);
      }

      for (const item of urlItems) {
        if (isCancelled) {
          onProgress({ completed, total: items.length, cancelled: true });
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
        onProgress({ completed, total: items.length });
        await new Promise(r => setTimeout(r, 350));
      }

      // Automate individual document downloads when not in ZIP mode
      if (docButtons.length > 0 && !isCancelled) {
        await automateDocumentDownloads(docButtons, { onProgress, onStatus });
      }
    }

    return { completed, total: items.length, cancelled: isCancelled };
  }

  /**
   * Helper to locate action buttons (download, close) inside WhatsApp Web modals
   * @param {Array<string>} keywords
   * @param {Array<string>} iconNames
   * @returns {Element|null}
   */
  function findModalButton(keywords, iconNames) {
    if (typeof document === 'undefined') return null;
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
  }

  function getInterceptorBridge() {
    if (typeof document === 'undefined') return null;
    let el = document.getElementById('wa-dl-interceptor-bridge');
    if (!el && document.documentElement) {
      el = document.createElement('div');
      el.id = 'wa-dl-interceptor-bridge';
      el.style.display = 'none';
      document.documentElement.appendChild(el);
    }
    return el;
  }

  /**
   * Capture document/PDF blobs via in-page preview interception for unified ZIP packaging
   * @param {Array<Object>} docItems
   * @param {Object} [options]
   * @param {Function} [options.onProgress]
   * @param {Function} [options.onStatus]
   * @param {number} [options.initialCompleted=0]
   * @param {number} [options.totalItems=0]
   * @returns {Promise<Array<{ name: string, data: Blob }>>}
   */
  async function captureDocumentBlobs(docItems, options = {}) {
    const onProgress = options.onProgress || (() => {});
    const onStatus = options.onStatus || (() => {});
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const capturedFiles = [];
    let completed = options.initialCompleted || 0;
    const total = options.totalItems || docItems.length;

    const bridge = getInterceptorBridge();
    if (bridge) {
      bridge.dataset.active = 'true';
      bridge.dataset.capturedUrl = '';
      bridge.dataset.capturedFilename = '';
      bridge.dataset.capturedTimestamp = '';
    }

    try {
      for (let i = 0; i < docItems.length; i++) {
        if (isCancelled) break;

        const it = docItems[i];
        onStatus(`📄 Capturing doc ${i + 1}/${docItems.length}...`);

        // If the document already has a valid direct blob URL (e.g. mock or preloaded)
        if (it.url && it.url.startsWith('blob:')) {
          try {
            const res = await fetch(it.url);
            if (res.ok) {
              const blob = await res.blob();
              capturedFiles.push({
                name: it.assignedFilename || it.filename || 'attached_document',
                data: blob
              });
              completed++;
              onProgress({ completed, total });
              continue;
            }
          } catch (e) {}
        }

        if (bridge) {
          bridge.dataset.capturedUrl = '';
          bridge.dataset.capturedFilename = '';
          bridge.dataset.capturedTimestamp = '';
        }

        if (it.docBtn && typeof it.docBtn.click === 'function') {
          it.docBtn.click();

          let dl = null;
          for (let attempt = 0; attempt < 35; attempt++) {
            if (isCancelled) break;
            await wait(200);
            dl = findModalButton(
              ['download', 'télécharger', 'descargar', 'herunterladen', 'baixar', 'scarica'],
              ['ic-download', 'download', 'download-refreshed']
            );
            if (dl) break;
          }

          if (dl && !isCancelled) {
            dl.click();

            // Wait for in-page interceptor to write captured blob URL to bridge dataset
            for (let attempt = 0; attempt < 30; attempt++) {
              if ((bridge && bridge.dataset.capturedUrl) || isCancelled) break;
              await wait(200);
            }

            if (bridge && bridge.dataset.capturedUrl) {
              const capturedUrl = bridge.dataset.capturedUrl;
              const capturedName = bridge.dataset.capturedFilename;
              try {
                const res = await fetch(capturedUrl);
                if (res.ok) {
                  const blob = await res.blob();
                  const filename = it.assignedFilename || capturedName || it.filename || 'attached_document';
                  capturedFiles.push({
                    name: filename,
                    data: blob
                  });
                }
              } catch (fetchErr) {
                console.warn('[WA-Downloader] Error fetching intercepted document blob:', fetchErr);
              }
            }
          }

          // Cleanly close the preview modal
          let x = null;
          for (let attempt = 0; attempt < 15; attempt++) {
            x = findModalButton(
              ['close', 'fermer', 'cerrar', 'schließen', 'fechar', 'chiudi'],
              ['x-refreshed', 'x', 'close', 'cancel']
            );
            if (x) break;
            await wait(150);
          }

          if (x) {
            x.click();
          } else if (typeof document !== 'undefined') {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
          }
          await wait(800);
        }

        completed++;
        onProgress({ completed, total });
      }
    } finally {
      if (bridge) {
        bridge.dataset.active = 'false';
      }
    }

    return capturedFiles;
  }

  /**
   * Automate clicking WhatsApp Web document previews and downloading them
   * @param {Array<Element>} buttons
   * @param {Object} [options]
   */
  async function automateDocumentDownloads(buttons, options = {}) {
    const onProgress = options.onProgress || (() => {});
    const onStatus = options.onStatus || (() => {});
    const wait = ms => new Promise(r => setTimeout(r, ms));

    let done = 0;
    for (const btn of buttons) {
      if (isCancelled) {
        onProgress({ docCompleted: done, total: buttons.length, cancelled: true });
        break;
      }

      onStatus(`📄 Downloading doc ${done + 1}/${buttons.length}...`);
      btn.click();

      let dl = null;
      for (let i = 0; i < 40; i++) {
        await wait(300);
        dl = findModalButton(
          ['download', 'télécharger', 'descargar', 'herunterladen', 'baixar', 'scarica'],
          ['ic-download', 'download', 'download-refreshed']
        );
        if (dl) break;
      }

      if (dl) {
        dl.click();
        await wait(1800);
      }

      let x = null;
      for (let i = 0; i < 20; i++) {
        x = findModalButton(
          ['close', 'fermer', 'cerrar', 'schließen', 'fechar', 'chiudi'],
          ['x-refreshed', 'x', 'close', 'cancel']
        );
        if (x) break;
      }
      if (x) {
        x.click();
      } else if (typeof document !== 'undefined') {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      }
      await wait(1200);

      done++;
      onProgress({ docCompleted: done, total: buttons.length });
    }
  }

  return {
    downloadBatch,
    captureDocumentBlobs,
    automateDocumentDownloads,
    downloadTextFile,
    buildTranscriptText,
    cancel,
    resetCancel,
    isCancelRequested
  };
});
