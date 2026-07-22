# Accessibilité & responsive — Étape 5.6

Checklist Ogefmeeting (WCAG 2.1 niveau **AA** ciblé).

## Breakpoints

| Nom | Largeur | Usage |
|-----|---------|--------|
| Mobile | `< 640px` (`sm`) | Menu drawer, padding réduit, cibles ≥ 44px |
| Tablette | `640–1023px` | Recherche header à partir de `md` |
| Desktop | `≥ 1024px` (`lg`) | Sidebar fixe + collapse |

## Contrastes

Palette ajustée pour AA :

- Texte principal `#0f1f33` sur blanc
- Texte secondaire `#3d4f66` sur blanc (≥ 4.5:1)
- Bouton jaune : texte navy `#0a2540` (jamais jaune sur blanc pour du texte)
- Succès / danger assombris pour le texte

## Clavier

- **Tab / Shift+Tab** — parcours des contrôles focusables
- **Skip link** « Aller au contenu principal » (premier Tab)
- **Escape** — ferme le menu mobile
- **Focus trap** — dans le drawer mobile ouvert
- **aria-expanded / aria-controls** — bouton menu

## ARIA & sémantique

- `lang="fr"` sur `<html>`
- Landmarks : `banner`, `main`, `navigation`, `dialog` (menu mobile)
- `aria-live` via `LiveAnnouncer` (ex. déconnexion)
- Inputs : `aria-invalid`, `aria-describedby`, `aria-required`
- Boutons icône : `aria-label` obligatoire
- Liens actifs : indication « page courante » pour lecteurs d’écran

## `prefers-reduced-motion`

Animations Framer Motion et transitions CSS réduites automatiquement.

## Tests manuels recommandés

1. Chrome / Edge / Firefox — DevTools responsive (375 / 768 / 1280)
2. Navigation clavier seule (pas de souris)
3. Lecteur d’écran : NVDA (Windows) ou VoiceOver (macOS/iOS)
4. Extension axe DevTools ou Lighthouse Accessibility

## Navigateur

Ciblés : Chrome, Firefox, Edge, Safari (WebKit). Pas de polyfills spécifiques pour l’instant.
