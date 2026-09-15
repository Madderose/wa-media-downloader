# TICKET-DOM08-001 : Automatisation de la suite de tests Playwright via profil Firefox

| Métadonnée | Valeur |
|---|---|
| **ID Ticket** | `TICKET-DOM08-001` |
| **Domaine** | `DOM08` — Tooling & Tests E2E |
| **Sévérité** | **P1** |
| **Catégorie** | `E2E_GAP` |
| **Fichiers concernés** | [.agents/mcp_config.json](file:///.agents/mcp_config.json), `tests/e2e/` |
| **Statut** | ✅ RESOLVED |

---

## 1. Description de l'Anomalie
Le fichier [.agents/mcp_config.json](file:///.agents/mcp_config.json) configure un serveur MCP Playwright sous Firefox, mais il n'existe pas encore de suite de tests automatisée reproductible `npm run test:e2e` validant la détection des bulles de messages, le Shift+Clic et le téléchargement des médias.

## 2. Solution Recommandée
Créer une suite de tests Playwright (par exemple `tests/e2e/selection-and-download.spec.js`) capable de charger l'extension décompressée dans Firefox et de simuler les flux critiques.
