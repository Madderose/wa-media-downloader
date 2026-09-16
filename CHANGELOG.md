# Changelog

All notable changes to the **WA Media Downloader** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Uncommitted]

## [1.7.0] - 2026-09-16
### Added
- **Unified
ZIP Archiving (Images + Documents/PDFs)**:
  - Added `lib/page-interceptor.js` registered in `manifest.json` under `world: "MAIN"` at `document_start` to intercept programmatic document preview download clicks and extract decrypted blob URLs alongside document filenames via a secure DOM dataset bridge (`#wa-dl-interceptor-bridge`).
  - Added `captureDocumentBlobs` in `lib/download-pipeline.js` to trigger WhatsApp Web's in-app document preview decryption while intercepting the resulting blob without triggering uncoordinated browser downloads.
  - Updated `downloadBatch` in `lib/download-pipeline.js` so that in ZIP download mode, all intercepted document and PDF blobs are seamlessly packaged into the same unified `.zip` archive alongside photos, videos, and companion transcripts.
  - Enhanced document filename detection in `lib/media-detector.js` to inspect inner text elements, spans, and file extension patterns when container `title` attributes are omitted.
  - Added Test Suite 8 in `tests/e2e/extension-smoke.spec.mjs` and Scenario 9 in `tests/e2e/whatsapp-interaction.spec.mjs` verifying mixed-media single-ZIP generation.

### Changed
- **Documentation**: Updated `README.md` installation section to document dual-package distribution: permanent 1-click install via Mozilla-signed `wa_media_downloader-1.6.0.xpi` for Firefox and unpacked folder installation via `wa_media_downloader-1.6.zip` for Chromium browsers.
- **Documentation**: Updated `README.md` features to highlight unified `.zip` bundling for mixed media (photos, videos, audio, and documents/PDFs).

## [1.6.0] - 2026-09-16
### Added
- **Chat Context & Isolation**: Implemented `getChatTitle` in `lib/media-detector.js` and active conversation tracking (`setChatContext`, `getChatTitle`) in `lib/selection-manager.js`, isolating selections per conversation on WhatsApp Web.
- **Contextual Export Naming**:
ZIP archives and transcripts export files now incorporate the sanitized contact/group name (e.g. `WA_[ChatTitle]_[Date].zip` and `Export Chat: [ChatTitle]` in transcripts).
- **Unicode Filename Preservation**: Added `sanitizeFilename` in `lib/naming-service.js` preserving international characters (accents, Cyrillic, Arabic, CJK) while stripping only filesystem-illegal characters (`[\\/:*?"<>|\x00-\x1F]`).
- **Responsive Action Bar**: Added media query in `injected.css` ensuring graceful compact horizontal scrolling and padding reduction on screens and split views under 920px width.
- **CSP-Compliant Welcome Script**: Added standalone `welcome.js` for `welcome.html` button interactions, ensuring 100% MV3 Content Security Policy compliance.
- **Automated Tests**: Expanded automated test suites to 111 passing assertions (88 smoke integrity assertions + 23 Playwright assertions in `tests/e2e/whatsapp-interaction.spec.mjs`), validating synthetic Escape immunity and SPA chat-switching state isolation.
- **Modular Services Architecture**: Decomposed monolithic 2,207-line `content.js` into cohesive, single-responsibility services inside `lib/`:
  - `lib/naming-service.js`: Extracted timestamp parsing, chronological human-readable formatting, preceding date detection, and cross-batch session collision prevention.
  - `lib/media-detector.js`: Extracted WhatsApp Web DOM inspection, avatar/emoji/UI filtering, media bubble validation, and chat scraping.
  - `lib/selection-manager.js`: Extracted virtual scroll persistent cache, state tracking, and live runtime dispatch.
  - `lib/download-pipeline.js`: Extracted unified download pipeline supporting single PKZIP archives, sequential individual downloads, companion transcripts, and automated document preview downloading.
  - `lib/ui-controller.js`: Extracted in-page header badge, floating control bar, checkbox overlays, category pills, tri-state master checkbox, and keyboard shortcuts.
- **Injected Stylesheet**: Created dedicated `injected.css` containing all `.wam-*` and `.wa-dl-*` in-page styles, loaded cleanly via `manifest.json` `content_scripts[0].css`.
- **Optimized Icons**: Generated standard multi-resolution icons (`icons/icon-16.png`, `icons/icon-48.png`, `icons/icon-128.png`) declared in `manifest.json` under `icons` and `action.default_icon`.

