# Frontend — Ogefmeeting

Application React (Vite + TypeScript) pour Ogefmeeting.

## Démarrage

```bash
cp .env.example .env
npm install
npm run dev
```

Interface disponible sur `http://localhost:5173`.

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build production |
| `npm run preview` | Prévisualiser le build |
| `npm run lint` | Linter (oxlint) |

## Structure prévue

```
src/
├── components/   # Composants UI (étape 5)
├── pages/        # Pages de l'application
├── hooks/        # Hooks React
├── lib/          # Clients API, Supabase
├── stores/       # État global
└── types/        # Types locaux
```
