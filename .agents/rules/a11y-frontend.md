---
trigger: glob
globs: ui.css, popup.html, popup.js, welcome.html, content.js
description: Règles A11y & UI frontend (modales, barre flottante, thèmes clair/sombre WhatsApp, design) — s'appliquent à toute modification d'interface ou de style
---

# Standards A11y & UI Frontend

> Règles chargées à la demande. **Obligatoires pour toute modification de l'interface utilisateur** (`ui.css`, `popup.html`, `popup.js`, `welcome.html`, ou éléments DOM injectés dans `content.js`).

## Accessibilité (A11y)
1. **Éléments interactifs** : Utiliser de vrais éléments `<button>` ou `<input type="checkbox">` pour tous les contrôles injectés. Si un élément non-natif est utilisé, lui assigner un `role` explicite (ex : `role="button"`), un `tabindex="0"`, et gérer les événements clavier (`Enter` et `Space`). Nom accessible obligatoire (`aria-label` ou `title` sur tous les boutons icône-seule : `📥`, `👁️`, `✕`, etc.).
2. **États exposés (ARIA)** :
   - Cases à cocher individuelles et groupées : exposer l'état via `aria-checked="true|false|mixed"` (la case principale tri-state gère l'état indéterminé `mixed`).
   - Boutons bascules : `aria-pressed="true|false"`.
   - État de sélection DOM : attribut sémantique `data-selected="true"` pour le ciblage CSS sans conflit.
3. **Pas de dialogues natifs bloquants** : `window.alert`, `window.confirm` et `window.prompt` sont **strictement interdits** (ils bloquent l'onglet WhatsApp Web et brisent la boucle d'événements). Utiliser des badges d'état discrets, des infobulles ou la barre flottante de l'extension.
4. **Retour d'opération & Lecteurs d'écran** :
   - Les informations de statut (nombre de messages sélectionnés, progression du scan, confirmation de téléchargement) doivent être écrites dans un conteneur accessible doté de `role="status"` ou `aria-live="polite"`.
   - Annoncer clairement les changements d'état (ex: "12 médias sélectionnés", "Téléchargement démarré").
5. **Barre Flottante & Modales Injectées** :
   - Insertion propre dans le conteneur principal ou `document.body` avec un `z-index` maîtrisé (`999999`) pour rester visible au-dessus des flux de messages sans masquer les tiroirs d'informations natifs de WhatsApp.
   - **Touche Escape** : écoute globale de la touche `Escape` pour désélectionner tous les messages ou masquer la barre flottante.
   - **Sélection continue (Shift + Clic)** : support complet du clic avec touche `Shift` pour sélectionner un intervalle de médias avec mise à jour visuelle instantanée des cases intermédiaires.
6. **Thème & Mode Clair / Sombre (WhatsApp Web)** :
   - WhatsApp Web alterne dynamiquement entre mode clair et sombre (via la classe `.dark` ou l'attribut `data-theme="dark"` sur le `body`).
   - Toutes les couleurs (arrières-plans, bordures, textes, badges, boutons) doivent s'adapter automatiquement au thème actif de WhatsApp Web en utilisant des variables CSS (`var(--wam-...)`) ou en ciblant `body.dark`.
   - Ne jamais coder de couleurs hexadécimales en dur dans le JavaScript sans synchronisation avec les variables de `ui.css`.
7. **Isolation des Styles (CSS Scoping)** :
   - Toutes les classes CSS injectées doivent être strictement préfixées (ex : `.wam-select-btn`, `.wam-floating-bar`, `.wam-checkbox`, `.wam-badge`).
   - Aucune règle générique ne doit fuiter sur les éléments natifs de WhatsApp Web (ne jamais styliser directement `button`, `input` ou `div` sans sélecteur parent préfixé).
8. **Contraste (WCAG AA)** :
   - Ratio de contraste texte/arrière-plan ≥ 4.5:1 pour le texte normal (labels, compteurs de messages).
   - Ratio ≥ 3:1 pour les bordures de sélection, les icônes d'action et les états de focus.
9. **`prefers-reduced-motion`** :
   - Respecter la préférence utilisateur `@media (prefers-reduced-motion: reduce)` en désactivant ou réduisant les transitions et animations (pulsation des badges, glissement de la barre flottante).
10. **Navigation Clavier & Focus Visible** :
    - Tous les contrôles injectés doivent présenter un contour de focus distinct et contrasté (`:focus-visible`).

## Design
- Design de qualité production : esthétique moderne, épurée et intégrée naturellement à l'identité visuelle de WhatsApp Web.
- Glassmorphism subtil (`backdrop-filter: blur(...)`), ombres douces, bordures fines semi-transparentes, micro-interactions soignées au survol.
- Stack UI : Vanilla CSS pur avec variables personnalisées, icônes SVG/Unicode intégrées (aucun framework CSS externe ni dépendance lourde afin de maintenir une empreinte mémoire minimale).
