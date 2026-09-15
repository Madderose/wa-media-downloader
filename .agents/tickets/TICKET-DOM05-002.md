# TICKET-DOM05-002 : Exposer aria-pressed sur les boutons de scope et de filtres du popup

| Métadonnée | Valeur |
|---|---|
| **ID Ticket** | `TICKET-DOM05-002` |
| **Domaine** | `DOM05` — Interface Utilisateur Popup / A11y |
| **Sévérité** | **P2** |
| **Catégorie** | `A11Y` / `ARIA` |
| **Fichiers concernés** | [popup.html](file:///home/deck/Documents/wa-media-downloader/popup.html#L35-L46), [popup.js](file:///home/deck/Documents/wa-media-downloader/popup.js#L26-L38) |
| **Statut** | ✅ RESOLVED |

---

## 1. Description de l'Anomalie
Les boutons de sélection de portée (`#scopeAll`, `#scopeVisible`) et les boutons de filtrage de médias (`.filter-btn`) agissent comme des bascules (toggle buttons). Actuellement, leur état est uniquement reflété par l'ajout ou la suppression de classes CSS (`active` / `inactive`), sans attribut `aria-pressed="true|false"`.

## 2. Solution Recommandée
Initialiser `aria-pressed="true"` sur `#scopeAll` et `aria-pressed="false"` sur `#scopeVisible` et les filtres. Mettre à jour `aria-pressed` lors des clics dans [popup.js](file:///home/deck/Documents/wa-media-downloader/popup.js).
