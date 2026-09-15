// Show welcome page on first install only
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});


// Development debug logging flag — must remain FALSE in production/AMO releases
const DEBUG_SERVER_LOGS = false;

// Forward extension logs to local debug server (only if DEBUG_SERVER_LOGS is enabled)
function forwardLog(text) {
  if (!DEBUG_SERVER_LOGS) return;
  try {
    fetch('http://127.0.0.1:9876/log', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: String(text)
    }).catch(() => {});
  } catch (e) {}
}

// Handle runtime messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'log') {
    forwardLog(msg.message);
    sendResponse({ ok: true });
    return false;
  }

  if (msg.action === 'downloadMedia') {
    const items = msg.media;
    let completed = 0;

    if (!items || items.length === 0) {
      sendResponse({ done: true, total: 0 });
      return false;
    }

    items.forEach((item, index) => {
      setTimeout(() => {
        chrome.downloads.download({
          url: item.url,
          filename: `WA_Media/${item.filename}`,
          saveAs: false,
          conflictAction: 'uniquify'
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.warn('Download error for item:', item.filename, chrome.runtime.lastError.message);
          }
          completed++;
          try {
            chrome.runtime.sendMessage({
              action: 'progress',
              completed,
              total: items.length
            }, () => {
              if (chrome.runtime.lastError) {
                // Popup might be closed, ignore
              }
            });
          } catch (e) {
            // Popup closed or unmounted
          }
        });
      }, index * 300);
    });

    sendResponse({ started: true, total: items.length });
    return false;
  }

  return false;
});
