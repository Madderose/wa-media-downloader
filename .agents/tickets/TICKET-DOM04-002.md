# TICKET-DOM04-002 : Téléchargement groupé en archive .zip unique par défaut et option de téléchargement individuel

| Métadonnée | Valeur |
|---|---|
| **ID Ticket** | `TICKET-DOM04-002` |
| **Domaine** | `DOM04` — Background Worker & Téléchargements / `DOM05` — Popup UI & Ergonomie |
| **Sévérité** | **P1** (Majeure / UX critique) |
| **Catégorie** | `FEATURE` / `UX_DOWNLOADS` |
| **Fichiers concernés** | [lib/zip-packager.js](file:///home/deck/Documents/wa-media-downloader/lib/zip-packager.js), [content.js](file:///home/deck/Documents/wa-media-downloader/content.js), [popup.html](file:///home/deck/Documents/wa-media-downloader/popup.html), [popup.js](file:///home/deck/Documents/wa-media-downloader/popup.js), [manifest.json](file:///home/deck/Documents/wa-media-downloader/manifest.json) |
| **Statut** | ✅ RESOLVED |

---

## 1. Description de la Problématique
Lors du téléchargement groupé d'un lot de médias (images, vidéos, messages vocaux), le navigateur demande une confirmation pour chaque fichier si l'option « Toujours demander où enregistrer les fichiers » est activée, générant X fenêtres d'invite successives.

## 2. Solution Implémentée
1. **Archive .ZIP par défaut** :
   - Regroupement de l'ensemble des médias sélectionnés (et du fichier `.txt` de légendes/transcriptions) dans une seule archive standard `WA_Media_YYYY-MM-DD_HHhmm.zip`.
   - Évite les X confirmations de téléchargement en les ramenant à une seule validation.
2. **Moteur ZIP Zero-Data (`lib/zip-packager.js`)** :
   - Encodeur PKZIP standard STORE pur JavaScript avec calcul du CRC-32 sans aucune dépendance externe ni appel réseau.
3. **Réglage dans le Plugin** :
   - Ajout d'une section accessible (`role="radiogroup"`) dans [popup.html](file:///home/deck/Documents/wa-media-downloader/popup.html) avec deux options :
     - `[●] Archive .zip unique (Par défaut)`
     - `[○] Téléchargement individuel des fichiers`
   - Persistance du choix dans `chrome.storage.local`.
4. **Multi-navigateurs & i18n** :
   - Prise en charge Gecko MV3 (Firefox) et Chromium.
   - Traductions complètes en français et anglais.
