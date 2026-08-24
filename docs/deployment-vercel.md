# Déploiement Vercel + Render

## Architecture recommandée

| Service | Plateforme | Projet |
|---------|------------|--------|
| **Frontend** (React/Vite) | Vercel | `ogefmeeting-frontend` |
| **Backend** (Express API) | Render | `ogefmeeting-api` |
| **Base de données** | Supabase | — |

Le backend **ne doit pas** tourner sur Vercel (API Express longue durée). Utilisez **Render** (`render.yaml` à la racine).

---

## Projet Vercel frontend (`ogefmeeting-frontend`)

Dans **Vercel → Project Settings → General** :

| Paramètre | Valeur |
|-----------|--------|
| **Root Directory** | `frontend` *(minuscules, pas `Frontend`)* |
| **Framework Preset** | Vite |
| **Build Command** | *(laisser vide — utilise `frontend/vercel.json`)* |
| **Output Directory** | `dist` |
| **Install Command** | *(laisser vide — utilise `frontend/vercel.json`)* |

Le fichier `frontend/vercel.json` installe les workspaces depuis la racine du monorepo (`cd .. && npm install`).

### Variables d'environnement (Vercel → Settings → Environment Variables)

| Variable | Exemple |
|----------|---------|
| `VITE_API_URL` | `https://ogefmeeting-api.onrender.com` |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | clé anon Supabase |
| `VITE_AUTH_REQUIRED` | `true` |

Après modification des variables : **Redeploy**.

---

## Projet Vercel en échec (`ogefmeeting`)

Si GitHub affiche une croix rouge **« Root Directory "Frontend" does not exist »** :

- Vous avez un **3ᵉ projet Vercel** (`ogefmeeting`) en double, avec un mauvais chemin (`Frontend` avec majuscule).
- Sur Linux/Vercel, les chemins sont **sensibles à la casse** : le dossier du repo est `frontend` (minuscules).

**Solution (au choix) :**

1. **Recommandé** — Supprimer ou déconnecter le projet `ogefmeeting` sur Vercel (garder uniquement `ogefmeeting-frontend`).
2. **Ou** — Corriger **Root Directory** : `Frontend` → `frontend`.

Les croix rouges sur GitHub ne signifient **pas** que le code est cassé : c’est ce déploiement dupliqué qui échoue. Les projets `ogefmeeting-frontend` et `ogefmeeting-backend` peuvent être verts en parallèle.

---

## Backend sur Render

Voir `render.yaml`. Variables essentielles :

| Variable | Description |
|----------|-------------|
| `CORS_ORIGIN` | URL Vercel frontend, ex. `https://ogefmeeting-frontend.vercel.app` |
| `FRONTEND_URL` | Même URL (emails, liens invitations) |
| `SUPABASE_URL` / clés | Connexion BDD |
| `AUTH_ENFORCED` | `true` en production |

Redéployer Render après changement de `CORS_ORIGIN`.

---

## Migrations Supabase (nouvelles fonctionnalités)

Les features récentes (multi-direction, validation réunion, etc.) nécessitent les migrations :

- `supabase/migrations/20260812150000_reunions_multi_direction.sql`
- `supabase/migrations/20260812160000_reunion_validation.sql`

Exécutez-les dans le SQL Editor Supabase si ce n’est pas déjà fait.

---

## Vérification rapide

1. Frontend : `https://votre-app.vercel.app` — page de connexion OK
2. API : `https://votre-api.onrender.com/api/health` — JSON `ok`
3. Console navigateur (F12) : pas d’erreurs CORS ni `VITE_API_URL` undefined
