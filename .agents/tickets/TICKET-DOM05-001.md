# TICKET-DOM05-001 : Ajouter les rôles ARIA role="status" et role="progressbar" dans popup.html

| Métadonnée | Valeur |
|---|---|
| **ID Ticket** | `TICKET-DOM05-001` |
| **Domaine** | `DOM05` — Interface Utilisateur Popup / A11y |
| **Sévérité** | **P2** (Amélioration accessibilité) |
| **Catégorie** | `A11Y` |
| **Fichiers concernés** | [popup.html](file:///home/deck/Documents/wa-media-downloader/popup.html#L56-L61) |
| **Statut** | ✅ RESOLVED |

---

## 1. Description de l'Anomalie
Dans [popup.html](file:///home/deck/Documents/wa-media-downloader/popup.html) :
1. Le conteneur de message d'état `<p class="status-text" id="status">Ready</p>` ne porte pas d'attribut `role="status"` ni `aria-live="polite"`. Les lecteurs d'écran ne vocalisent donc pas les changements d'état lors du scan ou du téléchargement.
2. La barre de progression `<div class="progress-bar" id="progress-wrap"><div class="progress-fill" id="progress-fill"></div></div>` n'expose pas de `role="progressbar"`, ni les attributs `aria-valuenow`, `aria-valuemin="0"` et `aria-valuemax="100"`.

## 2. Solution Recommandée
- Ajouter `role="status"` et `aria-live="polite"` sur `#status`.
- Ajouter `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="100"` et mettre à jour `aria-valuenow` dynamiquement dans `popup.js`.
