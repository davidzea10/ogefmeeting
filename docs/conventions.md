# Conventions — Ogefmeeting

## Commits (Conventional Commits)

```
type(scope): description courte

feat(meetings): ajouter la création de réunion
fix(auth): corriger l'expiration du token
docs(readme): mettre à jour les instructions d'installation
chore(deps): mettre à jour les dépendances
```

**Types** : `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Nommage des fichiers

| Contexte | Convention | Exemple |
|----------|------------|---------|
| Composants React | PascalCase | `MeetingCard.tsx` |
| Hooks | camelCase, préfixe `use` | `useMeetings.ts` |
| Routes API | kebab-case | `health.routes.ts` |
| Services | kebab-case | `meeting.service.ts` |
| Tables BDD | snake_case français | `participants_reunion`, `comptes_rendus` |
| Colonnes BDD | snake_case français | `date_prevue`, `cree_par`, `est_actif` |
| Enums BDD | snake_case français | `administrateur`, `planifiee`, `brouillon` |
| Variables env | SCREAMING_SNAKE | `SUPABASE_URL` |

## Branches Git (quand le dépôt sera créé)

| Branche | Usage |
|---------|-------|
| `main` | Production stable |
| `develop` | Intégration continue |
| `feature/*` | Nouvelles fonctionnalités |
| `fix/*` | Corrections de bugs |

## Code

- TypeScript strict activé
- ESLint + Prettier avant chaque commit
- Commentaires en français pour la logique métier non évidente
- Interface utilisateur en français
