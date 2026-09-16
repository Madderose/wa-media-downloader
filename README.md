# WA Media Downloader

**WA Media Downloader** is a powerful, lightweight browser extension to bulk download images, videos, voice messages, documents, and transcripts from any WhatsApp Web chat — with interactive in-page selection and zero data collection.

100% private. Everything runs locally inside your browser. No analytics, no servers, no tracking.

![WA Media Downloader in WhatsApp Web](wa_downloader_screenshot_v2.png)

---

## ✨ Features

- 🎯 **Interactive In-Page Selection**: An **`📥 Select Media`** button is injected directly into the WhatsApp Web conversation header. Checkboxes appear on every message bubble containing media.
- 📦 **Unified .ZIP Archive by Default**: All selected media — photos, videos, audio, **documents/PDFs**, and companion transcripts — are bundled together into a single unified `.zip` file (`WA_[ChatTitle]_YYYY-MM-DD_HHhmm.zip`). Programmatic in-page decryption captures document and PDF blobs seamlessly alongside media, avoiding multiple browser confirmation prompts and file clutter.
- ⚙️ **Configurable Download Mode**: Prefer downloading files separately? Toggle between **Single .zip archive** and **Individually download media** in the extension popup settings at any time (persisted via `chrome.storage.local`).
- ⚡ **Shift + Click Range Selection**: Click a message, hold `Shift`, and click another message: all media messages in between are selected instantly.
- 🎛️ **Floating Control Bar**:
  - **Master Checkbox**: Standard tri-state checkbox (`[ ] Select all`, `[-] Partial`, `[✓] Deselect all`).
  - **Category Filter Pills**: Quick one-tap contextual filtering for **`All`**, **`🖼️ Photos`**, **`🎥 Videos`**, **`📄 Docs`**, and **`🎵 Audio`**.
  - **`✕ None`**: Instant one-click deselection of all messages.
  - **`👁️ Visible on screen`**: Select only messages currently in the viewport.
  - **Dynamic Action Button**: Clear, responsive download button displaying live count and chosen mode (`📦 Download .zip (X)` or `📥 Download (X)`).
  - **Compact `📝 .txt` Toggle**: Switch companion text transcript exports on or off with a single click.
  - **Adaptive Theming**: Seamlessly adapts colors, contrast, and glassmorphism styling to both WhatsApp Web Light and Dark themes (`body.dark`).
- 🔄 **Real-Time Popup Synchronization**: When messages are selected in the chat, the extension popup displays a live **🎯 In-Page Selection Active** card showing the exact message count, with direct **Download Selected Now** and **Clear** action buttons.
- 🏷️ **Human-Readable Timestamps**:
  - Files are saved with clear, chronological, filesystem-safe timestamps:
    - Images: `WA_IMG_YYYY-MM-DD_HHhmm.jpg` (e.g. `WA_IMG_2026-09-15_15h30.jpg`)
    - Videos: `WA_VID_YYYY-MM-DD_HHhmm.mp4` (e.g. `WA_VID_2026-09-15_15h30.mp4`)
    - Audio: `WA_AUD_YYYY-MM-DD_HHhmm.ogg` (e.g. `WA_AUD_2026-09-15_15h30.ogg`)
    - Documents: `WA_DOC_YYYY-MM-DD_HHhmm_<original_name>.<ext>`
    - Transcripts: `WA_Transcripts_YYYY-MM-DD_HHhmm.txt`
    - Bulk Archives: `WA_Media_YYYY-MM-DD_HHhmm.zip`
- 🔢 **Collision & Overwrite Prevention**:
  - When multiple files share the exact same timestamp (e.g. photo albums or messages received in the same minute), sequential numbers are automatically appended:
    - `WA_IMG_2026-09-15_15h30_01.jpg`
    - `WA_IMG_2026-09-15_15h30_02.jpg`
    - `WA_IMG_2026-09-15_15h30_03.jpg`
  - Cross-batch session tracking ensures previously downloaded items at the same timestamp are never overwritten.
- 🖼️ **Multi-Photo Album Support**:
  - Detects and queues all individual photos within WhatsApp's grouped album containers.
- 🛡️ **Avatar & Reaction Filtering**:
  - Contact profile pictures, group avatars, emojis, and reactions are filtered out so plain text messages never receive false checkboxes.
- 🧠 **Persistent Virtual Scroll Memory**:
  - WhatsApp Web dynamically unmounts off-screen messages as you scroll. Selections are preserved in an in-memory cache and restored with full state whenever messages re-enter view.

---

## 🚀 Installation

### 🦊 Firefox (Permanent Install via Signed .xpi)

