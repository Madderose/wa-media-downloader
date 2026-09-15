# TICKET-DOM07-001 : Supprimer ou isoler le shim de fetch http://127.0.0.1:9876/log dans content.js

| Métadonnée | Valeur |
|---|---|
| **ID Ticket** | `TICKET-DOM07-001` |
| **Domaine** | `DOM07` — Sécurité & Conformité AMO |
| **Sévérité** | **P1** |
| **Catégorie** | `COMPLIANCE` / `PRIVACY` |
| **Fichiers concernés** | [content.js](file:///home/deck/Documents/wa-media-downloader/content.js#L14-L20) |
| **Statut** | ✅ RESOLVED |

---

## 1. Description de l'Anomalie
Au début de [content.js](file:///home/deck/Documents/wa-media-downloader/content.js), dans le shim de secours pour Playwright :
```javascript
if (msg && msg.action === 'log') {
  fetch('http://127.0.0.1:9876/log', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: String(msg.message)
  }).catch(() => {});
}
```
Ce code s'exécute dans le contexte de la page `https://web.whatsapp.com/*`. Les Content Security Policies (CSP) strictes de WhatsApp Web ou les revues de code AMO peuvent bloquer ou signaler cet appel comme une tentative de fuite réseau.

## 2. Solution Recommandée
Conditionner cet appel au mode de test ou supprimer le `fetch` direct depuis le content script, en ne laissant la journalisation locale que via `console.log()` ou un pont explicite contrôlé.
