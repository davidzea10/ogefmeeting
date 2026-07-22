# Architecture — Ogefmeeting

## Stack

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, Vite, TypeScript |
| Backend | Node.js 20, Express 5, TypeScript |
| Base de données | PostgreSQL via Supabase |
| Auth | Supabase Auth |
| Stockage | Supabase Storage |

## Structure monorepo

```
Ogefmeeting/
├── frontend/     # Application React (SPA)
├── backend/      # API REST Node.js
├── shared/       # Types et constantes partagés
├── supabase/     # Migrations et config BDD
└── docs/         # Documentation technique
```

## Flux de données

```
Navigateur (React)
    ↕ REST / WebSocket
API Node.js (Express)
    ↕
Supabase (PostgreSQL + Auth + Storage)
    ↕ (Phase 2)
Services IA (transcription, synthèse)
```

## Ports par défaut

| Service | Port |
|---------|------|
| Frontend (Vite) | 5173 |
| Backend (Express) | 4000 |