1. Download the signed package **`wa_media_downloader-1.6.0.xpi`** from the [GitHub Releases](https://github.com/Madderose/wa-media-downloader/releases).
2. Open Firefox and navigate to `about:addons` (or press `Ctrl + Shift + A`).
3. Click the gear icon (⚙️) in the top-right corner and select **"Install Add-on From File..."** (or simply drag & drop the `.xpi` file directly into the Firefox window).
4. Click **"Add"** when prompted to complete the permanent installation.

> *Alternatively, for local temporary development: go to `about:debugging#/runtime/this-firefox` and click **Load Temporary Add-on...**, then select `manifest.json`.*

---

### 🔵 Chrome / Brave / Edge / Chromium

1. Download **`wa_media_downloader-1.6.zip`** from the [GitHub Releases](https://github.com/Madderose/wa-media-downloader/releases) (or clone this repository).
2. Unpack/extract the `.zip` archive into a folder on your computer.
3. Open your browser's extension page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
4. Enable **Developer mode** toggle in the top-right corner.
5. Click **Load unpacked** (or "Charger l'extension non empaquetée") and select the extracted folder.

---

## 📖 How to Use

### Method 1: In-Page Selection (Recommended)
1. Open [WhatsApp Web](https://web.whatsapp.com) and open any conversation.
2. Click **`📥 Select Media`** in the conversation header.
3. Check individual messages, click category filter pills (`Photos`, `Videos`, `Docs`, `Audio`), or use `Shift + Click` to select a range.
4. Toggle `📝 .txt` if companion transcripts are needed.
5. Click the unified download button (`📦 Download .zip` or `📥 Download`) in the floating control bar (or directly from the extension popup banner).

### Method 2: Extension Popup
1. Click the extension icon in your browser toolbar.
2. Select your scope (**Entire chat** or **Visible on screen**).
3. Click **Scan** to detect available documents, images, videos, and audio.
4. Filter the media types you wish to download, then click **Download Selected**.

---

## 🧪 Automated Testing & WhatsApp Web Mock

Because Meta does **not** provide a developer sandbox or mock environment for the consumer WhatsApp Web client (`web.whatsapp.com`) — their developer sandbox only covers the backend WhatsApp Business REST Cloud API — this project includes a **realistic local DOM mock fixture** (`tests/fixtures/whatsapp-mock.html`).

This mock accurately simulates WhatsApp Web's conversation headers, message containers, media bubbles (images, videos, voice notes, documents), plain text messages, dark mode, and dynamic local `blob:` URLs, enabling **100% offline, zero-data automated testing** without requiring real accounts or physical phones.

### Running Tests

```bash
# Run all automated tests (Smoke integrity + Playwright simulation)
npm test

# Run the Playwright headless Chromium E2E suite
npm run test:playwright

# Run the fast DOM, manifest & security smoke suite
npm run test:e2e
```

### Playwright E2E Test Scenarios (`npm run test:playwright`)
1. **Header Injection**: Verifies automatic injection of the `📥 Select Media` badge into `#main header`.
2. **Selection Toggle**: Verifies that clicking the badge toggles `aria-pressed="true"`, reveals the floating action bar, and injects checkboxes onto media items (while ignoring plain text).
3. **Range Selection (`Shift + Click`)**: Verifies continuous multi-message selection between two points and counter updates.
4. **Category Filter Pills**: Verifies that clicking `Photos` isolates images and `All` selects all media.
5. **Master Tri-State Checkbox**: Verifies `✕ None` clearing, indeterminate/mixed states, and master toggle.
6. **Keyboard Dismissal (`Escape`)**: Verifies pressing `Escape` cleanly dismisses the floating bar and resets the header badge.
7. **Live Popup Synchronization**: Verifies bidirectional state synchronization between the in-page selection and the extension popup toolbar UI.

---

## 🛠️ Development & Packaging

To validate and package the extension:

```bash
# Validate extension (0 errors, 0 warnings)
npx web-ext lint

# Build clean production package (excludes dev files, screenshots, scripts)
npx web-ext build --overwrite-dest

# Run live development instance in Firefox
npx web-ext run
```

Packaged files in the distribution `.zip`:
- `manifest.json`
- `background.js`
- `content.js` (lightweight orchestrator)
- `popup.html` & `popup.js`
- `lib/` (modular zero-data services):
  - `lib/zip-packager.js` (PKZIP store builder & CRC32)
  - `lib/naming-service.js` (chronological timestamps & collision avoidance)
  - `lib/media-detector.js` (DOM scraper & avatar/emoji filtering)
  - `lib/selection-manager.js` (virtual scroll persistent cache)
  - `lib/download-pipeline.js` (unified ZIP/single downloader & transcripts)
  - `lib/ui-controller.js` (in-page badge, checkboxes & floating control bar)
- `_locales/en/` & `_locales/fr/`
- `ui.css` (popup interface styling)
- `injected.css` (in-page controls styling for WhatsApp Web)
- `welcome.html`
- `icons/` (`icon-16.png`, `icon-48.png`, `icon-128.png`)

---

## 🔒 Privacy

- No user data, messages, or media are ever transmitted to any external server.
- All downloads, zip creation, and processing happen 100% locally in your browser session.
- Requires no account or third-party authentication.

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)** — see the [LICENSE](LICENSE) file for the full text.

---

## ⚖️ Non-Affiliation & Trademark Disclaimer

**WhatsApp** is a registered trademark of **Meta Platforms, Inc.**

**WA Media Downloader** is an independent open-source project. This extension and its contributors are **not** affiliated with, authorized, maintained, sponsored, or endorsed by WhatsApp LLC, Meta Platforms, Inc., or any of their subsidiaries or affiliates.

This software interacts strictly with the client-side user interface of WhatsApp Web within the user's own browser session. It does not collect, store, or transmit personal data or communication contents to any remote servers. For personal and legitimate use only.

