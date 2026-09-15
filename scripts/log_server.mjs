import http from 'http';
import fs from 'fs';

const logFile = '/tmp/extension_debug.log';
fs.writeFileSync(logFile, `=== SERVEUR DE LOGS DÉMARRÉ À ${new Date().toISOString()} ===\n`);

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const entry = `[${new Date().toLocaleTimeString()}] ${body}\n`;
      fs.appendFileSync(logFile, entry);
      process.stdout.write(entry);
      res.writeHead(200);
      res.end('OK');
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(9876, '127.0.0.1', () => {
  console.log('Serveur de logs extension actif sur http://127.0.0.1:9876');
});
