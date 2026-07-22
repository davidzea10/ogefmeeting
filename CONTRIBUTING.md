# Guide de contribution — Ogefmeeting

Merci de contribuer au projet Ogefmeeting. Ce guide résume les règles essentielles.

## Prérequis

1. Node.js 20+ (`nvm use` si vous utilisez nvm)
2. Copier les fichiers `.env.example` vers `.env` dans `frontend/` et `backend/`

## Workflow de développement

1. Créer une branche depuis `develop` (quand le dépôt Git sera initialisé)
2. Développer la fonctionnalité
3. Vérifier le lint et le formatage
4. Tester localement (`npm run dev`)
5. Ouvrir une pull request

## Commits

Utiliser [Conventional Commits](https://www.conventionalcommits.org/) :

```
feat(meetings): ajouter le formulaire de création
fix(api): corriger la validation des dates
docs(readme): mettre à jour l'installation
```

## Qualité du code

Avant de soumettre :

```bash
npm run lint
npm run format:check
npm run build
```

## Conventions

Voir [docs/conventions.md](./docs/conventions.md) pour le détail des conventions de nommage, structure et langue (français pour l'UI et la doc métier).

## Branches (à venir)

| Branche | Usage |
|---------|-------|
| `main` | Production |
| `develop` | Intégration |
| `feature/*` | Nouvelles fonctionnalités |

## Contact

Équipe projet — Direction OGEFREM
