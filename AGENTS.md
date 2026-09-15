# WA Media Downloader — Règles Agent (Source Unique)

> Fichier unique et seule source de vérité pour les règles des agents (Antigravity, Gemini CLI, Qwen Code).
> Toute évolution d'une règle se fait ici, et seulement ici.

## 1. Changelog & Versioning (SemVer) — Politique en deux temps

Le changelog trace **chaque** modification ; le numéro de version ne change qu'**au moment du commit**.

### 1.1 À chaque modification (pendant le développement)
- Ajouter immédiatement une entrée dans la section `## [Uncommitted]` en tête de [CHANGELOG.md](CHANGELOG.md) (créer la section au-dessus de la dernière version si elle n'existe pas).
- Format des entrées : date `YYYY-MM-DD`, catégories standards (`### Added`, `### Changed`, `### Fixed`, `### Deprecated`, `### Removed`), composant concerné en gras (ex: **Content Script**, **Background Worker**, **Popup UI**, **Injected Styles**, **Packaging**), description détaillée.
- Aucun changement de numéro de version à ce stade.

### 1.2 Au commit (fonctionnalité terminée / pré-commit)
1. Choisir l'incrément SemVer :
   - **patch** (`x.y.Z`) = correction de bug, ajustement de sélecteur WhatsApp, retouche mineure.
   - **minor** (`x.Y.0`) = nouvelle fonctionnalité rétrocompatible (nouveau type de média, filtre, transcription, options).
   - **major** (`X.0.0`) = changement cassant ou refonte majeure d'architecture (ex: protocole de capture, migration MV2/MV3).
2. Exécuter `npm run version:bump -- patch|minor|major` depuis la racine (script [scripts/bump-version.mjs](scripts/bump-version.mjs)).
   - Le script met à jour automatiquement la version dans [manifest.json](manifest.json) et [package.json](package.json).
   - Il renomme `## [Uncommitted]` en `## [x.y.z] - YYYY-MM-DD` dans [CHANGELOG.md](CHANGELOG.md) et recrée une section `## [Uncommitted]` vide au-dessus.
   - Il refuse de bumper si la section `[Uncommitted]` est vide (ajouter d'abord les entrées, §1.1) ; options : `--dry-run` pour prévisualiser, `--allow-empty` pour forcer.
   - Ne jamais éditer les numéros de version manuellement afin d'éviter toute désynchronisation entre le manifest, le package et le changelog.
3. Exécuter la validation complète (section 2), puis commiter.

### 1.3 Documentation utilisateur
- Toute nouvelle fonctionnalité doit être documentée dans [README.md](README.md), avec son mode d'emploi, ses raccourcis (ex: `Shift + Clic`), les types de médias supportés et ses limites logiques, de manière claire et accessible pour les utilisateurs finaux.
- Les fonctionnalités existantes doivent être tenues à jour au fur et à mesure des évolutions.

---

## 2. Validation Obligatoire (avant tout commit / push)

Privilégier les binaires locaux directs (`./node_modules/.bin/…`) plutôt que `npx` pour éviter les timeouts de terminal.

- **Validation WebExtension** : `npm run validate` (enchaîne `web-ext lint` et les vérifications de syntaxe JS).
- **Zéro tolérance linter** : `web-ext lint` doit impérativement afficher `0 errors, 0 warnings`.
- **Packaging de production** : `npm run build` (produit l'archive de distribution propre dans `web-ext-artifacts/` via `web-ext build --overwrite-dest`).
- **Conformité multi-navigateurs** : garantir la stricte compatibilité bivalente à la fois pour Firefox (Gecko MV3 avec `browser_specific_settings.gecko` et `id: "wa-media-downloader@madderose"`) et pour Chromium (Chrome, Edge, Brave).

Toutes les erreurs doivent être résolues avant de committer. Ne jamais pousser vers le distant sans cette validation.

---

## 3. Exécution des Commandes (Terminal)
1. **Pas d'interactivité** : toujours ajouter les flags non-interactifs (`npm install --no-fund`, `npx -y`, `CI=true`). Ne jamais utiliser de commande attendant une entrée utilisateur (`stdin`).
2. **Pas de polling** : ne jamais boucler pour attendre la fin d'une commande. Lancer la commande, puis s'en remettre au mécanisme de notification de fin de l'environnement utilisé.
3. **Processus infinis** : serveurs de logs (`node scripts/log_server.mjs`) et sessions de développement en direct (`npx web-ext run`) ne se terminent jamais — les lancer en arrière-plan sans attendre leur fin.
4. **Fermeture propre** : rediriger vers `/dev/null` ou lancer en arrière-plan tout sous-processus dont la sortie n'a pas besoin d'être lue.

---

## 4. Internationalisation (i18n)
1. Pour toute chaîne affichée à l'utilisateur (popup, barre flottante injectée, infobulles, messages d'état), exploiter l'API standard WebExtensions (`chrome.i18n.getMessage` / `browser.i18n.getMessage` ou jetons `__MSG_...__` dans le HTML).
2. Ne pas disperser de chaînes de texte utilisateur codées en dur dans le JavaScript applicatif sans centralisation.
3. Structurer les dictionnaires de traduction dans `_locales/<lang>/messages.json` (ex: `_locales/en/messages.json`, `_locales/fr/messages.json`) avec descriptions sémantiques.

---

## 5. Stockage Local, Cache & Confidentialité (Zero-Data)
1. **Zero Data Collection (Strict)** : Aucun appel réseau sortant vers un serveur tiers, aucune télémétrie, aucune analytics. Tout le traitement reste 100% local dans la session du navigateur. La déclaration `data_collection_permissions: { required: ["none"] }` dans `manifest.json` doit être rigoureusement respectée.
2. **Persistance & Virtual Scroll** : WhatsApp Web recycle dynamiquement les nœuds du DOM lors du défilement. L'état des sélections utilisateur doit être conservé dans le cache mémoire (`selectedMessages`, `Set` d'identifiants uniques) et réappliqué dès que les messages réapparaissent dans le viewport.
3. **Gestion des collisions de fichiers** : Garantir l'unicité des noms de fichiers téléchargés (`WA_IMG_YYYY-MM-DD_HHhmm_XX.jpg`) via un registre des horodatages de session pour éviter tout écrasement silencieux de fichiers partageant la même minute.
4. **Cycle de vie du DOM & Nettoyage** : Déconnecter les `MutationObserver` et supprimer proprement les éléments injectés (boutons d'en-tête, barre flottante) lors du démontage ou du rechargement de la conversation.

---

## 6. Accessibilité & UI Frontend (Chargement Conditionnel)

Les règles A11y, modales, barre de contrôle flottante, support des thèmes clair/sombre WhatsApp et design sont déportées dans **[.agents/rules/a11y-frontend.md](.agents/rules/a11y-frontend.md)** pour ne pas alourdir le contexte des tâches d'arrière-plan.

- **Obligatoire** : avant toute intervention sur l'interface (`ui.css`, `popup.html`, `popup.js`, `welcome.html`, ou le DOM injecté dans `content.js`), **lire `.agents/rules/a11y-frontend.md` et appliquer l'intégralité de ses règles**. Aucun code d'interface ne doit être écrit ou modifié sans cela.
- Antigravity : cette règle est également injectée automatiquement sur les fichiers correspondants (`trigger: glob`).

---

## 7. Architecture & Qualité
- **Tâches complexes ou multi-fichiers** : rédiger d'abord un plan d'implémentation et attendre l'approbation avant d'écrire le code. Corrections simples et isolées : procéder directement.
- **Séparation stricte des rôles** :
  - [content.js](content.js) : interaction DOM WhatsApp Web, observation des mutations, capture des médias/blobs, gestion de la sélection et détection de collision.
  - [background.js](background.js) : service worker / script d'arrière-plan dédié au téléchargement (`chrome.downloads.download`), gestion des onglets et communication inter-processus.
  - [popup.html](popup.html) / [popup.js](popup.js) : panneau de configuration rapide et déclencheur d'actions globales.
  - [ui.css](ui.css) : styles isolés et thématisés pour les composants injectés.
- **Robustesse des sélecteurs WhatsApp Web** : WhatsApp Web utilise des classes CSS obfusquées susceptibles de changer entre les versions. Privilégier les sélecteurs sémantiques stables (`data-id`, attributs `aria-*`, hiérarchie des conteneurs de message, sélecteurs d'attributs) et factoriser la logique de sélection dans des fonctions utilitaires résilientes avec fallbacks.
- **Journalisation structurée & diagnostic** : utiliser le préfixe `[WA-Downloader]` pour tous les logs console, et exploiter les outils d'écoute ([scripts/log_server.mjs](scripts/log_server.mjs), [scripts/listen_console.mjs](scripts/listen_console.mjs)) lors du débogage approfondi en environnement isolé.
- **JSDoc clair** sur les fonctions et structures exportées ou critiques.

---

## 8. Connaissances Projet
- Extension WebExtension Manifest V3 (MV3) Vanilla JavaScript et CSS moderne, sans framework lourd.
- Environnement de développement : Linux natif / WSL2.
- Outils de build et de packaging : Mozilla `web-ext` configuré via [web-ext-config.cjs](web-ext-config.cjs).
- Tests & automatisation : MCP Playwright configuré dans `.agents/mcp_config.json` avec profil Firefox pour les interactions sur WhatsApp Web.
- Graphe de codebase Graphify dans `graphify-out/` (`COMPASS.md`, `DOMAINS.md`, `graph.compact.txt`) — régénérer avec `python -m graphify update .` (ou `python3 -m graphify update .`).
- **Commits** : Conventional Commits (`feat(scope): …`, `fix(scope): …`), description à l'impératif (ex: `feat(content): add multi-album selection support`, `fix(background): resolve download filename sanitization`).
