/**
 * WA Media Downloader — Page Interceptor
 * Runs in the MAIN world context on https://web.whatsapp.com/*
 * 
 * Intercepts WhatsApp Web client-side document downloads (PDFs, DOCX, etc.)
 * during unified ZIP generation, captures the decrypted blob URL, and prevents
 * uncoordinated loose file downloads into the browser Downloads folder.
 * 
 * Uses a DOM bridge element (#wa-dl-interceptor-bridge) to guarantee seamless,
 * safe cross-world communication between the MAIN world and the ISOLATED extension world.
 * 
 * 100% Zero-Data: runs entirely client-side, zero analytics, zero external network calls.
 */

(function () {
  'use strict';

  if (typeof window === 'undefined' || window.__waDlInterceptorInstalled) return;
  window.__waDlInterceptorInstalled = true;

  function getBridge() {
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

  function recordCapture(url, filename) {
    const bridge = getBridge();
    if (bridge) {
      bridge.dataset.capturedUrl = url;
      bridge.dataset.capturedFilename = filename;
      bridge.dataset.capturedTimestamp = String(Date.now());
      bridge.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Hook HTMLAnchorElement.prototype.click to catch programmatic clicks on temporary <a> elements
  const origAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    const bridge = getBridge();
    const isInterceptActive = bridge && bridge.dataset.active === 'true';

    if (isInterceptActive && (this.download || this.hasAttribute('download')) && this.href) {
      const filename = this.download || this.getAttribute('download') || 'attached_document';
      const url = this.href;

      recordCapture(url, filename);

      // Suppress browser native download manager write during ZIP mode
      return;
    }
    return origAnchorClick.call(this);
  };

  // Capture phase listener as secondary safety layer for DOM-attached download links
  document.addEventListener('click', function (e) {
    const bridge = getBridge();
    const isInterceptActive = bridge && bridge.dataset.active === 'true';
    if (!isInterceptActive) return;

    const a = e.target ? (e.target.closest ? e.target.closest('a') : null) : null;
    if (a && (a.download || a.hasAttribute('download')) && a.href) {
      const filename = a.download || a.getAttribute('download') || 'attached_document';
      const url = a.href;

      recordCapture(url, filename);

      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
})();
