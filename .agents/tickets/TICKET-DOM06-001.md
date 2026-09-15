# TICKET-DOM06-001 : Exposer aria-checked="mixed" sur la master checkbox injectée

| Métadonnée | Valeur |
|---|---|
| **ID Ticket** | `TICKET-DOM06-001` |
| **Domaine** | `DOM06` — Injected UI & A11y |
| **Sévérité** | **P2** |
| **Catégorie** | `A11Y` |
| **Fichiers concernés** | [content.js](file:///home/deck/Documents/wa-media-downloader/content.js#L1064-L1150) |
| **Statut** | ✅ RESOLVED |

---

## 1. Description de l'Anomalie
La barre de contrôle flottante injectée dans WhatsApp Web comporte une case à cocher maîtresse tri-state (`[ ]`, `[-]`, `[✓]`). Lorsque seule une partie des médias est sélectionnée, la case est visuellement partielle, mais la propriété DOM native `checkbox.indeterminate = true` et l'attribut ARIA `aria-checked="mixed"` ne sont pas toujours explicitement synchronisés.

## 2. Solution Recommandée
Dans `updateSelectionActionBar()` dans [content.js](file:///home/deck/Documents/wa-media-downloader/content.js), synchroniser :
- Si `selectedCount === 0` : `checked = false`, `indeterminate = false`, `setAttribute('aria-checked', 'false')`.
- Si `0 < selectedCount < totalCount` : `checked = false`, `indeterminate = true`, `setAttribute('aria-checked', 'mixed')`.
- Si `selectedCount === totalCount` : `checked = true`, `indeterminate = false`, `setAttribute('aria-checked', 'true')`.