### Changed
- **Content Script**: Reduced `content.js` from 2,207 lines (78.4 KB) to a lightweight 280-line (9.7 KB) orchestrator (-87.3% code reduction in content script).
- **Packaging & Bundle Size**: Reduced production extension package size from ~410 KB (541 KB uncompressed) to 67 KB (195 KB uncompressed) — an 83.6% reduction in distribution package footprint.
- **Git Hygiene**: Untracked binary archive `web-ext-artifacts/wa_media_downloader-1.5.zip` from Git index and added `web-ext-artifacts/`, `*.zip`, `*.xpi`, `.vscode/`, `.idea/`, `graphify-out/`, and `test-results/` to `.gitignore`.
- **Build Configuration**: Updated `web-ext-config.cjs` to ignore unused root icons, test results, and analysis artifacts.
- **Documentation**: Embedded active WhatsApp Web screenshot preview in `README.md` and removed obsolete unreferenced screenshot.

### Fixed
- **SPA Chat-Switching State Leak**: Fixed critical UX defect where selecting messages in one chat would persist when navigating to another contact in WhatsApp Web; the extension now detects conversation changes and resets selection state cleanly.
- **Synthetic Event Collision**: Fixed bug where automated document preview downloads dispatching synthetic `Escape` events caused `content.js` to inadvertently terminate the user's active selection mode; `window` keydown listener now checks `e.isTrusted === true`.
- **ZIP Packager Network Resiliency**: Added `res.ok` check in `lib/download-pipeline.js` when fetching media blobs to prevent packaging 404/410 HTTP error payloads into ZIP archives, and added failsafe user status messaging on all-fail batches.
- **Popup Re-injection Fallback**: Fixed broken script injection in `popup.js` to execute all 7 modular dependencies (`lib/zip-packager.js`, `lib/naming-service.js`, `lib/media-detector.js`, `lib/selection-manager.js`, `lib/download-pipeline.js`, `lib/ui-controller.js`, `content.js`) in dependency order.
- **Security & A11y Polish in Welcome Page**: Added `rel="noopener noreferrer"` on external link in `welcome.html` and removed inline `onclick` handler.
- **State De-synchronization on Clear**: Fixed `clearSelection()` in `content.js` and `removeInjectedUI()` in `lib/ui-controller.js` to properly deactivate selection mode and reset header badge `aria-pressed="false"`.
- **CSS Leaks**: Resolved CSS contamination bug where popup stylesheet (`ui.css`, defining global resets and `body { width: 340px }`) was injected into `https://web.whatsapp.com/*`. `ui.css` is now restricted solely to `popup.html`, while `injected.css` styles in-page controls without global leaks.

### Removed
- **Dead Background Code**: Removed orphaned `downloadMedia` handler and its vulnerable `setTimeout` loop in `background.js` (downloads are executed in-page via `DownloadPipeline`).


## [1.5.0] - 2026-09-15
### Added
- **Licensing**: Formali
zed project under the **GNU General Public License v3.0 (GPLv3)** ([LICENSE](LICENSE)) with explicit Meta/WhatsApp non-affiliation and trademark disclaimer.
- **ZipPackager**: Pure JavaScript client-side PKZIP builder (`lib/zip-packager.js`) creating standard uncompressed STORE zip archives with CRC-32 validation, 100% Zero-Data compliance and zero external dependencies (resolves `TICKET-DOM04-002`).
- **Download Settings**: Added accessible radio group (`role="radiogroup"`) in popup settings allowing users to toggle between default bulk single `.zip` archive download and individual file downloads.
- **Storage Persistence**: Added `"storage"` permission in `manifest.json` and persistent user preference synchronization via `chrome.storage.local` for download format and companion transcript export.
- **Popup UI**: Added `#liveSelectionCard` banner (`role="region"`) with `aria-live="polite"` count and direct download/clear action buttons, updating in real time when messages are selected on WhatsApp Web.
- **Content Script**: Added contextual category filter pills (`All`, `🖼️ Photos`, `🎥 Videos`, `📄 Docs`, `🎵 Audio`) to the in-page floating action bar for instant granular filtering.
- **WhatsApp Web Mock Simulation**: Implemented realistic local DOM fixture (`tests/fixtures/whatsapp-mock.html`) replicating WhatsApp Web message containers, headers, media blobs (image, video, voice audio, document), and theme structures for 100% offline testing.
- **Playwright E2E Test Suite**: Added headless browser test suite (`tests/e2e/whatsapp-interaction.spec.mjs`, `npm run test:playwright`) validating 7 scenarios across 19 assertions (header injection, selection toggle, `Shift + Click` continuous range selection, category filter pills, tri-state master checkbox, `Escape` key dismissal, and live popup synchronization).
- **Testing**: Expanded automated test suite to 91 passing assertions (72 smoke/integrity tests + 19 Playwright E2E simulation tests) via `npm test`.

