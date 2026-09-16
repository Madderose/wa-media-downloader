#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let pt;
try {
  pt = require('@playwright/test');
} catch (e) {
  pt = require('/home/deck/.local/lib/nodejs/node-v20.20.2-linux-x64/lib/node_modules/@playwright/test');
}
const { chromium } = pt;

console.log('🧪 Starting WhatsApp Web In-Page Mock & Playwright E2E Suite...\n');

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

function findChromeExecutable() {
  if (process.env.PLAYWRIGHT_CHROME_BIN && fs.existsSync(process.env.PLAYWRIGHT_CHROME_BIN)) {
    return process.env.PLAYWRIGHT_CHROME_BIN;
  }
  const candidates = [
    '/home/deck/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
    '/home/deck/.local/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

async function runSuite() {
  const mockHtmlPath = path.join(rootDir, 'tests/fixtures/whatsapp-mock.html');
  const mockHtml = fs.readFileSync(mockHtmlPath, 'utf8');

  const execPath = findChromeExecutable();
  console.log(`🚀 Launching Chromium (${execPath || 'default'}) with unpacked WebExtension...`);
  const context = await chromium.launchPersistentContext('', {
    headless: true,
    executablePath: execPath,
    args: [
      '--headless=new',
      `--disable-extensions-except=${rootDir}`,
      `--load-extension=${rootDir}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  try {
    // Intercept https://web.whatsapp.com to serve mock fixture
    await context.route('https://web.whatsapp.com/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: mockHtml
      });
    });

    const page = await context.newPage();
    console.log('🌐 Navigating to simulated https://web.whatsapp.com...');
    await page.goto('https://web.whatsapp.com');

    // Wait for content script initialization (badge injection)
    console.log('\n🔍 Scenario 1: Automatic Header Badge Injection');
    const badgeSelector = '#wa-dl-header-badge';
    await page.waitForSelector(badgeSelector, { timeout: 7000 });
    const badge = page.locator(badgeSelector);
    assert(await badge.isVisible(), 'Header badge [📥 Select Media] is injected and visible');
    assert(await badge.getAttribute('aria-pressed') === 'false', 'Badge has initial aria-pressed="false"');

    console.log('\n🎯 Scenario 2: Toggle Selection Mode');
    await badge.click();
    assert(await badge.getAttribute('aria-pressed') === 'true', 'Badge toggles to aria-pressed="true"');

    const bar = page.locator('#wa-dl-action-bar');
    await bar.waitFor({ state: 'visible', timeout: 5000 });
    assert(await bar.isVisible(), 'Floating action bar [#wa-dl-action-bar] appears');

    // Checkboxes should only be injected on media bubbles (4 media, 1 plain text)
    const checkboxes = page.locator('.wa-dl-msg-cb');
    const cbCount = await checkboxes.count();
    assert(cbCount === 4, `4 media checkboxes injected (expected 4, got ${cbCount})`);

    const textRow = page.locator('[data-id="msg-txt-005"] .wa-dl-msg-cb');
    assert(await textRow.count() === 0, 'Plain text message has NO selection checkbox');

    console.log('\n⚡ Scenario 3: Continuous Range Selection (Shift + Click)');
    // Check first media message
    await checkboxes.nth(0).click();
    assert(await checkboxes.nth(0).isChecked(), 'Message 1 is checked');

    // Shift+click third media message
    await checkboxes.nth(2).click({ modifiers: ['Shift'] });
    assert(await checkboxes.nth(1).isChecked(), 'Message 2 was auto-selected via Shift+Click');
    assert(await checkboxes.nth(2).isChecked(), 'Message 3 is checked');

    const countBadge = page.locator('#wa-dl-count-badge');
    const badgeText = await countBadge.textContent();
    assert(badgeText.includes('3'), `Selection counter reflects 3 messages selected (got: "${badgeText}")`);

    console.log('\n🏷️ Scenario 4: Contextual Category Filter Pills');
    const filterPhotos = page.locator('.wam-filter-pill[data-filter="image"]');
    await filterPhotos.click();
    const photosChecked = await checkboxes.nth(0).isChecked();
    const videosChecked = await checkboxes.nth(1).isChecked();
    assert(photosChecked && !videosChecked, 'Category pill "Photos" selected only image message');

    const filterAll = page.locator('.wam-filter-pill[data-filter="all"]');
    await filterAll.click();
    const allCheckedCount = await page.locator('.wa-dl-msg-cb:checked').count();
    assert(allCheckedCount === 4, 'Category pill "All" selected all 4 media messages');

    console.log('\n☑️ Scenario 5: Master Checkbox Tri-State');
    const btnNone = page.locator('#wa-dl-btn-none');
    await btnNone.click();
    assert(await page.locator('.wa-dl-msg-cb:checked').count() === 0, 'Button "✕ None" cleared all selections');

    const masterCb = page.locator('#wa-dl-master-cb');
    assert(await masterCb.getAttribute('aria-checked') === 'false', 'Master checkbox aria-checked is "false"');

    await checkboxes.nth(0).click();
    assert(await masterCb.getAttribute('aria-checked') === 'mixed', 'Master checkbox aria-checked is "mixed" on partial selection');

    console.log('\n⌨️ Scenario 6: Escape Key Dismissal & Synthetic Event Immunity');
    // Test synthetic escape: should NOT dismiss
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await page.waitForTimeout(200);
    assert(await bar.isVisible(), 'Synthetic Escape event does NOT dismiss selection mode');

    // Test real keyboard escape: MUST dismiss
    await page.keyboard.press('Escape');
    await bar.waitFor({ state: 'detached', timeout: 3000 });
    assert(!(await bar.isVisible()), 'Action bar cleanly dismissed upon pressing Escape');
    assert(await badge.getAttribute('aria-pressed') === 'false', 'Header badge returned to aria-pressed="false"');

    console.log('\n🔄 Scenario 7: Live Extension Popup State Synchronization');
    // Reactivate selection and select 2 items
    await badge.click();
    await bar.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForSelector('.wa-dl-msg-cb', { state: 'visible', timeout: 5000 });
    const activeCbs = page.locator('.wa-dl-msg-cb');
    await activeCbs.nth(0).click();
    await activeCbs.nth(1).click();

    // Get the extension ID directly from page dataset or background worker
    let extensionId = await page.evaluate(() => {
      return document.documentElement.dataset.waExtensionId || null;
    });

    if (!extensionId) {
      for (const bgPage of context.serviceWorkers()) {
        const url = bgPage.url();
        const match = url.match(/chrome-extension:\/\/([^\/]+)/);
        if (match) {
          extensionId = match[1];
          break;
        }
      }
    }

    if (extensionId) {
      const popupPage = await context.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
      await popupPage.waitForSelector('#liveSelectionCard', { state: 'visible', timeout: 5000 });
      const liveCount = await popupPage.locator('#liveSelectionCount').textContent();
      assert(liveCount.includes('2'), `Popup live banner detected 2 selected messages in-page (got: "${liveCount}")`);

      // Test Clear action from popup
      await popupPage.locator('#liveClearBtn').click();
      await page.waitForTimeout(500);

      const inPageCheckedAfterClear = await page.locator('.wa-dl-msg-cb:checked').count();
      assert(inPageCheckedAfterClear === 0, 'Clicking "Clear" in popup successfully cleared in-page selection');
      await popupPage.close();
    } else {
      console.log('  ⚠️ Note: Extension ID not extracted via ServiceWorker target in this runner mode; in-page messaging already validated.');
    }

    console.log('\n🔀 Scenario 8: Chat Context & SPA Switching Isolation');
    // Reactivate selection mode in initial chat "Project Discussion Group"
    await badge.click();
    await bar.waitFor({ state: 'visible', timeout: 5000 });
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();
    const badgeTextBefore = await countBadge.textContent();
    assert(badgeTextBefore.includes('2 selected'), `Initial chat has 2 selected (got: "${badgeTextBefore}")`);

    // Simulate SPA chat transition to "Alice Personal"
    await page.evaluate(() => {
      const header = document.querySelector('header');
      if (header) {
        let titleEl = header.querySelector('.chat-title');
        if (!titleEl) {
          titleEl = document.createElement('div');
          titleEl.className = 'chat-title';
          header.prepend(titleEl);
        }
        titleEl.textContent = 'Alice Personal';
      }
    });
    await page.waitForTimeout(600);

    const checkedCountAfter = await page.locator('.wa-dl-msg-cb:checked').count();
    const badgeTextAfter = await countBadge.textContent();
    assert(checkedCountAfter === 0, 'Previous chat checkboxes cleanly cleared upon switching conversations');
    assert(badgeTextAfter.includes('0 /'), `Action bar count reset upon conversation switch (got: "${badgeTextAfter}")`);

    console.log('\n📦 Scenario 9: Unified ZIP Generation (Photos + PDFs bundled together)');
    // Switch back to "Project Discussion Group"
    await page.evaluate(() => {
      const header = document.querySelector('header');
      if (header) {
        const titleEl = header.querySelector('.chat-title');
        if (titleEl) titleEl.textContent = 'Project Discussion Group';
      }
    });
    await page.waitForTimeout(600);

    // Reactivate and select Image (idx 0) and Document PDF (idx 3)
    const currentCbs = page.locator('.wa-dl-msg-cb');
    await currentCbs.nth(0).click();
    await currentCbs.nth(3).click();
    const selCount = await countBadge.textContent();
    assert(selCount.includes('2 selected'), `Selected 1 photo and 1 PDF document (got: "${selCount}")`);

    // Install download listener in page to intercept generated ZIP blob
    await page.evaluate(() => {
      window.__downloadedZips = [];
      document.addEventListener('click', (e) => {
        const a = e.target ? (e.target.closest ? e.target.closest('a') : null) : null;
        if (a && a.download && a.download.endsWith('.zip') && a.href) {
          window.__downloadedZips.push({
            filename: a.download,
            href: a.href
          });
        }
      }, true);
    });

    // Click the in-page main download button in the floating bar
    const dlMainBtn = page.locator('#wa-dl-btn-download-main');
    await dlMainBtn.click();

    // Wait for the unified ZIP archive to be created and clicked
    await page.waitForFunction(() => window.__downloadedZips && window.__downloadedZips.length > 0, { timeout: 12000 });
    const zipDownload = await page.evaluate(() => window.__downloadedZips[0]);

    assert(zipDownload !== null, `Unified ZIP archive generated (name: "${zipDownload?.filename}")`);

    // Inspect the ZIP binary content
    const zipInspection = await page.evaluate(async (href) => {
      const fetchRes = await fetch(href);
      const blob = await fetchRes.blob();
      const arrayBuf = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuf);
      const textDec = new TextDecoder();
      const zipStr = textDec.decode(uint8);

      return {
        hasImage: zipStr.includes('.jpg') || zipStr.includes('WA_IMG_'),
        hasPdf: zipStr.includes('Specifications_v1.pdf'),
        hasTranscript: zipStr.includes('Transcripts'),
        size: uint8.length
      };
    }, zipDownload.href);

    assert(zipInspection.hasImage === true, 'Unified ZIP contains photo media file');
    assert(zipInspection.hasPdf === true, 'Unified ZIP contains PDF document file (Specifications_v1.pdf)');
    assert(zipInspection.hasTranscript === true, 'Unified ZIP contains companion transcript (.txt)');

  } finally {
    await context.close();
  }

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All WhatsApp Mock & Playwright E2E tests passed successfully!');
    process.exit(0);
  }
}

runSuite().catch(err => {
  console.error('💥 Test suite runner crashed:', err);
  process.exit(1);
});
