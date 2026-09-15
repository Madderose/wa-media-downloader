import { firefox } from 'playwright';

async function run() {
  console.log('🚀 Lancement de Firefox avec Playwright pour écoute des logs console...');

  const browser = await firefox.launch({
    headless: false
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Écoute de tous les messages de la console
  page.on('console', msg => {
    const type = msg.type().toUpperCase();
    const text = msg.text();
    if (type === 'ERROR') {
      console.error(`🔴 [CONSOLE ERROR] ${text}`);
    } else if (type === 'WARNING' || type === 'WARN') {
      console.warn(`🟡 [CONSOLE WARN] ${text}`);
    } else {
      console.log(`ℹ️ [CONSOLE ${type}] ${text}`);
    }
  });

  // Écoute des erreurs JavaScript non capturées
  page.on('pageerror', err => {
    console.error(`💥 [PAGE UNCAUGHT ERROR] ${err.message}\n${err.stack || ''}`);
  });

  // Écoute des requêtes réseau échouées ou bloquées (ex: CSP)
  page.on('requestfailed', request => {
    console.warn(`🚫 [REQUEST BLOCKED/FAILED] ${request.method()} ${request.url()} -> ${request.failure()?.errorText}`);
  });

  console.log('🌐 Navigation vers WhatsApp Web...');
  await page.goto('https://web.whatsapp.com');

  console.log('✅ Prêt ! Vous pouvez scanner le QR code ou utiliser la session.');
  console.log('Appuyez sur Ctrl+C dans le terminal pour arrêter.');

  // Garder le script actif
  await new Promise(() => {});
}

run().catch(err => {
  console.error('Erreur Playwright :', err);
});
