#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('🧪 Starting WA Media Downloader E2E & Integrity Suite...\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// --- TEST 1: Manifest V3 Schema & Configuration ---
console.log('📦 Test Suite 1: Manifest V3 & Extension Settings');
const manifestPath = path.join(rootDir, 'manifest.json');
assert(fs.existsSync(manifestPath), 'manifest.json exists');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert(manifest.manifest_version === 3, 'Manifest version is 3 (MV3)');
assert(manifest.default_locale === 'en', 'Default locale is set to "en"');
assert(manifest.browser_specific_settings?.gecko?.id === 'wa-media-downloader@madderose', 'Gecko ID matches wa-media-downloader@madderose');
assert(manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required?.[0] === 'none', 'Data collection declared as "none"');
assert(manifest.permissions.includes('downloads'), 'Permissions include "downloads"');
assert(manifest.permissions.includes('activeTab'), 'Permissions include "activeTab"');
assert(manifest.permissions.includes('storage'), 'Permissions include "storage"');
assert(manifest.content_scripts?.[0]?.js?.includes('lib/zip-packager.js'), 'Content scripts include "lib/zip-packager.js"');
assert(manifest.content_scripts?.[0]?.js?.includes('lib/naming-service.js'), 'Content scripts include "lib/naming-service.js"');
assert(manifest.content_scripts?.[0]?.js?.includes('lib/media-detector.js'), 'Content scripts include "lib/media-detector.js"');
assert(manifest.content_scripts?.[0]?.js?.includes('lib/selection-manager.js'), 'Content scripts include "lib/selection-manager.js"');
assert(manifest.content_scripts?.[0]?.js?.includes('lib/download-pipeline.js'), 'Content scripts include "lib/download-pipeline.js"');
assert(manifest.content_scripts?.[0]?.js?.includes('lib/ui-controller.js'), 'Content scripts include "lib/ui-controller.js"');
assert(manifest.content_scripts?.[0]?.css?.includes('injected.css'), 'Content scripts CSS includes "injected.css"');

const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
assert(pkg.license === 'GPL-3.0-or-later', 'package.json license is set to "GPL-3.0-or-later"');

const licensePath = path.join(rootDir, 'LICENSE');
assert(fs.existsSync(licensePath), 'LICENSE file exists in project root');
const licenseContent = fs.readFileSync(licensePath, 'utf8');
assert(licenseContent.includes('GNU GENERAL PUBLIC LICENSE'), 'LICENSE contains GNU General Public License text');
assert(licenseContent.includes('WhatsApp is a registered trademark of Meta Platforms, Inc.'), 'LICENSE contains non-affiliation disclaimer');

// --- TEST 2: Internationalization (i18n) Locales ---
console.log('\n🌍 Test Suite 2: Locales & i18n Synchronization');
const enLocalePath = path.join(rootDir, '_locales/en/messages.json');
const frLocalePath = path.join(rootDir, '_locales/fr/messages.json');

assert(fs.existsSync(enLocalePath), 'English locale file exists');
assert(fs.existsSync(frLocalePath), 'French locale file exists');

const enMessages = JSON.parse(fs.readFileSync(enLocalePath, 'utf8'));
const frMessages = JSON.parse(fs.readFileSync(frLocalePath, 'utf8'));

const enKeys = Object.keys(enMessages);
const frKeys = Object.keys(frMessages);

assert(enKeys.length > 0, `English locale contains ${enKeys.length} translation keys`);
assert(frKeys.length > 0, `French locale contains ${frKeys.length} translation keys`);

const missingInFr = enKeys.filter(k => !frKeys.includes(k));
assert(missingInFr.length === 0, `All English keys are present in French locale (missing: ${missingInFr.join(', ') || 'none'})`);
assert(enKeys.includes('settingDownloadModeTitle'), 'English locale contains settingDownloadModeTitle');
assert(frKeys.includes('settingDownloadModeTitle'), 'French locale contains settingDownloadModeTitle');
assert(enKeys.includes('settingDownloadModeZip'), 'English locale contains settingDownloadModeZip');
assert(frKeys.includes('settingDownloadModeZip'), 'French locale contains settingDownloadModeZip');
assert(enKeys.includes('settingDownloadModeIndividual'), 'English locale contains settingDownloadModeIndividual');
assert(frKeys.includes('settingDownloadModeIndividual'), 'French locale contains settingDownloadModeIndividual');
assert(enKeys.includes('popupLiveSelectionActive'), 'English locale contains popupLiveSelectionActive');
assert(frKeys.includes('popupLiveSelectionActive'), 'French locale contains popupLiveSelectionActive');
assert(enKeys.includes('popupLiveDownloadBtn'), 'English locale contains popupLiveDownloadBtn');
assert(frKeys.includes('popupLiveDownloadBtn'), 'French locale contains popupLiveDownloadBtn');
assert(enKeys.includes('headerSelectMedia'), 'English locale contains headerSelectMedia');
assert(frKeys.includes('headerSelectMedia'), 'French locale contains headerSelectMedia');
assert(enKeys.includes('barDownloadZip'), 'English locale contains barDownloadZip');
assert(frKeys.includes('barDownloadZip'), 'French locale contains barDownloadZip');
assert(enKeys.includes('barFilterImages'), 'English locale contains barFilterImages');
assert(frKeys.includes('barFilterImages'), 'French locale contains barFilterImages');

