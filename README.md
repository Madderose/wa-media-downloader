# WA Media Downloader

**WA Media Downloader** is a powerful, lightweight browser extension to bulk download images, videos, voice messages, documents, and transcripts from any WhatsApp Web chat — with interactive in-page selection and zero data collection.

100% private. Everything runs locally inside your browser. No analytics, no servers, no tracking.

---

## ✨ Features

- 🎯 **Interactive In-Page Selection**: An **`📥 Select Media`** button is injected directly into the WhatsApp Web conversation header. Checkboxes appear on every message bubble containing media.
- 📦 **Single .ZIP Archive by Default**: All selected media (plus companion transcripts) are bundled into a single `.zip` file (`WA_Media_YYYY-MM-DD_HHhmm.zip`). This completely avoids multiple browser confirmation prompts when downloading tens or hundreds of files.
- ⚙️ **Configurable Download Mode**: Prefer downloading files separately? Toggle between **Single .zip archive** and **Individually download media** in the extension popup settings at any time (persisted via `chrome.storage.local`).
- ⚡ **Shift + Click Range Selection**: Click a message, hold `Shift`, and click another message: all media messages in between are selected instantly.
- 🎛️ **Floating Control Bar**:
  - **Master Checkbox**: Standard tri-state checkbox (`[ ] Select all`, `[-] Partial`, `[✓] Deselect all`).
  - **`✕ None`**: Instant one-click deselection of all messages.
  - **`👁️ Visible on screen`**: Select only messages currently in the viewport.
  - **`📥 Media`**: Download all selected media files directly.
  - **`📝 Media + Transcripts`**: Download media files accompanied by a structured companion text summary containing dates, senders, captions, and voice message transcriptions.
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

### Firefox

#### From Add-on Package (.zip / .xpi)
1. Download `wa_media_downloader-1.4.zip` from [`web-ext-artifacts/`](web-ext-artifacts/).
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**
4. Select the `.zip` archive (or `manifest.json`).

#### Developer Hub (AMO)
The extension is pre-configured for Mozilla Add-on Developer Hub submission with:
- Dedicated Gecko ID: `wa-media-downloader@madderose`
- `data_collection_permissions: { required: ["none"] }`
- **0 errors, 0 warnings** on `web-ext lint`.

---

### Chrome / Chromium / Edge

1. Clone or download this repository.
2. Open Chrome/Edge and go to `chrome://extensions/`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the extension folder.

---

## 📖 How to Use

### Method 1: In-Page Selection (Recommended)
1. Open [WhatsApp Web](https://web.whatsapp.com) and open any conversation.
2. Click **`📥 Select Media`** in the conversation header.
3. Check individual messages or use `Shift + Click` to select a range.
4. Click **`📥 Media`** or **`📝 Media + Transcripts`** in the bottom floating bar.

### Method 2: Extension Popup
1. Click the extension icon in your browser toolbar.
2. Select your scope (**Entire chat** or **Visible on screen**).
3. Click **Scan** to detect available documents, images, videos, and audio.
4. Filter the media types you wish to download, then click **Download Selected**.

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
- `content.js`
- `popup.html` & `popup.js`
- `lib/zip-packager.js`
- `_locales/en/` & `_locales/fr/`
- `ui.css`
- `welcome.html`
- `icon.png` & `icon128.png`

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

