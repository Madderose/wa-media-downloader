/**
 * WA Media Downloader — SelectionManager
 * Virtual scroll memory cache, selection state tracking, and runtime state dispatch.
 * 
 * 100% Zero-Data: runs entirely client-side in memory.
 */

(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.SelectionManager = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this || {}), function () {
  'use strict';

  const selectedMessageIds = new Set();
  const selectedMediaCache = new Map(); // msgId -> Array of mediaItems
  let currentChatTitle = '';
  let selectionModeActive = false;
  let lastCheckedIndex = -1;
  let currentDownloadMode = 'zip';
  let currentIncludeTranscripts = true;

  const listeners = new Set();

  function subscribe(fn) {
    if (typeof fn === 'function') listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notifyListeners() {
    for (const fn of listeners) {
      try { fn(getState()); } catch (e) {}
    }
  }

  function notifySelectionState() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'selectionStateChanged',
          active: selectionModeActive,
          selectedCount: selectedMessageIds.size,
          chatTitle: currentChatTitle,
          downloadMode: currentDownloadMode,
          includeTranscripts: currentIncludeTranscripts
        }, () => {
          if (chrome.runtime.lastError) {}
        });
      }
    } catch (e) {}
    notifyListeners();
  }

  function isSelectionModeActive() {
    return selectionModeActive;
  }

  function setSelectionModeActive(state) {
    selectionModeActive = !!state;
    notifySelectionState();
  }

  function toggleSelectionMode(forceState) {
    selectionModeActive = (typeof forceState === 'boolean') ? forceState : !selectionModeActive;
    if (!selectionModeActive) {
      selectedMessageIds.clear();
      selectedMediaCache.clear();
      lastCheckedIndex = -1;
    }
    notifySelectionState();
    return selectionModeActive;
  }

  function addMessageMedia(msgId, items) {
    if (!msgId) return;
    const list = Array.isArray(items) ? items : (items ? [items] : []);
    if (list.length > 0) {
      selectedMediaCache.set(msgId, list);
      selectedMessageIds.add(msgId);
    }
    notifySelectionState();
  }

  function removeMessage(msgId) {
    if (!msgId) return;
    selectedMessageIds.delete(msgId);
    selectedMediaCache.delete(msgId);
    notifySelectionState();
  }

  function hasMessage(msgId) {
    return selectedMessageIds.has(msgId);
  }

  function clearSelection() {
    selectedMessageIds.clear();
    selectedMediaCache.clear();
    lastCheckedIndex = -1;
    notifySelectionState();
  }

  function getSelectedCount() {
    return selectedMessageIds.size;
  }

  function getTotalFilesCount() {
    let count = 0;
    for (const list of selectedMediaCache.values()) {
      count += Array.isArray(list) ? list.length : (list ? 1 : 0);
    }
    return count;
  }

  function getAllSelectedItems() {
    const rawItems = [];
    for (const [, mediaOrList] of selectedMediaCache.entries()) {
      const list = Array.isArray(mediaOrList) ? mediaOrList : [mediaOrList];
      for (const item of list) {
        if (item) rawItems.push(item);
      }
    }
    return rawItems;
  }

  function getChatTitle() {
    return currentChatTitle;
  }

  function setChatContext(chatTitle) {
    const cleanTitle = (chatTitle || '').trim();
    if (currentChatTitle && cleanTitle && currentChatTitle !== cleanTitle) {
      // Switched to a different chat: clear previous chat's selection to avoid cross-chat state leak
      selectedMessageIds.clear();
      selectedMediaCache.clear();
      lastCheckedIndex = -1;
      currentChatTitle = cleanTitle;
      notifySelectionState();
      return true; // chat switched
    }
    if (cleanTitle) {
      currentChatTitle = cleanTitle;
    }
    return false;
  }

  function getState() {
    return {
      active: selectionModeActive,
      selectedCount: selectedMessageIds.size,
      totalFiles: getTotalFilesCount(),
      chatTitle: currentChatTitle,
      downloadMode: currentDownloadMode,
      includeTranscripts: currentIncludeTranscripts,
      lastCheckedIndex
    };
  }

  function setDownloadMode(mode) {
    if (mode === 'zip' || mode === 'individual') {
      currentDownloadMode = mode;
      notifySelectionState();
    }
  }

  function getDownloadMode() {
    return currentDownloadMode;
  }

  function setIncludeTranscripts(enabled) {
    currentIncludeTranscripts = !!enabled;
    notifySelectionState();
  }

  function getIncludeTranscripts() {
    return currentIncludeTranscripts;
  }

  function getLastCheckedIndex() {
    return lastCheckedIndex;
  }

  function setLastCheckedIndex(idx) {
    lastCheckedIndex = idx;
  }

  return {
    selectedMessageIds,
    selectedMediaCache,
    isSelectionModeActive,
    setSelectionModeActive,
    toggleSelectionMode,
    addMessageMedia,
    removeMessage,
    hasMessage,
    clearSelection,
    getSelectedCount,
    getTotalFilesCount,
    getAllSelectedItems,
    getState,
    getChatTitle,
    setChatContext,
    setDownloadMode,
    getDownloadMode,
    setIncludeTranscripts,
    getIncludeTranscripts,
    getLastCheckedIndex,
    setLastCheckedIndex,
    notifySelectionState,
    subscribe
  };
});
