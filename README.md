# Ogefmeeting

Application web de **gestion et intelligence des réunions** pour l'OGEFREM (Office de Gestion du Fret Multimodal).

## Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, Vite, TypeScript |
| Backend | Node.js 20, Express 5, TypeScript |
| Base de données | PostgreSQL via Supabase |
| Monorepo | npm workspaces |

## Structure

```
Ogefmeeting/
├── frontend/     # Application React
├── backend/      # API REST Node.js
├── shared/       # Types et constantes partagés
├── supabase/     # Migrations BDD (étape 2)
└── docs/         # Documentation technique
```

## Prérequis

- Node.js **20+** (voir `.nvmrc`)
- npm 10+

## Installation

```bash
# À la racine du monorepo
npm install

# Copier les variables d'environnement
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Démarrage en développement

```bash
# Terminal 1 — API backend (port 4000)
npm run dev:backend

# Terminal 2 — Frontend (port 5173)
npm run dev:frontend

# Ou les deux en parallèle
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API Health | http://localhost:4000/api/health |

## Scripts racine

| Commande | Description |
|----------|-------------|
| `npm run dev` | Frontend + Backend en parallèle |
| `npm run build` | Build shared, backend et frontend |
| `npm run lint` | Lint frontend et backend |
| `npm run format` | Formater le code (Prettier) |

## État du projet

- [x] **Étape 1** — Initialisation monorepo
- [x] **Étape 2** — Base de données Supabase (migrations + seeds — RLS à l'étape 4)
- [ ] Étape 3 — Backend API core
- [ ] Étape 4 — Authentification
- [ ] Étape 5 — Design system 6I
- [ ] Étape 6–9 — Modules métier
- [ ] Étape 10 — Intégration IA

## Documentation

- [Architecture](./docs/architecture.md)
- [Conventions](./docs/conventions.md)
- [Variables d'environnement](./docs/environment.md)
- [Guide contribution](./CONTRIBUTING.md)

## Licence

Usage interne — OGEFREM
