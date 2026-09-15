# Changelog

All notable changes to the **WA Media Downloader** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Uncommitted]
### Added
- **Licensing**: Formalized project under the **GNU General Public License v3.0 (GPLv3)** ([LICENSE](LICENSE)) with explicit Meta/WhatsApp non-affiliation and trademark disclaimer.
- **ZipPackager**: Pure JavaScript client-side PKZIP builder (`lib/zip-packager.js`) creating standard uncompressed STORE zip archives with CRC-32 validation, 100% Zero-Data compliance and zero external dependencies (resolves `TICKET-DOM04-002`).
- **Download Settings**: Added accessible radio group (`role="radiogroup"`) in popup settings allowing users to toggle between default bulk single `.zip` archive download and individual file downloads.
- **Storage Persistence**: Added `"storage"` permission in `manifest.json` and persistent user preference synchronization via `chrome.storage.local`.
- **Testing**: Expanded automated test suite (`tests/e2e/extension-smoke.spec.mjs`) with CRC-32 verification, PKZIP signature assertions, storage permission validation, and popup radio controls (45 automated assertions).

### Changed
- **Content Script**: Default bulk download behavior now automatically packages all selected media (and optional companion transcripts) into a single archive `WA_Media_YYYY-MM-DD_HHhmm.zip`, completely eliminating multiple browser download confirmation prompts.
- **Popup UI**: Synchronized download format preference between popup settings and in-page floating control bar.
- **Internationalization**: Added bilingual translations (EN/FR) for download format settings and zipping status messages.

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
