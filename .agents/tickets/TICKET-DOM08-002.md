# TICKET-DOM08-002 : Préparer la structure WebExtension i18n multi-langues

| Métadonnée | Valeur |
|---|---|
| **ID Ticket** | `TICKET-DOM08-002` |
| **Domaine** | `DOM08` — i18n & Architecture |
| **Sévérité** | **P2** |
| **Catégorie** | `I18N` |
| **Fichiers concernés** | [popup.html](file:///home/deck/Documents/wa-media-downloader/popup.html), [popup.js](file:///home/deck/Documents/wa-media-downloader/popup.js), [content.js](file:///home/deck/Documents/wa-media-downloader/content.js) |
| **Statut** | ✅ RESOLVED |

---

## 1. Description de l'Anomalie
L'ensemble des textes affichés dans le popup (`Scan`, `Download Selected`, `Entire Chat`, `Current Screen`) et dans la barre injectée (`📥 Select Media`, `Visible on screen`, `Media + Transcripts`) sont écrits en anglais en dur dans le code HTML et JavaScript, sans exploitation de l'API standard WebExtensions `chrome.i18n.getMessage()`.

## 2. Solution Recommandée
1. Créer le dossier `_locales/en/messages.json` et `_locales/fr/messages.json`.
2. Utiliser les attributs `data-i18n` ou les tokens `__MSG_...__` dans le HTML et `chrome.i18n.getMessage(...)` dans le JS.
