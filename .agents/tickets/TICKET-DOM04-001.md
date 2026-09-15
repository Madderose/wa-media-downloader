# TICKET-DOM04-001 : Conditionner l'envoi de logs vers 127.0.0.1:9876 au mode développement

| Métadonnée | Valeur |
|---|---|
| **ID Ticket** | `TICKET-DOM04-001` |
| **Domaine** | `DOM04` — Background Worker & Téléchargements / `DOM07` — Sécurité & Privacy |
| **Sévérité** | **P1** (Moyenne / Risque de rejet AMO) |
| **Catégorie** | `PRIVACY` / `AMO_COMPLIANCE` |
| **Fichiers concernés** | [background.js](file:///home/deck/Documents/wa-media-downloader/background.js#L9-L19), [content.js](file:///home/deck/Documents/wa-media-downloader/content.js#L14-L20) |
| **Statut** | ✅ RESOLVED |

---

## 1. Description de l'Anomalie
Dans [background.js](file:///home/deck/Documents/wa-media-downloader/background.js) et [content.js](file:///home/deck/Documents/wa-media-downloader/content.js), la fonction `forwardLog()` émet des requêtes HTTP `POST http://127.0.0.1:9876/log` via `fetch()` pour alimenter le serveur de log local de diagnostic.

Bien que le port soit local (127.0.0.1), [manifest.json](file:///home/deck/Documents/wa-media-downloader/manifest.json) déclare :
```json
"data_collection_permissions": {
  "required": ["none"]
}
```
Lors de la soumission sur Mozilla Add-ons (AMO), les scanners automatiques ou les relecteurs humains peuvent interpréter cet appel `fetch()` inconditionnel comme une tentative de communication réseau non déclarée.

## 2. Solution Recommandée
Introduire une constante explicite :
```javascript
const DEBUG_SERVER_ENABLED = false; // Basculer à true uniquement lors du debug local
```
et n'exécuter l'appel `fetch()` que si ce flag est actif, évitant ainsi toute requête intempestive en production.
