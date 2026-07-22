# Variables d'environnement

## Frontend (`frontend/.env`)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_API_URL` | URL de l'API backend | `http://localhost:4000` |
| `VITE_SUPABASE_URL` | URL du projet Supabase | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clé publique Supabase | `eyJ...` |

## Backend (`backend/.env`)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `NODE_ENV` | Environnement | `development` |
| `PORT` | Port de l'API | `4000` |
| `CORS_ORIGIN` | Origine autorisée (frontend) | `http://localhost:5173` |
| `SUPABASE_URL` | URL du projet Supabase | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service (secrète, backend only) | `eyJ...` |
| `SUPABASE_ANON_KEY` | Clé anon (login/signup) | `eyJ...` |
| `AUTH_ENFORCED` | `false` = jamais bloquant (défaut) ; `true` = JWT obligatoire | `false` |

## Auth JWT (mode souple)

Par défaut `AUTH_ENFORCED=false` :
- L’API **fonctionne sans login**
- Si un Bearer token est fourni, `req.user` est rempli
- Aucune route métier ne refuse une requête pour absence de token
- Pour durcir plus tard (production stricte) : `AUTH_ENFORCED=true`

## Sécurité

- Ne jamais committer les fichiers `.env`
- La clé `SERVICE_ROLE_KEY` ne doit **jamais** être exposée côté frontend
- Utiliser `.env.example` comme modèle sans valeurs réelles
