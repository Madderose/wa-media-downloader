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

// --- TEST 3: Zero-Data & Network Security Check ---
console.log('\n🛡️ Test Suite 3: Zero-Data & Network Privacy Audit');
const backgroundCode = fs.readFileSync(path.join(rootDir, 'background.js'), 'utf8');
const contentCode = fs.readFileSync(path.join(rootDir, 'content.js'), 'utf8');

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
assert(popupHtml.includes('rel="noopener noreferrer"'), 'External links enforce rel="noopener noreferrer"');

// --- TEST 5: Content Script Injected UI & Keyboard Accessibility ---
console.log('\n⌨️ Test Suite 5: Injected UI & Tri-state ARIA Logic');
assert(contentCode.includes("masterCb.setAttribute('aria-checked', 'mixed')"), 'content.js supports aria-checked="mixed" for tri-state selection');
assert(contentCode.includes("masterCb.indeterminate = true;"), 'content.js sets DOM indeterminate state on partial selection');
assert(contentCode.includes("window.addEventListener('keydown', (e) => {"), 'content.js registers global keydown listener');
assert(contentCode.includes("e.key === 'Escape'"), 'content.js handles Escape key to dismiss selection mode');

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
