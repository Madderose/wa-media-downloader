# Rapports d'Audit 360° — WA Media Downloader Agent Squad

Ce répertoire contient les rapports d'audit exhaustifs générés par les agents pour chaque domaine applicatif de l'extension WebExtension.

---

## 🏷️ Convention de Nommage des Fichiers de Rapport

Chaque rapport d'audit de domaine doit être nommé ainsi :
```
AUDIT_REPORT_DOM<NuméroDomaine>_<slug_domaine>.md
```

Exemples :
- `AUDIT_REPORT_DOM01_dom_detection.md`
- `AUDIT_REPORT_DOM02_selection_engine.md`
- `AUDIT_REPORT_DOM04_background_downloads.md`
- `AUDIT_REPORT_DOM05_popup_ui.md`

Le template officiel à utiliser est disponible dans [`AUDIT_REPORT_TEMPLATE.md`](file:///.agents/audit_reports/AUDIT_REPORT_TEMPLATE.md).
Une fois le rapport rédigé, l'agent doit lier ce rapport et reporter ses scores dans [`AUDIT_TRACKER.md`](file:///home/deck/Documents/wa-media-downloader/AUDIT_TRACKER.md).