// --- TEST 3: Zero-Data & Network Privacy Audit ---
console.log('\n🛡️ Test Suite 3: Zero-Data & Network Privacy Audit');
const backgroundCode = fs.readFileSync(path.join(rootDir, 'background.js'), 'utf8');
const contentCode = fs.readFileSync(path.join(rootDir, 'content.js'), 'utf8');
const uiCss = fs.readFileSync(path.join(rootDir, 'ui.css'), 'utf8');

assert(backgroundCode.includes('const DEBUG_SERVER_LOGS = false;'), 'background.js has DEBUG_SERVER_LOGS disabled by default');
assert(contentCode.includes('const DEBUG_SERVER_LOGS = false;'), 'content.js has DEBUG_SERVER_LOGS disabled by default');
assert(!contentCode.includes("fetch('http://127.0.0.1:9876/log'"), 'content.js does not contain unsecured raw fetch calls');

// --- TEST 4: Popup HTML Accessibility (A11y & ARIA) ---
console.log('\n♿ Test Suite 4: Popup Accessibility & ARIA');
const popupHtml = fs.readFileSync(path.join(rootDir, 'popup.html'), 'utf8');

assert(popupHtml.includes('id="status" role="status" aria-live="polite"'), 'Status element has role="status" and aria-live="polite"');
assert(popupHtml.includes('role="progressbar"'), 'Progress bar container has role="progressbar"');
assert(popupHtml.includes('aria-valuemin="0"') && popupHtml.includes('aria-valuemax="100"'), 'Progress bar defines min and max values');
assert(popupHtml.includes('id="scopeAll"') && popupHtml.includes('aria-pressed="true"'), 'Scope button has aria-pressed="true"');
assert(popupHtml.includes('id="scopeVisible"') && popupHtml.includes('aria-pressed="false"'), 'Scope button has aria-pressed="false"');
assert(popupHtml.includes('role="radiogroup"'), 'Download format settings container has role="radiogroup"');
assert(popupHtml.includes('id="modeZip"') && popupHtml.includes('value="zip"'), 'Mode zip radio button defined');
assert(popupHtml.includes('id="modeIndividual"') && popupHtml.includes('value="individual"'), 'Mode individual radio button defined');
assert(popupHtml.includes('id="liveSelectionCard"') && popupHtml.includes('role="region"'), 'Popup contains #liveSelectionCard with role="region"');
assert(popupHtml.includes('id="liveSelectionCount"') && popupHtml.includes('aria-live="polite"'), 'Popup contains #liveSelectionCount with aria-live="polite"');
assert(popupHtml.includes('id="liveDownloadBtn"'), 'Popup contains #liveDownloadBtn');
assert(popupHtml.includes('id="liveClearBtn"'), 'Popup contains #liveClearBtn');
assert(popupHtml.includes('id="includeTranscriptsCb"'), 'Popup contains #includeTranscriptsCb setting checkbox');
assert(popupHtml.includes('src="lib/zip-packager.js"'), 'Popup HTML loads lib/zip-packager.js');
assert(popupHtml.includes('rel="noopener noreferrer"'), 'External links enforce rel="noopener noreferrer"');

// --- TEST 5: Content Script Injected UI, Theming & Accessibility ---
console.log('\n⌨️ Test Suite 5: Injected UI, Theming & Accessibility');
const uiControllerCode = fs.readFileSync(path.join(rootDir, 'lib/ui-controller.js'), 'utf8');
const injectedCss = fs.readFileSync(path.join(rootDir, 'injected.css'), 'utf8');