### Changed
- **Content Script**: Unified download controls into a single dynamic action button (`#wa-dl-btn-download-main`) and a compact `.txt` transcript switch (`#wa-dl-btn-transcripts`, `role="switch"`), eliminating bloated duplicate buttons and optimizing screen real estate for smaller viewports (e.g., Steam Deck 1280x800).
- **Content Script**: Full dynamic theming using `--wam-...` CSS custom properties adapting cleanly to both WhatsApp Web Light and Dark mode (`body.dark`).
- **Content Script**: Added bidirectional live messaging (`getSelectionState`, `clearSelection`, `selectionStateChanged`) keeping popup and in-page state in perfect sync.
- **Content Script**: Exposes extension ID via `document.documentElement.dataset.waExtensionId` for robust diagnostic discovery and automated testing.
- **Popup UI**: Added `getTargetWhatsAppTab()` helper ensuring reliable communication with WhatsApp Web tabs in both toolbar popup and standalone tab/test environments.
- **Internationalization**: Fully localized in-page floating bar labels, buttons, tooltips, category filter pills, and live selection banners into English and French.
- **Security & Quality**: Eliminated unsafe template assignments in `content.js` to achieve strict `0 errors, 0 warnings` on `web-ext lint`.

## [1.4.0] - 2026-09-15
### Added
- **Internationali
zation**: Complete WebExtension i18n infrastructure with English (`_locales/en/messages.json`) and French (`_locales/fr/messages.json`) localizations.
- **Testing**: Automated end-to-end smoke and integrity test suite (`tests/e2e/extension-smoke.spec.mjs`) accessible via `npm test` and `npm run test:e2e` (25 automated assertions).

### Changed
- **Security & Privacy**: Hardened Zero-Data compliance by disabling debug log server forwarding (`DEBUG_SERVER_LOGS = false`) in [background.js](background.js) and eliminating raw fetch shims in [content.js](content.js) (resolves `TICKET-DOM04-001` & `TICKET-DOM07-001`).
- **Popup UI**: Added accessible `role="status"` and `role="progressbar"` with dynamic `aria-valuenow` in [popup.html](popup.html) and [popup.js](popup.js) (resolves `TICKET-DOM05-001`).
- **Popup UI**: Added `aria-pressed="true|false"` toggle state tracking on scope buttons and media category filters (resolves `TICKET-DOM05-002`).
- **Injected UI**: Implemented tri-state DOM `indeterminate = true` and `aria-checked="mixed"` on the master checkbox in [content.js](content.js) (resolves `TICKET-DOM06-001`).
- **Keyboard UX**: Added global `Escape` key listener to dismiss the in-page WhatsApp selection mode cleanly.
- **Packaging**: Excluded test artifacts (`tests/**`) from distribution ZIP in [web-ext-config.cjs](web-ext-config.cjs).

---

## [1.3.0] - 2026-09-15

### Added
- **Content Script**: In-page interactive selection button (`📥 Select Media`) injected into WhatsApp Web conversation header.
- **Content Script**: Dynamic selection checkboxes on all message bubbles containing downloadable media (images, videos, audio/voice messages, documents).
- **Content Script**: `Shift + Click` range selection allowing bulk continuous selection between two messages.
- **Content Script**: Floating control bar with:
  - Master tri-state checkbox (`[ ] All`, `[-] Partial`, `[✓] Deselect`).
  - `✕ None` one-click deselect button.
  - `👁️ Visible on screen` selector for visible viewport items.
  - `📥 Media` direct download trigger.
  - `📝 Media + Transcripts` companion export button.
- **Content Script**: Structured companion transcript generator (`WA_Transcripts_YYYY-MM-DD_HHhmm.txt`) capturing timestamps, senders, message captions, and voice message audio transcripts.
- **Content Script**: Automated collision and overwrite protection with sequential index suffixes (`WA_IMG_YYYY-MM-DD_HHhmm_01.jpg`) and cross-batch session tracking.
- **Content Script**: Multi-photo album container parser supporting individual photo extraction within WhatsApp photo albums.
- **Content Script**: Avatar and reaction filter preventing text messages and contact avatars from receiving false selection checkboxes.
- **Content Script**: In-memory virtual scroll memory restoring selections across WhatsApp Web DOM unmount/remount cycles.
- **Background Worker**: Unified download queue router handling batch downloads, custom sanitized filenames, and download completions.
- **Packaging**: Mozilla Add-ons (AMO) and Firefox Gecko MV3 compliance with explicit gecko ID `wa-media-downloader@madderose` and zero data collection declaration.

### Changed
- **Popup UI**: Modernized glassmorphism popup interface with batch count indicators and direct chat scan mode.
- **Injected Styles**: Complete CSS isolation (`ui.css`) compatible with both WhatsApp Web light and dark themes.

---

## [1.0.0] - 2026-06-13

### Added
- Initial release of WA Media Downloader.
- Extension popup with basic chat media detection.
- Batch downloading for images, videos, and documents from open WhatsApp Web chat.