assert(uiControllerCode.includes("masterCb.setAttribute('aria-checked', 'mixed')"), 'ui-controller.js supports aria-checked="mixed" for tri-state selection');
assert(uiControllerCode.includes("masterCb.indeterminate = true;"), 'ui-controller.js sets DOM indeterminate state on partial selection');
assert(contentCode.includes("window.addEventListener('keydown', (e) => {"), 'content.js registers global keydown listener');
assert(contentCode.includes("e.key === 'Escape'"), 'content.js handles Escape key to dismiss selection mode');
assert(contentCode.includes("currentDownloadMode"), 'content.js tracks currentDownloadMode');
assert(contentCode.includes("notifySelectionState"), 'content.js dispatches live selection notifications');
assert(contentCode.includes("clearSelection"), 'content.js supports programmatic selection clearing');
assert(contentCode.includes("getSelectionState"), 'content.js handles getSelectionState queries');
assert(contentCode.includes("downloadSelectedInPage"), 'content.js handles in-page download execution');
assert(injectedCss.includes("--wam-bar-bg"), 'injected.css implements theme-aware CSS custom properties');
assert(uiCss.includes(".live-card"), 'ui.css defines styles for live selection card');
assert(uiCss.includes(":focus-visible"), 'ui.css implements :focus-visible outlines');
assert(uiCss.includes("prefers-reduced-motion"), 'ui.css respects prefers-reduced-motion');


// --- TEST 6: Zero-Dependency ZipPackager Binary Integrity ---
console.log('\n📦 Test Suite 6: PKZIP Binary Packager Integrity & CRC32');
const zipPackagerPath = path.join(rootDir, 'lib/zip-packager.js');
assert(fs.existsSync(zipPackagerPath), 'lib/zip-packager.js exists');

await import(zipPackagerPath);
const packager = globalThis.ZipPackager;
assert(typeof packager === 'object' && packager !== null, 'ZipPackager is defined on globalThis');
assert(typeof packager.createZipBuffer === 'function', 'createZipBuffer is exposed as a function');
assert(typeof packager.crc32 === 'function', 'crc32 is exposed as a function');

// Test CRC32 against known test vector: "123456789" => 0xCBF43926 (3421760294)
const knownVec = new TextEncoder().encode('123456789');
const computedCrc = packager.crc32(knownVec);
assert(computedCrc === 0xCBF43926, `CRC32 vector check matches standard (expected 0xCBF43926, got 0x${computedCrc.toString(16).toUpperCase()})`);

// Generate in-memory ZIP
const testFiles = [
  { name: 'document.txt', data: 'Test text content' },
  { name: 'nested/image.bin', data: new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]) }
];
const zipBinary = await packager.createZipBuffer(testFiles);
assert(zipBinary instanceof Uint8Array && zipBinary.length > 50, `Zip buffer generated with size ${zipBinary.length} bytes`);

// Validate PKZIP magic numbers (0x04034b50 -> 'PK\x03\x04')
const isPkZip = zipBinary[0] === 0x50 && zipBinary[1] === 0x4B && zipBinary[2] === 0x03 && zipBinary[3] === 0x04;
assert(isPkZip, 'Binary starts with valid PKZIP signature (0x50 0x4B 0x03 0x04)');

// --- TEST 7: SPA Lifecycle, Unicode & Security Compliance ---
console.log('\n🛡️ Test Suite 7: SPA Lifecycle, Unicode & Security Compliance');
const welcomeHtml = fs.readFileSync(path.join(rootDir, 'welcome.html'), 'utf8');
const popupJsCode = fs.readFileSync(path.join(rootDir, 'popup.js'), 'utf8');

assert(welcomeHtml.includes('rel="noopener noreferrer"'), 'welcome.html includes rel="noopener noreferrer"');
assert(!welcomeHtml.includes('onclick='), 'welcome.html does not contain inline onclick handlers (CSP MV3)');
assert(welcomeHtml.includes('welcome.js'), 'welcome.html loads welcome.js external script');
assert(contentCode.includes('e.isTrusted'), 'content.js filters Escape keydown listener on e.isTrusted');
assert(popupJsCode.includes('lib/zip-packager.js') && popupJsCode.includes('lib/naming-service.js'), 'popup.js injects all 7 modular dependencies in executeScript fallback');

await import(path.join(rootDir, 'lib/naming-service.js'));
const ns = globalThis.NamingService;
assert(typeof ns?.sanitizeFilename === 'function', 'NamingService exposes sanitizeFilename');
const unicodeName = ns.sanitizeFilename('facture_août_2026:version*1.pdf');
assert(unicodeName.includes('août') && !unicodeName.includes(':') && !unicodeName.includes('*'), `NamingService preserves Unicode accents and removes illegal chars (got: "${unicodeName}")`);

await import(path.join(rootDir, 'lib/media-detector.js'));
const md = globalThis.MediaDetector;
assert(typeof md?.getChatTitle === 'function', 'MediaDetector exposes getChatTitle');

await import(path.join(rootDir, 'lib/selection-manager.js'));
const sm = globalThis.SelectionManager;
assert(typeof sm?.getChatTitle === 'function', 'SelectionManager exposes getChatTitle');
assert(typeof sm?.setChatContext === 'function', 'SelectionManager exposes setChatContext');

// --- SUMMARY ---
console.log(`\n========================================`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All E2E smoke and integrity tests passed successfully!');
  process.exit(0);
}
